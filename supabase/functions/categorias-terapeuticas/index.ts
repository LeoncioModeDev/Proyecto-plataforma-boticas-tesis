import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  activo: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

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

  if (perfilError || !perfil) return json({ error: "Perfil de usuario no encontrado" }, 403);
  if (!perfil.activo) return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  const id = segmentos[1] || null;
  const accion = segmentos[2] || null;

  try {
    switch (req.method) {
      case "GET":
        if (id) return obtenerCategoria(supabase, perfil, id);
        return listarCategorias(supabase, perfil, url);
      case "POST":
        return crearCategoria(supabase, perfil, await req.json());
      case "PATCH":
        if (!id) return json({ error: "ID de categoría requerido" }, 400);
        if (accion === "toggle") return cambiarEstadoCategoria(supabase, perfil, id, await req.json().catch(() => ({})));
        return actualizarCategoria(supabase, perfil, id, await req.json());
      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en categorias-terapeuticas:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

function puedeAdministrar(perfil: PerfilUsuario) {
  return ["super_admin", "admin_central"].includes(perfil.rol);
}

function puedeLeer(perfil: PerfilUsuario) {
  return ["super_admin", "admin_central", "operador_drogueria", "visor_botica"].includes(perfil.rol);
}

function normalizarCodigo(codigo: unknown) {
  return String(codigo || "").trim().toUpperCase();
}

function normalizarNombre(nombre: unknown) {
  return String(nombre || "").trim();
}

async function listarCategorias(supabase: any, perfil: PerfilUsuario, url: URL) {
  if (!puedeLeer(perfil)) return json({ error: "No tienes permisos para listar categorías" }, 403);
  const busqueda = url.searchParams.get("q")?.trim() || null;
  const activo = url.searchParams.get("activo");

  let query = supabase
    .from("categorias_terapeuticas")
    .select("id, org_id, codigo, nombre, descripcion, activo, created_at, modified_at, productos:productos(count)")
    .eq("org_id", perfil.org_id)
    .order("codigo", { ascending: true });

  if (activo === "true") query = query.eq("activo", true);
  if (activo === "false") query = query.eq("activo", false);
  if (busqueda) query = query.or(`codigo.ilike.%${busqueda}%,nombre.ilike.%${busqueda}%`);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data || [] });
}

async function obtenerCategoria(supabase: any, perfil: PerfilUsuario, id: string) {
  if (!puedeLeer(perfil)) return json({ error: "No tienes permisos para ver categorías" }, 403);
  const { data, error } = await supabase
    .from("categorias_terapeuticas")
    .select("id, org_id, codigo, nombre, descripcion, activo, created_at, modified_at, productos:productos(count)")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error || !data) return json({ error: "Categoría no encontrada" }, 404);
  return json({ datos: data });
}

async function crearCategoria(supabase: any, perfil: PerfilUsuario, body: any) {
  if (!puedeAdministrar(perfil)) return json({ error: "Solo el admin central puede crear categorías" }, 403);
  const codigo = normalizarCodigo(body.codigo);
  const nombre = normalizarNombre(body.nombre);
  if (!codigo) return json({ error: "codigo es obligatorio" }, 400);
  if (!nombre) return json({ error: "nombre es obligatorio" }, 400);

  const { data, error } = await supabase
    .from("categorias_terapeuticas")
    .insert({
      org_id: perfil.org_id,
      codigo,
      nombre,
      descripcion: body.descripcion ? String(body.descripcion).trim() : null,
      activo: body.activo !== false,
      modified_by: perfil.id,
    })
    .select("id, codigo, nombre, descripcion, activo")
    .single();

  if (error) return json({ error: traducirErrorUnico(error.message) }, error.code === "23505" ? 409 : 400);
  await auditar(supabase, perfil, "CREAR_CATEGORIA_TERAPEUTICA", data.id, `Categoría creada: ${codigo} - ${nombre}`, data);
  return json({ exito: true, datos: data }, 201);
}

async function actualizarCategoria(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  if (!puedeAdministrar(perfil)) return json({ error: "Solo el admin central puede editar categorías" }, 403);
  const updates: Record<string, unknown> = { modified_by: perfil.id };
  if (body.codigo !== undefined) {
    const codigo = normalizarCodigo(body.codigo);
    if (!codigo) return json({ error: "codigo no puede estar vacío" }, 400);
    updates.codigo = codigo;
  }
  if (body.nombre !== undefined) {
    const nombre = normalizarNombre(body.nombre);
    if (!nombre) return json({ error: "nombre no puede estar vacío" }, 400);
    updates.nombre = nombre;
  }
  if (body.descripcion !== undefined) updates.descripcion = body.descripcion ? String(body.descripcion).trim() : null;

  const { data, error } = await supabase
    .from("categorias_terapeuticas")
    .update(updates)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .select("id, codigo, nombre, descripcion, activo")
    .single();

  if (error) return json({ error: traducirErrorUnico(error.message) }, error.code === "23505" ? 409 : 400);
  await auditar(supabase, perfil, "EDITAR_CATEGORIA_TERAPEUTICA", id, `Categoría editada: ${data.codigo} - ${data.nombre}`, data);
  return json({ exito: true, datos: data });
}

async function cambiarEstadoCategoria(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  if (!puedeAdministrar(perfil)) return json({ error: "Solo el admin central puede cambiar el estado" }, 403);
  const confirmar = body?.confirmar === true;
  const { data: categoria, error: errCat } = await supabase
    .from("categorias_terapeuticas")
    .select("id, codigo, nombre, activo")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();
  if (errCat || !categoria) return json({ error: "Categoría no encontrada" }, 404);

  const nuevoActivo = !categoria.activo;
  if (!nuevoActivo) {
    const { count, error: errCount } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("org_id", perfil.org_id)
      .eq("categoria_terapeutica_id", id)
      .eq("estado", "activo");
    if (errCount) return json({ error: errCount.message }, 400);
    if ((count || 0) > 0 && !confirmar) {
      return json({
        error: "La categoría tiene productos activos asociados. Confirme explícitamente para desactivarla.",
        requiere_confirmacion: true,
        productos_activos: count || 0,
      }, 409);
    }
  }

  const { data, error } = await supabase
    .from("categorias_terapeuticas")
    .update({ activo: nuevoActivo, modified_by: perfil.id })
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .select("id, codigo, nombre, activo")
    .single();
  if (error) return json({ error: error.message }, 400);
  await auditar(supabase, perfil, "CAMBIAR_ESTADO_CATEGORIA_TERAPEUTICA", id, `Categoría ${nuevoActivo ? "activada" : "desactivada"}: ${data.codigo}`, data);
  return json({ exito: true, datos: data });
}

function traducirErrorUnico(mensaje: string) {
  if (mensaje.includes("idx_categorias_terapeuticas_org_codigo")) return "Ya existe una categoría con ese código en tu organización";
  if (mensaje.includes("idx_categorias_terapeuticas_org_nombre_lower")) return "Ya existe una categoría con ese nombre en tu organización";
  return mensaje;
}

async function auditar(supabase: any, perfil: PerfilUsuario, accion: string, entidadId: string, detalle: string, metadata: unknown) {
  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion,
    entidad: "categorias_terapeuticas",
    entidad_id: entidadId,
    nivel: "info",
    detalle,
    metadata_jsonb: metadata,
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
