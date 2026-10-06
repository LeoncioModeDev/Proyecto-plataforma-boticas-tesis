"""Carga y consulta del artefacto ML validado en Colab."""

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
        self.error_carga: str | None = None
        self.artefacto = self._cargar_pickle()

        # El nuevo artefacto ya contiene las métricas oficiales. Los JSON/CSV
        # externos quedan como complementos opcionales para compatibilidad.
        self.metricas = (
            self.artefacto.get("metricas", {})
            if isinstance(self.artefacto, dict)
            else {}
        )
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
            self.error_carga = f"Artefacto no encontrado en {ruta}"
            return self._artefacto_minimo()
        try:
            with ruta.open("rb") as archivo:
                return pickle.load(archivo)
        except Exception as exc:
            self.error_carga = (
                "No se pudo cargar artefacto_modelo.pkl: "
                f"{exc.__class__.__name__}: {exc}"
            )
            return self._artefacto_minimo()

    def _artefacto_minimo(self) -> dict:
        return {
            "version_modelo": config.model_version or "desconocido",
            "tipo_modelo": "NO_DISPONIBLE_EN_ESTE_ENTORNO",
            "preprocesador_hibrido": None,
            "preprocesador_xgb_independiente": None,
            "modelo_xgb_aditivo": None,
            "modelo_xgb_log": None,
            "modelo_xgb_independiente": None,
            "features_hibrido": [],
            "features_xgb_independiente": [],
            "metricas": {},
        }

    def _validar(self):
        if self.error_carga:
            return

        requeridos = [
            "version_modelo",
            "fecha_entrenamiento_utc",
            "tipo_modelo",
            "preprocesador_hibrido",
            "preprocesador_xgb_independiente",
            "modelo_xgb_aditivo",
            "modelo_xgb_log",
            "modelo_xgb_independiente",
            "features_hibrido",
            "features_xgb_independiente",
            "ordenes_sarima",
            "periodos_sarima_por_categoria",
            "configuracion_categoria",
            "metricas",
        ]
        faltantes = [
            campo
            for campo in requeridos
            if campo not in self.artefacto
        ]
        if faltantes:
            raise RuntimeError(
                f"Artefacto incompleto. Faltan claves: {faltantes}"
            )

    @property
    def modelo_version_id(self) -> str:
        return str(
            self.artefacto.get("version_modelo")
            or config.model_version
            or "desconocido"
        )

    @property
    def version(self) -> str:
        return self.modelo_version_id

    @property
    def cargado(self) -> bool:
        return not bool(self.error_carga)

    def _fila_global(self, nombre: str) -> dict:
        buscado = nombre.lower().replace("_", " ")
        for fila in self.metricas.get("metricas_globales", []):
            actual = str(fila.get("modelo", "")).lower().replace("_", " ")
            if actual == buscado:
                return fila
        return {}

    def calidad_modelo(self) -> dict:
        return {
            "version_modelo": self.version,
            "fecha_entrenamiento_utc": self.artefacto.get(
                "fecha_entrenamiento_utc"
            ),
            "macro_mape_holdout": {
                "xgboost": self.metricas.get("macro_mape_xgboost"),
                "sarima": self.metricas.get("macro_mape_sarima"),
                "hibrido": self.metricas.get("macro_mape_hibrido"),
            },
            "metricas_globales": self.metricas.get(
                "metricas_globales", []
            ),
            "nota": (
                "Métricas históricas del holdout del modelo; no representan "
                "el error de una predicción individual."
            ),
        }

    def estado(self) -> dict:
        macros = {
            "XGBoost": self.metricas.get("macro_mape_xgboost"),
            "SARIMA": self.metricas.get("macro_mape_sarima"),
            "Hibrido": self.metricas.get("macro_mape_hibrido"),
        }
        validos = {
            k: float(v)
            for k, v in macros.items()
            if v is not None
        }
        mejor_modelo = min(validos, key=validos.get) if validos else None

        hibrido = self._fila_global("SARIMA XGBoost")
        if not hibrido:
            hibrido = self._fila_global("SARIMA_XGBoost")

        return {
            "modelo_version_id": self.modelo_version_id,
            "version": self.version,
            "estrategia_hibrida": self.artefacto.get("tipo_modelo"),
            "mejor_modelo_evaluado": mejor_modelo,
            "modelo_exportado": self.artefacto.get("tipo_modelo"),
            "fecha_carga": self.cargado_en,
            "fecha_entrenamiento": self.artefacto.get(
                "fecha_entrenamiento_utc"
            ),
            "macro_mape": self.metricas.get("macro_mape_hibrido"),
            "mae": hibrido.get("MAE") or hibrido.get("mae"),
            "rmse": hibrido.get("RMSE") or hibrido.get("rmse"),
            "mape": hibrido.get("MAPE") or hibrido.get("mape"),
            "psi": self.drift.get("psi_max"),
            "estado_drift": {
                "requiere_retraining": self.drift.get(
                    "requiere_retraining", False
                ),
                "alerta_critica": self.drift.get(
                    "alerta_critica", False
                ),
            },
            "ordenes_sarima": len(
                self.artefacto.get("ordenes_sarima", {})
            ),
            "categorias_adaptativas": len(
                self.artefacto.get("configuracion_categoria", {})
            ),
            "features_xgboost": len(
                self.artefacto.get("features_xgb_independiente", [])
            ),
            "features_hibrido": len(
                self.artefacto.get("features_hibrido", [])
            ),
            "total_predicciones": (
                int(len(self.predicciones))
                if not self.predicciones.empty
                else 0
            ),
            "ultima_inferencia": self._ultima_fecha(self.inferencias),
            "modo": "SUPABASE" if config.modo_supabase else "LOCAL",
            "modelo_pickle_cargado": self.cargado,
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
