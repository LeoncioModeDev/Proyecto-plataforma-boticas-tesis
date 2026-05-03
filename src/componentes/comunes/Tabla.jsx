import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import CampoBusqueda from './CampoBusqueda'

/**
 * Tabla genérica con TanStack Table.
 * Soporta paginación, búsqueda global y ordenamiento.
 */
export default function Tabla({
  columnas,
  datos,
  paginacion = true,
  busqueda = true,
  tamanoPagina = 10,
  alClickFila,
}) {
  const [filtroGlobal, setFiltroGlobal] = useState('')
  const [ordenamiento, setOrdenamiento] = useState([])

  const columnasTabla = useMemo(() =>
    columnas.map(col => ({
      accessorKey: col.campo,
      header: col.encabezado,
      cell: col.render ? (info) => col.render(info.row.original) : (info) => info.getValue(),
      enableSorting: col.ordenable !== false,
    })),
    [columnas]
  )

  const tabla = useReactTable({
    data: datos,
    columns: columnasTabla,
    state: { globalFilter: filtroGlobal, sorting: ordenamiento },
    onGlobalFilterChange: setFiltroGlobal,
    onSortingChange: setOrdenamiento,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginacion && {
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize: tamanoPagina } },
    }),
  })

  return (
    <div>
      {busqueda && (
        <div className="mb-4">
          <CampoBusqueda
            valor={filtroGlobal}
            alCambiar={setFiltroGlobal}
            placeholder="Buscar en tabla..."
            className="max-w-sm"
          />
        </div>
      )}

      <div className="border border-neutro-gris-borde rounded-tarjeta overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {tabla.getHeaderGroups().map(grupo => (
                <tr key={grupo.id} className="bg-neutro-blanco-suave border-b border-neutro-gris-borde">
                  {grupo.headers.map(encabezado => (
                    <th
                      key={encabezado.id}
                      onClick={encabezado.column.getToggleSortingHandler()}
                      className="px-4 py-3 text-left text-etiqueta font-semibold text-neutro-negro-suave cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(encabezado.column.columnDef.header, encabezado.getContext())}
                        {encabezado.column.getIsSorted() === 'asc' && <ChevronUp className="h-3 w-3" />}
                        {encabezado.column.getIsSorted() === 'desc' && <ChevronDown className="h-3 w-3" />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {tabla.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columnas.length} className="px-4 py-8 text-center text-secundario text-neutro-gris-texto">
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                tabla.getRowModel().rows.map(fila => (
                  <tr
                    key={fila.id}
                    onClick={() => alClickFila && alClickFila(fila.original)}
                    className={`border-b border-neutro-gris-borde last:border-b-0 hover:bg-marca-claro transition-colors ${alClickFila ? 'cursor-pointer' : ''}`}
                    style={{ minHeight: '44px' }}
                  >
                    {fila.getVisibleCells().map(celda => (
                      <td key={celda.id} className="px-4 py-3 text-cuerpo text-neutro-negro-suave">
                        {flexRender(celda.column.columnDef.cell, celda.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paginacion && tabla.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-4 text-secundario text-neutro-gris-texto">
          <span>
            Página {tabla.getState().pagination.pageIndex + 1} de {tabla.getPageCount()} — {tabla.getFilteredRowModel().rows.length} registros
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => tabla.previousPage()} disabled={!tabla.getCanPreviousPage()} className="p-1.5 rounded hover:bg-neutro-blanco-suave disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => tabla.nextPage()} disabled={!tabla.getCanNextPage()} className="p-1.5 rounded hover:bg-neutro-blanco-suave disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
