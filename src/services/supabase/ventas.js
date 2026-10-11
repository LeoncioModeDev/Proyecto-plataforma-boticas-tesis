import { supabase } from './cliente'

const EDGE_FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ventas`
  : null

async function obtenerToken() {
  const { data } = await supabase.auth.getSession()
  if (!data.session?.access_token) throw new Error('No hay sesión activa')
  return data.session.access_token
}

async function peticion(method, path = '', body) {
  if (!EDGE_FN_URL) throw new Error('VITE_SUPABASE_URL no configurado')
  const token = await obtenerToken()
  const res = await fetch(`${EDGE_FN_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

function params(filtros = {}) {
  const qs = new URLSearchParams()
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') qs.set(clave, String(valor))
  })
  const texto = qs.toString()
  return texto ? `?${texto}` : ''
}

export function mapearVenta(v) {
  return {
    id: v.id,
    orgId: v.org_id,
    boticaId: v.botica_id,
    botica: v.botica,
    numeroVenta: v.numero_venta,
    fechaVenta: v.fecha_venta,
    registradoPor: v.registrado_por,
    registradoPorNombre: v.registrado_por_nombre,
    subtotal: Number(v.subtotal || 0),
    igv: Number(v.igv || 0),
    total: Number(v.total || 0),
    estado: v.estado,
    resultadoAtencion: v.resultado_atencion,
    motivoAnulacion: v.motivo_anulacion,
    anuladoEn: v.anulado_en,
    cantidadSolicitada: Number(v.cantidad_solicitada || 0),
    cantidadAtendida: Number(v.cantidad_atendida || 0),
    demandaNoAtendida: Number(v.demanda_no_atendida || 0),
    totalItems: Number(v.total_items || 0),
    productosResumen: v.productos_resumen || '',
    items: (v.items || []).map(mapearItemVenta),
  }
}

export function mapearItemVenta(item) {
  return {
    id: item.id,
    productoId: item.producto_id,
    codigoProducto: item.codigo_producto,
    producto: item.producto,
    presentacion: item.presentacion,
    cantidadSolicitada: Number(item.cantidad_solicitada || 0),
    cantidadAtendida: Number(item.cantidad_atendida || 0),
    demandaNoAtendida: Number(item.demanda_no_atendida || 0),
    precioUnitario: Number(item.precio_unitario || 0),
    importeTotal: Number(item.importe_total || 0),
    motivoNoAtencion: item.motivo_no_atencion,
    detalleMotivo: item.detalle_motivo,
    lotes: (item.lotes || []).map(lote => ({
      loteId: lote.lote_id,
      numeroLote: lote.numero_lote,
      fechaVencimiento: lote.fecha_vencimiento,
      cantidad: Number(lote.cantidad || 0),
    })),
  }
}

function mapearProductoVenta(p) {
  return {
    id: p.id,
    codigoProducto: p.codigo_producto,
    producto: p.producto,
    presentacion: p.presentacion,
    categoriaTerapeutica: p.categoria_terapeutica,
    formaFarmaceutica: p.forma_farmaceutica,
    precioUnitario: p.precio_unitario == null ? null : Number(p.precio_unitario),
    precioId: p.precio_id,
    stockDisponible: Number(p.stock_disponible || 0),
    stockFisico: Number(p.stock_fisico || 0),
    stockComprometido: Number(p.stock_comprometido || 0),
    tienePrecioVigente: Boolean(p.tiene_precio_vigente),
  }
}

export async function buscarProductosVenta(filtros = {}) {
  const { datos } = await peticion('GET', `/productos${params(filtros)}`)
  return (datos || []).map(mapearProductoVenta)
}

export async function listarVentas(filtros = {}) {
  const res = await peticion('GET', params(filtros))
  return {
    ...res,
    datos: (res.datos || []).map(mapearVenta),
  }
}

export async function obtenerVenta(id) {
  const { datos } = await peticion('GET', `/${id}`)
  return datos ? mapearVenta(datos) : null
}

export async function registrarVenta({ items, claveIdempotencia }) {
  const { datos } = await peticion('POST', '', {
    clave_idempotencia: claveIdempotencia,
    items: items.map(item => ({
      producto_id: item.productoId,
      cantidad_solicitada: item.cantidadSolicitada,
      motivo_no_atencion: item.motivoNoAtencion || null,
      detalle_motivo: item.detalleMotivo || null,
    })),
  })
  return mapearVenta(datos)
}

export async function anularVenta(id, motivoAnulacion) {
  const { datos } = await peticion('PUT', `/${id}/anular`, { motivo_anulacion: motivoAnulacion })
  return mapearVenta(datos)
}

export async function listarDemandaNoAtendida(filtros = {}) {
  const res = await peticion('GET', `/demanda-no-atendida${params(filtros)}`)
  return {
    ...res,
    datos: (res.datos || []).map(item => ({
      id: item.id,
      ventaId: item.venta_id,
      boticaId: item.botica_id,
      botica: item.botica,
      numeroVenta: item.numero_venta,
      fechaVenta: item.fecha_venta,
      productoId: item.producto_id,
      codigoProducto: item.codigo_producto,
      producto: item.producto,
      cantidadSolicitada: Number(item.cantidad_solicitada || 0),
      cantidadAtendida: Number(item.cantidad_atendida || 0),
      demandaNoAtendida: Number(item.demanda_no_atendida || 0),
      motivoNoAtencion: item.motivo_no_atencion,
      detalleMotivo: item.detalle_motivo,
    })),
  }
}

export async function obtenerReportesVentas(filtros = {}) {
  const { datos } = await peticion('GET', `/reportes${params(filtros)}`)
  return datos
}
