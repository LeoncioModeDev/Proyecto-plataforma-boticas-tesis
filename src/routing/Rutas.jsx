import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

import useAutenticacion from '@/state/useAutenticacion'
import useBarraLateral from '@/state/useBarraLateral'
import RutaProtegida from './RutaProtegida'
import { ROLES } from '@/constants/roles'

import BarraLateral from '@/components/navigation/BarraLateral'
import BarraSuperior from '@/components/navigation/BarraSuperior'

// Autenticación
const InicioSesion = lazy(() => import('@/pages/auth/InicioSesion'))
const RestablecerContrasena = lazy(() => import('@/pages/auth/RestablecerContrasena'))
const PaginaNoAutorizado = lazy(() => import('@/pages/auth/PaginaNoAutorizado'))

// Portal Central
const PaginaDashboardCentral = lazy(() => import('@/pages/central-portal/PaginaDashboardCentral'))
const PaginaCatalogo = lazy(() => import('@/pages/central-portal/inventory-module/catalog/PaginaCatalogo'))
const FormularioProducto = lazy(() => import('@/pages/central-portal/inventory-module/catalog/FormularioProducto'))
const DetalleProducto = lazy(() => import('@/pages/central-portal/inventory-module/catalog/DetalleProducto'))
const PaginaStock = lazy(() => import('@/pages/central-portal/inventory-module/stock/PaginaStock'))
const DetalleStockActual = lazy(() => import('@/pages/shared/inventory/DetalleStockActual'))
const PaginaLotes = lazy(() => import('@/pages/central-portal/inventory-module/lots/PaginaLotes'))
const PaginaMovimientos = lazy(() => import('@/pages/central-portal/inventory-module/movements/PaginaMovimientos'))
const PaginaAjustes = lazy(() => import('@/pages/central-portal/inventory-module/adjustments/PaginaAjustes'))
const FormularioAjuste = lazy(() => import('@/pages/central-portal/inventory-module/adjustments/FormularioAjuste'))
const PaginaReportes = lazy(() => import('@/pages/central-portal/inventory-module/reports/PaginaReportes'))
const ReporteKardex = lazy(() => import('@/pages/central-portal/inventory-module/reports/ReporteKardex'))
const ReporteStockCritico = lazy(() => import('@/pages/central-portal/inventory-module/reports/ReporteStockCritico'))
const ReporteMovimientos = lazy(() => import('@/pages/central-portal/inventory-module/reports/ReporteMovimientos'))
const ReporteRotacion = lazy(() => import('@/pages/central-portal/inventory-module/reports/ReporteRotacion'))
const PaginaTransferencias = lazy(() => import('@/pages/central-portal/distribution-module/PaginaTransferencias'))
const PaginaRedistribucionCentral = lazy(() => import('@/pages/central-portal/distribution-module/PaginaRedistribucion'))
const FormularioTransferencia = lazy(() => import('@/pages/central-portal/distribution-module/FormularioTransferencia'))
const PaginaHistorialDistribucion = lazy(() => import('@/pages/central-portal/distribution-module/historial/PaginaHistorialDistribucion'))
const PaginaProveedores = lazy(() => import('@/pages/central-portal/suppliers-module/PaginaProveedores'))
const PaginaVerProveedor = lazy(() => import('@/pages/central-portal/suppliers-module/ver/PaginaVerProveedor'))
const PaginaNuevoProveedor = lazy(() => import('@/pages/central-portal/suppliers-module/new/PaginaNuevoProveedor'))
const PaginaEditarProveedor = lazy(() => import('@/pages/central-portal/suppliers-module/edit/PaginaEditarProveedor'))
const PaginaOrdenesCompraCentral = lazy(() => import('@/pages/central-portal/suppliers-module/PaginaOrdenesCompra'))
const PaginaNuevaOrdenCompraCentral = lazy(() => import('@/pages/central-portal/suppliers-module/new/PaginaNuevaOrdenCompra'))
const PaginaRecepcionOrden = lazy(() => import('@/pages/central-portal/suppliers-module/PaginaRecepcionOrden'))
const PaginaHistorialOrdenesCentral = lazy(() => import('@/pages/central-portal/suppliers-module/PaginaHistorialOrdenes'))
const PaginaRecepcionesCentral = lazy(() => import('@/pages/central-portal/suppliers-module/PaginaRecepciones'))
const DetalleRecepcionCentral = lazy(() => import('@/pages/central-portal/suppliers-module/DetalleRecepcion'))
const PaginaUsuarios = lazy(() => import('@/pages/central-portal/administration-module/PaginaUsuarios'))
const PaginaBoticas = lazy(() => import('@/pages/central-portal/administration-module/PaginaBoticas'))
const PaginaConfiguracionGeneral = lazy(() => import('@/pages/central-portal/administration-module/PaginaConfiguracionGeneral'))
const PaginaConfiguracionAvanzada = lazy(() => import('@/pages/central-portal/administration-module/PaginaConfiguracionAvanzada'))
const PaginaImportacionDatos = lazy(() => import('@/pages/central-portal/administration-module/PaginaImportacionDatos'))
const PaginaCategoriasTerapeuticas = lazy(() => import('@/pages/central-portal/administration-module/PaginaCategoriasTerapeuticas'))
const DetalleCategoriaTerapeutica = lazy(() => import('@/pages/central-portal/administration-module/DetalleCategoriaTerapeutica'))
const FormularioCategoriaTerapeutica = lazy(() => import('@/pages/central-portal/administration-module/FormularioCategoriaTerapeutica'))
const PaginaAuditoria = lazy(() => import('@/pages/central-portal/administration-module/PaginaAuditoria'))
const PaginaNuevaBotica = lazy(() => import('@/pages/central-portal/administration-module/new/PaginaNuevaBotica'))
const PaginaEditarBotica = lazy(() => import('@/pages/central-portal/administration-module/edit/PaginaEditarBotica'))
const CrearOrganizacion = lazy(() => import('@/pages/admin/CrearOrganizacion'))
const PaginaDashboardSaaS = lazy(() => import('@/pages/admin-saas/PaginaDashboardSaaS'))
const PaginaOrganizaciones = lazy(() => import('@/pages/admin-saas/PaginaOrganizaciones'))
const PaginaDetalleOrganizacion = lazy(() => import('@/pages/admin-saas/PaginaDetalleOrganizacion'))
const PaginaEditarOrganizacion = lazy(() => import('@/pages/admin-saas/PaginaEditarOrganizacion'))

// Portal Boticas
const PaginaStockBotica = lazy(() => import('@/pages/pharmacy-portal/PaginaStockBotica'))
const PaginaLotesBotica = lazy(() => import('@/pages/pharmacy-portal/PaginaLotesBotica'))
const PaginaMovimientosBotica = lazy(() => import('@/pages/pharmacy-portal/PaginaMovimientosBotica'))
const PaginaDashboardBotica = lazy(() => import('@/pages/pharmacy-portal/PaginaDashboardBotica'))
const PaginaTransferenciasBotica = lazy(() => import('@/pages/pharmacy-portal/PaginaTransferenciasBotica'))

// Portal Operaciones
const PaginaDashboardOperaciones = lazy(() => import('@/pages/operations-portal/PaginaDashboardOperaciones'))
const PaginaCatalogoOperaciones = lazy(() => import('@/pages/operations-portal/inventory-module/PaginaCatalogo'))
const PaginaStockOperaciones = lazy(() => import('@/pages/operations-portal/inventory-module/PaginaStock'))
const PaginaLotesOperaciones = lazy(() => import('@/pages/operations-portal/inventory-module/PaginaLotes'))
const PaginaMovimientosOperaciones = lazy(() => import('@/pages/operations-portal/inventory-module/PaginaMovimientos'))
const PaginaAjustesOperaciones = lazy(() => import('@/pages/operations-portal/inventory-module/PaginaAjustes'))
const PaginaReportesOperaciones = lazy(() => import('@/pages/operations-portal/inventory-module/PaginaReportes'))
const PaginaTransferenciasOperaciones = lazy(() => import('@/pages/operations-portal/distribution-module/PaginaTransferencias'))
const FormularioTransferenciaOperaciones = lazy(() => import('@/pages/operations-portal/distribution-module/FormularioTransferencia'))
const PaginaRedistribucionOperaciones = lazy(() => import('@/pages/operations-portal/distribution-module/PaginaRedistribucion'))
const PaginaProveedoresOperaciones = lazy(() => import('@/pages/operations-portal/suppliers-module/PaginaProveedores'))
const PaginaVerProveedorOperaciones = lazy(() => import('@/pages/central-portal/suppliers-module/ver/PaginaVerProveedor'))
const PaginaOrdenesCompraOperaciones = lazy(() => import('@/pages/operations-portal/suppliers-module/PaginaOrdenesCompra'))
const PaginaNuevaOrdenCompraOperaciones = lazy(() => import('@/pages/operations-portal/suppliers-module/PaginaNuevaOrdenCompra'))
const PaginaAlertasOperaciones = lazy(() => import('@/pages/operations-portal/PaginaAlertas'))
// Reused from Central Portal for Operations
const FormularioProductoOperaciones = FormularioProducto
const DetalleProductoOperaciones = DetalleProducto
const FormularioAjusteOperaciones = FormularioAjuste
const ReporteKardexOperaciones = ReporteKardex
const ReporteStockCriticoOperaciones = ReporteStockCritico
const ReporteMovimientosOperaciones = ReporteMovimientos
const ReporteRotacionOperaciones = ReporteRotacion
const PaginaNuevoProveedorOperaciones = PaginaNuevoProveedor
const PaginaEditarProveedorOperaciones = PaginaEditarProveedor
const PaginaRecepcionOrdenOperaciones = PaginaRecepcionOrden
const PaginaRecepcionesOperaciones = PaginaRecepcionesCentral
const DetalleRecepcionOperaciones = DetalleRecepcionCentral

// Panel de Predicciones
const PaginaPredicciones = lazy(() => import('@/pages/ml-panel/PaginaPredicciones'))
const PaginaHistorialPredicciones = lazy(() => import('@/pages/ml-panel/PaginaHistorialPredicciones'))
const PaginaAlertas = lazy(() => import('@/pages/ml-panel/PaginaAlertas'))
const PaginaRecomendaciones = lazy(() => import('@/pages/ml-panel/PaginaRecomendaciones'))
const PaginaMonitoreoML = lazy(() => import('@/pages/ml-panel/PaginaMonitoreoML'))
const PaginaPrecios = lazy(() => import('@/pages/shared/validation-module/PaginaPrecios'))
const PaginaVentasHistoricas = lazy(() => import('@/pages/shared/validation-module/PaginaVentasHistoricas'))
const PaginaStockHistorico = lazy(() => import('@/pages/shared/validation-module/PaginaStockHistorico'))
const PaginaVentas = lazy(() => import('@/pages/shared/sales-module/PaginaVentas'))
const PaginaRegistrarVenta = lazy(() => import('@/pages/shared/sales-module/PaginaRegistrarVenta'))
const PaginaDemandaNoAtendida = lazy(() => import('@/pages/shared/sales-module/PaginaDemandaNoAtendida'))
const PaginaReportesVentas = lazy(() => import('@/pages/shared/sales-module/PaginaReportesVentas'))

function CargandoRuta() {
  return <div className="flex justify-center py-12"><p className="text-secundario">Cargando pantalla...</p></div>
}

function LayoutPrincipal() {
  const { colapsada } = useBarraLateral()
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

  return (
    <div className="min-h-screen bg-fondo transition-colors overflow-x-hidden">
      <div className="hidden lg:block">
        <BarraLateral />
      </div>
      {menuMovilAbierto && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/45" onClick={() => setMenuMovilAbierto(false)} />
          <BarraLateral movil alCerrarMovil={() => setMenuMovilAbierto(false)} />
        </div>
      )}
      <BarraSuperior onAbrirMenuMovil={() => setMenuMovilAbierto(true)} />
      <main className={`mt-14 p-4 sm:p-6 lg:p-8 transition-all duration-200 min-w-0 ${colapsada ? 'lg:ml-16' : 'lg:ml-60'}`}>
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
    <Suspense fallback={<CargandoRuta />}>
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
        <Route path="/central/inventario/stock/:id" element={<DetalleStockActual />} />
        <Route path="/central/inventario/precios" element={<Navigate to="/central/administracion/precios" replace />} />
        <Route path="/central/inventario/stock-historico" element={<Navigate to="/central/administracion/stock-historico" replace />} />
        <Route path="/central/inventario/categorias-terapeuticas" element={<Navigate to="/central/administracion/categorias-terapeuticas" replace />} />
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
        <Route path="/central/administracion/configuracion-avanzada" element={<PaginaConfiguracionAvanzada />} />
        <Route path="/central/administracion/categorias-terapeuticas" element={<PaginaCategoriasTerapeuticas />} />
        <Route path="/central/administracion/categorias-terapeuticas/nueva" element={<FormularioCategoriaTerapeutica />} />
        <Route path="/central/administracion/categorias-terapeuticas/:id" element={<DetalleCategoriaTerapeutica />} />
        <Route path="/central/administracion/categorias-terapeuticas/:id/editar" element={<FormularioCategoriaTerapeutica />} />
        <Route path="/central/administracion/importacion-datos" element={<PaginaImportacionDatos />} />
        <Route path="/central/administracion/precios" element={<PaginaPrecios />} />
        <Route path="/central/administracion/stock-historico" element={<PaginaStockHistorico />} />
        <Route path="/central/administracion/ventas-historicas" element={<PaginaVentasHistoricas />} />
        <Route path="/central/ventas" element={<PaginaVentas />} />
        <Route path="/central/ventas/demanda-no-atendida" element={<PaginaDemandaNoAtendida />} />
        <Route path="/central/ventas/reportes" element={<PaginaReportesVentas />} />
        <Route path="/central/administracion/auditoria" element={<PaginaAuditoria />} />
      </Route>

      {/* Portal Botica (VISOR + ADMIN) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.VISOR_BOTICA, ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/botica/stock" element={<PaginaStockBotica />} />
        <Route path="/botica/stock/:id" element={<DetalleStockActual />} />
        <Route path="/botica/precios" element={<PaginaPrecios />} />
        <Route path="/botica/stock-historico" element={<PaginaStockHistorico />} />
        <Route path="/botica/ventas-historicas" element={<PaginaVentasHistoricas />} />
        <Route path="/botica/ventas" element={<PaginaVentas />} />
        <Route path="/botica/ventas/registrar" element={<PaginaRegistrarVenta />} />
        <Route path="/botica/lotes" element={<PaginaLotesBotica />} />
        <Route path="/botica/movimientos" element={<PaginaMovimientosBotica />} />
        <Route path="/botica/dashboard" element={<PaginaDashboardBotica />} />
        <Route path="/botica/transferencias" element={<PaginaTransferenciasBotica />} />
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
        <Route path="/operaciones/inventario/stock/:id" element={<DetalleStockActual />} />
        <Route path="/operaciones/inventario/precios" element={<Navigate to="/operaciones/administracion/precios" replace />} />
        <Route path="/operaciones/inventario/stock-historico" element={<Navigate to="/operaciones/administracion/stock-historico" replace />} />
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
        <Route path="/operaciones/administracion/ventas-historicas" element={<PaginaVentasHistoricas />} />
        <Route path="/operaciones/ventas" element={<PaginaVentas />} />
        <Route path="/operaciones/ventas/demanda-no-atendida" element={<PaginaDemandaNoAtendida />} />
        <Route path="/operaciones/administracion/precios" element={<PaginaPrecios />} />
        <Route path="/operaciones/administracion/stock-historico" element={<PaginaStockHistorico />} />
        <Route path="/operaciones/alertas" element={<PaginaAlertasOperaciones />} />
      </Route>

      {/* Panel de Predicciones (solo ADMIN) */}
      <Route element={
        <RutaProtegida rolesPermitidos={[ROLES.ADMIN_CENTRAL]}>
          <LayoutPrincipal />
        </RutaProtegida>
      }>
        <Route path="/ml/predicciones" element={<PaginaPredicciones />} />
        <Route path="/ml/historial-predicciones" element={<PaginaHistorialPredicciones />} />
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
        <Route path="/admin-saas/organizaciones" element={<PaginaOrganizaciones />} />
        <Route path="/admin-saas/organizaciones/crear" element={<CrearOrganizacion />} />
        <Route path="/admin-saas/organizaciones/:id" element={<PaginaDetalleOrganizacion />} />
        <Route path="/admin-saas/organizaciones/:id/editar" element={<PaginaEditarOrganizacion />} />
      </Route>

      {/* No autorizado */}
      <Route path="/no-autorizado" element={<PaginaNoAutorizado />} />

      {/* Ruta no encontrada */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
