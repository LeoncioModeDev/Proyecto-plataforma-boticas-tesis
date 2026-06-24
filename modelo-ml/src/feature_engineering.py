# -*- coding: utf-8 -*-
"""
Construcción de features para modelos de demanda farmacéutica.

El script transforma features_entrenamiento.csv en insumos listos para
SARIMA y XGBoost sin entrenar modelos ni modificar el dataset original.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd


RAIZ_MODELO = Path(__file__).parents[1]
DIR_DATOS = RAIZ_MODELO / "data"
DIR_MODELO = RAIZ_MODELO / "modelos" / "v1.0.0"
RUTA_ENTRADA = DIR_DATOS / "features_entrenamiento.csv"
RUTA_FEATURES_MODELADO = DIR_DATOS / "features_modelado.csv"
RUTA_SERIES_SARIMA = DIR_DATOS / "series_sarima.csv"
RUTA_REPORTE = DIR_MODELO / "feature_engineering_reporte.json"

COLUMNAS_ORIGINALES_ESPERADAS = [
    "fecha_semana",
    "org_id",
    "botica_id",
    "producto_id",
    "codigo_producto",
    "nombre_comercial",
    "categoria_terapeutica",
    "cantidad_vendida",
    "demanda_insatisfecha",
    "stockout_flag",
    "stock_inicio_semana",
    "stock_minimo",
    "stock_maximo",
    "lead_time_dias",
]

LAGS_DEMANDA = [1, 2, 4, 8, 12]
VENTANAS_MOVILES = [4, 8, 12]
LAGS_QUIEBRE = [1, 4]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("feature-engineering")


def convertir_serializable(valor):
    if isinstance(valor, dict):
        return {str(k): convertir_serializable(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [convertir_serializable(v) for v in valor]
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating,)):
        return None if np.isnan(valor) else float(valor)
    if isinstance(valor, (np.bool_,)):
        return bool(valor)
    if pd.isna(valor):
        return None
    return valor


def cargar_datos():
    df = pd.read_csv(RUTA_ENTRADA)
    columnas_faltantes = set(COLUMNAS_ORIGINALES_ESPERADAS) - set(df.columns)
    if columnas_faltantes:
        faltantes = ", ".join(sorted(columnas_faltantes))
        raise ValueError(f"Faltan columnas requeridas en features_entrenamiento.csv: {faltantes}")

    df = df[COLUMNAS_ORIGINALES_ESPERADAS].copy()
    df["fecha_semana"] = pd.to_datetime(df["fecha_semana"], errors="coerce")
    df = df.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)
    return df


def agregar_variables_calendario(df):
    df = df.copy()
    df["anio"] = df["fecha_semana"].dt.year
    df["mes"] = df["fecha_semana"].dt.month
    df["trimestre"] = df["fecha_semana"].dt.quarter
    df["semana_anio"] = df["fecha_semana"].dt.isocalendar().week.astype(int)
    df["es_invierno"] = df["mes"].isin([6, 7, 8]).astype(int)
    df["es_verano"] = df["mes"].isin([12, 1, 2, 3]).astype(int)
    return df


def agregar_variables_inventario(df):
    df = df.copy()
    df["ratio_stock_minimo"] = df["stock_inicio_semana"] / df["stock_minimo"].replace(0, np.nan)
    df["ratio_stock_maximo"] = df["stock_inicio_semana"] / df["stock_maximo"].replace(0, np.nan)
    df["stock_bajo_minimo"] = (df["stock_inicio_semana"] < df["stock_minimo"]).astype(int)
    df["sobrestock"] = (df["stock_inicio_semana"] > df["stock_maximo"]).astype(int)
    return df


def agregar_lags_demanda(df):
    df = df.copy()
    grupo = df.groupby(["producto_id", "botica_id"], sort=False)["cantidad_vendida"]
    for lag in LAGS_DEMANDA:
        df[f"lag_{lag}"] = grupo.shift(lag)
    return df


def agregar_medias_moviles(df):
    df = df.copy()
    grupo = df.groupby(["producto_id", "botica_id"], sort=False)["cantidad_vendida"]
    demanda_pasada = grupo.shift(1)
    for ventana in VENTANAS_MOVILES:
        df[f"rolling_mean_{ventana}"] = demanda_pasada.groupby(
            [df["producto_id"], df["botica_id"]], sort=False
        ).rolling(ventana).mean().reset_index(level=[0, 1], drop=True)
    return df


def agregar_tendencia_reciente(df):
    df = df.copy()
    # Tendencia reciente conocida al inicio de la semana predicha.
    df["variacion_1_semana"] = df["lag_1"] - df["lag_2"]
    df["variacion_4_semanas"] = df["lag_1"] - df["lag_4"]
    return df


def agregar_variables_quiebre(df):
    df = df.copy()
    grupo_stockout = df.groupby(["producto_id", "botica_id"], sort=False)["stockout_flag"]
    grupo_insatisfecha = df.groupby(["producto_id", "botica_id"], sort=False)["demanda_insatisfecha"]

    for lag in LAGS_QUIEBRE:
        df[f"stockout_lag_{lag}"] = grupo_stockout.shift(lag)
        df[f"demanda_insatisfecha_lag_{lag}"] = grupo_insatisfecha.shift(lag)
    return df


def construir_features(df):
    features_generadas = []
    df_features = agregar_variables_calendario(df)
    features_generadas.extend(["anio", "mes", "trimestre", "semana_anio", "es_invierno", "es_verano"])

    df_features = agregar_variables_inventario(df_features)
    features_generadas.extend(["ratio_stock_minimo", "ratio_stock_maximo", "stock_bajo_minimo", "sobrestock"])

    df_features = agregar_lags_demanda(df_features)
    features_generadas.extend([f"lag_{lag}" for lag in LAGS_DEMANDA])

    df_features = agregar_medias_moviles(df_features)
    features_generadas.extend([f"rolling_mean_{ventana}" for ventana in VENTANAS_MOVILES])

    df_features = agregar_tendencia_reciente(df_features)
    features_generadas.extend(["variacion_1_semana", "variacion_4_semanas"])

    df_features = agregar_variables_quiebre(df_features)
    for lag in LAGS_QUIEBRE:
        features_generadas.extend([f"stockout_lag_{lag}", f"demanda_insatisfecha_lag_{lag}"])

    return df_features, features_generadas


def construir_series_sarima(df):
    columnas = ["fecha_semana", "producto_id", "botica_id", "cantidad_vendida"]
    return df[columnas].sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)


def eliminar_nulos_por_lags(df_features):
    columnas_lags = (
        [f"lag_{lag}" for lag in LAGS_DEMANDA]
        + [f"rolling_mean_{ventana}" for ventana in VENTANAS_MOVILES]
        + ["variacion_1_semana", "variacion_4_semanas"]
        + [f"stockout_lag_{lag}" for lag in LAGS_QUIEBRE]
        + [f"demanda_insatisfecha_lag_{lag}" for lag in LAGS_QUIEBRE]
    )
    filas_antes = len(df_features)
    df_limpio = df_features.dropna(subset=columnas_lags).copy()
    filas_eliminadas = filas_antes - len(df_limpio)

    columnas_enteras = [f"lag_{lag}" for lag in LAGS_DEMANDA] + [f"stockout_lag_{lag}" for lag in LAGS_QUIEBRE]
    for columna in columnas_enteras:
        df_limpio[columna] = df_limpio[columna].astype(int)

    for lag in LAGS_QUIEBRE:
        df_limpio[f"demanda_insatisfecha_lag_{lag}"] = df_limpio[f"demanda_insatisfecha_lag_{lag}"].astype(int)

    return df_limpio.reset_index(drop=True), filas_eliminadas


def validar_features(df_modelado):
    assert not df_modelado.duplicated(["fecha_semana", "botica_id", "producto_id"]).any()
    assert set(df_modelado["stockout_flag"].unique()).issubset({0, 1})
    assert set(df_modelado["stockout_lag_1"].unique()).issubset({0, 1})
    assert set(df_modelado["stockout_lag_4"].unique()).issubset({0, 1})
    assert (df_modelado["cantidad_vendida"] >= 0).all()
    assert (df_modelado["demanda_insatisfecha"] >= 0).all()


def exportar_archivos(df_modelado, series_sarima, reporte):
    DIR_DATOS.mkdir(parents=True, exist_ok=True)
    DIR_MODELO.mkdir(parents=True, exist_ok=True)

    df_exportar = df_modelado.copy()
    series_exportar = series_sarima.copy()
    df_exportar["fecha_semana"] = df_exportar["fecha_semana"].dt.date.astype(str)
    series_exportar["fecha_semana"] = series_exportar["fecha_semana"].dt.date.astype(str)

    df_exportar.to_csv(RUTA_FEATURES_MODELADO, index=False, encoding="utf-8")
    series_exportar.to_csv(RUTA_SERIES_SARIMA, index=False, encoding="utf-8")

    with RUTA_REPORTE.open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(reporte), archivo, ensure_ascii=False, indent=2)


def imprimir_resumen(df_modelado, nulos_por_columna, filas_eliminadas):
    print("Resumen Feature Engineering")
    print(f"Filas: {len(df_modelado)}")
    print(f"Columnas: {len(df_modelado.columns)}")
    print(f"Filas eliminadas por lags iniciales: {filas_eliminadas}")
    print("Valores nulos por columna:")
    for columna, nulos in nulos_por_columna.items():
        print(f"- {columna}: {nulos}")
    print(f"Features XGBoost: {RUTA_FEATURES_MODELADO}")
    print(f"Series SARIMA: {RUTA_SERIES_SARIMA}")
    print(f"Reporte: {RUTA_REPORTE}")


def main():
    df = cargar_datos()
    filas_originales = len(df)
    columnas_originales = df.columns.tolist()

    series_sarima = construir_series_sarima(df)
    df_features, features_generadas = construir_features(df)
    df_modelado, filas_eliminadas = eliminar_nulos_por_lags(df_features)
    df_modelado = df_modelado.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)
    validar_features(df_modelado)

    nulos_por_columna = df_modelado.isna().sum().astype(int).to_dict()
    reporte = {
        "filas_originales": filas_originales,
        "filas_finales": len(df_modelado),
        "columnas_originales": columnas_originales,
        "columnas_finales": df_modelado.columns.tolist(),
        "features_generadas": features_generadas,
        "filas_eliminadas_por_lags": filas_eliminadas,
    }

    exportar_archivos(df_modelado, series_sarima, reporte)
    log.info("%-28s %8d filas", RUTA_FEATURES_MODELADO.name, len(df_modelado))
    log.info("%-28s %8d filas", RUTA_SERIES_SARIMA.name, len(series_sarima))
    log.info("%-28s generado", RUTA_REPORTE.name)
    imprimir_resumen(df_modelado, nulos_por_columna, filas_eliminadas)


if __name__ == "__main__":
    main()
