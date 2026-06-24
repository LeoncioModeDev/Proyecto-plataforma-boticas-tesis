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
