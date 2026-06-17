import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/productos`
  : null

async function llamarEdgeFunction(method, path, body) {
  if (!EDGE_FN_URL) throw new Error('VITE_SUPABASE_URL no configurado')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  const res = await fetch(`${EDGE_FN_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
  return json
}

function mapearProducto(p) {
  const pa = (p.producto_principio_activo || []).map(pa => ({
    id: pa.id,
    principioActivoId: pa.principios_activos?.id || pa.principio_activo_id,
    principioActivoNombre: pa.principios_activos?.nombre,
    codigoAtc: pa.principios_activos?.codigo_atc,
    concentracion: pa.concentracion,
    unidadMedidaId: pa.unidades_medida?.id || pa.unidad_medida_id,
    unidadMedidaNombre: pa.unidades_medida?.nombre,
    unidadMedidaSimbolo: pa.unidades_medida?.simbolo,
  }))

  const pp = (p.proveedor_producto || []).map(pp => ({
    id: pp.id,
    proveedorId: pp.proveedores?.id || pp.proveedor_id,
    proveedorNombre: pp.proveedores?.razon_social,
    leadTimeEspecifico: pp.lead_time_especifico,
    precioCompraReferencial: pp.precio_compra_referencial,
  }))

  return {
    id: p.id,
    nombreComercial: p.nombre_comercial,
    formaFarmaceuticaId: p.forma_farmaceutica_id,
    formaFarmaceuticaNombre: p.formas_farmaceuticas?.nombre,
    presentacion: p.presentacion,
    clasificacion: p.clasificacion,
    estado: p.estado,
    createdAt: p.created_at,
    modifiedAt: p.modified_at,
    principiosActivos: pa,
    proveedores: pp,
  }
}

export async function obtenerProductos({ activos } = {}) {
  const params = new URLSearchParams()
  if (activos) params.set('activos', 'true')
  const qs = params.toString()
  const { datos } = await llamarEdgeFunction('GET', qs ? `?${qs}` : '')
  return Array.isArray(datos) ? datos.map(mapearProducto) : []
}

export async function obtenerProductoPorId(id) {
  const { datos } = await llamarEdgeFunction('GET', `/${id}`)
  return datos ? mapearProducto(datos) : null
}

export async function crearProducto(datos) {
  const body = {
    nombre_comercial: datos.nombreComercial,
    forma_farmaceutica_id: datos.formaFarmaceuticaId || null,
    presentacion: datos.presentacion || null,
    clasificacion: datos.clasificacion,
    estado: datos.estado || 'activo',
    principios_activos: (datos.principiosActivos || []).map(pa => ({
      principio_activo_id: pa.principioActivoId,
      concentracion: pa.concentracion,
      unidad_medida_id: pa.unidadMedidaId || null,
    })),
  }
  return llamarEdgeFunction('POST', '', body)
}

export async function actualizarProducto(id, datos) {
  const body = {
    nombre_comercial: datos.nombreComercial,
    forma_farmaceutica_id: datos.formaFarmaceuticaId,
    presentacion: datos.presentacion,
    clasificacion: datos.clasificacion,
    estado: datos.estado,
    principios_activos: (datos.principiosActivos || []).map(pa => ({
      principio_activo_id: pa.principioActivoId,
      concentracion: pa.concentracion,
      unidad_medida_id: pa.unidadMedidaId || null,
    })),
  }
  return llamarEdgeFunction('PATCH', `/${id}`, body)
}

export async function toggleProducto(id) {
  return llamarEdgeFunction('PATCH', `/${id}/toggle`)
}

export async function desactivarProducto(id) {
  return toggleProducto(id)
}
