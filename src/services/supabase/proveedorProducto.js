import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proveedor-producto`
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

export async function listarPorProducto(productoId) {
  const { datos } = await llamarEdgeFunction('GET', `?producto_id=${productoId}`)
  return Array.isArray(datos) ? datos.map(r => ({
    id: r.id,
    proveedorId: r.proveedor_id,
    productoId: r.producto_id,
    leadTimeEspecifico: r.lead_time_especifico,
    precioCompra: r.precio_compra,
    proveedorNombre: r.proveedores?.razon_social,
    proveedorActivo: r.proveedores?.activo,
  })) : []
}

export async function guardarRelacion({ proveedorId, productoId, leadTimeEspecifico, precioCompra }) {
  return llamarEdgeFunction('POST', '', {
    proveedor_id: proveedorId,
    producto_id: productoId,
    lead_time_especifico: leadTimeEspecifico,
    precio_compra: precioCompra,
  })
}

export async function eliminarRelacion(id) {
  return llamarEdgeFunction('DELETE', `/${id}`)
}
