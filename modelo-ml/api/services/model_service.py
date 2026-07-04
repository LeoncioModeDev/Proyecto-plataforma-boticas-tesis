"""Carga y consulta de artefactos del modelo."""

from __future__ import annotations

import json
import pickle
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from ..config import config


class ModelService:
    def __init__(self):
        self.model_dir = config.model_dir
        self.model_path = config.model_path
        self.cargado_en = datetime.now(timezone.utc).isoformat()
        self.error_carga = None
        self.artefacto = self._cargar_pickle()
        self.metricas = self._cargar_json("metricas.json")
        self.drift = self._cargar_json("drift_metricas.json")
        self.pipeline_config = self._cargar_json("pipeline_config.json")
        self.predicciones = self._cargar_csv("predicciones.csv")
        self.inferencias = self._cargar_csv("inferencias.csv")
        self._validar()

    def _ruta(self, nombre: str) -> Path:
        return self.model_dir / nombre

    def _cargar_json(self, nombre: str) -> dict:
        ruta = self._ruta(nombre)
        if not ruta.exists():
            return {}
        with ruta.open("r", encoding="utf-8") as archivo:
            return json.load(archivo)

    def _cargar_csv(self, nombre: str) -> pd.DataFrame:
        ruta = self._ruta(nombre)
        if not ruta.exists():
            return pd.DataFrame()
        return pd.read_csv(ruta)

    def _cargar_pickle(self) -> dict:
        ruta = self.model_path
        if not ruta.exists():
            self.error_carga = f"modelo.pkl no encontrado en {ruta}"
            return self._artefacto_minimo()
        try:
            with ruta.open("rb") as archivo:
                return pickle.load(archivo)
        except Exception as exc:
            self.error_carga = f"No se pudo cargar modelo.pkl: {exc.__class__.__name__}"
            return self._artefacto_minimo()

    def _artefacto_minimo(self) -> dict:
        return {
            "version": config.model_version,
            "modelo_version_id": "desconocido",
            "tipo_modelo": "NO_DISPONIBLE_EN_ESTE_ENTORNO",
            "preprocesador_hibrido": None,
            "preprocesador_xgb_independiente": None,
            "modelo_xgb_aditivo": None,
            "modelo_xgb_log": None,
            "modelo_xgb_independiente": None,
            "features_hibrido": [],
        }

    def _validar(self):
        requeridos = ["preprocesador_hibrido", "preprocesador_xgb_independiente", "modelo_xgb_aditivo", "modelo_xgb_log", "modelo_xgb_independiente", "features_hibrido", "version"]
        faltantes = [campo for campo in requeridos if not self.artefacto.get(campo)]
        if faltantes and not self.error_carga:
            raise RuntimeError(f"Artefacto modelo.pkl incompleto: {faltantes}")

    @property
    def modelo_version_id(self) -> str:
        return self.metricas.get("modelo_version_id") or self.artefacto.get("modelo_version_id") or "desconocido"

    @property
    def version(self) -> str:
        return self.artefacto.get("version", config.model_version)

    def estado(self) -> dict:
        metricas_globales = self.metricas.get("metricas_globales", [])
        hibrido = next((m for m in metricas_globales if m.get("modelo") == "SARIMA + XGBoost"), {})
        series = self.metricas.get("series", {})
        return {
            "modelo_version_id": self.modelo_version_id,
            "version": self.version,
            "estrategia_hibrida": self.artefacto.get("tipo_modelo"),
            "mejor_modelo_evaluado": "SARIMA + XGBoost",
            "modelo_exportado": self.artefacto.get("tipo_modelo"),
            "fecha_carga": self.cargado_en,
            "fecha_entrenamiento": self.artefacto.get("fecha_entrenamiento") or self.metricas.get("fecha_entrenamiento") or self.metricas.get("split", {}).get("train_fin"),
            "mae": hibrido.get("mae"),
            "rmse": hibrido.get("rmse"),
            "mape": hibrido.get("mape"),
            "psi": self.drift.get("psi_max"),
            "estado_drift": {
                "requiere_retraining": self.drift.get("requiere_retraining", False),
                "alerta_critica": self.drift.get("alerta_critica", False),
            },
            "series_sarima": series.get("sarima", 0),
            "series_fallback": series.get("fallback", 0),
            "total_predicciones": int(len(self.predicciones)) if not self.predicciones.empty else 0,
            "ultima_inferencia": self._ultima_fecha(self.inferencias),
            "errores_recientes": [],
            "modo": "SUPABASE" if config.modo_supabase else "LOCAL",
            "modelo_pickle_cargado": not bool(self.error_carga),
            "error_carga": self.error_carga,
        }

    def _ultima_fecha(self, df: pd.DataFrame) -> str | None:
        if df.empty:
            return None
        for columna in ("created_at", "fecha_pred", "fecha_generacion"):
            if columna in df.columns:
                serie = pd.to_datetime(df[columna], errors="coerce").dropna()
                if not serie.empty:
                    return serie.max().isoformat()
        return None


model_service = ModelService()
