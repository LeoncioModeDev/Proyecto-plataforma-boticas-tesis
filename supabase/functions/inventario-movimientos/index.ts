import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
}

serve(async (req) => {
  try {
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

    if (perfilError || !perfil) {
      return json({ error: "Perfil no encontrado" }, 403);
    }

    if (!perfil.activo) {
      return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);
    }

    const url = new URL(req.url);
    const segmentos = url.pathname.split("/").filter(Boolean);
    const accion = segmentos[1] || null;

    if (req.method === "GET") {
      return listarMovimientos(supabase, perfil, url);
    }

    if (req.method === "POST") {
      if (accion === "ajuste") {
        return registrarAjuste(supabase, perfil, await req.json());
      }
      if (accion === "merma") {
        return registrarMerma(supabase, perfil, await req.json());
      }
    }

    return json({ error: "Ruta no soportada" }, 405);
  } catch (e) {
    console.error("Error en inventario-movimientos:", e);
    const mensaje = e instanceof Error ? e.message : String(e);
    return json({ error: mensaje }, 500);
  }
});

// ─── LISTAR MOVIMIENTOS (ajustes y mermas) ────────────────────
async function listarMovimientos(supabase: any, perfil: PerfilUsuario, url: URL) {
  const tipo = url.searchParams.get("tipo");
  const productoId = url.searchParams.get("producto_id");
  const ubicacionId = url.searchParams.get("ubicacion_id");

  let query = supabase
    .from("movimientos_inventario")
    .select(`
      id,
      tipo_movimiento,
      direccion_ajuste,
      producto_id,
      lote_id,
      ubicacion_tipo,
      ubicacion_id,
      cantidad,
      motivo,
      usuario_id,
      created_at,
      productos:producto_id (nombre_comercial),
      boticas:ubicacion_id (nombre),
      lotes:lote_id (numero_lote, fecha_vencimiento)
    `)
    .in("tipo_movimiento", ["ajuste", "merma"])
    .order("created_at", { ascending: false });

  if (tipo) {
    query = query.eq("tipo_movimiento", tipo);
  }
  if (productoId) {
    query = query.eq("producto_id", productoId);
  }
  if (ubicacionId) {
    query = query.eq("ubicacion_id", ubicacionId);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);

  return json({ datos: data || [] });
}

// ─── REGISTRAR AJUSTE ──────────────────────────────────────────
async function registrarAjuste(supabase: any, perfil: PerfilUsuario, body: any) {
  const {
    producto_id,
    lote_id,
    ubicacion_tipo,
    ubicacion_id,
    direccion_ajuste,
    cantidad,
    motivo,
  } = body;

  // Validaciones
  if (!producto_id) return json({ error: "producto_id es requerido" }, 400);
  if (!lote_id) return json({ error: "lote_id es requerido" }, 400);
  if (!ubicacion_tipo) return json({ error: "ubicacion_tipo es requerido" }, 400);
  if (!ubicacion_id && ubicacion_tipo !== "drogueria") {
    return json({ error: "ubicacion_id es requerido para boticas" }, 400);
  }
  if (!direccion_ajuste || !["incremento", "decremento"].includes(direccion_ajuste)) {
    return json({ error: "direccion_ajuste debe ser 'incremento' o 'decremento'" }, 400);
  }
  if (!cantidad || cantidad < 1) {
    return json({ error: "cantidad debe ser mayor a 0" }, 400);
  }
  if (!motivo || motivo.length < 10) {
    return json({ error: "motivo debe tener al menos 10 caracteres" }, 400);
  }

  // Validar que el lote existe y pertenece al producto
  const { data: lote, error: errLote } = await supabase
    .from("lotes")
    .select("id, cantidad, producto_id")
    .eq("id", lote_id)
    .single();

  if (errLote || !lote) return json({ error: "Lote no encontrado" }, 404);
  if (lote.producto_id !== producto_id) {
    return json({ error: "El lote no corresponde al producto indicado" }, 400);
  }

  // Si es decremento, validar cantidad disponible
  if (direccion_ajuste === "decremento" && cantidad > lote.cantidad) {
    return json({
      error: `Cantidad de ajuste (${cantidad}) excede la disponible en el lote (${lote.cantidad})`,
    }, 400);
  }

  // Insertar movimiento
  const { data: movimiento, error: errMov } = await supabase
    .from("movimientos_inventario")
    .insert({
      producto_id,
      lote_id,
      ubicacion_tipo,
      ubicacion_id: ubicacion_tipo === "drogueria" ? null : ubicacion_id,
      tipo_movimiento: "ajuste",
      direccion_ajuste,
      cantidad,
      motivo,
      usuario_id: perfil.id,
    })
    .select(`
      id,
      tipo_movimiento,
      direccion_ajuste,
      producto_id,
      lote_id,
      ubicacion_tipo,
      ubicacion_id,
      cantidad,
      motivo,
      usuario_id,
      created_at,
      productos:producto_id (nombre_comercial),
      boticas:ubicacion_id (nombre)
    `)
    .single();

  if (errMov) return json({ error: errMov.message }, 400);

  return json({ datos: movimiento }, 201);
}

// ─── REGISTRAR MERMA ───────────────────────────────────────────
async function registrarMerma(supabase: any, perfil: PerfilUsuario, body: any) {
  const {
    producto_id,
    lote_id,
    ubicacion_tipo,
    ubicacion_id,
    cantidad,
    motivo,
  } = body;

  // Validaciones
  if (!producto_id) return json({ error: "producto_id es requerido" }, 400);
  if (!lote_id) return json({ error: "lote_id es requerido" }, 400);
  if (!ubicacion_tipo) return json({ error: "ubicacion_tipo es requerido" }, 400);
  if (!ubicacion_id && ubicacion_tipo !== "drogueria") {
    return json({ error: "ubicacion_id es requerido para boticas" }, 400);
  }
  if (!cantidad || cantidad < 1) {
    return json({ error: "cantidad debe ser mayor a 0" }, 400);
  }
  if (!motivo || motivo.length < 10) {
    return json({ error: "motivo debe tener al menos 10 caracteres" }, 400);
  }

  // Validar que el lote existe y pertenece al producto
  const { data: lote, error: errLote } = await supabase
    .from("lotes")
    .select("id, cantidad, producto_id")
    .eq("id", lote_id)
    .single();

  if (errLote || !lote) return json({ error: "Lote no encontrado" }, 404);
  if (lote.producto_id !== producto_id) {
    return json({ error: "El lote no corresponde al producto indicado" }, 400);
  }

  // Validar cantidad disponible en lote
  if (cantidad > lote.cantidad) {
    return json({
      error: `Cantidad de merma (${cantidad}) excede la disponible en el lote (${lote.cantidad})`,
    }, 400);
  }

  // Insertar movimiento
  const { data: movimiento, error: errMov } = await supabase
    .from("movimientos_inventario")
    .insert({
      producto_id,
      lote_id,
      ubicacion_tipo,
      ubicacion_id: ubicacion_tipo === "drogueria" ? null : ubicacion_id,
      tipo_movimiento: "merma",
      direccion_ajuste: null,
      cantidad,
      motivo,
      usuario_id: perfil.id,
    })
    .select(`
      id,
      tipo_movimiento,
      direccion_ajuste,
      producto_id,
      lote_id,
      ubicacion_tipo,
      ubicacion_id,
      cantidad,
      motivo,
      usuario_id,
      created_at,
      productos:producto_id (nombre_comercial),
      boticas:ubicacion_id (nombre)
    `)
    .single();

  if (errMov) return json({ error: errMov.message }, 400);

  return json({ datos: movimiento }, 201);
}

// ─── HELPERS ───────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
