# Modelo ML — botica-demand-ml

Este directorio contendrá el servicio de Machine Learning para predicción de demanda farmacéutica.

## Tecnologías (Fase futura)

- **Python 3.10+** con **FastAPI** para la API REST
- **statsmodels** para SARIMA
- **XGBoost** para gradient boosting
- **scikit-learn** para preprocesamiento
- **pandas** y **NumPy** para manejo de datos
- Despliegue en **Docker + Google Cloud Run**

## Estructura

```
modelo-ml/
├── api/              → Endpoints FastAPI
├── entrenamiento/    → Scripts de entrenamiento
├── modelos_guardados/→ Archivos de modelos serializados
├── datos/            → Datasets de entrenamiento
└── notebooks/        → Jupyter notebooks de exploración
```

## Estado

**No desarrollado aún.** Este contenido se implementará en fases posteriores del proyecto.
