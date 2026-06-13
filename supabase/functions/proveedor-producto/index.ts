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
    .select("id, org_id, rol")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return json({ error: "Perfil de usuario no encontrado" }, 403);
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

  if (!productoId) {
    return json({ error: "Se requiere producto_id como query param" }, 400);
  }

  const { data, error } = await supabase
    .from("proveedor_producto")
    .select(`
      *,
      proveedores!inner(id, razon_social, org_id, activo)
    `)
    .eq("producto_id", productoId)
    .order("created_at", { ascending: false });

  if (error) return json({ error: error.message }, 400);

  const datosFiltrados = data.filter((r: any) => r.proveedores?.org_id === perfil.org_id);
  return json({ datos: datosFiltrados });
}

async function guardarRelacion(supabase: any, perfil: PerfilUsuario, body: any) {
  const { proveedor_id, producto_id, lead_time_especifico, precio_compra } = body;

  if (!proveedor_id || !producto_id || lead_time_especifico === undefined || precio_compra === undefined) {
    return json({ error: "Faltan datos (proveedor_id, producto_id, lead_time_especifico, precio_compra)" }, 400);
  }

  const { data: existente } = await supabase
    .from("proveedor_producto")
    .select("id")
    .eq("proveedor_id", proveedor_id)
    .eq("producto_id", producto_id)
    .maybeSingle();

  if (existente) {
    const { error: errUpd } = await supabase
      .from("proveedor_producto")
      .update({
        lead_time_especifico,
        precio_compra,
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
      precio_compra,
    })
    .select("id")
    .single();

  if (errIns) return json({ error: errIns.message }, 400);
  return json({ exito: true, id: nuevo.id, actualizado: false });
}

async function eliminarRelacion(supabase: any, perfil: PerfilUsuario, id: string) {
  const { error } = await supabase
    .from("proveedor_producto")
    .delete()
    .eq("id", id);

  if (error) return json({ error: error.message }, 400);
  return json({ exito: true });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
