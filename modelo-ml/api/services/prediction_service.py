"""Servicio de predicción y madurez de series."""

from __future__ import annotations

import pandas as pd
import numpy as np

from ..config import config
from ..schemas import NivelMadurez
from .data_service import data_service
from .model_service import model_service
from src.pipeline import predecir_demanda


def clasificar_madurez(semanas: int) -> NivelMadurez:
    if semanas <= 3:
        return NivelMadurez.SIN_DATOS
    if semanas <= 12:
        return NivelMadurez.HISTORIAL_INICIAL
    if semanas <= 25:
        return NivelMadurez.HISTORIAL_INTERMEDIO
    if semanas <= 83:
        return NivelMadurez.PREDICCION_LIMITADA
    return NivelMadurez.MODELO_COMPLETO


def estrategia_por_madurez(nivel: NivelMadurez, sarima_dinamico: bool) -> str:
    if nivel == NivelMadurez.SIN_DATOS:
        return "SIN_PRONOSTICO_ESTADISTICO"
    if nivel == NivelMadurez.HISTORIAL_INICIAL:
        return "PROMEDIO_FALLBACK"
    if nivel == NivelMadurez.HISTORIAL_INTERMEDIO:
        return "MODELO_SIMPLE_CATEGORIA"
    if nivel == NivelMadurez.PREDICCION_LIMITADA:
        return "XGBOOST_GLOBAL_CON_FEATURES_OFICIALES"
    return "HIBRIDO_SARIMA_XGBOOST" if sarima_dinamico else "XGBOOST_GLOBAL_CON_FALLBACK_MADURO"


class PredictionService:
    def _inicio_prediccion_visible(self) -> pd.Timestamp:
        hoy = pd.Timestamp.today().normalize()
        return hoy + pd.offsets.Week(weekday=0)

    def _semanas_puente_hasta_hoy(self, serie: pd.DataFrame) -> int:
        if serie.empty:
            return 0
        ultima_semana = pd.Timestamp(serie["fecha_semana"].max()).normalize()
        inicio_visible = self._inicio_prediccion_visible()
        return max(0, int((inicio_visible - ultima_semana).days // 7) - 1)

    def _filtrar_predicciones_visibles(self, predicciones: list[dict], horizonte: int) -> list[dict]:
        inicio_visible = self._inicio_prediccion_visible().date().isoformat()
        visibles = [p for p in predicciones if str(p.get("periodo_inicio")) >= inicio_visible]
        return visibles[:horizonte]

    def _completar_horizonte_visible(self, predicciones: list[dict], horizonte: int) -> list[dict]:
        visibles = self._filtrar_predicciones_visibles(predicciones, horizonte)
        if len(visibles) >= horizonte:
            return visibles

        referencia = visibles[-1] if visibles else (predicciones[-1] if predicciones else None)
        if referencia:
            inicio = pd.Timestamp(referencia["periodo_inicio"]) + pd.Timedelta(weeks=1)
            if not visibles:
                inicio = self._inicio_prediccion_visible()
            base = float(referencia["cantidad_predicha"])
            inf = float(referencia.get("intervalo_inf") or base * 0.75)
            sup = float(referencia.get("intervalo_sup") or base * 1.25)
        else:
            inicio = self._inicio_prediccion_visible()
            base, inf, sup = 0.0, 0.0, 0.0

        faltantes = horizonte - len(visibles)
        return visibles + self._predicciones_constantes(inicio, faltantes, base, inf, sup)

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
            "sarima_disponible": nivel == NivelMadurez.MODELO_COMPLETO and sarima_dinamico,
            "xgboost_disponible": semanas >= config.min_weeks_xgboost and bool(model_service.artefacto.get("modelo_xgb_independiente")),
        }

    def predecir(self, org_id: str, botica_id: str, producto_id: str, horizonte: int, demanda_manual: float | None = None, guardar: bool = True) -> dict:
        serie = data_service.serie(org_id, botica_id, producto_id)
        semanas = int(len(serie))
        nivel = clasificar_madurez(semanas)
        advertencias: list[str] = []
        sarima_dinamico = self._sarima_dinamico_disponible(org_id, botica_id, producto_id)
        estrategia = estrategia_por_madurez(nivel, sarima_dinamico)
        orden_sarima_encontrada = self._sarima_dinamico_disponible(org_id, botica_id, producto_id)

        if nivel == NivelMadurez.MODELO_COMPLETO:
            pregeneradas = data_service.predicciones_guardadas(org_id, botica_id, producto_id)
            if pregeneradas:
                pregeneradas_visibles = self._filtrar_predicciones_visibles(pregeneradas, horizonte)
                if len(pregeneradas_visibles) >= horizonte:
                    estrategia = "PREDICCION_PREGENERADA"
                    return self._respuesta_desde_pregeneradas(org_id, botica_id, producto_id, nivel, semanas, estrategia, pregeneradas_visibles, horizonte, advertencias)
            advertencias.append("No hay objeto SARIMA dinámico disponible; se usa XGBoost global o fallback.")

        if semanas >= config.min_weeks_xgboost and model_service.artefacto.get("modelo_xgb_independiente"):
            predicciones = self._predecir_con_pipeline(org_id, botica_id, producto_id, serie, horizonte, advertencias)
            estrategia = estrategia_por_madurez(nivel, orden_sarima_encontrada)
        else:
            predicciones = self._predecir_fallback(org_id, serie, horizonte, demanda_manual)
            if nivel == NivelMadurez.SIN_DATOS:
                advertencias.append("La organización aún no tiene historial suficiente; la estimación es inicial.")

        respuesta = {
            "org_id": org_id,
            "botica_id": botica_id,
            "producto_id": producto_id,
            "nivel_madurez": nivel,
            "estrategia_utilizada": estrategia,
            "orden_sarima_encontrada": orden_sarima_encontrada,
            "semanas_historial": semanas,
            "modelo_version_id": model_service.modelo_version_id,
            "horizonte_semanas": horizonte,
            "predicciones": predicciones,
            "advertencias": advertencias,
        }
        if guardar:
            try:
                data_service.guardar_predicciones(respuesta)
            except Exception as exc:
                advertencias.append(f"No se pudo persistir predicciones ({exc.__class__.__name__}); retorno sin guardar.")
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
                "prediccion_sarima": fila.get("prediccion_sarima"),
                "prediccion_xgboost": fila.get("prediccion_xgboost"),
                "metodo_aplicado": fila.get("metodo_aplicado"),
                "alpha": fila.get("alpha"),
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
        try:
            data_service.guardar_predicciones(respuesta)
        except Exception:
            pass
        return respuesta

    def _predecir_fallback(self, org_id: str, serie: pd.DataFrame, horizonte: int, demanda_manual: float | None) -> list[dict]:
        if demanda_manual is not None:
            base = float(demanda_manual)
        elif not serie.empty:
            base = float(serie["cantidad_vendida"].tail(4).mean())
        else:
            base = data_service.categoria_promedio(org_id, None)
        inicio = self._inicio_prediccion_visible()
        return self._predicciones_constantes(inicio, horizonte, base, base * 0.75, base * 1.25)

    def _predecir_con_pipeline(self, org_id: str, botica_id: str, producto_id: str, serie: pd.DataFrame, horizonte: int, advertencias: list[str]) -> list[dict]:
        categoria = str(serie.iloc[-1].get("categoria_terapeutica", "SIN_CATEGORIA"))
        snapshot = {
            "stock_inicio_semana": float(serie.iloc[-1].get("stock_inicio_semana", 0) or 0),
            "lead_time_dias": float(serie.iloc[-1].get("lead_time_dias", 7) or 7),
            "ratio_stock_minimo": float(serie.iloc[-1].get("ratio_stock_minimo", 0) or 0),
            "ratio_stock_maximo": float(serie.iloc[-1].get("ratio_stock_maximo", 0) or 0),
        }
        horizonte_pipeline = min(12, horizonte + self._semanas_puente_hasta_hoy(serie))
        try:
            salida = predecir_demanda(
                org_id=org_id,
                botica_id=botica_id,
                producto_id=producto_id,
                horizonte=horizonte_pipeline,
                serie=serie,
                categoria=categoria,
                metadata_operativa=snapshot,
                artefacto=model_service.artefacto,
            )
        except Exception as exc:
            advertencias.append(f"No se pudo usar pipeline.predecir_demanda ({exc.__class__.__name__}); se usa fallback.")
            return self._predecir_fallback(org_id, serie, horizonte, None)
        if salida.empty:
            advertencias.append("Pipeline devolvió DataFrame vacío; se usa fallback.")
            return self._predecir_fallback(org_id, serie, horizonte, None)
        predicciones = []
        for _, fila in salida.iterrows():
            fecha_objetivo = pd.Timestamp(fila["fecha_objetivo"])
            pred_hibrida = float(fila["prediccion_hibrida"])
            predicciones.append({
                "periodo_inicio": fecha_objetivo.date().isoformat(),
                "periodo_fin": (fecha_objetivo + pd.Timedelta(days=6)).date().isoformat(),
                "cantidad_predicha": round(max(0.0, pred_hibrida), 2),
                "prediccion_sarima": round(max(0.0, float(fila["prediccion_sarima"])), 2),
                "prediccion_xgboost": round(max(0.0, float(fila["prediccion_xgboost"])), 2),
                "metodo_aplicado": str(fila.get("metodo_aplicado", "sarima")),
                "alpha": float(fila.get("alpha", 0.0)),
                "intervalo_inf": round(max(0.0, pred_hibrida * 0.75), 2),
                "intervalo_sup": round(pred_hibrida * 1.25, 2),
            })
        predicciones = self._completar_horizonte_visible(predicciones, horizonte)
        if horizonte_pipeline > horizonte:
            advertencias.append("Se omitieron semanas puente hasta la fecha actual; se muestran solo periodos posteriores a hoy.")
        return predicciones

    def _predicciones_constantes(self, inicio: pd.Timestamp, horizonte: int, valor: float, inf: float, sup: float) -> list[dict]:
        return [
            {
                "periodo_inicio": (inicio + pd.Timedelta(weeks=i)).date().isoformat(),
                "periodo_fin": (inicio + pd.Timedelta(weeks=i, days=6)).date().isoformat(),
                "cantidad_predicha": round(float(valor), 2),
                "prediccion_sarima": None,
                "prediccion_xgboost": None,
                "metodo_aplicado": "fallback",
                "alpha": 0.0,
                "intervalo_inf": round(max(0.0, float(inf)), 2),
                "intervalo_sup": round(max(float(sup), float(valor)), 2),
            }
            for i in range(horizonte)
        ]


prediction_service = PredictionService()
