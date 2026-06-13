import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) return json({ error: "Token de autenticación requerido" }, 401);

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return json({ error: "Token inválido o expirado" }, 401);

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("id, org_id, rol")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return json({ error: "Perfil de usuario no encontrado" }, 403);
  }

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  const id = segmentos[1] || null;
  const accion = segmentos[2] || null;

  try {
    switch (req.method) {
      case "GET":
        if (id) return obtenerProducto(supabase, perfil, id);
        return listarProductos(supabase, perfil, url);

      case "POST":
        return crearProducto(supabase, perfil, await req.json());

      case "PATCH":
        if (accion === "toggle" && id) return toggleProducto(supabase, perfil, id);
        if (id) return actualizarProducto(supabase, perfil, id, await req.json());
        return json({ error: "ID de producto requerido" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en productos:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarProductos(supabase: any, perfil: PerfilUsuario, url: URL) {
  const soloActivos = url.searchParams.get("activos") === "true";

  let query = supabase
    .from("productos")
    .select(`
      *,
      formas_farmaceuticas!inner(nombre),
      producto_principio_activo(
        id, concentracion,
        principios_activos!inner(id, nombre, codigo_atc),
        unidades_medida!inner(id, nombre, simbolo)
      ),
      proveedor_producto(
        id, lead_time_especifico, precio_compra,
        proveedores!inner(id, razon_social)
      )
    `)
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });

  if (soloActivos) {
    query = query.eq("estado", "activo");
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

async function obtenerProducto(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("productos")
    .select(`
      *,
      formas_farmaceuticas(nombre),
      producto_principio_activo(
        id, concentracion,
        principios_activos(id, nombre, codigo_atc),
        unidades_medida(id, nombre, simbolo)
      ),
      proveedor_producto(
        id, lead_time_especifico, precio_compra,
        proveedores(id, razon_social)
      )
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: "Producto no encontrado" }, 404);

  return json({ datos: data });
}

async function crearProducto(supabase: any, perfil: PerfilUsuario, body: any) {
  const { nombre_comercial, forma_farmaceutica_id, presentacion, clasificacion, estado, principios_activos } = body;

  if (!nombre_comercial || !clasificacion) {
    return json({ error: "Faltan datos obligatorios (nombre_comercial, clasificacion)" }, 400);
  }

  const { data: producto, error: errProd } = await supabase
    .from("productos")
    .insert({
      org_id: perfil.org_id,
      nombre_comercial,
      forma_farmaceutica_id: forma_farmaceutica_id || null,
      presentacion: presentacion || null,
      clasificacion,
      estado: estado || "activo",
      modified_by: perfil.id,
    })
    .select("id")
    .single();

  if (errProd) {
    if (errProd.code === "23505") {
      return json({ error: "Ya existe un producto con ese código interno en tu organización" }, 409);
    }
    return json({ error: errProd.message }, 400);
  }

  if (principios_activos?.length > 0) {
    const paRows = principios_activos.map((pa: any) => ({
      producto_id: producto.id,
      principio_activo_id: pa.principio_activo_id,
      concentracion: pa.concentracion,
      unidad_medida_id: pa.unidad_medida_id || null,
    }));

    const { error: errPa } = await supabase
      .from("producto_principio_activo")
      .insert(paRows);

    if (errPa) console.error("Error al insertar principios activos:", errPa.message);
  }

  return json({
    exito: true,
    id: producto.id,
  });
}

async function actualizarProducto(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { nombre_comercial, forma_farmaceutica_id, presentacion, clasificacion, estado, principios_activos } = body;

  const { error: errProd } = await supabase
    .from("productos")
    .update({
      ...(nombre_comercial !== undefined && { nombre_comercial }),
      ...(forma_farmaceutica_id !== undefined && { forma_farmaceutica_id }),
      ...(presentacion !== undefined && { presentacion }),
      ...(clasificacion !== undefined && { clasificacion }),
      ...(estado !== undefined && { estado }),
      modified_at: new Date().toISOString(),
      modified_by: perfil.id,
    })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errProd) {
    return json({ error: errProd.message }, 400);
  }

  if (principios_activos !== undefined) {
    await supabase.from("producto_principio_activo").delete().eq("producto_id", id);

    if (principios_activos.length > 0) {
      const paRows = principios_activos.map((pa: any) => ({
        producto_id: id,
        principio_activo_id: pa.principio_activo_id,
        concentracion: pa.concentracion,
        unidad_medida_id: pa.unidad_medida_id || null,
      }));

      const { error: errPa } = await supabase
        .from("producto_principio_activo")
        .insert(paRows);

      if (errPa) console.error("Error al re-insertar principios activos:", errPa.message);
    }
  }

  return json({ exito: true });
}

async function toggleProducto(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: actual, error: errGet } = await supabase
    .from("productos")
    .select("estado")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Producto no encontrado" }, 404);

  const nuevoEstado = actual.estado === "activo" ? "inactivo" : "activo";

  const { error: errUpd } = await supabase
    .from("productos")
    .update({ estado: nuevoEstado, modified_at: new Date().toISOString(), modified_by: perfil.id })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  return json({ exito: true, estado: nuevoEstado });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
