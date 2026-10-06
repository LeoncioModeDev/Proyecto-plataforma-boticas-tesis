"""Configuración del servicio ML productivo."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


RAIZ_MODELO = Path(__file__).resolve().parents[1]
ENV_FILE = RAIZ_MODELO / ".env"
load_dotenv(ENV_FILE)


class Configuracion:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        model_path_env = os.getenv(
            "MODEL_PATH",
            "modelos/modelo_hibrido/artefacto_modelo.pkl",
        )
        self.model_path = Path(model_path_env)
        if not self.model_path.is_absolute():
            self.model_path = RAIZ_MODELO / self.model_path
        self.model_dir = self.model_path.parent

        self.model_version = os.getenv("MODEL_VERSION") or None

        # El Feature Engineering oficial utiliza lag/rolling de hasta 26 semanas.
        self.min_weeks_xgboost = int(os.getenv("MIN_WEEKS_XGBOOST", "26"))
        # Política funcional de madurez acordada para activar el híbrido completo.
        self.min_weeks_hybrid = int(os.getenv("MIN_WEEKS_HYBRID", "84"))

        self.retrain_secret = os.getenv("RETRAIN_SECRET")
        self.enable_automatic_retrain = (
            os.getenv("ENABLE_AUTOMATIC_RETRAIN", "false").lower() == "true"
        )

        origins = os.getenv("CORS_ORIGINS") or os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
        self.allowed_origins = [
            origen.strip()
            for origen in origins.split(",")
            if origen.strip()
        ]

    @property
    def modo_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


config = Configuracion()
