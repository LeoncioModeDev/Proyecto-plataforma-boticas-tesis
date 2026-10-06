# BoticAI ML API — backend productivo

Servicio FastAPI para predicción semanal de demanda farmacéutica, recomendaciones de inventario y alertas.

Esta carpeta corresponde a la **capa productiva** del proyecto. El entrenamiento y la evaluación científica del modelo se realizan en los notebooks de Colab; Cloud Run únicamente carga el artefacto validado y ejecuta inferencia.

## Flujo productivo

```text
Supabase / datos operativos
        ↓
serie semanal producto × botica
        ↓
FastAPI
        ↓
artefacto_modelo.pkl
        ↓
XGBoost desde 26 semanas
SARIMA–XGBoost adaptativo para series maduras del piloto con orden SARIMA disponible
        ↓
predicción h=1..12
        ↓
recomendaciones
        ↓
alertas
```

## Artefacto del modelo

La API carga por defecto:

```text
modelos/modelo_hibrido/artefacto_modelo.pkl
```

El artefacto contiene los preprocesadores, XGBoost independiente, correctores residuales, órdenes SARIMA del piloto, configuración adaptativa por categoría, esquema de features y métricas del holdout.

No se vuelve a entrenar el modelo durante una petición HTTP.

## Features oficiales

El XGBoost independiente utiliza 27 features:

```text
producto_id
botica_id
categoria_terapeutica
horizonte
semana_sin
semana_cos
lag_1
lag_2
lag_4
lag_8
lag_13
lag_26
rolling_mean_4
rolling_mean_8
rolling_mean_13
rolling_mean_26
rolling_std_4
rolling_std_13
rolling_std_26
tendencia_4
tendencia_13
variacion_1_semana
variacion_4_semanas
escala_serie
porcentaje_ceros
semanas_desde_ultima_venta
coeficiente_variacion
```

El corrector híbrido agrega:

```text
pred_sarima
log_pred_sarima
```

No se utilizan como predictors `stock_minimo`, `stock_maximo`, `lead_time`, `stockout_flag` ni `demanda_insatisfecha`. Estas variables pertenecen a la capa posterior de inventario/recomendaciones.

## Madurez de series

```text
0–3 semanas   → SIN_DATOS
4–12          → HISTORIAL_INICIAL
13–25         → HISTORIAL_INTERMEDIO
26–83         → PREDICCION_LIMITADA / XGBoost global
84+           → MODELO_COMPLETO
```

Para series maduras, el híbrido SARIMA–XGBoost solo se utiliza cuando existe un orden SARIMA aprendido para esa combinación `org_id + botica_id + producto_id`. En organizaciones o series nuevas sin dicho orden, la API mantiene XGBoost como fallback maduro.

## Inferencia multihorizonte

Una petición puede solicitar de 1 a 12 semanas. Las features de todos los horizontes se construyen desde el **mismo historial observado al origen del forecast**. Para `h > 1` no se agregan predicciones intermedias como si fueran ventas reales.

Por tanto, 4, 8 y 12 semanas son vistas del mismo esquema de inferencia multihorizonte.

## Endpoints principales

```text
GET  /health
GET  /api/v1/modelos/estado
GET  /api/v1/modelos/metricas
GET  /api/v1/modelos/drift

GET  /api/v1/series/{botica_id}/{producto_id}/madurez
POST /api/v1/predicciones
POST /api/v1/predicciones/botica
POST /api/v1/predicciones/organizacion
GET  /api/v1/predicciones/{botica_id}/{producto_id}

GET  /api/v1/recomendaciones
POST /api/v1/recomendaciones/reposicion
POST /api/v1/recomendaciones/compra
POST /api/v1/recomendaciones/reposicion/masiva
POST /api/v1/recomendaciones/compra/masiva
POST /api/v1/recomendaciones/{recomendacion_id}/aprobar
POST /api/v1/recomendaciones/{recomendacion_id}/rechazar

GET  /api/v1/alertas
POST /api/v1/alertas/evaluar
POST /api/v1/alertas/{alerta_id}/resolver
```

La documentación interactiva queda disponible en:

```text
/docs
```

## Métricas mostradas por la plataforma

`GET /api/v1/modelos/metricas` expone las métricas históricas almacenadas con el artefacto, incluyendo Macro-MAPE y métricas globales.

Estas métricas describen el rendimiento del modelo sobre el holdout y **no son el error de una predicción individual**.

Los campos `intervalo_inf` e `intervalo_sup` se mantienen en `null` hasta implementar intervalos predictivos reales. No se fabrican intervalos ±25% ni se reutilizan los IC95% del análisis estadístico del paper.

## Recomendaciones

El forecasting estima demanda. La capa de recomendación usa después stock y abastecimiento.

Para reposición de una botica:

```text
stock_libre = cantidad_disponible - stock_comprometido
stock_considerado = stock_libre + stock_en_transito
```

La cantidad recomendada se basa en demanda durante lead time + stock de seguridad − stock considerado.

Para compra del almacén central también se considera `stock_por_recibir`.

## Alertas

La evaluación operativa puede generar, según el contexto:

```text
stock_bajo
stockout_inminente
sobrestock
reposicion_recomendada
compra_urgente
vencimiento_proximo
```

Los vencimientos se evalúan en ventanas de 30, 60 y 90 días y se conserva FEFO como criterio de rotación.

## Variables de entorno

No subir secretos en `.env` al repositorio. Utiliza Secret Manager o variables de Cloud Run.

Ejemplo disponible en `.env.example`:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MODEL_PATH=modelos/modelo_hibrido/artefacto_modelo.pkl
MODEL_VERSION=
MIN_WEEKS_XGBOOST=26
MIN_WEEKS_HYBRID=84
RETRAIN_SECRET=
ENABLE_AUTOMATIC_RETRAIN=false
ALLOWED_ORIGINS=https://TU-FRONTEND.vercel.app
```

## Prueba local

```bash
pip install -r requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Verificar:

```text
http://localhost:8000/health
http://localhost:8000/docs
```

Para validar el artefacto desde CLI:

```bash
python src/pipeline.py validate-model
```

Para una predicción local sobre una serie incluida en `data/series_sarima.csv`:

```bash
python src/pipeline.py predict \
  --org-id <org_id> \
  --botica-id <botica_id> \
  --producto-id <producto_id> \
  --horizonte 12
```

## Docker / Cloud Run

El contenedor escucha en la variable `PORT` suministrada por Cloud Run.

Construcción local o en Cloud Build:

```bash
docker build -t boticai-ml .
```

El `Dockerfile` fija el entorno compatible con el artefacto y define:

```text
MODEL_PATH=modelos/modelo_hibrido/artefacto_modelo.pkl
MIN_WEEKS_XGBOOST=26
MIN_WEEKS_HYBRID=84
```

En Cloud Run configura como secretos/variables al menos:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS
```

## Separación entre experimento y producción

Los notebooks oficiales (`generar_dataset.ipynb`, `eda.ipynb`, `feature_engineering.ipynb`, `modelado_sarima_xgboost.ipynb`, `evaluacion_estadistica.ipynb` y `prueba_integracion_plataforma.ipynb`) se conservan como evidencia experimental fuera de este servicio.

Este backend consume el artefacto ya validado y no debe utilizar el holdout para recalibrar parámetros en producción.
