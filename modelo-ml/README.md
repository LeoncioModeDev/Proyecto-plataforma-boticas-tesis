# Modelo ML - botica-demand-ml

Servicio de Machine Learning para predicción de demanda farmacéutica.

## Estructura

```text
modelo-ml/
├── data/
│   ├── features_entrenamiento.csv
│   ├── productos.csv
│   ├── boticas.csv
│   ├── movimientos_inventario.csv
│   └── ...
├── src/
│   ├── generar_dataset.py
│   ├── pipeline.py
│   ├── eda.py
│   └── utils.py
├── modelos/
│   └── v1.0.0/
│       ├── modelo.pkl
│       ├── metricas.json
│       ├── drift_metricas.json
│       └── predicciones.csv
├── api/
│   ├── __init__.py
│   └── main.py
├── reports/
│   ├── graficos/
│   └── eda/
├── requirements.txt
├── Dockerfile
└── README.md
```

## Comandos

Desde `modelo-ml/`:

```bash
python src/generar_dataset.py
python src/feature_engineering.py
python src/pipeline.py
```

## Flujo del pipeline de ML

El proyecto `modelo-ml` sigue un flujo secuencial para preparar datos, construir variables predictivas y entrenar/evaluar los modelos de demanda farmacéutica.

### 1. Generación del dataset

El script `src/generar_dataset.py` genera los datos base del proyecto y los guarda en la carpeta `data/`.

Este paso crea los CSV operativos y de entrenamiento, entre ellos:

```text
data/ventas_historicas.csv
data/stock_historico.csv
data/features_entrenamiento.csv
```

El archivo principal de salida para la siguiente etapa es:

```text
data/features_entrenamiento.csv
```

### 2. Feature engineering

El script `src/feature_engineering.py` toma como entrada:

```text
data/features_entrenamiento.csv
```

A partir de este archivo construye variables predictivas para los modelos, como variables calendario, inventario, lags, medias móviles y tendencias recientes.

Genera los archivos preparados para modelado:

```text
data/features_modelado.csv
data/series_sarima.csv
```

Además, guarda un reporte del proceso en:

```text
modelos/v1.0.0/feature_engineering_reporte.json
```

### 3. Entrenamiento y evaluación

El script `src/pipeline.py` utiliza los archivos ya preparados:

```text
data/features_modelado.csv
data/series_sarima.csv
```

Con estos datos entrena y evalúa los modelos de predicción de demanda:

- SARIMA por serie producto-botica.
- XGBoost directo.
- Modelo híbrido SARIMA + XGBoost sobre residuos.
- Seasonal Naive como baseline y fallback.

Los artefactos finales se guardan en:

```text
modelos/v1.0.0/
```

Archivos generados:

```text
modelos/v1.0.0/modelo.pkl
modelos/v1.0.0/metricas.json
modelos/v1.0.0/predicciones.csv
modelos/v1.0.0/inferencias.csv
modelos/v1.0.0/drift_metricas.json
modelos/v1.0.0/pipeline_config.json
```

### Resumen del flujo

El flujo completo se ejecuta en este orden:

```text
src/generar_dataset.py -> src/feature_engineering.py -> src/pipeline.py
```

Cada etapa depende de los archivos generados por la etapa anterior, por lo que se recomienda ejecutar los scripts de forma secuencial.

## Artefactos

- Datasets: `data/`
- Modelos y resultados versionados: `modelos/`

## Arquitectura de la solución ML

La API de `modelo-ml` integra el modelo piloto/global de predicción de demanda con la plataforma web multiempresa. La solución separa tres responsabilidades:

- Pronóstico de demanda: estima la demanda semanal futura por producto y botica.
- Motor de recomendaciones: calcula cuánto transferir o comprar usando pronóstico, stock, tránsito, órdenes pendientes y stock de seguridad.
- Reentrenamiento: actualiza los modelos de forma manual o programada, no con cada venta individual.

Los movimientos y ventas no se insertan directamente en `modelo.pkl`. Primero se guardan en Supabase, luego se agregan semanalmente, se convierten en features y alimentan inferencia o reentrenamiento.

## Decisión de inicio progresivo

Una organización nueva no debe esperar 104 semanas para usar el sistema. La API selecciona la estrategia según la madurez de cada serie `org_id + botica_id + producto_id`.

| Historial | Estrategia |
| --- | --- |
| 0 semanas | Reglas iniciales |
| 1-3 semanas | Promedio/fallback |
| 4-103 semanas | XGBoost global |
| 104+ semanas | Híbrido SARIMA + XGBoost |

## Cómo usa el sistema una organización nueva

Desde el primer día, la organización puede recibir recomendaciones basadas en stock mínimo y demanda inicial manual. Desde la primera semana, el sistema usa promedios disponibles. Desde la cuarta semana, puede usar XGBoost global si las features mínimas son válidas. Desde la semana 104, se habilita SARIMA estacional anual y el modelo híbrido.

La plataforma debe mostrar siempre:

- estrategia utilizada;
- madurez de la serie;
- versión del modelo;
- advertencias;
- intervalos de predicción.

## Flujo de datos operativos hacia el modelo

```text
Registro de productos, proveedores y ubicaciones
                       ↓
Ventas y movimientos en Supabase
                       ↓
Agregación semanal
                       ↓
Feature engineering
                       ↓
Selección de estrategia según madurez
                       ↓
Pronóstico de demanda
                       ↓
Cálculo de posición de inventario
                       ↓
Recomendación de transferencia o compra
                       ↓
Aprobación del usuario
                       ↓
Nuevos datos reales
                       ↓
Reentrenamiento manual o programado
```

## Variables consumidas

| Grupo | Columnas |
| --- | --- |
| Identificación | `org_id`, `botica_id`, `producto_id` |
| Demanda | `fecha_venta`, `cantidad_vendida` |
| Inventario | `stock_actual`, `stock_minimo`, `stock_maximo`, `stock_comprometido` |
| Abastecimiento | `stock_en_transito`, `stock_por_recibir` |
| Proveedor | `lead_time_dias`, `cantidad_minima_compra`, `multiplo_empaque` |
| Producto | `categoria_terapeutica` |
| Derivadas | lags, rolling means, ratios, flags y calendario |

## Pronóstico de demanda

La API no recibe todas las features desde el frontend. Consulta datos operativos por `org_id`, agrega ventas por semana con frecuencia `W-MON` y construye internamente lags, medias móviles, ratios de stock, flags de inventario y variables calendario.

En modo local usa los artefactos de `modelos/v1.0.0/` y los CSV de `data/` para pruebas. En modo Supabase, consulta tablas operativas reales.

## Motor de recomendaciones

El motor de recomendaciones es distinto del pronóstico. El pronóstico estima demanda; el motor calcula cuánto transferir o comprar.

Para reposición interna:

```text
demanda_durante_lead_time + stock_seguridad - posicion_inventario_botica
```

Para compra:

```text
demanda_durante_lead_time + stock_seguridad - posicion_inventario_almacen
```

La API genera recomendaciones en estado `PENDIENTE`; no crea automáticamente órdenes de compra ni transferencias.

## Stock de droguería y stock en tránsito

La posición de inventario se calcula como:

```text
posicion_inventario = stock_disponible + stock_en_transito + stock_por_recibir - stock_comprometido
```

El stock de seguridad se calcula con desviación histórica cuando existe historial suficiente. Si no existe, usa `stock_minimo`.

## Reentrenamiento manual

Un administrador puede solicitar reentrenamiento desde la plataforma:

```http
POST /api/v1/modelos/reentrenar
```

El endpoint devuelve `202 Accepted` y crea un trabajo. El proceso pesado debe ejecutarse fuera del request web.

## Reentrenamiento automático

El soporte automático existe, pero está desactivado por defecto:

```env
ENABLE_AUTOMATIC_RETRAIN=false
```

La API no crea un scheduler interno. Puede ejecutarse externamente:

```bash
python -m api.jobs.check_retraining
```

Reglas sugeridas: 8 semanas nuevas, PSI mayor a 0.20 o 90 días desde el último entrenamiento.

## Política multiempresa

Toda operación se aísla por `org_id`. La API intenta obtenerlo desde JWT y, si no existe, desde `X-Org-Id`. No se debe confiar en un `org_id` enviado libremente en el body si contradice el header o el token.

## Endpoints de la API

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
POST /api/v1/recomendaciones/reposicion
POST /api/v1/recomendaciones/compra
POST /api/v1/recomendaciones/reposicion/masiva
POST /api/v1/recomendaciones/compra/masiva
POST /api/v1/recomendaciones/{recomendacion_id}/aprobar
POST /api/v1/recomendaciones/{recomendacion_id}/rechazar
POST /api/v1/modelos/reentrenar
GET  /api/v1/modelos/reentrenamientos/{job_id}
POST /api/v1/modelos/verificar-reentrenamiento
```

## Variables de entorno

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MODEL_VERSION=v1.0.0
MODEL_DIR=modelos/v1.0.0
RETRAIN_SECRET=
ENABLE_AUTOMATIC_RETRAIN=false
MIN_WEEKS_XGBOOST=4
MIN_WEEKS_SARIMA=104
ALLOWED_ORIGINS=http://localhost:5173
```

## Ejecución local

```bash
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

Verificaciones:

```text
http://localhost:8000/health
http://localhost:8000/docs
```

## Pruebas

```bash
pytest
```

Las pruebas usan modo local y no requieren conexión real a Supabase.

## Limitaciones actuales

- El modelo actual es piloto/global inicial.
- El `modelo.pkl` mantiene XGBoost y metadatos SARIMA; la inferencia SARIMA dinámica para nuevas organizaciones queda preparada para versiones futuras.
- Para la organización piloto, la API puede consultar predicciones pre-generadas.
- Para organizaciones nuevas, se usa inicio progresivo con reglas, promedio y XGBoost global.
- El modelo no cambia con cada venta; se reentrena manual o programadamente.

## Vista esperada en la plataforma

Dashboard de predicciones:

- horizonte de 12 semanas;
- estrategia utilizada;
- madurez de la serie;
- versión del modelo;
- intervalos.

Pantalla de reposición:

- stock actual;
- stock en tránsito;
- stock por recibir;
- demanda esperada;
- stock de seguridad;
- cantidad recomendada.

Pantalla de compras:

- demanda agregada;
- proveedor sugerido;
- lead time;
- precio referencial;
- cantidad mínima;
- múltiplo de empaque.

Administración del modelo:

- versión activa;
- métricas;
- PSI;
- último entrenamiento;
- botón de reentrenamiento;
- estado del trabajo.

## Ejemplo desde React

```js
const respuesta = await fetch("http://localhost:8000/api/v1/predicciones", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Org-Id": orgId,
  },
  body: JSON.stringify({
    botica_id: boticaId,
    producto_id: productoId,
    horizonte_semanas: 12,
  }),
});

const prediccion = await respuesta.json();
```

## Ejemplo desde Supabase Edge Function

```ts
const res = await fetch(`${Deno.env.get("ML_API_URL")}/api/v1/recomendaciones/compra`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Org-Id": orgId,
  },
  body: JSON.stringify({
    almacen_id: almacenId,
    producto_id: productoId,
    horizonte_semanas: 12,
    nivel_servicio: 0.9,
  }),
});
```

## Persistencia sugerida en Supabase

Tablas esperadas:

```text
modelos_ml
predicciones_ml
recomendaciones_ml
reentrenamientos_ml
metricas_modelo_ml
```

La implementación actual deja preparado el repositorio; no crea migraciones SQL.
