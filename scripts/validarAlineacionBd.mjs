import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const RUTA_REPORTE = 'reports/integracion/validacion_alineacion_bd.json'

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
  try {
    Object.assign(env, parseEnv(await readFile('.env', 'utf8')))
  } catch {
    // Variables inyectadas por entorno.
  }
  return env
}

function cliente(url, key) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function contar(supabase, tabla, aplicarFiltro) {
  let query = supabase.from(tabla).select('id', { count: 'exact', head: true })
  if (aplicarFiltro) query = aplicarFiltro(query)
  const { count, error } = await query
  if (error) return { ok: false, count: null, error: error.message }
  return { ok: true, count: count ?? 0, error: null }
}

async function probarSeleccion(supabase, tabla, columnas = 'id', limite = 1) {
  const { data, error } = await supabase.from(tabla).select(columnas).limit(limite)
  return { ok: !error, filas: data?.length ?? 0, error: error?.message ?? null }
}

async function crearUsuarioTemporal(admin, anonUrl, anonKey, orgId, rol, boticaId = null) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const email = `test-${rol}-${sufijo}@rls.local`
  const password = `Tmp-${sufijo}-Aa1!`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { rol, org_id: orgId, botica_id: boticaId },
  })
  if (error) throw new Error(`No se pudo crear usuario temporal ${rol}: ${error.message}`)

  const userId = data.user.id
  const { error: perfilError } = await admin.from('usuarios').upsert({
    id: userId,
    org_id: orgId,
    email,
    nombre: `Test ${rol}`,
    rol,
    botica_id: boticaId,
    activo: true,
  }, { onConflict: 'id' })
  if (perfilError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw new Error(`No se pudo crear perfil temporal ${rol}: ${perfilError.message}`)
  }

  const anon = cliente(anonUrl, anonKey)
  const { data: sesion, error: loginError } = await anon.auth.signInWithPassword({ email, password })
  if (loginError) throw new Error(`No se pudo iniciar sesion temporal ${rol}: ${loginError.message}`)

  return { id: userId, email, cliente: anon, accessToken: sesion.session.access_token }
}

async function eliminarUsuarioTemporal(admin, usuario) {
  if (!usuario?.id) return
  await admin.from('usuarios').delete().eq('id', usuario.id)
  await admin.auth.admin.deleteUser(usuario.id)
}

async function validarRls(admin, url, anonKey, organizaciones) {
  const resultado = {
    ejecutada: false,
    motivo_omision: null,
    pruebas: [],
  }

  if (organizaciones.length < 2) {
    resultado.motivo_omision = 'Se requieren al menos dos organizaciones existentes. No se crea una organizacion nueva por restriccion del alcance.'
    return resultado
  }

  const [orgA, orgB] = organizaciones
  const creados = []
  const categoriasCreadas = []

  try {
    const adminA = await crearUsuarioTemporal(admin, url, anonKey, orgA.id, 'operador_drogueria')
    const adminB = await crearUsuarioTemporal(admin, url, anonKey, orgB.id, 'operador_drogueria')
    const superAdmin = await crearUsuarioTemporal(admin, url, anonKey, orgA.id, 'super_admin')
    creados.push(adminA, adminB, superAdmin)

    const categoriaA = { org_id: orgA.id, codigo: `RLS-A-${Date.now()}`, nombre: `RLS A ${Date.now()}`, activo: true }
    const categoriaB = { org_id: orgB.id, codigo: `RLS-B-${Date.now()}`, nombre: `RLS B ${Date.now()}`, activo: true }
    const { data: catA, error: errA } = await admin.from('categorias_terapeuticas').insert(categoriaA).select('id').single()
    const { data: catB, error: errB } = await admin.from('categorias_terapeuticas').insert(categoriaB).select('id').single()
    if (errA || errB) throw new Error(`No se pudieron crear categorias temporales RLS: ${errA?.message || errB?.message}`)
    categoriasCreadas.push(catA.id, catB.id)

    const { data: lecturaA } = await adminA.cliente.from('categorias_terapeuticas').select('id, org_id').order('org_id')
    const { data: lecturaB } = await adminB.cliente.from('categorias_terapeuticas').select('id, org_id').order('org_id')
    const { data: lecturaSuper } = await superAdmin.cliente.from('categorias_terapeuticas').select('id, org_id').in('id', categoriasCreadas)

    const { error: insercionCruzadaA } = await adminA.cliente.from('categorias_terapeuticas').insert({
      org_id: orgB.id,
      codigo: `RLS-X-${Date.now()}`,
      nombre: `RLS cruzada ${Date.now()}`,
    })

    const { data: catSuper, error: insercionSuper } = await superAdmin.cliente.from('categorias_terapeuticas').insert({
      org_id: orgB.id,
      codigo: `RLS-S-${Date.now()}`,
      nombre: `RLS super ${Date.now()}`,
    }).select('id').single()
    if (!insercionSuper && catSuper?.id) categoriasCreadas.push(catSuper.id)

    const { count: auditoriaSuper } = await admin
      .from('auditoria')
      .select('id', { count: 'exact', head: true })
      .eq('entidad', 'categorias_terapeuticas')
      .eq('entidad_id', catSuper?.id ?? '00000000-0000-0000-0000-000000000000')

    resultado.ejecutada = true
    resultado.pruebas.push({ nombre: 'operador A no lee categorias B', ok: (lecturaA ?? []).every((fila) => fila.org_id === orgA.id) })
    resultado.pruebas.push({ nombre: 'operador B no lee categorias A', ok: (lecturaB ?? []).every((fila) => fila.org_id === orgB.id) })
    resultado.pruebas.push({ nombre: 'operador A no escribe org B', ok: Boolean(insercionCruzadaA) })
    resultado.pruebas.push({ nombre: 'super_admin lee ambas organizaciones', ok: (lecturaSuper ?? []).some((fila) => fila.org_id === orgA.id) && (lecturaSuper ?? []).some((fila) => fila.org_id === orgB.id) })
    resultado.pruebas.push({ nombre: 'super_admin escribe org B', ok: !insercionSuper && Boolean(catSuper?.id) })
    resultado.pruebas.push({ nombre: 'accion super_admin auditada', ok: (auditoriaSuper ?? 0) > 0 })
  } finally {
    if (categoriasCreadas.length > 0) await admin.from('categorias_terapeuticas').delete().in('id', categoriasCreadas)
    await Promise.all(creados.map((usuario) => eliminarUsuarioTemporal(admin, usuario)))
  }

  return resultado
}

async function main() {
  const env = await cargarEnv()
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY
  const serviceRole = env.VITE_SUPABASE_SERVICE_ROLE || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceRole) throw new Error('Faltan credenciales Supabase en entorno')

  const admin = cliente(url, serviceRole)
  const anon = cliente(url, anonKey)

  const { data: organizaciones, error: orgError } = await admin.from('organizaciones').select('id, nombre').order('created_at')
  if (orgError) throw new Error(orgError.message)

  const checks = {}
  checks.categorias_accesible = await probarSeleccion(admin, 'categorias_terapeuticas', 'id, org_id, codigo')
  checks.productos_sin_categoria = await contar(admin, 'vw_productos_activos_sin_categoria')
  checks.precios_sin_org_id = await contar(admin, 'precios', (q) => q.is('org_id', null))
  checks.ventas_sin_importacion_id = await contar(admin, 'ventas_historicas', (q) => q.is('importacion_id', null))
  checks.predicciones_sin_org_id = await contar(admin, 'predicciones_ml', (q) => q.is('org_id', null))
  checks.inferencias_sin_org_id = await contar(admin, 'inferencias', (q) => q.is('org_id', null))
  checks.alertas_sin_org_id = await contar(admin, 'alertas_ml', (q) => q.is('org_id', null))
  checks.recomendaciones_sin_org_id = await contar(admin, 'recomendaciones_ml', (q) => q.is('org_id', null))
  checks.drift_sin_org_id = await contar(admin, 'drift_metricas', (q) => q.is('org_id', null))
  checks.vista_ml = await probarSeleccion(admin, 'vw_demanda_semanal_ml', 'fecha_semana, org_id, botica_id, producto_id, categoria_terapeutica, cantidad_vendida, lead_time_dias', 1000)
  checks.anon_sin_jwt_categorias = await probarSeleccion(anon, 'categorias_terapeuticas', 'id', 1)

  const { data: vistaFilas, error: vistaError } = await admin
    .from('vw_demanda_semanal_ml')
    .select('fecha_semana, org_id, botica_id, producto_id, cantidad_vendida')
    .limit(10000)
  const clavesVista = new Set()
  let duplicadosVista = 0
  let semanasCero = 0
  if (!vistaError) {
    for (const fila of vistaFilas ?? []) {
      const clave = `${fila.org_id}|${fila.botica_id}|${fila.producto_id}|${fila.fecha_semana}`
      if (clavesVista.has(clave)) duplicadosVista += 1
      clavesVista.add(clave)
      if (Number(fila.cantidad_vendida) === 0) semanasCero += 1
    }
  }

  const rls = await validarRls(admin, url, anonKey, organizaciones ?? [])

  const pruebas = [
    { nombre: 'categorias_terapeuticas consultable', ok: checks.categorias_accesible.ok },
    { nombre: 'precios org_id obligatorio', ok: checks.precios_sin_org_id.ok && checks.precios_sin_org_id.count === 0 },
    { nombre: 'predicciones_ml org_id obligatorio', ok: checks.predicciones_sin_org_id.ok && checks.predicciones_sin_org_id.count === 0 },
    { nombre: 'inferencias org_id obligatorio', ok: checks.inferencias_sin_org_id.ok && checks.inferencias_sin_org_id.count === 0 },
    { nombre: 'alertas_ml org_id obligatorio', ok: checks.alertas_sin_org_id.ok && checks.alertas_sin_org_id.count === 0 },
    { nombre: 'recomendaciones_ml org_id obligatorio', ok: checks.recomendaciones_sin_org_id.ok && checks.recomendaciones_sin_org_id.count === 0 },
    { nombre: 'drift_metricas org_id obligatorio', ok: checks.drift_sin_org_id.ok && checks.drift_sin_org_id.count === 0 },
    { nombre: 'vista ML consultable', ok: checks.vista_ml.ok },
    { nombre: 'vista ML sin duplicados en muestra', ok: !vistaError && duplicadosVista === 0 },
    { nombre: 'anonimo sin JWT no lee categorias', ok: checks.anon_sin_jwt_categorias.ok && checks.anon_sin_jwt_categorias.filas === 0 },
    ...(rls.ejecutada ? rls.pruebas : []),
  ]

  const reporte = {
    generado_en: new Date().toISOString(),
    fuente: 'supabase_remoto',
    organizaciones_existentes: organizaciones?.length ?? 0,
    checks,
    vista_ml: {
      filas_muestra: vistaFilas?.length ?? 0,
      duplicados_en_muestra: duplicadosVista,
      semanas_con_cero_en_muestra: semanasCero,
      error: vistaError?.message ?? null,
    },
    rls,
    pruebas,
    resumen: {
      aprobadas: pruebas.filter((prueba) => prueba.ok).length,
      fallidas: pruebas.filter((prueba) => !prueba.ok).length,
      rls_completa: rls.ejecutada,
    },
  }

  await mkdir('reports/integracion', { recursive: true })
  await writeFile(RUTA_REPORTE, `${JSON.stringify(reporte, null, 2)}\n`)
  console.log(JSON.stringify({ reporte: RUTA_REPORTE, resumen: reporte.resumen }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
