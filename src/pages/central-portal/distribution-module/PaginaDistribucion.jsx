import { useState } from 'react'
import { Plus, Truck, Package, CheckCircle, Clock, ArrowRight, PackageCheck, X } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Alerta from '@/components/common/Alerta'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoTextoArea from '@/components/forms/CampoTextoArea'
import { transferenciaEsquema } from '@/schemas/transferenciaEsquema'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { usuarios } from '@/mock-data/usuarios'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const ESTADOS_TRANSFERENCIA = {
  creada: { etiqueta: 'Creada', color: 'amarillo', icono: Clock },
  en_transito: { etiqueta: 'En Tránsito', color: 'azul', icono: Truck },
  recibida: { etiqueta: 'Recibida', color: 'verde', icono: CheckCircle },
}

const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'creada', etiqueta: 'Creada' },
  { valor: 'en_transito', etiqueta: 'En Tránsito' },
  { valor: 'recibida', etiqueta: 'Recibida' },
]

export default function PaginaTransferencias() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [exito, setExito] = useState(null)
  const [transferencias, setTransferencias] = useState(transferenciasMock)

  const filtradas = filtroEstado 
    ? transferencias.filter(t => t.estado === filtroEstado)
    : transferencias

  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id
  const obtenerNombreUsuario = (id) => usuarios.find(u => u.id === id)?.nombre || id

  const opcionesDestino = boticas
    .filter(b => b.tipo === 'botica')
    .map(b => ({ valor: b.id, etiqueta: b.nombre }))

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: zodResolver(transferenciaEsquema),
    defaultValues: { items: [{ productoId: '', cantidad: 1 }] }
  })

  const itemsWatch = watch('items') || []
  const esValido = itemsWatch.some(i => i.productoId && i.cantidad > 0)

  const alEnviar = (datos) => {
    const nuevaTransferencia = {
      id: `trans-${Date.now()}`,
      boticaId: datos.boticaId,
      estado: 'creada',
      creadoPor: 'usr-001',
      fechaDespacho: null,
      fechaRecepcion: null,
      createdAt: new Date().toISOString(),
      items: datos.items.filter(i => i.productoId && i.cantidad > 0).map((item, idx) => ({
        id: `ti-${Date.now()}-${idx}`,
        transferenciaId: null,
        productoId: item.productoId,
        loteId: null,
        cantidad: item.cantidad,
      })),
      observaciones: datos.observaciones || '',
    }
    setTransferencias([nuevaTransferencia, ...transferencias])
    setExito('Transferencia creada exitosamente')
    reset()
    setTimeout(() => { setExito(null); setModalAbierto(false) }, 2000)
  }

  const cambiarEstado = (id, nuevoEstado) => {
    setTransferencias(transferencias.map(t => {
      if (t.id === id) {
        return {
          ...t,
          estado: nuevoEstado,
          fechaDespacho: nuevoEstado === 'en_transito' ? new Date().toISOString() : t.fechaDespacho,
          fechaRecepcion: nuevoEstado === 'recibida' ? new Date().toISOString() : t.fechaRecepcion,
        }
      }
      return t
    }))
    setExito(`Transferencia actualizada a ${ESTADOS_TRANSFERENCIA[nuevoEstado].etiqueta}`)
    setTimeout(() => setExito(null), 2000)
  }

  const columnas = [
    { 
      campo: 'id', 
      encabezado: 'ID', 
      render: (r) => <span className="font-mono text-cuerpo">{r.id.toUpperCase()}</span> 
    },
    { 
      campo: 'boticaId', 
      encabezado: 'Destino', 
      render: (r) => <span className="text-principal">{obtenerNombreUbicacion(r.boticaId)}</span> 
    },
    { 
      campo: 'items', 
      encabezado: 'Items', 
      render: (r) => (
        <div className="flex items-center gap-1">
          <Package className="h-4 w-4 text-secundario" />
          <span>{r.items.reduce((a, i) => a + i.cantidad, 0)} productos</span>
        </div>
      )
    },
    { 
      campo: 'estado', 
      encabezado: 'Estado', 
      render: (r) => {
        const estado = ESTADOS_TRANSFERENCIA[r.estado] || ESTADOS_TRANSFERENCIA.creada
        const Icono = estado.icono
        return (
          <Insignia color={estado.color}>
            <Icono className="h-3 w-3 mr-1" />
            {estado.etiqueta}
          </Insignia>
        )
      }
    },
    { 
      campo: 'createdAt', 
      encabezado: 'Fecha Creación', 
      render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span> 
    },
    { 
      campo: 'creadoPor', 
      encabezado: 'Creador', 
      render: (r) => <span className="text-etiqueta text-secundario">{obtenerNombreUsuario(r.creadoPor)}</span> 
    },
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      render: (r) => (
        <div className="flex gap-1">
          {r.estado === 'creada' && (
            <>
              <Boton 
                variante="icono" 
                icono={ArrowRight} 
                className="text-marca-principal hover:bg-marca-claro"
                onClick={() => cambiarEstado(r.id, 'en_transito')}
                title="Enviar"
              />
              <Boton 
                variante="icono" 
                icono={X} 
                className="text-estado-critico hover:bg-rojo-claro"
                onClick={() => cambiarEstado(r.id, 'cancelada')}
                title="Cancelar"
              />
            </>
          )}
          {r.estado === 'en_transito' && (
            <Boton 
              variante="icono" 
              icono={PackageCheck} 
              className="text-estado-exito hover:bg-verde-claro"
              onClick={() => cambiarEstado(r.id, 'recibida')}
              title="Confirmar recepción"
            />
          )}
        </div>
      )
    },
  ]

  const estadisticas = {
    total: transferencias.length,
    creadas: transferencias.filter(t => t.estado === 'creada').length,
    enTransito: transferencias.filter(t => t.estado === 'en_transito').length,
    recibidas: transferencias.filter(t => t.estado === 'recibida').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 text-neutro-negro">Transferencias</h1>
        <Boton variante="primario" icono={Plus} onClick={() => setModalAbierto(true)}>
          Nueva Transferencia
        </Boton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-marca-claro rounded-lg">
              <Truck className="h-5 w-5 text-marca-principal" />
            </div>
            <div>
              <p className="text-2xl font-bold text-principal">{estadisticas.total}</p>
              <p className="text-etiqueta text-secundario">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amarillo-claro rounded-lg">
              <Clock className="h-5 w-5 text-amarillo" />
            </div>
            <div>
              <p className="text-2xl font-bold text-principal">{estadisticas.creadas}</p>
              <p className="text-etiqueta text-secundario">Creadas</p>
            </div>
          </div>
        </div>
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azul-claro rounded-lg">
              <ArrowRight className="h-5 w-5 text-azul" />
            </div>
            <div>
              <p className="text-2xl font-bold text-principal">{estadisticas.enTransito}</p>
              <p className="text-etiqueta text-secundario">En Tránsito</p>
            </div>
          </div>
        </div>
        <div className="bg-fondo p-4 rounded-tarjeta border border-estilo">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-verde-claro rounded-lg">
              <CheckCircle className="h-5 w-5 text-estado-exito" />
            </div>
            <div>
              <p className="text-2xl font-bold text-principal">{estadisticas.recibidas}</p>
              <p className="text-etiqueta text-secundario">Recibidas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <select 
          value={filtroEstado} 
          onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton"
        >
          {OPCIONES_ESTADO.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
      </div>

      <Tabla columnas={columnas} datos={filtradas} />

      <Modal abierto={modalAbierto} alCerrar={() => { setModalAbierto(false); reset() }} titulo="Nueva Transferencia">
        {exito && <Alerta tipo="exito" titulo={exito} className="mb-4" />}
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-4">
          <CampoSeleccion 
            nombre="boticaId" 
            etiqueta="Botica Destino" 
            opciones={opcionesDestino} 
            requerido 
            register={register} 
            error={errors.boticaId?.message} 
          />
          
          <div className="border border-estilo rounded-tarjeta p-4">
            <p className="text-cuerpo font-medium text-principal mb-3">Productos a Transferir</p>
            <div className="space-y-3">
              {itemsWatch.map((item, index) => (
                <div key={index} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <select
                      {...register(`items.${index}.productoId`)}
                      className="w-full px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton"
                    >
                      <option value="">Seleccionar producto</option>
                      {productos.filter(p => p.estado === 'activo').map(p => (
                        <option key={p.id} value={p.id}>{p.nombreComercial}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      {...register(`items.${index}.cantidad`, { valueAsNumber: true })}
                      min="1"
                      placeholder="Cant."
                      className="w-full px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton text-center"
                    />
                  </div>
                </div>
              ))}
            </div>
            {errors.items?.message && (
              <p className="text-cuerpo text-estado-critico mt-2">{errors.items.message}</p>
            )}
          </div>

          <CampoTextoArea 
            nombre="observaciones" 
            etiqueta="Observaciones" 
            register={register} 
            placeholder="Notas adicionales sobre la transferencia..."
            filas={3}
          />
          
          <div className="flex justify-end gap-3 pt-4">
            <Boton variante="secundario" onClick={() => { setModalAbierto(false); reset() }}>Cancelar</Boton>
            <Boton type="submit" variante="primario" disabled={!esValido}>Crear Transferencia</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}