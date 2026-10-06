/**
 * Datos de prueba: Métricas KPIs del modelo ML y negocio.
 * Alineado con Arquitectura Lógica v4 — OE3.I3 (Fill Rate, Tasa Sobrestock) y OE3.I1 (MAPE).
 */
export const metricasKPI = {
  modelo: {
    mape: {
      actual: 18.5,
      meta: 20,
      unidad: '%',
      descripcion: 'Error medio absoluto porcentual en holdout',
      tendencias: [
        { fecha: '2026-01', valor: 24.2 },
        { fecha: '2026-02', valor: 21.8 },
        { fecha: '2026-03', valor: 19.3 },
        { fecha: '2026-04', valor: 18.5 },
      ],
    },
    rmse: {
      actual: 12.3,
      unidad: 'uds',
      descripcion: 'Raíz del error cuadrático medio',
    },
   mae: {
      actual: 8.7,
      unidad: 'uds',
      descripcion: 'Error medio absoluto en unidades',
    },
  },
  negocio: {
    fillRate: {
      actual: 82,
      meta: 85,
      unidad: '%',
      descripcion: 'Tasa de servicio: unidades dispensadas a tiempo / solicitadas',
      tendencias: [
        { fecha: '2026-01', valor: 61 },
        { fecha: '2026-02', valor: 68 },
        { fecha: '2026-03', valor: 75 },
        { fecha: '2026-04', valor: 82 },
      ],
    },
    tasaSobrestock: {
      actual: 35,
      meta: 28,
      unidad: '%',
      descripcion: 'SKU con cobertura > 60 días / total SKU activos',
      tendencias: [
        { fecha: '2026-01', valor: 47 },
        { fecha: '2026-02', valor: 43 },
        { fecha: '2026-03', valor: 39 },
        { fecha: '2026-04', valor: 35 },
      ],
    },
  },
}

export const HISTORIAL_KPI = [
  { mes: 'Ene 2026', mape: 24.2, fillRate: 61, tasaSobrestock: 47 },
  { mes: 'Feb 2026', mape: 21.8, fillRate: 68, tasaSobrestock: 43 },
  { mes: 'Mar 2026', mape: 19.3, fillRate: 75, tasaSobrestock: 39 },
  { mes: 'Abr 2026', mape: 18.5, fillRate: 82, tasaSobrestock: 35 },
]