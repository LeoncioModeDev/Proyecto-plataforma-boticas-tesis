"""Servicio de predicción y madurez de series."""

from __future__ import annotations

from datetime import timedelta

import numpy as np
import pandas as pd

from ..config import config
from ..schemas import NivelMadurez
from .data_service import data_service
from .model_service import model_service


def clasificar_madurez(semanas: int) -> NivelMadurez:
    if semanas == 0:
        return NivelMadurez.SIN_HISTORIAL
    if semanas <= 3:
        return NivelMadurez.HISTORIAL_CORTO
    if semanas < config.min_weeks_sarima:
        return NivelMadurez.HISTORIAL_INTERMEDIO
    return NivelMadurez.HISTORIAL_MADURO


def estrategia_por_madurez(nivel: NivelMadurez, sarima_dinamico: bool) -> str:
    if nivel == NivelMadurez.SIN_HISTORIAL:
        return "REGLAS_INICIALES"
    if nivel == NivelMadurez.HISTORIAL_CORTO:
        return "PROMEDIO_FALLBACK"
    if nivel == NivelMadurez.HISTORIAL_INTERMEDIO:
        return "XGBOOST_GLOBAL"
    return "HIBRIDO_SARIMA_XGBOOST" if sarima_dinamico else "XGBOOST_GLOBAL_CON_FALLBACK_MADURO"


class PredictionService:
    def madurez(self, org_id: str, botica_id: str, producto_id: str) -> dict:
        serie = data_service.serie(org_id, botica_id, producto_id)
        semanas = int(len(serie))
        nivel = clasificar_madurez(semanas)
        sarima_dinamico = self._sarima_dinamico_disponible(botica_id, producto_id)
        return {
            "org_id": org_id,
            "botica_id": botica_id,
            "producto_id": producto_id,
            "semanas_historial": semanas,
            "nivel_madurez": nivel,
            "estrategia_disponible": estrategia_por_madurez(nivel, sarima_dinamico),
            "sarima_disponible": nivel == NivelMadurez.HISTORIAL_MADURO and sarima_dinamico,
            "xgboost_disponible": semanas >= config.min_weeks_xgboost and bool(model_service.artefacto.get("xgb_directo")),
        }

    def predecir(self, org_id: str, botica_id: str, producto_id: str, horizonte: int, demanda_manual: float | None = None) -> dict:
        serie = data_service.serie(org_id, botica_id, producto_id)
        semanas = int(len(serie))
        nivel = clasificar_madurez(semanas)
        advertencias: list[str] = []
        sarima_dinamico = self._sarima_dinamico_disponible(botica_id, producto_id)
        estrategia = estrategia_por_madurez(nivel, sarima_dinamico)

        if nivel == NivelMadurez.HISTORIAL_MADURO:
            pregeneradas = data_service.predicciones_guardadas(org_id, botica_id, producto_id)
            if pregeneradas:
                estrategia = "PREDICCION_PREGENERADA"
                return self._respuesta_desde_pregeneradas(org_id, botica_id, producto_id, nivel, semanas, estrategia, pregeneradas, horizonte, advertencias)
            advertencias.append("No hay objeto SARIMA dinámico disponible; se usa XGBoost global o fallback.")

        if semanas >= config.min_weeks_xgboost and model_service.artefacto.get("xgb_directo"):
            predicciones = self._predecir_xgboost(serie, botica_id, producto_id, horizonte)
            estrategia = "XGBOOST_GLOBAL" if nivel != NivelMadurez.HISTORIAL_MADURO else "XGBOOST_GLOBAL_CON_FALLBACK_MADURO"
        else:
            predicciones = self._predecir_fallback(org_id, serie, horizonte, demanda_manual)
            if nivel == NivelMadurez.SIN_HISTORIAL:
                advertencias.append("La organización aún no tiene historial suficiente; la estimación es inicial.")

        respuesta = {
            "org_id": org_id,
            "botica_id": botica_id,
            "producto_id": producto_id,
            "nivel_madurez": nivel,
            "estrategia_utilizada": estrategia,
            "semanas_historial": semanas,
            "modelo_version_id": model_service.modelo_version_id,
            "horizonte_semanas": horizonte,
            "predicciones": predicciones,
            "advertencias": advertencias,
        }
        data_service.guardar_predicciones(respuesta)
        return respuesta

    def predecir_botica(self, org_id: str, botica_id: str, horizonte: int, categoria: str | None, producto_id: str | None, solo_historial: bool) -> list[dict]:
        productos = data_service.productos_activos(org_id, botica_id, categoria)
        if producto_id:
            productos = [p for p in productos if p["producto_id"] == producto_id]
        respuestas = []
        for producto in productos:
            serie = data_service.serie(org_id, botica_id, producto["producto_id"])
            if solo_historial and serie.empty:
                continue
            respuestas.append(self.predecir(org_id, botica_id, producto["producto_id"], horizonte))
        return respuestas

    def predecir_organizacion(self, org_id: str, horizonte: int, categoria: str | None, solo_historial: bool, batch_size: int) -> list[dict]:
        respuestas = []
        for botica_id in data_service.boticas(org_id):
            respuestas.extend(self.predecir_botica(org_id, botica_id, horizonte, categoria, None, solo_historial))
            if len(respuestas) >= batch_size:
                continue
        return respuestas

    def _sarima_dinamico_disponible(self, botica_id: str, producto_id: str) -> bool:
        modelos = model_service.artefacto.get("modelos_sarima", {})
        clave = str((producto_id, botica_id))
        # El pickle actual guarda metadatos livianos, no objetos SARIMA ejecutables.
        return bool(modelos.get(clave) and hasattr(modelos.get(clave), "forecast"))

    def _respuesta_desde_pregeneradas(self, org_id, botica_id, producto_id, nivel, semanas, estrategia, filas, horizonte, advertencias):
        predicciones = []
        for fila in filas[:horizonte]:
            predicciones.append({
                "periodo_inicio": str(fila["periodo_inicio"]),
                "periodo_fin": str(fila["periodo_fin"]),
                "cantidad_predicha": float(fila["cantidad_predicha"]),
                "intervalo_inf": float(fila["intervalo_inf"]),
                "intervalo_sup": float(fila["intervalo_sup"]),
            })
        respuesta = {
            "org_id": org_id,
            "botica_id": botica_id,
            "producto_id": producto_id,
            "nivel_madurez": nivel,
            "estrategia_utilizada": estrategia,
            "semanas_historial": semanas,
            "modelo_version_id": model_service.modelo_version_id,
            "horizonte_semanas": horizonte,
            "predicciones": predicciones,
            "advertencias": advertencias,
        }
        data_service.guardar_predicciones(respuesta)
        return respuesta

    def _predecir_fallback(self, org_id: str, serie: pd.DataFrame, horizonte: int, demanda_manual: float | None) -> list[dict]:
        if demanda_manual is not None:
            base = float(demanda_manual)
        elif not serie.empty:
            base = float(serie["cantidad_vendida"].tail(4).mean())
        else:
            base = data_service.categoria_promedio(org_id, None)
        inicio = pd.Timestamp.today().normalize() + pd.offsets.Week(weekday=0)
        return self._predicciones_constantes(inicio, horizonte, base, base * 0.75, base * 1.25)

    def _predecir_xgboost(self, serie: pd.DataFrame, botica_id: str, producto_id: str, horizonte: int) -> list[dict]:
        artefacto = model_service.artefacto
        encoder = artefacto["encoder"]
        modelo = artefacto["xgb_directo"]
        columnas = artefacto["columnas_features"]
        hist = serie["cantidad_vendida"].astype(float).tolist()
        meta = serie.iloc[-1].to_dict()
        fecha = pd.Timestamp(serie["fecha_semana"].max()) + pd.Timedelta(weeks=1)
        predicciones = []
        for _ in range(horizonte):
            fila = self._fila_features(meta, fecha, hist)
            X = pd.DataFrame([fila])[columnas]
            categoricas = artefacto.get("columnas_categoricas", [])
            X[categoricas] = encoder.transform(X[categoricas].astype(str))
            pred = max(0.0, float(modelo.predict(X.astype(float))[0]))
            hist.append(pred)
            predicciones.append({
                "periodo_inicio": fecha.date().isoformat(),
                "periodo_fin": (fecha + timedelta(days=6)).date().isoformat(),
                "cantidad_predicha": round(pred, 2),
                "intervalo_inf": round(max(0.0, pred * 0.75), 2),
                "intervalo_sup": round(pred * 1.25, 2),
            })
            fecha = fecha + pd.Timedelta(weeks=1)
        return predicciones

    def _fila_features(self, meta: dict, fecha: pd.Timestamp, historial: list[float]) -> dict:
        def lag(n):
            return float(historial[-n]) if len(historial) >= n else 0.0
        lag_1, lag_2, lag_4 = lag(1), lag(2), lag(4)
        return {
            "producto_id": meta["producto_id"],
            "botica_id": meta["botica_id"],
            "categoria_terapeutica": meta.get("categoria_terapeutica", "SIN_CATEGORIA"),
            "anio": fecha.year,
            "mes": fecha.month,
            "trimestre": fecha.quarter,
            "semana_anio": int(fecha.isocalendar().week),
            "es_invierno": int(fecha.month in [6, 7, 8]),
            "es_verano": int(fecha.month in [12, 1, 2, 3]),
            "stock_inicio_semana": meta.get("stock_inicio_semana", 0),
            "lead_time_dias": meta.get("lead_time_dias", 7),
            "ratio_stock_minimo": meta.get("ratio_stock_minimo", 0),
            "ratio_stock_maximo": meta.get("ratio_stock_maximo", 0),
            "stock_bajo_minimo": meta.get("stock_bajo_minimo", 0),
            "sobrestock": meta.get("sobrestock", 0),
            "lag_1": lag_1,
            "lag_2": lag_2,
            "lag_4": lag_4,
            "lag_8": lag(8),
            "lag_12": lag(12),
            "rolling_mean_4": float(np.mean(historial[-4:])) if len(historial) >= 4 else float(np.mean(historial)) if historial else 0.0,
            "rolling_mean_8": float(np.mean(historial[-8:])) if len(historial) >= 8 else float(np.mean(historial)) if historial else 0.0,
            "rolling_mean_12": float(np.mean(historial[-12:])) if len(historial) >= 12 else float(np.mean(historial)) if historial else 0.0,
            "variacion_1_semana": lag_1 - lag_2,
            "variacion_4_semanas": lag_1 - lag_4,
        }

    def _predicciones_constantes(self, inicio: pd.Timestamp, horizonte: int, valor: float, inf: float, sup: float) -> list[dict]:
        return [
            {
                "periodo_inicio": (inicio + pd.Timedelta(weeks=i)).date().isoformat(),
                "periodo_fin": (inicio + pd.Timedelta(weeks=i, days=6)).date().isoformat(),
                "cantidad_predicha": round(float(valor), 2),
                "intervalo_inf": round(max(0.0, float(inf)), 2),
                "intervalo_sup": round(max(float(sup), float(valor)), 2),
            }
            for i in range(horizonte)
        ]


prediction_service = PredictionService()
