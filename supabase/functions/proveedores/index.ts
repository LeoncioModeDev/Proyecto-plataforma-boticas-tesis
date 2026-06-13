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
        if (id) return obtenerProveedor(supabase, perfil, id);
        return listarProveedores(supabase, perfil, url);

      case "POST":
        return crearProveedor(supabase, perfil, await req.json());

      case "PATCH":
        if (accion === "toggle" && id) return toggleProveedor(supabase, perfil, id);
        if (id) return actualizarProveedor(supabase, perfil, id, await req.json());
        return json({ error: "ID de proveedor requerido" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en proveedores:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarProveedores(supabase: any, perfil: PerfilUsuario, url: URL) {
  const soloActivos = url.searchParams.get("activos") === "true";

  let query = supabase
    .from("proveedores")
    .select("*")
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });

  if (soloActivos) {
    query = query.eq("activo", true);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

async function obtenerProveedor(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("proveedores")
    .select(`
      *,
      contactos_proveedor(*),
      condiciones_comerciales(*, monedas(*))
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: "Proveedor no encontrado" }, 404);
  return json({ datos: data });
}

async function crearProveedor(supabase: any, perfil: PerfilUsuario, body: any) {
  const { razon_social, tipo_identificacion, numero_identificacion, pais_origen, contactos, condiciones_comerciales } = body;

  if (!razon_social || !tipo_identificacion || !numero_identificacion) {
    return json({ error: "Faltan datos obligatorios (razon_social, tipo_identificacion, numero_identificacion)" }, 400);
  }

  const { data: proveedor, error: errProv } = await supabase
    .from("proveedores")
    .insert({
      org_id: perfil.org_id,
      razon_social,
      tipo_identificacion,
      numero_identificacion,
      pais_origen: pais_origen || "PE",
      activo: true,
    })
    .select("id")
    .single();

  if (errProv) {
    if (errProv.code === "23505") {
      return json({ error: "Ya existe un proveedor con ese tipo y número de identificación" }, 409);
    }
    return json({ error: errProv.message }, 400);
  }

  const proveedorId = proveedor.id;

  if (contactos?.length > 0) {
    const contactosConId = contactos.map((c: any) => ({
      proveedor_id: proveedorId,
      nombre: c.nombre,
      telefono: c.telefono || null,
      correo: c.correo || null,
      direccion: c.direccion || null,
      ubigeo: c.ubigeo || null,
      principal: c.principal || false,
    }));

    const { error: errCont } = await supabase
      .from("contactos_proveedor")
      .insert(contactosConId);

    if (errCont) console.error("Error al insertar contactos:", errCont.message);
  }

  if (condiciones_comerciales?.length > 0) {
    const condicionesConId = condiciones_comerciales.map((c: any) => ({
      proveedor_id: proveedorId,
      moneda_id: c.moneda_id,
      plazo_pago: c.plazo_pago,
      lead_time_promedio: c.lead_time_promedio,
      observaciones: c.observaciones || null,
    }));

    const { error: errCond } = await supabase
      .from("condiciones_comerciales")
      .insert(condicionesConId);

    if (errCond) console.error("Error al insertar condiciones:", errCond.message);
  }

  return json({ exito: true, id: proveedorId });
}

async function actualizarProveedor(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { razon_social, tipo_identificacion, numero_identificacion, pais_origen, activo, contactos, condiciones_comerciales } = body;

  const { error: errProv } = await supabase
    .from("proveedores")
    .update({
      ...(razon_social !== undefined && { razon_social }),
      ...(tipo_identificacion !== undefined && { tipo_identificacion }),
      ...(numero_identificacion !== undefined && { numero_identificacion }),
      ...(pais_origen !== undefined && { pais_origen }),
      ...(activo !== undefined && { activo }),
    })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errProv) {
    if (errProv.code === "23505") {
      return json({ error: "Ya existe otro proveedor con ese tipo y número de identificación" }, 409);
    }
    return json({ error: errProv.message }, 400);
  }

  if (contactos !== undefined) {
    await supabase.from("contactos_proveedor").delete().eq("proveedor_id", id);

    if (contactos.length > 0) {
      const contactosConId = contactos.map((c: any) => ({
        proveedor_id: id,
        nombre: c.nombre,
        telefono: c.telefono || null,
        correo: c.correo || null,
        direccion: c.direccion || null,
        ubigeo: c.ubigeo || null,
        principal: c.principal || false,
      }));

      const { error: errCont } = await supabase
        .from("contactos_proveedor")
        .insert(contactosConId);

      if (errCont) console.error("Error al re-insertar contactos:", errCont.message);
    }
  }

  if (condiciones_comerciales !== undefined) {
    await supabase.from("condiciones_comerciales").delete().eq("proveedor_id", id);

    if (condiciones_comerciales.length > 0) {
      const condicionesConId = condiciones_comerciales.map((c: any) => ({
        proveedor_id: id,
        moneda_id: c.moneda_id,
        plazo_pago: c.plazo_pago,
        lead_time_promedio: c.lead_time_promedio,
        observaciones: c.observaciones || null,
      }));

      const { error: errCond } = await supabase
        .from("condiciones_comerciales")
        .insert(condicionesConId);

      if (errCond) console.error("Error al re-insertar condiciones:", errCond.message);
    }
  }

  return json({ exito: true });
}

async function toggleProveedor(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: actual, error: errGet } = await supabase
    .from("proveedores")
    .select("activo")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Proveedor no encontrado" }, 404);

  const nuevoEstado = !actual.activo;

  const { error: errUpd } = await supabase
    .from("proveedores")
    .update({ activo: nuevoEstado })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  return json({ exito: true, activo: nuevoEstado });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
