import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const RUTA_PRODUCTOS = 'modelo-ml/data/importacion_plataforma/03_productos.csv'
const RUTA_REPORTE = 'reports/integracion/productos_importacion_parcial.json'

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

function parseCsvSimple(contenido) {
  const lineas = contenido.split(/\r?\n/).filter((linea) => linea.trim())
  const headers = lineas[0].split(',')
  return lineas.slice(1).map((linea, index) => ({
    fila_origen: index + 2,
    ...Object.fromEntries(headers.map((h, i) => [h, linea.split(',')[i] ?? ''])),
  }))
}

async function main() {
  const env = await cargarEnv()
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE
  if (!url || !serviceRole) throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')

  const productosCsv = parseCsvSimple(await readFile(RUTA_PRODUCTOS, 'utf8'))
  const codigos = productosCsv.map((p) => p.codigo_interno).filter(Boolean)
  const filaPorCodigo = new Map(productosCsv.map((p) => [p.codigo_interno, p.fila_origen]))
  const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data, error } = await supabase
    .from('productos')
    .select(`
      id,
      codigo_interno,
      nombre_comercial,
      categoria_terapeutica_id,
      producto_principio_activo(id, principio_activo_id)
    `)
    .in('codigo_interno', codigos)
    .order('codigo_interno')

  if (error) throw new Error(error.message)

  const porCodigo = new Map()
  for (const producto of data ?? []) {
    if (!porCodigo.has(producto.codigo_interno)) porCodigo.set(producto.codigo_interno, [])
    porCodigo.get(producto.codigo_interno).push(producto)
  }

  const resultados = []
  for (const codigo of codigos) {
    const encontrados = porCodigo.get(codigo) ?? []
    if (encontrados.length === 0) {
      resultados.push({
        codigo_interno: codigo,
        producto_id: null,
        categoria_asignada: false,
        principios_activos_asociados: 0,
        fila_origen: filaPorCodigo.get(codigo),
        estado: 'no_importado',
        accion_aplicada: 'ninguna',
      })
      continue
    }
    for (const producto of encontrados) {
      const cantidadPrincipios = producto.producto_principio_activo?.length ?? 0
      const incompleto = !producto.categoria_terapeutica_id || cantidadPrincipios === 0
      resultados.push({
        codigo_interno: codigo,
        producto_id: producto.id,
        categoria_asignada: Boolean(producto.categoria_terapeutica_id),
        principios_activos_asociados: cantidadPrincipios,
        fila_origen: filaPorCodigo.get(codigo),
        estado: encontrados.length > 1 ? 'duplicado' : incompleto ? 'incompleto' : 'completo',
        accion_aplicada: 'diagnostico_sin_cambios',
      })
    }
  }

  const reporte = {
    generado_en: new Date().toISOString(),
    total_codigos_paquete: codigos.length,
    productos_encontrados: resultados.filter((r) => r.producto_id).length,
    productos_no_importados: resultados.filter((r) => r.estado === 'no_importado').length,
    productos_incompletos: resultados.filter((r) => r.estado === 'incompleto').length,
    productos_duplicados: resultados.filter((r) => r.estado === 'duplicado').length,
    resultados,
  }

  await mkdir(dirname(RUTA_REPORTE), { recursive: true })
  await writeFile(RUTA_REPORTE, `${JSON.stringify(reporte, null, 2)}\n`)
  console.log(JSON.stringify({ reporte: RUTA_REPORTE, ...reporte, resultados: undefined }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
