import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

import useAutenticacion from '@/state/useAutenticacion'
import RutaProtegida from './RutaProtegida'
import { ROLES } from '@/constants/roles'

import BarraLateral from '@/components/navigation/BarraLateral'
import BarraSuperior from '@/components/navigation/BarraSuperior'

// Autenticación
import InicioSesion from '@/pages/auth/InicioSesion'
import RestablecerContrasena from '@/pages/auth/RestablecerContrasena'

// Portal Central
import PaginaDashboardCentral from '@/pages/central-portal/PaginaDashboardCentral'
import PaginaCatalogo from '@/pages/central-portal/inventory-module/catalog/PaginaCatalogo'
import FormularioProducto from '@/pages/central-portal/inventory-module/catalog/FormularioProducto'
import DetalleProducto from '@/pages/central-portal/inventory-module/catalog/DetalleProducto'
import PaginaStock from '@/pages/central-portal/inventory-module/stock/PaginaStock'
import PaginaLotes from '@/pages/central-portal/inventory-module/lots/PaginaLotes'
import PaginaMovimientos from '@/pages/central-portal/inventory-module/movements/PaginaMovimientos'
import PaginaAjustes from '@/pages/central-portal/inventory-module/adjustments/PaginaAjustes'
import PaginaReportes from '@/pages/central-portal/inventory-module/reports/PaginaReportes'
import ReporteKardex from '@/pages/central-portal/inventory-module/reports/ReporteKardex'
import ReporteStockCritico from '@/pages/central-portal/inventory-module/reports/ReporteStockCritico'
import ReporteMovimientos from '@/pages/central-portal/inventory-module/reports/ReporteMovimientos'
import PaginaDistribucion from '@/pages/central-portal/distribution-module/PaginaDistribucion'
import PaginaProveedores from '@/pages/central-portal/suppliers-module/PaginaProveedores'

// Portal Boticas
import PaginaStockBotica from '@/pages/pharmacy-portal/PaginaStockBotica'
import PaginaLotesBotica from '@/pages/pharmacy-portal/PaginaLotesBotica'
import PaginaMovimientosBotica from '@/pages/pharmacy-portal/PaginaMovimientosBotica'

// Panel ML
import PaginaPredicciones from '@/pages/ml-panel/PaginaPredicciones'
import PaginaAlertas from '@/pages/ml-panel/PaginaAlertas'
import PaginaRecomendaciones from '@/pages/ml-panel/PaginaRecomendaciones'

/**
 * Layout principal con barra lateral y superior.
 */
function LayoutPrincipal() {
  return (
    <div className="min-h-screen bg-neutro-blanco-suave">
      <BarraLateral />
      <BarraSuperior />
      <main className="ml-60 mt-14 p-8">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * Redirección inicial según rol del usuario.
 */
function RedirectPorRol() {
  const { usuario, autenticado } = useAutenticacion()
  if (!autenticado) return <Navigate to="/iniciar-sesion" replace />

  switch (usuario?.rol) {
    case ROLES.ADMIN_CENTRAL:
      return <Navigate to="/central/dashboard" replace />
    case ROLES.OPERADOR_DROGUERIA:
      return <Navigate to="/botica/stock" replace />
    case ROLES.VISOR_BOTICA:
      return <Navigate to="/ml/predicciones" replace />
    default:
      return <Navigate to="/iniciar-sesion" replace />
  }
}

/**
 * Definición centralizada de todas las rutas.
 */
export default function Rutas() {
  return (
    <Routes>
      {/* Raíz redirige según rol */}
      <Route path="/" element={<RedirectPorRol />} />

      {/* Autenticación */}
      <Route path="/iniciar-sesion" element={<InicioSesion />} />
      <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />

      {/* Rutas protegidas con layout */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        {/* Portal Central */}
        <Route path="/central/dashboard" element={<PaginaDashboardCentral />} />
        <Route path="/central/inventario/catalogo" element={<PaginaCatalogo />} />
        <Route path="/central/inventario/catalogo/nuevo" element={<FormularioProducto />} />
        <Route path="/central/inventario/catalogo/:id" element={<DetalleProducto />} />
        <Route path="/central/inventario/stock" element={<PaginaStock />} />
        <Route path="/central/inventario/lotes" element={<PaginaLotes />} />
        <Route path="/central/inventario/movimientos" element={<PaginaMovimientos />} />
        <Route path="/central/inventario/ajustes" element={<PaginaAjustes />} />
        <Route path="/central/inventario/reportes" element={<PaginaReportes />} />
        <Route path="/central/inventario/reportes/kardex" element={<ReporteKardex />} />
        <Route path="/central/inventario/reportes/stock-critico" element={<ReporteStockCritico />} />
        <Route path="/central/inventario/reportes/movimientos" element={<ReporteMovimientos />} />
        <Route path="/central/distribucion" element={<PaginaDistribucion />} />
        <Route path="/central/proveedores" element={<PaginaProveedores />} />
      </Route>

      {/* Portal Boticas */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.OPERADOR_DROGUERIA, ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/botica/stock" element={<PaginaStockBotica />} />
        <Route path="/botica/lotes" element={<PaginaLotesBotica />} />
        <Route path="/botica/movimientos" element={<PaginaMovimientosBotica />} />
      </Route>

      {/* Panel ML */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.VISOR_BOTICA, ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/ml/predicciones" element={<PaginaPredicciones />} />
        <Route path="/ml/alertas" element={<PaginaAlertas />} />
        <Route path="/ml/recomendaciones" element={<PaginaRecomendaciones />} />
      </Route>

      {/* Ruta no encontrada */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
