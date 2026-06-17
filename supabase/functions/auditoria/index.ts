import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  activo: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return json({ error: "Método no soportado" }, 405);
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

  if (!["super_admin", "admin_central", "operador_drogueria"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para ver la auditoría" }, 403);
  }

  return listarAuditoria(supabase, perfil, new URL(req.url));
});

async function listarAuditoria(supabase: any, perfil: PerfilUsuario, url: URL) {
  const accion = url.searchParams.get("accion") || null;
  const entidad = url.searchParams.get("entidad") || null;
  const nivel = url.searchParams.get("nivel") || null;
  const busqueda = url.searchParams.get("busqueda") || null;
  const pagina = parseInt(url.searchParams.get("pagina") || "1");
  const limite = parseInt(url.searchParams.get("limite") || "50");
  const offset = (pagina - 1) * limite;

  let query = supabase
    .from("auditoria")
    .select(`
      *,
      usuario:usuario_id(id, nombre, email)
    `, { count: "exact" })
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);

  if (accion) query = query.eq("accion", accion);
  if (entidad) query = query.eq("entidad", entidad);
  if (nivel) query = query.eq("nivel", nivel);
  if (busqueda) {
    query = query.or(
      `detalle.ilike.%${busqueda}%,accion.ilike.%${busqueda}%,entidad.ilike.%${busqueda}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) return json({ error: error.message }, 400);

  const totalPaginas = Math.ceil((count || 0) / limite);

  return json({
    datos: data,
    total: count || 0,
    pagina,
    limite,
    totalPaginas,
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
