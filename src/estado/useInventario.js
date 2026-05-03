import { create } from 'zustand'

/**
 * Store del módulo de inventario.
 * Mantiene filtros, paginación y selección activa.
 */
const useInventario = create((set) => ({
  filtroUbicacion: '',
  filtroEstado: '',
  filtroBusqueda: '',
  productoSeleccionado: null,
  paginaActual: 0,

  establecerFiltroUbicacion: (valor) => set({ filtroUbicacion: valor, paginaActual: 0 }),
  establecerFiltroEstado: (valor) => set({ filtroEstado: valor, paginaActual: 0 }),
  establecerFiltroBusqueda: (valor) => set({ filtroBusqueda: valor, paginaActual: 0 }),
  seleccionarProducto: (producto) => set({ productoSeleccionado: producto }),
  establecerPagina: (pagina) => set({ paginaActual: pagina }),
  limpiarFiltros: () => set({ filtroUbicacion: '', filtroEstado: '', filtroBusqueda: '', paginaActual: 0 }),
}))

export default useInventario
