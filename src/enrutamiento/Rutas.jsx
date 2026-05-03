import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

import useAutenticacion from '@/estado/useAutenticacion'
import RutaProtegida from './RutaProtegida'
import { ROLES } from '@/constantes/roles'

import BarraLateral from '@/componentes/navegacion/BarraLateral'
import BarraSuperior from '@/componentes/navegacion/BarraSuperior'

// Autenticación
import InicioSesion from '@/paginas/autenticacion/InicioSesion'
import RestablecerContrasena from '@/paginas/autenticacion/RestablecerContrasena'

// Portal Central
import PaginaDashboardCentral from '@/paginas/portal-central/PaginaDashboardCentral'
import PaginaCatalogo from '@/paginas/portal-central/modulo-inventario/catalogo/PaginaCatalogo'
import FormularioProducto from '@/paginas/portal-central/modulo-inventario/catalogo/FormularioProducto'
import DetalleProducto from '@/paginas/portal-central/modulo-inventario/catalogo/DetalleProducto'
import PaginaStock from '@/paginas/portal-central/modulo-inventario/stock/PaginaStock'
import PaginaLotes from '@/paginas/portal-central/modulo-inventario/lotes/PaginaLotes'
import PaginaMovimientos from '@/paginas/portal-central/modulo-inventario/movimientos/PaginaMovimientos'
import PaginaAjustes from '@/paginas/portal-central/modulo-inventario/ajustes/PaginaAjustes'
import PaginaReportes from '@/paginas/portal-central/modulo-inventario/reportes/PaginaReportes'
import ReporteKardex from '@/paginas/portal-central/modulo-inventario/reportes/ReporteKardex'
import ReporteStockCritico from '@/paginas/portal-central/modulo-inventario/reportes/ReporteStockCritico'
import ReporteMovimientos from '@/paginas/portal-central/modulo-inventario/reportes/ReporteMovimientos'
import PaginaDistribucion from '@/paginas/portal-central/modulo-distribucion/PaginaDistribucion'
import PaginaProveedores from '@/paginas/portal-central/modulo-proveedores/PaginaProveedores'

// Portal Boticas
import PaginaStockBotica from '@/paginas/portal-boticas/PaginaStockBotica'
import PaginaLotesBotica from '@/paginas/portal-boticas/PaginaLotesBotica'
import PaginaMovimientosBotica from '@/paginas/portal-boticas/PaginaMovimientosBotica'

// Panel ML
import PaginaPredicciones from '@/paginas/panel-ml/PaginaPredicciones'
import PaginaAlertas from '@/paginas/panel-ml/PaginaAlertas'
import PaginaRecomendaciones from '@/paginas/panel-ml/PaginaRecomendaciones'

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
