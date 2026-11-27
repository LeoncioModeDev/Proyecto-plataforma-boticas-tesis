const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MAX_ENTERO_SQL = 2147483647;

function esUmbral(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0 && valor <= MAX_ENTERO_SQL;
}

export async function actualizarStockConfig(
  supabase: any,
  perfil: { id: string; org_id: string; rol: string },
  productoId: string,
  req: Request,
  json: (datos: unknown, estado?: number) => Response,
) {
  if (perfil.rol !== "admin_central" || !perfil.org_id) {
    return json({ error: "Solo un admin central con organización puede configurar el stock" }, 403);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Se requiere un objeto JSON válido" }, 400);
  }

  const { ubicacion_tipo, ubicacion_id = null, stock_minimo, stock_maximo } = body;
  if (!UUID.test(productoId)) return json({ error: "ID de producto inválido" }, 400);

  if (ubicacion_tipo !== "drogueria" && ubicacion_tipo !== "botica") {
    return json({ error: "ubicacion_tipo debe ser drogueria o botica" }, 400);
  }
  if (ubicacion_tipo === "drogueria" && ubicacion_id !== null) {
    return json({ error: "ubicacion_id debe ser nulo para droguería" }, 400);
  }
  if (ubicacion_tipo === "botica" && (typeof ubicacion_id !== "string" || !UUID.test(ubicacion_id))) {
    return json({ error: "Se requiere un ubicacion_id válido para botica" }, 400);
  }
  if (stock_minimo === undefined && stock_maximo === undefined) {
    return json({ error: "Debe enviar al menos un umbral de stock" }, 400);
  }
  if (stock_minimo !== undefined && !esUmbral(stock_minimo)) {
    return json({ error: `stock_minimo debe ser un entero entre 0 y ${MAX_ENTERO_SQL}` }, 400);
  }
  if (stock_maximo !== undefined && stock_maximo !== null && !esUmbral(stock_maximo)) {
    return json({ error: `stock_maximo debe ser nulo o un entero entre 0 y ${MAX_ENTERO_SQL}` }, 400);
  }

  const orgId = perfil.org_id;
  const { data: producto, error: errorProducto } = await supabase.from("productos")
    .select("id").eq("org_id", orgId).eq("id", productoId).maybeSingle();
  if (errorProducto) throw errorProducto;
  if (!producto) return json({ error: "Producto no encontrado en tu organización" }, 404);

  if (ubicacion_tipo === "botica") {
    const { data: botica, error: errorBotica } = await supabase.from("boticas")
      .select("id").eq("org_id", orgId).eq("id", ubicacion_id).maybeSingle();
    if (errorBotica) throw errorBotica;
    if (!botica) return json({ error: "Botica no encontrada en tu organización" }, 404);
  }

  const consulta = supabase.from("stock_ubicaciones").select("id, stock_minimo, stock_maximo")
    .eq("org_id", orgId).eq("producto_id", productoId).eq("ubicacion_tipo", ubicacion_tipo);
  const { data: existente, error: errorConsulta } = await (ubicacion_id === null
    ? consulta.is("ubicacion_id", null)
    : consulta.eq("ubicacion_id", ubicacion_id)).maybeSingle();
  if (errorConsulta) throw errorConsulta;

  if (!existente && (stock_minimo === undefined || stock_maximo === undefined)) {
    return json({ error: "Para crear la configuración debe enviar stock_minimo y stock_maximo" }, 400);
  }

  const minimo = stock_minimo === undefined ? existente.stock_minimo : stock_minimo;
  const maximo = stock_maximo === undefined ? existente.stock_maximo : stock_maximo;
  if (maximo !== null && maximo < minimo) {
    return json({ error: "stock_maximo debe ser mayor o igual a stock_minimo" }, 400);
  }

  let id: string;
  let valoresAnteriores;
  let valoresNuevos;
  if (existente) {
    valoresAnteriores = { stock_minimo: existente.stock_minimo, stock_maximo: existente.stock_maximo };
    const cambios = {
      ...(stock_minimo !== undefined && { stock_minimo }),
      ...(stock_maximo !== undefined && { stock_maximo }),
      modified_at: new Date().toISOString(),
      modified_by: perfil.id,
    };
    // Evita aplicar el PATCH sobre umbrales distintos de los que se validaron y se auditan.
    let actualizacion = supabase.from("stock_ubicaciones").update(cambios)
      .eq("org_id", orgId).eq("id", existente.id).eq("producto_id", productoId)
      .eq("ubicacion_tipo", ubicacion_tipo).eq("stock_minimo", existente.stock_minimo);
    actualizacion = ubicacion_id === null
      ? actualizacion.is("ubicacion_id", null)
      : actualizacion.eq("ubicacion_id", ubicacion_id);
    actualizacion = existente.stock_maximo === null
      ? actualizacion.is("stock_maximo", null)
      : actualizacion.eq("stock_maximo", existente.stock_maximo);

    const { data: actualizado, error } = await actualizacion.select("id, modified_at").maybeSingle();
    if (error) throw error;
    if (!actualizado) return json({ error: "La configuración cambió. Recarga el registro e inténtalo de nuevo." }, 409);
    id = actualizado.id;
    valoresNuevos = { ...cambios, modified_at: actualizado.modified_at };
  } else {
    valoresNuevos = { ubicacion_tipo, ubicacion_id, stock_minimo: minimo, stock_maximo: maximo };
    const { data: nuevo, error } = await supabase.from("stock_ubicaciones").insert({
      ...valoresNuevos,
      org_id: orgId,
      producto_id: productoId,
      stock_fisico: 0,
      stock_por_recibir: 0,
      stock_en_transito: 0,
      created_by: perfil.id,
      modified_by: perfil.id,
    }).select("id").single();
    if (error?.code === "23505") return json({ error: "La configuración ya existe. Recarga el registro." }, 409);
    if (error) throw error;
    id = nuevo.id;
  }

  const { error: errorAuditoria } = await supabase.from("auditoria").insert({
    org_id: orgId,
    usuario_id: perfil.id,
    accion: "CONFIGURAR_STOCK",
    entidad: "stock_ubicaciones",
    entidad_id: id,
    nivel: "info",
    detalle: `Configuración de stock mínimo/máximo ${existente ? "actualizada" : "creada"}`,
    metadata_jsonb: {
      producto_id: productoId,
      ...(existente && { valores_anteriores: valoresAnteriores }),
      valores_nuevos: valoresNuevos,
    },
  });
  if (errorAuditoria) console.error("No se pudo auditar CONFIGURAR_STOCK:", id, errorAuditoria);
  return json({ exito: true, id });
}
