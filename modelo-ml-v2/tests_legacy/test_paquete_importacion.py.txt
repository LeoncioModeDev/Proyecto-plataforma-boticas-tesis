from __future__ import annotations

import importlib.util
from pathlib import Path


RAIZ = Path(__file__).resolve().parents[1]
SCRIPT = RAIZ / "scripts" / "generar_paquete_importacion_plataforma.py"


def cargar_modulo():
    spec = importlib.util.spec_from_file_location("generar_paquete_importacion_plataforma", SCRIPT)
    modulo = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(modulo)
    return modulo


def test_paquete_importacion_valida_conteos_y_relaciones():
    modulo = cargar_modulo()
    resultado = modulo.generar(overwrite=False, validate_only=True)

    assert resultado["valido"] is True
    assert resultado["errores"] == []
    assert resultado["conteos"]["categorias_terapeuticas"] == 14
    assert resultado["conteos"]["productos"] == 30
    assert resultado["conteos"]["boticas"] == 5
    assert resultado["conteos"]["proveedores"] == 5
    assert resultado["conteos"]["proveedor_producto"] >= 30
    assert resultado["conteos"]["precios"] == 150
    assert resultado["conteos"]["stock_historico"] == 3900
    assert resultado["series"]["series"] == 150
    assert resultado["series"]["semanas"] == 123
    assert resultado["series"]["observaciones"] == 18450


def test_paquete_importacion_no_expone_uuid_ni_org_id_publico():
    modulo = cargar_modulo()
    resultado = modulo.generar(overwrite=False, validate_only=True)

    assert sum(resultado["uuid_publicos"].values()) == 0
    assert all(valor == 0 for valor in resultado["relaciones_invalidas"].values())
    assert all(valor == 0 for valor in resultado["duplicados"].values())


def test_paquete_importacion_reconstruye_demanda_y_stock_oficial():
    modulo = cargar_modulo()
    resultado = modulo.generar(overwrite=False, validate_only=True)

    assert resultado["consistencia_demanda"]["diferencia_maxima_cantidad_vendida"] == 0
    assert resultado["consistencia_demanda"]["filas_diferentes"] == 0
    assert resultado["consistencia_demanda"]["series_diferentes"] == 0
    assert resultado["consistencia_demanda"]["semanas_diferentes"] == 0
    assert all(valor == 0 for valor in resultado["consistencia_stock"].values())


def test_paquete_importacion_omite_ventas_cero():
    modulo = cargar_modulo()
    resultado = modulo.generar(overwrite=False, validate_only=True)

    assert resultado["ventas"]["filas_semana_total"] == 11700
    assert 0 < resultado["ventas"]["filas_ventas_positivas"] <= 11700
    assert resultado["ventas"]["filas_cero_omitidas"] == 11700 - resultado["ventas"]["filas_ventas_positivas"]


def test_paquete_importacion_full_reconstruye_dataset_oficial():
    modulo = cargar_modulo()
    resultado = modulo.generar(
        overwrite=False,
        validate_only=True,
        ventas_historicas="full",
        stock_historico="full",
    )

    assert resultado["valido"] is True
    assert resultado["conteos"]["stock_historico"] == 18450
    assert resultado["ventas"]["filas_semana_total"] == 18450
    assert resultado["ventas"]["filas_ventas_positivas"] == 18311
    assert resultado["ventas"]["filas_cero_omitidas"] == 139
