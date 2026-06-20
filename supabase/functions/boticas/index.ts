import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  email: string;
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
    .select("id, org_id, rol, email, nombre, activo")
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
  const accion = segmentos[2] || null;

  try {
    switch (req.method) {
      case "GET":
        if (id) return obtenerBotica(supabase, perfil, id);
        return listarBoticas(supabase, perfil, url);

      case "POST":
        return crearBotica(supabase, perfil, await req.json());

      case "PATCH":
        if (accion === "toggle" && id) return toggleBotica(supabase, perfil, id);
        if (id) return actualizarBotica(supabase, perfil, id, await req.json());
        return json({ error: "ID de botica requerido" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en boticas:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarBoticas(supabase: any, perfil: PerfilUsuario, url: URL) {
  const soloActivas = url.searchParams.get("activas") === "true";
  const tipo = url.searchParams.get("tipo") || null;

  let query = supabase
    .from("boticas")
    .select(`
      *,
      encargado:encargado_usuario_id(id, nombre, email)
    `)
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });

  if (soloActivas) {
    query = query.eq("activa", true);
  }
  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);

  const datos = await Promise.all(
    (data || []).map((b) => resolverEncargadoVisible(supabase, perfil, b)),
  );

  return json({ datos });
}

async function resolverEncargadoVisible(
  supabase: any,
  perfil: PerfilUsuario,
  botica: any,
) {
  if (botica.encargado) {
    return { ...botica, encargado_visible: botica.encargado, encargado_es_fallback: false };
  }

  const { data: adminCentral } = await supabase
    .from("usuarios")
    .select("id, nombre, email")
    .eq("org_id", perfil.org_id)
    .eq("rol", "admin_central")
    .eq("activo", true)
    .maybeSingle();

  return {
    ...botica,
    encargado_visible: adminCentral || null,
    encargado_es_fallback: true,
  };
}

async function obtenerBotica(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("boticas")
    .select(`
      *,
      encargado:encargado_usuario_id(id, nombre, email)
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: "Botica no encontrada" }, 404);

  const datos = await resolverEncargadoVisible(supabase, perfil, data);

  return json({ datos });
}

async function crearBotica(supabase: any, perfil: PerfilUsuario, body: any) {
  const { nombre, tipo, ubigeo, direccion, telefono, activa } = body;

  if (!nombre || !tipo) {
    return json({ error: "Faltan datos obligatorios (nombre, tipo)" }, 400);
  }

  if (!["drogueria", "botica"].includes(tipo)) {
    return json({ error: "Tipo inválido. Debe ser drogueria o botica" }, 400);
  }

  if (tipo === "drogueria") {
    const { data: existing } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "drogueria")
      .maybeSingle();

    if (existing) {
      return json({ error: "Ya existe una droguería en tu organización. Solo puede haber una." }, 400);
    }
  }

  const MAX_INTENTOS = 3;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    // Calcular siguiente código correlativo
    const { data: maxData } = await supabase
      .from("boticas")
      .select("codigo_interno")
      .eq("org_id", perfil.org_id)
      .not("codigo_interno", "is", null)
      .order("codigo_interno", { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextNum = 1;
    if (maxData?.codigo_interno) {
      const match = maxData.codigo_interno.match(/BOT-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const codigoInterno = `BOT-${String(nextNum).padStart(6, "0")}`;

    const { data: botica, error: errBot } = await supabase
      .from("boticas")
      .insert({
        org_id: perfil.org_id,
        codigo_interno: codigoInterno,
        nombre,
        tipo,
        ubigeo: ubigeo || null,
        direccion: direccion || null,
        telefono: telefono || null,
        encargado_usuario_id: null,
        activa: activa !== undefined ? activa : true,
      })
      .select("id, nombre, codigo_interno")
      .single();

    if (!errBot) {
      await supabase.from("auditoria").insert({
        org_id: perfil.org_id,
        usuario_id: perfil.id,
        accion: "CREAR_BOTICA",
        entidad: "boticas",
        entidad_id: botica.id,
        nivel: "info",
        detalle: `Se creó la botica "${nombre}" (${codigoInterno})`,
      });

      return json({ exito: true, id: botica.id, codigo_interno: botica.codigo_interno });
    }

    // Si es violación de unique constraint, reintentar con nuevo código
    if (errBot.message?.includes("idx_boticas_codigo_org") || errBot.message?.includes("unique constraint")) {
      if (intento < MAX_INTENTOS) continue;
      return json({
        error: "No se pudo generar un código único para la botica. Intenta nuevamente.",
      }, 409);
    }

    return json({ error: errBot.message }, 400);
  }
}

async function actualizarBotica(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { nombre, tipo, ubigeo, direccion, telefono, encargado_usuario_id, activa } = body;

  const { data: actual, error: errGet } = await supabase
    .from("boticas")
    .select("id, nombre, org_id")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Botica no encontrada" }, 404);

  if (tipo !== undefined && tipo === "drogueria") {
    const { data: existing } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "drogueria")
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return json({ error: "Ya existe una droguería en tu organización. Solo puede haber una." }, 400);
    }
  }

  if (encargado_usuario_id !== undefined) {
    if (encargado_usuario_id) {
      const { data: encargado } = await supabase
        .from("usuarios")
        .select("id, org_id, rol")
        .eq("id", encargado_usuario_id)
        .single();

      if (!encargado || encargado.org_id !== perfil.org_id) {
        return json({ error: "El encargado debe pertenecer a tu organización" }, 400);
      }
      if (!["admin_central", "operador_drogueria"].includes(encargado.rol)) {
        return json({ error: "El encargado debe tener rol admin_central u operador_drogueria" }, 400);
      }
    }
  }

  const { error: errUpd } = await supabase
    .from("boticas")
    .update({
      ...(nombre !== undefined && { nombre }),
      ...(tipo !== undefined && { tipo }),
      ...(ubigeo !== undefined && { ubigeo }),
      ...(direccion !== undefined && { direccion }),
      ...(telefono !== undefined && { telefono }),
      ...(encargado_usuario_id !== undefined && { encargado_usuario_id }),
      ...(activa !== undefined && { activa }),
    })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  const cambios: string[] = [];
  if (nombre !== undefined && nombre !== actual.nombre) cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "EDITAR_BOTICA",
    entidad: "boticas",
    entidad_id: id,
    nivel: "info",
    detalle: cambios.length > 0
      ? `Se actualizó la botica "${actual.nombre}": ${cambios.join(", ")}`
      : `Se actualizó la botica "${actual.nombre}"`,
  });

  return json({ exito: true });
}

async function toggleBotica(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: actual, error: errGet } = await supabase
    .from("boticas")
    .select("id, nombre, activa, org_id")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Botica no encontrada" }, 404);

  const nuevoEstado = !actual.activa;

  const { error: errUpd } = await supabase
    .from("boticas")
    .update({ activa: nuevoEstado })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  const accion = nuevoEstado ? "ACTIVAR_BOTICA" : "DESACTIVAR_BOTICA";
  const detalle = nuevoEstado
    ? `Se activó la botica "${actual.nombre}"`
    : `Se desactivó la botica "${actual.nombre}"`;

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion,
    entidad: "boticas",
    entidad_id: id,
    nivel: nuevoEstado ? "info" : "advertencia",
    detalle,
  });

  return json({ exito: true, activa: nuevoEstado });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
