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
python src/pipeline.py
```

## Artefactos

- Datasets: `data/`
- Modelos y resultados versionados: `modelos/`
