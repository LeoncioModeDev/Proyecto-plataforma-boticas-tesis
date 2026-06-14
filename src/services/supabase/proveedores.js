import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proveedores`
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

function mapearProveedor(p) {
  return {
    id: p.id,
    razonSocial: p.razon_social,
    tipoIdentificacion: p.tipo_identificacion,
    numeroIdentificacion: p.numero_identificacion,
    paisOrigen: p.pais_origen,
    monedaId: p.moneda_id,
    activo: p.activo,
    createdAt: p.created_at,
    ...(p.monedas && { moneda: { id: p.monedas.id, codigo: p.monedas.codigo, nombre: p.monedas.nombre, simbolo: p.monedas.simbolo } }),
    contactos: (p.contactos_proveedor || []).map(c => ({
      id: c.id,
      proveedorId: c.proveedor_id,
      nombre: c.nombre,
      telefono: c.telefono,
      correo: c.correo,
      direccion: c.direccion,
      ubigeo: c.ubigeo,
      principal: c.principal,
    })),
  }
}

export async function listarProveedores({ activos } = {}) {
  const params = new URLSearchParams()
  if (activos) params.set('activos', 'true')
  const qs = params.toString()
  const { datos } = await llamarEdgeFunction('GET', qs ? `?${qs}` : '')
  return Array.isArray(datos) ? datos.map(mapearProveedor) : []
}

export async function obtenerProveedor(id) {
  const { datos } = await llamarEdgeFunction('GET', `/${id}`)
  return datos ? mapearProveedor(datos) : null
}

export async function crearProveedor(datos) {
  const body = {
    razon_social: datos.razonSocial,
    tipo_identificacion: datos.tipoIdentificacion,
    numero_identificacion: datos.numeroIdentificacion,
    pais_origen: datos.paisOrigen || 'PE',
    moneda_id: datos.monedaId || null,
    contactos: (datos.contactos || []).map(c => ({
      nombre: c.nombre,
      telefono: c.telefono,
      correo: c.correo,
      direccion: c.direccion,
      ubigeo: c.ubigeo,
      principal: c.principal,
    })),
  }
  return llamarEdgeFunction('POST', '', body)
}

export async function actualizarProveedor(id, datos) {
  const body = {
    razon_social: datos.razonSocial,
    tipo_identificacion: datos.tipoIdentificacion,
    numero_identificacion: datos.numeroIdentificacion,
    pais_origen: datos.paisOrigen,
    moneda_id: datos.monedaId || null,
    activo: datos.activo,
    contactos: (datos.contactos || []).map(c => ({
      nombre: c.nombre,
      telefono: c.telefono,
      correo: c.correo,
      direccion: c.direccion,
      ubigeo: c.ubigeo,
      principal: c.principal,
    })),
  }
  return llamarEdgeFunction('PATCH', `/${id}`, body)
}

export async function toggleProveedor(id) {
  return llamarEdgeFunction('PATCH', `/${id}/toggle`)
}