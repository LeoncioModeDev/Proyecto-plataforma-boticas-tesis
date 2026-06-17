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
import PaginaNoAutorizado from '@/pages/auth/PaginaNoAutorizado'

// Portal Central
import PaginaDashboardCentral from '@/pages/central-portal/PaginaDashboardCentral'
import PaginaCatalogo from '@/pages/central-portal/inventory-module/catalog/PaginaCatalogo'
import FormularioProducto from '@/pages/central-portal/inventory-module/catalog/FormularioProducto'
import DetalleProducto from '@/pages/central-portal/inventory-module/catalog/DetalleProducto'
import PaginaStock from '@/pages/central-portal/inventory-module/stock/PaginaStock'
import PaginaLotes from '@/pages/central-portal/inventory-module/lots/PaginaLotes'
import PaginaMovimientos from '@/pages/central-portal/inventory-module/movements/PaginaMovimientos'
import PaginaAjustes from '@/pages/central-portal/inventory-module/adjustments/PaginaAjustes'
import FormularioAjuste from '@/pages/central-portal/inventory-module/adjustments/FormularioAjuste'
import PaginaReportes from '@/pages/central-portal/inventory-module/reports/PaginaReportes'
import ReporteKardex from '@/pages/central-portal/inventory-module/reports/ReporteKardex'
import ReporteStockCritico from '@/pages/central-portal/inventory-module/reports/ReporteStockCritico'
import ReporteMovimientos from '@/pages/central-portal/inventory-module/reports/ReporteMovimientos'
import ReporteRotacion from '@/pages/central-portal/inventory-module/reports/ReporteRotacion'
import PaginaTransferencias from '@/pages/central-portal/distribution-module/PaginaTransferencias'
import PaginaRedistribucionCentral from '@/pages/central-portal/distribution-module/PaginaRedistribucion'
import FormularioTransferencia from '@/pages/central-portal/distribution-module/FormularioTransferencia'
import PaginaHistorialDistribucion from '@/pages/central-portal/distribution-module/historial/PaginaHistorialDistribucion'
import PaginaProveedores from '@/pages/central-portal/suppliers-module/PaginaProveedores'
import PaginaVerProveedor from '@/pages/central-portal/suppliers-module/ver/PaginaVerProveedor'
import PaginaNuevoProveedor from '@/pages/central-portal/suppliers-module/new/PaginaNuevoProveedor'
import PaginaEditarProveedor from '@/pages/central-portal/suppliers-module/edit/PaginaEditarProveedor'
import PaginaOrdenesCompraCentral from '@/pages/central-portal/suppliers-module/PaginaOrdenesCompra'
import PaginaNuevaOrdenCompraCentral from '@/pages/central-portal/suppliers-module/new/PaginaNuevaOrdenCompra'
import PaginaRecepcionOrden from '@/pages/central-portal/suppliers-module/PaginaRecepcionOrden'
import PaginaHistorialOrdenesCentral from '@/pages/central-portal/suppliers-module/PaginaHistorialOrdenes'
import PaginaRecepcionesCentral from '@/pages/central-portal/suppliers-module/PaginaRecepciones'
import DetalleRecepcionCentral from '@/pages/central-portal/suppliers-module/DetalleRecepcion'
import PaginaUsuarios from '@/pages/central-portal/administration-module/PaginaUsuarios'
import PaginaBoticas from '@/pages/central-portal/administration-module/PaginaBoticas'
import PaginaConfiguracionGeneral from '@/pages/central-portal/administration-module/PaginaConfiguracionGeneral'
import PaginaAuditoria from '@/pages/central-portal/administration-module/PaginaAuditoria'
import PaginaNuevaBotica from '@/pages/central-portal/administration-module/new/PaginaNuevaBotica'
import PaginaEditarBotica from '@/pages/central-portal/administration-module/edit/PaginaEditarBotica'
import CrearOrganizacion from '@/pages/admin/CrearOrganizacion'
import PaginaDashboardSaaS from '@/pages/admin-saas/PaginaDashboardSaaS'

// Portal Boticas
import PaginaStockBotica from '@/pages/pharmacy-portal/PaginaStockBotica'
import PaginaLotesBotica from '@/pages/pharmacy-portal/PaginaLotesBotica'
import PaginaMovimientosBotica from '@/pages/pharmacy-portal/PaginaMovimientosBotica'
import PaginaDashboardBotica from '@/pages/pharmacy-portal/PaginaDashboardBotica'
import PaginaTransferenciasBotica from '@/pages/pharmacy-portal/PaginaTransferenciasBotica'
import PaginaAlertasBotica from '@/pages/pharmacy-portal/PaginaAlertasBotica'
import PaginaMLBotica from '@/pages/pharmacy-portal/PaginaMLBotica'
import PaginaRecomendacionesBotica from '@/pages/pharmacy-portal/PaginaRecomendacionesBotica'

// Portal Operaciones
import PaginaDashboardOperaciones from '@/pages/operations-portal/PaginaDashboardOperaciones'
import PaginaCatalogoOperaciones from '@/pages/operations-portal/inventory-module/PaginaCatalogo'
import PaginaStockOperaciones from '@/pages/operations-portal/inventory-module/PaginaStock'
import PaginaLotesOperaciones from '@/pages/operations-portal/inventory-module/PaginaLotes'
import PaginaMovimientosOperaciones from '@/pages/operations-portal/inventory-module/PaginaMovimientos'
import PaginaAjustesOperaciones from '@/pages/operations-portal/inventory-module/PaginaAjustes'
import PaginaReportesOperaciones from '@/pages/operations-portal/inventory-module/PaginaReportes'
import PaginaTransferenciasOperaciones from '@/pages/operations-portal/distribution-module/PaginaTransferencias'
import FormularioTransferenciaOperaciones from '@/pages/operations-portal/distribution-module/FormularioTransferencia'
import PaginaRedistribucionOperaciones from '@/pages/operations-portal/distribution-module/PaginaRedistribucion'
import PaginaProveedoresOperaciones from '@/pages/operations-portal/suppliers-module/PaginaProveedores'
import PaginaVerProveedorOperaciones from '@/pages/central-portal/suppliers-module/ver/PaginaVerProveedor'
import PaginaOrdenesCompraOperaciones from '@/pages/operations-portal/suppliers-module/PaginaOrdenesCompra'
import PaginaNuevaOrdenCompraOperaciones from '@/pages/operations-portal/suppliers-module/PaginaNuevaOrdenCompra'
import PaginaAlertasOperaciones from '@/pages/operations-portal/PaginaAlertas'
import PaginaPrediccionesOperaciones from '@/pages/operations-portal/ml-module/PaginaPredicciones'
import PaginaAlertasDemandaOperaciones from '@/pages/operations-portal/ml-module/PaginaAlertasDemanda'
// Reused from Central Portal for Operations
import FormularioProductoOperaciones from '@/pages/central-portal/inventory-module/catalog/FormularioProducto'
import DetalleProductoOperaciones from '@/pages/central-portal/inventory-module/catalog/DetalleProducto'
import FormularioAjusteOperaciones from '@/pages/central-portal/inventory-module/adjustments/FormularioAjuste'
import ReporteKardexOperaciones from '@/pages/central-portal/inventory-module/reports/ReporteKardex'
import ReporteStockCriticoOperaciones from '@/pages/central-portal/inventory-module/reports/ReporteStockCritico'
import ReporteMovimientosOperaciones from '@/pages/central-portal/inventory-module/reports/ReporteMovimientos'
import ReporteRotacionOperaciones from '@/pages/central-portal/inventory-module/reports/ReporteRotacion'
import PaginaNuevoProveedorOperaciones from '@/pages/central-portal/suppliers-module/new/PaginaNuevoProveedor'
import PaginaEditarProveedorOperaciones from '@/pages/central-portal/suppliers-module/edit/PaginaEditarProveedor'
import PaginaRecepcionOrdenOperaciones from '@/pages/central-portal/suppliers-module/PaginaRecepcionOrden'
import PaginaRecepcionesOperaciones from '@/pages/central-portal/suppliers-module/PaginaRecepciones'
import DetalleRecepcionOperaciones from '@/pages/central-portal/suppliers-module/DetalleRecepcion'

// Panel ML
import PaginaPredicciones from '@/pages/ml-panel/PaginaPredicciones'
import PaginaAlertas from '@/pages/ml-panel/PaginaAlertas'
import PaginaRecomendaciones from '@/pages/ml-panel/PaginaRecomendaciones'
import PaginaMonitoreoML from '@/pages/ml-panel/PaginaMonitoreoML'

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
    case ROLES.SUPER_ADMIN:
      return <Navigate to="/admin-saas/dashboard" replace />
    case ROLES.ADMIN_CENTRAL:
      return <Navigate to="/central/dashboard" replace />
    case ROLES.OPERADOR_DROGUERIA:
      return <Navigate to="/operaciones/dashboard" replace />
    case ROLES.VISOR_BOTICA:
      return <Navigate to="/botica/dashboard" replace />
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

      {/* Portal Central (solo ADMIN) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/central/dashboard" element={<PaginaDashboardCentral />} />
        <Route path="/central/inventario/catalogo" element={<PaginaCatalogo />} />
        <Route path="/central/inventario/catalogo/nuevo" element={<FormularioProducto />} />
        <Route path="/central/inventario/catalogo/:id" element={<DetalleProducto />} />
        <Route path="/central/inventario/catalogo/:id/editar" element={<FormularioProducto />} />
        <Route path="/central/inventario/stock" element={<PaginaStock />} />
        <Route path="/central/inventario/lotes" element={<PaginaLotes />} />

        <Route path="/central/inventario/movimientos" element={<PaginaMovimientos />} />
        <Route path="/central/inventario/ajustes" element={<PaginaAjustes />} />
        <Route path="/central/inventario/ajustes/nuevo" element={<FormularioAjuste />} />
        <Route path="/central/inventario/reportes" element={<PaginaReportes />} />
        <Route path="/central/inventario/reportes/kardex" element={<ReporteKardex />} />
        <Route path="/central/inventario/reportes/stock-critico" element={<ReporteStockCritico />} />
        <Route path="/central/inventario/reportes/movimientos" element={<ReporteMovimientos />} />
        <Route path="/central/inventario/reportes/rotacion" element={<ReporteRotacion />} />
        <Route path="/central/distribucion/transferencias" element={<PaginaTransferencias />} />
        <Route path="/central/distribucion/transferencias/nueva" element={<FormularioTransferencia />} />
        <Route path="/central/distribucion/redistribucion" element={<PaginaRedistribucionCentral />} />
        <Route path="/central/distribucion/historial" element={<PaginaHistorialDistribucion />} />
        <Route path="/central/proveedores" element={<PaginaProveedores />} />
        <Route path="/central/proveedores/nuevo" element={<PaginaNuevoProveedor />} />
        <Route path="/central/proveedores/:id" element={<PaginaVerProveedor />} />
        <Route path="/central/proveedores/:id/editar" element={<PaginaEditarProveedor />} />
        <Route path="/central/proveedores/ordenes" element={<PaginaOrdenesCompraCentral />} />
        <Route path="/central/proveedores/ordenes/nueva" element={<PaginaNuevaOrdenCompraCentral />} />
        <Route path="/central/proveedores/ordenes/:id/recibir" element={<PaginaRecepcionOrden />} />
        <Route path="/central/proveedores/ordenes/historial" element={<PaginaHistorialOrdenesCentral />} />
        <Route path="/central/proveedores/recepciones" element={<PaginaRecepcionesCentral />} />
        <Route path="/central/proveedores/recepciones/:id" element={<DetalleRecepcionCentral />} />
        <Route path="/central/administracion/usuarios" element={<PaginaUsuarios />} />
        <Route path="/central/administracion/boticas" element={<PaginaBoticas />} />
        <Route path="/central/administracion/boticas/nueva" element={<PaginaNuevaBotica />} />
        <Route path="/central/administracion/boticas/:id" element={<PaginaEditarBotica />} />
        <Route path="/central/administracion/configuracion" element={<PaginaConfiguracionGeneral />} />
        <Route path="/central/administracion/auditoria" element={<PaginaAuditoria />} />
      </Route>

      {/* Portal Botica (VISOR + ADMIN) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.VISOR_BOTICA, ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/botica/stock" element={<PaginaStockBotica />} />
        <Route path="/botica/lotes" element={<PaginaLotesBotica />} />
        <Route path="/botica/movimientos" element={<PaginaMovimientosBotica />} />
        <Route path="/botica/dashboard" element={<PaginaDashboardBotica />} />
        <Route path="/botica/transferencias" element={<PaginaTransferenciasBotica />} />
        <Route path="/botica/alertas" element={<PaginaAlertasBotica />} />
        <Route path="/botica/ml" element={<PaginaMLBotica />} />
        <Route path="/botica/recomendaciones" element={<PaginaRecomendacionesBotica />} />
      </Route>

      {/* Portal Operaciones (solo OPERADOR) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.OPERADOR_DROGUERIA, ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/operaciones/dashboard" element={<PaginaDashboardOperaciones />} />
        <Route path="/operaciones/inventario/catalogo" element={<PaginaCatalogoOperaciones />} />
        <Route path="/operaciones/inventario/catalogo/nuevo" element={<FormularioProductoOperaciones />} />
        <Route path="/operaciones/inventario/catalogo/:id" element={<DetalleProductoOperaciones />} />
        <Route path="/operaciones/inventario/catalogo/:id/editar" element={<FormularioProductoOperaciones />} />
        <Route path="/operaciones/inventario/stock" element={<PaginaStockOperaciones />} />
        <Route path="/operaciones/inventario/lotes" element={<PaginaLotesOperaciones />} />

        <Route path="/operaciones/inventario/movimientos" element={<PaginaMovimientosOperaciones />} />
        <Route path="/operaciones/inventario/ajustes" element={<PaginaAjustesOperaciones />} />
        <Route path="/operaciones/inventario/ajustes/nuevo" element={<FormularioAjusteOperaciones />} />
        <Route path="/operaciones/inventario/reportes" element={<PaginaReportesOperaciones />} />
        <Route path="/operaciones/inventario/reportes/kardex" element={<ReporteKardexOperaciones />} />
        <Route path="/operaciones/inventario/reportes/stock-critico" element={<ReporteStockCriticoOperaciones />} />
        <Route path="/operaciones/inventario/reportes/movimientos" element={<ReporteMovimientosOperaciones />} />
        <Route path="/operaciones/inventario/reportes/rotacion" element={<ReporteRotacionOperaciones />} />
        <Route path="/operaciones/distribucion/transferencias" element={<PaginaTransferenciasOperaciones />} />
        <Route path="/operaciones/distribucion/transferencias/nueva" element={<FormularioTransferenciaOperaciones />} />
        <Route path="/operaciones/distribucion/redistribucion" element={<PaginaRedistribucionOperaciones />} />
        <Route path="/operaciones/proveedores" element={<PaginaProveedoresOperaciones />} />
        <Route path="/operaciones/proveedores/nuevo" element={<PaginaNuevoProveedorOperaciones />} />
        <Route path="/operaciones/proveedores/:id" element={<PaginaVerProveedorOperaciones />} />
        <Route path="/operaciones/proveedores/:id/editar" element={<PaginaEditarProveedorOperaciones />} />
        <Route path="/operaciones/ordenes-compra" element={<PaginaOrdenesCompraOperaciones />} />
        <Route path="/operaciones/ordenes-compra/nueva" element={<PaginaNuevaOrdenCompraOperaciones />} />
        <Route path="/operaciones/ordenes-compra/:id/recibir" element={<PaginaRecepcionOrdenOperaciones />} />
        <Route path="/operaciones/recepciones" element={<PaginaRecepcionesOperaciones />} />
        <Route path="/operaciones/recepciones/:id" element={<DetalleRecepcionOperaciones />} />
        <Route path="/operaciones/alertas" element={<PaginaAlertasOperaciones />} />
        <Route path="/operaciones/ml/predicciones" element={<PaginaPrediccionesOperaciones />} />
        <Route path="/operaciones/ml/alertas-demanda" element={<PaginaAlertasDemandaOperaciones />} />
      </Route>

      {/* Panel ML (solo ADMIN) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/ml/predicciones" element={<PaginaPredicciones />} />
        <Route path="/ml/alertas" element={<PaginaAlertas />} />
        <Route path="/ml/recomendaciones" element={<PaginaRecomendaciones />} />
        <Route path="/ml/monitoreo" element={<PaginaMonitoreoML />} />
      </Route>

      {/* Portal SaaS (solo SUPER_ADMIN) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.SUPER_ADMIN]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/admin-saas/dashboard" element={<PaginaDashboardSaaS />} />
        <Route path="/admin-saas/organizaciones" element={<PaginaDashboardSaaS />} />
        <Route path="/admin-saas/organizaciones/crear" element={<CrearOrganizacion />} />
      </Route>

      {/* No autorizado */}
      <Route path="/no-autorizado" element={<PaginaNoAutorizado />} />

      {/* Ruta no encontrada */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
