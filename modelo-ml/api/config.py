"""Configuración de la API ML."""

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
        self.model_version = os.getenv("MODEL_VERSION", "v1.0.0")
        self.model_dir = Path(os.getenv("MODEL_DIR", "modelos/v1.0.0"))
        if not self.model_dir.is_absolute():
            self.model_dir = RAIZ_MODELO / self.model_dir
        self.retrain_secret = os.getenv("RETRAIN_SECRET")
        self.enable_automatic_retrain = os.getenv("ENABLE_AUTOMATIC_RETRAIN", "false").lower() == "true"
        self.min_weeks_xgboost = int(os.getenv("MIN_WEEKS_XGBOOST", "4"))
        self.min_weeks_sarima = int(os.getenv("MIN_WEEKS_SARIMA", "104"))
        origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        self.allowed_origins = [o.strip() for o in origins.split(",") if o.strip()]

    @property
    def modo_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


config = Configuracion()
