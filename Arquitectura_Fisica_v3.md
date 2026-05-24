# Arquitectura Física v3 — botica-demand-ml

**Proyecto:** Plataforma Web Basada en Arquitectura Serverless y Machine Learning para Controlar el Sobrestock y Desabastecimiento de Medicamentos en Boticas del Perú
**Universidad:** Universidad Peruana de Ciencias Aplicadas (UPC), 2026
**Empresa:** D&R Farma
**Diferenciador:** Closed-Loop MLOps in-Database con Reentrenamiento Drift-Aware sobre Arquitectura Serverless-BaaS

---

## Objetivos y métricas que esta arquitectura debe soportar (ACP v1.3)

| Objetivo                           | Indicador                     | Meta                      | Componente físico que lo soporta                                 |
| ---------------------------------- | ----------------------------- | ------------------------- | ---------------------------------------------------------------- |
| OE2 — Arquitectura física aprobada | Diagramas elaborados          | 100% aprobados por asesor | Este documento                                                   |
| OE2 — Integración coherente        | Auth, RLS, Realtime validados | 100% validados            | Supabase Auth + RLS + Realtime WebSocket                         |
| OE3 — Precisión del modelo         | MAPE en piloto                | **≤ 20%**                 | Cloud Run: FastAPI + SARIMA + XGBoost → `modelos_ml.mape`        |
| OE3 — Fill Rate                    | Tasa de servicio              | **≥ 85%**                 | `movimientos_inventario` (salidas) + dashboard React             |
| OE3 — Tasa de Sobrestock           | SKU cobertura > 60 días       | **Reducción ≥ 25%**       | `stock_ubicaciones` + `movimientos_inventario` (últimos 90 días) |
| OE4 — Continuidad                  | Plan documentado              | 100% componentes          | Supabase free tier + Cloud Run scale-to-zero                     |

---

## Resumen de la arquitectura

La plataforma se organiza en cuatro capas:

1. **Presentación** — SPA React servida vía Vercel (CDN global)
2. **BaaS Supabase** — PostgreSQL + Auth + RLS + Edge Functions + Realtime + Storage
3. **Cómputo ML** — FastAPI + Docker en Google Cloud Run (serverless, scale-to-zero)
4. **Mock Fase 1** — Datos de prueba en `src/mock-data/` + servicios simulados con `setTimeout`

El diferenciador es la orquestación in-database: `pg_cron` + `pg_net` + Supabase Vault cierran el bucle MLOps sin componentes externos de scheduling, con costo operativo < $5 USD/mes.

---

## Capa 1 — Presentación (React SPA)

### Stack frontend

| Componente    | Tecnología            | Versión        | Propósito                                                      |
| ------------- | --------------------- | -------------- | -------------------------------------------------------------- |
| Framework UI  | React                 | 19 (instalado) | SPA                                                            |
| Bundler       | Vite                  | 5+             | Build + HMR                                                    |
| Routing       | React Router DOM      | v6             | Navegación por rol                                             |
| Estilos       | Tailwind CSS          | v3             | Design system Fluent                                           |
| Estado global | Zustand               | v4             | Estado de autenticación, inventario, alertas, predicciones     |
| Tablas        | TanStack Table        | v8             | Tablas con filtros y paginación                                |
| Gráficas      | Recharts              | v2             | Gráfica de área (predicciones + histórico + IC), barras, línea |
| Formularios   | React Hook Form       | v7             | Formularios con validación                                     |
| Validación    | Zod                   | v3             | Schemas de validación                                          |
| Fechas        | date-fns              | v3             | Formateo con locale ES                                         |
| Iconos        | Lucide React          | —              | Iconografía                                                    |
| CSS utils     | clsx + tailwind-merge | —              | Composición de clases                                          |

> **Tabla.jsx** (TanStack Table v8) con soporte para filas expandibles vía `renderFilaExpandida` (implementado con flatMap + colSpan), ordenamiento por columnas, filtro global, paginación configurable y scroll horizontal con `min-w-max`.

### Portales y roles

| Portal         | Rol                             | Rutas principales                                                                              |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Portal Central | Admin Central                   | `/central/dashboard`, `/central/inventario/*`, `/central/distribucion/transferencias`, `/central/distribucion/redistribucion`, `/central/distribucion/historial`, `/central/proveedores/*`, `/central/administracion/*`, `/ml/*` |
| Portal Operaciones | Operador Droguería / Admin Central | `/operaciones/dashboard`, `/operaciones/inventario/*`, `/operaciones/distribucion/transferencias`, `/operaciones/distribucion/redistribucion`, `/operaciones/proveedores`, `/operaciones/ordenes-compra/*`, `/operaciones/alertas`, `/operaciones/ml/*` |
| Portal Botica   | Visor de Botica / Admin Central / Operador Droguería | `/botica/dashboard`, `/botica/stock`, `/botica/lotes`, `/botica/movimientos`, `/botica/transferencias`, `/botica/alertas`, `/botica/ml`, `/botica/recomendaciones` |
| Panel ML        | Admin Central                   | `/ml/predicciones`, `/ml/alertas`, `/ml/recomendaciones`, `/ml/monitoreo` |

### Control de acceso (frontend)

- Tres roles: `ADMIN_CENTRAL`, `OPERADOR_DROGUERIA`, `VISOR_BOTICA`
- `RutaProtegida` (HOC) bloquea el acceso según rol activo
- Redirección automática desde `/` según el rol del usuario autenticado
- En Fase 1: selector de rol en login para modo desarrollo

### Protocolo de comunicación

```
Usuario (navegador HTTPS)
  → Vercel CDN (Fase 5)
    → SPA React
      → supabase-js SDK: PostgREST (HTTPS + JWT)  ← tablas transaccionales
      → supabase-js SDK: Auth (JWT + Refresh)      ← autenticación
      → supabase-js SDK: Realtime (WebSocket)      ← alertas_ml, predicciones_ml, drift_metricas
```

### Suscripciones Realtime del frontend

| Canal             | Tabla             | Filtro                    | Suscriptor                |
| ----------------- | ----------------- | ------------------------- | ------------------------- |
| `alertas_ml`      | `alertas_ml`      | `botica_id=eq.{boticaId}` | Portal Central + Panel ML |
| `predicciones_ml` | `predicciones_ml` | `botica_id=eq.{boticaId}` | Panel ML                  |
| `drift_metricas`  | `drift_metricas`  | —                         | Panel ML (Admin)          |

> RLS filtra automáticamente los eventos Realtime según el `botica_id` del JWT del usuario.

### Hosting — Vercel (Fase 5)

- CDN global con HTTPS automático
- Deploy automático desde rama `main`
- Preview URLs por pull request
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ML_API_URL`

---

## Capa 2 — BaaS Supabase (Plano de Datos y Control)

Supabase provee todos los servicios de backend sin servidor dedicado. Esta es la capa que habilita el diferenciador MLOps in-database.

### PostgreSQL — Base de datos transaccional + ML Registry

#### Tablas transaccionales

| Tabla                    | Propósito                                | Notas                                                              |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------ |
| `organizaciones`         | Empresa propietaria de la red            | Identificación polimórfica (RUC / NIT / Tax ID / VAT)              |
| `boticas`                | Locales físicos                          | `ubigeo char(6)` FK → `ubigeos`, `distrito` para ML                |
| `productos`              | Catálogo maestro de medicamentos         | `codigo_interno` (SKU), `categoria_terapeutica`, `requiere_receta` |
| `precios`                | Historial de precios (venta + costo)     | Feature ML de elasticidad precio-demanda                           |
| `proveedores`            | Proveedores nacionales e internacionales | `lead_time_dias` — feature "oro" para punto de pedido              |
| `stock_ubicaciones`      | Fuente de verdad del stock actual        | Actualizada por trigger en cada movimiento                         |
| `lotes`                  | Lotes activos con fecha de vencimiento   | FEFO: `fecha_vencimiento` es feature ML                            |
| `movimientos_inventario` | Log inmutable de auditoría               | `tipo_movimiento` enum: entrada/salida/ajuste/merma/devolucion     |
| `transferencias`         | Despachos droguería → boticas            | Estados: creada/en_transito/recibida                               |
| `transferencias_items`   | Detalle de lotes por transferencia       | Selección con criterio FEFO (lotes ordenados por fecha de vencimiento, alerta ≤30 días) |
| `ubigeos`                | Padrón INEI (referencia estática)        | Seed único; no cambia                                              |

> **Nota:** Los módulos independientes de Despachos y Recepciones fueron eliminados — la funcionalidad se unificó en Transferencias. Una transferencia en estado `en_transito` equivale a un despacho, y al confirmar recepción pasa a `recibida`.

#### Tablas MLOps (diferenciador arquitectónico)

| Tabla             | Propósito                           | Campos clave                                                                              |
| ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `modelos_ml`      | Model registry completo             | `status` (staging/production/archived), `hash`, `mape`, `psi_baseline_jsonb`, `algoritmo` |
| `predicciones_ml` | Salida del servicio ML              | `modelo_version_id` FK, `intervalo_inf`, `intervalo_sup`, `confianza`                     |
| `inferencias`     | Audit log por predicción individual | `features_jsonb`, `valor_real` (backfill diario), `error_absoluto`                        |
| `drift_metricas`  | Historial semanal de drift          | `psi_max`, `ratio_mape`, `requiere_retraining`, `reentrenamiento_disparado`               |
| `alertas_ml`      | Alertas automáticas                 | `tipo_origen` (regla/modelo), `tipo` (quiebre/sobrestock/vencimiento_proximo/prediccion)  |

**Constraint crítico:** `CREATE UNIQUE INDEX idx_modelos_ml_production ON modelos_ml (status) WHERE status = 'production'` — garantiza que solo un modelo esté en producción simultáneamente.

#### Extensiones PostgreSQL habilitadas

| Extensión      | Propósito                                     |
| -------------- | --------------------------------------------- |
| `pg_cron`      | Scheduler nativo — 4 jobs automatizados       |
| `pg_net`       | HTTP async desde SQL — invoca Cloud Run       |
| `pg_trgm`      | Búsqueda de texto (catálogo de productos)     |
| Supabase Vault | Almacén cifrado de secretos (token Cloud Run) |

#### Seguridad — RLS

Row-Level Security habilitada en todas las tablas con `botica_id`. El JWT del usuario autenticado contiene el `botica_id` asignado. Las políticas garantizan que un Operador de Droguería solo vea los datos de su botica.

```sql
-- Ejemplo de política RLS en stock_ubicaciones
CREATE POLICY "Operador ve solo su botica"
ON stock_ubicaciones
FOR SELECT
USING (ubicacion_id = (SELECT botica_id FROM auth.users WHERE id = auth.uid()));
```

#### Feature layer SQL (vistas materializadas)

Vistas pre-calculadas que el ETL de Cloud Run consume directamente vía PostgREST:

```sql
-- Vista: features_entrenamiento (datos listos para el ETL)
SELECT
  m.created_at AS fecha_venta,
  m.producto_id,
  m.ubicacion_id AS botica_id,
  m.cantidad,
  p.codigo_interno,
  p.categoria_terapeutica,
  p.laboratorio,
  p.forma_farmaceutica,
  p.concentracion,
  p.requiere_receta,
  s.cantidad_disponible AS stock_actual,
  s.stock_minimo,
  l.fecha_vencimiento,
  pr.precio_venta,
  pr.precio_costo,
  b.distrito,
  pv.lead_time_dias
FROM movimientos_inventario m
JOIN productos p ON p.id = m.producto_id
JOIN stock_ubicaciones s ON s.producto_id = m.producto_id AND s.ubicacion_id = m.ubicacion_id
JOIN lotes l ON l.id = m.lote_id
LEFT JOIN precios pr ON pr.producto_id = m.producto_id AND pr.botica_id = m.ubicacion_id AND pr.vigente_hasta IS NULL
JOIN boticas b ON b.id = m.ubicacion_id
LEFT JOIN proveedores pv ON pv.id = l.proveedor_id
WHERE m.tipo_movimiento = 'salida'
  AND p.estado = 'activo';
```

### Servicios Supabase

| Servicio      | Propósito en la plataforma                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **PostgREST** | API REST auto-generada desde el esquema SQL; usada por el frontend (supabase-js) y por el ETL de Cloud Run (service key) |
| **Auth**      | JWT + Refresh tokens; RLS usa el JWT para filtrar datos por rol y botica                                                 |
| **Realtime**  | WebSocket a tablas `alertas_ml`, `predicciones_ml`, `drift_metricas`; `REPLICA IDENTITY FULL` habilitado                 |
| **Storage**   | Artefactos ML: `models/{version}/{hash}.pkl` y `models/{version}/{hash}_config.json`                                     |

### Jobs pg_cron — Orquestación in-database

| Job   | Función                  | Schedule         | Descripción                                                                                                                                                         |
| ----- | ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job 1 | `calc_drift_semanal()`   | Lunes 03:00 UTC  | Calcula PSI (Yurdakul, 2018) entre features actuales vs `psi_baseline_jsonb`. Calcula MAPE rolling 4 semanas desde `inferencias`. Escribe en `drift_metricas`.      |
| Job 2 | `decide_retrain()`       | Lunes 03:15 UTC  | Lee `drift_metricas`. Si `psi_max > 0.2` o `ratio_mape > 1.25` por 2 semanas consecutivas → `pg_net.http_post` a Cloud Run `/retrain`. Si no → 0 costo de cómputo.  |
| Job 3 | `cleanup()`              | Diario 02:00 UTC | Marca lotes expirados, limpia registros obsoletos.                                                                                                                  |
| Job 4 | `backfill_inferencias()` | Diario 02:30 UTC | Cruza `inferencias.fecha_pred` con `movimientos_inventario` (salidas del día anterior). Actualiza `valor_real` y `error_absoluto`. Base de datos para MAPE rolling. |

> El Job 4 es el mecanismo que cierra el bucle: sin él, `drift_metricas.mape_rolling` no tiene datos con qué calcularse.

**Umbrales diferenciados:**

| Umbral                     | Valor                                                          | Acción                                            |
| -------------------------- | -------------------------------------------------------------- | ------------------------------------------------- |
| Reentrenamiento via pg_net | `psi_max > 0.2` o `ratio_mape > 1.25` (2 semanas consecutivas) | Job 2 → `pg_net.http_post → /retrain`             |
| Alerta crítica via Edge Fn | `psi_max > 0.3` o `ratio_mape > 1.5`                           | Job 1 → `alert_dispatch.ts` → push a `alertas_ml` |

### Edge Functions (Deno, máx. 150s, stateless)

| Función             | Trigger                                                       | Lógica                                                                                                                          |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `promote_model.ts`  | Llamada por Cloud Run al finalizar `/retrain`                 | Compara `mape` del nuevo modelo (staging) vs el modelo en production. Si mejora ≥ 5% → nuevo = production, anterior = archived. |
| `alert_dispatch.ts` | Llamada por Job 1 cuando `psi_max > 0.3` o `ratio_mape > 1.5` | Inserta en `alertas_ml` con `tipo_origen = 'modelo'` y `urgencia = 'alta'`. Realtime propaga la alerta al dashboard.            |

---

## Capa 3 — Cómputo ML (Google Cloud Run)

### Contenedor Docker

```
Imagen base: python:3.10-slim
Dependencias: fastapi, uvicorn, statsmodels, xgboost, scikit-learn, pandas, numpy, supabase-py
Config Cloud Run:
  min-instances: 0   (free tier, scale-to-zero)
  max-instances: 3   (piloto)
  timeout: 900s
  cold start: ≤ 5s (cubierto por GET /health warm-up)
```

### FastAPI — Endpoints

| Endpoint              | Invocador                             | Descripción                                                                                                                      |
| --------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /retrain`       | `pg_net` (desde `decide_retrain()`)   | ETL + entrenamiento + validación holdout + escribe `modelos_ml` (staging) + escribe `predicciones_ml` + llama `promote_model.ts` |
| `POST /predict_batch` | `pg_net` (inferencia masiva nocturna) | Genera predicciones batch para todos los SKU activos de todas las boticas                                                        |
| `GET /health`         | Cloud Run warm-up                     | Devuelve 200 OK; carga el modelo en memoria para reducir cold start en la primera inferencia                                     |

### Modelo híbrido SARIMA + XGBoost

| Componente   | Librería     | Propósito                                                                                      |
| ------------ | ------------ | ---------------------------------------------------------------------------------------------- |
| SARIMA       | statsmodels  | Captura tendencia y estacionalidad temporal (semanal, mensual, anual). Línea base (benchmark). |
| XGBoost      | xgboost      | Captura efectos no lineales de variables cruzadas sobre los residuos del SARIMA.               |
| scikit-learn | scikit-learn | Preprocesamiento, split cronológico, métricas (MAPE, RMSE, MAE)                                |

**Métricas objetivo (alineadas con ACP OE3.I1):**

- MAPE ≤ 20% en holdout
- Horizonte de predicción: 3 meses
- Tiempo de inferencia: < 7s por SKU

### ETL Pipeline

```
1. Extrae datos desde Supabase vía PostgREST (service key — bypass RLS)
   → Vista `features_entrenamiento` pre-calculada en PostgreSQL
   → Filtra: tipo_movimiento = 'salida', estado_producto = 'activo'
   → Excluye: medicamentos con cambios regulatorios, con refrigeración (exclusiones ACP)

2. Feature engineering en Python:
   → dia_semana, semana_del_anio, mes (desde created_at)
   → es_inicio_mes, dias_para_vencimiento
   → Lags temporales (1, 7, 14, 28 días)

3. Split cronológico train / holdout (nunca aleatorio)

4. Entrenamiento SARIMA → residuos → XGBoost

5. Validación: calcula MAPE, RMSE, MAE en holdout
   → Si MAPE ≤ 20%: escribe en modelos_ml con status='staging'
   → Si MAPE > 20%: registra warning, mantiene modelo anterior en production

6. Escribe predicciones en predicciones_ml (próximos 3 meses)
7. Escribe inferencias individuales en inferencias (para audit log)
8. Llama promote_model.ts para evaluación champion-challenger
9. Guarda artefacto .pkl en Supabase Storage: models/{version}/{hash}.pkl
```

### Drift Detection

```python
# PSI (Population Stability Index) — Yurdakul, 2018
# Implementado en Python durante /retrain; resultado escrito en drift_metricas vía pg_cron Job 1

def calcular_psi(baseline_bins, baseline_freq, actual_data, bins):
    actual_freq = np.histogram(actual_data, bins=bins)[0] / len(actual_data)
    psi = np.sum((actual_freq - baseline_freq) * np.log(actual_freq / baseline_freq + 1e-10))
    return psi

# Criterios de decisión (Job 2):
# psi_max > 0.2 OR ratio_mape > 1.25 → requiere_retraining = True
# psi_max > 0.3 OR ratio_mape > 1.5  → alerta crítica (alert_dispatch.ts)
```

### Model Registry — flujo completo

```
[Cloud Run /retrain]
  → Entrena nuevo modelo
  → Calcula MAPE holdout
  → Escribe modelos_ml (status='staging', hash, psi_baseline_jsonb, mape)
  → Guarda .pkl en Storage: models/{version}/{hash}.pkl
  → POST promote_model.ts

[promote_model.ts]
  → Lee nuevo modelo (staging) y modelo actual (production)
  → Si mape_nuevo ≤ mape_production × 0.95 (mejora ≥ 5%):
      → nuevo: status='production', fecha_promocion=now()
      → anterior: status='archived'
  → Si no mejora:
      → nuevo: status='archived'
      → production: sin cambios (rollback automático)

[Rollback manual]
  → UPDATE modelos_ml SET status='production' WHERE version='v{N}'
  → UPDATE modelos_ml SET status='archived' WHERE status='production' AND version!='v{N}'
  → El .pkl en Storage se carga por hash — trazabilidad garantizada
```

---

## Capa 4 — Mock Fase 1 (activa)

En la Fase 1, todos los datos provienen de archivos mock en `src/mock-data/`. Los servicios de Supabase y ML existen como funciones simuladas con `setTimeout`, reemplazables sin cambios en la arquitectura del frontend.

| Archivo             | Contenido                                        |
| ------------------- | ------------------------------------------------ |
| `productos.js`      | 12 medicamentos (Paracetamol, Amoxicilina, etc.) |
| `stock.js`          | 16 registros en 5 ubicaciones (1 droguería + 4 boticas) |
| `lotes.js`          | 14 lotes con fechas variadas (FEFO)              |
| `movimientos.js`    | 21 movimientos de todos los tipos                |
| `transferencias.js` | 6 transferencias: 2 recibidas, 2 en tránsito, 1 creada, 1 cancelada |
| `alertas.js`        | 9 alertas activas (regla + predictivas)          |
| `predicciones.js`   | 5 predicciones con serie histórica de 11 meses   |
| `boticas.js`        | Droguería Central + 4 boticas (Miraflores, San Borja, Surco, Los Olivos) |
| `usuarios.js`       | 8 usuarios (3 admin central, 3 operador droguería, 2 visor botica) |

Los servicios mock viven en:

- `src/services/supabase/` — funciones que simulan PostgREST con `setTimeout`
- `src/services/ml-model/` — funciones que simulan la FastAPI con datos de `predicciones.js`

---

## Flujos de datos principales

### Flujo 1 — Usuario consulta stock (Fase 2+)

```
Usuario (Portal Central / Portal Boticas)
  → React → supabase-js
  → PostgREST (HTTPS + JWT)
  → RLS filtra por botica_id del JWT
  → PostgreSQL: stock_ubicaciones + lotes + movimientos_inventario
  → Respuesta JSON → Recharts / TanStack Table
```

### Flujo 2 — Alerta en tiempo real (Fase 2+)

```
pg_cron Job 1 (cálculo de drift) o trigger en stock_ubicaciones
  → INSERT en alertas_ml
  → Realtime (WebSocket) → supabase-js en frontend
  → useAlertas.getState().agregarAlerta(payload.new)
  → Badge de alertas no leídas actualizado en Header
```

### Flujo 3 — Reentrenamiento drift-aware (Fase 3+)

```
pg_cron Job 1 (lunes 03:00 UTC)
  → calc_drift_semanal()
  → Lee inferencias.error_absoluto (backfill del Job 4)
  → Calcula PSI vs psi_baseline_jsonb del modelo en production
  → Escribe drift_metricas (psi_max, ratio_mape, tendencia)
  → Si umbral crítico: llama alert_dispatch.ts → INSERT alertas_ml

pg_cron Job 2 (lunes 03:15 UTC)
  → decide_retrain()
  → Lee drift_metricas (últimas 2 semanas)
  → Si requiere_retraining = True:
      → pg_net.http_post(url=cloud_run_url, body={...}, headers={Authorization: vault.decrypt(cloud_run_token)})
      → UPDATE drift_metricas SET reentrenamiento_disparado = true
  → Si no: 0 costo de cómputo → KPI "reentrenamientos evitados" ++

[Cloud Run /retrain recibe la llamada]
  → ETL desde Supabase
  → Entrenamiento SARIMA + XGBoost
  → Escribe modelos_ml (staging) + predicciones_ml + inferencias
  → Llama promote_model.ts
  → Guarda .pkl en Storage

[promote_model.ts]
  → Si mejora ≥ 5%: nuevo = production, anterior = archived
  → Realtime propaga predicciones_ml actualizado al Panel ML
```

### Flujo 4 — Backfill de valor_real (Job 4)

```
pg_cron Job 4 (diario 02:30 UTC)
  → backfill_inferencias()
  → Cruza inferencias WHERE valor_real IS NULL AND fecha_pred = CURRENT_DATE - 1
  → Con SUM(cantidad) FROM movimientos_inventario WHERE tipo_movimiento='salida' AND DATE(created_at) = fecha_pred
  → UPDATE inferencias SET valor_real=..., error_absoluto=..., updated_at=now()
  → Estos datos alimentan drift_metricas.mape_rolling en el Job 1 del lunes siguiente
```

---

## Observabilidad y monitoreo

| Componente              | Qué monitorear                | Fuente                                          |
| ----------------------- | ----------------------------- | ----------------------------------------------- |
| Calidad del modelo      | MAPE rolling vs baseline      | `drift_metricas.ratio_mape` + dashboard React   |
| Drift de features       | PSI por feature               | `drift_metricas.psi_features`                   |
| Ejecución de jobs       | Resultado de cada job pg_cron | `cron.job_run_details` (tabla de Supabase)      |
| Llamadas HTTP de pg_net | Respuesta de Cloud Run        | `net._http_response` (tabla de Supabase)        |
| Estado del modelo       | Versión actual en production  | `modelos_ml WHERE status='production'`          |
| Alertas operativas      | Alertas no resueltas por tipo | `alertas_ml WHERE resuelta=false`               |
| Fill Rate               | Tasa de servicio actual       | `movimientos_inventario` + cálculo en dashboard |
| Tasa de Sobrestock      | SKU con cobertura > 60 días   | `stock_ubicaciones` + cálculo en dashboard      |

---

## Roadmap de fases

| Fase       | Estado        | Descripción                                                                      |
| ---------- | ------------- | -------------------------------------------------------------------------------- |
| **Fase 1** | ✅ Completada | Frontend completo con datos mock. Sin conexión real a Supabase ni ML.            |
| **Fase 2** | Pendiente     | Conexión a Supabase: Auth real, PostgreSQL, RLS, Realtime. Seed de ubigeos INEI. |
| **Fase 3** | Pendiente     | Implementación de FastAPI con SARIMA + XGBoost. Docker. ETL Pipeline.            |
| **Fase 4** | Pendiente     | Integración completa frontend ↔ Supabase ↔ modelo ML. pg_cron jobs activos.      |
| **Fase 5** | Pendiente     | Despliegue en producción: Vercel + Google Cloud Run. Piloto en boticas Lima.     |

---

## Restricciones de infraestructura (ACP v1.3)

| Restricción                                                               | Implementación                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| No despliegue en infraestructura de alta disponibilidad                   | Supabase free tier + Cloud Run scale-to-zero (`min-instances=0`)          |
| No automatización de reposición física                                    | Solo predicciones, alertas y visualizaciones                              |
| No app móvil                                                              | Solo web (React SPA)                                                      |
| No integración con POS, ERP, WMS                                          | Solo datos históricos en formato digital (CSV/Excel vía Supabase Storage) |
| No autenticación biométrica ni OAuth corporativo                          | Solo Supabase Auth (JWT + RLS)                                            |
| No gestión de servidor propio de BD                                       | Supabase Cloud                                                            |
| Variables exógenas excluidas del modelo ML                                | ETL filtra solo features internos definidos en la arquitectura lógica     |
| Dataset limitado a medicamentos (sin dispositivos médicos, higiene, etc.) | Filtro por `productos.clasificacion` y `productos.estado` en el ETL       |
| Excluir medicamentos con cambios regulatorios o refrigeración             | Filtro explícito en ETL (`estado='activo'` + flag de exclusión)           |

---

## Costos estimados de operación

| Componente       | Tier                                                     | Costo estimado   |
| ---------------- | -------------------------------------------------------- | ---------------- |
| Supabase         | Free tier (500 MB DB, 1 GB Storage, 50k usuarios/mes)    | $0 USD/mes       |
| Google Cloud Run | scale-to-zero, ~4 reentrenamientos/mes × ~5 min cada uno | < $2 USD/mes     |
| Vercel           | Hobby tier (Fase 5)                                      | $0 USD/mes       |
| **Total**        |                                                          | **< $5 USD/mes** |

> El diferenciador drift-aware reduce el cómputo: en lugar de reentrenar semanalmente (4 veces/mes), solo reentrena cuando hay drift real. Si el modelo es estable, el costo de Cloud Run es $0.

---

## Alineación con la arquitectura lógica

| Componente físico                            | Respaldo en arquitectura lógica                             |
| -------------------------------------------- | ----------------------------------------------------------- |
| `pg_cron` Job 4 (backfill)                   | `inferencias.valor_real` + mecanismo SQL documentado        |
| Realtime en 3 tablas                         | Sección "Suscripciones Realtime" con canales y filtros      |
| `alertas_ml.tipo_origen`                     | Campo nuevo que distingue regla vs modelo                   |
| `alertas_ml.tipo = 'prediccion'`             | Enum extendido (alineado con mock del frontend)             |
| Storage naming convention                    | `models/{version}/{hash}.pkl` — documentado en `modelos_ml` |
| UNIQUE INDEX parcial `production`            | Documentado como constraint explícito                       |
| Umbrales diferenciados (0.2/1.25 vs 0.3/1.5) | Tabla de umbrales en la sección de jobs pg_cron             |
| `precios` tabla                              | Listada en tablas transaccionales                           |
| `ubigeos` tabla                              | Listada como seed estático                                  |
| `devolucion` en ETL                          | Documentado en filtros del ETL Pipeline                     |
