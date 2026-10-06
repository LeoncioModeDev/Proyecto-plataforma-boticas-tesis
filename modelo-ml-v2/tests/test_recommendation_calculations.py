from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.services.recommendation_service import (
    calcular_metricas_operativas,
    redondear_multiplo,
    redondear_necesidad,
)


def test_reposicion_con_stock_origen_suficiente():
    metricas = calcular_metricas_operativas(
        demanda_semanal=51,
        lead_time_dias=14,
        stock={
            "stock_actual": 55,
            "stock_comprometido": 0,
            "stock_en_transito": 0,
            "stock_por_recibir": 0,
        },
        stock_seguridad=23.97,
        incluir_stock_por_recibir=False,
    )

    cantidad_sugerida = redondear_necesidad(metricas["cantidad_necesaria"])
    stock_disponible_origen = 100
    cantidad_transferible = min(metricas["cantidad_necesaria"], stock_disponible_origen)
    cantidad_final = min(cantidad_sugerida, int(stock_disponible_origen))

    assert metricas["demanda_durante_lead_time"] == 102
    assert metricas["stock_disponible"] == 55
    assert metricas["stock_considerado"] == 55
    assert metricas["stock_proyectado"] == -47
    assert metricas["cantidad_necesaria"] == 70.97
    assert cantidad_sugerida == 71
    assert cantidad_transferible == 70.97
    assert cantidad_final == 71


def test_reposicion_sin_stock_origen_mantiene_necesidad_no_aprobable():
    metricas = calcular_metricas_operativas(
        demanda_semanal=51,
        lead_time_dias=14,
        stock={
            "stock_actual": 55,
            "stock_comprometido": 0,
            "stock_en_transito": 0,
            "stock_por_recibir": 0,
        },
        stock_seguridad=23.97,
        incluir_stock_por_recibir=False,
    )

    cantidad_sugerida = redondear_necesidad(metricas["cantidad_necesaria"])
    stock_disponible_origen = 0
    cantidad_transferible = min(metricas["cantidad_necesaria"], stock_disponible_origen)
    cantidad_final = min(cantidad_sugerida, int(stock_disponible_origen))

    assert metricas["cantidad_necesaria"] == 70.97
    assert cantidad_sugerida == 71
    assert cantidad_transferible == 0
    assert cantidad_final == 0


def test_compra_calcula_necesidad_antes_de_minimo_y_multiplo():
    metricas = calcular_metricas_operativas(
        demanda_semanal=100,
        lead_time_dias=7,
        stock={
            "stock_actual": 20,
            "stock_comprometido": 0,
            "stock_en_transito": 0,
            "stock_por_recibir": 0,
        },
        stock_seguridad=10,
        incluir_stock_por_recibir=True,
    )

    cantidad_base = metricas["cantidad_necesaria"]
    cantidad_final = redondear_multiplo(max(cantidad_base, 84), 12)

    assert metricas["demanda_durante_lead_time"] == 100
    assert metricas["stock_considerado"] == 20
    assert metricas["stock_proyectado"] == -80
    assert cantidad_base == 90
    assert cantidad_final == 96
