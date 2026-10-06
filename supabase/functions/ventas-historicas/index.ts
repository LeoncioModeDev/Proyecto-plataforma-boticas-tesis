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

const VISTA = "vw_ventas_historicas_importadas";
const COLUMNAS = "fecha_venta,botica_id,botica,codigo_producto,producto_id,producto,categoria_terapeutica,cantidad,precio_unitario,importacion_id,fecha_importacion";

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
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

  try {
    return await listarVentasHistoricas(supabase, perfil, new URL(req.url));
  } catch (e) {
    console.error("Error en ventas-historicas:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

async function listarVentasHistoricas(supabase: any, perfil: PerfilUsuario, url: URL) {
  const params = url.searchParams;
  const pagina = Math.max(Number(params.get("pagina") || 1), 1);
  const limite = Math.max(Number(params.get("limite") || 20), 1);
  const busqueda = params.get("busqueda") || "";
  const boticaId = params.get("boticaId") || "";
  const productoId = params.get("productoId") || "";
  const categoria = params.get("categoria") || "";
  const importacionId = params.get("importacionId") || "";
  const fechaDesde = params.get("fechaDesde") || "";
  const fechaHasta = params.get("fechaHasta") || "";
  const ordenCampo = params.get("ordenCampo") || "fecha_venta";
  const ascendente = params.get("ascendente") === "true";

  let query = supabase
    .from(VISTA)
    .select(COLUMNAS, { count: "exact", head: false })
    .eq("org_id", perfil.org_id);

  if (perfil.rol === "visor_botica") {
    const { data: userData } = await supabase
      .from("usuarios")
      .select("botica_id")
      .eq("id", perfil.id)
      .single();
    if (userData?.botica_id) {
      query = query.eq("botica_id", userData.botica_id);
    }
  }

  if (boticaId) query = query.eq("botica_id", boticaId);
  if (productoId) query = query.eq("producto_id", productoId);
  if (categoria) query = query.eq("categoria_terapeutica", categoria);
  if (importacionId) query = query.eq("importacion_id", importacionId);
  if (fechaDesde) query = query.gte("fecha_venta", fechaDesde);
  if (fechaHasta) query = query.lte("fecha_venta", fechaHasta);
  if (busqueda) {
    const termino = busqueda.replaceAll(",", " ").trim();
    if (termino) query = query.or(`codigo_producto.ilike.%${termino}%,producto.ilike.%${termino}%`);
  }

  query = query.order(ordenCampo, { ascending: ascendente });
  const desde = (pagina - 1) * limite;
  query = query.range(desde, desde + limite - 1);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 400);

  const datos = data || [];
  const resumen = calcularResumen(datos, count || 0);

  return json({ datos, total: count || 0, resumen });
}

function calcularResumen(datos: any[], total: number) {
  const unidades = datos.reduce((acc: number, item: any) => acc + Number(item.cantidad || 0), 0);
  const productos = new Set(datos.map((item: any) => item.producto_id).filter(Boolean)).size;
  const boticas = new Set(datos.map((item: any) => item.botica_id).filter(Boolean)).size;
  const fechas = datos.map((item: any) => item.fecha_venta).filter(Boolean).sort();
  return {
    totalRegistros: total,
    totalUnidades: unidades,
    productosConVentas: productos,
    boticasConVentas: boticas,
    rangoHistorico: fechas.length ? `${fechas[0]} - ${fechas[fechas.length - 1]}` : "Sin datos",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
