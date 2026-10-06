import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Campos editables desde el frontend (todo lo demás se rechaza)
const CAMPOS_EDITABLES = [
  "nombre_comercial", "direccion_fiscal", "telefono_contacto",
  "email_contacto", "dominio_web",
  "alerta_vencimiento_dias", "umbral_sobrestock_dias",
  "horizonte_alerta_quiebre_dias",
];

// Campos que solo super_admin puede modificar
const CAMPOS_SUPER_ADMIN = [
  "dominio_correo_organizacion",
];

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  nombre: string;
  activo: boolean;
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
    .select("id, org_id, rol, nombre, activo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return json({ error: "Perfil de usuario no encontrado" }, 403);
  }

  if (!perfil.activo) {
    return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);
  }

  if (!["super_admin", "admin_central"].includes(perfil.rol)) {
    return json({ error: "Solo el admin central puede gestionar la configuración" }, 403);
  }

  try {
    switch (req.method) {
      case "GET":
        return obtenerConfiguracion(supabase, perfil);
      case "PATCH":
        return actualizarConfiguracion(supabase, perfil, await req.json());
      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en configuracion:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function obtenerConfiguracion(supabase: any, perfil: PerfilUsuario) {
  const { data, error } = await supabase
    .from("configuracion_organizacion")
    .select("*")
    .eq("org_id", perfil.org_id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return json({ error: "Configuración no encontrada para esta organización" }, 404);
    }
    return json({ error: error.message }, 400);
  }

  return json({ datos: data });
}

async function actualizarConfiguracion(supabase: any, perfil: PerfilUsuario, body: any) {
  if (!body || Object.keys(body).length === 0) {
    return json({ error: "No hay campos para actualizar" }, 400);
  }

  // Validar que solo se envíen campos editables
  const camposEnviados = Object.keys(body);
  const todosEditables = [...CAMPOS_EDITABLES, ...CAMPOS_SUPER_ADMIN];
  const camposNoEditables = camposEnviados.filter((c) => !todosEditables.includes(c));

  if (camposNoEditables.length > 0) {
    return json({
      error: `Los siguientes campos no pueden modificarse desde el frontend: ${camposNoEditables.join(", ")}`,
    }, 400);
  }

  // Validar que solo super_admin pueda editar campos restringidos
  const camposSuperAdmin = camposEnviados.filter((c) => CAMPOS_SUPER_ADMIN.includes(c));
  if (camposSuperAdmin.length > 0 && perfil.rol !== "super_admin") {
    return json({
      error: `Solo el super_admin puede modificar: ${camposSuperAdmin.join(", ")}`,
    }, 403);
  }

  // Leer configuración actual para auditoría
  const { data: actual, error: errGet } = await supabase
    .from("configuracion_organizacion")
    .select("*")
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) {
    return json({ error: "Configuración no encontrada" }, 404);
  }

  // Construir objeto de actualización (solo campos enviados)
  const updates: Record<string, unknown> = {};
  for (const campo of camposEnviados) {
    updates[campo] = body[campo];
  }
  updates.modified_at = new Date().toISOString();
  updates.modified_by = perfil.id;

  const { error: errUpd } = await supabase
    .from("configuracion_organizacion")
    .update(updates)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  // Generar detalle de cambios para auditoría
  const cambios: string[] = [];
  for (const campo of camposEnviados) {
    const valorViejo = JSON.stringify(actual[campo]);
    const valorNuevo = JSON.stringify(body[campo]);
    if (valorViejo !== valorNuevo) {
      cambios.push(`${campo}: ${valorViejo} → ${valorNuevo}`);
    }
  }

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "EDITAR_CONFIGURACION",
    entidad: "configuracion_organizacion",
    entidad_id: actual.id,
    nivel: "info",
    detalle: cambios.length > 0
      ? `Se actualizó la configuración: ${cambios.join(", ")}`
      : "Se actualizó la configuración (sin cambios detectados)",
    metadata_jsonb: { campos_actualizados: camposEnviados },
  });

  return json({ exito: true });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
