"""Acceso a datos operativos locales o Supabase."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from ..config import RAIZ_MODELO, config
from ..repositories.supabase_repository import SupabaseRepository


class DataService:
    def __init__(self):
        self.repo = SupabaseRepository(config.supabase_url, config.supabase_service_role_key)
        self.features = self._leer_csv("data/features_modelado.csv", parse_dates=["fecha_semana"])
        self.series = self._leer_csv("data/series_sarima.csv", parse_dates=["fecha_semana"])
        self.predicciones = self._leer_csv("modelos/v1.0.0/predicciones.csv")
        self.recomendaciones: dict[str, dict] = {}

    def _leer_csv(self, ruta_relativa: str, parse_dates=None) -> pd.DataFrame:
        ruta = RAIZ_MODELO / ruta_relativa
        if not ruta.exists():
            return pd.DataFrame()
        return pd.read_csv(ruta, parse_dates=parse_dates)

    def productos_activos(self, org_id: str, botica_id: str | None = None, categoria: str | None = None) -> list[dict]:
        df = self.features[self.features["org_id"] == org_id]
        if botica_id:
            df = df[df["botica_id"] == botica_id]
        if categoria:
            df = df[df["categoria_terapeutica"] == categoria]
        cols = ["producto_id", "codigo_producto", "nombre_comercial", "categoria_terapeutica"]
        return df[cols].drop_duplicates("producto_id").to_dict("records")

    def boticas(self, org_id: str) -> list[str]:
        df = self.features[self.features["org_id"] == org_id]
        return sorted(df["botica_id"].dropna().unique().tolist())

    def serie(self, org_id: str, botica_id: str, producto_id: str) -> pd.DataFrame:
        return self.features[
            (self.features["org_id"] == org_id)
            & (self.features["botica_id"] == botica_id)
            & (self.features["producto_id"] == producto_id)
        ].sort_values("fecha_semana").copy()

    def categoria_promedio(self, org_id: str, categoria: str | None) -> float:
        df = self.features[self.features["org_id"] == org_id]
        if categoria:
            df = df[df["categoria_terapeutica"] == categoria]
        return float(df["cantidad_vendida"].tail(52).mean()) if not df.empty else 1.0

    def predicciones_guardadas(self, org_id: str, botica_id: str, producto_id: str) -> list[dict]:
        if self.predicciones.empty:
            return []
        serie = self.serie(org_id, botica_id, producto_id)
        if serie.empty:
            return []
        df = self.predicciones[
            (self.predicciones["botica_id"] == botica_id)
            & (self.predicciones["producto_id"] == producto_id)
        ].copy()
        return df.to_dict("records")

    def stock(self, org_id: str, ubicacion_id: str, producto_id: str) -> dict:
        serie = self.features[
            (self.features["org_id"] == org_id)
            & (self.features["botica_id"] == ubicacion_id)
            & (self.features["producto_id"] == producto_id)
        ].sort_values("fecha_semana")
        if serie.empty:
            return {
                "stock_actual": 0.0,
                "stock_minimo": 0.0,
                "stock_maximo": 0.0,
                "stock_comprometido": 0.0,
                "stock_en_transito": 0.0,
                "stock_por_recibir": 0.0,
            }
        fila = serie.iloc[-1]
        return {
            "stock_actual": float(fila.get("stock_inicio_semana", 0)),
            "stock_minimo": float(fila.get("stock_minimo", 0)),
            "stock_maximo": float(fila.get("stock_maximo", 0)),
            "stock_comprometido": 0.0,
            "stock_en_transito": 0.0,
            "stock_por_recibir": 0.0,
        }

    def proveedor_producto(self, org_id: str, producto_id: str, proveedor_id: str | None = None) -> dict:
        serie = self.features[(self.features["org_id"] == org_id) & (self.features["producto_id"] == producto_id)]
        lead_time = int(serie["lead_time_dias"].median()) if not serie.empty else 7
        return {
            "proveedor_id": proveedor_id or "proveedor-local",
            "lead_time_dias": lead_time,
            "precio_referencial": 0.0,
            "cantidad_minima_compra": 1,
            "multiplo_empaque": 1,
        }

    def guardar_recomendacion(self, recomendacion: dict) -> dict:
        self.recomendaciones[recomendacion["recomendacion_id"]] = recomendacion
        return recomendacion

    def cambiar_estado_recomendacion(self, recomendacion_id: str, estado: str) -> dict | None:
        rec = self.recomendaciones.get(recomendacion_id)
        if not rec:
            return None
        rec["estado"] = estado
        rec["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        return rec


data_service = DataService()
