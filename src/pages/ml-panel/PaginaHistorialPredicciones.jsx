import { useEffect, useMemo, useState } from 'react'
import { Brain, Calendar, Eye, Filter, RefreshCw } from 'lucide-react'
import Alerta from '@/components/common/Alerta'
import Boton from '@/components/common/Boton'
import Insignia from '@/components/common/Insignia'
import Modal from '@/components/common/Modal'
import Tabla from '@/components/common/Tabla'
import Tarjeta from '@/components/common/Tarjeta'
import { listarBoticas } from '@/services/supabase/boticas'
import { obtenerPredicciones } from '@/services/supabase/predicciones'
import { obtenerProductos } from '@/services/supabase/productos'
import { formatearFechaCorta, formatearFechaHora } from '@/utilities/formatearFecha'

const TODOS = 'TODOS'

function formatearNumero(valor, decimales = 2) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero.toFixed(decimales) : '—'
}

function formatearFechaSegura(fecha) {
  if (!fecha) return '—'
  try {
    return String(fecha).includes('T') ? formatearFechaHora(fecha) : formatearFechaCorta(fecha)
  } catch {
    return fecha
  }
}

function construirNombreMapa(items, campoNombre) {
  return Object.fromEntries(items.map(item => [item.id, item[campoNombre] || item.nombre || item.nombreComercial || item.id]))
}

export default function PaginaHistorialPredicciones() {
  const [predicciones, setPredicciones] = useState([])
  const [boticas, setBoticas] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [filtros, setFiltros] = useState({ boticaId: TODOS, productoId: TODOS, estrategia: TODOS, madurez: TODOS, modelo: TODOS })

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [predData, boticasData, productosData] = await Promise.all([
        obtenerPredicciones(),
        listarBoticas({ activas: true }),
        obtenerProductos({ activos: true }),
      ])
      setPredicciones(predData)
      setBoticas(boticasData.filter(b => b.tipo === 'botica'))
      setProductos(productosData)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  const nombresBotica = useMemo(() => construirNombreMapa(boticas, 'nombre'), [boticas])
  const nombresProducto = useMemo(() => construirNombreMapa(productos, 'nombreComercial'), [productos])

  const opciones = useMemo(() => ({
    estrategias: [...new Set(predicciones.map(p => p.estrategia).filter(Boolean))].sort(),
    madurez: [...new Set(predicciones.map(p => p.nivelMadurez).filter(Boolean))].sort(),
    modelos: [...new Set(predicciones.map(p => p.modeloVersionId).filter(Boolean))].sort(),
  }), [predicciones])

  const filas = useMemo(() => predicciones
    .filter(p => filtros.boticaId === TODOS || p.boticaId === filtros.boticaId)
    .filter(p => filtros.productoId === TODOS || p.productoId === filtros.productoId)
    .filter(p => filtros.estrategia === TODOS || p.estrategia === filtros.estrategia)
    .filter(p => filtros.madurez === TODOS || p.nivelMadurez === filtros.madurez)
    .filter(p => filtros.modelo === TODOS || p.modeloVersionId === filtros.modelo)
    .map(p => ({
      ...p,
      nombreBotica: nombresBotica[p.boticaId] || p.boticaId,
      nombreProducto: nombresProducto[p.productoId] || p.productoId,
      periodo: `${formatearFechaSegura(p.periodoInicio)} - ${formatearFechaSegura(p.periodoFin)}`,
    })), [predicciones, filtros, nombresBotica, nombresProducto])

  const actualizarFiltro = (campo, valor) => setFiltros(prev => ({ ...prev, [campo]: valor }))

  const columnas = [
    {
      campo: 'generadoEn',
      encabezado: 'Generado',
      render: r => <span className="whitespace-nowrap">{formatearFechaSegura(r.generadoEn)}</span>,
    },
    {
      campo: 'nombreProducto',
      encabezado: 'Producto',
      render: r => <span className="font-medium text-principal">{r.nombreProducto}</span>,
    },
    { campo: 'nombreBotica', encabezado: 'Botica' },
    { campo: 'periodo', encabezado: 'Periodo' },
    {
      campo: 'cantidadPredicha',
      encabezado: 'Demanda',
      render: r => <span>{formatearNumero(r.cantidadPredicha)} uds</span>,
    },
    {
      campo: 'rango',
      encabezado: 'Intervalo',
      render: r => <span>{formatearNumero(r.intervaloInf)} - {formatearNumero(r.intervaloSup)}</span>,
    },
    {
      campo: 'estrategia',
      encabezado: 'Estrategia',
      render: r => <Insignia color="verde">{r.estrategia || '—'}</Insignia>,
    },
    {
      campo: 'nivelMadurez',
      encabezado: 'Madurez',
      render: r => <Insignia color="amarillo">{r.nivelMadurez || '—'}</Insignia>,
    },
    {
      campo: 'modeloVersionId',
      encabezado: 'Modelo',
      render: r => <span className="font-mono text-xs">{r.modeloVersionId || '—'}</span>,
    },
    {
      campo: 'acciones',
      encabezado: 'Detalle',
      ordenable: false,
      render: r => <Boton variante="icono" icono={Eye} onClick={() => setDetalle(r)} title="Ver detalle" />,
    },
  ]

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando historial de predicciones...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-h1 text-principal">Historial de Predicciones</h1>
          <p className="text-secundario mt-1">Consulta predicciones persistidas con estrategia, madurez, intervalos y versión del modelo.</p>
        </div>
        <Boton className="w-full sm:w-auto" variante="secundario" icono={RefreshCw} onClick={cargar}>Actualizar</Boton>
      </div>

      {error && <Alerta tipo="error" titulo="No fue posible cargar el historial" mensaje={error} alCerrar={() => setError(null)} />}

      <Tarjeta titulo="Filtros" descripcion={`${filas.length} predicciones encontradas`} accionDerecha={<Filter className="h-5 w-5 text-secundario" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={filtros.boticaId} onChange={e => actualizarFiltro('boticaId', e.target.value)} className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value={TODOS}>Todas las boticas</option>
            {boticas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <select value={filtros.productoId} onChange={e => actualizarFiltro('productoId', e.target.value)} className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value={TODOS}>Todos los productos</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombreComercial}</option>)}
          </select>
          <select value={filtros.estrategia} onChange={e => actualizarFiltro('estrategia', e.target.value)} className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value={TODOS}>Todas las estrategias</option>
            {opciones.estrategias.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filtros.madurez} onChange={e => actualizarFiltro('madurez', e.target.value)} className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value={TODOS}>Toda madurez</option>
            {opciones.madurez.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filtros.modelo} onChange={e => actualizarFiltro('modelo', e.target.value)} className="w-full px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
            <option value={TODOS}>Todas las versiones</option>
            {opciones.modelos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </Tarjeta>

      <Tabla columnas={columnas} datos={filas} tamanoPagina={12} />

      <Modal abierto={!!detalle} alCerrar={() => setDetalle(null)} titulo="Detalle de predicción" tamano="lg">
        {detalle && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-etiqueta text-secundario">Producto</p><p className="font-semibold text-principal">{detalle.nombreProducto}</p></div>
              <div><p className="text-etiqueta text-secundario">Botica</p><p className="font-semibold text-principal">{detalle.nombreBotica}</p></div>
              <div><p className="text-etiqueta text-secundario">Periodo</p><p className="font-semibold text-principal">{detalle.periodo}</p></div>
              <div><p className="text-etiqueta text-secundario">Generado en</p><p className="font-semibold text-principal">{formatearFechaSegura(detalle.generadoEn)}</p></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Demanda</p><p className="text-h3 text-principal">{formatearNumero(detalle.cantidadPredicha)} uds</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Intervalo inferior</p><p className="text-h3 text-principal">{formatearNumero(detalle.intervaloInf)}</p></div>
              <div className="p-3 bg-fondo rounded-lg border border-estilo"><p className="text-etiqueta text-secundario">Intervalo superior</p><p className="text-h3 text-principal">{formatearNumero(detalle.intervaloSup)}</p></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><p className="text-etiqueta text-secundario">Estrategia</p><p className="font-semibold text-principal">{detalle.estrategia || '—'}</p></div>
              <div><p className="text-etiqueta text-secundario">Nivel de madurez</p><p className="font-semibold text-principal">{detalle.nivelMadurez || '—'}</p></div>
              <div><p className="text-etiqueta text-secundario">Método aplicado</p><p className="font-semibold text-principal">{detalle.metodoAplicado || '—'}</p></div>
              <div><p className="text-etiqueta text-secundario">Versión del modelo</p><p className="font-mono text-xs text-principal break-all">{detalle.modeloVersionId || '—'}</p></div>
              <div><p className="text-etiqueta text-secundario">SARIMA</p><p className="font-semibold text-principal">{formatearNumero(detalle.prediccionSarima)}</p></div>
              <div><p className="text-etiqueta text-secundario">XGBoost</p><p className="font-semibold text-principal">{formatearNumero(detalle.prediccionXgboost)}</p></div>
              <div><p className="text-etiqueta text-secundario">Alpha</p><p className="font-semibold text-principal">{formatearNumero(detalle.alpha, 4)}</p></div>
              <div><p className="text-etiqueta text-secundario">Confianza</p><p className="font-semibold text-principal">{formatearNumero(Number(detalle.confianza) <= 1 ? Number(detalle.confianza) * 100 : detalle.confianza)}%</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
