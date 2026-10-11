import { useId, useMemo } from 'react'
import { cn } from '@/utilities/cn'

export default function SelectBusquedaFiltro({ valor, alCambiar, opciones = [], placeholder = 'Buscar...', className }) {
  const id = useId()
  const etiquetaActual = useMemo(
    () => opciones.find(op => op.valor === valor)?.etiqueta || '',
    [opciones, valor],
  )

  const manejarCambio = (texto) => {
    const opcion = opciones.find(op => op.etiqueta.toLowerCase() === texto.toLowerCase())
    if (opcion) alCambiar(opcion.valor)
    if (!texto) alCambiar('')
  }

  return (
    <div className={cn('w-full sm:w-64', className)}>
      <input
        list={id}
        key={valor || 'sin-seleccion'}
        defaultValue={etiquetaActual}
        onChange={e => manejarCambio(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal placeholder:text-secundario focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal"
      />
      <datalist id={id}>
        {opciones.map(op => <option key={op.valor} value={op.etiqueta} />)}
      </datalist>
    </div>
  )
}
