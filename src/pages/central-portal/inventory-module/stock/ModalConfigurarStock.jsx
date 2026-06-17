import { useState } from 'react'
import Modal from '@/components/common/Modal'
import Boton from '@/components/common/Boton'
import { actualizarStockConfig } from '@/services/supabase/stock'

export default function ModalConfigurarStock({ abierto, alCerrar, producto, onActualizarStock }) {
  const [stockMinimo, setStockMinimo] = useState(producto?.stockMinimo ?? 0)
  const [stockMaximo, setStockMaximo] = useState(producto?.stockMaximo ?? null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const manejarGuardar = async () => {
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
      <div className="space-y-4">
        {error && <p className="text-sm text-estado-critico">{error}</p>}
        <div>
          <label className="block text-sm text-secundario mb-1">Stock Mínimo</label>
          <input
            type="number"
            value={stockMinimo}
            onChange={e => setStockMinimo(Number(e.target.value))}
            min="0"
            className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm text-secundario mb-1">Stock Máximo</label>
          <input
            type="number"
            value={stockMaximo ?? ''}
            onChange={e => setStockMaximo(e.target.value ? Number(e.target.value) : null)}
            min="0"
            className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md"
            placeholder="Sin límite"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
          <Boton variante="secundario" onClick={alCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={manejarGuardar} cargando={guardando}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  )
}
