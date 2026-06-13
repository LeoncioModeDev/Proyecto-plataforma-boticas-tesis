import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CampoSeleccionUbigeo({ etiqueta, opciones = [], valor, alCambiar, error, requerido }) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const contenedorRef = useRef(null)

  const seleccionada = opciones.find(op => op.valor === valor)

  const filtrados = busqueda
    ? opciones.filter(op => op.etiqueta.toLowerCase().includes(busqueda.toLowerCase()))
    : opciones

  useEffect(() => {
    function handleClickOutside(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col gap-1.5" ref={contenedorRef}>
      {etiqueta && (
        <label className="text-sm font-medium text-principal">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <div className="relative">
        <div
          className={`flex items-center gap-2 px-3 py-2 text-sm bg-fondo border rounded-md cursor-pointer transition-colors
            ${abierto ? 'border-marca-principal ring-1 ring-marca-principal' : 'border-estilo'}
          `}
          onClick={() => setAbierto(!abierto)}
        >
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-principal placeholder:text-secundario"
            placeholder="Buscar ubigeo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onFocus={() => setAbierto(true)}
          />
          <ChevronDown className={`size-4 text-secundario transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
        {seleccionada && !abierto && (
          <p className="text-xs text-secundario mt-1">{seleccionada.etiqueta}</p>
        )}
        {abierto && (
          <div className="absolute z-10 mt-1 w-full bg-fondo border border-estilo rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filtrados.length > 0 ? filtrados.map(op => (
              <button
                key={op.valor}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-marca-claro transition-colors ${op.valor === valor ? 'bg-marca-claro font-medium' : ''}`}
                onClick={() => {
                  alCambiar(op.valor)
                  setAbierto(false)
                  setBusqueda('')
                }}
              >
                <span className="text-principal">{op.etiqueta}</span>
              </button>
            )) : (
              <p className="px-3 py-2 text-sm text-secundario">Sin resultados</p>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-estado-critico">{error}</p>}
    </div>
  )
}