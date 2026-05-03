/**
 * Datos de prueba: Predicciones de demanda para 5 productos.
 * Cada predicción incluye serie histórica de 12 meses y pronóstico futuro.
 */
export const predicciones = [
  {
    id: 'pred-001',
    productoId: 'prod-001',
    boticaId: 'ub-002',
    nombreProducto: 'Paracetamol 500mg',
    nombreBotica: 'Botica Miraflores',
    serieHistorica: [
      { mes: '2025-06', real: 120 }, { mes: '2025-07', real: 135 }, { mes: '2025-08', real: 110 },
      { mes: '2025-09', real: 145 }, { mes: '2025-10', real: 160 }, { mes: '2025-11', real: 155 },
      { mes: '2025-12', real: 180 }, { mes: '2026-01', real: 170 }, { mes: '2026-02', real: 140 },
      { mes: '2026-03', real: 150 }, { mes: '2026-04', real: 165 },
    ],
    pronostico: [
      { mes: '2026-05', predicho: 172, intervaloInf: 155, intervaloSup: 189 },
      { mes: '2026-06', predicho: 185, intervaloInf: 160, intervaloSup: 210 },
      { mes: '2026-07', predicho: 178, intervaloInf: 148, intervaloSup: 208 },
    ],
    metricas: { mape: 8.2, rmse: 12.5 },
  },
  {
    id: 'pred-002',
    productoId: 'prod-002',
    boticaId: 'ub-002',
    nombreProducto: 'Amoxicilina 500mg',
    nombreBotica: 'Botica Miraflores',
    serieHistorica: [
      { mes: '2025-06', real: 45 }, { mes: '2025-07', real: 55 }, { mes: '2025-08', real: 40 },
      { mes: '2025-09', real: 50 }, { mes: '2025-10', real: 65 }, { mes: '2025-11', real: 70 },
      { mes: '2025-12', real: 85 }, { mes: '2026-01', real: 75 }, { mes: '2026-02', real: 60 },
      { mes: '2026-03', real: 68 }, { mes: '2026-04', real: 72 },
    ],
    pronostico: [
      { mes: '2026-05', predicho: 80, intervaloInf: 68, intervaloSup: 92 },
      { mes: '2026-06', predicho: 112, intervaloInf: 90, intervaloSup: 134 },
      { mes: '2026-07', predicho: 95, intervaloInf: 72, intervaloSup: 118 },
    ],
    metricas: { mape: 11.5, rmse: 8.3 },
  },
  {
    id: 'pred-003',
    productoId: 'prod-003',
    boticaId: 'ub-002',
    nombreProducto: 'Ibuprofeno 400mg',
    nombreBotica: 'Botica Miraflores',
    serieHistorica: [
      { mes: '2025-06', real: 80 }, { mes: '2025-07', real: 90 }, { mes: '2025-08', real: 75 },
      { mes: '2025-09', real: 85 }, { mes: '2025-10', real: 95 }, { mes: '2025-11', real: 100 },
      { mes: '2025-12', real: 110 }, { mes: '2026-01', real: 105 }, { mes: '2026-02', real: 90 },
      { mes: '2026-03', real: 95 }, { mes: '2026-04', real: 100 },
    ],
    pronostico: [
      { mes: '2026-05', predicho: 108, intervaloInf: 95, intervaloSup: 121 },
      { mes: '2026-06', predicho: 115, intervaloInf: 98, intervaloSup: 132 },
      { mes: '2026-07', predicho: 110, intervaloInf: 90, intervaloSup: 130 },
    ],
    metricas: { mape: 6.8, rmse: 7.1 },
  },
  {
    id: 'pred-004',
    productoId: 'prod-004',
    boticaId: 'ub-001',
    nombreProducto: 'Omeprazol 20mg',
    nombreBotica: 'Droguería Central',
    serieHistorica: [
      { mes: '2025-06', real: 200 }, { mes: '2025-07', real: 220 }, { mes: '2025-08', real: 190 },
      { mes: '2025-09', real: 210 }, { mes: '2025-10', real: 240 }, { mes: '2025-11', real: 250 },
      { mes: '2025-12', real: 280 }, { mes: '2026-01', real: 260 }, { mes: '2026-02', real: 230 },
      { mes: '2026-03', real: 245 }, { mes: '2026-04', real: 255 },
    ],
    pronostico: [
      { mes: '2026-05', predicho: 270, intervaloInf: 245, intervaloSup: 295 },
      { mes: '2026-06', predicho: 290, intervaloInf: 255, intervaloSup: 325 },
      { mes: '2026-07', predicho: 275, intervaloInf: 235, intervaloSup: 315 },
    ],
    metricas: { mape: 7.5, rmse: 18.2 },
  },
  {
    id: 'pred-005',
    productoId: 'prod-005',
    boticaId: 'ub-003',
    nombreProducto: 'Losartán 50mg',
    nombreBotica: 'Botica San Borja',
    serieHistorica: [
      { mes: '2025-06', real: 30 }, { mes: '2025-07', real: 35 }, { mes: '2025-08', real: 28 },
      { mes: '2025-09', real: 32 }, { mes: '2025-10', real: 38 }, { mes: '2025-11', real: 42 },
      { mes: '2025-12', real: 45 }, { mes: '2026-01', real: 40 }, { mes: '2026-02', real: 35 },
      { mes: '2026-03', real: 38 }, { mes: '2026-04', real: 41 },
    ],
    pronostico: [
      { mes: '2026-05', predicho: 44, intervaloInf: 38, intervaloSup: 50 },
      { mes: '2026-06', predicho: 48, intervaloInf: 40, intervaloSup: 56 },
      { mes: '2026-07', predicho: 45, intervaloInf: 36, intervaloSup: 54 },
    ],
    metricas: { mape: 9.1, rmse: 3.8 },
  },
]
