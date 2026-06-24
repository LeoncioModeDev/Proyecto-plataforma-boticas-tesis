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
        self.cargado_en = datetime.now(timezone.utc).isoformat()
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
        ruta = self._ruta("modelo.pkl")
        if not ruta.exists():
            return {}
        with ruta.open("rb") as archivo:
            return pickle.load(archivo)

    def _validar(self):
        requeridos = ["encoder", "xgb_directo", "xgb_residuos", "columnas_features", "version"]
        faltantes = [campo for campo in requeridos if not self.artefacto.get(campo)]
        if faltantes:
            raise RuntimeError(f"Artefacto modelo.pkl incompleto: {faltantes}")

    @property
    def modelo_version_id(self) -> str:
        return self.metricas.get("modelo_version_id") or self.artefacto.get("modelo_version_id") or "desconocido"

    @property
    def version(self) -> str:
        return self.artefacto.get("version", config.model_version)

    def estado(self) -> dict:
        modelos = self.metricas.get("modelos", {})
        hibrido = modelos.get("hibrido", {})
        series = self.metricas.get("series", {})
        return {
            "modelo_version_id": self.modelo_version_id,
            "version": self.version,
            "estrategia_hibrida": self.artefacto.get("estrategia_hibrida"),
            "mejor_modelo_evaluado": self.metricas.get("mejor_modelo_evaluado"),
            "modelo_exportado": self.metricas.get("modelo_exportado"),
            "fecha_carga": self.cargado_en,
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
            "modo": "SUPABASE" if config.modo_supabase else "LOCAL",
        }


model_service = ModelService()
