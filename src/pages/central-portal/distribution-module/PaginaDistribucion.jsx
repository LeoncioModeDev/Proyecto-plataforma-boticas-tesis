import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, Package, CheckCircle, Clock, ArrowRight, PackageCheck, X } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tabla from '@/components/common/Tabla'
import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { transferencias as transferenciasMock } from '@/mock-data/transferencias'
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
  const navegar = useNavigate()
  const [filtroEstado, setFiltroEstado] = useState('')
  const [exito, setExito] = useState(null)
  const [transferencias, setTransferencias] = useState(transferenciasMock)

  const filtradas = filtroEstado 
    ? transferencias.filter(t => t.estado === filtroEstado)
    : transferencias

  const obtenerNombreUbicacion = (id) => boticas.find(b => b.id === id)?.nombre || id
  const obtenerNombreUsuario = (id) => usuarios.find(u => u.id === id)?.nombre || id

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
        <Boton variante="primario" icono={Plus} onClick={() => navegar('/central/distribucion/transferencias/nueva')}>
          Nueva Transferencia
        </Boton>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total" valor={estadisticas.total} icono={Truck} />
        <TarjetaMetrica etiqueta="Creadas" valor={estadisticas.creadas} icono={Clock} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={estadisticas.enTransito} icono={ArrowRight} />
        <TarjetaMetrica etiqueta="Recibidas" valor={estadisticas.recibidas} icono={CheckCircle} />
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
    </div>
  )
}