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

  if (!["super_admin", "admin_central"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para gestionar usuarios" }, 403);
  }

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  const id = segmentos[1] || null;
  const accion = segmentos[2] || null;

  try {
    switch (req.method) {
      case "GET":
        if (id) return obtenerUsuario(supabase, perfil, id);
        return listarUsuarios(supabase, perfil, url);

      case "POST":
        return crearUsuario(supabase, perfil, await req.json());

      case "PATCH":
        if (accion === "toggle" && id) return toggleUsuario(supabase, perfil, id);
        if (id) return actualizarUsuario(supabase, perfil, id, await req.json());
        return json({ error: "ID de usuario requerido" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en usuarios:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarUsuarios(supabase: any, perfil: PerfilUsuario, url: URL) {
  const soloActivos = url.searchParams.get("activos") === "true";
  const rol = url.searchParams.get("rol") || null;

  let query = supabase
    .from("usuarios")
    .select(`
      *,
      botica:boticas!botica_id(id, nombre, codigo_interno),
      drogueria:drogueria_id(id, nombre, codigo_interno)
    `)
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });

  if (soloActivos) {
    query = query.eq("activo", true);
  }
  if (rol) {
    query = query.eq("rol", rol);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

async function obtenerUsuario(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("usuarios")
    .select(`
      *,
      botica:boticas!botica_id(id, nombre, codigo_interno),
      drogueria:drogueria_id(id, nombre, codigo_interno)
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: "Usuario no encontrado" }, 404);
  return json({ datos: data });
}

async function crearUsuario(supabase: any, perfil: PerfilUsuario, body: any) {
  const { nombre, nombre_cuenta, rol, botica_id, telefono, contrasena } = body;

  if (!nombre || !nombre_cuenta || !rol) {
    return json({ error: "Faltan datos obligatorios (nombre, nombre_cuenta, rol)" }, 400);
  }

  if (!contrasena || contrasena.length < 6) {
    return json({ error: "La contraseña debe tener al menos 6 caracteres" }, 400);
  }

  if (!["admin_central", "operador_drogueria", "visor_botica"].includes(rol)) {
    return json({ error: "Rol inválido" }, 400);
  }

  // Validar nombre_cuenta
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(nombre_cuenta)) {
    return json({ error: "El nombre de cuenta solo puede contener letras, números, puntos, guiones y guiones bajos. Debe empezar y terminar con letra o número." }, 400);
  }

  if (nombre_cuenta.length < 3 || nombre_cuenta.length > 64) {
    return json({ error: "El nombre de cuenta debe tener entre 3 y 64 caracteres" }, 400);
  }

  // Obtener dominio institucional
  const { data: config } = await supabase
    .from("configuracion_organizacion")
    .select("dominio_correo_organizacion")
    .eq("org_id", perfil.org_id)
    .single();

  const dominio = config?.dominio_correo_organizacion;

  if (!dominio) {
    return json({ error: "Tu organización no tiene un dominio institucional configurado. Contacta al super_admin." }, 400);
  }

  // Construir email
  const email = `${nombre_cuenta}@${dominio}`;

  // Validar dominio del email
  const { data: dominioValido } = await supabase.rpc("validar_dominio_correo", {
    p_email: email,
    p_org_id: perfil.org_id,
  });

  if (!dominioValido) {
    return json({ error: "El dominio del correo generado no está permitido para tu organización" }, 400);
  }

  // Verificar unicidad global del email
  const { data: existingEmail } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingEmail) {
    return json({ error: `Ya existe un usuario con el correo ${email}` }, 409);
  }

  // --- Resolver drogueria_id para roles centrales ---
  let drogueria_id: string | null = null;

  if (rol === "admin_central" || rol === "operador_drogueria") {
    const { data: drogueria } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "drogueria")
      .maybeSingle();

    if (!drogueria) {
      return json({
        error: "No existe una droguería central en tu organización. Créala primero.",
      }, 400);
    }
    drogueria_id = drogueria.id;
  }

  // --- admin_central: único por org ---
  if (rol === "admin_central") {
    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("org_id", perfil.org_id)
      .eq("rol", "admin_central")
      .maybeSingle();

    if (existing) {
      return json({ error: "Ya existe un admin_central en tu organización. Solo puede haber uno." }, 400);
    }
  }

  // --- visor_botica: botica obligatoria, no puede ser droguería ---
  if (rol === "visor_botica") {
    if (!botica_id) {
      return json({ error: "El rol visor_botica requiere una botica asignada" }, 400);
    }

    const { data: botica } = await supabase
      .from("boticas")
      .select("id, tipo, org_id")
      .eq("id", botica_id)
      .single();

    if (!botica || botica.org_id !== perfil.org_id) {
      return json({ error: "La botica asignada debe pertenecer a tu organización" }, 400);
    }
    if (botica.tipo === "drogueria") {
      return json({ error: "El visor_botica no puede estar asociado a la droguería central" }, 400);
    }
  }

  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password: contrasena,
    email_confirm: true,
    user_metadata: {
      org_id: perfil.org_id,
      nombre,
      rol,
      botica_id: rol === "visor_botica" ? (botica_id || null) : null,
      drogueria_id,
      telefono: telefono || null,
    },
  });

  if (userError) {
    if (userError.message?.includes("already")) {
      return json({ error: `Ya existe un usuario con el correo ${email}` }, 409);
    }
    return json({ error: userError.message }, 400);
  }

  const { error: upsertError } = await supabase.from("usuarios").upsert(
    {
      id: userData.user.id,
      org_id: perfil.org_id,
      email,
      nombre,
      rol,
      botica_id: rol === "visor_botica" ? (botica_id || null) : null,
      drogueria_id,
      telefono: telefono || null,
      activo: true,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    console.error("Error al sincronizar perfil:", upsertError.message);
  }

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "CREAR_USUARIO",
    entidad: "usuarios",
    entidad_id: userData.user.id,
    nivel: "info",
    detalle: `Se creó el usuario "${nombre}" (${email}) con rol ${rol}.`,
  });

  return json({
    exito: true,
    id: userData.user.id,
    email,
    nombre,
  });
}

async function actualizarUsuario(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { nombre, rol, botica_id, telefono } = body;

  const { data: actual, error: errGet } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, org_id")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Usuario no encontrado" }, 404);

  if (actual.rol === "super_admin") {
    return json({ error: "No puedes modificar un super_admin" }, 403);
  }

  const resolvedRol = rol !== undefined ? rol : actual.rol;

  if (rol !== undefined) {
    if (!["admin_central", "operador_drogueria", "visor_botica"].includes(rol)) {
      return json({ error: "Rol inválido" }, 400);
    }

    if (rol === "admin_central" && actual.rol !== "admin_central") {
      const { data: existing } = await supabase
        .from("usuarios")
        .select("id")
        .eq("org_id", perfil.org_id)
        .eq("rol", "admin_central")
        .neq("id", id)
        .maybeSingle();

      if (existing) {
        return json({ error: "Ya existe un admin_central en tu organización. Solo puede haber uno." }, 400);
      }
    }
  }

  // --- Resolver drogueria_id y botica_id según el rol ---
  let resolvedBoticaId: string | null = null;
  let resolvedDrogueriaId: string | null = null;

  if (resolvedRol === "admin_central" || resolvedRol === "operador_drogueria") {
    if (actual.drogueria_id) {
      resolvedDrogueriaId = actual.drogueria_id;
    } else {
      const { data: drogueria } = await supabase
        .from("boticas")
        .select("id")
        .eq("org_id", perfil.org_id)
        .eq("tipo", "drogueria")
        .maybeSingle();

      if (!drogueria) {
        return json({ error: "No existe una droguería central en tu organización" }, 400);
      }
      resolvedDrogueriaId = drogueria.id;
    }
    resolvedBoticaId = null;
  }

  if (resolvedRol === "visor_botica") {
    const incomingBoticaId = botica_id !== undefined ? botica_id : actual.botica_id;
    if (!incomingBoticaId) {
      return json({ error: "El rol visor_botica requiere una botica asignada" }, 400);
    }

    const { data: botica } = await supabase
      .from("boticas")
      .select("id, tipo, org_id")
      .eq("id", incomingBoticaId)
      .single();

    if (!botica || botica.org_id !== perfil.org_id) {
      return json({ error: "La botica asignada debe pertenecer a tu organización" }, 400);
    }
    if (botica.tipo === "drogueria") {
      return json({ error: "El visor_botica no puede estar asociado a la droguería central" }, 400);
    }

    resolvedBoticaId = incomingBoticaId;
    resolvedDrogueriaId = null;
  }

  const updates: Record<string, unknown> = {};
  if (nombre !== undefined) updates.nombre = nombre;
  if (rol !== undefined) updates.rol = rol;
  if (botica_id !== undefined || resolvedRol !== actual.rol) {
    updates.botica_id = resolvedBoticaId;
    updates.drogueria_id = resolvedDrogueriaId;
  }
  if (telefono !== undefined) updates.telefono = telefono;

  const { error: errUpd } = await supabase
    .from("usuarios")
    .update(updates)
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  const cambios: string[] = [];
  if (nombre !== undefined && nombre !== actual.nombre) cambios.push(`nombre: "${actual.nombre}" → "${nombre}"`);
  if (rol !== undefined && rol !== actual.rol) cambios.push(`rol: ${actual.rol} → ${rol}`);

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "EDITAR_USUARIO",
    entidad: "usuarios",
    entidad_id: id,
    nivel: "info",
    detalle: cambios.length > 0
      ? `Se actualizó el usuario "${actual.nombre}": ${cambios.join(", ")}`
      : `Se actualizó el usuario "${actual.nombre}"`,
  });

  return json({ exito: true });
}

async function toggleUsuario(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: actual, error: errGet } = await supabase
    .from("usuarios")
    .select("id, nombre, activo, org_id, rol")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Usuario no encontrado" }, 404);

  if (actual.rol === "super_admin") {
    return json({ error: "No puedes desactivar un super_admin" }, 403);
  }

  const nuevoEstado = !actual.activo;

  const { error: errUpd } = await supabase
    .from("usuarios")
    .update({ activo: nuevoEstado })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  // Sync activo flag to Auth user metadata so frontend can check on login
  await supabase.auth.admin.updateUserById(id, {
    user_metadata: { activo: nuevoEstado },
  });

  const accion = nuevoEstado ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO";
  const detalle = nuevoEstado
    ? `Se activó el usuario "${actual.nombre}"`
    : `Se desactivó el usuario "${actual.nombre}"`;

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion,
    entidad: "usuarios",
    entidad_id: id,
    nivel: nuevoEstado ? "info" : "advertencia",
    detalle,
  });

  return json({ exito: true, activo: nuevoEstado });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
