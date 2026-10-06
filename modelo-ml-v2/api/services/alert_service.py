"""Generación de alertas ML e inventario a partir del pronóstico productivo."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

import pandas as pd

from .data_service import data_service
from .prediction_service import prediction_service
from .recommendation_service import (
    calcular_metricas_operativas,
    recommendation_service,
    redondear_necesidad,
)


class AlertService:
    TIPOS_ALERTA_DB = {
        "stockout_inminente": "riesgo_desabastecimiento",
        "compra_urgente": "riesgo_desabastecimiento",
        "reposicion_recomendada": "stock_bajo",
        "vencimiento_proximo": "vencimiento",
    }

    def evaluar_producto_botica(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
        horizonte: int = 4,
        contexto: dict[str, Any] | None = None,
    ) -> list[dict]:
        contexto = contexto or {}
        cache_stock_destino = contexto.setdefault("stock_destino", {})
        cache_stock_origen = contexto.setdefault("stock_origen", {})
        cache_proveedor = contexto.setdefault("proveedor", {})
        cache_lotes = contexto.setdefault("lotes", {})

        pred = prediction_service.predecir(
            org_id,
            botica_id,
            producto_id,
            horizonte,
            guardar=False,
        )
        clave_destino = (botica_id, producto_id)
        if clave_destino not in cache_stock_destino:
            cache_stock_destino[clave_destino] = data_service.stock(
                org_id,
                botica_id,
                producto_id,
            )
        stock = cache_stock_destino[clave_destino]

        if producto_id not in cache_proveedor:
            cache_proveedor[producto_id] = data_service.proveedor_producto(
                org_id,
                producto_id,
            )
        proveedor = cache_proveedor[producto_id]

        if clave_destino not in cache_lotes:
            cache_lotes[clave_destino] = data_service.lotes(
                org_id,
                botica_id,
                producto_id,
            )
        lotes = cache_lotes[clave_destino]

        cantidades = [
            float(p["cantidad_predicha"])
            for p in pred.get("predicciones", [])
        ]
        demanda_pronosticada = sum(cantidades)
        demanda_semanal = sum(cantidades) / max(1, len(cantidades))
        lead_time_dias = int(proveedor.get("lead_time_dias", 7))
        stock_seguridad, metodo_stock_seguridad = recommendation_service.stock_seguridad(
            org_id,
            botica_id,
            producto_id,
            lead_time_dias,
            0.90,
            stock=stock,
        )
        metricas = calcular_metricas_operativas(
            demanda_semanal,
            lead_time_dias,
            stock,
            stock_seguridad,
            incluir_stock_por_recibir=False,
        )

        stock_actual = metricas["stock_fisico"]
        stock_libre = metricas["stock_disponible"]
        stock_minimo = float(stock.get("stock_minimo", 0))
        stock_maximo = float(stock.get("stock_maximo", 0))
        stock_considerado = metricas["stock_considerado"]
        stock_proyectado = metricas["stock_proyectado"]
        cantidad_necesaria = metricas["cantidad_necesaria"]
        drogueria = contexto.get("drogueria")
        if "drogueria" not in contexto:
            drogueria = data_service.drogueria_central(org_id)
            contexto["drogueria"] = drogueria
        stock_disponible_origen = None
        cantidad_transferible = None
        if drogueria:
            if producto_id not in cache_stock_origen:
                cache_stock_origen[producto_id] = data_service.stock(
                    org_id,
                    str(drogueria["id"]),
                    producto_id,
                )
            stock_origen = cache_stock_origen[producto_id]
            stock_disponible_origen = max(
                0.0,
                float(stock_origen.get("stock_actual", 0) or 0)
                - float(stock_origen.get("stock_comprometido", 0) or 0),
            )
            cantidad_transferible = min(cantidad_necesaria, stock_disponible_origen)

        alertas: list[dict] = []

        if stock_libre <= stock_minimo:
            alertas.append(
                self._crear_alerta(
                    org_id,
                    botica_id,
                    producto_id,
                    tipo="stock_bajo",
                    urgencia="ALTA",
                    mensaje=(
                        "El stock libre está en o por debajo del stock mínimo."
                    ),
                    stock_actual=stock_libre,
                    stock_proyectado=stock_proyectado,
                    cantidad_recomendada=cantidad_necesaria,
                    metadata={
                        "estrategia": pred.get("estrategia_utilizada"),
                        "nivel_madurez": getattr(
                            pred.get("nivel_madurez"),
                            "value",
                            str(pred.get("nivel_madurez")),
                        ),
                        "stock_minimo": stock_minimo,
                        "stock_disponible": stock_libre,
                        "stock_considerado": stock_considerado,
                        "stock_seguridad": stock_seguridad,
                        "metodo_stock_seguridad": metodo_stock_seguridad,
                        "demanda_pronosticada": demanda_pronosticada,
                        "demanda_semanal": demanda_semanal,
                        "demanda_durante_lead_time": metricas["demanda_durante_lead_time"],
                        "cantidad_necesaria": cantidad_necesaria,
                        "cantidad_transferible": cantidad_transferible,
                        "stock_disponible_origen": stock_disponible_origen,
                    },
                )
            )

        if stock_proyectado <= 0:
            alertas.append(
                self._crear_alerta(
                    org_id,
                    botica_id,
                    producto_id,
                    tipo="stockout_inminente",
                    urgencia="ALTA",
                    mensaje=(
                        "El stock proyectado no cubre la demanda esperada "
                        "durante el lead time."
                    ),
                    stock_actual=stock_libre,
                    stock_proyectado=stock_proyectado,
                    cantidad_recomendada=cantidad_necesaria,
                    metadata={
                        "tipo_ml_original": "stockout_inminente",
                        "stock_disponible": stock_libre,
                        "stock_considerado": stock_considerado,
                        "stock_seguridad": stock_seguridad,
                        "metodo_stock_seguridad": metodo_stock_seguridad,
                        "demanda_pronosticada": demanda_pronosticada,
                        "demanda_semanal": demanda_semanal,
                        "demanda_durante_lead_time": metricas["demanda_durante_lead_time"],
                        "cantidad_necesaria": cantidad_necesaria,
                        "cantidad_transferible": cantidad_transferible,
                        "stock_disponible_origen": stock_disponible_origen,
                    },
                )
            )

        if stock_maximo > 0 and stock_actual > stock_maximo:
            alertas.append(
                self._crear_alerta(
                    org_id,
                    botica_id,
                    producto_id,
                    tipo="sobrestock",
                    urgencia="MEDIA",
                    mensaje="El stock disponible supera el stock máximo configurado.",
                    stock_actual=stock_actual,
                    stock_proyectado=stock_proyectado,
                    cantidad_recomendada=0.0,
                    metadata={
                        "stock_fisico": stock_actual,
                        "stock_maximo": stock_maximo,
                        "exceso_estimado": max(0.0, stock_actual - stock_maximo),
                    },
                )
            )

        if cantidad_necesaria > 0:
            tipo = (
                "compra_urgente"
                if stock_proyectado <= 0
                else "reposicion_recomendada"
            )
            urgencia = "ALTA" if stock_proyectado <= 0 else "MEDIA"
            alertas.append(
                self._crear_alerta(
                    org_id,
                    botica_id,
                    producto_id,
                    tipo=tipo,
                    urgencia=urgencia,
                    mensaje=(
                        "Se recomienda reponer inventario según la demanda "
                        "pronosticada y la posición actual."
                    ),
                    stock_actual=stock_libre,
                    stock_proyectado=stock_proyectado,
                    cantidad_recomendada=cantidad_necesaria,
                    metadata={
                        "tipo_ml_original": tipo,
                        "stock_disponible": stock_libre,
                        "stock_considerado": stock_considerado,
                        "stock_seguridad": stock_seguridad,
                        "metodo_stock_seguridad": metodo_stock_seguridad,
                        "demanda_pronosticada": demanda_pronosticada,
                        "demanda_semanal": demanda_semanal,
                        "demanda_durante_lead_time": metricas["demanda_durante_lead_time"],
                        "cantidad_necesaria": cantidad_necesaria,
                        "cantidad_transferible": cantidad_transferible,
                        "stock_disponible_origen": stock_disponible_origen,
                    },
                )
            )

        hoy = pd.Timestamp(date.today())
        for lote in lotes:
            fecha = pd.to_datetime(lote.get("fecha_vencimiento"), errors="coerce")
            cantidad = float(
                lote.get("cantidad_disponible", lote.get("cantidad", 0)) or 0
            )
            if pd.isna(fecha) or cantidad <= 0:
                continue
            dias = int((fecha - hoy).days)
            if dias < 0 or dias > 90:
                continue
            if dias <= 30:
                urgencia = "ALTA"
            elif dias <= 60:
                urgencia = "MEDIA"
            else:
                urgencia = "BAJA"
            alertas.append(
                self._crear_alerta(
                    org_id,
                    botica_id,
                    producto_id,
                    tipo="vencimiento_proximo",
                    urgencia=urgencia,
                    mensaje=(
                        f"El lote vence en {dias} días. Aplicar rotación FEFO."
                    ),
                    stock_actual=stock_libre,
                    stock_proyectado=stock_proyectado,
                    cantidad_recomendada=None,
                    fecha_vencimiento=fecha.date().isoformat(),
                    referencia_tipo="lotes",
                    referencia_id=str(lote.get("id") or lote.get("lote_id") or ""),
                    metadata={
                        "numero_lote": lote.get("numero_lote"),
                        "cantidad_lote": cantidad,
                        "dias_vencimiento": dias,
                        "criterio_rotacion": "FEFO",
                    },
                )
            )

        return alertas

    def evaluar_organizacion(
        self,
        org_id: str,
        horizonte: int = 4,
        botica_id: str | None = None,
        producto_id: str | None = None,
    ) -> dict:
        generadas = []
        errores = []
        contexto: dict[str, Any] = {"drogueria": data_service.drogueria_central(org_id)}
        pares = self._pares_evaluacion(org_id, botica_id, producto_id)
        for par_botica_id, par_producto_id in pares:
            try:
                generadas.extend(
                    self.evaluar_producto_botica(
                        org_id,
                        par_botica_id,
                        par_producto_id,
                        horizonte=horizonte,
                        contexto=contexto,
                    )
                )
            except Exception as exc:
                errores.append(
                    {
                        "botica_id": par_botica_id,
                        "producto_id": par_producto_id,
                        "error": f"{exc.__class__.__name__}: {exc}",
                    }
                )

        guardadas = data_service.guardar_alertas(generadas)
        return {
            "org_id": org_id,
            "pares_evaluados": len(pares),
            "alertas_generadas": len(generadas),
            "alertas_guardadas": len(guardadas),
            "errores": errores,
            "alertas": guardadas,
        }

    def _pares_evaluacion(
        self,
        org_id: str,
        botica_id: str | None = None,
        producto_id: str | None = None,
    ) -> list[tuple[str, str]]:
        pares: set[tuple[str, str]] = set()
        if data_service.repo.disponible:
            filtros = {"org_id": org_id}
            if botica_id:
                filtros["botica_id"] = botica_id
            if producto_id:
                filtros["producto_id"] = producto_id
            filas = data_service.repo.seleccionar_todo(
                "vw_demanda_semanal_ml",
                filtros,
                select="botica_id,producto_id",
            )
            pares = {
                (str(fila["botica_id"]), str(fila["producto_id"]))
                for fila in filas
                if fila.get("botica_id") and fila.get("producto_id")
            }

        if not pares:
            boticas = [botica_id] if botica_id else data_service.boticas(org_id)
            for actual_botica_id in boticas:
                for producto in data_service.productos_activos(
                    org_id,
                    actual_botica_id,
                ):
                    actual_producto_id = str(producto["producto_id"])
                    if producto_id and actual_producto_id != str(producto_id):
                        continue
                    pares.add((str(actual_botica_id), actual_producto_id))

        return sorted(pares)

    @staticmethod
    def _crear_alerta(
        org_id: str,
        botica_id: str,
        producto_id: str,
        tipo: str,
        urgencia: str,
        mensaje: str,
        stock_actual: float | None,
        stock_proyectado: float | None,
        cantidad_recomendada: float | None,
        fecha_vencimiento: str | None = None,
        referencia_tipo: str | None = None,
        referencia_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        condicion_hash = data_service.condicion_hash(
            org_id,
            botica_id,
            producto_id,
            tipo,
            referencia_id or "",
        )
        tipo_normalizado = AlertService.TIPOS_ALERTA_DB.get(tipo, tipo)
        return {
            "id": str(uuid.uuid4()),
            "org_id": str(org_id),
            "botica_id": str(botica_id),
            "producto_id": str(producto_id),
            "tipo": tipo_normalizado,
            "tipo_origen": "modelo",
            "urgencia": urgencia,
            "mensaje": mensaje,
            "stock_actual": (
                None if stock_actual is None else int(round(float(stock_actual)))
            ),
            "stock_proyectado": (
                None
                if stock_proyectado is None
                else round(float(stock_proyectado), 2)
            ),
            "cantidad_recomendada": (
                None
                if cantidad_recomendada is None
                else redondear_necesidad(cantidad_recomendada)
            ),
            "fecha_vencimiento": fecha_vencimiento,
            "referencia_tipo": referencia_tipo,
            "referencia_id": referencia_id,
            "metadata": metadata or {},
            "condicion_hash": condicion_hash,
            "resuelta": False,
        }


alert_service = AlertService()
