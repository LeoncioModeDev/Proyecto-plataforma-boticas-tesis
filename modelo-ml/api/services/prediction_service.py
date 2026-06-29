"""Servicio de predicción y madurez de series."""

from __future__ import annotations

import pandas as pd

from ..config import config
from ..schemas import NivelMadurez
from .data_service import data_service
from .model_service import model_service
from src.pipeline import predecir_demanda


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
        sarima_dinamico = self._sarima_dinamico_disponible(org_id, botica_id, producto_id)
        return {
            "org_id": org_id,
            "botica_id": botica_id,
            "producto_id": producto_id,
            "semanas_historial": semanas,
            "nivel_madurez": nivel,
            "estrategia_disponible": estrategia_por_madurez(nivel, sarima_dinamico),
            "sarima_disponible": nivel == NivelMadurez.HISTORIAL_MADURO and sarima_dinamico,
            "xgboost_disponible": semanas >= config.min_weeks_xgboost and bool(model_service.artefacto.get("modelo_xgb_independiente")),
        }

    def predecir(self, org_id: str, botica_id: str, producto_id: str, horizonte: int, demanda_manual: float | None = None) -> dict:
        serie = data_service.serie(org_id, botica_id, producto_id)
        semanas = int(len(serie))
        nivel = clasificar_madurez(semanas)
        advertencias: list[str] = []
        sarima_dinamico = self._sarima_dinamico_disponible(org_id, botica_id, producto_id)
        estrategia = estrategia_por_madurez(nivel, sarima_dinamico)

        if nivel == NivelMadurez.HISTORIAL_MADURO:
            pregeneradas = data_service.predicciones_guardadas(org_id, botica_id, producto_id)
            if pregeneradas:
                estrategia = "PREDICCION_PREGENERADA"
                return self._respuesta_desde_pregeneradas(org_id, botica_id, producto_id, nivel, semanas, estrategia, pregeneradas, horizonte, advertencias)
            advertencias.append("No hay objeto SARIMA dinámico disponible; se usa XGBoost global o fallback.")

        if semanas >= config.min_weeks_xgboost and model_service.artefacto.get("modelo_xgb_independiente"):
            predicciones = self._predecir_pipeline(org_id, botica_id, producto_id, serie, horizonte, advertencias)
            estrategia = "SARIMA_XGBOOST_HIBRIDO_ADAPTATIVO" if nivel == NivelMadurez.HISTORIAL_MADURO else "XGBOOST_GLOBAL_CON_FEATURES_OFICIALES"
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

    def _sarima_dinamico_disponible(self, org_id: str, botica_id: str, producto_id: str) -> bool:
        ordenes = model_service.artefacto.get("ordenes_sarima", {})
        return bool(ordenes.get("|".join([org_id, botica_id, producto_id])))

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

    def _predecir_pipeline(self, org_id: str, botica_id: str, producto_id: str, serie: pd.DataFrame, horizonte: int, advertencias: list[str]) -> list[dict]:
        categoria = str(serie.iloc[-1].get("categoria_terapeutica", "SIN_CATEGORIA"))
        snapshot = {
            "stock_inicio_semana": float(serie.iloc[-1].get("stock_inicio_semana", 0) or 0),
            "stock_minimo": float(serie.iloc[-1].get("stock_minimo", 0) or 0),
            "stock_maximo": float(serie.iloc[-1].get("stock_maximo", 0) or 0),
            "lead_time_dias": float(serie.iloc[-1].get("lead_time_dias", 7) or 7),
        }
        try:
            salida = predecir_demanda(org_id, botica_id, producto_id, horizonte, serie[["fecha_semana", "cantidad_vendida"]], categoria, snapshot, model_service.artefacto)
        except Exception as exc:
            advertencias.append(f"No se pudo usar el pipeline oficial ({exc.__class__.__name__}); se usa fallback.")
            return self._predecir_fallback(org_id, serie, horizonte, None)
        predicciones = []
        for _, fila in salida.iterrows():
            inicio = pd.Timestamp(fila["fecha_semana"])
            pred = float(fila["cantidad_predicha"])
            predicciones.append({
                "periodo_inicio": inicio.date().isoformat(),
                "periodo_fin": (inicio + pd.Timedelta(days=6)).date().isoformat(),
                "cantidad_predicha": round(pred, 2),
                "intervalo_inf": round(max(0.0, pred * 0.75), 2),
                "intervalo_sup": round(pred * 1.25, 2),
            })
        return predicciones

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
