import { useState } from 'react'
import { Plus } from 'lucide-react'
import Boton from '@/componentes/comunes/Boton'
import Tarjeta from '@/componentes/comunes/Tarjeta'
import Modal from '@/componentes/comunes/Modal'
import Alerta from '@/componentes/comunes/Alerta'
import Tabla from '@/componentes/comunes/Tabla'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CampoSeleccion from '@/componentes/formularios/CampoSeleccion'
import CampoNumero from '@/componentes/formularios/CampoNumero'
import CampoTextoArea from '@/componentes/formularios/CampoTextoArea'
import { ajusteEsquema } from '@/esquemas/ajusteEsquema'
import { movimientos } from '@/datos-prueba/movimientos'
import { productos } from '@/datos-prueba/productos'
import { ETIQUETAS_MOVIMIENTO, COLORES_MOVIMIENTO } from '@/constantes/tiposMovimiento'
import { formatearFechaHora } from '@/utilidades/formatearFecha'
import Insignia from '@/componentes/comunes/Insignia'

const OPCIONES_TIPO_AJUSTE = [
  { valor: 'ajuste_positivo', etiqueta: 'Ajuste Positivo' },
  { valor: 'ajuste_negativo', etiqueta: 'Ajuste Negativo' },
  { valor: 'merma_vencimiento', etiqueta: 'Merma por Vencimiento' },
  { valor: 'merma_dano', etiqueta: 'Merma por Daño' },
  { valor: 'merma_perdida', etiqueta: 'Merma por Pérdida' },
]

/**
 * Página de ajustes y mermas de inventario.
 */
export default function PaginaAjustes() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [exito, setExito] = useState(false)
  const opcionesProducto = productos.map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))

  const ajustesYMermas = movimientos.filter(m => m.tipo === 'ajuste' || m.tipo === 'merma').sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora))

  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(ajusteEsquema) })
  const alEnviar = (datos) => { console.log('[Mock] Ajuste:', datos); setExito(true); reset(); setTimeout(() => { setExito(false); setModalAbierto(false) }, 1500) }

  const columnas = [
    { campo: 'fechaHora', encabezado: 'Fecha', render: (r) => formatearFechaHora(r.fechaHora) },
    { campo: 'tipo', encabezado: 'Tipo', render: (r) => <Insignia color={COLORES_MOVIMIENTO[r.tipo]}>{ETIQUETAS_MOVIMIENTO[r.tipo]}</Insignia> },
    { campo: 'productoId', encabezado: 'Producto', render: (r) => productos.find(p => p.id === r.productoId)?.nombreComercial || r.productoId },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'motivo', encabezado: 'Motivo', render: (r) => <span className="text-etiqueta text-neutro-gris-texto max-w-[250px] line-clamp-2">{r.motivo}</span> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Ajustes y Mermas</h1>
        <Boton variante="primario" icono={Plus} onClick={() => setModalAbierto(true)}>Nuevo ajuste</Boton>
      </div>
      <Tabla columnas={columnas} datos={ajustesYMermas} />
      <Modal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} titulo="Registrar Ajuste o Merma">
        {exito && <Alerta tipo="exito" titulo="Ajuste registrado" className="mb-4" />}
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-4">
          <CampoSeleccion nombre="tipo" etiqueta="Tipo de Ajuste" opciones={OPCIONES_TIPO_AJUSTE} requerido register={register} error={errors.tipo?.message} />
          <CampoSeleccion nombre="productoId" etiqueta="Producto" opciones={opcionesProducto} requerido register={register} error={errors.productoId?.message} />
          <CampoNumero nombre="cantidad" etiqueta="Cantidad" min={1} requerido register={register} error={errors.cantidad?.message} />
          <CampoTextoArea nombre="motivo" etiqueta="Motivo (detallado)" requerido register={register} error={errors.motivo?.message} filas={4} placeholder="Describa en detalle el motivo del ajuste o merma..." />
          <div className="flex justify-end gap-3 pt-4">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario">Registrar ajuste</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
