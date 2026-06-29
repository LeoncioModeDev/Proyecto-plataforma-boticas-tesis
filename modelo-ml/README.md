# Modelo ML - Predicción de demanda por producto-botica

Este módulo contiene la implementación oficial del modelo SARIMA + XGBoost para pronosticar demanda semanal farmacéutica.

La unidad real de predicción es:

```text
org_id + botica_id + producto_id + fecha_semana -> cantidad_vendida futura
```

La categoría terapéutica no es seleccionada por el usuario. Se obtiene desde el producto, puede usarse como feature categórica y se utiliza para agrupar resultados del paper.

## Estructura

```text
modelo-ml/
├── data/
├── src/
│   ├── generar_dataset.py
│   ├── feature_engineering.py
│   ├── eda.py
│   └── pipeline.py
├── notebooks/
│   └── ML6ipynb.ipynb
├── modelos/v1.0.0/
├── reports/eda/
├── reports/graficos/
├── reports/paper/
├── tests/
└── api/
```

`src/pipeline.py` es la única fuente oficial de entrenamiento, evaluación e inferencia local.

## Flujo del paper

```bash
python src/generar_dataset.py
python src/feature_engineering.py
python src/eda.py
python src/pipeline.py train
python src/pipeline.py evaluate-paper
```

Para auditoría técnica:

```bash
python src/pipeline.py evaluate-paper --guardar-detalle
```

El notebook `notebooks/ML6ipynb.ipynb` solo carga CSV y gráficos desde `reports/paper/`. No entrena modelos ni monta Google Drive.

## Flujo productivo futuro

```text
registro de maestros
-> importación de ventas históricas
-> selección de botica + producto + horizonte
-> predicción semanal
-> motor de inventario y recomendaciones
```

La API recibe:

```json
{
  "botica_id": "uuid",
  "producto_id": "uuid",
  "horizonte_semanas": 8
}
```

`org_id` se obtiene desde autenticación. La categoría terapéutica se resuelve internamente desde el producto.

## Comandos principales

```bash
python src/generar_dataset.py
python src/feature_engineering.py
python src/eda.py
python src/pipeline.py train
python src/pipeline.py evaluate-paper
python src/pipeline.py predict --org-id <uuid> --botica-id <uuid> --producto-id <uuid> --horizonte 8
```

Modos reducidos para pruebas:

```bash
python src/generar_dataset.py --fast --max-productos 6
python src/pipeline.py evaluate-paper --fast --max-series 6 --max-folds 2 --skip-auto-arima
```

## Variables de pronóstico

Columnas base:

```text
fecha_semana
org_id
botica_id
producto_id
categoria_terapeutica
cantidad_vendida
```

Features finales:

```text
stock_inicio_semana
stock_minimo
stock_maximo
lead_time_dias
ratio_stock_minimo
ratio_stock_maximo
mes
semana_anio
semana_sin
semana_cos
es_invierno
es_verano
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
escala_serie
porcentaje_ceros
semanas_desde_ultima_venta
coeficiente_variacion
```

Durante validación e inferencia se agregan:

```text
horizonte
pred_sarima
log_pred_sarima
ratio_lag1_sarima
ratio_media4_sarima
```

## Variables operativas para recomendaciones

El modelo solo responde cuánto se espera vender. No crea alertas, transferencias ni órdenes de compra.

El motor operativo usa después:

```text
cantidad_predicha
stock_disponible
stock_comprometido
stock_en_transito
stock_por_recibir
stock_minimo
stock_maximo
stock_seguridad
lead_time_dias
cantidad_minima_compra
multiplo_empaque
```

Flujo operativo:

```text
predicción de demanda
-> cálculo de posición de inventario
-> detección de riesgo de quiebre o sobrestock
-> generación de alerta
-> generación de recomendación de compra o transferencia
-> aprobación del usuario
```

Las recomendaciones se generan inicialmente con estado pendiente y no crean automáticamente órdenes de compra ni transferencias.

## Evaluación del paper

Las predicciones se generan por producto-botica. Luego se agregan por:

```text
categoria_terapeutica + fecha_semana
```

Se suman valores reales y predichos por categoría-semana y recién después se calcula el MAPE por categoría. El macro-MAPE por categoría es el promedio simple de los MAPE de las categorías.

Archivos principales:

```text
reports/paper/predicciones_holdout.csv
reports/paper/predicciones_categoria_semana.csv
reports/paper/mape_por_categoria.csv
reports/paper/metricas_globales.csv
reports/paper/resumen_macro_mape_categoria.csv
```

## ATC

El código ATC no forma parte de la plataforma, del modelo, de las features ni del artefacto. Solo existe una tabla manual referencial para discusión del paper:

```text
reports/paper/equivalencias_categoria_atc_paper.csv
```

## Artefactos

`python src/pipeline.py train` genera:

```text
modelos/v1.0.0/modelo.pkl
modelos/v1.0.0/metricas.json
modelos/v1.0.0/pipeline_config.json
modelos/v1.0.0/feature_schema.json
modelos/v1.0.0/drift_metricas.json
```

`modelo.pkl` no contiene datasets completos. Contiene preprocesadores, modelos XGBoost, configuración por categoría, órdenes SARIMA livianas, schema de features y métricas de validación.

## Supabase

En Supabase puede existir `ventas_historicas.cantidad`. En la capa ML debe extraerse como:

```sql
cantidad AS cantidad_vendida
```

`stock_historico.cantidad_disponible` se transforma a `stock_inicio_semana` para modelado.

Si faltan columnas operativas (`stock_inicio_semana`, `stock_minimo`, `stock_maximo`, `lead_time_dias`), el reentrenamiento no se detiene. Se usan defaults neutrales y se registran advertencias.
