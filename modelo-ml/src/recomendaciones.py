# -*- coding: utf-8 -*-
"""Reglas operativas de alertas y reposición.

Este módulo no entrena modelos. Consume predicciones, stock, lotes y
condiciones comerciales para calcular alertas/recomendaciones.
"""

from __future__ import annotations

import math
from datetime import date

import numpy as np
import pandas as pd


def calcular_stock_seguridad(desviacion_demanda, lead_time_dias, factor_seguridad=1.64):
    lead_time_semanas = max(float(lead_time_dias) / 7.0, 0.0)
    return max(0.0, float(factor_seguridad) * float(desviacion_demanda) * math.sqrt(lead_time_semanas))


def calcular_reposicion(
    demanda_horizonte,
    demanda_semanal_pronosticada,
    stock_actual,
    lead_time_dias,
    desviacion_demanda,
    pedidos_pendientes=0.0,
    factor_seguridad=1.64,
):
    demanda_durante_lead_time = float(demanda_semanal_pronosticada) * float(lead_time_dias) / 7.0
    stock_proyectado = float(stock_actual) - demanda_durante_lead_time
    stock_seguridad = calcular_stock_seguridad(desviacion_demanda, lead_time_dias, factor_seguridad)
    cantidad_recomendada = max(
        0.0,
        float(demanda_horizonte) + stock_seguridad - float(stock_actual) - float(pedidos_pendientes),
    )
    return {
        "demanda_durante_lead_time": demanda_durante_lead_time,
        "stock_proyectado": stock_proyectado,
        "stock_seguridad": stock_seguridad,
        "cantidad_recomendada": cantidad_recomendada,
        "nivel_urgencia": nivel_urgencia(stock_proyectado, stock_seguridad, cantidad_recomendada),
    }


def nivel_urgencia(stock_proyectado, stock_seguridad, cantidad_recomendada):
    if cantidad_recomendada <= 0:
        return "BAJA"
    if stock_proyectado <= 0:
        return "ALTA"
    if stock_proyectado <= stock_seguridad:
        return "MEDIA"
    return "BAJA"


def generar_alertas_inventario(
    predicciones_demanda,
    stock_actual,
    stock_minimo,
    stock_maximo,
    lotes=None,
    lead_time_dias=7,
    desviacion_demanda=0.0,
    factor_seguridad=1.64,
):
    pred = pd.DataFrame(predicciones_demanda)
    demanda_horizonte = float(pred.get("prediccion_hibrida", pd.Series(dtype=float)).sum()) if not pred.empty else 0.0
    demanda_semanal = demanda_horizonte / max(1, len(pred)) if not pred.empty else 0.0
    reposicion = calcular_reposicion(
        demanda_horizonte=demanda_horizonte,
        demanda_semanal_pronosticada=demanda_semanal,
        stock_actual=stock_actual,
        lead_time_dias=lead_time_dias,
        desviacion_demanda=desviacion_demanda,
        factor_seguridad=factor_seguridad,
    )

    alertas = []
    if float(stock_actual) <= float(stock_minimo):
        alertas.append({"tipo_alerta": "stock_bajo", "nivel_urgencia": "ALTA", **reposicion})
    if reposicion["stock_proyectado"] <= 0:
        alertas.append({"tipo_alerta": "stockout_inminente", "nivel_urgencia": "ALTA", **reposicion})
    if float(stock_maximo) > 0 and float(stock_actual) > float(stock_maximo):
        alertas.append({"tipo_alerta": "sobrestock", "nivel_urgencia": "MEDIA", **reposicion})
    if reposicion["cantidad_recomendada"] > 0:
        tipo = "compra_urgente" if reposicion["nivel_urgencia"] == "ALTA" else "reposicion_recomendada"
        alertas.append({"tipo_alerta": tipo, **reposicion})

    alertas.extend(generar_alertas_vencimiento(lotes or []))
    return alertas


def generar_alertas_vencimiento(lotes):
    hoy = pd.Timestamp(date.today())
    df = pd.DataFrame(lotes)
    if df.empty or "fecha_vencimiento" not in df.columns:
        return []
    df = df.copy()
    df["fecha_vencimiento"] = pd.to_datetime(df["fecha_vencimiento"], errors="coerce")
    df = df.sort_values("fecha_vencimiento")
    alertas = []
    for _, lote in df.iterrows():
        cantidad = float(lote.get("cantidad_disponible", lote.get("cantidad", 0)) or 0)
        if cantidad <= 0 or pd.isna(lote["fecha_vencimiento"]):
            continue
        dias = int((lote["fecha_vencimiento"] - hoy).days)
        umbral = next((u for u in [30, 60, 90] if dias <= u), None)
        if umbral is None:
            continue
        alertas.append({
            "tipo_alerta": "vencimiento_proximo",
            "nivel_urgencia": "ALTA" if umbral == 30 else "MEDIA" if umbral == 60 else "BAJA",
            "lote_id": lote.get("lote_id", lote.get("id")),
            "fecha_vencimiento": lote["fecha_vencimiento"].date().isoformat(),
            "dias_vencimiento": dias,
            "criterio_rotacion": "FEFO",
        })
    return alertas
