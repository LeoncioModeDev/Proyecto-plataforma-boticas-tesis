# Validación previa al despliegue

## Estado

- Compilación sintáctica de `api/`, `src/` y tests: **OK**.
- Contratos estáticos del backend: **7 tests aprobados**.
- Dos tests de carga exacta del pickle/API se omiten en este entorno de trabajo porque aquí están instaladas versiones distintas de scikit-learn/XGBoost a las utilizadas para serializar el artefacto.
- El `Dockerfile` y `requirements.txt` fijan las versiones del artefacto (`scikit-learn==1.6.1`, `xgboost==3.4.1`).
- Se ejecutó además una prueba de humo de inferencia local sobre una serie de 123 semanas: 4 predicciones, estrategia híbrida, valores no negativos, recomendación y generación de alerta.
- `prueba_integracion_plataforma.ipynb` fue ejecutado previamente y terminó con **PRUEBA DE INTEGRACIÓN APROBADA**.

## Verificaciones al construir la imagen en Cloud Run

Después del build, comprobar:

```text
GET /health
model_loaded = true
```

Luego abrir `/docs` y probar, en este orden:

```text
GET  /api/v1/modelos/estado
GET  /api/v1/modelos/metricas
GET  /api/v1/diagnostico/serie-valida
GET  /api/v1/series/{botica_id}/{producto_id}/madurez
POST /api/v1/predicciones
POST /api/v1/recomendaciones/reposicion
POST /api/v1/alertas/evaluar
GET  /api/v1/alertas
```

## Seguridad

El `.env` original no forma parte del paquete adaptado. Configurar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables/secretos de Cloud Run.
