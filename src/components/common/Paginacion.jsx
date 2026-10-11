import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Paginacion({ pagina, totalPaginas, total, alCambiar }) {
  if (totalPaginas <= 1) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2 text-xs sm:text-sm text-secundario">
      <span className="order-2 sm:order-1">
        Página {pagina} de {totalPaginas} — {total} registros
      </span>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button onClick={() => alCambiar(Math.max(pagina - 1, 1))} disabled={pagina <= 1} className="p-1.5 rounded hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => alCambiar(Math.min(pagina + 1, totalPaginas))} disabled={pagina >= totalPaginas} className="p-1.5 rounded hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
