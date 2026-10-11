import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parse } from 'node:path'

const RUTA_PAQUETE = 'modelo-ml/data/importacion_plataforma'
const RUTA_VALIDACION = `${RUTA_PAQUETE}/reporte_validacion_paquete.json`
const RUTA_REPORTE = 'reports/integracion/dry_run_importacion_plataforma.json'

const ARCHIVOS = [
  ['01_categorias_terapeuticas.csv', 'categorias_terapeuticas'],
  ['02_boticas.csv', 'boticas'],
  ['03_productos.csv', 'productos'],
  ['04_proveedores.csv', 'proveedores'],
  ['05_proveedor_producto.csv', 'proveedor_producto'],
  ['06_precios.csv', 'precios'],
  ['07_stock_inicial.csv', 'stock_inicial'],
  ['08_stock_historico.csv', 'stock_historico'],
  ['09_ventas_historicas.csv', 'ventas_historicas'],
]

function parseEnv(contenido) {
  return Object.fromEntries(
    contenido
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea && !linea.startsWith('#') && linea.includes('='))
      .map((linea) => {
        const indice = linea.indexOf('=')
        return [linea.slice(0, indice).trim(), linea.slice(indice + 1).trim().replace(/^['"]|['"]$/g, '')]
      }),
  )
}

async function cargarEnv() {
  const env = { ...process.env }
  try { Object.assign(env, parseEnv(await readFile('.env', 'utf8'))) } catch {}
  return env
}

async function contarFilasCsv(ruta) {
  const contenido = await readFile(ruta, 'utf8')
  return contenido.split(/\r?\n/).filter((linea) => linea.trim() && !linea.startsWith('#')).length - 1
}

function parseCsvSimple(contenido) {
  const lineas = contenido.split(/\r?\n/).filter((linea) => linea.trim())
  const headers = lineas[0].split(',')
  return lineas.slice(1).map((linea) => Object.fromEntries(headers.map((h, i) => [h, linea.split(',')[i] ?? ''])))
}

async function main() {
  const validacion = JSON.parse(await readFile(RUTA_VALIDACION, 'utf8'))
  const env = await cargarEnv()
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const serviceRole = env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY

  let productosSinCategoria = []
  if (url && serviceRole) {
    const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data } = await supabase
      .from('vw_productos_activos_sin_categoria')
      .select('codigo_interno, nombre_comercial')
      .order('codigo_interno')
    const productosPaquete = parseCsvSimple(await readFile(`${RUTA_PAQUETE}/03_productos.csv`, 'utf8'))
    const codigosPaquete = new Set(productosPaquete.map((fila) => fila.codigo_interno))
    productosSinCategoria = (data ?? []).map((fila) => ({
      codigo_interno: fila.codigo_interno,
      nombre: fila.nombre_comercial,
      coincide_con_paquete: codigosPaquete.has(fila.codigo_interno),
      accion_recomendada: codigosPaquete.has(fila.codigo_interno)
        ? 'La futura importacion de productos debe hacer upsert y asignar categoria_terapeutica_id.'
        : 'No incluir en el paquete, no eliminar y no categorizar automaticamente.',
    }))
  }

  const archivos = []
  for (const [archivo, tipo] of ARCHIVOS) {
    const total = await contarFilasCsv(`${RUTA_PAQUETE}/${archivo}`)
    archivos.push({
      archivo,
      tipo_importacion: tipo,
      total_filas: total,
      filas_validas: validacion.valido ? total : 0,
      filas_invalidas: validacion.valido ? 0 : total,
      total_errores: validacion.valido ? 0 : validacion.errores.length,
      errores_principales: validacion.errores.slice(0, 10),
    })
  }

  const reporte = {
    generado_en: new Date().toISOString(),
    modo: 'dry_run_local_estructural',
    edge_function_dry_run: {
      ejecutado: false,
      motivo: 'No se ejecuta dry-run Edge completo porque esta fase no debe importar datos previos. Los archivos dependientes fallarian si categorias/productos/proveedores aun no existen en Supabase.',
    },
    valido: validacion.valido,
    archivos,
    productos_existentes_sin_categoria: productosSinCategoria,
  }

  await mkdir(parse(RUTA_REPORTE).dir, { recursive: true })
  await writeFile(RUTA_REPORTE, `${JSON.stringify(reporte, null, 2)}\n`)
  console.log(JSON.stringify({ reporte: RUTA_REPORTE, valido: reporte.valido, archivos: archivos.length }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
