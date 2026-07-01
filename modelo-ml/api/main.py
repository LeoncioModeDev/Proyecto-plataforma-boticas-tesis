"""API FastAPI para predicción y recomendaciones ML."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, Header, status
from fastapi.middleware.cors import CORSMiddleware

from .config import config
from .errors import error_http
from .schemas import (
    AprobarRechazarResponse,
    CompraRequest,
    EstadoReentrenamiento,
    MadurezResponse,
    PrediccionRequest,
    PrediccionResponse,
    PrediccionesBoticaRequest,
    PrediccionesOrganizacionRequest,
    RecomendacionResponse,
    ReentrenamientoRequest,
    ReposicionRequest,
)
from .security import obtener_org_id, obtener_perfil_autenticado
from .services.data_service import data_service
from .services.model_service import model_service
from .services.prediction_service import prediction_service
from .services.recommendation_service import recommendation_service
from .services.retraining_service import retraining_service


app = FastAPI(
    title="BoticAI ML API",
    version="1.0.0",
    description="API de predicción de demanda y recomendaciones de inventario.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Org-Id", "X-Retrain-Secret"],
)


@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "ok",
        "model_loaded": bool(model_service.artefacto),
        "model_version": model_service.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/modelos/estado", tags=["Modelos"])
def estado_modelo():
    return model_service.estado()


@app.get("/api/v1/modelos/metricas", tags=["Modelos"])
def metricas_modelo():
    return model_service.metricas


@app.get("/api/v1/modelos/drift", tags=["Modelos"])
def drift_modelo():
    return model_service.drift


@app.get("/api/v1/diagnostico/supabase", tags=["Diagnostico"])
def diagnostico_supabase(org_id: str = Depends(obtener_org_id)):
    return data_service.diagnostico(org_id)


@app.get("/api/v1/diagnostico/serie-valida", tags=["Diagnostico"])
def diagnostico_serie_valida(org_id: str = Depends(obtener_org_id)):
    serie = data_service.serie_valida(org_id)
    if not serie:
        error_http(404, "SERIE_VALIDA_NO_ENCONTRADA", "No se encontró una serie con ventas históricas para la organización.")
    return serie


@app.get("/api/v1/series/{botica_id}/{producto_id}/madurez", response_model=MadurezResponse, tags=["Predicciones"])
def madurez_serie(botica_id: str, producto_id: str, org_id: str = Depends(obtener_org_id)):
    return prediction_service.madurez(org_id, botica_id, producto_id)


@app.post("/api/v1/predicciones", response_model=PrediccionResponse, tags=["Predicciones"])
def prediccion_individual(datos: PrediccionRequest, org_id: str = Depends(obtener_org_id)):
    return prediction_service.predecir(
        org_id,
        datos.botica_id,
        datos.producto_id,
        datos.horizonte,
        datos.demanda_inicial_manual,
    )


@app.post("/api/v1/predicciones/botica", tags=["Predicciones"])
def predicciones_botica(datos: PrediccionesBoticaRequest, org_id: str = Depends(obtener_org_id)):
    return {
        "org_id": org_id,
        "botica_id": datos.botica_id,
        "predicciones": prediction_service.predecir_botica(
            org_id,
            datos.botica_id,
            datos.horizonte,
            datos.categoria_terapeutica,
            datos.producto_id,
            datos.solo_productos_con_historial,
        ),
    }


@app.post("/api/v1/predicciones/organizacion", tags=["Predicciones"])
def predicciones_organizacion(datos: PrediccionesOrganizacionRequest, org_id: str = Depends(obtener_org_id)):
    return {
        "org_id": org_id,
        "predicciones": prediction_service.predecir_organizacion(
            org_id,
            datos.horizonte,
            datos.categoria_terapeutica,
            datos.solo_productos_con_historial,
            datos.batch_size,
        ),
    }


@app.get("/api/v1/predicciones/{botica_id}/{producto_id}", tags=["Predicciones"])
def consultar_predicciones(botica_id: str, producto_id: str, org_id: str = Depends(obtener_org_id)):
    return {
        "org_id": org_id,
        "botica_id": botica_id,
        "producto_id": producto_id,
        "predicciones": data_service.predicciones_guardadas(org_id, botica_id, producto_id),
    }


@app.get("/api/v1/recomendaciones", tags=["Recomendaciones"])
def consultar_recomendaciones(org_id: str = Depends(obtener_org_id)):
    if not data_service.repo.disponible:
        return {"org_id": org_id, "recomendaciones": list(data_service.recomendaciones.values())}
    filas = data_service.repo.seleccionar_todo("recomendaciones_ml", {"org_id": org_id}, orden="generado_en")
    return {"org_id": org_id, "recomendaciones": filas}


@app.post("/api/v1/recomendaciones/reposicion", response_model=RecomendacionResponse, tags=["Recomendaciones"])
def recomendar_reposicion(datos: ReposicionRequest, org_id: str = Depends(obtener_org_id)):
    return recommendation_service.recomendar_reposicion(org_id, datos)


@app.post("/api/v1/recomendaciones/compra", response_model=RecomendacionResponse, tags=["Recomendaciones"])
def recomendar_compra(datos: CompraRequest, org_id: str = Depends(obtener_org_id)):
    return recommendation_service.recomendar_compra(org_id, datos)


@app.post("/api/v1/recomendaciones/reposicion/masiva", tags=["Recomendaciones"])
def recomendar_reposicion_masiva(datos: PrediccionesBoticaRequest, org_id: str = Depends(obtener_org_id)):
    recomendaciones = []
    for producto in data_service.productos_activos(org_id, datos.botica_id, datos.categoria_terapeutica):
        req = ReposicionRequest(botica_id=datos.botica_id, drogueria_id=datos.botica_id, producto_id=producto["producto_id"], horizonte_semanas=datos.horizonte)
        recomendaciones.append(recommendation_service.recomendar_reposicion(org_id, req))
    return {"org_id": org_id, "recomendaciones": recomendaciones}


@app.post("/api/v1/recomendaciones/compra/masiva", tags=["Recomendaciones"])
def recomendar_compra_masiva(datos: CompraRequest, org_id: str = Depends(obtener_org_id)):
    recomendaciones = []
    for producto in data_service.productos_activos(org_id):
        req = CompraRequest(almacen_id=datos.almacen_id, producto_id=producto["producto_id"], proveedor_id=datos.proveedor_id, horizonte_semanas=datos.horizonte_semanas, nivel_servicio=datos.nivel_servicio)
        recomendaciones.append(recommendation_service.recomendar_compra(org_id, req))
    return {"org_id": org_id, "recomendaciones": recomendaciones}


@app.post("/api/v1/recomendaciones/{recomendacion_id}/aprobar", response_model=AprobarRechazarResponse, tags=["Recomendaciones"])
def aprobar_recomendacion(recomendacion_id: str, org_id: str = Depends(obtener_org_id)):
    rec = recommendation_service.cambiar_estado(recomendacion_id, "APROBADA")
    if not rec or rec.get("org_id") != org_id:
        error_http(404, "RECOMENDACION_NO_ENCONTRADA", "No existe recomendación para la organización.")
    return {"recomendacion_id": recomendacion_id, "estado": "APROBADA", "mensaje": "Recomendación aprobada; la plataforma debe crear la orden o transferencia.", "datos_para_plataforma": rec}


@app.post("/api/v1/recomendaciones/{recomendacion_id}/rechazar", response_model=AprobarRechazarResponse, tags=["Recomendaciones"])
def rechazar_recomendacion(recomendacion_id: str, org_id: str = Depends(obtener_org_id)):
    rec = recommendation_service.cambiar_estado(recomendacion_id, "RECHAZADA")
    if not rec or rec.get("org_id") != org_id:
        error_http(404, "RECOMENDACION_NO_ENCONTRADA", "No existe recomendación para la organización.")
    return {"recomendacion_id": recomendacion_id, "estado": "RECHAZADA", "mensaje": "Recomendación rechazada.", "datos_para_plataforma": rec}


@app.post("/api/v1/modelos/reentrenar", status_code=status.HTTP_202_ACCEPTED, response_model=EstadoReentrenamiento, tags=["Reentrenamiento"])
def reentrenar_modelo(datos: ReentrenamientoRequest, background_tasks: BackgroundTasks, x_retrain_secret: str | None = Header(default=None, alias="X-Retrain-Secret"), org_id: str = Depends(obtener_org_id)):
    if config.retrain_secret and x_retrain_secret != config.retrain_secret:
        error_http(403, "RETRAIN_SECRET_INVALIDO", "No tiene permiso para iniciar reentrenamiento.")
    if datos.alcance == "ORGANIZACION" and datos.org_id and datos.org_id != org_id:
        error_http(403, "ORG_CONFLICTO", "No puede reentrenar otra organización.")
    job = retraining_service.crear_job(datos.alcance, datos.org_id or (org_id if datos.alcance == "ORGANIZACION" else None), datos.forzar)
    background_tasks.add_task(retraining_service.marcar_ejecucion_simulada, job["job_id"])
    return job


@app.get("/api/v1/modelos/reentrenamientos/{job_id}", response_model=EstadoReentrenamiento, tags=["Reentrenamiento"])
def estado_reentrenamiento(job_id: str, org_id: str = Depends(obtener_org_id)):
    job = retraining_service.obtener_job(job_id)
    if not job:
        error_http(404, "JOB_NO_ENCONTRADO", "No existe el trabajo de reentrenamiento.")
    if job.get("org_id") and job.get("org_id") != org_id:
        error_http(403, "SIN_ACCESO", "No puede consultar trabajos de otra organización.")
    return job


@app.post("/api/v1/modelos/verificar-reentrenamiento", tags=["Reentrenamiento"])
def verificar_reentrenamiento(org_id: str = Depends(obtener_org_id)):
    resultado = retraining_service.verificar()
    resultado["org_id"] = org_id
    return resultado
