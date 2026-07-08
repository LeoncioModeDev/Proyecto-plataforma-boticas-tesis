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

const COLUMNAS_STOCK =
  "org_id,ubicacion_id,producto_id,fecha_snapshot_dia,cantidad_disponible,stock_minimo,stock_maximo,stockout_flag,demanda_insatisfecha";

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  botica_id?: string | null;
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
    .select("id, org_id, rol, botica_id, activo")
    .eq("id", user.id)
    .single();

  if (perfilError || !perfil) {
    return json({ error: "Perfil de usuario no encontrado" }, 403);
  }

  if (!perfil.activo) {
    return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);
  }

  try {
    return await listarStockHistorico(supabase, perfil, new URL(req.url));
  } catch (e) {
    console.error("Error en stock-historico:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarStockHistorico(supabase: any, perfil: PerfilUsuario, url: URL) {
  const params = url.searchParams;
  const pagina = Math.max(Number(params.get("pagina") || 1), 1);
  const limite = Math.max(Number(params.get("limite") || 20), 1);
  const busqueda = (params.get("busqueda") || "").replaceAll(",", " ").trim();
  const boticaId = params.get("boticaId") || "";
  const productoId = params.get("productoId") || "";
  const categoria = params.get("categoria") || "";
  const stockout = params.get("stockout") || "";
  const fechaDesde = params.get("fechaDesde") || "";
  const fechaHasta = params.get("fechaHasta") || "";
  const ordenCampo = normalizarOrden(params.get("ordenCampo") || "fecha_snapshot");
  const ascendente = params.get("ascendente") === "true";

  const productosFiltro = await resolverProductosFiltro(supabase, perfil.org_id, {
    busqueda,
    productoId,
    categoria,
  });

  if (productosFiltro.aplicado && productosFiltro.ids.length === 0) {
    return json({ datos: [], total: 0, resumen: calcularResumen([], 0) });
  }

  let query = supabase
    .from("stock_historico")
    .select(COLUMNAS_STOCK, { count: "exact", head: false })
    .eq("org_id", perfil.org_id);

  if (perfil.rol === "visor_botica") {
    if (!perfil.botica_id) return json({ datos: [], total: 0, resumen: calcularResumen([], 0) });
    query = query.eq("ubicacion_id", perfil.botica_id);
  }

  if (boticaId) query = query.eq("ubicacion_id", boticaId);
  if (productosFiltro.aplicado) query = query.in("producto_id", productosFiltro.ids);
  if (stockout !== "") query = query.eq("stockout_flag", stockout === "true" ? 1 : 0);
  if (fechaDesde) query = query.gte("fecha_snapshot_dia", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_snapshot_dia", fechaHasta);

  const desde = (pagina - 1) * limite;
  query = query
    .order(ordenCampo, { ascending: ascendente })
    .order("producto_id", { ascending: true })
    .range(desde, desde + limite - 1);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 400);

  const filas = data || [];
  const [productos, boticas] = await Promise.all([
    cargarProductos(supabase, perfil.org_id, filas.map((item: any) => item.producto_id)),
    cargarBoticas(supabase, perfil.org_id, filas.map((item: any) => item.ubicacion_id).filter(Boolean)),
  ]);

  const datos = filas.map((item: any) => {
    const producto = productos.get(item.producto_id);
    const botica = item.ubicacion_id ? boticas.get(item.ubicacion_id) : null;
    return {
      org_id: item.org_id,
      botica_id: item.ubicacion_id,
      producto_id: item.producto_id,
      codigo_botica: botica?.codigo_interno || null,
      botica: botica?.nombre || "Drogueria central",
      codigo_producto: producto?.codigo_interno || null,
      producto: producto?.nombre_comercial || item.producto_id,
      categoria_terapeutica: nombreCategoria(producto),
      fecha_snapshot: item.fecha_snapshot_dia,
      cantidad_disponible: item.cantidad_disponible,
      stock_minimo: item.stock_minimo,
      stock_maximo: item.stock_maximo,
      stockout_flag: item.stockout_flag,
      demanda_insatisfecha: item.demanda_insatisfecha,
    };
  });

  return json({ datos, total: count || 0, resumen: calcularResumen(datos, count || 0) });
}

async function resolverProductosFiltro(supabase: any, orgId: string, filtros: { busqueda: string; productoId: string; categoria: string }) {
  if (filtros.productoId) return { aplicado: true, ids: [filtros.productoId] };
  if (!filtros.busqueda && !filtros.categoria) return { aplicado: false, ids: [] };

  let query = supabase
    .from("productos")
    .select("id,codigo_interno,nombre_comercial,categoria_terapeutica,clasificacion,categorias_terapeuticas(nombre)")
    .eq("org_id", orgId);

  if (filtros.busqueda) {
    query = query.or(`codigo_interno.ilike.%${filtros.busqueda}%,nombre_comercial.ilike.%${filtros.busqueda}%`);
  }

  const { data, error } = await query.limit(1000);
  if (error) throw error;

  const productos = (data || []).filter((producto: any) => {
    if (!filtros.categoria) return true;
    return nombreCategoria(producto) === filtros.categoria;
  });

  return { aplicado: true, ids: productos.map((producto: any) => producto.id) };
}

async function cargarProductos(supabase: any, orgId: string, ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = new Map<string, any>();
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase
    .from("productos")
    .select("id,codigo_interno,nombre_comercial,categoria_terapeutica,clasificacion,categorias_terapeuticas(nombre)")
    .eq("org_id", orgId)
    .in("id", unicos);
  if (error) throw error;

  (data || []).forEach((producto: any) => mapa.set(producto.id, producto));
  return mapa;
}

async function cargarBoticas(supabase: any, orgId: string, ids: string[]) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const mapa = new Map<string, any>();
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase
    .from("boticas")
    .select("id,codigo_interno,nombre")
    .eq("org_id", orgId)
    .in("id", unicos);
  if (error) throw error;

  (data || []).forEach((botica: any) => mapa.set(botica.id, botica));
  return mapa;
}

function nombreCategoria(producto: any) {
  return producto?.categorias_terapeuticas?.nombre || producto?.categoria_terapeutica || producto?.clasificacion || "Sin categoria";
}

function normalizarOrden(campo: string) {
  const permitidos: Record<string, string> = {
    fecha_snapshot: "fecha_snapshot_dia",
    cantidad_disponible: "cantidad_disponible",
    stock_minimo: "stock_minimo",
    stock_maximo: "stock_maximo",
    stockout_flag: "stockout_flag",
    demanda_insatisfecha: "demanda_insatisfecha",
  };
  return permitidos[campo] || "fecha_snapshot_dia";
}

function calcularResumen(datos: any[], total: number) {
  const productos = new Set(datos.map((item: any) => item.producto_id).filter(Boolean)).size;
  const boticas = new Set(datos.map((item: any) => item.botica_id).filter(Boolean)).size;
  return {
    snapshots: total,
    productos,
    boticas,
    semanasConStockout: datos.filter((item: any) => Number(item.stockout_flag) === 1).length,
    demandaInsatisfechaTotal: datos.reduce((acc: number, item: any) => acc + Number(item.demanda_insatisfecha || 0), 0),
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
