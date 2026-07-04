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
  const accion = segmentos[2] || null;

  try {
    switch (req.method) {
      case "GET":
        if (id) return obtenerProducto(supabase, perfil, id);
        return listarProductos(supabase, perfil, url);

      case "POST":
        return crearProducto(supabase, perfil, await req.json());

      case "PATCH":
        if (accion === "toggle" && id) return toggleProducto(supabase, perfil, id);
        if (accion === "stock-config" && id) return actualizarStockConfig(supabase, perfil, id, await req.json());
        if (id) return actualizarProducto(supabase, perfil, id, await req.json());
        return json({ error: "ID de producto requerido" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en productos:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarProductos(supabase: any, perfil: PerfilUsuario, url: URL) {
  const soloActivos = url.searchParams.get("activos") === "true";

  let query = supabase
    .from("productos")
    .select(`
      *,
      categorias_terapeuticas(id, codigo, nombre),
      formas_farmaceuticas!inner(nombre),
      producto_principio_activo(
        id, concentracion,
        principios_activos!inner(id, nombre, codigo_atc),
        unidades_medida!inner(id, nombre, simbolo)
      ),
      proveedor_producto(
        id, lead_time_dias, lead_time_especifico, precio_referencial, precio_compra_referencial,
        proveedores!inner(id, razon_social)
      )
    `)
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });

  if (soloActivos) {
    query = query.eq("estado", "activo");
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

async function obtenerProducto(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("productos")
    .select(`
      *,
      categorias_terapeuticas(id, codigo, nombre),
      formas_farmaceuticas(nombre),
      producto_principio_activo(
        id, concentracion,
        principios_activos(id, nombre, codigo_atc),
        unidades_medida(id, nombre, simbolo)
      ),
      proveedor_producto(
        id, lead_time_dias, lead_time_especifico, precio_referencial, precio_compra_referencial,
        proveedores(id, razon_social)
      )
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: "Producto no encontrado" }, 404);

  return json({ datos: data });
}

async function crearProducto(supabase: any, perfil: PerfilUsuario, body: any) {
  const { nombre_comercial, categoria_terapeutica_id, forma_farmaceutica_id, presentacion, clasificacion, estado, principios_activos } = body;

  if (!nombre_comercial || !categoria_terapeutica_id || !clasificacion) {
    return json({ error: "Faltan datos obligatorios (nombre_comercial, categoria_terapeutica_id, clasificacion)" }, 400);
  }

  const { data: categoria } = await supabase
    .from("categorias_terapeuticas")
    .select("id")
    .eq("id", categoria_terapeutica_id)
    .eq("org_id", perfil.org_id)
    .eq("activo", true)
    .maybeSingle();

  if (!categoria) {
    return json({ error: "La categoría terapéutica no existe o no está activa en tu organización" }, 400);
  }

  const { data: sku, error: errSku } = await supabase.rpc("generar_codigo_producto_para_org", {
    p_org_id: perfil.org_id,
  });

  if (errSku || !sku) {
    return json({ error: "Error al generar SKU: " + (errSku?.message || "respuesta vacía") }, 500);
  }

  const { data: producto, error: errProd } = await supabase
    .from("productos")
    .insert({
      org_id: perfil.org_id,
      codigo_interno: sku,
      nombre_comercial,
      categoria_terapeutica_id,
      forma_farmaceutica_id: forma_farmaceutica_id || null,
      presentacion: presentacion || null,
      clasificacion,
      estado: estado || "activo",
      modified_by: perfil.id,
    })
    .select("id")
    .single();

  if (errProd) {
    if (errProd.code === "23505") {
      return json({ error: "Ya existe un producto con ese código interno en tu organización" }, 409);
    }
    return json({ error: errProd.message }, 400);
  }

  if (principios_activos?.length > 0) {
    const paRows = principios_activos.map((pa: any) => ({
      producto_id: producto.id,
      principio_activo_id: pa.principio_activo_id,
      concentracion: pa.concentracion,
      unidad_medida_id: pa.unidad_medida_id || null,
    }));

    const { error: errPa } = await supabase
      .from("producto_principio_activo")
      .insert(paRows);

    if (errPa) console.error("Error al insertar principios activos:", errPa.message);
  }

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "CREAR_PRODUCTO",
    entidad: "productos",
    entidad_id: producto.id,
    nivel: "info",
    detalle: `Producto creado: ${nombre_comercial}`,
    metadata_jsonb: { valores_nuevos: { codigo_interno: sku, nombre_comercial, categoria_terapeutica_id, clasificacion } },
  });

  return json({
    exito: true,
    id: producto.id,
    codigo_interno: sku,
  });
}

async function actualizarProducto(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { nombre_comercial, categoria_terapeutica_id, forma_farmaceutica_id, presentacion, clasificacion, estado, principios_activos } = body;

  const { data: anterior } = await supabase
    .from("productos")
    .select("*")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .maybeSingle();

  if (categoria_terapeutica_id !== undefined) {
    const { data: categoria } = await supabase
      .from("categorias_terapeuticas")
      .select("id")
      .eq("id", categoria_terapeutica_id)
      .eq("org_id", perfil.org_id)
      .eq("activo", true)
      .maybeSingle();
    if (!categoria) return json({ error: "La categoría terapéutica no existe o no está activa en tu organización" }, 400);
  }

  const { error: errProd } = await supabase
    .from("productos")
    .update({
      ...(nombre_comercial !== undefined && { nombre_comercial }),
      ...(categoria_terapeutica_id !== undefined && { categoria_terapeutica_id }),
      ...(forma_farmaceutica_id !== undefined && { forma_farmaceutica_id }),
      ...(presentacion !== undefined && { presentacion }),
      ...(clasificacion !== undefined && { clasificacion }),
      ...(estado !== undefined && { estado }),
      modified_at: new Date().toISOString(),
      modified_by: perfil.id,
    })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errProd) {
    return json({ error: errProd.message }, 400);
  }

  if (principios_activos !== undefined) {
    await supabase.from("producto_principio_activo").delete().eq("producto_id", id);

    if (principios_activos.length > 0) {
      const paRows = principios_activos.map((pa: any) => ({
        producto_id: id,
        principio_activo_id: pa.principio_activo_id,
        concentracion: pa.concentracion,
        unidad_medida_id: pa.unidad_medida_id || null,
      }));

      const { error: errPa } = await supabase
        .from("producto_principio_activo")
        .insert(paRows);

      if (errPa) console.error("Error al re-insertar principios activos:", errPa.message);
    }
  }

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "EDITAR_PRODUCTO",
    entidad: "productos",
    entidad_id: id,
    nivel: "info",
    detalle: `Producto actualizado: ${nombre_comercial || anterior?.nombre_comercial || id}`,
    metadata_jsonb: { valores_anteriores: anterior, valores_nuevos: body },
  });

  return json({ exito: true });
}

async function toggleProducto(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: actual, error: errGet } = await supabase
    .from("productos")
    .select("estado")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !actual) return json({ error: "Producto no encontrado" }, 404);

  if (actual.estado === "descontinuado") {
    return json({ error: "No se puede cambiar el estado de un producto descontinuado. Use el formulario de edición." }, 400);
  }

  const nuevoEstado = actual.estado === "activo" ? "inactivo" : "activo";

  const { error: errUpd } = await supabase
    .from("productos")
    .update({ estado: nuevoEstado, modified_at: new Date().toISOString(), modified_by: perfil.id })
    .eq("id", id)
    .eq("org_id", perfil.org_id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  return json({ exito: true, estado: nuevoEstado });
}

async function actualizarStockConfig(supabase: any, perfil: PerfilUsuario, productoId: string, body: any) {
  if (perfil.rol !== "admin_central") {
    return json({ error: "Solo el admin central puede modificar la configuración de stock" }, 403);
  }

  const { ubicacion_tipo, ubicacion_id, stock_minimo, stock_maximo } = body;

  if (!ubicacion_tipo) {
    return json({ error: "ubicacion_tipo es requerido" }, 400);
  }

  if (stock_minimo !== undefined && (typeof stock_minimo !== "number" || stock_minimo < 0)) {
    return json({ error: "stock_minimo debe ser un número mayor o igual a 0" }, 400);
  }

  if (stock_maximo !== undefined && (typeof stock_maximo !== "number" || stock_maximo < 0)) {
    return json({ error: "stock_maximo debe ser un número mayor o igual a 0" }, 400);
  }

  let query = supabase
    .from("stock_ubicaciones")
    .select("id")
    .eq("producto_id", productoId)
    .eq("ubicacion_tipo", ubicacion_tipo)

  if (ubicacion_id != null) {
    query = query.eq("ubicacion_id", ubicacion_id)
  } else {
    query = query.is("ubicacion_id", null)
  }

  const { data: existente } = await query.maybeSingle()

  if (existente) {
    const updates: Record<string, unknown> = {};
    if (stock_minimo !== undefined) updates.stock_minimo = stock_minimo;
    if (stock_maximo !== undefined) updates.stock_maximo = stock_maximo;
    updates.updated_at = new Date().toISOString();

    const { data: anterior } = await supabase
      .from("stock_ubicaciones")
      .select("stock_minimo, stock_maximo")
      .eq("id", existente.id)
      .maybeSingle();

    const { error } = await supabase
      .from("stock_ubicaciones")
      .update(updates)
      .eq("id", existente.id);

    if (error) return json({ error: error.message }, 400);
    await supabase.from("auditoria").insert({
      org_id: perfil.org_id,
      usuario_id: perfil.id,
      accion: "CONFIGURAR_STOCK",
      entidad: "stock_ubicaciones",
      entidad_id: existente.id,
      nivel: "info",
      detalle: "Configuración de stock mínimo/máximo actualizada",
      metadata_jsonb: { producto_id: productoId, valores_anteriores: anterior, valores_nuevos: updates },
    });
    return json({ exito: true, id: existente.id });
  }

  if (stock_minimo === undefined || stock_maximo === undefined) {
    return json({ error: "No existe registro de stock para esta ubicación. Debe enviar stock_minimo y stock_maximo." }, 400);
  }

  const { data: nuevo, error } = await supabase
    .from("stock_ubicaciones")
    .insert({
      producto_id: productoId,
      ubicacion_tipo,
      ubicacion_id: ubicacion_id || null,
      cantidad_disponible: 0,
      stock_por_recibir: 0,
      stock_en_transito: 0,
      stock_minimo,
      stock_maximo,
      org_id: perfil.org_id,
    })
    .select("id")
    .single();

  if (error) return json({ error: error.message }, 400);
  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "CONFIGURAR_STOCK",
    entidad: "stock_ubicaciones",
    entidad_id: nuevo.id,
    nivel: "info",
    detalle: "Configuración de stock mínimo/máximo creada",
    metadata_jsonb: { producto_id: productoId, valores_nuevos: { ubicacion_tipo, ubicacion_id: ubicacion_id || null, stock_minimo, stock_maximo } },
  });
  return json({ exito: true, id: nuevo.id });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
