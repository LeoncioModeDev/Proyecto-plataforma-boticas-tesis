import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ESTADOS_PERMITIDOS_ADMIN = ["creada", "en_transito", "recibida", "rechazada", "cancelada"];

Deno.serve(async (req) => {
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
    .select("id, org_id, rol, email, nombre, activo, botica_id, drogueria_id")
    .eq("id", user.id)
    .maybeSingle();

  if (perfilError) {
    return json({ error: `Error al consultar perfil: ${perfilError.message}`, detalle: perfilError }, 500);
  }

  if (!perfil) {
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
        if (id) return obtenerTransferencia(supabase, perfil, id);
        return listarTransferencias(supabase, perfil, url);

      case "POST":
        return crearTransferencia(supabase, perfil, await req.json());

      case "PUT":
        if (!id) return json({ error: "ID de transferencia requerido" }, 400);
        const body = await req.json().catch(() => ({}));

        if (accion === "enviar") return enviarTransferencia(supabase, perfil, id);
        if (accion === "cancelar") return cancelarTransferencia(supabase, perfil, id, body);
        if (accion === "recibir") return recibirTransferencia(supabase, perfil, id);
        if (accion === "rechazar") return rechazarTransferencia(supabase, perfil, id, body);
        if (accion === "confirmar-devolucion") return confirmarDevolucionOrigen(supabase, perfil, id);

        return json({ error: "Acción no válida" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en transferencias:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

// ─── LISTAR ───────────────────────────────────────────────────
async function listarTransferencias(supabase, perfil, url) {
  const estado = url.searchParams.get("estado") || null;
  const esVisor = perfil.rol === "visor_botica";

  let query = supabase
    .from("transferencias")
    .select(`
      *,
      origen:origen_id (id, nombre),
      destino:destino_id (id, nombre),
      transferencias_items (
        id,
        producto_id,
        lote_id,
        cantidad,
        producto:producto_id (id, nombre_comercial),
        lote:lote_id (id, numero_lote, fecha_vencimiento)
      )
    `)
    .order("created_at", { ascending: false });

  if (esVisor) {
    query = query.eq("destino_id", perfil.botica_id);
  } else {
    query = query.eq("org_id", perfil.org_id);
  }

  if (estado) {
    query = query.eq("estado", estado);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 400);
  return json({ datos: data });
}

// ─── OBTENER ──────────────────────────────────────────────────
async function obtenerTransferencia(supabase, perfil, id) {
  const esVisor = perfil.rol === "visor_botica";

  let query = supabase
    .from("transferencias")
    .select(`
      *,
      origen:origen_id (id, nombre),
      destino:destino_id (id, nombre),
      transferencias_items (
        id,
        producto_id,
        lote_id,
        cantidad,
        producto:producto_id (id, nombre_comercial),
        lote:lote_id (id, numero_lote, fecha_vencimiento)
      )
    `)
    .eq("id", id);

  if (esVisor) {
    query = query.eq("destino_id", perfil.botica_id);
  } else {
    query = query.eq("org_id", perfil.org_id);
  }

  const { data, error } = await query.single();
  if (error) return json({ error: "Transferencia no encontrada" }, 404);
  return json({ datos: data });
}

// ─── CREAR ────────────────────────────────────────────────────
async function crearTransferencia(supabase, perfil, body) {
  if (!["admin_central", "operador_drogueria"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para crear transferencias" }, 403);
  }

  const { tipo_transferencia, destino_id, origen_id, observaciones, items } = body;
  if (!destino_id) return json({ error: "La botica destino es obligatoria" }, 400);
  if (!items || !items.length) return json({ error: "Debe incluir al menos un producto" }, 400);

  const esRedistribucion = tipo_transferencia === "redistribucion";

  if (esRedistribucion) {
    // ─── VALIDAR REDISTRIBUCIÓN (botica → botica) ───────────
    if (!origen_id) return json({ error: "La botica origen es obligatoria para redistribución" }, 400);
    if (origen_id === destino_id) return json({ error: "El origen y destino no pueden ser la misma botica" }, 400);

    // Validar botica origen
    const { data: boticaOrigen, error: errOrigen } = await supabase
      .from("boticas")
      .select("id, org_id, activa, tipo")
      .eq("id", origen_id)
      .single();

    if (errOrigen || !boticaOrigen) return json({ error: "La botica origen no existe" }, 400);
    if (boticaOrigen.org_id !== perfil.org_id) return json({ error: "La botica origen no pertenece a tu organización" }, 400);
    if (!boticaOrigen.activa) return json({ error: "La botica origen está inactiva" }, 400);
    if (boticaOrigen.tipo !== "botica") return json({ error: "El origen no es una botica" }, 400);

    // Validar botica destino
    const { data: boticaDestino, error: errDestino } = await supabase
      .from("boticas")
      .select("id, org_id, activa, tipo")
      .eq("id", destino_id)
      .single();

    if (errDestino || !boticaDestino) return json({ error: "La botica destino no existe" }, 400);
    if (boticaDestino.org_id !== perfil.org_id) return json({ error: "La botica destino no pertenece a tu organización" }, 400);
    if (!boticaDestino.activa) return json({ error: "La botica destino está inactiva" }, 400);
    if (boticaDestino.tipo !== "botica") return json({ error: "El destino no es una botica" }, 400);

    // Validar items para redistribución
    const idsProductos = items.map((item: any) => item.producto_id);
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
          error: `No se pueden redistribuir productos inactivos o descontinuados. IDs: ${inactivos.join(", ")}`,
        }, 400);
      }
    }

    for (const item of items) {
      if (!item.producto_id) return json({ error: "Cada item debe tener un producto" }, 400);
      if (!item.lote_id) return json({ error: "Cada item debe tener un lote" }, 400);
      if (!item.cantidad || item.cantidad <= 0) return json({ error: "La cantidad debe ser mayor a 0" }, 400);
      if (!Number.isInteger(item.cantidad)) return json({ error: "La cantidad debe ser un número entero" }, 400);

      // Validar lote existe, pertenece a la org, está en la botica origen, tiene stock
      const { data: lote, error: errLote } = await supabase
        .from("lotes")
        .select("id, producto_id, ubicacion_id, cantidad, org_id")
        .eq("id", item.lote_id)
        .single();

      if (errLote || !lote) return json({ error: `Lote ${item.lote_id} no encontrado` }, 400);
      if (lote.org_id !== perfil.org_id) return json({ error: `El lote no pertenece a tu organización` }, 400);
      if (lote.ubicacion_id !== origen_id) return json({ error: `El lote debe estar en la botica origen` }, 400);
      if (lote.producto_id !== item.producto_id) return json({ error: `El producto no coincide con el lote seleccionado` }, 400);
      if (lote.cantidad <= 0) return json({ error: `El lote ${item.lote_id} no tiene stock disponible` }, 400);
      if (item.cantidad > lote.cantidad) {
        return json({ error: `La cantidad solicitada (${item.cantidad}) supera la disponible (${lote.cantidad}) en el lote` }, 400);
      }
    }

    const { data: trfNum, error: errTrf } = await supabase.rpc("generar_numero_transferencia", {
      p_org_id: perfil.org_id,
    });
    if (errTrf || !trfNum) {
      return json({ error: "Error al generar número de transferencia: " + (errTrf?.message || "respuesta vacía") }, 500);
    }

    // Insertar cabecera de redistribución
    const { data: transferencia, error: errIns } = await supabase
      .from("transferencias")
      .insert({
        tipo_transferencia: "redistribucion",
        numero_transferencia: trfNum,
        origen_tipo: "botica",
        origen_id,
        destino_tipo: "botica",
        destino_id,
        estado: "creada",
        creado_por: perfil.id,
        observaciones: observaciones || null,
        org_id: perfil.org_id,
      })
      .select("id")
      .single();

    if (errIns) return json({ error: errIns.message }, 400);

    const itemsInsert = items.map((item) => ({
      transferencia_id: transferencia.id,
      producto_id: item.producto_id,
      lote_id: item.lote_id,
      cantidad: item.cantidad,
      org_id: perfil.org_id,
    }));

    const { error: errItems } = await supabase
      .from("transferencias_items")
      .insert(itemsInsert);

    if (errItems) return json({ error: errItems.message }, 400);

    await supabase.from("auditoria").insert({
      org_id: perfil.org_id,
      usuario_id: perfil.id,
      accion: "CREAR_REDISTRIBUCION",
      entidad: "transferencias",
      entidad_id: transferencia.id,
      nivel: "info",
      detalle: `Se creó redistribución de botica ${origen_id} a botica ${destino_id} con ${items.length} producto(s)`,
    });

    return json({ exito: true, id: transferencia.id, numero_transferencia: trfNum });
  }

  // ─── TRANSFERENCIA CENTRAL (droguería → botica) ─────────
  const { data: drogueria, error: errDrogueria } = await supabase
    .from("boticas")
    .select("id")
    .eq("org_id", perfil.org_id)
    .eq("tipo", "drogueria")
    .maybeSingle();

  if (errDrogueria || !drogueria) {
    return json({ error: "No existe una droguería central en tu organización" }, 400);
  }

  const { data: botica, error: errBotica } = await supabase
    .from("boticas")
    .select("id, org_id, activa")
    .eq("id", destino_id)
    .single();

  if (errBotica || !botica) return json({ error: "La botica destino no existe" }, 400);
  if (botica.org_id !== perfil.org_id) return json({ error: "La botica destino no pertenece a tu organización" }, 400);
  if (!botica.activa) return json({ error: "La botica destino está inactiva" }, 400);
  if (botica.id === drogueria.id) return json({ error: "El origen y destino no pueden ser la misma ubicación" }, 400);

  const idsProductos = items.map((item: any) => item.producto_id);
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
        error: `No se pueden transferir productos inactivos o descontinuados. IDs: ${inactivos.join(", ")}`,
      }, 400);
    }
  }

  for (const item of items) {
    if (!item.producto_id) return json({ error: "Cada item debe tener un producto" }, 400);
    if (!item.lote_id) return json({ error: "Cada item debe tener un lote" }, 400);
    if (!item.cantidad || item.cantidad <= 0) return json({ error: "La cantidad debe ser mayor a 0" }, 400);
    if (!Number.isInteger(item.cantidad)) return json({ error: "La cantidad debe ser un número entero" }, 400);

    const { data: lote, error: errLote } = await supabase
      .from("lotes")
      .select("id, producto_id, ubicacion_id, cantidad, org_id")
      .eq("id", item.lote_id)
      .single();

    if (errLote || !lote) return json({ error: `Lote ${item.lote_id} no encontrado` }, 400);
    if (lote.org_id !== perfil.org_id) return json({ error: `El lote no pertenece a tu organización` }, 400);
    if (lote.ubicacion_id !== null) return json({ error: `El lote debe estar en la droguería central` }, 400);
    if (lote.producto_id !== item.producto_id) return json({ error: `El producto no coincide con el lote seleccionado` }, 400);
    if (item.cantidad > lote.cantidad) {
      return json({ error: `La cantidad solicitada (${item.cantidad}) supera la disponible (${lote.cantidad}) en el lote` }, 400);
    }
  }

  const { data: trfNum, error: errTrf } = await supabase.rpc("generar_numero_transferencia", {
    p_org_id: perfil.org_id,
  });
  if (errTrf || !trfNum) {
    return json({ error: "Error al generar número de transferencia: " + (errTrf?.message || "respuesta vacía") }, 500);
  }

  const { data: transferencia, error: errIns } = await supabase
    .from("transferencias")
    .insert({
      tipo_transferencia: "transferencia_central",
      numero_transferencia: trfNum,
      origen_tipo: "drogueria",
      origen_id: drogueria.id,
      destino_tipo: "botica",
      destino_id,
      estado: "creada",
      creado_por: perfil.id,
      observaciones: observaciones || null,
      org_id: perfil.org_id,
    })
    .select("id")
    .single();

  if (errIns) return json({ error: errIns.message }, 400);

  const itemsInsert = items.map((item) => ({
    transferencia_id: transferencia.id,
    producto_id: item.producto_id,
    lote_id: item.lote_id,
    cantidad: item.cantidad,
    org_id: perfil.org_id,
  }));

  const { error: errItems } = await supabase
    .from("transferencias_items")
    .insert(itemsInsert);

  if (errItems) return json({ error: errItems.message }, 400);

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "CREAR_TRANSFERENCIA",
    entidad: "transferencias",
    entidad_id: transferencia.id,
    nivel: "info",
    detalle: `Se creó transferencia a botica ${destino_id} con ${items.length} producto(s)`,
  });

  return json({ exito: true, id: transferencia.id, numero_transferencia: trfNum });
}

// ─── ENVIAR ───────────────────────────────────────────────────
async function enviarTransferencia(supabase, perfil, id) {
  if (!["admin_central", "operador_drogueria"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para enviar transferencias" }, 403);
  }

  // Validar que la transferencia existe y pertenece a la org
  const { data: t, error: errGet } = await supabase
    .from("transferencias")
    .select("id, estado, org_id, tipo_transferencia")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !t) return json({ error: "Transferencia no encontrada" }, 404);
  if (t.estado !== "creada") {
    return json({ error: `Estado inválido: "${t.estado}". Solo se pueden enviar transferencias en estado "creada"` }, 400);
  }

  const rpc = t.tipo_transferencia === "redistribucion"
    ? "enviar_redistribucion"
    : "enviar_transferencia";

  const { data, error: errRpc } = await supabase
    .rpc(rpc, {
      p_transferencia_id: id,
      p_usuario_id: perfil.id,
    });

  if (errRpc) {
    return json({ error: `Error al enviar transferencia: ${errRpc.message}` }, 400);
  }

  return json({ exito: true, estado: "en_transito" });
}

// ─── CANCELAR ─────────────────────────────────────────────────
async function cancelarTransferencia(supabase, perfil, id, body) {
  if (!["admin_central", "operador_drogueria"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para cancelar transferencias" }, 403);
  }

  const { data: t, error: errGet } = await supabase
    .from("transferencias")
    .select("id, estado")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !t) return json({ error: "Transferencia no encontrada" }, 404);
  if (t.estado !== "creada") return json({ error: "Solo se pueden cancelar transferencias en estado 'creada'" }, 400);

  const { error: errUpd } = await supabase
    .from("transferencias")
    .update({
      estado: "cancelada",
      observaciones: body.motivo
        ? `Cancelada: ${body.motivo}`
        : "Cancelada por el usuario",
    })
    .eq("id", id);

  if (errUpd) return json({ error: errUpd.message }, 400);

  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "CANCELAR_TRANSFERENCIA",
    entidad: "transferencias",
    entidad_id: id,
    nivel: "advertencia",
    detalle: `Se canceló la transferencia. Motivo: ${body.motivo || "No especificado"}`,
  });

  return json({ exito: true, estado: "cancelada" });
}

// ─── RECIBIR ──────────────────────────────────────────────────
async function recibirTransferencia(supabase, perfil, id) {
  const esVisor = perfil.rol === "visor_botica";
  const esAdmin = ["admin_central", "operador_drogueria"].includes(perfil.rol);
  if (!esVisor && !esAdmin) {
    return json({ error: "No tienes permisos para confirmar recepción" }, 403);
  }

  // Validar que la transferencia existe y está en tránsito
  let query = supabase
    .from("transferencias")
    .select("id, estado")
    .eq("id", id);

  if (esAdmin) {
    query = query.eq("org_id", perfil.org_id);
  } else if (esVisor) {
    query = query.eq("destino_id", perfil.botica_id);
  }

  const { data: t, error: errGet } = await query.single();
  if (errGet || !t) return json({ error: "Transferencia no encontrada" }, 404);
  if (t.estado !== "en_transito") {
    return json({ error: `Estado inválido: "${t.estado}". Solo se pueden recibir transferencias en estado "en_transito"` }, 400);
  }

  // RPC transaccional: ejecuta todo en una sola transacción
  const { data, error: errRpc } = await supabase
    .rpc("recibir_transferencia", {
      p_transferencia_id: id,
      p_usuario_id: perfil.id,
    });

  if (errRpc) {
    return json({ error: `Error al recibir transferencia: ${errRpc.message}` }, 400);
  }

  return json({ exito: true, estado: "recibida" });
}

// ─── CONFIRMAR DEVOLUCIÓN A ORIGEN ────────────────────────────
async function confirmarDevolucionOrigen(supabase, perfil, id) {
  if (!["admin_central", "operador_drogueria"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para confirmar devoluciones" }, 403);
  }

  const { data: t, error: errGet } = await supabase
    .from("transferencias")
    .select("id, estado")
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errGet || !t) return json({ error: "Transferencia no encontrada" }, 404);
  if (t.estado !== "pendiente_devolucion") {
    return json({ error: `Estado inválido: "${t.estado}". Solo se puede confirmar devolución en estado "pendiente_devolucion"` }, 400);
  }

  const { data, error: errRpc } = await supabase
    .rpc("confirmar_devolucion_origen", {
      p_transferencia_id: id,
      p_usuario_id: perfil.id,
    });

  if (errRpc) {
    return json({ error: `Error al confirmar devolución: ${errRpc.message}` }, 400);
  }

  return json({ exito: true, estado: "devuelta_a_origen" });
}

// ─── RECHAZAR ─────────────────────────────────────────────────
async function rechazarTransferencia(supabase, perfil, id, body) {
  const esVisor = perfil.rol === "visor_botica";
  const esAdmin = ["admin_central", "operador_drogueria"].includes(perfil.rol);
  if (!esVisor && !esAdmin) {
    return json({ error: "No tienes permisos para rechazar transferencias" }, 403);
  }

  if (!body.motivo_rechazo || !body.motivo_rechazo.trim()) {
    return json({ error: "Debe proporcionar un motivo de rechazo" }, 400);
  }

  // Validar acceso según rol
  let query = supabase
    .from("transferencias")
    .select("id, estado")
    .eq("id", id);

  if (esAdmin) {
    query = query.eq("org_id", perfil.org_id);
  } else if (esVisor) {
    query = query.eq("destino_id", perfil.botica_id);
  }

  const { data: t, error: errGet } = await query.single();
  if (errGet || !t) return json({ error: "Transferencia no encontrada" }, 404);
  if (t.estado !== "en_transito") {
    return json({ error: `Estado inválido: "${t.estado}". Solo se pueden rechazar transferencias en estado "en_transito"` }, 400);
  }

  // RPC transaccional: descuenta stock_en_transito, actualiza estado, registra auditoría
  const { data, error: errRpc } = await supabase
    .rpc("rechazar_transferencia", {
      p_transferencia_id: id,
      p_usuario_id: perfil.id,
      p_motivo: body.motivo_rechazo,
    });

  if (errRpc) {
    return json({ error: `Error al rechazar transferencia: ${errRpc.message}` }, 400);
  }

  return json({ exito: true, estado: "rechazada" });
}

// ─── HELPERS ──────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
