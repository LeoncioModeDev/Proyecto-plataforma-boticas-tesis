# Adaptación del backend al modelo validado en Colab

## Archivos sustituidos o actualizados

- `modelos/modelo_hibrido/artefacto_modelo.pkl`: nuevo artefacto entrenado en Colab.
- `src/feature_engineering.py`: definición oficial de 27/29 features.
- `src/pipeline.py`: inferencia productiva no recursiva 1..12.
- `api/config.py`: ruta del nuevo artefacto y mínimos 26/84 semanas.
- `api/services/model_service.py`: carga del nuevo artefacto y métricas.
- `api/services/data_service.py`: series semanales crudas, persistencia y datos operativos.
- `api/services/prediction_service.py`: madurez e inferencia con el nuevo pipeline.
- `api/services/recommendation_service.py`: recomendaciones posteriores al forecasting.
- `api/services/alert_service.py`: generación real de alertas.
- `api/schemas.py`: contratos API actualizados e intervalos predictivos nulos.
- `api/main.py`: endpoints actualizados y GET `/api/v1/alertas`.
- `Dockerfile`: preparado para `PORT` de Cloud Run.
- `requirements.txt`: versiones compatibles con el artefacto serializado.

## Archivos retirados del despliegue lógico

El artefacto antiguo `modelos/v1.0.0/modelo.pkl` ya no se utiliza.

Los scripts experimentales antiguos que aún aparezcan en `src/` se conservan únicamente como referencia histórica; Cloud Run utiliza `src/pipeline.py` para inferencia.

## Cambios metodológicos preservados en producción

- XGBoost oficial desde 26 semanas.
- 84+ semanas para declarar `MODELO_COMPLETO`.
- Híbrido solo con orden SARIMA disponible para esa serie.
- Features multihorizonte calculadas desde un único forecast origin.
- Sin stock/lead time como predictors de demanda.
- Sin intervalos artificiales ±25%.
- Recomendaciones y alertas calculadas después de la predicción.

## Seguridad

El `.env` original fue excluido del paquete adaptado. No almacenar `SUPABASE_SERVICE_ROLE_KEY` en GitHub. Configurar secretos en Cloud Run / Secret Manager.
