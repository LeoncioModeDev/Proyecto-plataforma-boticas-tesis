import { cn } from '@/utilities/cn'

export default function SelectFiltro({ valor, alCambiar, opciones = [], placeholder = 'Todos', className, 'aria-label': ariaLabel }) {
  return (
    <select
      value={valor}
      onChange={e => alCambiar(e.target.value)}
      aria-label={ariaLabel || placeholder}
      className={cn('w-full sm:w-56 px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal', className)}
    >
      <option value="">{placeholder}</option>
      {opciones.map(op => (
        <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
      ))}
    </select>
  )
}
