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
    <div className="w-full">
      {busqueda && (
        <div className="mb-4">
          <CampoBusqueda
            valor={filtroGlobal}
            alCambiar={setFiltroGlobal}
            placeholder="Buscar en tabla..."
            className="max-w-xs sm:max-w-sm"
          />
        </div>
      )}

      <div className="border border-estilo rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              {tabla.getHeaderGroups().map(grupo => (
                <tr key={grupo.id} className="bg-fondo border-b border-estilo">
                  {grupo.headers.map(encabezado => (
                    <th
                      key={encabezado.id}
                      onClick={encabezado.column.getToggleSortingHandler()}
                      className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-principal cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
                  <td colSpan={columnas.length} className="px-4 py-8 text-center text-secundario text-secundario">
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                tabla.getRowModel().rows.map(fila => (
                  <tr
                    key={fila.id}
                    onClick={() => alClickFila && alClickFila(fila.original)}
                    className={`border-b border-estilo last:border-b-0 hover:bg-marca-claro dark:hover:bg-marca-claro transition-colors ${alClickFila ? 'cursor-pointer' : ''}`}
                    style={{ minHeight: '44px' }}
                  >
                    {fila.getVisibleCells().map(celda => (
                      <td key={celda.id} className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-principal">
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
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2 text-xs sm:text-sm text-secundario">
          <span className="order-2 sm:order-1">
            Página {tabla.getState().pagination.pageIndex + 1} de {tabla.getPageCount()} — {tabla.getFilteredRowModel().rows.length} registros
          </span>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button onClick={() => tabla.previousPage()} disabled={!tabla.getCanPreviousPage()} className="p-1.5 rounded hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => tabla.nextPage()} disabled={!tabla.getCanNextPage()} className="p-1.5 rounded hover:bg-fondo disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
