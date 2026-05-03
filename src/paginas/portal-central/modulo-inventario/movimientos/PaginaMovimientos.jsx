import { useState } from 'react'
import { Plus } from 'lucide-react'
import Boton from '@/componentes/comunes/Boton'
import Tabla from '@/componentes/comunes/Tabla'
import Insignia from '@/componentes/comunes/Insignia'
import Modal from '@/componentes/comunes/Modal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CampoSeleccion from '@/componentes/formularios/CampoSeleccion'
import CampoNumero from '@/componentes/formularios/CampoNumero'
import CampoTextoArea from '@/componentes/formularios/CampoTextoArea'
import Alerta from '@/componentes/comunes/Alerta'
import { movimientoEsquema } from '@/esquemas/movimientoEsquema'
import { movimientos } from '@/datos-prueba/movimientos'
import { productos } from '@/datos-prueba/productos'
import { boticas, OPCIONES_UBICACION } from '@/datos-prueba/boticas'
import { usuarios } from '@/datos-prueba/usuarios'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO, OPCIONES_MOVIMIENTO } from '@/constantes/tiposMovimiento'
import { formatearFechaHora } from '@/utilidades/formatearFecha'

/**
 * Página de historial de movimientos de inventario.
 */
export default function PaginaMovimientos() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [exito, setExito] = useState(false)

  const opcionesProducto = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))
  const obtenerNombre = (id, lista, campo) => lista.find(i => i.id === id)?.[campo] || id

  let filtrados = [...movimientos].sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))
  if (filtroTipo) filtrados = filtrados.filter(m => m.tipo === filtroTipo)

  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(movimientoEsquema) })
  const alEnviar = (datos) => { console.log('[Mock] Movimiento:', datos); setExito(true); reset(); setTimeout(() => { setExito(false); setModalAbierto(false) }, 1500) }

  const columnas = [
    { campo: 'fechaHora', encabezado: 'Fecha y Hora', render: (r) => formatearFechaHora(r.fechaHora) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => obtenerNombre(r.productoId, productos, 'nombreComercial') },
    { campo: 'cantidad', encabezado: 'Cantidad', render: (r) => <span className={r.tipo === 'entrada' || r.tipo === 'ajuste' ? 'text-marca-principal font-semibold' : 'text-estado-critico font-semibold'}>{r.tipo === 'entrada' ? '+' : '-'}{Math.abs(r.cantidad)}</span> },
    { campo: 'ubicacionId', encabezado: 'Ubicación', render: (r) => obtenerNombre(r.ubicacionId, boticas, 'nombre') },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-neutro-gris-texto line-clamp-1 max-w-[200px]">{r.motivo}</span> },
    { campo: 'usuarioId', encabezado: 'Usuario', render: (r) => obtenerNombre(r.usuarioId, usuarios, 'nombre') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Movimientos de Inventario</h1>
        <Boton variante="primario" icono={Plus} onClick={() => setModalAbierto(true)}>Registrar movimiento</Boton>
      </div>
      <div className="flex gap-4">
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton">
          <option value="">Todos los tipos</option>
          {OPCIONES_MOVIMIENTO.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      </div>
      <Tabla columnas={columnas} datos={filtrados} />
      <Modal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} titulo="Registrar Movimiento">
        {exito && <Alerta tipo="exito" titulo="Movimiento registrado" className="mb-4" />}
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-4">
          <CampoSeleccion nombre="tipo" etiqueta="Tipo" opciones={OPCIONES_MOVIMIENTO} requerido register={register} error={errors.tipo?.message} />
          <CampoSeleccion nombre="productoId" etiqueta="Producto" opciones={opcionesProducto} requerido register={register} error={errors.productoId?.message} />
          <CampoNumero nombre="cantidad" etiqueta="Cantidad" min={1} requerido register={register} error={errors.cantidad?.message} />
          <CampoSeleccion nombre="ubicacionId" etiqueta="Ubicación" opciones={OPCIONES_UBICACION} requerido register={register} error={errors.ubicacionId?.message} />
          <CampoTextoArea nombre="motivo" etiqueta="Motivo" requerido register={register} error={errors.motivo?.message} placeholder="Describa el motivo del movimiento..." />
          <div className="flex justify-end gap-3 pt-4">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario">Registrar</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
