import { useState } from 'react'
import Modal from './Modal'
import Boton from './Boton'
import { AlertTriangle } from 'lucide-react'

export default function ModalConfirmar({ abierto, alCerrar, alConfirmar, titulo, mensaje, requiereMotivo, etiquetaBoton }) {
  const [motivo, setMotivo] = useState('')

  const handleConfirmar = () => {
    if (requiereMotivo && !motivo.trim()) return
    alConfirmar(motivo)
    setMotivo('')
  }

  const handleCerrar = () => {
    setMotivo('')
    alCerrar()
  }

  return (
    <Modal abierto={abierto} alCerrar={handleCerrar} titulo={titulo} tamano="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-estado-info-fondo rounded-md">
          <AlertTriangle className="h-5 w-5 text-estado-info shrink-0 mt-0.5" />
          <p className="text-sm text-principal">{mensaje}</p>
        </div>

        {requiereMotivo && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Motivo *</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Indica el motivo..."
              rows={2}
              className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
              required
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-estilo">
          <Boton variante="secundario" onClick={handleCerrar}>Cancelar</Boton>
          <Boton variante="primario" onClick={handleConfirmar} disabled={requiereMotivo && !motivo.trim()}>
            {etiquetaBoton || 'Confirmar'}
          </Boton>
        </div>
      </div>
    </Modal>
  )
}
