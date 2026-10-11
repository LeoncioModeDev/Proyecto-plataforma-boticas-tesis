import { supabase } from './cliente'

const URL_CONFIG = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/configuracion`
const URL_IMPORTACIONES = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/importaciones-datos`

async function obtenerToken() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('No hay sesión activa')
  return data.session.access_token
}

async function peticion(urlBase, method, path, body = null) {
  const token = await obtenerToken()
  const opciones = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
  if (body) opciones.body = JSON.stringify(body)
  const res = await fetch(`${urlBase}${path}`, opciones)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud')
  return data
}

const MAPEO_CONFIG = {
  id: 'id',
  org_id: 'orgId',
  idioma: 'idioma',
  zona_horaria: 'zonaHoraria',
  formato_fecha: 'formatoFecha',
  formato_hora: 'formatoHora',
  simbolo_moneda: 'simboloMoneda',
  posicion_moneda: 'posicionMoneda',
  nombre_comercial: 'nombreComercial',
  direccion_fiscal: 'direccionFiscal',
  telefono_contacto: 'telefonoContacto',
  email_contacto: 'emailContacto',
  dominio_web: 'dominioWeb',
  permite_stock_negativo: 'permiteStockNegativo',
  control_stock_minimo: 'controlStockMinimo',
  alerta_vencimiento_dias: 'alertaVencimientoDias',
  notificaciones_email: 'notificacionesEmail',
  notificaciones_sistema: 'notificacionesSistema',
  dominios_correo_permitidos: 'dominiosCorreoPermitidos',
  dominio_correo_organizacion: 'dominioCorreoOrganizacion',
  umbral_sobrestock_dias: 'umbralSobrestockDias',
  horizonte_alerta_quiebre_dias: 'horizonteAlertaQuiebreDias',
  pipeline_activo: 'pipelineActivo',
  snapshot_automatico: 'snapshotAutomatico',
  dias_historial_prediccion: 'diasHistorialPrediccion',
  algoritmo_prediccion: 'algoritmoPrediccion',
  umbral_mape_maximo: 'umbralMapeMaximo',
  frecuencia_reentrenamiento_dias: 'frecuenciaReentrenamientoDias',
  datos_desde: 'datosDesde',
  datos_hasta: 'datosHasta',
  created_at: 'createdAt',
  modified_at: 'modifiedAt',
}

const MAPA_INVERSO = Object.fromEntries(
  Object.entries(MAPEO_CONFIG).map(([k, v]) => [v, k])
)

function mapearConfig(datos) {
  const result = {}
  for (const [key, value] of Object.entries(datos)) {
    const mappedKey = MAPEO_CONFIG[key] || key
    result[mappedKey] = value
  }
  return result
}

function mapearInverso(datos) {
  const result = {}
  for (const [key, value] of Object.entries(datos)) {
    const mappedKey = MAPA_INVERSO[key] || key
    result[mappedKey] = value
  }
  return result
}

export async function obtenerConfiguracion() {
  const { datos } = await peticion(URL_CONFIG, 'GET', '')
  return mapearConfig(datos)
}

export async function actualizarConfiguracion(campos) {
  const body = mapearInverso(campos)
  const { exito } = await peticion(URL_CONFIG, 'PATCH', '', body)
  return { exito }
}

export async function listarImportaciones(filtros = {}) {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.estado) params.set('estado', filtros.estado)
  if (filtros.pagina) params.set('pagina', String(filtros.pagina))
  if (filtros.limite) params.set('limite', String(filtros.limite))
  const qs = params.toString()
  return peticion(URL_IMPORTACIONES, 'GET', qs ? `?${qs}` : '')
}

export async function obtenerImportacion(id) {
  const { datos } = await peticion(URL_IMPORTACIONES, 'GET', `/${id}`)
  return datos
}

export async function descargarErrores(id) {
  const token = await obtenerToken()
  const res = await fetch(`${URL_IMPORTACIONES}/${id}/errores`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al descargar errores')
  return res.text()
}

export async function descargarPlantilla(tipo) {
  const token = await obtenerToken()
  const res = await fetch(`${URL_IMPORTACIONES}/plantillas/${tipo}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Error al descargar plantilla')
  return res.text()
}

export async function validarImportacion(tipo, rutaArchivo, nombreOriginal, mimeType, tamanoBytes) {
  return peticion(URL_IMPORTACIONES, 'POST', `/${tipo}/validar`, {
    ruta_archivo: rutaArchivo,
    nombre_archivo_original: nombreOriginal,
    mime_type: mimeType,
    tamano_bytes: tamanoBytes,
  })
}

export async function ejecutarImportacion(tipo, importacionId) {
  return peticion(URL_IMPORTACIONES, 'POST', `/${tipo}/importar`, {
    importacion_id: importacionId,
  })
}

export async function subirArchivoStorage(file, orgId, importacionId) {
  const ruta = `${orgId}/${importacionId}/${file.name}`
  const { error } = await supabase.storage
    .from('importaciones-datos')
    .upload(ruta, file, {
      cacheControl: '3600',
      upsert: true,
    })
  if (error) throw new Error(`Error al subir archivo: ${error.message}`)
  return ruta
}
