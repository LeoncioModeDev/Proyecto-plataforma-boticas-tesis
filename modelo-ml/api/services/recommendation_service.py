"""Motor de recomendaciones de reposición y compra."""

from __future__ import annotations

import math
import uuid
from datetime import date, timedelta

import numpy as np

from .data_service import data_service
from .model_service import model_service
from .prediction_service import prediction_service


Z_SERVICIO = {0.80: 0.84, 0.85: 1.04, 0.90: 1.64, 0.95: 1.96, 0.99: 2.58}


def z_por_servicio(nivel: float) -> float:
    return Z_SERVICIO.get(round(nivel, 2), 1.64)


class RecommendationService:
    def posicion_inventario(self, stock: dict) -> float:
        return float(stock["stock_actual"] + stock["stock_en_transito"] + stock["stock_por_recibir"] - stock["stock_comprometido"])

    def stock_seguridad(self, org_id: str, botica_id: str, producto_id: str, lead_time_dias: int, nivel_servicio: float) -> tuple[float, str]:
        serie = data_service.serie(org_id, botica_id, producto_id)
        if len(serie) >= 4 and serie["cantidad_vendida"].std() > 0:
            lead_time_semanas = max(1, lead_time_dias / 7)
            return float(z_por_servicio(nivel_servicio) * serie["cantidad_vendida"].std() * math.sqrt(lead_time_semanas)), "DESVIACION_HISTORICA"
        stock = data_service.stock(org_id, botica_id, producto_id)
        return float(stock["stock_minimo"]), "STOCK_MINIMO"

    def recomendar_reposicion(self, org_id: str, datos) -> dict:
        pred = prediction_service.predecir(org_id, datos.botica_id, datos.producto_id, datos.horizonte_semanas)
        stock_botica = data_service.stock(org_id, datos.botica_id, datos.producto_id)
        stock_origen = data_service.stock(org_id, datos.drogueria_id, datos.producto_id)
        lead = data_service.proveedor_producto(org_id, datos.producto_id)["lead_time_dias"]
        demanda_semanal = sum(p["cantidad_predicha"] for p in pred["predicciones"]) / max(1, datos.horizonte_semanas)
        demanda_lt = demanda_semanal * max(1, lead / 7)
        ss, metodo = self.stock_seguridad(org_id, datos.botica_id, datos.producto_id, lead, datos.nivel_servicio)
        posicion = self.posicion_inventario(stock_botica)
        cantidad = max(0.0, demanda_lt + ss - posicion)
        disponible_origen = max(0.0, stock_origen["stock_actual"])
        final = min(cantidad, disponible_origen)
        rec = {
            "recomendacion_id": str(uuid.uuid4()),
            "org_id": org_id,
            "tipo": "REPOSICION_INTERNA",
            "producto_id": datos.producto_id,
            "cantidad_recomendada": round(cantidad, 2),
            "cantidad_disponible_origen": round(disponible_origen, 2),
            "cantidad_final_transferible": round(final, 2),
            "stock_disponible": stock_botica["stock_actual"],
            "stock_en_transito": stock_botica["stock_en_transito"],
            "stock_por_recibir": stock_botica["stock_por_recibir"],
            "stock_comprometido": stock_botica["stock_comprometido"],
            "stock_seguridad": round(ss, 2),
            "metodo_stock_seguridad": metodo,
            "demanda_durante_lead_time": round(demanda_lt, 2),
            "fecha_sugerida": date.today().isoformat(),
            "prioridad": "ALTA" if cantidad > stock_botica["stock_minimo"] else "MEDIA",
            "motivo": "Reposición interna calculada con demanda esperada, stock de seguridad y posición de inventario.",
            "estado": "PENDIENTE",
            "modelo_version_id": model_service.modelo_version_id,
        }
        return data_service.guardar_recomendacion(rec)

    def recomendar_compra(self, org_id: str, datos) -> dict:
        proveedor = data_service.proveedor_producto(org_id, datos.producto_id, datos.proveedor_id)
        stock = data_service.stock(org_id, datos.almacen_id, datos.producto_id)
        demandas = []
        for botica_id in data_service.boticas(org_id):
            pred = prediction_service.predecir(org_id, botica_id, datos.producto_id, datos.horizonte_semanas)
            demandas.append(sum(p["cantidad_predicha"] for p in pred["predicciones"]) / max(1, datos.horizonte_semanas))
        demanda_semanal = float(np.sum(demandas)) if demandas else 0.0
        lead = proveedor["lead_time_dias"]
        demanda_lt = demanda_semanal * max(1, lead / 7)
        ss = stock["stock_minimo"]
        cantidad = max(0.0, demanda_lt + ss - self.posicion_inventario(stock))
        minimo = proveedor["cantidad_minima_compra"]
        multiplo = max(1, proveedor["multiplo_empaque"])
        if cantidad > 0:
            cantidad = max(cantidad, minimo)
            cantidad = math.ceil(cantidad / multiplo) * multiplo
        rec = {
            "recomendacion_id": str(uuid.uuid4()),
            "org_id": org_id,
            "tipo": "ORDEN_COMPRA",
            "producto_id": datos.producto_id,
            "cantidad_recomendada": round(cantidad, 2),
            "cantidad_disponible_origen": None,
            "cantidad_final_transferible": None,
            "stock_disponible": stock["stock_actual"],
            "stock_en_transito": stock["stock_en_transito"],
            "stock_por_recibir": stock["stock_por_recibir"],
            "stock_comprometido": stock["stock_comprometido"],
            "stock_seguridad": round(ss, 2),
            "metodo_stock_seguridad": "STOCK_MINIMO_AGREGADO",
            "demanda_durante_lead_time": round(demanda_lt, 2),
            "fecha_sugerida": (date.today() + timedelta(days=lead)).isoformat(),
            "prioridad": "ALTA" if cantidad > minimo else "MEDIA",
            "motivo": "Compra sugerida; requiere aprobación del usuario antes de crear orden.",
            "estado": "PENDIENTE",
            "modelo_version_id": model_service.modelo_version_id,
        }
        return data_service.guardar_recomendacion(rec)

    def cambiar_estado(self, recomendacion_id: str, estado: str) -> dict | None:
        return data_service.cambiar_estado_recomendacion(recomendacion_id, estado)


recommendation_service = RecommendationService()
