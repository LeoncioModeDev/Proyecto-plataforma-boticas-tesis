import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CAMPOS_EDITABLES = [
  "nombre",
  "pais_origen",
  "drogueria_nombre",
  "drogueria_direccion",
  "drogueria_telefono",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");

  if (!jwt) return json({ error: "Token requerido" }, 401);

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) return json({ error: "Token inválido" }, 401);

  const { data: perfil, error: perfilError } = await supabase
    .from("usuarios")
    .select("id, org_id, rol, activo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) return json({ error: "Perfil no encontrado" }, 403);
  if (!perfil.activo) return json({ error: "Usuario desactivado" }, 403);
  if (perfil.rol !== "super_admin") return json({ error: "Se requiere super_admin" }, 403);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    switch (req.method) {
      case "GET": {
        if (pathParts.length === 1) {
          return listarOrganizaciones(supabase);
        }
        const orgId = pathParts[1];
        return obtenerOrganizacion(supabase, orgId);
      }
      case "PATCH": {
        const orgId = pathParts[1];
        if (!orgId) return json({ error: "ID de organización requerido" }, 400);
        const body = await req.json();
        return actualizarOrganizacion(supabase, perfil, orgId, body);
      }
      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en organizaciones:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarOrganizaciones(supabase: any) {
  const { data: orgs, error: orgError } = await supabase
    .from("organizaciones")
    .select("*")
    .order("created_at", { ascending: false });

  if (orgError) return json({ error: orgError.message }, 400);

  if (!orgs || orgs.length === 0) return json({ datos: [] });

  const orgIds = orgs.map((o: any) => o.id);

  const [{ data: droguerias }, { data: configs }, { data: admins }] =
    await Promise.all([
      supabase
        .from("boticas")
        .select("id, org_id, nombre, codigo_interno")
        .eq("tipo", "drogueria")
        .in("org_id", orgIds),
      supabase
        .from("configuracion_organizacion")
        .select("org_id, dominio_correo_organizacion")
        .in("org_id", orgIds),
      supabase
        .from("usuarios")
        .select("id, org_id, nombre, email, activo")
        .eq("rol", "admin_central")
        .in("org_id", orgIds),
    ]);

  const drogueriaMap = new Map<string, any>();
  for (const d of droguerias || []) {
    if (!drogueriaMap.has(d.org_id)) drogueriaMap.set(d.org_id, d);
  }

  const configMap = new Map<string, string>();
  for (const c of configs || []) {
    configMap.set(c.org_id, c.dominio_correo_organizacion);
  }

  const adminMap = new Map<string, any>();
  for (const a of admins || []) {
    if (!adminMap.has(a.org_id)) adminMap.set(a.org_id, a);
  }

  const datos = orgs.map((org: any) => ({
    id: org.id,
    nombre: org.nombre,
    tipo_identificacion: org.tipo_identificacion,
    numero_identificacion: org.numero_identificacion,
    pais_origen: org.pais_origen,
    dominio_correo_organizacion: configMap.get(org.id) || null,
    drogueria_nombre: drogueriaMap.get(org.id)?.nombre || null,
    drogueria_codigo: drogueriaMap.get(org.id)?.codigo_interno || null,
    admin_nombre: adminMap.get(org.id)?.nombre || null,
    admin_email: adminMap.get(org.id)?.email || null,
    admin_activo: adminMap.get(org.id)?.activo ?? null,
    created_at: org.created_at,
  }));

  return json({ datos });
}

async function obtenerOrganizacion(supabase: any, id: string) {
  const { data: org, error: orgError } = await supabase
    .from("organizaciones")
    .select("*")
    .eq("id", id)
    .single();

  if (orgError) {
    if (orgError.code === "PGRST116") {
      return json({ error: "Organización no encontrada" }, 404);
    }
    return json({ error: orgError.message }, 400);
  }

  const { data: config } = await supabase
    .from("configuracion_organizacion")
    .select("dominio_correo_organizacion")
    .eq("org_id", org.id)
    .maybeSingle();

  const { data: drogueria } = await supabase
    .from("boticas")
    .select("*")
    .eq("org_id", org.id)
    .eq("tipo", "drogueria")
    .maybeSingle();

  const { data: admin } = await supabase
    .from("usuarios")
    .select("id, nombre, email, activo, ultimo_acceso")
    .eq("org_id", org.id)
    .eq("rol", "admin_central")
    .maybeSingle();

  return json({
    datos: {
      ...org,
      dominio_correo_organizacion: config?.dominio_correo_organizacion || null,
      drogueria: drogueria || null,
      admin: admin || null,
    },
  });
}

async function actualizarOrganizacion(
  supabase: any,
  perfil: { id: string },
  id: string,
  body: any,
) {
  if (!body || Object.keys(body).length === 0) {
    return json({ error: "No hay campos para actualizar" }, 400);
  }

  const camposEnviados = Object.keys(body);
  const camposNoEditables = camposEnviados.filter(
    (c) => !CAMPOS_EDITABLES.includes(c),
  );

  if (camposNoEditables.length > 0) {
    return json({
      error:
        `Campos no editables: ${camposNoEditables.join(", ")}`,
    }, 400);
  }

  // Leer organización actual para auditoría
  const { data: orgActual, error: errGet } = await supabase
    .from("organizaciones")
    .select("*, boticas!inner(id, nombre)") // get drogueria info via FK for audit
    .eq("id", id)
    .single();

  if (errGet || !orgActual) {
    return json({ error: "Organización no encontrada" }, 404);
  }

  const cambios: string[] = [];

  // Actualizar campos de organizaciones
  const orgUpdates: Record<string, unknown> = {};
  if (body.nombre !== undefined) {
    if (!body.nombre?.trim()) return json({ error: "El nombre no puede estar vacío" }, 400);
    orgUpdates.nombre = body.nombre.trim();
    if (orgActual.nombre !== orgUpdates.nombre) {
      cambios.push(`nombre: "${orgActual.nombre}" → "${orgUpdates.nombre}"`);
    }
  }
  if (body.pais_origen !== undefined) {
    if (!body.pais_origen?.trim() || body.pais_origen.length !== 2) {
      return json({ error: "País de origen inválido (código ISO de 2 caracteres)" }, 400);
    }
    orgUpdates.pais_origen = body.pais_origen.toUpperCase();
    if (orgActual.pais_origen !== orgUpdates.pais_origen) {
      cambios.push(`país: "${orgActual.pais_origen}" → "${orgUpdates.pais_origen}"`);
    }
  }

  if (Object.keys(orgUpdates).length > 0) {
    const { error: errUpd } = await supabase
      .from("organizaciones")
      .update(orgUpdates)
      .eq("id", id);

    if (errUpd) return json({ error: errUpd.message }, 400);
  }

  // Actualizar campos de droguería
  const drogueriaUpdates: Record<string, unknown> = {};
  if (body.drogueria_nombre !== undefined) {
    if (!body.drogueria_nombre?.trim()) return json({ error: "El nombre de la droguería no puede estar vacío" }, 400);
    drogueriaUpdates.nombre = body.drogueria_nombre.trim();
  }
  if (body.drogueria_direccion !== undefined) {
    drogueriaUpdates.direccion = body.drogueria_direccion?.trim() || null;
  }
  if (body.drogueria_telefono !== undefined) {
    drogueriaUpdates.telefono = body.drogueria_telefono?.trim() || null;
  }

  if (Object.keys(drogueriaUpdates).length > 0) {
    const { error: errDrog } = await supabase
      .from("boticas")
      .update(drogueriaUpdates)
      .eq("org_id", id)
      .eq("tipo", "drogueria");

    if (errDrog) return json({ error: errDrog.message }, 400);
  }

  // Auditoría
  if (cambios.length > 0) {
    await supabase.from("auditoria").insert({
      org_id: id,
      usuario_id: perfil.id,
      accion: "EDITAR_ORGANIZACION",
      entidad: "organizaciones",
      entidad_id: id,
      nivel: "info",
      detalle: cambios.join("; "),
      metadata_jsonb: { campos_actualizados: camposEnviados },
    });
  }

  return json({ exito: true, cambios });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
