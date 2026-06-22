import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Package } from 'lucide-react'
import Tarjeta from '@/components/common/Tarjeta'
import Boton from '@/components/common/Boton'
import Alerta from '@/components/common/Alerta'
import Tabla from '@/components/common/Tabla'
import { listarRecepciones } from '@/services/supabase/ordenesCompra'

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

export default function DetalleRecepcion() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [recepcion, setRecepcion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true)
        const data = await listarRecepciones({ ordenCompraId: undefined })
        const encontrado = data.find(r => r.id === id)
        if (!encontrado) throw new Error('Recepción no encontrada')
        setRecepcion(encontrado)
      } catch (e) {
        setError(e.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  const formatearFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleDateString('es-PE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando recepción...</p></div>
  }

  if (error) {
    return <Alerta tipo="error" titulo={error} />
  }

  if (!recepcion) return null

  const columnasProductos = [
    { campo: 'productoNombre', encabezado: 'Producto' },
    { campo: 'cantidadSolicitada', encabezado: 'Solicitado' },
    { campo: 'cantidadRecibida', encabezado: 'Recibido' },
    { campo: 'cantidadDevuelta', encabezado: 'Devuelto' },
    { campo: 'numeroLote', encabezado: 'Lote' },
    { campo: 'fechaVencimiento', encabezado: 'Vencimiento', render: (r) => r.fechaVencimiento || '-' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/proveedores/recepciones')}>Volver</Boton>
        <h1 className="text-h1 text-principal">Detalle de Recepción</h1>
      </div>

      <Tarjeta>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-secundario">Recepción</p>
              <p className="text-principal font-mono text-sm">{recepcion.numeroRecepcion || recepcion.id}</p>
            </div>
            <div>
              <p className="text-sm text-secundario">Orden de Compra</p>
              <p className="text-principal font-mono text-sm">{recepcion.ordenNumero || recepcion.ordenCompraId}</p>
            </div>
            <div>
              <p className="text-sm text-secundario">Proveedor</p>
              <p className="text-principal font-medium">{recepcion.proveedorNombre}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-secundario">Fecha de Recepción</p>
              <p className="text-principal">{formatearFecha(recepcion.fechaRecepcion)}</p>
            </div>
            <div>
              <p className="text-sm text-secundario">Registrado por</p>
              <p className="text-principal">{recepcion.registradoPorNombre}</p>
            </div>
            <div>
              <p className="text-sm text-secundario">Resultado</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${COLORES_RESULTADO[recepcion.resultado]}-100 text-${COLORES_RESULTADO[recepcion.resultado]}-700`}>
                {ETIQUETAS_RESULTADO[recepcion.resultado] || recepcion.resultado}
              </span>
            </div>
          </div>
        </div>
        {recepcion.observacion && (
          <div className="mt-4 pt-4 border-t border-estilo">
            <p className="text-sm text-secundario">Observaciones</p>
            <p className="text-principal mt-1">{recepcion.observacion}</p>
          </div>
        )}
        {recepcion.motivoRechazo && (
          <div className="mt-4 pt-4 border-t border-estilo">
            <p className="text-sm text-secundario">Motivo de rechazo/devolución</p>
            <p className="text-estado-critico mt-1">{recepcion.motivoRechazo}</p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-marca-principal" />
          <h2 className="text-h2 text-principal">Productos Recibidos</h2>
        </div>
        <Tabla
          columnas={columnasProductos}
          datos={recepcion.items || []}
          mensajeVacio="No hay productos registrados"
        />
      </Tarjeta>
    </div>
  )
}
