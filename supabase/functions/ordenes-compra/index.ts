import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  pendiente:            ["aprobada", "rechazada"],
  aprobada:             ["por_recibir", "cancelada"],
  por_recibir:          ["recibida", "recibida_parcial", "recibida_con_observacion", "en_devolucion", "cancelada"],
  recibida_parcial:     ["recibida", "recibida_con_observacion", "en_devolucion"],
  recibida:             [],
  recibida_con_observacion: [],
  en_devolucion:        [],
  rechazada:            [],
  cancelada:            [],
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
      return json({ error: "Perfil de usuario no encontrado" }, 403);
    }

    if (!perfil.activo) {
      return json({ error: "Usuario desactivado. Contacta al administrador." }, 403);
    }

  const url = new URL(req.url);
  const cleanPath = url.pathname.replace(/^(\/functions\/v1)?\/ordenes-compra/, "");
  const segmentos = cleanPath.split("/").filter(Boolean);
  const id = segmentos[0] || null;
  const accion = segmentos[1] || null;

  if (req.method === "GET") {
    if (segmentos[0] === "recepciones") {
      return listarRecepciones(supabase, perfil, url);
    }
    if (id && accion === "pendientes") {
      return obtenerPendientes(supabase, perfil, id);
    }
    if (id) {
      return obtenerOC(supabase, perfil, id);
    }
    return listarOC(supabase, perfil, url);
  }

  if (req.method === "POST") {
    if (id && accion === "recepciones") {
      return registrarRecepcion(supabase, perfil, id, await req.json());
    }
    return crearOC(supabase, perfil, await req.json());
  }

  if (req.method === "PUT") {
    if (id && accion === "aprobar") {
      return aprobarOC(supabase, perfil, id);
    }
    if (id && accion === "por-recibir") {
      return marcarPorRecibir(supabase, perfil, id);
    }

    const body = await req.json();

    if (id && accion === "rechazar") {
      return rechazarOC(supabase, perfil, id, body);
    }
    if (id && accion === "cancelar") {
      return cancelarOC(supabase, perfil, id, body);
    }
    if (id && !accion) {
      return actualizarOC(supabase, perfil, id, body);
    }
  }

  return json({ error: "Ruta no soportada" }, 405);
  } catch (e) {
    console.error("Error en ordenes-compra:", e);
    const mensaje = e instanceof Error ? e.message : String(e);
    return json({ error: mensaje }, 500);
  }
});

// ─── LISTAR ───────────────────────────────────────────────────
async function listarOC(supabase: any, perfil: PerfilUsuario, url: URL) {
  const estado = url.searchParams.get("estado");
  const proveedorId = url.searchParams.get("proveedor_id");
  const busqueda = url.searchParams.get("search");

  let query = supabase
    .from("ordenes_compra")
    .select(`
      *,
      proveedores!inner(
        id, razon_social,
        monedas!moneda_id(id, codigo, simbolo)
      ),
      ordenes_compra_items(*, productos(id, nombre_comercial))
    `)
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false });

  if (estado) query = query.eq("estado", estado);
  if (proveedorId) query = query.eq("proveedor_id", proveedorId);

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);

  let resultados = (data || []).map(normalizarOC);

  if (busqueda) {
    const term = busqueda.toLowerCase();
    resultados = resultados.filter((r: any) =>
      r.id.toLowerCase().includes(term) ||
      r.proveedorNombre?.toLowerCase().includes(term)
    );
  }

  return json({ datos: resultados });
}

// ─── OBTENER ──────────────────────────────────────────────────
async function obtenerOC(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("ordenes_compra")
    .select(`
      *,
      proveedores!inner(
        id, razon_social,
        monedas!moneda_id(id, codigo, simbolo)
      ),
      ordenes_compra_items(*, productos(id, nombre_comercial)),
      recepciones_orden(
        *,
        recepcion_items(*, productos(id, nombre_comercial), lotes(id, numero_lote, fecha_vencimiento))
      )
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: error.message }, 404);

  return json({ datos: normalizarOC(data) });
}

// ─── CREAR ────────────────────────────────────────────────────
async function crearOC(supabase: any, perfil: PerfilUsuario, body: any) {
  const { proveedor_id, fecha_estimada_entrega, observaciones, items } = body;

  if (!proveedor_id) return json({ error: "proveedor_id es requerido" }, 400);
  if (!fecha_estimada_entrega) return json({ error: "fecha_estimada_entrega es requerida" }, 400);
  if (!items || !items.length) return json({ error: "Se requiere al menos un item" }, 400);

  const { data: proveedor, error: errProv } = await supabase
    .from("proveedores")
    .select("org_id")
    .eq("id", proveedor_id)
    .single();

  if (errProv || !proveedor) return json({ error: "Proveedor no encontrado" }, 404);
  if (proveedor.org_id !== perfil.org_id) return json({ error: "No autorizado" }, 403);

  const idsProductos = items.map((i: any) => i.producto_id);
  const errorCondiciones = await validarCondicionesCompra(supabase, proveedor_id, items);
  if (errorCondiciones) return json({ error: errorCondiciones }, 400);

  if (idsProductos.length > 0) {
    const { data: productos } = await supabase
      .from("productos")
      .select("id, estado")
      .in("id", idsProductos);

    const inactivos = (productos || [])
      .filter((p: any) => p.estado !== "activo")
      .map((p: any) => p.id);

    if (inactivos.length > 0) {
      return json({
        error: `No se pueden agregar productos inactivos o descontinuados a una orden de compra. IDs: ${inactivos.join(", ")}`,
      }, 400);
    }
  }

  const { data: numOrden, error: errNum } = await supabase.rpc("generar_numero_orden", {
    p_org_id: perfil.org_id,
  });

  if (errNum || !numOrden) {
    return json({ error: "Error al generar número de orden: " + (errNum?.message || "respuesta vacía") }, 500);
  }

  const { data: oc, error: errOC } = await supabase
    .from("ordenes_compra")
    .insert({
      proveedor_id,
      numero_orden: numOrden,
      creado_por: perfil.id,
      org_id: perfil.org_id,
      estado: "pendiente",
      fecha_estimada_entrega,
      observaciones: observaciones || null,
    })
    .select("id")
    .single();

  if (errOC) return json({ error: errOC.message }, 400);

  const ocItems = items.map((i: any) => ({
    orden_compra_id: oc.id,
    producto_id: i.producto_id,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
  }));

  const { error: errItems } = await supabase
    .from("ordenes_compra_items")
    .insert(ocItems);

  if (errItems) {
    await supabase.from("ordenes_compra").delete().eq("id", oc.id);
    return json({ error: errItems.message }, 400);
  }

  return json({ exito: true, id: oc.id, numero_orden: numOrden });
}

// ─── ACTUALIZAR (solo pendiente) ──────────────────────────────
async function actualizarOC(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { data: actual } = await supabase
    .from("ordenes_compra")
    .select("estado")
    .eq("id", id)
    .single();

  if (!actual) return json({ error: "Orden no encontrada" }, 404);
  if (actual.estado !== "pendiente") {
    return json({ error: "Solo se puede editar órdenes en estado pendiente" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (body.fecha_estimada_entrega) updates.fecha_estimada_entrega = body.fecha_estimada_entrega;
  if (body.observaciones !== undefined) updates.observaciones = body.observaciones;

  const { error } = await supabase
    .from("ordenes_compra")
    .update(updates)
    .eq("id", id);

  if (error) return json({ error: error.message }, 400);

  if (body.items) {
    const { data: ocProveedor } = await supabase
      .from("ordenes_compra")
      .select("proveedor_id")
      .eq("id", id)
      .single();
    const errorCondiciones = await validarCondicionesCompra(supabase, ocProveedor?.proveedor_id, body.items);
    if (errorCondiciones) return json({ error: errorCondiciones }, 400);

    await supabase.from("ordenes_compra_items").delete().eq("orden_compra_id", id);
    const items = body.items.map((i: any) => ({
      orden_compra_id: id,
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    }));
    const { error: errItems } = await supabase
      .from("ordenes_compra_items")
      .insert(items);
    if (errItems) return json({ error: errItems.message }, 400);
  }

  return json({ exito: true });
}

async function validarCondicionesCompra(supabase: any, proveedorId: string, items: any[]) {
  if (!proveedorId) return "Proveedor requerido para validar condiciones de compra";
  for (const item of items) {
    const { data: relacion, error } = await supabase
      .from("proveedor_producto")
      .select("cantidad_minima_compra, multiplo_empaque")
      .eq("proveedor_id", proveedorId)
      .eq("producto_id", item.producto_id)
      .eq("activo", true)
      .maybeSingle();

    if (error || !relacion) return `Producto ${item.producto_id} no está configurado para el proveedor seleccionado`;

    const minimo = Number(relacion.cantidad_minima_compra || 1);
    const multiplo = Number(relacion.multiplo_empaque || 1);
    const cantidad = Number(item.cantidad || 0);
    const ajustada = Math.max(cantidad, minimo);
    const sugerida = Math.ceil(ajustada / multiplo) * multiplo;

    if (cantidad !== sugerida) {
      return `La cantidad ingresada no cumple las condiciones del proveedor. Compra mínima: ${minimo}. Múltiplo de empaque: ${multiplo}. Cantidad válida sugerida: ${sugerida}.`;
    }
  }
  return null;
}

// ─── APROBAR ──────────────────────────────────────────────────
async function aprobarOC(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: oc, error: errOC } = await supabase
    .from("ordenes_compra")
    .select("id, estado")
    .eq("id", id)
    .single();

  if (errOC || !oc) return json({ error: "Orden no encontrada" }, 404);
  if (!puedeTransicionar(oc.estado, "aprobada")) {
    return json({ error: `No se puede aprobar una orden en estado ${oc.estado}` }, 400);
  }

  const { error: errUpd } = await supabase
    .from("ordenes_compra")
    .update({
      estado: "aprobada",
      aprobado_por: perfil.id,
      fecha_aprobacion: new Date().toISOString(),
    })
    .eq("id", id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  return json({ exito: true, estado: "aprobada" });
}

// ─── POR RECIBIR ──────────────────────────────────────────────
async function marcarPorRecibir(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: oc, error: errOC } = await supabase
    .from("ordenes_compra")
    .select("id, estado")
    .eq("id", id)
    .single();

  if (errOC || !oc) return json({ error: "Orden no encontrada" }, 404);
  if (!puedeTransicionar(oc.estado, "por_recibir")) {
    return json({ error: `No se puede marcar como por_recibir una orden en estado ${oc.estado}` }, 400);
  }

  const { error: errUpd } = await supabase
    .from("ordenes_compra")
    .update({ estado: "por_recibir" })
    .eq("id", id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  const { error: errStock } = await incrementarStockPorRecibir(supabase, perfil.org_id, id);
  if (errStock) return json({ error: errStock.message }, 400);

  return json({ exito: true, estado: "por_recibir" });
}

// ─── RECHAZAR ─────────────────────────────────────────────────
async function rechazarOC(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { data: oc } = await supabase
    .from("ordenes_compra")
    .select("id, estado")
    .eq("id", id)
    .single();

  if (!oc) return json({ error: "Orden no encontrada" }, 404);
  if (!puedeTransicionar(oc.estado, "rechazada")) {
    return json({ error: `No se puede rechazar una orden en estado ${oc.estado}` }, 400);
  }

  const { error } = await supabase
    .from("ordenes_compra")
    .update({
      estado: "rechazada",
      rechazado_por: perfil.id,
      fecha_rechazo: new Date().toISOString(),
      motivo_rechazo: body.motivo || null,
    })
    .eq("id", id);

  if (error) return json({ error: error.message }, 400);
  return json({ exito: true, estado: "rechazada" });
}

// ─── CANCELAR ─────────────────────────────────────────────────
async function cancelarOC(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  const { data: oc } = await supabase
    .from("ordenes_compra")
    .select("id, estado")
    .eq("id", id)
    .single();

  if (!oc) return json({ error: "Orden no encontrada" }, 404);
  if (!puedeTransicionar(oc.estado, "cancelada")) {
    return json({ error: `No se puede cancelar una orden en estado ${oc.estado}` }, 400);
  }

  const { error } = await supabase
    .from("ordenes_compra")
    .update({
      estado: "cancelada",
      cancelado_por: perfil.id,
      fecha_cancelacion: new Date().toISOString(),
      motivo_cancelacion: body.motivo || null,
    })
    .eq("id", id);

  if (error) return json({ error: error.message }, 400);

  if (oc.estado === "por_recibir") {
    await revertirStockPorRecibir(supabase, perfil.org_id, id);
  }

  return json({ exito: true, estado: "cancelada" });
}

// ─── RECEPCIÓN ────────────────────────────────────────────────
async function registrarRecepcion(supabase: any, perfil: PerfilUsuario, id: string, body: any) {
  try {
    const { items: itemsRecibidos, observacion, resultado, motivo_rechazo } = body;

    if (!resultado || !["recibida", "recibida_parcial", "recibida_con_observacion", "en_devolucion"].includes(resultado)) {
      return json({ error: "resultado requerido: recibida, recibida_parcial, recibida_con_observacion o en_devolucion" }, 400);
    }

    const { data: oc, error: errOC } = await supabase
      .from("ordenes_compra")
      .select("id, estado, proveedor_id")
      .eq("id", id)
      .single();

    if (errOC || !oc) return json({ error: "Orden no encontrada" }, 404);

    const estadosPosibles = ["recibida", "recibida_parcial", "recibida_con_observacion", "en_devolucion"];
    const permitidos = TRANSICIONES_VALIDAS[oc.estado];
    if (!permitidos?.some(s => estadosPosibles.includes(s))) {
      return json({ error: `No se puede recibir una orden en estado ${oc.estado}` }, 400);
    }

    const { data: ocItems, error: errItems } = await supabase
      .from("ordenes_compra_items")
      .select("*")
      .eq("orden_compra_id", id);
    if (errItems) return json({ error: errItems.message }, 400);
    const todosItems = ocItems || [];

    // Obtener cantidades ya recibidas (solo recepciones aceptadas)
    const { data: allRecs } = await supabase
      .from("recepciones_orden")
      .select("id, resultado")
      .eq("orden_compra_id", id);
    const prevIds = (allRecs || [])
      .filter(r => r.resultado !== "en_devolucion")
      .map(r => r.id);

    let recepcionesPrevias: any[] = [];
    if (prevIds.length > 0) {
      const { data: r } = await supabase
        .from("recepcion_items")
        .select("producto_id, cantidad_recibida")
        .in("recepcion_id", prevIds);
      recepcionesPrevias = r || [];
    }

    const recibidoPrevio: Record<string, number> = {};
    for (const r of recepcionesPrevias) {
      recibidoPrevio[r.producto_id] = (recibidoPrevio[r.producto_id] || 0) + r.cantidad_recibida;
    }

    // CASO: Devolución total
    if (resultado === "en_devolucion") {
      if (!motivo_rechazo) return json({ error: "motivo_rechazo es requerido para devolución" }, 400);

      // Revertir stock_por_recibir: quitar solo el saldo pendiente
      const revertError = await revertirStockPorRecibir(supabase, perfil.org_id, id);
      if (revertError?.error) return json({ error: revertError.error }, 400);

      const { data: recepcion, error: errRec } = await supabase
        .from("recepciones_orden")
        .insert({
          orden_compra_id: id,
          resultado: "en_devolucion",
          motivo_rechazo,
          registrado_por: perfil.id,
        })
        .select("id")
        .single();
      if (errRec) return json({ error: errRec.message }, 400);

      await supabase.from("ordenes_compra").update({ estado: "en_devolucion" }).eq("id", id);

      return json({ exito: true, recepcion_id: recepcion.id, numero_recepcion: numRec });
    }

    // CASO: Recepción aceptada
    if (!itemsRecibidos || !itemsRecibidos.length) {
      return json({ error: "Se requiere al menos un item en la recepción" }, 400);
    }

    if (resultado === "recibida_con_observacion" && !observacion?.trim()) {
      return json({ error: "La observación es obligatoria para recibida con observación" }, 400);
    }

    const hoy = new Date().toISOString().split("T")[0];

    // Validar cantidades
    for (const item of itemsRecibidos) {
      const { producto_id, cantidad_recibida, fecha_vencimiento } = item;
      if (cantidad_recibida <= 0) {
        return json({ error: `cantidad_recibida debe ser mayor a 0 para producto ${producto_id}` }, 400);
      }
      if (fecha_vencimiento && fecha_vencimiento < hoy) {
        return json({ error: `La fecha de vencimiento del producto ${producto_id} no puede ser anterior a hoy` }, 400);
      }
      const itemOC = todosItems.find((i: any) => i.producto_id === producto_id);
      if (!itemOC) return json({ error: `Producto ${producto_id} no está en la orden` }, 400);
      const pendiente = itemOC.cantidad - (recibidoPrevio[producto_id] || 0);
      if (cantidad_recibida > pendiente) {
        return json({
          error: `Producto ${producto_id}: recibido ${cantidad_recibida} excede el pendiente ${pendiente}`
        }, 400);
      }
      if (resultado === "recibida_parcial" && cantidad_recibida >= pendiente) {
        return json({
          error: `Producto ${producto_id}: en recepción parcial la cantidad recibida (${cantidad_recibida}) debe ser menor al pendiente (${pendiente})`
        }, 400);
      }
      if (["recibida", "recibida_con_observacion"].includes(resultado) && cantidad_recibida !== pendiente) {
        return json({
          error: `Producto ${producto_id}: en ${resultado} la cantidad recibida debe ser igual al pendiente (${pendiente})`
        }, 400);
      }
    }

    // Crear cabecera de recepción
    const { data: numRec, error: errNum } = await supabase.rpc("generar_numero_recepcion", {
      p_org_id: perfil.org_id,
    });
    if (errNum || !numRec) {
      return json({ error: "Error al generar número de recepción: " + (errNum?.message || "respuesta vacía") }, 500);
    }

    const { data: recepcion, error: errRec } = await supabase
      .from("recepciones_orden")
      .insert({
        orden_compra_id: id,
        org_id: perfil.org_id,
        numero_recepcion: numRec,
        resultado,
        observacion: observacion || null,
        registrado_por: perfil.id,
      })
      .select("id")
      .single();
    if (errRec) return json({ error: errRec.message }, 400);

    let algunPendiente = false;

    for (const item of itemsRecibidos) {
      const { producto_id, numero_lote, fecha_vencimiento, cantidad_recibida } = item;
      const itemOC = todosItems.find((i: any) => i.producto_id === producto_id);
      if (!itemOC) continue;

      const pendiente = itemOC.cantidad - (recibidoPrevio[producto_id] || 0);

      // Crear o actualizar lote
      let loteId: string | null = null;
      if (numero_lote && fecha_vencimiento && cantidad_recibida > 0) {
        const { data: loteExistente } = await supabase
          .from("lotes")
          .select("id, cantidad")
          .eq("producto_id", producto_id)
          .eq("numero_lote", numero_lote)
          .eq("ubicacion_tipo", "drogueria")
          .is("ubicacion_id", null)
          .maybeSingle();

        if (loteExistente) {
          const { data: loteUpd } = await supabase
            .from("lotes")
            .update({ cantidad: loteExistente.cantidad + cantidad_recibida })
            .eq("id", loteExistente.id)
            .select("id")
            .single();
          loteId = loteUpd?.id;
        } else {
          const { data: loteNuevo } = await supabase
            .from("lotes")
            .insert({
              producto_id,
              ubicacion_tipo: "drogueria",
              ubicacion_id: null,
              numero_lote,
              fecha_vencimiento,
              cantidad: cantidad_recibida,
              proveedor_id: oc.proveedor_id,
              org_id: perfil.org_id,
            })
            .select("id")
            .single();
          loteId = loteNuevo?.id;
        }
      }

      // Crear recepcion_item
      const { error: errItem } = await supabase
        .from("recepcion_items")
        .insert({
          recepcion_id: recepcion.id,
          producto_id,
          lote_id: loteId,
          cantidad_solicitada: pendiente,
          cantidad_recibida,
          cantidad_devuelta: 0,
        });
      if (errItem) {
        await supabase.from("recepciones_orden").delete().eq("id", recepcion.id);
        return json({ error: errItem.message }, 400);
      }

      // Crear movimiento de entrada
      if (cantidad_recibida > 0) {
        const { error: errMov } = await supabase
          .from("movimientos_inventario")
          .insert({
            producto_id,
            lote_id: loteId,
            ubicacion_tipo: "drogueria",
            ubicacion_id: null,
            tipo_movimiento: "entrada",
            cantidad: cantidad_recibida,
            motivo: `Recepción OC ${id}`,
            usuario_id: perfil.id,
            org_id: perfil.org_id,
          });
        if (errMov) {
          await supabase.from("recepciones_orden").delete().eq("id", recepcion.id);
          return json({ error: errMov.message }, 400);
        }
      }

      // Determinar pendiente
      const nuevoTotal = (recibidoPrevio[producto_id] || 0) + cantidad_recibida;
      if (nuevoTotal < itemOC.cantidad) {
        algunPendiente = true;
      }
    }

    // Derivar estado de la OC
    let nuevoEstado: string;
    if (resultado === "recibida_con_observacion") {
      nuevoEstado = "recibida_con_observacion";
    } else if (algunPendiente) {
      nuevoEstado = "recibida_parcial";
    } else {
      nuevoEstado = "recibida";
    }

    await actualizarEstadoOC(supabase, id, nuevoEstado, perfil.id);

    return json({ exito: true, recepcion_id: recepcion.id, numero_recepcion: numRec });
  } catch (e) {
    console.error("Error en registrarRecepcion:", e);
    const mensaje = e instanceof Error ? e.message : String(e);
    return json({ error: mensaje }, 500);
  }
}

// ─── PENDIENTES ────────────────────────────────────────────────
async function obtenerPendientes(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data: oc } = await supabase
    .from("ordenes_compra")
    .select(`
      id,
      ordenes_compra_items(producto_id, cantidad, precio_unitario, productos(id, nombre_comercial))
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (!oc) return json({ error: "Orden no encontrada" }, 404);

  const { data: allReceptions } = await supabase
    .from("recepciones_orden")
    .select("id, resultado")
    .eq("orden_compra_id", id);
  const ids = (allReceptions || [])
    .filter(r => r.resultado !== "en_devolucion")
    .map(r => r.id);

  let recibos = [];
  if (ids.length > 0) {
    const { data: r } = await supabase
      .from("recepcion_items")
      .select("producto_id, cantidad_recibida, cantidad_devuelta")
      .in("recepcion_id", ids);
    recibos = r || [];
  }

  const recibidoPorProd: Record<string, number> = {};
  for (const r of recibos || []) {
    recibidoPorProd[r.producto_id] = (recibidoPorProd[r.producto_id] || 0) + r.cantidad_recibida;
  }

  const pendientes = (oc.ordenes_compra_items || [])
    .map((i: any) => {
      const recibido = recibidoPorProd[i.producto_id] || 0;
      const pendiente = Math.max(i.cantidad - recibido, 0);
      return {
        producto_id: i.producto_id,
        productoNombre: i.productos?.nombre_comercial || "",
        cantidad_solicitada: i.cantidad,
        cantidad_recibida: recibido,
        cantidad_pendiente: pendiente,
        precio_unitario: i.precio_unitario,
      };
    })
    .filter((i: any) => i.cantidad_pendiente > 0);

  return json({ datos: pendientes });
}

// ─── HELPERS ──────────────────────────────────────────────────
function puedeTransicionar(estadoActual: string, estadoDestino: string): boolean {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual];
  return permitidos?.includes(estadoDestino) ?? false;
}

async function actualizarEstadoOC(supabase: any, id: string, estado: string, usuarioId: string) {
  const updates: Record<string, unknown> = { estado };
  if (["recibida", "recibida_parcial", "recibida_con_observacion"].includes(estado)) {
    updates.fecha_real_entrega = new Date().toISOString().split("T")[0];
  }
  await supabase.from("ordenes_compra").update(updates).eq("id", id);
}

async function incrementarStockPorRecibir(supabase: any, orgId: string, ordenCompraId: string) {
  const { data: items } = await supabase
    .from("ordenes_compra_items")
    .select("producto_id, cantidad")
    .eq("orden_compra_id", ordenCompraId);

  for (const item of items || []) {
    const { data: existente } = await supabase
      .from("stock_ubicaciones")
      .select("id, stock_por_recibir")
      .eq("producto_id", item.producto_id)
      .eq("ubicacion_tipo", "drogueria")
      .is("ubicacion_id", null)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase
        .from("stock_ubicaciones")
        .update({ stock_por_recibir: existente.stock_por_recibir + item.cantidad })
        .eq("id", existente.id);
      if (error) return { error };
    } else {
      const { error } = await supabase
        .from("stock_ubicaciones")
        .insert({
          producto_id: item.producto_id,
          ubicacion_tipo: "drogueria",
          ubicacion_id: null,
          org_id: orgId,
          cantidad_disponible: 0,
          stock_por_recibir: item.cantidad,
          stock_en_transito: 0,
          stock_minimo: 0,
        });
      if (error) return { error };
    }
  }
  return { error: null };
}

async function revertirStockPorRecibir(supabase: any, orgId: string, ordenCompraId: string) {
  const { data: allRecs } = await supabase
    .from("recepciones_orden")
    .select("id, resultado")
    .eq("orden_compra_id", ordenCompraId);
  const idsPrevios = (allRecs || [])
    .filter(r => r.resultado !== "en_devolucion")
    .map(r => r.id);

  let recibidoPorProducto: Record<string, number> = {};
  if (idsPrevios.length > 0) {
    const { data: recItems } = await supabase
      .from("recepcion_items")
      .select("producto_id, cantidad_recibida")
      .in("recepcion_id", idsPrevios);
    for (const ri of recItems || []) {
      recibidoPorProducto[ri.producto_id] = (recibidoPorProducto[ri.producto_id] || 0) + ri.cantidad_recibida;
    }
  }

  const { data: items } = await supabase
    .from("ordenes_compra_items")
    .select("producto_id, cantidad")
    .eq("orden_compra_id", ordenCompraId);

  for (const item of items || []) {
    const recibido = recibidoPorProducto[item.producto_id] || 0;
    const pendiente = Math.max(item.cantidad - recibido, 0);
    if (pendiente === 0) continue;

    const { data: existente } = await supabase
      .from("stock_ubicaciones")
      .select("id, stock_por_recibir")
      .eq("producto_id", item.producto_id)
      .eq("ubicacion_tipo", "drogueria")
      .is("ubicacion_id", null)
      .maybeSingle();

    if (existente) {
      await supabase
        .from("stock_ubicaciones")
        .update({ stock_por_recibir: Math.max(existente.stock_por_recibir - pendiente, 0) })
        .eq("id", existente.id);
    }
  }
}

// ─── LISTAR RECEPCIONES ─────────────────────────────────────
async function listarRecepciones(supabase: any, perfil: PerfilUsuario, url: URL) {
  if (perfil.rol === "visor_botica") {
    return json({ error: "No tienes permisos para ver recepciones" }, 403);
  }

  const proveedorId = url.searchParams.get("proveedor_id");
  const ordenCompraId = url.searchParams.get("orden_compra_id");
  const resultado = url.searchParams.get("resultado");
  const registradoPor = url.searchParams.get("registrado_por");
  const fechaDesde = url.searchParams.get("fecha_desde");
  const fechaHasta = url.searchParams.get("fecha_hasta");

  let query = supabase
    .from("recepciones_orden")
    .select(`
      *,
      ordenes_compra!inner(
        id,
        numero_orden,
        proveedor_id,
        proveedores!inner(id, razon_social, org_id),
        estado
      ),
      usuarios!recepciones_orden_registrado_por_fkey(id, nombre, email),
      recepcion_items(
        id,
        cantidad_solicitada,
        cantidad_recibida,
        cantidad_devuelta,
        productos(id, nombre_comercial),
        lotes(id, numero_lote, fecha_vencimiento)
      )
    `)
    .order("fecha_recepcion", { ascending: false });

  if (proveedorId) {
    query = query.eq("ordenes_compra.proveedor_id", proveedorId);
  }
  if (ordenCompraId) {
    query = query.eq("orden_compra_id", ordenCompraId);
  }
  if (resultado) {
    query = query.eq("resultado", resultado);
  }
  if (registradoPor) {
    query = query.eq("registrado_por", registradoPor);
  }
  if (fechaDesde) {
    query = query.gte("fecha_recepcion", fechaDesde);
  }
  if (fechaHasta) {
    query = query.lte("fecha_recepcion", fechaHasta);
  }

  const { data, error } = await query;

  if (error) return json({ error: error.message }, 400);

  const datosFiltrados = (data || []).filter((r: any) =>
    r.ordenes_compra?.proveedores?.org_id === perfil.org_id
  );

  const normalizados = datosFiltrados.map((r: any) => ({
    id: r.id,
    numeroRecepcion: r.numero_recepcion,
    ordenCompraId: r.orden_compra_id,
    ordenNumero: r.ordenes_compra?.numero_orden,
    proveedorId: r.ordenes_compra?.proveedor_id,
    proveedorNombre: r.ordenes_compra?.proveedores?.razon_social,
    ocEstado: r.ordenes_compra?.estado,
    fechaRecepcion: r.fecha_recepcion,
    registradoPor: r.registrado_por,
    registradoPorNombre: r.usuarios?.nombre,
    observacion: r.observacion,
    resultado: r.resultado,
    motivoRechazo: r.motivo_rechazo,
    totalProductos: r.recepcion_items?.length || 0,
    totalRecibido: (r.recepcion_items || []).reduce((sum: number, ri: any) => sum + (ri.cantidad_recibida || 0), 0),
    items: (r.recepcion_items || []).map((ri: any) => ({
      id: ri.id,
      productoId: ri.producto_id,
      productoNombre: ri.productos?.nombre_comercial || "",
      cantidadSolicitada: ri.cantidad_solicitada,
      cantidadRecibida: ri.cantidad_recibida,
      cantidadDevuelta: ri.cantidad_devuelta,
      loteId: ri.lote_id,
      numeroLote: ri.lotes?.numero_lote || "",
      fechaVencimiento: ri.lotes?.fecha_vencimiento || "",
    })),
  }));

  return json({ datos: normalizados });
}

function normalizarOC(r: any) {
  const moneda = r.proveedores?.monedas;
  return {
    id: r.id,
    numeroOrden: r.numero_orden,
    proveedorId: r.proveedor_id,
    proveedorNombre: r.proveedores?.razon_social,
    moneda: moneda ? { id: moneda.id, codigo: moneda.codigo, simbolo: moneda.simbolo } : null,
    estado: r.estado,
    creadoPor: r.creado_por,
    fechaEstimadaEntrega: r.fecha_estimada_entrega,
    fechaRealEntrega: r.fecha_real_entrega,
    observaciones: r.observaciones,
    aprobadoPor: r.aprobado_por,
    fechaAprobacion: r.fecha_aprobacion,
    createdAt: r.created_at,
    rechazadoPor: r.rechazado_por,
    fechaRechazo: r.fecha_rechazo,
    motivoRechazo: r.motivo_rechazo,
    canceladoPor: r.cancelado_por,
    fechaCancelacion: r.fecha_cancelacion,
    motivoCancelacion: r.motivo_cancelacion,
    items: (r.ordenes_compra_items || []).map((i: any) => ({
      id: i.id,
      productoId: i.producto_id,
      productoNombre: i.productos?.nombre_comercial || "",
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
    })),
    recepciones: (r.recepciones_orden || []).map((rec: any) => ({
      id: rec.id,
      fechaRecepcion: rec.fecha_recepcion,
      observacion: rec.observacion,
      registradoPor: rec.registrado_por,
      items: (rec.recepcion_items || []).map((ri: any) => ({
        id: ri.id,
        productoId: ri.producto_id,
        productoNombre: ri.productos?.nombre_comercial || "",
        loteId: ri.lote_id,
        numeroLote: ri.lotes?.numero_lote || "",
        fechaVencimiento: ri.lotes?.fecha_vencimiento || "",
        cantidadSolicitada: ri.cantidad_solicitada,
        cantidadRecibida: ri.cantidad_recibida,
        cantidadDevuelta: ri.cantidad_devuelta,
      })),
    })),
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
