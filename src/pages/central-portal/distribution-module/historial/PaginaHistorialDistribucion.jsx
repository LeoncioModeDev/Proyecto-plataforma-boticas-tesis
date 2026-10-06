import { useState, useEffect, useMemo } from 'react'
import { FileText, Truck, PackageCheck, XCircle, AlertTriangle } from 'lucide-react'
import Tabla from '@/components/common/Tabla'

import Insignia from '@/components/common/Insignia'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import { ESTADOS_TRANSFERENCIA, ETIQUETAS_TRANSFERENCIA, COLORES_TRANSFERENCIA } from '@/constants/transferencias'
import { obtenerTransferencias } from '@/services/supabase/transferencias'
import { formatearFechaCorta } from '@/utilities/formatearFecha'

const MAPEO_COLORES = {
  amarillo: 'amarillo',
  azul: 'azul',
  verde: 'verde',
  rojo: 'rojo',
  naranja: 'naranja',
}

export default function PaginaHistorialDistribucion() {
  const [transferencias, setTransferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroAnio, setFiltroAnio] = useState('')
  const [busqueda, setBusqueda] = useState('')

  async function cargarTransferencias() {
    try {
      setCargando(true)
      const data = await obtenerTransferencias()
      setTransferencias(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarTransferencias()
  }, [])

  const historial = useMemo(() =>
    [...transferencias].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [transferencias]
  )

  let filtrado = [...historial]
  if (filtroAnio) filtrado = filtrado.filter(t => t.createdAt?.startsWith(filtroAnio))
  if (busqueda) {
    const term = busqueda.toLowerCase()
    filtrado = filtrado.filter(t =>
      t.id.toLowerCase().includes(term) ||
      (t.destino?.nombre || t.destinoId).toLowerCase().includes(term)
    )
  }

  const getDuracion = (creacion, recepcion) => {
    if (!recepcion) return '-'
    const dias = Math.ceil((new Date(recepcion) - new Date(creacion)) / (1000 * 60 * 60 * 24))
    return `${dias} día${dias !== 1 ? 's' : ''}`
  }

  const columnas = [
    {
      campo: 'numeroTransferencia',
      encabezado: 'N.º de Transferencia',
      render: (r) => <span className="font-mono text-xs text-principal">{r.numeroTransferencia}</span>,
    },
    {
      campo: 'destinoId',
      encabezado: 'Destino',
      render: (r) => <span className="text-principal">{r.destino?.nombre || r.destinoId}</span>,
    },
    {
      campo: 'items',
      encabezado: 'Productos',
      render: (r) => <span>{r.items.reduce((a, i) => a + i.cantidad, 0)}</span>,
    },
    {
      campo: 'estado',
      encabezado: 'Estado',
      render: (r) => (
        <Insignia color={MAPEO_COLORES[COLORES_TRANSFERENCIA[r.estado]] || 'gris'}>
          {ETIQUETAS_TRANSFERENCIA[r.estado] || r.estado}
        </Insignia>
      ),
    },
    {
      campo: 'createdAt',
      encabezado: 'Creación',
      render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaCorta(r.createdAt)}</span>,
    },
    {
      campo: 'fechaRecepcion',
      encabezado: 'Recepción',
      render: (r) => <span className="text-etiqueta text-secundario">{r.fechaRecepcion ? formatearFechaCorta(r.fechaRecepcion) : '-'}</span>,
    },
    {
      campo: 'duracion',
      encabezado: 'Duración',
      render: (r) => <span className="text-etiqueta text-secundario">{getDuracion(r.createdAt, r.fechaRecepcion)}</span>,
    },
  ]

  const anios = [...new Set(historial.map(t => t.createdAt?.substring(0, 4)).filter(Boolean))].sort().reverse()

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando historial...</p></div>

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-principal">Historial de Distribución</h1>

      {error && (
        <div className="p-3 text-sm text-estado-critico bg-rojo-claro rounded-md">{error}</div>
      )}

      <div className="flex gap-4 flex-wrap">
        <select value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
          <option value="">Todos los años</option>
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="text"
          placeholder="Buscar por ID o destino..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md flex-1 min-w-[200px]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <TarjetaMetrica etiqueta="Total" valor={historial.length} icono={FileText} />
        <TarjetaMetrica etiqueta="Recibidas" valor={historial.filter(t => t.estado === ESTADOS_TRANSFERENCIA.RECIBIDA).length} icono={PackageCheck} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={historial.filter(t => t.estado === ESTADOS_TRANSFERENCIA.EN_TRANSITO).length} icono={Truck} />
        <TarjetaMetrica etiqueta="Rechazadas" valor={historial.filter(t => t.estado === ESTADOS_TRANSFERENCIA.RECHAZADA).length} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Canceladas" valor={historial.filter(t => t.estado === ESTADOS_TRANSFERENCIA.CANCELADA).length} icono={XCircle} />
      </div>

      <Tabla columnas={columnas} datos={filtrado} />
    </div>
  )
}
