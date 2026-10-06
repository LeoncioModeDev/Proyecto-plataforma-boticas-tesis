import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const RUTA_REPORTE = 'reports/integracion/diagnostico_duplicados_bd.json'

function parseEnv(contenido) {
  return Object.fromEntries(
    contenido
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea && !linea.startsWith('#') && linea.includes('='))
      .map((linea) => {
        const indice = linea.indexOf('=')
        const clave = linea.slice(0, indice).trim()
        const valor = linea.slice(indice + 1).trim().replace(/^['"]|['"]$/g, '')
        return [clave, valor]
      }),
  )
}

async function cargarEnv() {
  const env = { ...process.env }
  try {
    Object.assign(env, parseEnv(await readFile('.env', 'utf8')))
  } catch {
    // El entorno CI puede inyectar variables sin archivo .env.
  }
  return env
}

function clavePartes(partes) {
  return partes.map((parte) => parte ?? '__NULL__').join('|')
}

function agruparDuplicados(tabla, filas, obtenerClave, obtenerValores, reglaSugerida) {
  const grupos = new Map()

  for (const fila of filas) {
    const clave = obtenerClave(fila)
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(fila)
  }

  return [...grupos.entries()]
    .filter(([, grupo]) => grupo.length > 1)
    .map(([clave, grupo]) => ({
      tabla,
      clave_duplicada: clave,
      cantidad_registros: grupo.length,
      ids_afectados: grupo.map((fila) => fila.id),
      valores_relevantes: grupo.map(obtenerValores),
      regla_sugerida: reglaSugerida,
      accion_aplicada: 'ninguna_en_diagnostico',
      requiere_revision_manual: true,
    }))
}

async function seleccionar(supabase, tabla, columnas) {
  const { data, error } = await supabase.from(tabla).select(columnas)
  if (error) {
    return { data: [], error: { tabla, message: error.message, code: error.code } }
  }
  return { data: data ?? [], error: null }
}

async function seleccionarConFallback(supabase, tabla, consultas) {
  const errores = []
  for (const columnas of consultas) {
    const resultado = await seleccionar(supabase, tabla, columnas)
    if (!resultado.error) return { ...resultado, errores }
    errores.push(resultado.error)
  }
  return { data: [], error: errores.at(-1), errores }
}

function mapaPorId(filas) {
  return new Map(filas.map((fila) => [fila.id, fila]))
}

async function main() {
  const env = await cargarEnv()
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const serviceRole = env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error('Faltan VITE_SUPABASE_URL/SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE/SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const errores = []
  const [productosRes, boticasRes, proveedoresRes] = await Promise.all([
    seleccionar(supabase, 'productos', 'id, org_id, codigo_interno, nombre_comercial, estado'),
    seleccionar(supabase, 'boticas', 'id, org_id, codigo_interno, nombre, tipo, activa'),
    seleccionar(supabase, 'proveedores', 'id, org_id, codigo_interno, razon_social'),
  ])

  for (const res of [productosRes, boticasRes, proveedoresRes]) {
    if (res.error) errores.push(res.error)
  }

  const productos = mapaPorId(productosRes.data)
  const boticas = mapaPorId(boticasRes.data)
  const proveedores = mapaPorId(proveedoresRes.data)

  const consultas = await Promise.all([
    seleccionarConFallback(supabase, 'proveedor_producto', [
      'id, org_id, proveedor_id, producto_id, lead_time_dias, lead_time_especifico, precio_referencial, precio_compra, precio_compra_referencial, cantidad_minima_compra, multiplo_empaque, activo, created_at, updated_at',
      'id, org_id, proveedor_id, producto_id, lead_time_dias, lead_time_especifico, precio_referencial, precio_compra_referencial, cantidad_minima_compra, multiplo_empaque, activo, created_at, updated_at',
      'id, proveedor_id, producto_id, lead_time_especifico, precio_compra_referencial, created_at',
    ]),
    seleccionar(supabase, 'stock_ubicaciones', 'id, org_id, producto_id, ubicacion_tipo, ubicacion_id, cantidad_disponible, stock_minimo, stock_maximo, stock_por_recibir, stock_en_transito, stock_comprometido, updated_at'),
    seleccionar(supabase, 'stock_historico', 'id, org_id, producto_id, ubicacion_tipo, ubicacion_id, fecha_snapshot_dia, cantidad_disponible, stock_minimo, stock_maximo, created_at'),
    seleccionar(supabase, 'lotes', 'id, org_id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote, fecha_vencimiento, cantidad, proveedor_id'),
    seleccionar(supabase, 'predicciones_ml', 'id, org_id, producto_id, botica_id, periodo_inicio, modelo_version_id, cantidad_predicha, generado_en'),
    seleccionar(supabase, 'inferencias', 'id, org_id, producto_id, botica_id, fecha_pred, modelo_version_id, valor_pred, created_at, updated_at'),
  ])

  for (const res of consultas) {
    if (res.error) errores.push(res.error)
  }

  const [proveedorProducto, stockUbicaciones, stockHistorico, lotes, predicciones, inferencias] = consultas.map((res) => res.data)
  const duplicados = []

  duplicados.push(...agruparDuplicados(
    'proveedor_producto',
    proveedorProducto,
    (fila) => clavePartes([fila.org_id || proveedores.get(fila.proveedor_id)?.org_id || productos.get(fila.producto_id)?.org_id, fila.proveedor_id, fila.producto_id]),
    (fila) => ({
      id: fila.id,
      org_id: fila.org_id,
      proveedor_org_id: proveedores.get(fila.proveedor_id)?.org_id ?? null,
      producto_org_id: productos.get(fila.producto_id)?.org_id ?? null,
      proveedor_id: fila.proveedor_id,
      producto_id: fila.producto_id,
      lead_time_dias: fila.lead_time_dias,
      lead_time_especifico: fila.lead_time_especifico,
      precio_referencial: fila.precio_referencial,
      precio_compra: fila.precio_compra,
      precio_compra_referencial: fila.precio_compra_referencial,
      activo: fila.activo,
      created_at: fila.created_at,
      updated_at: fila.updated_at,
    }),
    'Conservar solo si la relacion org_id+proveedor+producto es unica; si hay duplicados, revisar condiciones comerciales antes de consolidar.',
  ))

  duplicados.push(...agruparDuplicados(
    'stock_ubicaciones',
    stockUbicaciones,
    (fila) => clavePartes([fila.org_id || productos.get(fila.producto_id)?.org_id, fila.producto_id, fila.ubicacion_tipo, fila.ubicacion_id]),
    (fila) => ({
      id: fila.id,
      org_id: fila.org_id,
      producto_org_id: productos.get(fila.producto_id)?.org_id ?? null,
      botica_org_id: boticas.get(fila.ubicacion_id)?.org_id ?? null,
      producto_id: fila.producto_id,
      ubicacion_tipo: fila.ubicacion_tipo,
      ubicacion_id: fila.ubicacion_id,
      cantidad_disponible: fila.cantidad_disponible,
      stock_minimo: fila.stock_minimo,
      stock_maximo: fila.stock_maximo,
      stock_por_recibir: fila.stock_por_recibir,
      stock_en_transito: fila.stock_en_transito,
      stock_comprometido: fila.stock_comprometido,
      updated_at: fila.updated_at,
    }),
    'No sumar automaticamente. Clasificar si son identicos, importacion repetida o cantidades parciales antes de crear UNIQUE.',
  ))

  duplicados.push(...agruparDuplicados(
    'stock_historico',
    stockHistorico,
    (fila) => clavePartes([fila.org_id || productos.get(fila.producto_id)?.org_id, fila.producto_id, fila.ubicacion_tipo, fila.ubicacion_id, fila.fecha_snapshot_dia]),
    (fila) => ({
      id: fila.id,
      org_id: fila.org_id,
      producto_id: fila.producto_id,
      ubicacion_tipo: fila.ubicacion_tipo,
      ubicacion_id: fila.ubicacion_id,
      fecha_snapshot_dia: fila.fecha_snapshot_dia,
      cantidad_disponible: fila.cantidad_disponible,
      stock_minimo: fila.stock_minimo,
      stock_maximo: fila.stock_maximo,
      created_at: fila.created_at,
    }),
    'Conservar snapshot mas reciente solo si representa repeticion; de lo contrario requiere revision manual.',
  ))

  duplicados.push(...agruparDuplicados(
    'lotes',
    lotes,
    (fila) => clavePartes([fila.org_id || productos.get(fila.producto_id)?.org_id, fila.producto_id, fila.ubicacion_tipo, fila.ubicacion_id, fila.numero_lote]),
    (fila) => ({
      id: fila.id,
      org_id: fila.org_id,
      producto_org_id: productos.get(fila.producto_id)?.org_id ?? null,
      botica_org_id: boticas.get(fila.ubicacion_id)?.org_id ?? null,
      proveedor_org_id: proveedores.get(fila.proveedor_id)?.org_id ?? null,
      producto_id: fila.producto_id,
      ubicacion_tipo: fila.ubicacion_tipo,
      ubicacion_id: fila.ubicacion_id,
      numero_lote: fila.numero_lote,
      fecha_vencimiento: fila.fecha_vencimiento,
      proveedor_id: fila.proveedor_id,
      cantidad: fila.cantidad,
    }),
    'Comparar vencimiento, proveedor y cantidad. Conservar una fila solo si es duplicado identico; sumar solo con evidencia de ingresos independientes.',
  ))

  duplicados.push(...agruparDuplicados(
    'predicciones_ml',
    predicciones,
    (fila) => clavePartes([fila.org_id || boticas.get(fila.botica_id)?.org_id || productos.get(fila.producto_id)?.org_id, fila.producto_id, fila.botica_id, fila.periodo_inicio, fila.modelo_version_id]),
    (fila) => ({
      id: fila.id,
      org_id: fila.org_id,
      producto_org_id: productos.get(fila.producto_id)?.org_id ?? null,
      botica_org_id: boticas.get(fila.botica_id)?.org_id ?? null,
      producto_id: fila.producto_id,
      botica_id: fila.botica_id,
      periodo_inicio: fila.periodo_inicio,
      modelo_version_id: fila.modelo_version_id,
      cantidad_predicha: fila.cantidad_predicha,
      generado_en: fila.generado_en,
    }),
    'Conservar generacion mas reciente solo si es repeticion de la misma inferencia y misma version de modelo.',
  ))

  duplicados.push(...agruparDuplicados(
    'inferencias',
    inferencias,
    (fila) => clavePartes([fila.org_id || boticas.get(fila.botica_id)?.org_id || productos.get(fila.producto_id)?.org_id, fila.producto_id, fila.botica_id, fila.fecha_pred, fila.modelo_version_id]),
    (fila) => ({
      id: fila.id,
      org_id: fila.org_id,
      producto_org_id: productos.get(fila.producto_id)?.org_id ?? null,
      botica_org_id: boticas.get(fila.botica_id)?.org_id ?? null,
      producto_id: fila.producto_id,
      botica_id: fila.botica_id,
      fecha_pred: fila.fecha_pred,
      modelo_version_id: fila.modelo_version_id,
      valor_pred: fila.valor_pred,
      created_at: fila.created_at,
      updated_at: fila.updated_at,
    }),
    'Conservar registro mas reciente solo si es ejecucion repetida de la misma inferencia y misma version de modelo.',
  ))

  const resumenPorTabla = Object.fromEntries(
    ['proveedor_producto', 'stock_ubicaciones', 'stock_historico', 'lotes', 'predicciones_ml', 'inferencias'].map((tabla) => [
      tabla,
      {
        filas_diagnosticadas: {
          proveedor_producto: proveedorProducto.length,
          stock_ubicaciones: stockUbicaciones.length,
          stock_historico: stockHistorico.length,
          lotes: lotes.length,
          predicciones_ml: predicciones.length,
          inferencias: inferencias.length,
        }[tabla],
        grupos_duplicados: duplicados.filter((dup) => dup.tabla === tabla).length,
        registros_en_duplicados: duplicados
          .filter((dup) => dup.tabla === tabla)
          .reduce((total, dup) => total + dup.cantidad_registros, 0),
      },
    ]),
  )

  const reporte = {
    generado_en: new Date().toISOString(),
    fuente: 'supabase_remoto',
    nota: 'Diagnostico previo a migracion 36. No consolida ni elimina registros.',
    resumen: {
      tablas_diagnosticadas: Object.keys(resumenPorTabla).length,
      grupos_duplicados: duplicados.length,
      requiere_revision_manual: duplicados.some((dup) => dup.requiere_revision_manual),
    },
    resumen_por_tabla: resumenPorTabla,
    duplicados,
    errores_consulta: errores,
  }

  await mkdir('reports/integracion', { recursive: true })
  await writeFile(RUTA_REPORTE, `${JSON.stringify(reporte, null, 2)}\n`)
  console.log(JSON.stringify({ reporte: RUTA_REPORTE, resumen: reporte.resumen, errores_consulta: errores.length }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
