import { useState } from 'react'
import { Plus } from 'lucide-react'
import Boton from '@/componentes/comunes/Boton'
import Tabla from '@/componentes/comunes/Tabla'
import Insignia from '@/componentes/comunes/Insignia'
import Modal from '@/componentes/comunes/Modal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CampoTexto from '@/componentes/formularios/CampoTexto'
import CampoSeleccion from '@/componentes/formularios/CampoSeleccion'
import CampoFecha from '@/componentes/formularios/CampoFecha'
import CampoNumero from '@/componentes/formularios/CampoNumero'
import Alerta from '@/componentes/comunes/Alerta'
import { loteEsquema } from '@/esquemas/loteEsquema'
import { lotes } from '@/datos-prueba/lotes'
import { productos } from '@/datos-prueba/productos'
import { boticas, OPCIONES_UBICACION } from '@/datos-prueba/boticas'
import { calcularFEFO } from '@/utilidades/calcularFEFO'
import { formatearFechaCorta, diasRestantes } from '@/utilidades/formatearFecha'

/**
 * Página de Lotes y Vencimientos con tabla FEFO y formulario de registro.
 */
export default function PaginaLotes() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [exito, setExito] = useState(false)

  const lotesOrdenados = calcularFEFO(lotes)
  const obtenerNombreProducto = (id) => productos.find(p => p.id === id)?.nombreComercial || id
  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id

  const opcionesProducto = productos.filter(p => p.estado === 'activo').map(p => ({ valor: p.id, etiqueta: p.nombreComercial }))

  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(loteEsquema) })
  const alEnviar = (datos) => { console.log('[Mock] Lote creado:', datos); setExito(true); reset(); setTimeout(() => { setExito(false); setModalAbierto(false) }, 1500) }

  const columnas = [
    { campo: 'productoId', encabezado: 'Producto', render: (r) => obtenerNombreProducto(r.productoId) },
    { campo: 'numeroLote', encabezado: 'Nº Lote' },
    { campo: 'ubicacionId', encabezado: 'Ubicación', render: (r) => obtenerNombreUbicacion(r.ubicacionId) },
    { campo: 'cantidad', encabezado: 'Cantidad' },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => {
      const dias = diasRestantes(r.fechaVencimiento)
      const color = dias < 30 ? 'rojo' : dias < 90 ? 'amarillo' : 'verde'
      return <span><span>{formatearFechaCorta(r.fechaVencimiento)}</span> <Insignia color={color}>{dias}d</Insignia></span>
    }},
    { campo: 'diasRestantes', encabezado: 'Días Rest.', render: (r) => diasRestantes(r.fechaVencimiento) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Lotes y Vencimientos</h1>
        <Boton variante="primario" icono={Plus} onClick={() => setModalAbierto(true)}>Registrar lote</Boton>
      </div>
      <Tabla columnas={columnas} datos={lotesOrdenados} />
      <Modal abierto={modalAbierto} alCerrar={() => setModalAbierto(false)} titulo="Registrar Nuevo Lote">
        {exito && <Alerta tipo="exito" titulo="Lote registrado" className="mb-4" />}
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-4">
          <CampoSeleccion nombre="productoId" etiqueta="Producto" opciones={opcionesProducto} requerido register={register} error={errors.productoId?.message} />
          <CampoSeleccion nombre="ubicacionId" etiqueta="Ubicación" opciones={OPCIONES_UBICACION} requerido register={register} error={errors.ubicacionId?.message} />
          <CampoTexto nombre="numeroLote" etiqueta="Número de Lote" requerido register={register} error={errors.numeroLote?.message} />
          <CampoFecha nombre="fechaVencimiento" etiqueta="Fecha de Vencimiento" requerido register={register} error={errors.fechaVencimiento?.message} />
          <CampoNumero nombre="cantidad" etiqueta="Cantidad" min={1} requerido register={register} error={errors.cantidad?.message} />
          <div className="flex justify-end gap-3 pt-4">
            <Boton variante="secundario" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario">Registrar</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
