import { useState } from 'react'
import Modal from '@/components/common/Modal'
import Boton from '@/components/common/Boton'
import { actualizarStockConfig } from '@/services/supabase/stock'

const MAX_ENTERO_SQL = 2147483647
const esUmbral = valor => Number.isInteger(valor) && valor >= 0 && valor <= MAX_ENTERO_SQL

export default function ModalConfigurarStock({ abierto, alCerrar, producto, onActualizarStock }) {
  const [minimo, setMinimo] = useState(producto?.stockMinimo?.toString() ?? '')
  const [maximo, setMaximo] = useState(producto?.stockMaximo?.toString() ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const manejarGuardar = async (evento) => {
    evento.preventDefault()
    if (guardando) return
    const stockMinimo = minimo === '' ? null : Number(minimo)
    const stockMaximo = maximo === '' ? null : Number(maximo)

    if (!esUmbral(stockMinimo) || (stockMaximo !== null && !esUmbral(stockMaximo))) {
      setError(`Ingresa umbrales enteros entre 0 y ${MAX_ENTERO_SQL}. Solo el máximo puede quedar vacío.`)
      return
    }
    if (stockMaximo !== null && stockMaximo < stockMinimo) {
      setError('El stock máximo debe ser mayor o igual al mínimo.')
      return
    }

    try {
      setGuardando(true)
      setError(null)
      await actualizarStockConfig(producto.productoId, {
        ubicacionTipo: producto.ubicacionTipo,
        ubicacionId: producto.ubicacionId,
        stockMinimo,
        stockMaximo,
      })
      onActualizarStock(producto.id, stockMinimo, stockMaximo)
      alCerrar()
    } catch (e) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal abierto={abierto} alCerrar={alCerrar} titulo={`Configurar Stock — ${producto?.nombreProducto || ''}`} tamano="md">
      <form className="space-y-4" onSubmit={manejarGuardar}>
        {error && <p role="alert" className="text-sm text-estado-critico">{error}</p>}
        <div>
          <label htmlFor="config-stock-minimo" className="block text-sm text-secundario mb-1">Stock Mínimo</label>
          <input
            id="config-stock-minimo"
            type="number"
            value={minimo}
            onChange={e => setMinimo(e.target.value)}
            min="0"
            max={MAX_ENTERO_SQL}
            step="1"
            required
            className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md"
          />
        </div>
        <div>
          <label htmlFor="config-stock-maximo" className="block text-sm text-secundario mb-1">Stock Máximo</label>
          <input
            id="config-stock-maximo"
            type="number"
            value={maximo}
            onChange={e => setMaximo(e.target.value)}
            min="0"
            max={MAX_ENTERO_SQL}
            step="1"
            className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md"
            placeholder="Sin límite"
          />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-estilo">
          <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" tipo="submit" cargando={guardando}>Guardar</Boton>
        </div>
      </form>
    </Modal>
  )
}
