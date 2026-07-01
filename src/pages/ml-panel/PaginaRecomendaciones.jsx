import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Eye, XCircle, ShoppingCart, Truck } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import { listarBoticas } from '@/services/supabase/boticas'
import { listarProveedores } from '@/services/supabase/proveedores'
import { obtenerProductos } from '@/services/supabase/productos'
import { crearOrden } from '@/services/supabase/ordenesCompra'
import { crearTransferencia } from '@/services/supabase/transferencias'
import { aprobarRecomendacion, generarRecomendacionCompra, generarRecomendacionReposicion, obtenerRecomendaciones, rechazarRecomendacion } from '@/services/ml-model/recomendacionesML'
import { useMLStatus } from '@/services/ml-model/useMLStatus'

function textoTipo(tipo) {
  return tipo === 'ORDEN_COMPRA' || tipo === 'COMPRA' ? 'COMPRA' : 'REPOSICION_INTERNA'
}

function mapearRecomendacion(r) {
  const datos = r.datos_jsonb || r
  const stockDisponible = Number(datos.stock_disponible ?? r.stock_disponible ?? 0)
  const stockReservado = Number(datos.stock_comprometido ?? r.stock_comprometido ?? 0)
  return {
    id: r.id || datos.recomendacion_id,
    tipo: textoTipo(datos.tipo || r.tipo_recomendacion),
    estado: (r.estado || datos.estado || 'pendiente').toUpperCase(),
    productoId: r.producto_id || datos.producto_id,
    boticaId: r.botica_id || r.botica_destino_id || datos.botica_id,
    proveedorId: r.proveedor_id || datos.proveedor_id,
    drogueriaId: r.botica_origen_id || datos.drogueria_id,
    stockDisponible,
    stockReservado,
    stockLibre: stockDisponible - stockReservado,
    stockEnTransito: Number(datos.stock_en_transito ?? r.stock_en_transito ?? 0),
    stockPorRecibir: Number(datos.stock_por_recibir ?? r.stock_por_recibir ?? 0),
    stockSeguridad: Number(datos.stock_seguridad ?? r.stock_seguridad ?? 0),
    demandaDuranteLeadTime: Number(datos.demanda_durante_lead_time ?? r.demanda_durante_lead_time ?? 0),
    cantidadBase: Number(datos.cantidad_base ?? r.cantidad_base ?? 0),
    cantidadMinimaCompra: datos.cantidad_minima_compra ?? r.cantidad_minima_compra ?? '-',
    multiploEmpaque: datos.multiplo_empaque ?? r.multiplo_empaque ?? '-',
    cantidadFinal: Number(datos.cantidad_final ?? r.cantidad_final ?? r.cantidad_sugerida ?? 0),
    leadTimeDias: datos.lead_time_dias ?? r.lead_time_dias ?? '-',
    precioReferencial: datos.precio_referencial ?? r.precio_referencial ?? 0,
    estrategia: datos.estrategia ?? r.estrategia ?? '-',
    nivelMadurez: datos.nivel_madurez ?? r.nivel_madurez ?? '-',
    motivo: datos.motivo ?? r.motivo,
  }
}

export default function PaginaRecomendaciones() {
  const estadoML = useMLStatus()
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [boticaId, setBoticaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState('COMPRA')
  const [estadoFiltro, setEstadoFiltro] = useState('TODOS')
  const [recomendaciones, setRecomendaciones] = useState([])
  const [detalle, setDetalle] = useState(null)
  const [aprobarRec, setAprobarRec] = useState(null)
  const [creando, setCreando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [boticasData, productosData, proveedoresData, recs] = await Promise.all([
          listarBoticas({ activas: true }),
          obtenerProductos({ activos: true }),
          listarProveedores({ activos: true }),
          obtenerRecomendaciones(),
        ])
        const boticasActivas = boticasData.filter(b => b.tipo === 'botica')
        setBoticas(boticasActivas)
        setProductos(productosData)
        setProveedores(proveedoresData)
        setBoticaId(boticasActivas[0]?.id || '')
        setProductoId(productosData[0]?.id || '')
        setRecomendaciones((recs.recomendaciones || []).map(mapearRecomendacion))
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  const filas = useMemo(() => recomendaciones.filter(r => {
    if (estadoFiltro !== 'TODOS' && r.estado !== estadoFiltro) return false
    if (tipo !== 'TODOS' && r.tipo !== tipo) return false
    if (boticaId && r.boticaId && r.boticaId !== boticaId) return false
    if (productoId && r.productoId && r.productoId !== productoId) return false
    return true
  }), [recomendaciones, estadoFiltro, tipo, boticaId, productoId])

  async function recargar() {
    const recs = await obtenerRecomendaciones()
    setRecomendaciones((recs.recomendaciones || []).map(mapearRecomendacion))
  }

  async function generar() {
    setCargando(true)
    setError(null)
    try {
      if (tipo === 'COMPRA') {
        await generarRecomendacionCompra({ almacen_id: boticaId, producto_id: productoId, horizonte_semanas: 12, nivel_servicio: 0.9 })
      } else {
        await generarRecomendacionReposicion({ botica_id: boticaId, drogueria_id: boticaId, producto_id: productoId, horizonte_semanas: 12, nivel_servicio: 0.9 })
      }
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function rechazar(id) {
    try {
      const motivo = window.prompt('Motivo del rechazo')
      if (motivo === null) return
      await rechazarRecomendacion(id, motivo)
      await recargar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function aprobarYCrear() {
    if (!aprobarRec) return
    setCreando(true)
    setError(null)
    try {
      await aprobarRecomendacion(aprobarRec.id)

      if (aprobarRec.tipo === 'COMPRA') {
        const fechaEntrega = new Date()
        const leadTime = Number(aprobarRec.leadTimeDias) || 7
        fechaEntrega.setDate(fechaEntrega.getDate() + leadTime)
        await crearOrden({
          proveedorId: aprobarRec.proveedorId,
          fechaEstimadaEntrega: fechaEntrega.toISOString().split('T')[0],
          observaciones: aprobarRec.motivo || `Recomendación ML — ${aprobarRec.estrategia}`,
          items: [{
            productoId: aprobarRec.productoId,
            cantidad: Math.round(aprobarRec.cantidadFinal),
            precioUnitario: Number(aprobarRec.precioReferencial) || 0,
          }],
        })
        setExito(`Orden de compra creada para ${obtenerNombreProducto(aprobarRec.productoId)}`)
      } else {
        await crearTransferencia({
          tipo_transferencia: 'transferencia_central',
          origen_id: aprobarRec.drogueriaId || aprobarRec.boticaId,
          destino_id: aprobarRec.boticaId,
          observaciones: aprobarRec.motivo || `Reposición ML — ${aprobarRec.estrategia}`,
          items: [{
            producto_id: aprobarRec.productoId,
            cantidad: Math.round(aprobarRec.cantidadFinal),
          }],
        })
        setExito(`Transferencia creada para ${obtenerNombreProducto(aprobarRec.productoId)}`)
      }

      setAprobarRec(null)
      setTimeout(() => setExito(null), 5000)
      await recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreando(false)
    }
  }

  function obtenerNombreProducto(id) {
    return productos.find(p => p.id === id)?.nombreComercial || id
  }

  function obtenerNombreBotica(id) {
    return boticas.find(b => b.id === id)?.nombre || id
  }

  function obtenerNombreProveedor(id) {
    return proveedores.find(p => p.id === id)?.razonSocial || id
  }

  const columnas = [
    { campo: 'tipo', encabezado: 'Tipo', render: r => <Insignia color={r.tipo === 'COMPRA' ? 'azul' : 'verde'}>{r.tipo}</Insignia> },
    { campo: 'estado', encabezado: 'Estado' },
    { campo: 'stockDisponible', encabezado: 'Stock disponible' },
    { campo: 'stockReservado', encabezado: 'Stock reservado' },
    { campo: 'stockLibre', encabezado: 'Stock libre' },
    { campo: 'stockEnTransito', encabezado: 'En tránsito' },
    { campo: 'stockPorRecibir', encabezado: 'Por recibir' },
    { campo: 'cantidadFinal', encabezado: 'Cantidad final' },
    { campo: 'acciones', encabezado: 'Acciones', render: r => (
      <div className="flex gap-1">
        <Boton variante="icono" icono={Eye} onClick={() => setDetalle(r)} title="Ver detalle" className="text-marca-principal hover:bg-marca-claro" />
        {r.estado === 'PENDIENTE' && <Boton variante="icono" icono={CheckCircle} onClick={() => setAprobarRec(r)} title="Aprobar recomendación" className="text-marca-principal hover:bg-marca-claro" />}
        {r.estado === 'PENDIENTE' && <Boton variante="icono" icono={XCircle} onClick={() => rechazar(r.id)} title="Rechazar recomendación" className="text-estado-critico hover:bg-red-50 dark:hover:bg-red-950/30" />}
      </div>
    ) },
  ]

  if (cargando && recomendaciones.length === 0 && productos.length === 0) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando recomendaciones...</p></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Recomendaciones Operativas ML</h1>
        <p className="text-secundario mt-1">{filas.length} recomendaciones encontradas</p>
      </div>

      {!estadoML.cargando && !estadoML.disponible && <Alerta tipo="error" titulo="API ML no disponible" mensaje={estadoML.error} />}
      {error && <Alerta tipo="error" titulo="No fue posible completar la operación" mensaje={error} alCerrar={() => setError(null)} />}
      {exito && <Alerta tipo="exito" titulo={exito} alCerrar={() => setExito(null)} />}

      <div className="flex flex-wrap gap-4">
          <select value={boticaId} onChange={e => setBoticaId(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            {boticas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <select value={productoId} onChange={e => setProductoId(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md min-w-72">
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombreComercial}</option>)}
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value="TODOS">Todos los tipos</option>
            <option value="COMPRA">COMPRA</option>
            <option value="REPOSICION_INTERNA">REPOSICION_INTERNA</option>
          </select>
          <Boton onClick={generar} cargando={cargando} deshabilitado={!estadoML.disponible || !boticaId || !productoId || tipo === 'TODOS'}>Generar</Boton>
          <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value="TODOS">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="CONFIRMADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
          </select>
      </div>

      <Tabla columnas={columnas} datos={filas} tamanoPagina={8} />

      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de recomendación" tamano="lg">
        {detalle && (
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div><p className="text-etiqueta text-secundario">Demanda prevista durante lead time</p><p className="font-semibold">{detalle.demandaDuranteLeadTime}</p></div>
            <div><p className="text-etiqueta text-secundario">Stock disponible</p><p className="font-semibold">{detalle.stockDisponible}</p></div>
            <div><p className="text-etiqueta text-secundario">Stock reservado</p><p className="font-semibold">{detalle.stockReservado}</p></div>
            <div><p className="text-etiqueta text-secundario">Stock libre</p><p className="font-semibold">{detalle.stockLibre}</p></div>
            <div><p className="text-etiqueta text-secundario">Stock en tránsito</p><p className="font-semibold">{detalle.stockEnTransito}</p></div>
            <div><p className="text-etiqueta text-secundario">Stock por recibir</p><p className="font-semibold">{detalle.stockPorRecibir}</p></div>
            <div><p className="text-etiqueta text-secundario">Stock de seguridad</p><p className="font-semibold">{detalle.stockSeguridad}</p></div>
            <div><p className="text-etiqueta text-secundario">Cantidad base</p><p className="font-semibold">{detalle.cantidadBase}</p></div>
            <div><p className="text-etiqueta text-secundario">Cantidad mínima</p><p className="font-semibold">{detalle.cantidadMinimaCompra}</p></div>
            <div><p className="text-etiqueta text-secundario">Múltiplo de empaque</p><p className="font-semibold">{detalle.multiploEmpaque}</p></div>
            <div><p className="text-etiqueta text-secundario">Cantidad final</p><p className="font-semibold text-marca-principal">{detalle.cantidadFinal}</p></div>
            <div><p className="text-etiqueta text-secundario">Lead time</p><p className="font-semibold">{detalle.leadTimeDias} días</p></div>
            <div><p className="text-etiqueta text-secundario">Precio referencial</p><p className="font-semibold">S/ {Number(detalle.precioReferencial || 0).toFixed(2)}</p></div>
            <div><p className="text-etiqueta text-secundario">Estrategia</p><p className="font-semibold">{detalle.estrategia}</p></div>
            <div><p className="text-etiqueta text-secundario">Madurez</p><p className="font-semibold">{detalle.nivelMadurez}</p></div>
            <div className="md:col-span-2"><p className="text-etiqueta text-secundario">Motivo</p><p className="font-semibold">{detalle.motivo}</p></div>
          </div>
        )}
      </Modal>

      <Modal abierto={!!aprobarRec} alCerrar={() => { if (!creando) setAprobarRec(null) }} titulo={aprobarRec?.tipo === 'COMPRA' ? 'Aprobar y crear orden de compra' : 'Aprobar y crear transferencia'} tamano="lg">
        {aprobarRec && (
          <div className="space-y-6">
            {aprobarRec.tipo === 'COMPRA' ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-etiqueta text-secundario">Proveedor</p>
                    <p className="font-semibold">{obtenerNombreProveedor(aprobarRec.proveedorId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Producto</p>
                    <p className="font-semibold">{obtenerNombreProducto(aprobarRec.productoId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Cantidad final</p>
                    <p className="font-semibold text-lg text-marca-principal">{Math.round(aprobarRec.cantidadFinal)} uds</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Precio unitario</p>
                    <p className="font-semibold text-lg">S/ {Number(aprobarRec.precioReferencial || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Lead time</p>
                    <p className="font-semibold">{aprobarRec.leadTimeDias} días</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Fecha estimada de entrega</p>
                    <p className="font-semibold">{
                      (() => {
                        const d = new Date()
                        d.setDate(d.getDate() + (Number(aprobarRec.leadTimeDias) || 7))
                        return d.toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })
                      })()
                    }</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-etiqueta text-secundario">Motivo</p>
                  <p className="font-semibold">{aprobarRec.motivo || `Recomendación ML — ${aprobarRec.estrategia}`}</p>
                </div>
                <div className="bg-fondo p-3 rounded-md border border-estilo text-sm">
                  <p className="text-secundario">Al confirmar se aprobará la recomendación y se creará la orden de compra automáticamente en el módulo de Órdenes de Compra.</p>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-estilo">
                  <Boton variante="secundario" onClick={() => setAprobarRec(null)} deshabilitado={creando}>Cancelar</Boton>
                  <Boton variante="primario" icono={ShoppingCart} onClick={aprobarYCrear} cargando={creando}>
                    Aprobar y crear orden de compra
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-etiqueta text-secundario">Origen</p>
                    <p className="font-semibold">{obtenerNombreBotica(aprobarRec.drogueriaId || aprobarRec.boticaId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Destino</p>
                    <p className="font-semibold">{obtenerNombreBotica(aprobarRec.boticaId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Producto</p>
                    <p className="font-semibold">{obtenerNombreProducto(aprobarRec.productoId)}</p>
                  </div>
                  <div>
                    <p className="text-etiqueta text-secundario">Cantidad</p>
                    <p className="font-semibold text-lg text-marca-principal">{Math.round(aprobarRec.cantidadFinal)} uds</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="text-etiqueta text-secundario">Motivo</p>
                  <p className="font-semibold">{aprobarRec.motivo || `Reposición ML — ${aprobarRec.estrategia}`}</p>
                </div>
                <div className="bg-fondo p-3 rounded-md border border-estilo text-sm">
                  <p className="text-secundario">Al confirmar se aprobará la recomendación y se creará la transferencia automáticamente en el módulo de Transferencias.</p>
                  <p className="text-secundario mt-1">Nota: La transferencia se creará sin lote asignado. Deberás asignar el lote desde el módulo de Transferencias.</p>
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-estilo">
                  <Boton variante="secundario" onClick={() => setAprobarRec(null)} deshabilitado={creando}>Cancelar</Boton>
                  <Boton variante="primario" icono={Truck} onClick={aprobarYCrear} cargando={creando}>
                    Aprobar y crear transferencia
                  </Boton>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
