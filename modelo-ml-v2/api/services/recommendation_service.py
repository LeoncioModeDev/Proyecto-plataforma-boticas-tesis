"""Motor de recomendaciones de reposición y compra."""

from __future__ import annotations

import math
import uuid
from datetime import date, timedelta

import numpy as np

from .data_service import data_service
from .model_service import model_service
from .prediction_service import prediction_service


Z_SERVICIO = {
    0.80: 0.84,
    0.85: 1.04,
    0.90: 1.64,
    0.95: 1.96,
    0.99: 2.58,
}


def z_por_servicio(nivel: float) -> float:
    return Z_SERVICIO.get(round(nivel, 2), 1.64)


def redondear_multiplo(cantidad: float, multiplo: int) -> int:
    cantidad = max(0.0, float(cantidad))
    multiplo = max(1, int(multiplo))
    if cantidad <= 0:
        return 0
    return int(math.ceil(cantidad / multiplo) * multiplo)


def calcular_metricas_operativas(
    demanda_semanal: float,
    lead_time_dias: int,
    stock: dict,
    stock_seguridad: float,
    incluir_stock_por_recibir: bool = False,
) -> dict:
    """Calcula posición operativa con unidades consistentes.

    La necesidad se calcula contra la demanda esperada durante lead time,
    no contra la demanda completa del horizonte de predicción.
    """
    stock_fisico = float(stock.get("stock_actual", 0) or 0)
    stock_comprometido = float(stock.get("stock_comprometido", 0) or 0)
    stock_disponible = max(0.0, stock_fisico - stock_comprometido)
    stock_en_transito = float(stock.get("stock_en_transito", 0) or 0)
    stock_por_recibir = float(stock.get("stock_por_recibir", 0) or 0)
    demanda_lt = float(demanda_semanal) * max(float(lead_time_dias), 0.0) / 7.0
    stock_considerado = stock_disponible + stock_en_transito
    if incluir_stock_por_recibir:
        stock_considerado += stock_por_recibir
    stock_proyectado = stock_considerado - demanda_lt
    cantidad_necesaria = max(
        0.0,
        demanda_lt + float(stock_seguridad) - stock_considerado,
    )
    return {
        "demanda_durante_lead_time": demanda_lt,
        "stock_fisico": stock_fisico,
        "stock_comprometido": stock_comprometido,
        "stock_disponible": stock_disponible,
        "stock_en_transito": stock_en_transito,
        "stock_por_recibir": stock_por_recibir,
        "stock_considerado": stock_considerado,
        "stock_proyectado": stock_proyectado,
        "cantidad_necesaria": cantidad_necesaria,
    }


def redondear_necesidad(cantidad: float) -> int:
    cantidad = max(0.0, float(cantidad))
    return int(math.ceil(cantidad)) if cantidad > 0 else 0


class RecommendationService:
    @staticmethod
    def stock_libre(stock: dict) -> float:
        return max(
            0.0,
            float(stock.get("stock_actual", 0))
            - float(stock.get("stock_comprometido", 0)),
        )

    def stock_seguridad(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
        lead_time_dias: int,
        nivel_servicio: float,
        serie=None,
        stock: dict | None = None,
    ) -> tuple[float, str]:
        if serie is None:
            serie = data_service.serie(org_id, botica_id, producto_id)
        if stock is None:
            stock = data_service.stock(org_id, botica_id, producto_id)
        piso = float(stock.get("stock_minimo", 0))

        if len(serie) >= 4:
            valores = serie["cantidad_vendida"].astype(float).tail(13)
            desviacion = float(valores.std(ddof=0)) if len(valores) else 0.0
            if desviacion > 0:
                lead_time_semanas = max(float(lead_time_dias) / 7.0, 0.0)
                estadistico = (
                    z_por_servicio(nivel_servicio)
                    * desviacion
                    * math.sqrt(lead_time_semanas)
                )
                return max(piso, float(estadistico)), "MAX_STOCK_MINIMO_DESVIACION"

        return piso, "STOCK_MINIMO"

    def recomendar_reposicion(self, org_id: str, datos) -> dict:
        drogueria = data_service.drogueria_central(org_id)
        if not drogueria:
            raise ValueError("No existe droguería central activa para la organización.")

        pred = prediction_service.predecir(
            org_id,
            datos.botica_id,
            datos.producto_id,
            datos.horizonte_semanas,
            guardar=False,
        )
        stock_botica = data_service.stock(
            org_id,
            datos.botica_id,
            datos.producto_id,
        )
        stock_origen = data_service.stock(
            org_id,
            str(drogueria["id"]),
            datos.producto_id,
        )
        proveedor = data_service.proveedor_producto(
            org_id,
            datos.producto_id,
        )

        lead = int(proveedor.get("lead_time_dias", 7))
        cantidades = [
            float(p["cantidad_predicha"])
            for p in pred.get("predicciones", [])
        ]
        demanda_semanal = float(np.mean(cantidades)) if cantidades else 0.0
        ss, metodo = self.stock_seguridad(
            org_id,
            datos.botica_id,
            datos.producto_id,
            lead,
            datos.nivel_servicio,
        )

        metricas = calcular_metricas_operativas(
            demanda_semanal,
            lead,
            stock_botica,
            ss,
            incluir_stock_por_recibir=False,
        )

        disponible_origen = self.stock_libre(stock_origen)
        cantidad_necesaria = metricas["cantidad_necesaria"]
        cantidad_sugerida = redondear_necesidad(cantidad_necesaria)
        cantidad_transferible = min(cantidad_necesaria, disponible_origen)
        cantidad_final = min(cantidad_sugerida, int(math.floor(disponible_origen)))

        if metricas["stock_proyectado"] <= 0:
            prioridad = "ALTA"
        elif metricas["stock_proyectado"] <= ss:
            prioridad = "MEDIA"
        else:
            prioridad = "BAJA"

        modelo_id = (
            data_service.asegurar_modelo_ml()
            if data_service.repo.disponible
            else model_service.modelo_version_id
        )

        rec = {
            "recomendacion_id": str(uuid.uuid4()),
            "org_id": org_id,
            "tipo": "REPOSICION_INTERNA",
            "botica_id": datos.botica_id,
            "drogueria_id": str(drogueria["id"]),
            "drogueria_nombre": drogueria.get("nombre"),
            "producto_id": datos.producto_id,
            "cantidad_recomendada": round(cantidad_necesaria, 2),
            "cantidad_sugerida": cantidad_sugerida,
            "cantidad_base": round(cantidad_necesaria, 2),
            "cantidad_necesaria": round(cantidad_necesaria, 2),
            "cantidad_transferible": round(cantidad_transferible, 2),
            "cantidad_final": float(cantidad_final),
            "cantidad_disponible_origen": round(disponible_origen, 2),
            "stock_disponible_origen": round(disponible_origen, 2),
            "cantidad_final_transferible": float(cantidad_final),
            "stock_disponible": metricas["stock_fisico"],
            "stock_comprometido": metricas["stock_comprometido"],
            "stock_libre": round(metricas["stock_disponible"], 2),
            "stock_en_transito": metricas["stock_en_transito"],
            "stock_por_recibir": metricas["stock_por_recibir"],
            "stock_considerado": round(metricas["stock_considerado"], 2),
            "stock_proyectado": round(metricas["stock_proyectado"], 2),
            "stock_seguridad": round(ss, 2),
            "metodo_stock_seguridad": metodo,
            "demanda_semanal": round(demanda_semanal, 2),
            "demanda_pronosticada": round(sum(cantidades), 2),
            "demanda_durante_lead_time": round(metricas["demanda_durante_lead_time"], 2),
            "cantidad_minima_compra": None,
            "multiplo_empaque": None,
            "lead_time_dias": lead,
            "precio_referencial": proveedor.get("precio_referencial", 0),
            "estrategia": pred.get("estrategia_utilizada"),
            "nivel_madurez": getattr(
                pred.get("nivel_madurez"),
                "value",
                str(pred.get("nivel_madurez")),
            ),
            "fecha_sugerida": date.today().isoformat(),
            "prioridad": prioridad,
            "motivo": (
                "Reposición interna calculada con demanda durante lead time; "
                "distingue necesidad de botica y cantidad transferible desde droguería."
            ),
            "estado": "PENDIENTE",
            "modelo_version_id": modelo_id,
        }
        return data_service.guardar_recomendacion(rec)

    def recomendar_compra(self, org_id: str, datos) -> dict:
        drogueria = data_service.drogueria_central(org_id)
        if not drogueria:
            raise ValueError("No existe droguería central activa para la organización.")

        proveedor = data_service.proveedor_producto(
            org_id,
            datos.producto_id,
            datos.proveedor_id,
        )
        stock = data_service.stock(
            org_id,
            str(drogueria["id"]),
            datos.producto_id,
        )

        demandas_semanales = []
        demandas_horizonte = []
        estrategias = []
        for botica_id in data_service.boticas(org_id):
            pred = prediction_service.predecir(
                org_id,
                botica_id,
                datos.producto_id,
                datos.horizonte_semanas,
                guardar=False,
            )
            cantidades = [
                float(p["cantidad_predicha"])
                for p in pred.get("predicciones", [])
            ]
            if cantidades:
                demandas_semanales.append(float(np.mean(cantidades)))
                demandas_horizonte.append(float(np.sum(cantidades)))
                estrategias.append(pred.get("estrategia_utilizada"))

        demanda_semanal = float(np.sum(demandas_semanales)) if demandas_semanales else 0.0
        lead = int(proveedor.get("lead_time_dias", 7))
        ss = float(stock.get("stock_minimo", 0))
        metricas = calcular_metricas_operativas(
            demanda_semanal,
            lead,
            stock,
            ss,
            incluir_stock_por_recibir=True,
        )
        cantidad_base = metricas["cantidad_necesaria"]

        minimo = int(proveedor.get("cantidad_minima_compra", 1))
        multiplo = max(1, int(proveedor.get("multiplo_empaque", 1)))
        cantidad = 0
        if cantidad_base > 0:
            cantidad = redondear_multiplo(max(cantidad_base, minimo), multiplo)

        if metricas["stock_proyectado"] <= 0:
            prioridad = "ALTA"
        elif metricas["stock_proyectado"] <= ss:
            prioridad = "MEDIA"
        else:
            prioridad = "BAJA"

        modelo_id = (
            data_service.asegurar_modelo_ml()
            if data_service.repo.disponible
            else model_service.modelo_version_id
        )

        rec = {
            "recomendacion_id": str(uuid.uuid4()),
            "org_id": org_id,
            "tipo": "ORDEN_COMPRA",
            "almacen_id": str(drogueria["id"]),
            "botica_id": str(drogueria["id"]),
            "proveedor_id": proveedor.get("proveedor_id"),
            "producto_id": datos.producto_id,
            "cantidad_recomendada": float(cantidad),
            "cantidad_sugerida": float(cantidad),
            "cantidad_base": round(cantidad_base, 2),
            "cantidad_necesaria": round(cantidad_base, 2),
            "cantidad_transferible": None,
            "cantidad_final": float(cantidad),
            "cantidad_disponible_origen": None,
            "cantidad_final_transferible": None,
            "stock_disponible": metricas["stock_fisico"],
            "stock_comprometido": metricas["stock_comprometido"],
            "stock_libre": round(metricas["stock_disponible"], 2),
            "stock_en_transito": metricas["stock_en_transito"],
            "stock_por_recibir": metricas["stock_por_recibir"],
            "stock_considerado": round(metricas["stock_considerado"], 2),
            "stock_proyectado": round(metricas["stock_proyectado"], 2),
            "stock_seguridad": round(ss, 2),
            "metodo_stock_seguridad": "STOCK_MINIMO_AGREGADO",
            "demanda_semanal": round(demanda_semanal, 2),
            "demanda_pronosticada": round(float(np.sum(demandas_horizonte)), 2),
            "demanda_durante_lead_time": round(metricas["demanda_durante_lead_time"], 2),
            "cantidad_minima_compra": minimo,
            "multiplo_empaque": multiplo,
            "lead_time_dias": lead,
            "precio_referencial": proveedor.get("precio_referencial", 0),
            "estrategia": (
                "AGREGADA_POR_BOTICAS"
                if demandas_semanales
                else "SIN_BOTICAS"
            ),
            "nivel_madurez": "AGREGADA",
            "fecha_sugerida": (date.today() + timedelta(days=lead)).isoformat(),
            "prioridad": prioridad,
            "motivo": (
                "Compra sugerida por demanda agregada durante lead time; "
                "requiere aprobación antes de crear la orden."
            ),
            "estado": "PENDIENTE",
            "modelo_version_id": modelo_id,
        }
        return data_service.guardar_recomendacion(rec)

    def cambiar_estado(self, recomendacion_id: str, estado: str) -> dict | None:
        return data_service.cambiar_estado_recomendacion(
            recomendacion_id,
            estado,
        )


recommendation_service = RecommendationService()
