# -*- coding: utf-8 -*-
"""Construcción única de features históricas y futuras para demanda semanal."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd


RAIZ_MODELO = Path(__file__).resolve().parents[1]
DIR_DATOS = RAIZ_MODELO / "data"
DIR_MODELOS = RAIZ_MODELO / "modelos"
DIR_VERSION = DIR_MODELOS / "v1.0.0"
RUTA_ENTRADA = DIR_DATOS / "features_entrenamiento.csv"
RUTA_FEATURES_MODELADO = DIR_DATOS / "features_modelado.csv"
RUTA_SERIES_SARIMA = DIR_DATOS / "series_sarima.csv"
RUTA_REPORTE = DIR_VERSION / "feature_engineering_reporte.json"

FRECUENCIA = "W-MON"
CLAVES_SERIE = ["org_id", "botica_id", "producto_id"]
COLUMNAS_BASE_REQUERIDAS = ["fecha_semana", "org_id", "botica_id", "producto_id", "categoria_terapeutica", "cantidad_vendida"]
COLUMNAS_OPERATIVAS_OPCIONALES = ["stock_inicio_semana", "stock_minimo", "stock_maximo", "lead_time_dias"]
DEFAULTS_OPERATIVOS = {"stock_inicio_semana": 0.0, "stock_minimo": 0.0, "stock_maximo": 0.0, "lead_time_dias": 7.0}
LAGS = [1, 2, 4, 8, 13, 26]
VENTANAS_MEDIA = [4, 8, 13, 26]
VENTANAS_STD = [4, 13, 26]
VENTANAS_TENDENCIA = [4, 13]

COLUMNAS_FEATURES_MODELADO = [
    "fecha_semana", "org_id", "botica_id", "producto_id", "categoria_terapeutica", "cantidad_vendida",
    "stock_inicio_semana", "stock_minimo", "stock_maximo", "lead_time_dias", "ratio_stock_minimo", "ratio_stock_maximo",
    "mes", "semana_anio", "semana_sin", "semana_cos", "es_invierno", "es_verano",
    "lag_1", "lag_2", "lag_4", "lag_8", "lag_13", "lag_26",
    "rolling_mean_4", "rolling_mean_8", "rolling_mean_13", "rolling_mean_26",
    "rolling_std_4", "rolling_std_13", "rolling_std_26",
    "tendencia_4", "tendencia_13", "escala_serie", "porcentaje_ceros", "semanas_desde_ultima_venta", "coeficiente_variacion",
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("feature-engineering")


def convertir_serializable(valor):
    if isinstance(valor, dict):
        return {str(k): convertir_serializable(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [convertir_serializable(v) for v in valor]
    if isinstance(valor, Path):
        return str(valor)
    if isinstance(valor, pd.Timestamp):
        return valor.strftime("%Y-%m-%d")
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating,)):
        return None if np.isnan(valor) else float(valor)
    if isinstance(valor, (np.bool_,)):
        return bool(valor)
    if pd.isna(valor):
        return None
    return valor


def cargar_features_entrenamiento(ruta: Path = RUTA_ENTRADA) -> pd.DataFrame:
    if not ruta.exists():
        raise FileNotFoundError(f"No existe {ruta}. Ejecuta primero src/generar_dataset.py")
    df = pd.read_csv(ruta)
    return validar_columnas_base(df)


def validar_columnas_base(df: pd.DataFrame) -> pd.DataFrame:
    faltantes = sorted(set(COLUMNAS_BASE_REQUERIDAS) - set(df.columns))
    if faltantes:
        raise ValueError(f"Faltan columnas base requeridas: {faltantes}")
    df = df.copy()
    df["fecha_semana"] = pd.to_datetime(df["fecha_semana"], errors="coerce")
    if df["fecha_semana"].isna().any():
        raise ValueError("fecha_semana contiene valores inválidos")
    for columna in CLAVES_SERIE + ["categoria_terapeutica"]:
        if df[columna].isna().any():
            raise ValueError(f"{columna} contiene nulos")
        df[columna] = df[columna].astype(str)
    df["cantidad_vendida"] = pd.to_numeric(df["cantidad_vendida"], errors="coerce").fillna(0.0).clip(lower=0)
    return df


def regularizar_series_semanales(df: pd.DataFrame) -> pd.DataFrame:
    filas = []
    for clave, grupo in df.groupby(CLAVES_SERIE, sort=False):
        grupo = grupo.sort_values("fecha_semana")
        fechas = pd.date_range(grupo["fecha_semana"].min(), grupo["fecha_semana"].max(), freq=FRECUENCIA)
        base = pd.DataFrame({"fecha_semana": fechas})
        for col, val in zip(CLAVES_SERIE, clave):
            base[col] = val
        base = base.merge(grupo, on=["fecha_semana", *CLAVES_SERIE], how="left")
        base["categoria_terapeutica"] = base["categoria_terapeutica"].ffill().bfill().fillna("SIN_CATEGORIA")
        base["cantidad_vendida"] = base["cantidad_vendida"].fillna(0.0)
        for columna, default in DEFAULTS_OPERATIVOS.items():
            if columna in base.columns:
                base[columna] = pd.to_numeric(base[columna], errors="coerce").ffill().bfill().fillna(default)
        for columna in [c for c in base.columns if c not in COLUMNAS_BASE_REQUERIDAS + COLUMNAS_OPERATIVAS_OPCIONALES]:
            base[columna] = base[columna].ffill().bfill()
        filas.append(base)
    return pd.concat(filas, ignore_index=True).sort_values([*CLAVES_SERIE, "fecha_semana"]).reset_index(drop=True)


def imputar_operativas(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    df = df.copy()
    disponibles = [c for c in COLUMNAS_OPERATIVAS_OPCIONALES if c in df.columns]
    imputadas = [c for c in COLUMNAS_OPERATIVAS_OPCIONALES if c not in df.columns]
    mascara_imputada = pd.Series(False, index=df.index)
    for columna, default in DEFAULTS_OPERATIVOS.items():
        if columna not in df.columns:
            df[columna] = default
            mascara_imputada[:] = True
        else:
            antes = df[columna].isna()
            df[columna] = pd.to_numeric(df[columna], errors="coerce").fillna(default)
            mascara_imputada = mascara_imputada | antes
    reporte = {
        "columnas_operativas_disponibles": disponibles,
        "columnas_operativas_imputadas": imputadas,
        "porcentaje_filas_imputadas": round(float(mascara_imputada.mean() * 100), 4) if len(df) else 0.0,
        "advertencias": [f"{c} no existe; se usa default {DEFAULTS_OPERATIVOS[c]}" for c in imputadas],
    }
    return df, reporte


def agregar_calendario(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    semana = df["fecha_semana"].dt.isocalendar().week.astype(int)
    df["mes"] = df["fecha_semana"].dt.month.astype(int)
    df["semana_anio"] = semana
    df["semana_sin"] = np.sin(2 * np.pi * semana / 52)
    df["semana_cos"] = np.cos(2 * np.pi * semana / 52)
    df["es_invierno"] = df["mes"].isin([6, 7, 8]).astype(int)
    df["es_verano"] = df["mes"].isin([12, 1, 2, 3]).astype(int)
    return df


def tendencia_desde_historial(historial: list[float] | pd.Series, ventana: int) -> float:
    valores = list(pd.Series(historial, dtype="float64").dropna())
    if len(valores) < 2:
        return 0.0
    mitad = max(1, ventana // 2)
    recientes = valores[-mitad:]
    anteriores = valores[-ventana:-mitad] if len(valores) >= ventana else valores[:-mitad]
    if not anteriores:
        return 0.0
    return float(np.mean(recientes) - np.mean(anteriores))


def semanas_desde_ultima_venta(historial: list[float] | pd.Series) -> float:
    valores = list(pd.Series(historial, dtype="float64").fillna(0.0))
    for i, valor in enumerate(reversed(valores)):
        if valor > 0:
            return float(i)
    return float(len(valores))


def construir_features_historicas(df: pd.DataFrame) -> pd.DataFrame:
    df = regularizar_series_semanales(df)
    df, _reporte_operativas = imputar_operativas(df)
    df = agregar_calendario(df)
    df["ratio_stock_minimo"] = df["stock_inicio_semana"] / df["stock_minimo"].replace(0, np.nan)
    df["ratio_stock_maximo"] = df["stock_inicio_semana"] / df["stock_maximo"].replace(0, np.nan)
    df[["ratio_stock_minimo", "ratio_stock_maximo"]] = df[["ratio_stock_minimo", "ratio_stock_maximo"]].replace([np.inf, -np.inf], np.nan).fillna(0.0)

    grupo = df.groupby(CLAVES_SERIE, sort=False)["cantidad_vendida"]
    demanda_pasada = grupo.shift(1)
    for lag in LAGS:
        df[f"lag_{lag}"] = grupo.shift(lag)
    for ventana in VENTANAS_MEDIA:
        df[f"rolling_mean_{ventana}"] = demanda_pasada.groupby([df[c] for c in CLAVES_SERIE], sort=False).rolling(ventana, min_periods=1).mean().reset_index(level=list(range(len(CLAVES_SERIE))), drop=True)
    for ventana in VENTANAS_STD:
        df[f"rolling_std_{ventana}"] = demanda_pasada.groupby([df[c] for c in CLAVES_SERIE], sort=False).rolling(ventana, min_periods=2).std(ddof=0).reset_index(level=list(range(len(CLAVES_SERIE))), drop=True)

    for ventana in VENTANAS_TENDENCIA:
        df[f"tendencia_{ventana}"] = demanda_pasada.groupby([df[c] for c in CLAVES_SERIE], sort=False).transform(lambda s, v=ventana: s.rolling(v, min_periods=2).apply(lambda x: tendencia_desde_historial(x, v), raw=False))

    def comportamiento(grupo_serie: pd.DataFrame) -> pd.DataFrame:
        cantidades = grupo_serie["cantidad_vendida"].astype(float).tolist()
        escalas, ceros, semanas, cvs = [], [], [], []
        for i in range(len(cantidades)):
            hist = cantidades[:i]
            if not hist:
                escalas.append(1.0); ceros.append(1.0); semanas.append(0.0); cvs.append(0.0); continue
            media = float(np.mean(hist))
            escala = max(media, 1.0)
            escalas.append(escala)
            ceros.append(float(np.mean(np.asarray(hist) == 0.0)))
            semanas.append(semanas_desde_ultima_venta(hist))
            cvs.append(float(np.std(hist, ddof=0) / escala))
        grupo_serie = grupo_serie.copy()
        grupo_serie["escala_serie"] = escalas
        grupo_serie["porcentaje_ceros"] = ceros
        grupo_serie["semanas_desde_ultima_venta"] = semanas
        grupo_serie["coeficiente_variacion"] = cvs
        return grupo_serie

    df = df.groupby(CLAVES_SERIE, group_keys=False, sort=False).apply(comportamiento).reset_index(drop=True)
    for columna in COLUMNAS_FEATURES_MODELADO:
        if columna not in df.columns:
            df[columna] = 0.0
    numericas = [c for c in COLUMNAS_FEATURES_MODELADO if c not in ["fecha_semana", *CLAVES_SERIE, "categoria_terapeutica"]]
    df[numericas] = df[numericas].replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df[COLUMNAS_FEATURES_MODELADO].sort_values([*CLAVES_SERIE, "fecha_semana"]).reset_index(drop=True)


def construir_series_sarima(df: pd.DataFrame) -> pd.DataFrame:
    base = regularizar_series_semanales(df)
    columnas = ["fecha_semana", *CLAVES_SERIE, "cantidad_vendida"]
    return base[columnas].sort_values([*CLAVES_SERIE, "fecha_semana"]).reset_index(drop=True)


def construir_fila_horizonte(
    org_id: str,
    botica_id: str,
    producto_id: str,
    categoria_terapeutica: str,
    fecha_semana: pd.Timestamp,
    historial_demanda: list[float],
    snapshot_operativo: dict | None = None,
    horizonte: int | None = None,
    pred_sarima: float | None = None,
) -> dict:
    snapshot = {**DEFAULTS_OPERATIVOS, **(snapshot_operativo or {})}
    fecha_semana = pd.Timestamp(fecha_semana)
    semana = int(fecha_semana.isocalendar().week)
    hist = [float(x) for x in historial_demanda]

    def lag(n: int) -> float:
        return float(hist[-n]) if len(hist) >= n else 0.0

    def media(n: int) -> float:
        return float(np.mean(hist[-n:])) if hist else 0.0

    def std(n: int) -> float:
        return float(np.std(hist[-n:], ddof=0)) if len(hist) >= 2 else 0.0

    stock_min = float(snapshot.get("stock_minimo", 0.0) or 0.0)
    stock_max = float(snapshot.get("stock_maximo", 0.0) or 0.0)
    stock_ini = float(snapshot.get("stock_inicio_semana", 0.0) or 0.0)
    escala = max(float(np.mean(hist)) if hist else 0.0, 1.0)
    pred_sarima_val = float(pred_sarima or 0.0)
    lag1 = lag(1)
    media4 = media(4)
    fila = {
        "fecha_semana": fecha_semana,
        "org_id": str(org_id),
        "botica_id": str(botica_id),
        "producto_id": str(producto_id),
        "categoria_terapeutica": str(categoria_terapeutica),
        "cantidad_vendida": 0.0,
        "stock_inicio_semana": stock_ini,
        "stock_minimo": stock_min,
        "stock_maximo": stock_max,
        "lead_time_dias": float(snapshot.get("lead_time_dias", 7.0) or 7.0),
        "ratio_stock_minimo": stock_ini / stock_min if stock_min else 0.0,
        "ratio_stock_maximo": stock_ini / stock_max if stock_max else 0.0,
        "mes": int(fecha_semana.month),
        "semana_anio": semana,
        "semana_sin": float(np.sin(2 * np.pi * semana / 52)),
        "semana_cos": float(np.cos(2 * np.pi * semana / 52)),
        "es_invierno": int(fecha_semana.month in [6, 7, 8]),
        "es_verano": int(fecha_semana.month in [12, 1, 2, 3]),
        "lag_1": lag1,
        "lag_2": lag(2),
        "lag_4": lag(4),
        "lag_8": lag(8),
        "lag_13": lag(13),
        "lag_26": lag(26),
        "rolling_mean_4": media4,
        "rolling_mean_8": media(8),
        "rolling_mean_13": media(13),
        "rolling_mean_26": media(26),
        "rolling_std_4": std(4),
        "rolling_std_13": std(13),
        "rolling_std_26": std(26),
        "tendencia_4": tendencia_desde_historial(hist, 4),
        "tendencia_13": tendencia_desde_historial(hist, 13),
        "escala_serie": escala,
        "porcentaje_ceros": float(np.mean(np.asarray(hist) == 0.0)) if hist else 1.0,
        "semanas_desde_ultima_venta": semanas_desde_ultima_venta(hist),
        "coeficiente_variacion": float(np.std(hist, ddof=0) / escala) if hist else 0.0,
    }
    if horizonte is not None:
        fila.update({"horizonte": int(horizonte), "pred_sarima": pred_sarima_val, "log_pred_sarima": float(np.log1p(max(pred_sarima_val, 0.0))), "ratio_lag1_sarima": lag1 / max(pred_sarima_val, 1.0), "ratio_media4_sarima": media4 / max(pred_sarima_val, 1.0)})
    return fila


def construir_features_futuras(
    org_id: str,
    botica_id: str,
    producto_id: str,
    categoria_terapeutica: str,
    historial_demanda: list[float],
    fechas_futuras: list[pd.Timestamp],
    predicciones_sarima: list[float],
    snapshot_operativo: dict | None = None,
) -> pd.DataFrame:
    historial = [float(x) for x in historial_demanda]
    filas = []
    for h, fecha in enumerate(fechas_futuras, start=1):
        pred_sarima = float(predicciones_sarima[h - 1]) if len(predicciones_sarima) >= h else media_fallback(historial)
        fila = construir_fila_horizonte(org_id, botica_id, producto_id, categoria_terapeutica, fecha, historial, snapshot_operativo, h, pred_sarima)
        filas.append(fila)
    return pd.DataFrame(filas)


def media_fallback(historial: list[float]) -> float:
    return float(np.mean(historial[-4:])) if historial else 0.0


def guardar_datasets_modelado(df_modelado: pd.DataFrame, series_sarima: pd.DataFrame, reporte: dict, dir_datos: Path = DIR_DATOS) -> None:
    dir_datos.mkdir(parents=True, exist_ok=True)
    DIR_VERSION.mkdir(parents=True, exist_ok=True)
    salida_features = df_modelado.copy()
    salida_series = series_sarima.copy()
    salida_features["fecha_semana"] = pd.to_datetime(salida_features["fecha_semana"]).dt.date.astype(str)
    salida_series["fecha_semana"] = pd.to_datetime(salida_series["fecha_semana"]).dt.date.astype(str)
    salida_features.to_csv(dir_datos / "features_modelado.csv", index=False, encoding="utf-8")
    salida_series.to_csv(dir_datos / "series_sarima.csv", index=False, encoding="utf-8")
    with RUTA_REPORTE.open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(reporte), archivo, ensure_ascii=False, indent=2)


def ejecutar(ruta_entrada: Path = RUTA_ENTRADA, dir_datos: Path = DIR_DATOS) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = cargar_features_entrenamiento(ruta_entrada)
    df_regular = regularizar_series_semanales(df)
    df_imputado, reporte_operativas = imputar_operativas(df_regular)
    features = construir_features_historicas(df_imputado)
    series = construir_series_sarima(df_regular)
    reporte = {
        "filas_entrada": len(df),
        "filas_features_modelado": len(features),
        "series": int(features.groupby(CLAVES_SERIE).ngroups),
        "columnas_features_modelado": COLUMNAS_FEATURES_MODELADO,
        **reporte_operativas,
    }
    guardar_datasets_modelado(features, series, reporte, dir_datos)
    log.info("features_modelado.csv generado: %d filas", len(features))
    log.info("series_sarima.csv generado: %d filas", len(series))
    return features, series


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Construye features_modelado.csv y series_sarima.csv")
    parser.add_argument("--input", type=Path, default=RUTA_ENTRADA)
    parser.add_argument("--output-dir", type=Path, default=DIR_DATOS)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    ejecutar(args.input, args.output_dir)


if __name__ == "__main__":
    main()
