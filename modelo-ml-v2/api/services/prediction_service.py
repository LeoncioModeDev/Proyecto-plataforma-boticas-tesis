"""Servicio de predicción y madurez de series."""

from __future__ import annotations

import pandas as pd

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
    if semanas < config.min_weeks_hybrid:
        return NivelMadurez.PREDICCION_LIMITADA
    return NivelMadurez.MODELO_COMPLETO


def estrategia_por_madurez(
    nivel: NivelMadurez,
    sarima_disponible: bool,
) -> str:
    if nivel == NivelMadurez.SIN_DATOS:
        return "SIN_PRONOSTICO_ESTADISTICO"
    if nivel == NivelMadurez.HISTORIAL_INICIAL:
        return "PROMEDIO_FALLBACK"
    if nivel == NivelMadurez.HISTORIAL_INTERMEDIO:
        return "PROMEDIO_RECIENTE"
    if nivel == NivelMadurez.PREDICCION_LIMITADA:
        return "XGBOOST_GLOBAL_CON_FEATURES_OFICIALES"
    return (
        "HIBRIDO_SARIMA_XGBOOST_ADAPTATIVO"
        if sarima_disponible
        else "XGBOOST_GLOBAL_CON_FALLBACK_MADURO"
    )


class PredictionService:
    def _sarima_disponible(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
    ) -> bool:
        clave = "|".join([str(org_id), str(botica_id), str(producto_id)])
        return bool(
            model_service.artefacto.get("ordenes_sarima", {}).get(clave)
        )

    def _inicio_fallback(self, serie: pd.DataFrame) -> pd.Timestamp:
        if not serie.empty:
            ultima = pd.Timestamp(serie["fecha_semana"].max())
            return ultima + pd.Timedelta(weeks=1)
        hoy = pd.Timestamp.today().normalize()
        return hoy + pd.offsets.Week(weekday=0)

    def madurez(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
    ) -> dict:
        serie = data_service.serie(org_id, botica_id, producto_id)
        semanas = int(len(serie))
        nivel = clasificar_madurez(semanas)
        sarima_disponible = (
            nivel == NivelMadurez.MODELO_COMPLETO
            and self._sarima_disponible(org_id, botica_id, producto_id)
        )
        xgb_disponible = (
            semanas >= config.min_weeks_xgboost
            and bool(model_service.artefacto.get("modelo_xgb_independiente"))
        )
        return {
            "org_id": org_id,
            "botica_id": botica_id,
            "producto_id": producto_id,
            "semanas_historial": semanas,
            "nivel_madurez": nivel,
            "estrategia_disponible": estrategia_por_madurez(
                nivel, sarima_disponible
            ),
            "sarima_disponible": sarima_disponible,
            "xgboost_disponible": xgb_disponible,
        }

    def predecir(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
        horizonte: int,
        demanda_manual: float | None = None,
        guardar: bool = True,
    ) -> dict:
        serie = data_service.serie(org_id, botica_id, producto_id)
        semanas = int(len(serie))
        nivel = clasificar_madurez(semanas)
        categoria = data_service.categoria_producto(org_id, producto_id)
        sarima_disponible = (
            nivel == NivelMadurez.MODELO_COMPLETO
            and self._sarima_disponible(org_id, botica_id, producto_id)
        )
        estrategia = estrategia_por_madurez(nivel, sarima_disponible)
        advertencias: list[str] = []

        if semanas >= config.min_weeks_xgboost:
            try:
                salida = predecir_demanda(
                    org_id=org_id,
                    botica_id=botica_id,
                    producto_id=producto_id,
                    horizonte=horizonte,
                    serie=serie,
                    categoria=categoria,
                    artefacto=model_service.artefacto,
                    min_semanas_hibrido=config.min_weeks_hybrid,
                )
                predicciones = self._formatear_salida_pipeline(salida)
                metodo = (
                    str(salida["metodo_aplicado"].iloc[0])
                    if not salida.empty
                    else ""
                )
                if metodo == "xgboost_independiente":
                    estrategia = (
                        "XGBOOST_GLOBAL_CON_FEATURES_OFICIALES"
                        if nivel == NivelMadurez.PREDICCION_LIMITADA
                        else "XGBOOST_GLOBAL_CON_FALLBACK_MADURO"
                    )
                else:
                    estrategia = "HIBRIDO_SARIMA_XGBOOST_ADAPTATIVO"
            except Exception as exc:
                advertencias.append(
                    "No se pudo ejecutar el modelo oficial "
                    f"({exc.__class__.__name__}); se utiliza fallback."
                )
                predicciones = self._predecir_fallback(
                    org_id,
                    serie,
                    horizonte,
                    demanda_manual,
                    categoria,
                )
                estrategia = "FALLBACK_OPERATIVO"
        else:
            predicciones = self._predecir_fallback(
                org_id,
                serie,
                horizonte,
                demanda_manual,
                categoria,
            )
            if nivel == NivelMadurez.SIN_DATOS:
                advertencias.append(
                    "Historial insuficiente para el modelo ML oficial."
                )

        respuesta = {
            "org_id": str(org_id),
            "botica_id": str(botica_id),
            "producto_id": str(producto_id),
            "nivel_madurez": nivel,
            "estrategia_utilizada": estrategia,
            "semanas_historial": semanas,
            "modelo_version_id": model_service.modelo_version_id,
            "horizonte_semanas": int(horizonte),
            "predicciones": predicciones,
            "calidad_modelo": model_service.calidad_modelo(),
            "advertencias": advertencias,
        }

        if guardar:
            try:
                data_service.guardar_predicciones(respuesta)
            except Exception as exc:
                advertencias.append(
                    "No se pudo persistir la predicción "
                    f"({exc.__class__.__name__}); se devolvió igualmente."
                )

        return respuesta

    def _formatear_salida_pipeline(self, salida: pd.DataFrame) -> list[dict]:
        predicciones: list[dict] = []
        for _, fila in salida.iterrows():
            inicio = pd.Timestamp(fila["fecha_objetivo"])
            predicciones.append(
                {
                    "periodo_inicio": inicio.date().isoformat(),
                    "periodo_fin": (
                        inicio + pd.Timedelta(days=6)
                    ).date().isoformat(),
                    "horizonte": int(fila["horizonte"]),
                    "cantidad_predicha": round(
                        max(0.0, float(fila["cantidad_predicha"])), 2
                    ),
                    "prediccion_sarima": self._numero_o_none(
                        fila.get("prediccion_sarima")
                    ),
                    "prediccion_xgboost": self._numero_o_none(
                        fila.get("prediccion_xgboost")
                    ),
                    "metodo_aplicado": str(fila.get("metodo_aplicado")),
                    "alpha": float(fila.get("alpha", 0.0)),
                    "intervalo_inf": None,
                    "intervalo_sup": None,
                }
            )
        return predicciones

    @staticmethod
    def _numero_o_none(valor):
        if valor is None or pd.isna(valor):
            return None
        return round(max(0.0, float(valor)), 2)

    def _predecir_fallback(
        self,
        org_id: str,
        serie: pd.DataFrame,
        horizonte: int,
        demanda_manual: float | None,
        categoria: str,
    ) -> list[dict]:
        if demanda_manual is not None:
            base = float(demanda_manual)
            metodo = "demanda_inicial_manual"
        elif not serie.empty:
            base = float(serie["cantidad_vendida"].tail(4).mean())
            metodo = "promedio_4_semanas"
        else:
            base = float(data_service.categoria_promedio(org_id, categoria))
            metodo = "promedio_categoria"

        inicio = self._inicio_fallback(serie)
        return [
            {
                "periodo_inicio": (
                    inicio + pd.Timedelta(weeks=i)
                ).date().isoformat(),
                "periodo_fin": (
                    inicio + pd.Timedelta(weeks=i, days=6)
                ).date().isoformat(),
                "horizonte": i + 1,
                "cantidad_predicha": round(max(0.0, base), 2),
                "prediccion_sarima": None,
                "prediccion_xgboost": None,
                "metodo_aplicado": metodo,
                "alpha": 0.0,
                "intervalo_inf": None,
                "intervalo_sup": None,
            }
            for i in range(int(horizonte))
        ]

    def predecir_botica(
        self,
        org_id: str,
        botica_id: str,
        horizonte: int,
        categoria: str | None,
        producto_id: str | None,
        solo_historial: bool,
    ) -> list[dict]:
        productos = data_service.productos_activos(
            org_id,
            botica_id,
            categoria,
        )
        if producto_id:
            productos = [
                p
                for p in productos
                if str(p["producto_id"]) == str(producto_id)
            ]

        respuestas = []
        for producto in productos:
            serie = data_service.serie(
                org_id,
                botica_id,
                producto["producto_id"],
            )
            if solo_historial and serie.empty:
                continue
            respuestas.append(
                self.predecir(
                    org_id,
                    botica_id,
                    producto["producto_id"],
                    horizonte,
                )
            )
        return respuestas

    def predecir_organizacion(
        self,
        org_id: str,
        horizonte: int,
        categoria: str | None,
        solo_historial: bool,
        batch_size: int,
    ) -> list[dict]:
        respuestas = []
        for botica_id in data_service.boticas(org_id):
            for respuesta in self.predecir_botica(
                org_id,
                botica_id,
                horizonte,
                categoria,
                None,
                solo_historial,
            ):
                respuestas.append(respuesta)
                if len(respuestas) >= batch_size:
                    return respuestas
        return respuestas


prediction_service = PredictionService()
