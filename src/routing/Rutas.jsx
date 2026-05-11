import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

import useAutenticacion from '@/state/useAutenticacion'
import useBarraLateral from '@/state/useBarraLateral'
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
import PaginaTransferencias from '@/pages/central-portal/distribution-module/PaginaDistribucion'
import PaginaDespachos from '@/pages/central-portal/distribution-module/despachos/PaginaDespachos'
import PaginaRecepciones from '@/pages/central-portal/distribution-module/recepciones/PaginaRecepciones'
import PaginaHistorialDistribucion from '@/pages/central-portal/distribution-module/historial/PaginaHistorialDistribucion'
import PaginaProveedores from '@/pages/central-portal/suppliers-module/PaginaProveedores'
import PaginaNuevoProveedor from '@/pages/central-portal/suppliers-module/new/PaginaNuevoProveedor'
import PaginaEditarProveedor from '@/pages/central-portal/suppliers-module/edit/PaginaEditarProveedor'

// Portal Boticas
import PaginaStockBotica from '@/pages/pharmacy-portal/PaginaStockBotica'
import PaginaLotesBotica from '@/pages/pharmacy-portal/PaginaLotesBotica'
import PaginaMovimientosBotica from '@/pages/pharmacy-portal/PaginaMovimientosBotica'

// Panel ML
import PaginaPredicciones from '@/pages/ml-panel/PaginaPredicciones'
import PaginaAlertas from '@/pages/ml-panel/PaginaAlertas'
import PaginaRecomendaciones from '@/pages/ml-panel/PaginaRecomendaciones'

function LayoutPrincipal() {
  const { colapsada } = useBarraLateral()

  return (
    <div className="min-h-screen bg-fondo transition-colors">
      <BarraLateral />
      <BarraSuperior />
      <main className={`mt-14 p-4 lg:p-8 transition-all duration-200 ${colapsada ? 'ml-16' : 'ml-56 lg:ml-60'}`}>
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
        <Route path="/central/distribucion/transferencias" element={<PaginaTransferencias />} />
        <Route path="/central/distribucion/despachos" element={<PaginaDespachos />} />
        <Route path="/central/distribucion/recepciones" element={<PaginaRecepciones />} />
        <Route path="/central/distribucion/historial" element={<PaginaHistorialDistribucion />} />
        <Route path="/central/proveedores" element={<PaginaProveedores />} />
        <Route path="/central/proveedores/nuevo" element={<PaginaNuevoProveedor />} />
        <Route path="/central/proveedores/:id" element={<PaginaEditarProveedor />} />
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
