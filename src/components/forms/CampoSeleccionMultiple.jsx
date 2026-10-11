import { useState } from 'react'
import { Search, X } from 'lucide-react'

export default function CampoSeleccionMultiple({
  etiqueta,
  opciones = [],
  valoresSeleccionados = [],
  alCambiar,
  error,
  requerido,
}) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = opciones.filter(op =>
    op.etiqueta.toLowerCase().includes(busqueda.toLowerCase())
  )

  const toggle = (valor) => {
    const nuevos = valoresSeleccionados.includes(valor)
      ? valoresSeleccionados.filter(v => v !== valor)
      : [...valoresSeleccionados, valor]
    alCambiar(nuevos)
  }

  const seleccionados = opciones.filter(op => valoresSeleccionados.includes(op.valor))

  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label className="text-sm font-medium text-principal">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <div className="border border-estilo rounded-md bg-fondo p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-secundario" />
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-fondo-secundario border border-estilo rounded-md focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          {filtrados.length > 0 ? filtrados.map(op => (
            <label key={op.valor} className="flex items-center gap-2 text-sm cursor-pointer select-none py-1 px-1 rounded hover:bg-marca-claro">
              <input
                type="checkbox"
                checked={valoresSeleccionados.includes(op.valor)}
                onChange={() => toggle(op.valor)}
                className="rounded border-estilo text-marca-principal focus:ring-marca-principal"
              />
              {op.etiqueta}
            </label>
          )) : (
            <p className="text-sm text-secundario col-span-2 text-center py-2">No se encontraron resultados</p>
          )}
        </div>
        {seleccionados.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-estilo">
            {seleccionados.map(s => (
              <span key={s.valor} className="inline-flex items-center gap-1 bg-marca-principal text-white px-2 py-1 rounded-md text-sm">
                {s.etiqueta}
                <button type="button" onClick={() => toggle(s.valor)} className="hover:bg-white/20 rounded-sm p-0.5">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-estado-critico">{error}</p>}
    </div>
  )
}
