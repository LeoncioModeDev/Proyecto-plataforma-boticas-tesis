import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    .select("id, org_id, rol, activo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return json({ error: "Perfil de usuario no encontrado" }, 403);
  }

  if (!perfil.activo) {
    return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);
  }

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  const id = segmentos[1] || null;

  try {
    if (req.method === "GET") {
      return listarPorProducto(supabase, perfil, url);
    }

    if (req.method === "POST") {
      return guardarRelacion(supabase, perfil, await req.json());
    }

    if (req.method === "DELETE" && id) {
      return eliminarRelacion(supabase, perfil, id);
    }

    return json({ error: "Método no soportado" }, 405);
  } catch (e) {
    console.error("Error en proveedor-producto:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarPorProducto(supabase: any, perfil: PerfilUsuario, url: URL) {
  const productoId = url.searchParams.get("producto_id");
  const proveedorId = url.searchParams.get("proveedor_id");
  const soloActivos = url.searchParams.get("solo_activos") === "true";

  if (!productoId && !proveedorId) {
    return json({ error: "Se requiere producto_id o proveedor_id como query param" }, 400);
  }

  let query = supabase
    .from("proveedor_producto")
    .select(`
      *,
      proveedores!inner(id, razon_social, org_id, activo),
      productos(id, nombre_comercial, presentacion, clasificacion, estado)
    `)
    .order("created_at", { ascending: false });

  if (productoId) query = query.eq("producto_id", productoId);
  if (proveedorId) query = query.eq("proveedor_id", proveedorId);

  query = query.eq("activo", true);

  const { data, error } = await query;

  if (error) return json({ error: error.message }, 400);

  let datosFiltrados = data.filter((r: any) => r.proveedores?.org_id === perfil.org_id);

  if (soloActivos) {
    datosFiltrados = datosFiltrados.filter((r: any) =>
      r.productos?.estado === "activo"
    );
  }

  return json({ datos: datosFiltrados });
}

async function guardarRelacion(supabase: any, perfil: PerfilUsuario, body: any) {
  const { proveedor_id, producto_id, lead_time_especifico, precio_compra_referencial, cantidad_minima_compra = 1, multiplo_empaque = 1 } = body;

  if (!proveedor_id || !producto_id || lead_time_especifico === undefined || precio_compra_referencial === undefined) {
    return json({ error: "Faltan datos (proveedor_id, producto_id, lead_time_especifico, precio_compra_referencial)" }, 400);
  }

  if (Number(cantidad_minima_compra) <= 0 || Number(multiplo_empaque) <= 0) {
    return json({ error: "Cantidad mínima de compra y múltiplo de empaque deben ser mayores a 0" }, 400);
  }

  const { data: producto } = await supabase
    .from("productos")
    .select("estado")
    .eq("id", producto_id)
    .single();

  if (!producto) return json({ error: "Producto no encontrado" }, 404);
  if (producto.estado !== "activo") {
    return json({ error: "No se puede configurar lead time para un producto inactivo o descontinuado" }, 400);
  }

  const { data: existente } = await supabase
    .from("proveedor_producto")
    .select("id, activo")
    .eq("proveedor_id", proveedor_id)
    .eq("producto_id", producto_id)
    .maybeSingle();

  if (existente) {
    if (!existente.activo) {
      const { error: errUpd } = await supabase
        .from("proveedor_producto")
        .update({
          lead_time_especifico,
          precio_compra_referencial,
          cantidad_minima_compra,
          multiplo_empaque,
          activo: true,
        })
        .eq("id", existente.id);
      if (errUpd) return json({ error: errUpd.message }, 400);
      return json({ exito: true, id: existente.id, actualizado: true });
    }
    const { error: errUpd } = await supabase
      .from("proveedor_producto")
      .update({
        lead_time_especifico,
        precio_compra_referencial,
        cantidad_minima_compra,
        multiplo_empaque,
      })
      .eq("id", existente.id);

    if (errUpd) return json({ error: errUpd.message }, 400);
    return json({ exito: true, id: existente.id, actualizado: true });
  }

  const { data: nuevo, error: errIns } = await supabase
    .from("proveedor_producto")
    .insert({
      proveedor_id,
      producto_id,
      lead_time_especifico,
      precio_compra_referencial,
      cantidad_minima_compra,
      multiplo_empaque,
      activo: true,
    })
    .select("id")
    .single();

  if (errIns) return json({ error: errIns.message }, 400);
  return json({ exito: true, id: nuevo.id, actualizado: false });
}

async function eliminarRelacion(supabase: any, perfil: PerfilUsuario, id: string) {
  const { error } = await supabase
    .from("proveedor_producto")
    .update({ activo: false })
    .eq("id", id);

  if (error) return json({ error: error.message }, 400);
  return json({ exito: true, activo: false });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
