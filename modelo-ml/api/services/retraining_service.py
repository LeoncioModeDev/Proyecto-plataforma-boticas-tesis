"""Servicio de reentrenamiento manual y verificación automática."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..config import config
from .model_service import model_service


class RetrainingService:
    def __init__(self):
        self.jobs: dict[str, dict] = {}

    def crear_job(self, alcance: str, org_id: str | None, forzar: bool) -> dict:
        ahora = datetime.now(timezone.utc).isoformat()
        job_id = str(uuid.uuid4())
        job = {
            "job_id": job_id,
            "estado": "PENDIENTE",
            "alcance": alcance,
            "org_id": org_id,
            "forzar": forzar,
            "mensaje": "Trabajo creado. La ejecución real debe delegarse a un worker externo.",
            "creado_en": ahora,
            "actualizado_en": ahora,
        }
        self.jobs[job_id] = job
        return job

    def marcar_ejecucion_simulada(self, job_id: str):
        job = self.jobs.get(job_id)
        if not job:
            return
        job["estado"] = "COMPLETADO"
        job["mensaje"] = "Simulación local completada. En producción este job ejecuta el pipeline fuera del proceso web."
        job["actualizado_en"] = datetime.now(timezone.utc).isoformat()

    def obtener_job(self, job_id: str) -> dict | None:
        return self.jobs.get(job_id)

    def verificar(self) -> dict:
        psi = model_service.drift.get("psi_max", 0) or 0
        fecha_train = model_service.metricas.get("split", {}).get("train_fin")
        recomienda = bool(psi > config.__dict__.get("umbral_retrain_psi", 0.2))
        return {
            "enable_automatic_retrain": config.enable_automatic_retrain,
            "recomienda_reentrenar": recomienda,
            "motivos": ["PSI mayor al umbral"] if recomienda else [],
            "psi_max": psi,
            "fecha_ultimo_entrenamiento": fecha_train,
            "reglas": {
                "semanas_nuevas_minimas": 8,
                "psi_umbral": 0.20,
                "dias_desde_entrenamiento": 90,
            },
        }


retraining_service = RetrainingService()
