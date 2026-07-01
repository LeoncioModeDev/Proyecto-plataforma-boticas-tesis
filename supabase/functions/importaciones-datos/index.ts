import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "importaciones-datos";

const TIPOS_VALIDOS = [
  "categorias_terapeuticas", "boticas", "productos", "proveedores", "usuarios",
  "proveedor_producto", "precios", "stock_inicial", "stock_historico", "ventas_historicas",
];

const CONCURRENCIA = 10;
const TAMANO_LOTE_IMPORTACION = 500;
const INTERVALO_PROGRESO = 1000;

const cacheProductos = new Map<string, string>();
const cacheBoticas = new Map<string, { id: string; tipo: string }>();
const cacheProveedores = new Map<string, string>();

async function poblarCache(supabase: any, orgId: string) {
  cacheProductos.clear();
  cacheBoticas.clear();
  cacheProveedores.clear();

  const { data: productos } = await supabase
    .from("productos")
    .select("id, codigo_interno")
    .eq("org_id", orgId);
  if (productos) {
    for (const p of productos) cacheProductos.set(p.codigo_interno, p.id);
  }

  const { data: boticas } = await supabase
    .from("boticas")
    .select("id, codigo_interno, tipo")
    .eq("org_id", orgId);
  if (boticas) {
    for (const b of boticas) cacheBoticas.set(b.codigo_interno, { id: b.id, tipo: b.tipo });
  }

  const { data: proveedores } = await supabase
    .from("proveedores")
    .select("id, codigo_interno")
    .eq("org_id", orgId);
  if (proveedores) {
    for (const p of proveedores) cacheProveedores.set(p.codigo_interno, p.id);
  }
}

const batchVentas: Record<string, any[]> = {};

const ESTADOS = ["validando", "listo_para_importar", "procesando", "completada", "completada_con_errores", "fallida"] as const;

// ============================================================
// Configuración por tipo de importación
// ============================================================

interface Columna {
  nombre: string;
  requerida: boolean;
  descripcion: string;
  ejemplo: string;
}

interface TipoConfig {
  columnas: Columna[];
  validarFila: (fila: Record<string, string>, supabase: any, orgId: string) => Promise<FilaValidada>;
  importarFila: (item: ItemValido, supabase: any, orgId: string, usuarioId: string, importacionId: string) => Promise<void>;
}

interface FilaValidada {
  valida: boolean;
  item?: ItemValido;
  errores?: ErrorFila[];
}

interface ItemValido {
  fila: number;
  [key: string]: unknown;
}

interface ErrorFila {
  fila: number;
  columna?: string;
  valor?: string;
  mensaje: string;
}

interface PerfilUsuario {
  id: string;
  org_id: string;
  rol: string;
  activo: boolean;
}

// ============================================================
// Config de cada tipo
// ============================================================

const CONFIG: Record<string, TipoConfig> = {
  categorias_terapeuticas: {
    columnas: [
      { nombre: "codigo", requerida: true, descripcion: "Código único de la categoría terapéutica", ejemplo: "CAT-ANA" },
      { nombre: "nombre", requerida: true, descripcion: "Nombre de la categoría terapéutica", ejemplo: "Analgésicos" },
      { nombre: "descripcion", requerida: false, descripcion: "Descripción de la categoría", ejemplo: "Medicamentos destinados al alivio del dolor" },
      { nombre: "activo", requerida: false, descripcion: "true/false", ejemplo: "true" },
    ],
    validarFila: validarCategoriaTerapeutica,
    importarFila: importarCategoriaTerapeutica,
  },
  boticas: {
    columnas: [
      { nombre: "codigo_interno", requerida: false, descripcion: "Código único de la botica (opcional, se autogenera)", ejemplo: "BOT-000042" },
      { nombre: "nombre", requerida: true, descripcion: "Nombre comercial de la botica", ejemplo: "Botica Salud Total" },
      { nombre: "tipo", requerida: true, descripcion: "Tipo: botica o drogueria", ejemplo: "botica" },
      { nombre: "ubigeo", requerida: true, descripcion: "Código ubigeo obligatorio (6 dígitos, debe existir en catálogo)", ejemplo: "150101" },
      { nombre: "direccion", requerida: false, descripcion: "Dirección física", ejemplo: "Av. Principal 123" },
      { nombre: "telefono", requerida: false, descripcion: "Teléfono de contacto", ejemplo: "01-2345678" },
    ],
    validarFila: validarBotica,
    importarFila: importarBotica,
  },
  productos: {
    columnas: [
      { nombre: "codigo_interno", requerida: false, descripcion: "SKU del producto (opcional, se autogenera)", ejemplo: "SKU-000042" },
      { nombre: "nombre_comercial", requerida: true, descripcion: "Nombre comercial del producto", ejemplo: "Paracetamol 500mg" },
      { nombre: "codigo_categoria", requerida: true, descripcion: "Código de categoría terapéutica existente", ejemplo: "CAT-ANA" },
      { nombre: "forma_farmaceutica", requerida: false, descripcion: "Forma farmacéutica (debe existir en catálogo)", ejemplo: "Tableta" },
      { nombre: "presentacion", requerida: false, descripcion: "Presentación del producto", ejemplo: "Blíster x 10" },
      { nombre: "clasificacion", requerida: true, descripcion: "Clasificación: OTC, receta, generico", ejemplo: "OTC" },
      { nombre: "principio_activo", requerida: false, descripcion: "Nombre del principio activo (debe existir en catálogo)", ejemplo: "Paracetamol" },
      { nombre: "concentracion", requerida: false, descripcion: "Concentración del principio activo", ejemplo: "500" },
      { nombre: "unidad_medida", requerida: false, descripcion: "Unidad de medida (debe existir en catálogo)", ejemplo: "mg" },
    ],
    validarFila: validarProducto,
    importarFila: importarProducto,
  },
  proveedores: {
    columnas: [
      { nombre: "codigo_interno", requerida: false, descripcion: "Código visible del proveedor (opcional, se autogenera si la base lo permite)", ejemplo: "PRV-000001" },
      { nombre: "razon_social", requerida: true, descripcion: "Razón social del proveedor", ejemplo: "Distribuidora Farmacéutica S.A.C." },
      { nombre: "tipo_identificacion", requerida: true, descripcion: "Tipo: ruc, nit, tax_id, vat, otro", ejemplo: "ruc" },
      { nombre: "numero_identificacion", requerida: true, descripcion: "Número de identificación", ejemplo: "20123456789" },
      { nombre: "pais_origen", requerida: false, descripcion: "Código ISO del país (2 letras)", ejemplo: "PE" },
      { nombre: "moneda", requerida: false, descripcion: "Código de moneda (3 letras)", ejemplo: "PEN" },
      { nombre: "activo", requerida: false, descripcion: "true/false", ejemplo: "true" },
    ],
    validarFila: validarProveedor,
    importarFila: importarProveedor,
  },
  usuarios: {
    columnas: [
      { nombre: "nombre_completo", requerida: true, descripcion: "Nombre completo del usuario", ejemplo: "Juan Pérez" },
      { nombre: "nombre_cuenta", requerida: true, descripcion: "Nombre de cuenta (se combinará con el dominio institucional)", ejemplo: "juan.perez" },
      { nombre: "rol", requerida: true, descripcion: "Rol: admin_central, operador_drogueria, visor_botica", ejemplo: "visor_botica" },
      { nombre: "codigo_botica", requerida: false, descripcion: "Código de botica asignada (obligatorio para visor_botica)", ejemplo: "BOT-000001" },
      { nombre: "telefono", requerida: false, descripcion: "Teléfono de contacto", ejemplo: "999888777" },
    ],
    validarFila: validarUsuario,
    importarFila: importarUsuario,
  },
  proveedor_producto: {
    columnas: [
      { nombre: "codigo_proveedor", requerida: true, descripcion: "Código interno del proveedor", ejemplo: "PRV-000001" },
      { nombre: "codigo_producto", requerida: true, descripcion: "SKU del producto", ejemplo: "SKU-000042" },
      { nombre: "lead_time_dias", requerida: true, descripcion: "Tiempo de entrega en días", ejemplo: "7" },
      { nombre: "precio_referencial", requerida: true, descripcion: "Precio referencial del proveedor", ejemplo: "12.50" },
      { nombre: "cantidad_minima_compra", requerida: false, descripcion: "Cantidad mínima de compra", ejemplo: "10" },
      { nombre: "multiplo_empaque", requerida: false, descripcion: "Múltiplo de empaque", ejemplo: "5" },
      { nombre: "activo", requerida: false, descripcion: "true/false", ejemplo: "true" },
    ],
    validarFila: validarProveedorProducto,
    importarFila: importarProveedorProducto,
  },
  precios: {
    columnas: [
      { nombre: "codigo_producto", requerida: true, descripcion: "SKU del producto", ejemplo: "SKU-000042" },
      { nombre: "codigo_botica", requerida: false, descripcion: "Código de botica. Vacío = precio general", ejemplo: "BOT-000001" },
      { nombre: "precio_venta", requerida: true, descripcion: "Precio de venta", ejemplo: "4.50" },
      { nombre: "precio_costo", requerida: true, descripcion: "Precio de costo", ejemplo: "2.80" },
      { nombre: "vigente_desde", requerida: true, descripcion: "Fecha inicio YYYY-MM-DD", ejemplo: "2026-01-01" },
      { nombre: "vigente_hasta", requerida: false, descripcion: "Fecha fin YYYY-MM-DD", ejemplo: "" },
    ],
    validarFila: validarPrecio,
    importarFila: importarPrecio,
  },
  stock_inicial: {
    columnas: [
      { nombre: "codigo_producto", requerida: true, descripcion: "SKU del producto", ejemplo: "SKU-000042" },
      { nombre: "codigo_botica", requerida: true, descripcion: "Código de la botica", ejemplo: "BOT-000001" },
      { nombre: "cantidad", requerida: true, descripcion: "Cantidad (>0 crea lote; =0 solo configura stock)", ejemplo: "100" },
      { nombre: "numero_lote", requerida: false, descripcion: "Número de lote (obligatorio si cantidad > 0)", ejemplo: "LOTE-2024-001" },
      { nombre: "fecha_vencimiento", requerida: false, descripcion: "Fecha de vencimiento (obligatorio si cantidad > 0)", ejemplo: "2026-12-31" },
      { nombre: "codigo_proveedor", requerida: false, descripcion: "Código interno del proveedor (opcional)", ejemplo: "PRV-000001" },
      { nombre: "estrategia", requerida: false, descripcion: "reemplazar|sumar|saltar", ejemplo: "reemplazar" },
    ],
    validarFila: validarStockInicial,
    importarFila: importarStockInicial,
  },
  stock_historico: {
    columnas: [
      { nombre: "codigo_producto", requerida: true, descripcion: "SKU del producto", ejemplo: "SKU-001" },
      { nombre: "codigo_botica", requerida: true, descripcion: "Código de la botica", ejemplo: "BOT-001" },
      { nombre: "fecha_snapshot", requerida: true, descripcion: "Fecha del snapshot semanal YYYY-MM-DD", ejemplo: "2024-01-01" },
      { nombre: "cantidad_disponible", requerida: true, descripcion: "Stock disponible al inicio de semana", ejemplo: "120" },
      { nombre: "stock_minimo", requerida: true, descripcion: "Stock mínimo", ejemplo: "40" },
      { nombre: "stock_maximo", requerida: false, descripcion: "Stock máximo", ejemplo: "240" },
      { nombre: "demanda_insatisfecha", requerida: false, descripcion: "Demanda insatisfecha oficial", ejemplo: "0" },
      { nombre: "stockout_flag", requerida: false, descripcion: "0 o 1", ejemplo: "0" },
    ],
    validarFila: validarStockHistorico,
    importarFila: importarStockHistorico,
  },
  ventas_historicas: {
    columnas: [
      { nombre: "codigo_producto", requerida: true, descripcion: "SKU del producto", ejemplo: "SKU-000042" },
      { nombre: "codigo_botica", requerida: true, descripcion: "Código de la botica", ejemplo: "BOT-000001" },
      { nombre: "fecha_venta", requerida: true, descripcion: "Fecha de la venta (YYYY-MM-DD)", ejemplo: "2024-01-15" },
      { nombre: "cantidad", requerida: true, descripcion: "Cantidad vendida", ejemplo: "5" },
      { nombre: "precio_unitario", requerida: false, descripcion: "Precio de venta unitario", ejemplo: "15.00" },
    ],
    validarFila: validarVentaHistorica,
    importarFila: importarVentaHistorica,
  },
};

// ============================================================
// Main handler
// ============================================================

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

  if (!["super_admin", "admin_central", "operador_drogueria"].includes(perfil.rol)) {
    return json({ error: "No tienes permisos para gestionar importaciones" }, 403);
  }

  const url = new URL(req.url);
  const segmentos = url.pathname.split("/").filter(Boolean);
  const first = segmentos[1] || null;   // tipo, "plantillas", or UUID
  const second = segmentos[2] || null;  // "validar", "importar", "errores", or null

  try {
    switch (req.method) {
      case "GET":
        if (first === "plantillas" && second) {
          return descargarPlantilla(second);
        }
        if (first && esUUID(first) && second === "errores") {
          return descargarErrores(supabase, perfil, first);
        }
        if (first && esUUID(first)) {
          return obtenerImportacion(supabase, perfil, first);
        }
        return listarImportaciones(supabase, perfil, url);

      case "POST":
        if (first && second === "validar") {
          return validarImportacion(supabase, perfil, first, await req.json());
        }
        if (first && second === "importar") {
          return ejecutarImportacion(supabase, perfil, first, await req.json());
        }
        return json({ error: "Ruta no válida. Use /:tipo/validar o /:tipo/importar" }, 400);

      default:
        return json({ error: "Método no soportado" }, 405);
    }
  } catch (e) {
    console.error("Error en importaciones-datos:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

// ============================================================
// Rutas GET
// ============================================================

async function listarImportaciones(supabase: any, perfil: PerfilUsuario, url: URL) {
  const tipo = url.searchParams.get("tipo") || null;
  const estado = url.searchParams.get("estado") || null;
  const pagina = parseInt(url.searchParams.get("pagina") || "1");
  const limite = parseInt(url.searchParams.get("limite") || "20");
  const offset = (pagina - 1) * limite;

  let query = supabase
    .from("importaciones_datos")
    .select(`
      id, tipo_importacion, estado, nombre_archivo_original,
      ruta_archivo, mime_type, tamano_bytes, resumen_jsonb,
      detalle_error, created_at, modified_at,
      usuario:usuario_id(id, nombre, email)
    `, { count: "exact" })
    .eq("org_id", perfil.org_id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);

  if (tipo) query = query.eq("tipo_importacion", tipo);
  if (estado) query = query.eq("estado", estado);

  const { data, error, count } = await query;
  if (error) return json({ error: error.message }, 400);

  const totalPaginas = Math.ceil((count || 0) / limite);

  return json({
    datos: data,
    total: count || 0,
    pagina,
    limite,
    totalPaginas,
  });
}

async function obtenerImportacion(supabase: any, perfil: PerfilUsuario, id: string) {
  const { data, error } = await supabase
    .from("importaciones_datos")
    .select(`
      *,
      usuario:usuario_id(id, nombre, email)
    `)
    .eq("id", id)
    .eq("org_id", perfil.org_id)
    .single();

  if (error) return json({ error: "Importación no encontrada" }, 404);
  return json({ datos: data });
}

async function descargarPlantilla(tipo: string) {
  const config = CONFIG[tipo];
  if (!config) {
    return json({ error: `Tipo de importación no válido: ${tipo}` }, 400);
  }

  const headers = config.columnas.map((c) => c.nombre);
  const ejemplos = config.columnas.map((c) => c.ejemplo);
  const comentarios = config.columnas.map((c) => `${c.nombre}: ${c.descripcion}${c.requerida ? " (obligatorio)" : ""}`);

  const csvContent = [
    "# " + comentarios.join(" | "),
    headers.join(","),
    ejemplos.join(","),
  ].join("\n");

  return new Response(csvContent, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="plantilla_${tipo}.csv"`,
    },
  });
}

async function descargarErrores(supabase: any, perfil: PerfilUsuario, importacionId: string) {
  const { data: importacion, error: errImp } = await supabase
    .from("importaciones_datos")
    .select("id, org_id")
    .eq("id", importacionId)
    .eq("org_id", perfil.org_id)
    .single();

  if (errImp || !importacion) {
    return json({ error: "Importación no encontrada" }, 404);
  }

  const { data: errores, error: errErr } = await supabase
    .from("importaciones_datos_errores")
    .select("fila, columna, valor, mensaje_error")
    .eq("importacion_id", importacionId)
    .order("fila", { ascending: true });

  if (errErr) return json({ error: errErr.message }, 400);

  const csvLines = ["fila,columna,valor,mensaje_error"];
  for (const e of errores || []) {
    const fila = CSV_escape(e.fila.toString());
    const columna = CSV_escape(e.columna || "");
    const valor = CSV_escape(e.valor || "");
    const mensaje = CSV_escape(e.mensaje_error);
    csvLines.push(`${fila},${columna},${valor},${mensaje}`);
  }

  return new Response(csvLines.join("\n"), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="errores_${importacionId}.csv"`,
    },
  });
}

// ============================================================
// Ruta POST — Validar
// ============================================================

async function validarImportacion(supabase: any, perfil: PerfilUsuario, tipo: string, body: any) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return json({ error: `Tipo de importación no válido: ${tipo}. Usar: ${TIPOS_VALIDOS.join(", ")}` }, 400);
  }

  const config = CONFIG[tipo];
  if (!config) {
    return json({ error: `Tipo de importación no implementado: ${tipo}` }, 500);
  }

  const { ruta_archivo, nombre_archivo_original, mime_type, tamano_bytes } = body;

  if (!ruta_archivo) {
    return json({ error: "ruta_archivo es requerido. Sube el archivo al storage primero." }, 400);
  }

  // Leer archivo desde storage
  const { data: fileData, error: fileError } = await supabase
    .storage
    .from(BUCKET)
    .download(ruta_archivo);

  if (fileError || !fileData) {
    return json({ error: `No se pudo leer el archivo: ${fileError?.message || "archivo no encontrado"}` }, 400);
  }

  const contenido = await fileData.text();
  const filasCsv = parseCSV(contenido).filter((fila) => fila.some((v) => v.trim()) && !String(fila[0] || "").trim().startsWith("#"));

  if (filasCsv.length < 2) {
    return json({ error: "El archivo debe tener un encabezado y al menos una fila de datos" }, 400);
  }

  const encabezados = filasCsv[0].map((h) => h.trim().toLowerCase());
  const filas = filasCsv.slice(1);

  // Crear registro de importación en estado 'validando'
  const { data: importacion, error: errCrear } = await supabase
    .from("importaciones_datos")
    .insert({
      org_id: perfil.org_id,
      usuario_id: perfil.id,
      tipo_importacion: tipo,
      estado: "validando",
      nombre_archivo_original: nombre_archivo_original || ruta_archivo.split("/").pop(),
      ruta_archivo,
      mime_type: mime_type || fileData.type || null,
      tamano_bytes: tamano_bytes || fileData.size || null,
    })
    .select("id")
    .single();

  if (errCrear) return json({ error: errCrear.message }, 400);

  const importacionId = importacion.id;
  try {
    const itemsValidos: ItemValido[] = [];
    const errores: ErrorFila[] = [];
    let warnings = 0;

    if (["stock_inicial", "stock_historico", "ventas_historicas", "precios", "proveedor_producto"].includes(tipo)) {
      await poblarCache(supabase, perfil.org_id);
    }

    // Validar cada fila y dejar progreso visible para archivos grandes.
    const filasInvalidas = new Set<number>();
    for (let i = 0; i < filas.length; i++) {
      const valores = filas[i].map((v) => v.trim());
      const fila: Record<string, string> = {};

      encabezados.forEach((h, idx) => {
        fila[h] = valores[idx] || "";
      });

      const resultado = await config.validarFila(fila, supabase, perfil.org_id);

      if (resultado.valida && resultado.item) {
        resultado.item.fila = i + 1;
        itemsValidos.push(resultado.item);
      }

      if (resultado.errores) {
        for (const err of resultado.errores) {
          const numeroFila = err.fila || i + 1;
          errores.push({ ...err, fila: numeroFila });
          filasInvalidas.add(numeroFila);
        }
      }

      const procesadas = i + 1;
      if (procesadas === 1 || procesadas % INTERVALO_PROGRESO === 0 || procesadas === filas.length) {
        await actualizarProgresoImportacion(supabase, importacionId, {
          fase: "validando",
          total_filas: filas.length,
          filas_procesadas: procesadas,
          filas_validas: itemsValidos.length,
          filas_invalidas: filasInvalidas.size,
          total_errores: errores.length,
          porcentaje: Math.round((procesadas / filas.length) * 100),
        });
      }
    }

    const total = filas.length;
    const validos = itemsValidos.length;
    const invalidos = filasInvalidas.size;

    // Guardar errores por fila en lotes para no exceder payloads grandes.
    for (let i = 0; i < errores.length; i += TAMANO_LOTE_IMPORTACION) {
      const rowsErrores = errores.slice(i, i + TAMANO_LOTE_IMPORTACION).map((e) => ({
        importacion_id: importacionId,
        fila: e.fila,
        columna: e.columna || null,
        valor: e.valor || null,
        mensaje_error: e.mensaje,
      }));
      if (rowsErrores.length > 0) await supabase.from("importaciones_datos_errores").insert(rowsErrores);
    }

    // Guardar items válidos como JSON en storage
    if (itemsValidos.length > 0) {
      const resolvedPath = ruta_archivo.replace(/\/[^/]+$/, "/resolved.json");
      const resolvedJson = JSON.stringify({ items: itemsValidos });

      const { error: uploadError } = await supabase
        .storage
        .from(BUCKET)
        .upload(resolvedPath, resolvedJson, {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadError) throw new Error(`No se pudo guardar resolved.json: ${uploadError.message}`);
    }

    // Actualizar estado según resultados
    const nuevoEstado = "listo_para_importar";
    const resumen = {
      fase: "validacion_completada",
      total,
      validos,
      invalidos,
      warnings,
      total_filas: total,
      filas_procesadas: total,
      filas_validas: validos,
      filas_invalidas: invalidos,
      total_errores: errores.length,
      porcentaje: 100,
    };
    const detalleError = invalidos > 0
      ? `${invalidos} fila(s) con errores de ${total}. Revisa el archivo de errores.`
      : null;

    await supabase
      .from("importaciones_datos")
      .update({
        estado: nuevoEstado,
        resumen_jsonb: resumen,
        detalle_error: detalleError,
        modified_at: new Date().toISOString(),
      })
      .eq("id", importacionId);

    // Auditoría
    await supabase.from("auditoria").insert({
      org_id: perfil.org_id,
      usuario_id: perfil.id,
      accion: "VALIDAR_IMPORTACION",
      entidad: "importaciones_datos",
      entidad_id: importacionId,
      nivel: invalidos > 0 ? "advertencia" : "info",
      detalle: `Validación de ${tipo}: ${validos} válidos, ${invalidos} inválidos de ${total} filas`,
      metadata_jsonb: resumen,
    });

    return json({
      exito: true,
      importacion_id: importacionId,
      resumen,
      errores: errores.slice(0, 100).map((e) => ({
        fila: e.fila,
        columna: e.columna || null,
        valor: e.valor || null,
        mensaje: e.mensaje,
      })),
    });
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    console.error(`Error crítico al validar importación ${importacionId}:`, mensaje);
    await marcarFallida(supabase, importacionId, mensaje);
    return json({ error: `Error al validar: ${mensaje}` }, 500);
  }
}

// ============================================================
// Ruta POST — Importar
// ============================================================

async function ejecutarImportacion(supabase: any, perfil: PerfilUsuario, tipo: string, body: any) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return json({ error: `Tipo de importación no válido: ${tipo}` }, 400);
  }

  const config = CONFIG[tipo];
  if (!config) {
    return json({ error: `Tipo de importación no implementado: ${tipo}` }, 500);
  }

  const { importacion_id } = body;
  if (!importacion_id) {
    return json({ error: "importacion_id es requerido" }, 400);
  }

  // Cargar registro de importación
  const { data: importacion, error: errImp } = await supabase
    .from("importaciones_datos")
    .select("*")
    .eq("id", importacion_id)
    .eq("org_id", perfil.org_id)
    .single();

  if (errImp || !importacion) {
    return json({ error: "Importación no encontrada" }, 404);
  }

  if (importacion.tipo_importacion !== tipo) {
    return json({ error: `El tipo de importación no coincide: esperado ${tipo}, actual ${importacion.tipo_importacion}` }, 400);
  }

  if (importacion.estado !== "listo_para_importar") {
    return json({ error: `Estado inválido: ${importacion.estado}. Debe estar en "listo_para_importar"` }, 400);
  }

  // Marcar como procesando
  await supabase
    .from("importaciones_datos")
    .update({ estado: "procesando", modified_at: new Date().toISOString() })
    .eq("id", importacion_id);

  try {
    // Leer items válidos desde resolved.json en storage
    const resolvedPath = importacion.ruta_archivo.replace(/\/[^/]+$/, "/resolved.json");
    let itemsValidos: ItemValido[] = [];

  const { data: resolvedData, error: resolvedError } = await supabase
    .storage
    .from(BUCKET)
    .download(resolvedPath);

  if (resolvedError || !resolvedData) {
    // Fallback: re-validar desde archivo original
    console.warn("resolved.json no encontrado, re-validando desde archivo original:", resolvedError?.message);
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from(BUCKET)
      .download(importacion.ruta_archivo);

    if (fileError || !fileData) {
      await marcarFallida(supabase, importacion_id, "No se pudo leer el archivo para re-validar");
      return json({ error: "No se pudo leer el archivo para importar" }, 400);
    }

    const contenido = await fileData.text();
    const filasCsv = parseCSV(contenido).filter((fila) => fila.some((v) => v.trim()) && !String(fila[0] || "").trim().startsWith("#"));
    const encabezados = filasCsv[0].map((h) => h.trim().toLowerCase());
    const filas = filasCsv.slice(1);

    for (let i = 0; i < filas.length; i++) {
      const valores = filas[i].map((v) => v.trim());
      const fila: Record<string, string> = {};
      encabezados.forEach((h, idx) => { fila[h] = valores[idx] || ""; });

      const resultado = await config.validarFila(fila, supabase, perfil.org_id);
      if (resultado.valida && resultado.item) {
        resultado.item.fila = i + 1;
        itemsValidos.push(resultado.item);
      }
    }
  } else {
    const resolvedJson = JSON.parse(await resolvedData.text());
    itemsValidos = resolvedJson.items || [];
  }

  // Cargar caché de lookups para evitar N+1 SELECTs
  if (["stock_inicial", "stock_historico", "ventas_historicas", "precios", "proveedor_producto"].includes(tipo)) {
    await poblarCache(supabase, perfil.org_id);
  }

  // Procesar items válidos
  let importados = 0;
  let erroresImport = 0;
  const stockInicialVistos = new Set<string>();

  if (tipo === "ventas_historicas") {
    delete batchVentas["ventas_historicas"];
    // Concurrente con caché
    for (let i = 0; i < itemsValidos.length; i += CONCURRENCIA) {
      const lote = itemsValidos.slice(i, i + CONCURRENCIA);
      const resultados = await Promise.allSettled(
        lote.map((item) =>
          config.importarFila(item, supabase, perfil.org_id, perfil.id, importacion_id)
            .then(() => ({ fila: item.fila }))
            .catch((e: unknown) => Promise.reject({ fila: item.fila, error: e }))
        )
      );
      for (const r of resultados) {
        if (r.status === "fulfilled") {
          importados++;
        } else {
          erroresImport++;
          const mensaje = r.reason?.error instanceof Error ? r.reason.error.message : "Error desconocido";
          console.error(`Error al importar fila ${r.reason?.fila}:`, mensaje);
          await supabase.from("importaciones_datos_errores").insert({
            importacion_id,
            fila: r.reason?.fila ?? null,
            columna: null,
            valor: null,
            mensaje_error: `Error al importar: ${mensaje}`,
          });
        }
      }
      await actualizarProgresoImportacion(supabase, importacion_id, {
        fase: "importando",
        total_filas: itemsValidos.length,
        filas_procesadas: Math.min(i + lote.length, itemsValidos.length),
        importados,
        errores_importacion: erroresImport,
        porcentaje: Math.round((Math.min(i + lote.length, itemsValidos.length) / Math.max(itemsValidos.length, 1)) * 100),
      });
    }
    // Vaciar batch de ventas pendiente
    await vaciarBatchVentas(supabase);
  } else {
    // Secuencial para tipos con dependencias entre filas
    for (const item of itemsValidos) {
      try {
        if (tipo === "stock_inicial") {
          const claveStock = `${item.codigo_producto || ""}|${item.codigo_botica || ""}`;
          if (stockInicialVistos.has(claveStock)) {
            item.estrategia = "sumar";
          } else {
            stockInicialVistos.add(claveStock);
          }
        }
        await config.importarFila(item, supabase, perfil.org_id, perfil.id, importacion_id);
        importados++;
      } catch (e: unknown) {
        erroresImport++;
        const mensaje = e instanceof Error ? e.message : "Error desconocido";
        console.error(`Error al importar fila ${item.fila}:`, mensaje);
        await supabase.from("importaciones_datos_errores").insert({
          importacion_id,
          fila: item.fila as number,
          columna: null,
          valor: null,
          mensaje_error: `Error al importar: ${mensaje}`,
        });
      }
      if (importados + erroresImport === 1 || (importados + erroresImport) % INTERVALO_PROGRESO === 0 || importados + erroresImport === itemsValidos.length) {
        await actualizarProgresoImportacion(supabase, importacion_id, {
          fase: "importando",
          total_filas: itemsValidos.length,
          filas_procesadas: importados + erroresImport,
          importados,
          errores_importacion: erroresImport,
          porcentaje: Math.round(((importados + erroresImport) / Math.max(itemsValidos.length, 1)) * 100),
        });
      }
    }
  }

  // Determinar estado final
  const estadoFinal = erroresImport > 0 ? "completada_con_errores" : "completada";
  const detalleFinal = erroresImport > 0
    ? `${importados} importados, ${erroresImport} errores durante la importación`
    : null;

  await supabase
    .from("importaciones_datos")
    .update({
      estado: estadoFinal,
      detalle_error: detalleFinal,
      resumen_jsonb: {
        ...(importacion.resumen_jsonb || {}),
        importados,
        errores_importacion: erroresImport,
      },
      modified_at: new Date().toISOString(),
    })
    .eq("id", importacion_id);

  // Auditoría
  await supabase.from("auditoria").insert({
    org_id: perfil.org_id,
    usuario_id: perfil.id,
    accion: "IMPORTAR_DATOS",
    entidad: "importaciones_datos",
    entidad_id: importacion_id,
    nivel: erroresImport > 0 ? "advertencia" : "info",
    detalle: `Importación de ${tipo} completada: ${importados} importados, ${erroresImport} errores`,
    metadata_jsonb: { importados, errores_importacion: erroresImport },
  });

  return json({
    exito: true,
    estado: estadoFinal,
    importados,
    errores_importacion: erroresImport,
  });
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    console.error(`Error crítico en importación ${importacion_id}:`, mensaje);
    await supabase
      .from("importaciones_datos")
      .update({ estado: "fallida", detalle_error: mensaje, modified_at: new Date().toISOString() })
      .eq("id", importacion_id);
    return json({ error: `Error al importar: ${mensaje}` }, 500);
  }
}

// ============================================================
// Validadores por tipo
// ============================================================

async function validarCategoriaTerapeutica(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];
  const codigo = (fila.codigo || "").trim().toUpperCase();
  const nombre = (fila.nombre || "").trim();

  if (!codigo) errores.push({ fila: 0, columna: "codigo", valor: fila.codigo, mensaje: "El código es obligatorio" });
  if (!nombre) errores.push({ fila: 0, columna: "nombre", valor: fila.nombre, mensaje: "El nombre es obligatorio" });
  if (fila.activo && !["true", "false", "1", "0", "si", "no", "sí"].includes(fila.activo.toLowerCase())) {
    errores.push({ fila: 0, columna: "activo", valor: fila.activo, mensaje: "Activo debe ser true/false" });
  }

  if (codigo) {
    const { data: existenteCodigo } = await supabase
      .from("categorias_terapeuticas")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo", codigo)
      .maybeSingle();
    if (existenteCodigo) {
      // Upsert por codigo permitido: no es error.
    }
  }

  if (errores.length > 0) return { valida: false, errores };
  return {
    valida: true,
    item: {
      codigo,
      nombre,
      descripcion: fila.descripcion || null,
      activo: parseBoolean(fila.activo, true),
    },
  };
}

async function validarBotica(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];

  if (!fila.nombre) {
    errores.push({ fila: 0, columna: "nombre", valor: fila.nombre, mensaje: "El nombre es obligatorio" });
  }

  if (fila.tipo && !["botica", "drogueria"].includes(fila.tipo)) {
    errores.push({ fila: 0, columna: "tipo", valor: fila.tipo, mensaje: "Tipo debe ser botica o drogueria" });
  }

  if (!fila.ubigeo) {
    errores.push({ fila: 0, columna: "ubigeo", valor: fila.ubigeo, mensaje: "El ubigeo es obligatorio" });
  } else if (!/^\d{6}$/.test(fila.ubigeo)) {
    errores.push({ fila: 0, columna: "ubigeo", valor: fila.ubigeo, mensaje: "Ubigeo debe tener 6 dígitos" });
  } else {
    const { data: ubigeo } = await supabase
      .from("ubigeos")
      .select("codigo")
      .eq("codigo", fila.ubigeo)
      .maybeSingle();
    if (!ubigeo) {
      errores.push({ fila: 0, columna: "ubigeo", valor: fila.ubigeo, mensaje: "El ubigeo indicado no existe en el catálogo" });
    }
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      nombre: fila.nombre,
      tipo: fila.tipo || "botica",
      ubigeo: fila.ubigeo,
      direccion: fila.direccion || null,
      telefono: fila.telefono || null,
      codigo_interno: fila.codigo_interno || null,
    },
  };
}

async function validarProducto(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];
  const codigoCategoria = (fila.codigo_categoria || "").trim().toUpperCase();

  const MAPA_CLASIFICACION: Record<string, string> = {
    otc: "OTC", receta: "receta", generico: "generico",
  };
  const claveClasificacion = (fila.clasificacion || "").trim().toLowerCase();
  const clasificacion = MAPA_CLASIFICACION[claveClasificacion] || "";

  if (!fila.nombre_comercial) {
    errores.push({ fila: 0, columna: "nombre_comercial", valor: fila.nombre_comercial, mensaje: "El nombre comercial es obligatorio" });
  }

  if (!codigoCategoria) {
    errores.push({ fila: 0, columna: "codigo_categoria", valor: fila.codigo_categoria, mensaje: "El código de categoría es obligatorio" });
  } else {
    const { data: categoria } = await supabase
      .from("categorias_terapeuticas")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo", codigoCategoria)
      .eq("activo", true)
      .maybeSingle();
    if (!categoria) {
      errores.push({ fila: 0, columna: "codigo_categoria", valor: fila.codigo_categoria, mensaje: `La categoría ${codigoCategoria} no existe en esta organización. Importe primero las categorías terapéuticas.` });
    }
  }

  if (claveClasificacion && !MAPA_CLASIFICACION[claveClasificacion]) {
    errores.push({ fila: 0, columna: "clasificacion", valor: fila.clasificacion, mensaje: "Clasificación debe ser OTC, receta o generico" });
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      nombre_comercial: fila.nombre_comercial,
      codigo_categoria: codigoCategoria,
      forma_farmaceutica: fila.forma_farmaceutica || null,
      presentacion: fila.presentacion || null,
      clasificacion: clasificacion || "OTC",
      codigo_interno: fila.codigo_interno || null,
      principio_activo: fila.principio_activo || null,
      concentracion: fila.concentracion || null,
      unidad_medida: fila.unidad_medida || null,
    },
  };
}

async function validarProveedor(fila: Record<string, string>, _supabase: any, _orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];
  const tiposValidos = ["ruc", "nit", "tax_id", "vat", "otro"];

  if (!fila.razon_social) {
    errores.push({ fila: 0, columna: "razon_social", valor: fila.razon_social, mensaje: "La razón social es obligatoria" });
  }

  if (!fila.tipo_identificacion) {
    errores.push({ fila: 0, columna: "tipo_identificacion", valor: fila.tipo_identificacion, mensaje: "El tipo de identificación es obligatorio" });
  } else if (!tiposValidos.includes(fila.tipo_identificacion)) {
    errores.push({ fila: 0, columna: "tipo_identificacion", valor: fila.tipo_identificacion, mensaje: `Debe ser: ${tiposValidos.join(", ")}` });
  }

  if (!fila.numero_identificacion) {
    errores.push({ fila: 0, columna: "numero_identificacion", valor: fila.numero_identificacion, mensaje: "El número de identificación es obligatorio" });
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      razon_social: fila.razon_social,
      codigo_interno: fila.codigo_interno || null,
      tipo_identificacion: fila.tipo_identificacion,
      numero_identificacion: fila.numero_identificacion,
      pais_origen: fila.pais_origen || "PE",
      moneda: fila.moneda || null,
      activo: fila.activo !== "false",
    },
  };
}

async function validarUsuario(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];
  const rolesValidos = ["admin_central", "operador_drogueria", "visor_botica"];

  if (!fila.nombre_completo) {
    errores.push({ fila: 0, columna: "nombre_completo", valor: fila.nombre_completo, mensaje: "El nombre completo es obligatorio" });
  }

  if (!fila.nombre_cuenta) {
    errores.push({ fila: 0, columna: "nombre_cuenta", valor: fila.nombre_cuenta, mensaje: "El nombre de cuenta es obligatorio" });
  } else if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(fila.nombre_cuenta)) {
    errores.push({ fila: 0, columna: "nombre_cuenta", valor: fila.nombre_cuenta, mensaje: "El nombre de cuenta solo puede contener letras, números, puntos, guiones y guiones bajos. Debe empezar y terminar con letra o número." });
  } else if (fila.nombre_cuenta.length < 3 || fila.nombre_cuenta.length > 64) {
    errores.push({ fila: 0, columna: "nombre_cuenta", valor: fila.nombre_cuenta, mensaje: "El nombre de cuenta debe tener entre 3 y 64 caracteres" });
  }

  // Obtener dominio institucional
  const { data: config } = await supabase
    .from("configuracion_organizacion")
    .select("dominio_correo_organizacion")
    .eq("org_id", orgId)
    .single();

  const dominio = config?.dominio_correo_organizacion;

  if (!dominio) {
    errores.push({ fila: 0, columna: "nombre_cuenta", valor: fila.nombre_cuenta, mensaje: "Tu organización no tiene un dominio institucional configurado. No se pueden crear usuarios por importación." });
  } else if (fila.nombre_cuenta) {
    // Construir email y validar
    const email = `${fila.nombre_cuenta}@${dominio}`;

    const { data: dominioValido } = await supabase.rpc("validar_dominio_correo", {
      p_email: email,
      p_org_id: orgId,
    });
    if (!dominioValido) {
      errores.push({ fila: 0, columna: "nombre_cuenta", valor: fila.nombre_cuenta, mensaje: "El dominio del correo generado no está permitido para esta organización" });
    }

    // Verificar unicidad global del email
    const { data: existingEmail } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingEmail) {
      errores.push({ fila: 0, columna: "nombre_cuenta", valor: fila.nombre_cuenta, mensaje: `Ya existe un usuario con el correo ${email}` });
    }
  }

  if (!fila.rol) {
    errores.push({ fila: 0, columna: "rol", valor: fila.rol, mensaje: "El rol es obligatorio" });
  } else if (!rolesValidos.includes(fila.rol)) {
    errores.push({ fila: 0, columna: "rol", valor: fila.rol, mensaje: `Rol debe ser: ${rolesValidos.join(", ")}` });
  }

  if (fila.rol === "visor_botica" && !fila.codigo_botica) {
    errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "El visor_botica requiere una botica asignada" });
  }

  if (fila.rol === "admin_central") {
    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("org_id", orgId)
      .eq("rol", "admin_central")
      .maybeSingle();
    if (existing) {
      errores.push({ fila: 0, columna: "rol", valor: fila.rol, mensaje: "Ya existe un admin_central en la organización" });
    }
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      nombre_completo: fila.nombre_completo,
      nombre_cuenta: fila.nombre_cuenta,
      rol: fila.rol,
      codigo_botica: fila.codigo_botica || null,
      telefono: fila.telefono || null,
    },
  };
}

async function validarProveedorProducto(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];

  if (!fila.codigo_proveedor) {
    errores.push({ fila: 0, columna: "codigo_proveedor", valor: fila.codigo_proveedor, mensaje: "El código del proveedor es obligatorio" });
  }
  if (!fila.codigo_producto) {
    errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "El código del producto es obligatorio" });
  }
  if (!fila.lead_time_dias || isNaN(Number(fila.lead_time_dias)) || Number(fila.lead_time_dias) < 0) {
    errores.push({ fila: 0, columna: "lead_time_dias", valor: fila.lead_time_dias, mensaje: "Lead time debe ser un número >= 0" });
  }
  if (!fila.precio_referencial || isNaN(Number(fila.precio_referencial)) || Number(fila.precio_referencial) < 0) {
    errores.push({ fila: 0, columna: "precio_referencial", valor: fila.precio_referencial, mensaje: "Precio referencial debe ser un número >= 0" });
  }
  if (fila.cantidad_minima_compra && (isNaN(Number(fila.cantidad_minima_compra)) || Number(fila.cantidad_minima_compra) < 1)) {
    errores.push({ fila: 0, columna: "cantidad_minima_compra", valor: fila.cantidad_minima_compra, mensaje: "Cantidad mínima debe ser >= 1" });
  }
  if (fila.multiplo_empaque && (isNaN(Number(fila.multiplo_empaque)) || Number(fila.multiplo_empaque) < 1)) {
    errores.push({ fila: 0, columna: "multiplo_empaque", valor: fila.multiplo_empaque, mensaje: "Múltiplo de empaque debe ser >= 1" });
  }

  if (fila.codigo_proveedor) {
    const { data: proveedor } = await supabase
      .from("proveedores")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo_interno", fila.codigo_proveedor)
      .maybeSingle();
    if (!proveedor) {
      errores.push({ fila: 0, columna: "codigo_proveedor", valor: fila.codigo_proveedor, mensaje: "No existe un proveedor con ese código en esta organización" });
    }
  }

  if (fila.codigo_producto) {
    const { data: producto } = await supabase
      .from("productos")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo_interno", fila.codigo_producto)
      .maybeSingle();
    if (!producto) {
      errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "No existe un producto con ese código en esta organización" });
    }
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      codigo_proveedor: fila.codigo_proveedor,
      codigo_producto: fila.codigo_producto,
      lead_time_dias: Number(fila.lead_time_dias),
      precio_referencial: Number(fila.precio_referencial),
      cantidad_minima_compra: fila.cantidad_minima_compra ? Number(fila.cantidad_minima_compra) : 1,
      multiplo_empaque: fila.multiplo_empaque ? Number(fila.multiplo_empaque) : 1,
      activo: fila.activo !== "false",
    },
  };
}

async function validarPrecio(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];
  if (!fila.codigo_producto) errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "El código del producto es obligatorio" });
  if (!fila.precio_venta || isNaN(Number(fila.precio_venta)) || Number(fila.precio_venta) < 0) {
    errores.push({ fila: 0, columna: "precio_venta", valor: fila.precio_venta, mensaje: "Precio de venta debe ser >= 0" });
  }
  if (!fila.precio_costo || isNaN(Number(fila.precio_costo)) || Number(fila.precio_costo) < 0) {
    errores.push({ fila: 0, columna: "precio_costo", valor: fila.precio_costo, mensaje: "Precio de costo debe ser >= 0" });
  }
  if (!fila.vigente_desde || !/^\d{4}-\d{2}-\d{2}$/.test(fila.vigente_desde)) {
    errores.push({ fila: 0, columna: "vigente_desde", valor: fila.vigente_desde, mensaje: "vigente_desde debe tener formato YYYY-MM-DD" });
  }
  if (fila.vigente_hasta && !/^\d{4}-\d{2}-\d{2}$/.test(fila.vigente_hasta)) {
    errores.push({ fila: 0, columna: "vigente_hasta", valor: fila.vigente_hasta, mensaje: "vigente_hasta debe tener formato YYYY-MM-DD" });
  }
  if (
    fila.vigente_desde && /^\d{4}-\d{2}-\d{2}$/.test(fila.vigente_desde) &&
    fila.vigente_hasta && /^\d{4}-\d{2}-\d{2}$/.test(fila.vigente_hasta) &&
    fila.vigente_hasta < fila.vigente_desde
  ) {
    errores.push({ fila: 0, columna: "vigente_hasta", valor: fila.vigente_hasta, mensaje: "vigente_hasta debe ser mayor o igual a vigente_desde" });
  }

  if (fila.codigo_producto && !cacheProductos.get(fila.codigo_producto)) {
    errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "No existe un producto con ese código en esta organización" });
  }

  if (fila.codigo_botica && !cacheBoticas.get(fila.codigo_botica)) {
    errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "No existe una botica con ese código en esta organización" });
  }
  if (errores.length > 0) return { valida: false, errores };
  return {
    valida: true,
    item: {
      codigo_producto: fila.codigo_producto,
      codigo_botica: fila.codigo_botica || null,
      precio_venta: Number(fila.precio_venta),
      precio_costo: Number(fila.precio_costo),
      vigente_desde: fila.vigente_desde,
      vigente_hasta: fila.vigente_hasta || null,
    },
  };
}

async function validarStockInicial(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];

  if (!fila.codigo_producto) {
    errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "El código del producto es obligatorio" });
  }
  if (!fila.codigo_botica) {
    errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "El código de la botica es obligatorio" });
  }
  if (!fila.cantidad || isNaN(Number(fila.cantidad)) || Number(fila.cantidad) < 0) {
    errores.push({ fila: 0, columna: "cantidad", valor: fila.cantidad, mensaje: "Cantidad debe ser un número >= 0" });
  }

  const cantidad = Number(fila.cantidad);
  if (cantidad > 0) {
    if (!fila.numero_lote) {
      errores.push({ fila: 0, columna: "numero_lote", valor: fila.numero_lote, mensaje: "El número de lote es obligatorio cuando cantidad > 0" });
    }
    if (!fila.fecha_vencimiento) {
      errores.push({ fila: 0, columna: "fecha_vencimiento", valor: fila.fecha_vencimiento, mensaje: "La fecha de vencimiento es obligatoria cuando cantidad > 0" });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fila.fecha_vencimiento)) {
      errores.push({ fila: 0, columna: "fecha_vencimiento", valor: fila.fecha_vencimiento, mensaje: "Formato de fecha inválido. Use YYYY-MM-DD" });
    }
  }

  if (fila.estrategia && !["reemplazar", "sumar", "saltar"].includes(fila.estrategia)) {
    errores.push({ fila: 0, columna: "estrategia", valor: fila.estrategia, mensaje: "Estrategia debe ser: reemplazar, sumar, saltar" });
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      codigo_producto: fila.codigo_producto,
      codigo_botica: fila.codigo_botica,
      cantidad,
      numero_lote: fila.numero_lote || null,
      fecha_vencimiento: fila.fecha_vencimiento || null,
      codigo_proveedor: fila.codigo_proveedor || null,
      estrategia: fila.estrategia || "reemplazar",
    },
  };
}

async function validarStockHistorico(fila: Record<string, string>, supabase: any, orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];

  if (!fila.codigo_producto) {
    errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "El código del producto es obligatorio" });
  }
  if (!fila.codigo_botica) {
    errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "El código de la botica es obligatorio" });
  }
  if (!fila.fecha_snapshot || !/^\d{4}-\d{2}-\d{2}$/.test(fila.fecha_snapshot)) {
    errores.push({ fila: 0, columna: "fecha_snapshot", valor: fila.fecha_snapshot, mensaje: "fecha_snapshot debe tener formato YYYY-MM-DD" });
  }

  const cantidadDisponible = Number(fila.cantidad_disponible);
  const stockMinimo = Number(fila.stock_minimo);
  const stockMaximo = fila.stock_maximo ? Number(fila.stock_maximo) : null;
  const demandaInsatisfecha = fila.demanda_insatisfecha ? Number(fila.demanda_insatisfecha) : 0;
  const stockoutFlag = fila.stockout_flag ? Number(fila.stockout_flag) : 0;

  if (!fila.cantidad_disponible || Number.isNaN(cantidadDisponible) || cantidadDisponible < 0) {
    errores.push({ fila: 0, columna: "cantidad_disponible", valor: fila.cantidad_disponible, mensaje: "cantidad_disponible debe ser >= 0" });
  }
  if (!fila.stock_minimo || Number.isNaN(stockMinimo) || stockMinimo < 0) {
    errores.push({ fila: 0, columna: "stock_minimo", valor: fila.stock_minimo, mensaje: "stock_minimo debe ser >= 0" });
  }
  if (fila.stock_maximo && (Number.isNaN(stockMaximo) || (stockMaximo as number) < stockMinimo)) {
    errores.push({ fila: 0, columna: "stock_maximo", valor: fila.stock_maximo, mensaje: "stock_maximo debe ser >= stock_minimo" });
  }
  if (Number.isNaN(demandaInsatisfecha) || demandaInsatisfecha < 0) {
    errores.push({ fila: 0, columna: "demanda_insatisfecha", valor: fila.demanda_insatisfecha, mensaje: "demanda_insatisfecha debe ser >= 0" });
  }
  if (![0, 1].includes(stockoutFlag)) {
    errores.push({ fila: 0, columna: "stockout_flag", valor: fila.stockout_flag, mensaje: "stockout_flag debe ser 0 o 1" });
  }

  if (fila.codigo_producto) {
    const { data: producto } = await supabase
      .from("productos")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo_interno", fila.codigo_producto)
      .maybeSingle();
    if (!producto) {
      errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "No existe un producto con ese código en esta organización" });
    }
  }

  if (fila.codigo_botica) {
    const { data: botica } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo_interno", fila.codigo_botica)
      .maybeSingle();
    if (!botica) {
      errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "No existe una botica con ese código en esta organización" });
    }
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      codigo_producto: fila.codigo_producto,
      codigo_botica: fila.codigo_botica,
      fecha_snapshot: fila.fecha_snapshot,
      cantidad_disponible: Math.round(cantidadDisponible),
      stock_minimo: Math.round(stockMinimo),
      stock_maximo: stockMaximo === null ? null : Math.round(stockMaximo),
      demanda_insatisfecha: Math.round(demandaInsatisfecha),
      stockout_flag: stockoutFlag,
    },
  };
}

async function validarVentaHistorica(fila: Record<string, string>, _supabase: any, _orgId: string): Promise<FilaValidada> {
  const errores: ErrorFila[] = [];

  if (!fila.codigo_producto) {
    errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "El código del producto es obligatorio" });
  }
  if (!fila.codigo_botica) {
    errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "El código de la botica es obligatorio" });
  }
  if (!fila.fecha_venta || !/^\d{4}-\d{2}-\d{2}$/.test(fila.fecha_venta)) {
    errores.push({ fila: 0, columna: "fecha_venta", valor: fila.fecha_venta, mensaje: "Fecha de venta debe tener formato YYYY-MM-DD" });
  }
  if (!fila.cantidad || isNaN(Number(fila.cantidad)) || Number(fila.cantidad) <= 0) {
    errores.push({ fila: 0, columna: "cantidad", valor: fila.cantidad, mensaje: "Cantidad debe ser un número > 0" });
  }
  if (fila.precio_unitario && isNaN(Number(fila.precio_unitario))) {
    errores.push({ fila: 0, columna: "precio_unitario", valor: fila.precio_unitario, mensaje: "Precio unitario debe ser un número válido" });
  }
  if (fila.codigo_producto && !cacheProductos.get(fila.codigo_producto)) {
    errores.push({ fila: 0, columna: "codigo_producto", valor: fila.codigo_producto, mensaje: "No existe un producto con ese código en esta organización" });
  }
  if (fila.codigo_botica && !cacheBoticas.get(fila.codigo_botica)) {
    errores.push({ fila: 0, columna: "codigo_botica", valor: fila.codigo_botica, mensaje: "No existe una botica con ese código en esta organización" });
  }

  if (errores.length > 0) return { valida: false, errores };

  return {
    valida: true,
    item: {
      codigo_producto: fila.codigo_producto,
      codigo_botica: fila.codigo_botica,
      fecha_venta: fila.fecha_venta,
      cantidad: Number(fila.cantidad),
      precio_unitario: fila.precio_unitario ? Number(fila.precio_unitario) : null,
    },
  };
}

// ============================================================
// Importadores por tipo
// ============================================================

async function importarCategoriaTerapeutica(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  const { error } = await supabase.from("categorias_terapeuticas").upsert({
    org_id: orgId,
    codigo: item.codigo as string,
    nombre: item.nombre as string,
    descripcion: item.descripcion || null,
    activo: item.activo as boolean,
    modified_by: usuarioId,
  }, { onConflict: "org_id,codigo" });

  if (error) throw new Error(error.message);
}

async function importarBotica(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  const MAX_INTENTOS = 3;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    // Generar código si no se proporcionó
    let codigoInterno = item.codigo_interno as string | null;
    if (!codigoInterno) {
      const { data: maxData } = await supabase
        .from("boticas")
        .select("codigo_interno")
        .eq("org_id", orgId)
        .not("codigo_interno", "is", null)
        .order("codigo_interno", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (maxData?.codigo_interno) {
        const match = (maxData.codigo_interno as string).match(/BOT-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      codigoInterno = `BOT-${String(nextNum).padStart(6, "0")}`;
    }

    const { error: err } = await supabase.from("boticas").insert({
      org_id: orgId,
      codigo_interno: codigoInterno,
      nombre: item.nombre as string,
      tipo: item.tipo as string,
      ubigeo: item.ubigeo as string || null,
      direccion: item.direccion as string || null,
      telefono: item.telefono as string || null,
      activa: true,
    });

    if (!err) return;

    if (err.message?.includes("idx_boticas_codigo_org") || err.message?.includes("unique constraint")) {
      if (intento < MAX_INTENTOS) continue;
      throw new Error(`No se pudo generar un código único para la botica "${item.nombre}"`);
    }
    throw new Error(err.message);
  }
}

async function importarProducto(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  const { data: categoria } = await supabase
    .from("categorias_terapeuticas")
    .select("id")
    .eq("org_id", orgId)
    .eq("codigo", item.codigo_categoria as string)
    .maybeSingle();
  if (!categoria) throw new Error(`La categoría ${item.codigo_categoria} no existe en esta organización. Importe primero las categorías terapéuticas.`);

  // Resolver forma farmacéutica
  let formaFarmaceuticaId = null;
  if (item.forma_farmaceutica) {
    const { data: ff } = await supabase
      .from("formas_farmaceuticas")
      .select("id")
      .ilike("nombre", item.forma_farmaceutica as string)
      .maybeSingle();
    if (ff) formaFarmaceuticaId = ff.id;
  }

  // Resolver principio activo y unidad de medida (creando si no existen)
  let principioActivoId = null;
  let unidadMedidaId = null;
  if (item.principio_activo) {
    principioActivoId = await resolverOCrearPrincipioActivo(supabase, item.principio_activo as string);
    if (item.unidad_medida) {
      unidadMedidaId = await resolverOCrearUnidadMedida(supabase, item.unidad_medida as string);
    }
  }

  // Autogenerar SKU con retry (mismo patrón que boticas)
  if (item.codigo_interno) {
      const { data: existente } = await supabase
        .from("productos")
        .select("id")
        .eq("org_id", orgId)
        .eq("codigo_interno", item.codigo_interno as string)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
    if (existente) {
      const { error: errUpd } = await supabase
        .from("productos")
        .update({
          nombre_comercial: item.nombre_comercial as string,
          categoria_terapeutica_id: categoria.id,
          forma_farmaceutica_id: formaFarmaceuticaId,
          presentacion: item.presentacion as string || null,
          clasificacion: item.clasificacion as string,
          modified_by: usuarioId,
          modified_at: new Date().toISOString(),
        })
        .eq("id", existente.id)
        .eq("org_id", orgId);
      if (errUpd) throw new Error(errUpd.message);
      await asegurarRelacionProductoPrincipioActivo(supabase, existente.id, principioActivoId, item, unidadMedidaId);
      return;
    }
  }

  const MAX_INTENTOS = 3;
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    let codigoInterno = item.codigo_interno as string | null;
    if (!codigoInterno) {
      const { data: maxData } = await supabase
        .from("productos")
        .select("codigo_interno")
        .eq("org_id", orgId)
        .not("codigo_interno", "is", null)
        .order("codigo_interno", { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNum = 1;
      if (maxData?.codigo_interno) {
        const match = (maxData.codigo_interno as string).match(/SKU-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      codigoInterno = `SKU-${String(nextNum).padStart(6, "0")}`;
    }

    const { data: producto, error: errProd } = await supabase
      .from("productos")
      .insert({
        org_id: orgId,
        codigo_interno: codigoInterno,
        nombre_comercial: item.nombre_comercial as string,
        categoria_terapeutica_id: categoria.id,
        forma_farmaceutica_id: formaFarmaceuticaId,
        presentacion: item.presentacion as string || null,
        clasificacion: item.clasificacion as string,
        estado: "activo",
        modified_by: usuarioId,
      })
      .select("id")
      .single();

    if (!errProd) {
      try {
        await asegurarRelacionProductoPrincipioActivo(supabase, producto.id, principioActivoId, item, unidadMedidaId);
      } catch (error) {
        await supabase.from("productos").delete().eq("id", producto.id).eq("org_id", orgId);
        throw error;
      }
      return;
    }

    if (errProd.code === "23505" && !item.codigo_interno) {
      if (intento < MAX_INTENTOS) continue;
      throw new Error(`No se pudo generar un SKU único para "${item.nombre_comercial}"`);
    }
    throw new Error(errProd.message);
  }
}

async function importarProveedor(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  const { data: moneda } = item.moneda
    ? await supabase.from("monedas").select("id").eq("codigo", item.moneda as string).maybeSingle()
    : { data: null };

  const { error } = await supabase.from("proveedores").upsert({
    org_id: orgId,
    ...(item.codigo_interno ? { codigo_interno: item.codigo_interno as string } : {}),
    razon_social: item.razon_social as string,
    tipo_identificacion: item.tipo_identificacion as string,
    numero_identificacion: item.numero_identificacion as string,
    pais_origen: item.pais_origen as string || "PE",
    moneda_id: moneda?.id || null,
    activo: item.activo as boolean,
  }, {
    onConflict: "org_id, tipo_identificacion, numero_identificacion",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(error.message);
}

async function importarUsuario(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  // Obtener dominio institucional
  const { data: config } = await supabase
    .from("configuracion_organizacion")
    .select("dominio_correo_organizacion")
    .eq("org_id", orgId)
    .single();

  const dominio = config?.dominio_correo_organizacion;
  if (!dominio) {
    throw new Error("Tu organización no tiene un dominio institucional configurado");
  }

  const nombreCuenta = item.nombre_cuenta as string;
  const email = `${nombreCuenta}@${dominio}`;

  // Resolver botica si se especificó
  let boticaId = null;
  if (item.codigo_botica) {
    const { data: botica } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo_interno", item.codigo_botica as string)
      .maybeSingle();

    if (!botica) {
      throw new Error(`Botica con código ${item.codigo_botica} no encontrada`);
    }
    boticaId = botica.id;
  }

  // Resolver drogueria_id para roles centrales
  let drogueriaId = null;
  const rol = item.rol as string;
  if (rol === "admin_central" || rol === "operador_drogueria") {
    const { data: drogueria } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", orgId)
      .eq("tipo", "drogueria")
      .maybeSingle();
    if (drogueria) drogueriaId = drogueria.id;
  }

  // Crear usuario en Auth (invitación por correo, sin password)
  const { data: userData, error: userError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        org_id: orgId,
        nombre: item.nombre_completo as string,
        rol,
        botica_id: boticaId,
        drogueria_id: drogueriaId,
        telefono: item.telefono || null,
      },
    },
  );

  if (userError) {
    if (userError.message?.includes("already")) {
      throw new Error(`Ya existe un usuario con email ${email}`);
    }
    throw new Error(userError.message);
  }

  if (!userData?.user?.id) {
    throw new Error(`Error al crear usuario en Auth: ${email}`);
  }

  // Crear perfil público (compensación si falla)
  const { error: upsertError } = await supabase.from("usuarios").upsert({
    id: userData.user.id,
    org_id: orgId,
    email,
    nombre: item.nombre_completo as string,
    rol,
    botica_id: boticaId,
    drogueria_id: drogueriaId,
    telefono: item.telefono as string || null,
    activo: true,
  }, { onConflict: "id" });

  if (upsertError) {
    // Compensación: intentar eliminar el usuario de Auth
    console.error("Error al crear perfil, compensando eliminación de Auth:", upsertError.message);
    await supabase.auth.admin.deleteUser(userData.user.id).catch((e: unknown) => {
      console.error("No se pudo eliminar usuario de Auth como compensación:", e);
    });
    throw new Error(`Error al crear perfil para ${email}: ${upsertError.message}`);
  }
}

async function importarProveedorProducto(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  // Resolver proveedor por código interno visible dentro de la organización.
  const { data: proveedor } = await supabase
    .from("proveedores")
    .select("id")
    .eq("org_id", orgId)
    .eq("codigo_interno", item.codigo_proveedor as string)
    .maybeSingle();

  if (!proveedor) {
    throw new Error(`Proveedor "${item.codigo_proveedor}" no encontrado`);
  }

  // Resolver producto por SKU
  const { data: producto } = await supabase
    .from("productos")
    .select("id")
    .eq("org_id", orgId)
    .eq("codigo_interno", item.codigo_producto as string)
    .maybeSingle();

  if (!producto) {
    throw new Error(`Producto con SKU "${item.codigo_producto}" no encontrado`);
  }

  const { error } = await supabase.from("proveedor_producto").upsert({
    org_id: orgId,
    proveedor_id: proveedor.id,
    producto_id: producto.id,
    lead_time_dias: item.lead_time_dias as number,
    lead_time_especifico: item.lead_time_dias as number,
    precio_referencial: item.precio_referencial as number,
    precio_compra_referencial: item.precio_referencial as number,
    cantidad_minima_compra: item.cantidad_minima_compra as number,
    multiplo_empaque: item.multiplo_empaque as number,
    activo: (item.activo as boolean) !== false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id,proveedor_id,producto_id" });

  if (error) throw new Error(error.message);
}

async function importarPrecio(item: ItemValido, supabase: any, orgId: string, _usuarioId: string) {
  const { data: producto } = await supabase
    .from("productos")
    .select("id")
    .eq("org_id", orgId)
    .eq("codigo_interno", item.codigo_producto as string)
    .maybeSingle();
  if (!producto) throw new Error(`Producto con SKU "${item.codigo_producto}" no encontrado`);

  let boticaId = null;
  if (item.codigo_botica) {
    const { data: botica } = await supabase
      .from("boticas")
      .select("id")
      .eq("org_id", orgId)
      .eq("codigo_interno", item.codigo_botica as string)
      .maybeSingle();
    if (!botica) throw new Error(`Botica con código "${item.codigo_botica}" no encontrada`);
    boticaId = botica.id;
  }

  const { error } = await supabase.from("precios").insert({
    org_id: orgId,
    producto_id: producto.id,
    botica_id: boticaId,
    precio_venta: item.precio_venta as number,
    precio_costo: item.precio_costo as number,
    vigente_desde: item.vigente_desde as string,
    vigente_hasta: item.vigente_hasta || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function importarStockInicial(item: ItemValido, supabase: any, orgId: string, usuarioId: string) {
  // Resolver producto por SKU (caché)
  const productoId = cacheProductos.get(item.codigo_producto as string);
  if (!productoId) {
    throw new Error(`Producto con SKU "${item.codigo_producto}" no encontrado`);
  }

  // Resolver botica por código (caché)
  const botica = cacheBoticas.get(item.codigo_botica as string);
  if (!botica) {
    throw new Error(`Botica con código "${item.codigo_botica}" no encontrada`);
  }

  // Resolver proveedor si se especificó (caché)
  const proveedorId = item.codigo_proveedor
    ? cacheProveedores.get(item.codigo_proveedor as string) || null
    : null;

  // Construir item para el RPC
  const items = [{
    producto_id: productoId,
    ubicacion_tipo: botica.tipo,
    ubicacion_id: botica.id,
    cantidad: item.cantidad,
    numero_lote: item.numero_lote || null,
    fecha_vencimiento: item.fecha_vencimiento || null,
    proveedor_id: proveedorId,
  }];

  const { data: resultado, error: rpcError } = await supabase.rpc("procesar_stock_inicial", {
    p_items: items,
    p_org_id: orgId,
    p_usuario_id: usuarioId,
    p_estrategia: (item.estrategia as string) || "reemplazar",
  });

  if (rpcError) throw new Error(rpcError.message);
  const res = resultado as { exito?: boolean; error?: string };
  if (res && res.error) throw new Error(res.error);
}

async function importarStockHistorico(item: ItemValido, supabase: any, orgId: string, _usuarioId: string) {
  const productoId = cacheProductos.get(item.codigo_producto as string);
  if (!productoId) {
    throw new Error(`Producto con SKU "${item.codigo_producto}" no encontrado`);
  }

  const botica = cacheBoticas.get(item.codigo_botica as string);
  if (!botica) {
    throw new Error(`Botica con código "${item.codigo_botica}" no encontrada`);
  }

  const { error } = await supabase.from("stock_historico").upsert({
    org_id: orgId,
    producto_id: productoId,
    ubicacion_tipo: botica.tipo || "botica",
    ubicacion_id: botica.id,
    fecha_snapshot_dia: item.fecha_snapshot as string,
    cantidad_disponible: item.cantidad_disponible as number,
    stock_minimo: item.stock_minimo as number,
    stock_maximo: item.stock_maximo || null,
    demanda_insatisfecha: item.demanda_insatisfecha as number,
    stockout_flag: item.stockout_flag as number,
  }, {
    onConflict: "org_id,producto_id,ubicacion_tipo,ubicacion_id,fecha_snapshot_dia",
    ignoreDuplicates: false,
  });

  if (error) throw new Error(error.message);
}

async function importarVentaHistorica(item: ItemValido, supabase: any, orgId: string, _usuarioId: string, importacionId: string) {
  const productoId = cacheProductos.get(item.codigo_producto as string);
  if (!productoId) {
    throw new Error(`Producto con SKU "${item.codigo_producto}" no encontrado`);
  }

  const boticaId = cacheBoticas.get(item.codigo_botica as string)?.id;
  if (!boticaId) {
    throw new Error(`Botica con código "${item.codigo_botica}" no encontrada`);
  }

  const claveIdempotencia = [
    orgId, boticaId, productoId, item.fecha_venta,
  ].join(":");

  const fila = {
    org_id: orgId,
    botica_id: boticaId,
    producto_id: productoId,
    fecha_venta: item.fecha_venta as string,
    cantidad: item.cantidad as number,
    precio_unitario: (item.precio_unitario as number) || null,
    importacion_id: importacionId,
    clave_idempotencia: claveIdempotencia,
  };

  // Batch: acumular y vaciar cada 500
  if (!batchVentas["ventas_historicas"]) batchVentas["ventas_historicas"] = [];
  batchVentas["ventas_historicas"].push(fila);

  if (batchVentas["ventas_historicas"].length >= 500) {
    await vaciarBatchVentas(supabase);
  }
}

async function asegurarRelacionProductoPrincipioActivo(
  supabase: any,
  productoId: string,
  principioActivoId: string | null,
  item: ItemValido,
  unidadMedidaId: string | null,
) {
  if (!item.principio_activo) return;
  if (!principioActivoId) throw new Error(`No se resolvio el principio activo de ${item.nombre_comercial}`);
  if (!item.concentracion || Number.isNaN(Number(item.concentracion))) return;

  const { error } = await supabase
    .from("producto_principio_activo")
    .upsert({
      producto_id: productoId,
      principio_activo_id: principioActivoId,
      concentracion: Number(item.concentracion),
      unidad_medida_id: unidadMedidaId,
    }, {
      onConflict: "producto_id,principio_activo_id",
      ignoreDuplicates: false,
    });

  if (error) throw new Error(error.message);
}

// ============================================================
// Helpers
// ============================================================

async function marcarFallida(supabase: any, id: string, motivo: string) {
  await supabase
    .from("importaciones_datos")
    .update({ estado: "fallida", detalle_error: motivo, modified_at: new Date().toISOString() })
    .eq("id", id);
}

async function resolverOCrearPrincipioActivo(
  supabase: any,
  nombreOriginal: string
): Promise<string> {
  const nombre = String(nombreOriginal ?? "").trim();

  if (!nombre) {
    throw new Error("El nombre del principio activo está vacío");
  }

  const {
    data: existente,
    error: errorBusqueda,
  } = await supabase
    .from("principios_activos")
    .select("id, nombre")
    .eq("nombre", nombre)
    .limit(1)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(
      `Error al buscar principio activo "${nombre}": ${errorBusqueda.message}`
    );
  }

  if (existente) {
    return existente.id;
  }

  const {
    data: nuevo,
    error: errorCreacion,
  } = await supabase
    .from("principios_activos")
    .insert({ nombre })
    .select("id")
    .single();

  if (errorCreacion) {
    throw new Error(
      `Error al crear principio activo "${nombre}": ${errorCreacion.message}`
    );
  }

  if (!nuevo?.id) {
    throw new Error(
      `El principio activo "${nombre}" fue creado, pero no se obtuvo su ID`
    );
  }

  return nuevo.id;
}

async function resolverOCrearUnidadMedida(
  supabase: any,
  valorOriginal: string
): Promise<string> {
  const valor = String(valorOriginal ?? "").trim();

  if (!valor) {
    throw new Error("La unidad de medida está vacía");
  }

  const {
    data: porSimbolo,
    error: errorSimbolo,
  } = await supabase
    .from("unidades_medida")
    .select("id, nombre, simbolo")
    .eq("simbolo", valor)
    .limit(1)
    .maybeSingle();

  if (errorSimbolo) {
    throw new Error(
      `Error al buscar la unidad "${valor}" por símbolo: ${errorSimbolo.message}`
    );
  }

  if (porSimbolo) {
    return porSimbolo.id;
  }

  const {
    data: porNombre,
    error: errorNombre,
  } = await supabase
    .from("unidades_medida")
    .select("id, nombre, simbolo")
    .eq("nombre", valor)
    .limit(1)
    .maybeSingle();

  if (errorNombre) {
    throw new Error(
      `Error al buscar la unidad "${valor}" por nombre: ${errorNombre.message}`
    );
  }

  if (porNombre) {
    return porNombre.id;
  }

  const {
    data: nueva,
    error: errorCreacion,
  } = await supabase
    .from("unidades_medida")
    .insert({
      nombre: valor,
      simbolo: valor,
    })
    .select("id")
    .single();

  if (errorCreacion) {
    throw new Error(
      `Error al crear unidad de medida "${valor}": ${errorCreacion.message}`
    );
  }

  if (!nueva?.id) {
    throw new Error(
      `La unidad de medida "${valor}" fue creada, pero no se obtuvo su ID`
    );
  }

  return nueva.id;
}

async function actualizarProgresoImportacion(supabase: any, id: string, resumen: Record<string, unknown>) {
  await supabase
    .from("importaciones_datos")
    .update({ resumen_jsonb: resumen, modified_at: new Date().toISOString() })
    .eq("id", id);
}

async function vaciarBatchVentas(supabase: any) {
  const filas = batchVentas["ventas_historicas"] || [];
  if (filas.length === 0) return;

  batchVentas["ventas_historicas"] = [];
  const { error } = await supabase
    .from("ventas_historicas")
    .upsert(filas, {
      onConflict: "org_id,clave_idempotencia",
      ignoreDuplicates: false,
    });

  if (error) throw new Error(error.message);
}

function esUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function CSV_escape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function parseBoolean(valor: unknown, defaultValue = true): boolean {
  const texto = String(valor ?? "").trim().toLowerCase();
  if (!texto) return defaultValue;
  return ["true", "1", "si", "sí", "s"].includes(texto);
}

function parseCSV(contenido: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < contenido.length; i++) {
    const ch = contenido[i];
    const next = contenido[i + 1];

    if (ch === '"') {
      if (enComillas && next === '"') {
        campo += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
      continue;
    }

    if (ch === "," && !enComillas) {
      fila.push(campo);
      campo = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !enComillas) {
      if (ch === "\r" && next === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      continue;
    }

    campo += ch;
  }

  fila.push(campo);
  filas.push(fila);
  return filas;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
