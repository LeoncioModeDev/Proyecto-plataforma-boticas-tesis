import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  activo: boolean;
  botica_id: string | null;
  nombre?: string;
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
    .select("id, org_id, rol, activo, botica_id, nombre")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) return json({ error: `Error al consultar perfil: ${perfilError.message}` }, 500);
  if (!perfil) return json({ error: "Perfil de usuario no encontrado" }, 403);
  if (!perfil.activo) return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);
  if (perfil.rol === "super_admin") return json({ error: "Super Admin no tiene acceso al módulo de ventas" }, 403);

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  const recurso = segmentos[1] || null;
  const id = segmentos[1] || null;
  const accion = segmentos[2] || null;

  try {
    if (req.method === "GET") {
      if (recurso === "productos") return buscarProductosVenta(supabase, perfil, url);
      if (recurso === "demanda-no-atendida") return listarDemandaNoAtendida(supabase, perfil, url);
      if (recurso === "reportes") return obtenerReportes(supabase, perfil, url);
      if (id) return obtenerVenta(supabase, perfil, id);
      return listarVentas(supabase, perfil, url);
    }

    if (req.method === "POST") {
      return registrarVenta(supabase, perfil, await req.json());
    }

    if (req.method === "PUT") {
      if (!id) return json({ error: "ID de venta requerido" }, 400);
      if (accion === "anular") return anularVenta(supabase, perfil, id, await req.json().catch(() => ({})));
      return json({ error: "Acción no válida" }, 400);
    }

    return json({ error: "Método no soportado" }, 405);
  } catch (e) {
    console.error("Error en ventas:", e);
    return json({ error: e instanceof Error ? e.message : "Error interno del servidor" }, 500);
  }
});

function aplicarAlcanceVentas(query: any, perfil: PerfilUsuario) {
  query = query.eq("org_id", perfil.org_id);
  if (perfil.rol === "visor_botica") query = query.eq("botica_id", perfil.botica_id);
  return query;
}

async function buscarProductosVenta(supabase: any, perfil: PerfilUsuario, url: URL) {
  if (perfil.rol !== "visor_botica") return json({ error: "Solo el visor de botica busca productos para venta" }, 403);
  if (!perfil.botica_id) return json({ error: "El visor no tiene botica asignada" }, 400);

  const busqueda = (url.searchParams.get("busqueda") || "").replaceAll(",", " ").trim();
  const productoId = url.searchParams.get("productoId");
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite") || 10), 1), 25);

  let query = supabase
    .from("productos")
    .select("id, codigo_interno, nombre_comercial, presentacion, estado, categorias_terapeuticas(nombre), formas_farmaceuticas(nombre)")
    .eq("org_id", perfil.org_id)
    .eq("estado", "activo")
    .order("nombre_comercial", { ascending: true })
    .limit(limite);

  if (productoId) query = query.eq("id", productoId);
  if (busqueda) query = query.or(`codigo_interno.ilike.%${busqueda}%,nombre_comercial.ilike.%${busqueda}%`);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);

  const enriquecidos = await Promise.all((data || []).map((producto: any) => obtenerInfoProductoVenta(supabase, perfil, producto)));
  return json({ datos: enriquecidos });
}

async function obtenerInfoProductoVenta(supabase: any, perfil: PerfilUsuario, producto: any) {
  const ahora = new Date().toISOString();

  const { data: precios } = await supabase
    .from("precios")
    .select("id, precio_venta, botica_id, vigente_desde, vigente_hasta")
    .eq("org_id", perfil.org_id)
    .eq("producto_id", producto.id)
    .or(`botica_id.eq.${perfil.botica_id},botica_id.is.null`)
    .lte("vigente_desde", ahora)
    .or(`vigente_hasta.gte.${ahora},vigente_hasta.is.null`)
    .order("botica_id", { ascending: true, nullsFirst: false })
    .order("vigente_desde", { ascending: false });

  const precio = (precios || []).sort((a: any, b: any) => {
    const pa = a.botica_id === perfil.botica_id ? 0 : 1;
    const pb = b.botica_id === perfil.botica_id ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return String(b.vigente_desde).localeCompare(String(a.vigente_desde));
  })[0] || null;

  const { data: stock } = await supabase
    .from("stock_ubicaciones")
    .select("stock_fisico, stock_comprometido")
    .eq("org_id", perfil.org_id)
    .eq("producto_id", producto.id)
    .eq("ubicacion_tipo", "botica")
    .eq("ubicacion_id", perfil.botica_id)
    .maybeSingle();

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: lotes } = await supabase
    .from("lotes")
    .select("cantidad")
    .eq("org_id", perfil.org_id)
    .eq("producto_id", producto.id)
    .eq("ubicacion_tipo", "botica")
    .eq("ubicacion_id", perfil.botica_id)
    .gt("cantidad", 0)
    .gte("fecha_vencimiento", hoy);

  const stockDisponible = Math.max((stock?.stock_fisico || 0) - (stock?.stock_comprometido || 0), 0);
  const stockLotes = (lotes || []).reduce((acc: number, lote: any) => acc + Number(lote.cantidad || 0), 0);

  return {
    id: producto.id,
    codigo_producto: producto.codigo_interno,
    producto: producto.nombre_comercial,
    presentacion: producto.presentacion,
    categoria_terapeutica: producto.categorias_terapeuticas?.nombre || null,
    forma_farmaceutica: producto.formas_farmaceuticas?.nombre || null,
    precio_unitario: precio?.precio_venta ?? null,
    precio_id: precio?.id ?? null,
    stock_disponible: Math.min(stockDisponible, stockLotes),
    stock_fisico: stock?.stock_fisico || 0,
    stock_comprometido: stock?.stock_comprometido || 0,
    tiene_precio_vigente: Boolean(precio),
  };
}

async function registrarVenta(supabase: any, perfil: PerfilUsuario, body: any) {
  if (perfil.rol !== "visor_botica") return json({ error: "Solo el visor de botica puede registrar ventas" }, 403);
  const { data, error } = await supabase.rpc("registrar_venta_operativa", {
    p_usuario_id: perfil.id,
    p_items: body.items || [],
    p_clave_idempotencia: body.clave_idempotencia || null,
  });
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

async function anularVenta(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  if (perfil.rol !== "admin_central") return json({ error: "Solo admin_central puede anular ventas" }, 403);
  const { data, error } = await supabase.rpc("anular_venta_operativa", {
    p_usuario_id: perfil.id,
    p_venta_id: id,
    p_motivo: body.motivo_anulacion || body.motivo || "",
  });
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

async function listarVentas(supabase: any, perfil: PerfilUsuario, url: URL) {
  if (!rolesConsulta(perfil)) return json({ error: "No tienes permisos para consultar ventas" }, 403);

  const pagina = Math.max(Number(url.searchParams.get("pagina") || 1), 1);
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite") || 10), 1), 100);
  const desde = (pagina - 1) * limite;
  const productoId = url.searchParams.get("productoId") || "";

  let query = supabase.from("vw_ventas_operativas").select("*", { count: "exact" });
  query = aplicarAlcanceVentas(query, perfil);
  query = aplicarFiltrosVentas(query, url, perfil);

  if (productoId) {
    const { data: items, error: errItems } = await supabase
      .from("venta_items")
      .select("venta_id")
      .eq("producto_id", productoId);
    if (errItems) return json({ error: errItems.message }, 400);
    const ids = [...new Set((items || []).map((item: any) => item.venta_id))];
    if (ids.length === 0) return json({ datos: [], total: 0, pagina, limite, totalPaginas: 1, resumen: resumenVacio() });
    query = query.in("id", ids);
  }

  const { data, error, count } = await query.order("fecha_venta", { ascending: false }).range(desde, desde + limite - 1);
  if (error) return json({ error: error.message }, 400);

  const resumen = await calcularResumenVentas(supabase, perfil, url, productoId);
  return json({ datos: data || [], total: count || 0, pagina, limite, totalPaginas: Math.max(Math.ceil((count || 0) / limite), 1), resumen });
}

async function obtenerVenta(supabase: any, perfil: PerfilUsuario, id: string) {
  if (!rolesConsulta(perfil)) return json({ error: "No tienes permisos para consultar ventas" }, 403);

  const { data, error } = await supabase.rpc("obtener_venta_operativa_json", {
    p_venta_id: id,
    p_usuario_id: perfil.id,
  });
  if (error) return json({ error: error.message }, 404);
  if (data?.org_id !== perfil.org_id) return json({ error: "Venta no encontrada" }, 404);
  if (perfil.rol === "visor_botica" && data?.botica_id !== perfil.botica_id) return json({ error: "Venta no encontrada" }, 404);
  return json({ datos: data });
}

async function listarDemandaNoAtendida(supabase: any, perfil: PerfilUsuario, url: URL) {
  if (!["admin_central", "operador_drogueria"].includes(perfil.rol)) return json({ error: "No tienes permisos para consultar demanda no atendida" }, 403);

  const pagina = Math.max(Number(url.searchParams.get("pagina") || 1), 1);
  const limite = Math.min(Math.max(Number(url.searchParams.get("limite") || 10), 1), 100);
  const desde = (pagina - 1) * limite;
  let query = supabase.from("vw_demanda_no_atendida_operativa").select("*", { count: "exact" }).eq("org_id", perfil.org_id);

  if (url.searchParams.get("boticaId")) query = query.eq("botica_id", url.searchParams.get("boticaId"));
  if (url.searchParams.get("productoId")) query = query.eq("producto_id", url.searchParams.get("productoId"));
  if (url.searchParams.get("motivo")) query = query.eq("motivo_no_atencion", url.searchParams.get("motivo"));
  if (url.searchParams.get("fechaDesde")) query = query.gte("fecha_venta", url.searchParams.get("fechaDesde"));
  if (url.searchParams.get("fechaHasta")) query = query.lte("fecha_venta", `${url.searchParams.get("fechaHasta")}T23:59:59`);
  if (url.searchParams.get("busqueda")) {
    const b = url.searchParams.get("busqueda")!.replaceAll(",", " ").trim();
    if (b) query = query.or(`codigo_producto.ilike.%${b}%,producto.ilike.%${b}%,numero_venta.ilike.%${b}%`);
  }

  const { data, error, count } = await query.order("fecha_venta", { ascending: false }).range(desde, desde + limite - 1);
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data || [], total: count || 0, pagina, limite, totalPaginas: Math.max(Math.ceil((count || 0) / limite), 1) });
}

async function obtenerReportes(supabase: any, perfil: PerfilUsuario, url: URL) {
  if (perfil.rol !== "admin_central") return json({ error: "Solo admin_central puede consultar reportes de ventas" }, 403);

  let query = supabase.from("vw_ventas_operativas").select("*").eq("org_id", perfil.org_id).eq("estado", "registrada");
  query = aplicarFiltrosVentas(query, url, perfil, false);
  const { data, error } = await query.order("fecha_venta", { ascending: true }).range(0, 9999);
  if (error) return json({ error: error.message }, 400);

  let itemsQuery = supabase
    .from("venta_items")
    .select("cantidad_solicitada, cantidad_atendida, demanda_no_atendida, importe_total, producto:producto_id(codigo_interno,nombre_comercial), venta:venta_id!inner(org_id,botica_id,fecha_venta,estado,resultado_atencion)")
    .eq("venta.org_id", perfil.org_id)
    .eq("venta.estado", "registrada");
  if (url.searchParams.get("boticaId")) itemsQuery = itemsQuery.eq("venta.botica_id", url.searchParams.get("boticaId"));
  if (url.searchParams.get("resultado")) itemsQuery = itemsQuery.eq("venta.resultado_atencion", url.searchParams.get("resultado"));
  if (url.searchParams.get("fechaDesde")) itemsQuery = itemsQuery.gte("venta.fecha_venta", url.searchParams.get("fechaDesde"));
  if (url.searchParams.get("fechaHasta")) itemsQuery = itemsQuery.lte("venta.fecha_venta", `${url.searchParams.get("fechaHasta")}T23:59:59`);
  const { data: items, error: itemsError } = await itemsQuery.range(0, 9999);
  if (itemsError) return json({ error: itemsError.message }, 400);

  return json({ datos: { ...construirReporte(data || []), porProducto: agruparProductos(items || []) } });
}

function aplicarFiltrosVentas(query: any, url: URL, perfil: PerfilUsuario, incluirEstado = true) {
  const boticaId = url.searchParams.get("boticaId");
  if (boticaId && perfil.rol !== "visor_botica") query = query.eq("botica_id", boticaId);
  if (incluirEstado && url.searchParams.get("estado")) query = query.eq("estado", url.searchParams.get("estado"));
  if (url.searchParams.get("resultado")) query = query.eq("resultado_atencion", url.searchParams.get("resultado"));
  if (url.searchParams.get("fechaDesde")) query = query.gte("fecha_venta", url.searchParams.get("fechaDesde"));
  if (url.searchParams.get("fechaHasta")) query = query.lte("fecha_venta", `${url.searchParams.get("fechaHasta")}T23:59:59`);
  if (url.searchParams.get("busqueda")) {
    const b = url.searchParams.get("busqueda")!.replaceAll(",", " ").trim();
    if (b) query = query.or(`numero_venta.ilike.%${b}%,productos_resumen.ilike.%${b}%,botica.ilike.%${b}%`);
  }
  return query;
}

async function calcularResumenVentas(supabase: any, perfil: PerfilUsuario, url: URL, productoId = "") {
  let query = supabase.from("vw_ventas_operativas").select("id, cantidad_solicitada, cantidad_atendida, demanda_no_atendida, total, estado");
  query = aplicarAlcanceVentas(query, perfil);
  query = aplicarFiltrosVentas(query, url, perfil);

  if (productoId) {
    const { data: items } = await supabase.from("venta_items").select("venta_id").eq("producto_id", productoId);
    const ids = [...new Set((items || []).map((item: any) => item.venta_id))];
    if (ids.length === 0) return resumenVacio();
    query = query.in("id", ids);
  }

  const { data, error } = await query.range(0, 9999);
  if (error) return resumenVacio();
  return resumenDesdeVentas(data || []);
}

function resumenDesdeVentas(ventas: any[]) {
  const operativas = ventas.filter(v => v.estado !== "anulada");
  const solicitadas = operativas.reduce((acc, v) => acc + Number(v.cantidad_solicitada || 0), 0);
  const atendidas = operativas.reduce((acc, v) => acc + Number(v.cantidad_atendida || 0), 0);
  const noAtendida = operativas.reduce((acc, v) => acc + Number(v.demanda_no_atendida || 0), 0);
  const total = operativas.reduce((acc, v) => acc + Number(v.total || 0), 0);
  return {
    ventas: operativas.length,
    unidadesSolicitadas: solicitadas,
    unidadesAtendidas: atendidas,
    demandaNoAtendida: noAtendida,
    importeVentas: total,
    fillRate: solicitadas > 0 ? Number(((atendidas / solicitadas) * 100).toFixed(2)) : 0,
  };
}

function resumenVacio() {
  return { ventas: 0, unidadesSolicitadas: 0, unidadesAtendidas: 0, demandaNoAtendida: 0, importeVentas: 0, fillRate: 0 };
}

function construirReporte(ventas: any[]) {
  const resumen = resumenDesdeVentas(ventas);
  const porBotica = agrupar(ventas, "botica");
  const porFecha = agruparFecha(ventas);
  return { resumen, porBotica, evolucion: porFecha };
}

function agrupar(ventas: any[], campo: string) {
  const mapa = new Map<string, any>();
  for (const venta of ventas) {
    const clave = venta[campo] || "Sin dato";
    const actual = mapa.get(clave) || { etiqueta: clave, ventas: 0, solicitadas: 0, atendidas: 0, demandaNoAtendida: 0, total: 0 };
    actual.ventas += 1;
    actual.solicitadas += Number(venta.cantidad_solicitada || 0);
    actual.atendidas += Number(venta.cantidad_atendida || 0);
    actual.demandaNoAtendida += Number(venta.demanda_no_atendida || 0);
    actual.total += Number(venta.total || 0);
    mapa.set(clave, actual);
  }
  return [...mapa.values()].map(item => ({ ...item, fillRate: item.solicitadas > 0 ? Number(((item.atendidas / item.solicitadas) * 100).toFixed(2)) : 0 })).sort((a, b) => b.total - a.total);
}

function agruparFecha(ventas: any[]) {
  const mapa = new Map<string, any>();
  for (const venta of ventas) {
    const fecha = String(venta.fecha_venta || "").slice(0, 10) || "Sin fecha";
    const actual = mapa.get(fecha) || { fecha, solicitadas: 0, atendidas: 0, demandaNoAtendida: 0, total: 0 };
    actual.solicitadas += Number(venta.cantidad_solicitada || 0);
    actual.atendidas += Number(venta.cantidad_atendida || 0);
    actual.demandaNoAtendida += Number(venta.demanda_no_atendida || 0);
    actual.total += Number(venta.total || 0);
    mapa.set(fecha, actual);
  }
  return [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function agruparProductos(items: any[]) {
  const mapa = new Map<string, any>();
  for (const item of items) {
    const producto = item.producto?.nombre_comercial || "Sin producto";
    const codigo = item.producto?.codigo_interno || "";
    const clave = `${codigo}|${producto}`;
    const actual = mapa.get(clave) || { codigoProducto: codigo, producto, solicitadas: 0, atendidas: 0, demandaNoAtendida: 0, total: 0 };
    actual.solicitadas += Number(item.cantidad_solicitada || 0);
    actual.atendidas += Number(item.cantidad_atendida || 0);
    actual.demandaNoAtendida += Number(item.demanda_no_atendida || 0);
    actual.total += Number(item.importe_total || 0);
    mapa.set(clave, actual);
  }
  return [...mapa.values()].map(item => ({ ...item, fillRate: item.solicitadas > 0 ? Number(((item.atendidas / item.solicitadas) * 100).toFixed(2)) : 0 })).sort((a, b) => b.total - a.total);
}

function rolesConsulta(perfil: PerfilUsuario) {
  return ["admin_central", "operador_drogueria", "visor_botica"].includes(perfil.rol);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
