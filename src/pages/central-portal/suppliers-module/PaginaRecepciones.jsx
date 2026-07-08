import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, ClipboardList, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import Tabla from '@/components/common/Tabla'
import TarjetaMetrica from '@/components/charts/TarjetaMetrica'
import Insignia from '@/components/common/Insignia'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import { listarRecepciones } from '@/services/supabase/ordenesCompra'
import { supabase } from '@/services/supabase/cliente'
import useAutenticacion from '@/state/useAutenticacion'
import { formatearFechaRelativa } from '@/utilities/formatearFecha'

const COLORES_RESULTADO = {
  recibida: 'verde',
  recibida_parcial: 'naranja',
  recibida_con_observacion: 'celeste',
  en_devolucion: 'rojo',
}

const ETIQUETAS_RESULTADO = {
  recibida: 'Recibida',
  recibida_parcial: 'Recibida Parcial',
  recibida_con_observacion: 'Recibida con Observación',
  en_devolucion: 'En Devolución',
}

export default function PaginaRecepciones() {
  const navegar = useNavigate()
  const { usuario } = useAutenticacion()
  const [recepciones, setRecepciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [proveedores, setProveedores] = useState([])
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroResultado, setFiltroResultado] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const cargarRecepciones = async () => {
    try {
      setCargando(true)
      setError(null)
      const filtros = {
        proveedorId: filtroProveedor || undefined,
        resultado: filtroResultado || undefined,
        fechaDesde: filtroDesde || undefined,
        fechaHasta: filtroHasta || undefined,
      }
      const data = await listarRecepciones(filtros)
      setRecepciones(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const { data: provData } = await supabase
          .from('proveedores')
          .select('id, razon_social')
          .eq('org_id', usuario.orgId)
          .order('razon_social')
        setProveedores(provData || [])
      } catch (e) {
        console.error('Error cargando catálogos:', e)
      }
    }
    init()
  }, [])

  useEffect(() => {
    cargarRecepciones()
  }, [filtroProveedor, filtroResultado, filtroDesde, filtroHasta])

  const estadisticas = useMemo(() => ({
    total: recepciones.length,
    recibidas: recepciones.filter(r => r.resultado === 'recibida').length,
    conObservacion: recepciones.filter(r => r.resultado === 'recibida_con_observacion').length,
    devoluciones: recepciones.filter(r => r.resultado === 'en_devolucion').length,
  }), [recepciones])

  const columnas = [
    { campo: 'numeroRecepcion', encabezado: 'N.º de Recepción', render: (r) => <span className="font-mono text-xs font-medium text-principal">{r.numeroRecepcion}</span> },
    { campo: 'fechaRecepcion', encabezado: 'Fecha', render: (r) => <span className="text-etiqueta text-secundario">{formatearFechaRelativa(r.fechaRecepcion)}</span> },
    { campo: 'ordenNumero', encabezado: 'N.º de Orden', render: (r) => <span className="font-mono text-xs font-medium text-principal">{r.ordenNumero}</span> },
    { campo: 'proveedorNombre', encabezado: 'Proveedor', render: (r) => <span className="text-principal">{r.proveedorNombre}</span> },
    { campo: 'registradoPorNombre', encabezado: 'Registrado por' },
    {
      campo: 'resultado', encabezado: 'Resultado',
      render: (r) => <Insignia color={COLORES_RESULTADO[r.resultado]}>{ETIQUETAS_RESULTADO[r.resultado] || r.resultado}</Insignia>,
    },
    { campo: 'totalProductos', encabezado: 'Productos' },
    { campo: 'totalRecibido', encabezado: 'Total recibido' },
    {
      campo: 'acciones', encabezado: '',
      render: (r) => (
        <div className="flex gap-1">
          <Boton
            variante="icono"
            icono={Eye}
            onClick={() => navegar(`/central/proveedores/recepciones/${r.id}`)}
            title="Ver detalle"
            className="text-secundario hover:bg-fondo"
          />
        </div>
      ),
    },
  ]

  if (cargando) {
    return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando recepciones...</p></div>
  }

  if (error) {
    return <div className="space-y-6"><Alerta tipo="error" titulo={error} /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Recepciones</h1>
          <p className="text-secundario mt-1">Histórico de recepciones de productos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Total Recepciones" valor={estadisticas.total} icono={ClipboardList} />
        <TarjetaMetrica etiqueta="Recibidas" valor={estadisticas.recibidas} icono={CheckCircle} />
        <TarjetaMetrica etiqueta="Con Observación" valor={estadisticas.conObservacion} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="En Devolución" valor={estadisticas.devoluciones} icono={XCircle} />
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={filtroProveedor}
          onChange={e => setFiltroProveedor(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => (
            <option key={p.id} value={p.id}>{p.razon_social}</option>
          ))}
        </select>
        <select
          value={filtroResultado}
          onChange={e => setFiltroResultado(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
        >
          <option value="">Todos los resultados</option>
          {Object.entries(ETIQUETAS_RESULTADO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>{etiqueta}</option>
          ))}
        </select>
        <input
          type="date"
          value={filtroDesde}
          onChange={e => setFiltroDesde(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
          placeholder="Fecha desde"
        />
        <input
          type="date"
          value={filtroHasta}
          onChange={e => setFiltroHasta(e.target.value)}
          className="px-4 py-2 border border-estilo rounded-tarjeta text-cuerpo bg-fondo-secundario"
          placeholder="Fecha hasta"
        />
      </div>

      <Tabla
        columnas={columnas}
        datos={recepciones}
        mensajeVacio="No se encontraron recepciones"
      />
    </div>
  )
}
