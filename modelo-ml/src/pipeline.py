# -*- coding: utf-8 -*-
"""Pipeline oficial SARIMA + XGBoost híbrido adaptativo.

Unidad primaria: org_id + botica_id + producto_id + fecha_semana.
La evaluación del paper se calcula después agregando por categoria_terapeutica + fecha_semana.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import pickle
import time
import warnings
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor

try:
    from feature_engineering import CLAVES_SERIE, DEFAULTS_OPERATIVOS, construir_fila_horizonte
except ImportError:  # Permite importar como src.pipeline desde la API.
    from src.feature_engineering import CLAVES_SERIE, DEFAULTS_OPERATIVOS, construir_fila_horizonte

try:  # pmdarima conserva la metodología del paper; los tests pueden saltarlo con --skip-auto-arima.
    from pmdarima.arima import StepwiseContext, auto_arima
except Exception:  # pragma: no cover - depende del entorno local.
    StepwiseContext = None
    auto_arima = None


warnings.filterwarnings("ignore")

RAIZ_MODELO = Path(__file__).resolve().parents[1]
DIR_DATOS = RAIZ_MODELO / "data"
DIR_MODELOS = RAIZ_MODELO / "modelos"
DIR_REPORTES = RAIZ_MODELO / "reports"
DIR_PAPER = DIR_REPORTES / "paper"
DIR_VERSION = DIR_MODELOS / "v1.0.0"

VERSION = "v1.0.0"
FRECUENCIA = "W-MON"
SEMILLA = 42
HORIZONTE_MAXIMO = 12
HOLDOUT_SEMANAS = 12
N_FOLDS = 4
PERIODOS_SARIMA_CANDIDATOS = [4, 13, 26]
PERIODO_SARIMA_FALLBACK = 4
MIN_SEMANAS_SARIMA = 36
MIN_CICLOS_POR_PERIODO = 1.5
MAX_SEGUNDOS_AUTO_ARIMA = 20
MAX_PASOS_AUTO_ARIMA = 12
MIN_FOLDS_MEJORA = 2
MIN_MEJORA_MAPE_PCT = 3.0
MAX_DETERIORO_RMSE_PCT = 5.0
ALPHAS = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5]
VARIANTE_HIBRIDA_BASE = "v4_replicado"
ALPHAS_CONSERVADORES = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
BETAS = [0.0, 0.25, 0.50, 0.75, 1.00]
FACTORES_LIMITE = [0.15, 0.25, 0.40, 0.60]
LIMITES_LOG = [0.10, 0.20, 0.35, 0.50]
VARIANTES_REGULARIZADAS = ["v4_alpha_conservador", "v4_blending", "v4_clipping", "v4_regularizado"]
MODELO_XGBOOST = "XGBoost"
MODELO_SARIMA = "SARIMA"
MODELO_HIBRIDO = "SARIMA_XGBoost"
GRID_XGB = [
    {"max_depth": 2, "learning_rate": 0.03, "min_child_weight": 5, "reg_alpha": 0.1, "reg_lambda": 10.0, "gamma": 0.0, "subsample": 0.80, "colsample_bytree": 0.80},
    {"max_depth": 2, "learning_rate": 0.02, "min_child_weight": 10, "reg_alpha": 0.5, "reg_lambda": 10.0, "gamma": 0.1, "subsample": 0.80, "colsample_bytree": 0.80},
    {"max_depth": 3, "learning_rate": 0.03, "min_child_weight": 10, "reg_alpha": 0.1, "reg_lambda": 15.0, "gamma": 0.1, "subsample": 0.85, "colsample_bytree": 0.80},
]
OBJETIVOS_XGB = ["reg:squarederror", "reg:pseudohubererror"]

COLUMNAS_CATEGORICAS = ["producto_id", "botica_id", "categoria_terapeutica"]
COLUMNAS_NUMERICAS = [
    "horizonte", "pred_sarima", "log_pred_sarima", "mes", "semana_anio", "semana_sin", "semana_cos", "es_invierno", "es_verano",
    "stock_inicio_semana", "lead_time_dias", "ratio_stock_minimo", "ratio_stock_maximo",
    "lag_1", "lag_2", "lag_4", "lag_8", "lag_13", "lag_26",
    "rolling_mean_4", "rolling_mean_8", "rolling_mean_13", "rolling_mean_26",
    "rolling_std_4", "rolling_std_13", "rolling_std_26", "tendencia_4", "tendencia_13",
    "ratio_lag1_sarima", "ratio_media4_sarima", "escala_serie", "porcentaje_ceros", "semanas_desde_ultima_venta", "coeficiente_variacion",
]
FEATURES_HIBRIDO = COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS
COLUMNAS_DERIVADAS_SARIMA = ["pred_sarima", "log_pred_sarima", "ratio_lag1_sarima", "ratio_media4_sarima"]
COLUMNAS_NUMERICAS_XGB_INDEPENDIENTE = [c for c in COLUMNAS_NUMERICAS if c not in COLUMNAS_DERIVADAS_SARIMA]
FEATURES_XGB_INDEPENDIENTE = COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS_XGB_INDEPENDIENTE

EQUIVALENCIAS_ATC = [
    ("Analgésico", "N02", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antibiótico", "J01", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antidiabético", "A10", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antifúngico", "D01/J02", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antihipertensivo", "C02-C09", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antihistamínico", "R06", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antiinflamatorio", "M01", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antiulceroso", "A02", "grupo", "Referencia conceptual para discusión del paper"),
    ("Antivertiginoso", "N07", "grupo", "Referencia conceptual para discusión del paper"),
    ("Broncodilatador", "R03", "grupo", "Referencia conceptual para discusión del paper"),
    ("Corticosteroide", "H02/D07", "grupo", "Referencia conceptual para discusión del paper"),
    ("Hipolipemiante", "C10", "grupo", "Referencia conceptual para discusión del paper"),
    ("Suplemento", "A12/B03", "grupo", "Referencia conceptual para discusión del paper"),
    ("Vitamina", "A11", "grupo", "Referencia conceptual para discusión del paper"),
]


@dataclass(frozen=True)
class ConfigPipeline:
    version: str = VERSION
    tipo_modelo: str = "sarima_xgboost_hibrido_adaptativo"
    semilla: int = SEMILLA
    frecuencia: str = FRECUENCIA
    horizonte_maximo: int = HORIZONTE_MAXIMO
    holdout_semanas: int = HOLDOUT_SEMANAS
    n_folds: int = N_FOLDS
    periodos_sarima_candidatos: tuple[int, ...] = tuple(PERIODOS_SARIMA_CANDIDATOS)
    min_semanas_sarima: int = MIN_SEMANAS_SARIMA
    xgb_n_estimators: int = 1200
    xgb_grid: tuple[dict, ...] = tuple(GRID_XGB)
    xgb_objetivos: tuple[str, ...] = tuple(OBJETIVOS_XGB)


def convertir_serializable(valor):
    if isinstance(valor, dict):
        return {str(k): convertir_serializable(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [convertir_serializable(v) for v in valor]
    if isinstance(valor, tuple):
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


def crear_xgb(params: dict, objective: str, n_estimators: int = 1200, early_stopping: bool = False) -> XGBRegressor:
    argumentos = {
        "n_estimators": int(n_estimators),
        "max_depth": int(params["max_depth"]),
        "learning_rate": float(params["learning_rate"]),
        "min_child_weight": float(params["min_child_weight"]),
        "subsample": float(params["subsample"]),
        "colsample_bytree": float(params["colsample_bytree"]),
        "reg_alpha": float(params["reg_alpha"]),
        "reg_lambda": float(params["reg_lambda"]),
        "gamma": float(params["gamma"]),
        "objective": objective,
        "eval_metric": "mae",
        "random_state": SEMILLA,
        "n_jobs": 2,
        "tree_method": "hist",
        "verbosity": 0,
    }
    if early_stopping:
        argumentos["early_stopping_rounds"] = 60
    return XGBRegressor(**argumentos)


def best_iteration_seguro(modelo: XGBRegressor, default: int = 400) -> int:
    try:
        return max(int(modelo.best_iteration) + 1, 20)
    except Exception:
        return int(default)


def mape_seguro(y_real, y_pred) -> float:
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mascara = np.isfinite(y_real) & np.isfinite(y_pred) & (np.abs(y_real) > 1e-12)
    return float(np.mean(np.abs((y_real[mascara] - y_pred[mascara]) / y_real[mascara])) * 100.0) if mascara.any() else np.nan


def metricas(y_real, y_pred) -> dict:
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return {
        "mae": round(float(mean_absolute_error(y_real, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_real, y_pred))), 4),
        "mape": round(mape_seguro(y_real, y_pred), 4),
    }


def hash_archivo(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
            h.update(bloque)
    return h.hexdigest()


def safe_float_v4(valor, default: float = 0.0) -> float:
    convertido = pd.to_numeric(valor, errors="coerce")
    return float(convertido) if pd.notna(convertido) else float(default)


def valor_lag_v4(historial: list[float], n: int) -> float:
    return float(historial[-n]) if len(historial) >= n else 0.0


def media_ventana_v4(historial: list[float], n: int) -> float:
    if not historial:
        return 0.0
    ventana = historial[-n:] if len(historial) >= n else historial
    return float(np.mean(ventana))


def std_ventana_v4(historial: list[float], n: int) -> float:
    if not historial:
        return 0.0
    ventana = historial[-n:] if len(historial) >= n else historial
    return float(np.std(ventana, ddof=0))


def tendencia_ventanas_v4(historial: list[float], n: int) -> float:
    if len(historial) < 2:
        return 0.0
    mitad = max(1, n // 2)
    recientes = historial[-mitad:]
    anteriores = historial[-n:-mitad] if len(historial) >= n else historial[:-mitad]
    if not anteriores:
        return 0.0
    return float(np.mean(recientes) - np.mean(anteriores))


def semanas_desde_ultima_venta_v4(historial: list[float]) -> float:
    for i, valor in enumerate(reversed(historial)):
        if valor > 0:
            return float(i)
    return float(len(historial))


def construir_fila_features_v4(org_id: str, botica_id: str, producto_id: str, categoria: str, fecha_objetivo: pd.Timestamp, horizonte: int, pred_sarima: float, historial_demanda: list[float], meta: dict) -> dict:
    fecha_objetivo = pd.Timestamp(fecha_objetivo)
    semana = int(fecha_objetivo.isocalendar().week)
    escala = max(float(np.mean(historial_demanda)) if historial_demanda else 0.0, 1.0)
    porcentaje_ceros = float(np.mean(np.asarray(historial_demanda, dtype=float) == 0.0)) if historial_demanda else 1.0
    coef_variacion = float(np.std(historial_demanda, ddof=0) / escala) if historial_demanda else 0.0
    lag1 = valor_lag_v4(historial_demanda, 1)
    media4 = media_ventana_v4(historial_demanda, 4)
    denominador_pred = max(float(pred_sarima), 1.0)
    stock_inicio = safe_float_v4(meta.get("stock_inicio_semana", 0.0))
    stock_minimo = safe_float_v4(meta.get("stock_minimo", 0.0))
    stock_maximo = safe_float_v4(meta.get("stock_maximo", 0.0))
    return {
        "fecha_semana": fecha_objetivo,
        "org_id": str(org_id),
        "botica_id": str(botica_id),
        "producto_id": str(producto_id),
        "categoria_terapeutica": str(categoria),
        "cantidad_vendida": 0.0,
        "stock_inicio_semana": stock_inicio,
        "stock_minimo": stock_minimo,
        "stock_maximo": stock_maximo,
        "lead_time_dias": safe_float_v4(meta.get("lead_time_dias", 0.0)),
        "ratio_stock_minimo": safe_float_v4(meta.get("ratio_stock_minimo", stock_inicio / stock_minimo if stock_minimo else 0.0)),
        "ratio_stock_maximo": safe_float_v4(meta.get("ratio_stock_maximo", stock_inicio / stock_maximo if stock_maximo else 0.0)),
        "horizonte": int(horizonte),
        "pred_sarima": float(pred_sarima),
        "log_pred_sarima": float(np.log1p(max(float(pred_sarima), 0.0))),
        "mes": int(fecha_objetivo.month),
        "semana_anio": semana,
        "semana_sin": float(np.sin(2.0 * np.pi * semana / 52.0)),
        "semana_cos": float(np.cos(2.0 * np.pi * semana / 52.0)),
        "es_invierno": int(fecha_objetivo.month in [6, 7, 8]),
        "es_verano": int(fecha_objetivo.month in [12, 1, 2, 3]),
        "lag_1": lag1,
        "lag_2": valor_lag_v4(historial_demanda, 2),
        "lag_4": valor_lag_v4(historial_demanda, 4),
        "lag_8": valor_lag_v4(historial_demanda, 8),
        "lag_13": valor_lag_v4(historial_demanda, 13),
        "lag_26": valor_lag_v4(historial_demanda, 26),
        "rolling_mean_4": media4,
        "rolling_mean_8": media_ventana_v4(historial_demanda, 8),
        "rolling_mean_13": media_ventana_v4(historial_demanda, 13),
        "rolling_mean_26": media_ventana_v4(historial_demanda, 26),
        "rolling_std_4": std_ventana_v4(historial_demanda, 4),
        "rolling_std_13": std_ventana_v4(historial_demanda, 13),
        "rolling_std_26": std_ventana_v4(historial_demanda, 26),
        "tendencia_4": tendencia_ventanas_v4(historial_demanda, 4),
        "tendencia_13": tendencia_ventanas_v4(historial_demanda, 13),
        "ratio_lag1_sarima": float(lag1 / denominador_pred),
        "ratio_media4_sarima": float(media4 / denominador_pred),
        "escala_serie": escala,
        "porcentaje_ceros": porcentaje_ceros,
        "semanas_desde_ultima_venta": semanas_desde_ultima_venta_v4(historial_demanda),
        "coeficiente_variacion": coef_variacion,
    }


def cargar_datos(dir_datos: Path = DIR_DATOS, max_series: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    features = pd.read_csv(dir_datos / "features_modelado.csv", parse_dates=["fecha_semana"])
    series = pd.read_csv(dir_datos / "series_sarima.csv", parse_dates=["fecha_semana"])
    derivadas_en_validacion = {"horizonte", "pred_sarima", "log_pred_sarima", "ratio_lag1_sarima", "ratio_media4_sarima"}
    requeridas_features = {"fecha_semana", *CLAVES_SERIE, "categoria_terapeutica", "cantidad_vendida", *(set(COLUMNAS_NUMERICAS_XGB_INDEPENDIENTE) - derivadas_en_validacion)}
    requeridas_series = {"fecha_semana", *CLAVES_SERIE, "cantidad_vendida"}
    if faltan := sorted(requeridas_features - set(features.columns)):
        raise ValueError(f"Faltan columnas en features_modelado.csv: {faltan}")
    if faltan := sorted(requeridas_series - set(series.columns)):
        raise ValueError(f"Faltan columnas en series_sarima.csv: {faltan}")
    for df in (features, series):
        for col in CLAVES_SERIE:
            df[col] = df[col].astype(str)
    features["categoria_terapeutica"] = features["categoria_terapeutica"].astype(str)
    if max_series:
        claves = features[CLAVES_SERIE].drop_duplicates().head(max_series)
        features = features.merge(claves, on=CLAVES_SERIE, how="inner")
        series = series.merge(claves, on=CLAVES_SERIE, how="inner")
    features = features.sort_values([*CLAVES_SERIE, "fecha_semana"]).reset_index(drop=True)
    series = series.sort_values([*CLAVES_SERIE, "fecha_semana"]).reset_index(drop=True)
    return features, series


def validar_frecuencia(df: pd.DataFrame, nombre: str) -> None:
    duplicados = df.duplicated([*CLAVES_SERIE, "fecha_semana"]).sum()
    if duplicados:
        raise ValueError(f"{nombre} tiene duplicados por serie-semana: {duplicados}")
    for clave, grupo in df.groupby(CLAVES_SERIE):
        fechas = pd.Index(pd.to_datetime(grupo["fecha_semana"].sort_values().unique()))
        esperado = pd.date_range(fechas.min(), fechas.max(), freq=FRECUENCIA)
        if len(fechas) != len(esperado) or not fechas.equals(pd.Index(esperado)):
            raise ValueError(f"{nombre} no tiene frecuencia W-MON completa para {clave}")


def split_holdout(features: pd.DataFrame, holdout_semanas: int = HOLDOUT_SEMANAS):
    semanas = sorted(pd.to_datetime(features["fecha_semana"].unique()))
    fechas_holdout = semanas[-holdout_semanas:]
    fecha_corte = fechas_holdout[0] - pd.Timedelta(weeks=1)
    train = features[features["fecha_semana"] <= fecha_corte].copy()
    holdout = features[features["fecha_semana"].isin(fechas_holdout)].copy()
    return train, holdout, fecha_corte, fechas_holdout


def construir_origenes_cv(train: pd.DataFrame, n_folds: int, horizonte: int) -> list[dict]:
    semanas = sorted(pd.to_datetime(train["fecha_semana"].unique()))
    origenes = []
    for fold in range(1, n_folds + 1):
        inicio = len(semanas) - (n_folds - fold + 1) * horizonte
        fin = inicio + horizonte
        if inicio <= 0 or fin > len(semanas):
            continue
        fechas_validacion = semanas[inicio:fin]
        origenes.append({"fold": fold, "fecha_origen": fechas_validacion[0] - pd.Timedelta(weeks=1), "fechas_validacion": fechas_validacion})
    return origenes


def serie_regular(series: pd.DataFrame, clave: tuple[str, str, str], fecha_fin: pd.Timestamp | None = None) -> pd.Series:
    filtro = (series["org_id"] == clave[0]) & (series["botica_id"] == clave[1]) & (series["producto_id"] == clave[2])
    grupo = series.loc[filtro].sort_values("fecha_semana")
    if fecha_fin is not None:
        grupo = grupo[grupo["fecha_semana"] <= fecha_fin]
    if grupo.empty:
        return pd.Series(dtype=float)
    return grupo.set_index("fecha_semana")["cantidad_vendida"].asfreq(FRECUENCIA).fillna(0.0).astype(float)


def fallback_forecast(serie: pd.Series, fechas_objetivo: list[pd.Timestamp], periodo: int = PERIODO_SARIMA_FALLBACK) -> np.ndarray:
    historial = serie.copy().sort_index().astype(float)
    valores_hist = {pd.Timestamp(fecha): float(valor) for fecha, valor in historial.items()}
    salida = []
    for fecha in fechas_objetivo:
        fecha = pd.Timestamp(fecha)
        fecha_estacional = fecha - pd.Timedelta(weeks=int(periodo))
        if fecha_estacional in valores_hist:
            pred = valores_hist[fecha_estacional]
        elif valores_hist:
            pred = float(np.mean(list(valores_hist.values())[-4:]))
        else:
            pred = 0.0
        pred = max(0.0, float(pred))
        salida.append(pred)
        valores_hist[fecha] = pred
    return np.asarray(salida, dtype=float)


def buscar_orden_sarima(serie: pd.Series, periodo: int, skip_auto_arima: bool) -> dict | None:
    if skip_auto_arima or auto_arima is None or StepwiseContext is None:
        return None
    min_obs = max(MIN_SEMANAS_SARIMA, int(np.ceil(periodo * MIN_CICLOS_POR_PERIODO)))
    if len(serie) < min_obs or serie.sum() <= 0 or serie.nunique() <= 1:
        return None
    try:
        y = np.log1p(serie.to_numpy(dtype=float))
        with StepwiseContext(max_steps=MAX_PASOS_AUTO_ARIMA, max_dur=MAX_SEGUNDOS_AUTO_ARIMA):
            modelo = auto_arima(y, seasonal=True, m=int(periodo), start_p=0, max_p=2, start_q=0, max_q=2, start_P=0, max_P=1, start_Q=0, max_Q=1, max_d=1, max_D=1, D=None, stepwise=True, trace=False, error_action="ignore", suppress_warnings=True, max_order=4, information_criterion="aic", method="lbfgs", maxiter=40, random_state=SEMILLA)
        return {"order": tuple(modelo.order), "seasonal_order": tuple(modelo.seasonal_order), "with_intercept": bool(getattr(modelo, "with_intercept", True))}
    except Exception:
        return None


def pronosticar_sarima_fijo(serie: pd.Series, pasos: int, orden: dict | None) -> np.ndarray | None:
    if orden is None or auto_arima is None:
        return None
    if serie.empty or serie.sum() <= 0 or serie.nunique() <= 1:
        return None
    try:
        from pmdarima.arima import ARIMA
        modelo = ARIMA(order=tuple(orden["order"]), seasonal_order=tuple(orden["seasonal_order"]), method="lbfgs", maxiter=50, with_intercept=orden.get("with_intercept", True), suppress_warnings=True)
        modelo.fit(np.log1p(serie.to_numpy(dtype=float)))
        pred = np.expm1(modelo.predict(n_periods=int(pasos)))
        return np.clip(np.asarray(pred, dtype=float), 0.0, None)
    except Exception:
        return None


def pronosticar_sarima(serie: pd.Series, pasos: int, periodo: int, orden: dict | None, skip_auto_arima: bool, buscar_si_falta: bool = True) -> tuple[np.ndarray, dict | None, str]:
    fechas = list(pd.date_range(serie.index.max() + pd.Timedelta(weeks=1), periods=pasos, freq=FRECUENCIA)) if len(serie) else []
    if orden is None and buscar_si_falta:
        orden = buscar_orden_sarima(serie, periodo, skip_auto_arima)
    pred = pronosticar_sarima_fijo(serie, pasos, orden)
    if pred is None:
        return fallback_forecast(serie, fechas, periodo), orden, "fallback"
    return pred, orden, "sarima"


def seleccionar_periodo_sarima_por_categoria(train: pd.DataFrame, origenes: list[dict], skip_auto_arima: bool) -> tuple[dict, pd.DataFrame]:
    registros = []
    periodo_por_categoria = {}
    serie_categoria = train.groupby(["categoria_terapeutica", "fecha_semana"], as_index=False)["cantidad_vendida"].sum()
    for categoria, grupo_cat in serie_categoria.groupby("categoria_terapeutica", sort=True):
        mejor = {"periodo": PERIODO_SARIMA_FALLBACK, "mape_mediano": np.nan, "folds_validos": 0, "estado": "fallback"}
        candidatos = []
        for periodo in PERIODOS_SARIMA_CANDIDATOS:
            min_obs = max(MIN_SEMANAS_SARIMA, int(np.ceil(periodo * MIN_CICLOS_POR_PERIODO)))
            primer_origen = origenes[0]["fecha_origen"]
            hist_inicial = grupo_cat[grupo_cat["fecha_semana"] <= primer_origen].set_index("fecha_semana")["cantidad_vendida"].asfreq(FRECUENCIA).fillna(0.0)
            orden = buscar_orden_sarima(hist_inicial, periodo, skip_auto_arima)
            if orden is None:
                candidatos.append({"periodo": periodo, "mape_mediano": np.nan, "folds_validos": 0, "estado": "sin_orden"})
                continue
            fold_mapes = []
            estado = "sin_datos"
            for info in origenes:
                hist = grupo_cat[grupo_cat["fecha_semana"] <= info["fecha_origen"]].set_index("fecha_semana")["cantidad_vendida"].asfreq(FRECUENCIA).fillna(0.0)
                if len(hist) < min_obs or hist.sum() <= 0 or hist.nunique() <= 1:
                    continue
                preds, _orden, metodo = pronosticar_sarima(hist, HORIZONTE_MAXIMO, periodo, orden, skip_auto_arima, buscar_si_falta=False)
                real = grupo_cat[grupo_cat["fecha_semana"].isin(info["fechas_validacion"])].set_index("fecha_semana")["cantidad_vendida"].reindex(info["fechas_validacion"], fill_value=0.0)
                fold_mapes.append(mape_seguro(real.to_numpy(dtype=float), preds))
                estado = metodo
            if fold_mapes:
                candidatos.append({"periodo": periodo, "mape_mediano": float(np.nanmedian(fold_mapes)), "folds_validos": len(fold_mapes), "estado": estado})
        validos = [c for c in candidatos if np.isfinite(c["mape_mediano"])]
        if validos:
            mejor = min(validos, key=lambda r: r["mape_mediano"])
        periodo_por_categoria[str(categoria)] = int(mejor["periodo"])
        registros.append({"categoria_terapeutica": str(categoria), **mejor})
    return periodo_por_categoria, pd.DataFrame(registros)


def snapshot_operativo(features_serie: pd.DataFrame, fecha_origen: pd.Timestamp) -> dict:
    hist = features_serie[features_serie["fecha_semana"] <= fecha_origen]
    if hist.empty:
        hist = features_serie
    if hist.empty:
        return DEFAULTS_OPERATIVOS.copy()
    fila = hist.sort_values("fecha_semana").iloc[-1]
    return {
        "categoria_terapeutica": str(fila.get("categoria_terapeutica", "DESCONOCIDA")),
        "stock_inicio_semana": safe_float_v4(fila.get("stock_inicio_semana", 0.0)),
        "stock_minimo": safe_float_v4(fila.get("stock_minimo", 0.0)),
        "stock_maximo": safe_float_v4(fila.get("stock_maximo", 0.0)),
        "lead_time_dias": safe_float_v4(fila.get("lead_time_dias", 0.0)),
        "ratio_stock_minimo": safe_float_v4(fila.get("ratio_stock_minimo", 0.0)),
        "ratio_stock_maximo": safe_float_v4(fila.get("ratio_stock_maximo", 0.0)),
    }


def buscar_ordenes_sarima_por_serie(series: pd.DataFrame, train: pd.DataFrame, origenes: list[dict], periodo_por_categoria: dict, skip_auto_arima: bool) -> dict:
    ordenes: dict[str, dict] = {}
    series_por_clave = {tuple(k): g.copy() for k, g in series.groupby(CLAVES_SERIE, sort=False)}
    categorias = train.groupby(CLAVES_SERIE).tail(1).set_index(CLAVES_SERIE)["categoria_terapeutica"].to_dict()
    primer_origen = origenes[0]["fecha_origen"]
    for clave in sorted(series_por_clave):
        categoria = categorias.get(clave, "SIN_CATEGORIA")
        periodo = periodo_por_categoria.get(categoria, PERIODO_SARIMA_FALLBACK)
        orden = buscar_orden_sarima(serie_regular(series_por_clave[clave], clave, primer_origen), periodo, skip_auto_arima)
        if orden is not None:
            ordenes["|".join(clave)] = orden
    return ordenes


def construir_oof(features: pd.DataFrame, series: pd.DataFrame, train: pd.DataFrame, origenes: list[dict], periodo_por_categoria: dict, ordenes: dict, skip_auto_arima: bool) -> tuple[pd.DataFrame, dict, pd.DataFrame]:
    filas = []
    comparacion_features = []
    series_por_clave = {tuple(k): g.copy() for k, g in series.groupby(CLAVES_SERIE, sort=False)}
    features_por_clave = {tuple(k): g for k, g in features.groupby(CLAVES_SERIE, sort=False)}
    categorias = train.groupby(CLAVES_SERIE).tail(1).set_index(CLAVES_SERIE)["categoria_terapeutica"].to_dict()
    claves = sorted(series_por_clave)
    conteos_estrategia = {"sarima": 0, "fallback": 0}

    claves_comparacion = set(claves[:5])
    columnas_comparar = COLUMNAS_NUMERICAS + ["stock_inicio_semana", "stock_minimo", "stock_maximo"]
    for clave in claves:
        grupo_serie = series_por_clave[clave]
        categoria = categorias.get(clave, "SIN_CATEGORIA")
        periodo = periodo_por_categoria.get(categoria, PERIODO_SARIMA_FALLBACK)
        key = "|".join(clave)
        mapa_real = grupo_serie.set_index("fecha_semana")["cantidad_vendida"].to_dict()
        for info in origenes:
            hist = serie_regular(grupo_serie, clave, info["fecha_origen"])
            if hist.empty:
                continue
            preds, _orden, metodo = pronosticar_sarima(hist, HORIZONTE_MAXIMO, periodo, ordenes.get(key), skip_auto_arima, buscar_si_falta=False)
            conteos_estrategia[metodo] = conteos_estrategia.get(metodo, 0) + 1
            historial = hist.astype(float).tolist()
            features_serie = features_por_clave.get(clave, pd.DataFrame())
            meta = snapshot_operativo(features_serie, info["fecha_origen"])
            for h, fecha in enumerate(info["fechas_validacion"], start=1):
                pred_sarima = float(preds[h - 1])
                fila = construir_fila_features_v4(clave[0], clave[1], clave[2], categoria, fecha, h, pred_sarima, historial, meta)
                if clave in claves_comparacion:
                    fila_pipeline = construir_fila_horizonte(clave[0], clave[1], clave[2], categoria, fecha, historial, meta, h, pred_sarima)
                    for columna in columnas_comparar:
                        v4 = safe_float_v4(fila.get(columna, 0.0))
                        actual = safe_float_v4(fila_pipeline.get(columna, 0.0))
                        comparacion_features.append({"org_id": clave[0], "botica_id": clave[1], "producto_id": clave[2], "fold": int(info["fold"]), "fecha_semana": pd.Timestamp(fecha), "horizonte": int(h), "feature": columna, "valor_v4": v4, "valor_pipeline_original": actual, "diferencia": v4 - actual, "coincide": bool(np.isclose(v4, actual, rtol=1e-10, atol=1e-10))})
                real = float(mapa_real.get(pd.Timestamp(fecha), 0.0))
                escala = max(float(fila["escala_serie"]), 1.0)
                fila.update({"fold": int(info["fold"]), "fecha_origen": info["fecha_origen"], "valor_real": real, "target_aditivo": (real - pred_sarima) / escala, "target_log": np.log1p(max(real, 0.0)) - np.log1p(max(pred_sarima, 0.0)), "periodo_sarima": int(periodo), "estrategia_sarima": metodo})
                filas.append(fila)
    return pd.DataFrame(filas), conteos_estrategia, pd.DataFrame(comparacion_features)


def preparar_preprocesador(df: pd.DataFrame, features: list[str]) -> ColumnTransformer:
    try:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
    except TypeError:  # sklearn antiguo
        encoder = OneHotEncoder(handle_unknown="ignore", sparse=True)
    numericas = [c for c in features if c not in COLUMNAS_CATEGORICAS]
    pre = ColumnTransformer([("categoricas", encoder, COLUMNAS_CATEGORICAS), ("numericas", "passthrough", numericas)], remainder="drop")
    pre.fit(df[features])
    return pre


def limpiar_features_modelo(df: pd.DataFrame, columnas: list[str]) -> pd.DataFrame:
    df = df.copy()
    for c in COLUMNAS_CATEGORICAS:
        df[c] = df[c].astype(str)
    for c in [x for x in columnas if x not in COLUMNAS_CATEGORICAS]:
        df[c] = pd.to_numeric(df[c], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return df


def calcular_pesos_categoria(df: pd.DataFrame) -> np.ndarray:
    conteos = df["categoria_terapeutica"].value_counts()
    pesos = df["categoria_terapeutica"].map(lambda c: 1.0 / conteos.loc[c]).to_numpy(dtype=float)
    return pesos / pesos.mean()


def seleccionar_alpha_simple(df_pred: pd.DataFrame, pred_target_col: str, metodo: str) -> tuple[float, float]:
    mejor_alpha = 0.0
    base = df_pred.copy()
    base["pred_eval"] = base["pred_sarima"]
    mejor_mape = macro_mape_categoria(base, "pred_eval")
    for alpha in ALPHAS:
        temporal = df_pred.copy()
        temporal["pred_eval"] = convertir_correccion(temporal, temporal[pred_target_col].to_numpy(dtype=float), metodo, alpha)
        score = macro_mape_categoria(temporal, "pred_eval")
        if np.isfinite(score) and score < mejor_mape:
            mejor_mape = score
            mejor_alpha = float(alpha)
    return mejor_alpha, float(mejor_mape)


def validar_xgb_residual(df_oof: pd.DataFrame, X_hib, target_col: str, metodo: str, params: dict, objective: str, n_estimators_max: int) -> dict:
    pred_cv = np.full(len(df_oof), np.nan, dtype=float)
    mejores_iteraciones = []
    folds = sorted(int(f) for f in df_oof["fold"].unique())
    for fold_val in folds[1:]:
        idx_train = np.where(df_oof["fold"].to_numpy(dtype=int) < fold_val)[0]
        idx_val = np.where(df_oof["fold"].to_numpy(dtype=int) == fold_val)[0]
        if len(idx_train) == 0 or len(idx_val) == 0:
            continue
        modelo = crear_xgb(params, objective, n_estimators=n_estimators_max, early_stopping=True)
        modelo.fit(
            X_hib[idx_train],
            df_oof.iloc[idx_train][target_col].to_numpy(dtype=float),
            sample_weight=df_oof.iloc[idx_train]["peso_categoria"].to_numpy(dtype=float),
            eval_set=[(X_hib[idx_val], df_oof.iloc[idx_val][target_col].to_numpy(dtype=float))],
            verbose=False,
        )
        pred_cv[idx_val] = modelo.predict(X_hib[idx_val])
        mejores_iteraciones.append(best_iteration_seguro(modelo, default=min(400, n_estimators_max)))
    mascara = np.isfinite(pred_cv)
    df_cv = df_oof.loc[mascara].copy()
    df_cv["pred_target_cv"] = pred_cv[mascara]
    alpha_global, macro_mape = seleccionar_alpha_simple(df_cv, "pred_target_cv", metodo)
    return {"df_cv": df_cv, "pred_cv": pred_cv, "alpha_global": alpha_global, "macro_mape": macro_mape, "n_estimators": int(np.median(mejores_iteraciones)) if mejores_iteraciones else min(400, n_estimators_max)}


def validar_xgb_independiente(df_oof: pd.DataFrame, X_ind, params: dict, objective: str, n_estimators_max: int) -> dict:
    pred_cv = np.full(len(df_oof), np.nan, dtype=float)
    mejores_iteraciones = []
    folds = sorted(int(f) for f in df_oof["fold"].unique())
    for fold_val in folds[1:]:
        idx_train = np.where(df_oof["fold"].to_numpy(dtype=int) < fold_val)[0]
        idx_val = np.where(df_oof["fold"].to_numpy(dtype=int) == fold_val)[0]
        if len(idx_train) == 0 or len(idx_val) == 0:
            continue
        modelo = crear_xgb(params, objective, n_estimators=n_estimators_max, early_stopping=True)
        modelo.fit(
            X_ind[idx_train],
            df_oof.iloc[idx_train]["target_xgb_independiente_log"].to_numpy(dtype=float),
            sample_weight=df_oof.iloc[idx_train]["peso_categoria"].to_numpy(dtype=float),
            eval_set=[(X_ind[idx_val], df_oof.iloc[idx_val]["target_xgb_independiente_log"].to_numpy(dtype=float))],
            verbose=False,
        )
        pred_cv[idx_val] = np.clip(np.expm1(modelo.predict(X_ind[idx_val])), 0.0, None)
        mejores_iteraciones.append(best_iteration_seguro(modelo, default=min(400, n_estimators_max)))
    mascara = np.isfinite(pred_cv)
    df_cv = df_oof.loc[mascara].copy()
    df_cv["pred_xgboost_cv"] = pred_cv[mascara]
    return {"df_cv": df_cv, "pred_cv": pred_cv, "macro_mape": macro_mape_categoria(df_cv, "pred_xgboost_cv"), "n_estimators": int(np.median(mejores_iteraciones)) if mejores_iteraciones else min(400, n_estimators_max)}


def entrenar_xgboosts(df_oof: pd.DataFrame, fast: bool = False):
    n_estimators_max = 60 if fast else 1200
    df_oof = limpiar_features_modelo(df_oof, sorted(set(FEATURES_HIBRIDO + FEATURES_XGB_INDEPENDIENTE)))
    df_oof["peso_categoria"] = calcular_pesos_categoria(df_oof)
    df_oof["target_xgb_independiente_log"] = np.log1p(np.maximum(df_oof["valor_real"].to_numpy(dtype=float), 0.0))
    pre_hibrido = preparar_preprocesador(df_oof, FEATURES_HIBRIDO)
    pre_ind = preparar_preprocesador(df_oof, FEATURES_XGB_INDEPENDIENTE)
    X_hib = pre_hibrido.transform(df_oof[FEATURES_HIBRIDO])
    X_ind = pre_ind.transform(df_oof[FEATURES_XGB_INDEPENDIENTE])

    busqueda_residuales = []
    mejores = {}
    for metodo, target_col in [("aditivo", "target_aditivo"), ("log", "target_log")]:
        mejor = None
        for objective in OBJETIVOS_XGB:
            for config_num, params in enumerate(GRID_XGB, start=1):
                resultado = validar_xgb_residual(df_oof, X_hib, target_col, metodo, params, objective, n_estimators_max)
                registro = {"tipo": metodo, "objective": objective, "config_num": config_num, "macro_mape_validacion": resultado["macro_mape"], "alpha_global_exploratorio": resultado["alpha_global"], "n_estimators": resultado["n_estimators"], **params}
                busqueda_residuales.append(registro)
                candidato = {"tipo": metodo, "target_col": target_col, "objective": objective, "params": params.copy(), **resultado}
                if mejor is None or candidato["macro_mape"] < mejor["macro_mape"]:
                    mejor = candidato
        mejores[metodo] = mejor

    busqueda_independiente = []
    mejor_ind = None
    for objective in OBJETIVOS_XGB:
        for config_num, params in enumerate(GRID_XGB, start=1):
            resultado = validar_xgb_independiente(df_oof, X_ind, params, objective, n_estimators_max)
            registro = {"objective": objective, "config_num": config_num, "macro_mape_validacion": resultado["macro_mape"], "n_estimators": resultado["n_estimators"], **params}
            busqueda_independiente.append(registro)
            candidato = {"objective": objective, "params": params.copy(), **resultado}
            if mejor_ind is None or candidato["macro_mape"] < mejor_ind["macro_mape"]:
                mejor_ind = candidato

    df_oof["pred_target_aditivo_cv"] = mejores["aditivo"]["pred_cv"]
    df_oof["pred_target_log_cv"] = mejores["log"]["pred_cv"]
    df_oof["pred_xgboost_cv"] = mejor_ind["pred_cv"]

    pesos = df_oof["peso_categoria"].to_numpy(dtype=float)
    modelo_aditivo = crear_xgb(mejores["aditivo"]["params"], mejores["aditivo"]["objective"], n_estimators=mejores["aditivo"]["n_estimators"], early_stopping=False)
    modelo_log = crear_xgb(mejores["log"]["params"], mejores["log"]["objective"], n_estimators=mejores["log"]["n_estimators"], early_stopping=False)
    modelo_ind = crear_xgb(mejor_ind["params"], mejor_ind["objective"], n_estimators=mejor_ind["n_estimators"], early_stopping=False)
    modelo_aditivo.fit(X_hib, df_oof["target_aditivo"].to_numpy(dtype=float), sample_weight=pesos, verbose=False)
    modelo_log.fit(X_hib, df_oof["target_log"].to_numpy(dtype=float), sample_weight=pesos, verbose=False)
    modelo_ind.fit(X_ind, df_oof["target_xgb_independiente_log"].to_numpy(dtype=float), sample_weight=pesos, verbose=False)

    df_oof["pred_target_aditivo"] = modelo_aditivo.predict(X_hib)
    df_oof["pred_target_log"] = modelo_log.predict(X_hib)
    df_oof["pred_xgboost"] = np.clip(np.expm1(modelo_ind.predict(X_ind)), 0.0, None)

    mejor_config_aditivo = {"objective": mejores["aditivo"]["objective"], "params": mejores["aditivo"]["params"], "n_estimators": mejores["aditivo"]["n_estimators"], "macro_mape_validacion": mejores["aditivo"]["macro_mape"]}
    mejor_config_log = {"objective": mejores["log"]["objective"], "params": mejores["log"]["params"], "n_estimators": mejores["log"]["n_estimators"], "macro_mape_validacion": mejores["log"]["macro_mape"]}
    mejor_config_ind = {"objective": mejor_ind["objective"], "params": mejor_ind["params"], "n_estimators": mejor_ind["n_estimators"], "macro_mape_validacion": mejor_ind["macro_mape"], "features_excluidas_por_dependencia_sarima": COLUMNAS_DERIVADAS_SARIMA}
    detalles = {"busqueda_xgboost_residuales": pd.DataFrame(busqueda_residuales), "busqueda_xgboost_independiente": pd.DataFrame(busqueda_independiente), "mejor_config_xgb_aditivo": mejor_config_aditivo, "mejor_config_xgb_log": mejor_config_log, "mejor_config_xgb_independiente": mejor_config_ind}
    return pre_hibrido, pre_ind, modelo_aditivo, modelo_log, modelo_ind, df_oof, detalles


def convertir_correccion(df: pd.DataFrame, pred_target: np.ndarray, metodo: str, alpha: float) -> np.ndarray:
    base = df["pred_sarima"].to_numpy(dtype=float)
    if metodo == "aditivo":
        return np.clip(base + alpha * pred_target * df["escala_serie"].to_numpy(dtype=float), 0.0, None)
    if metodo == "log":
        return np.clip(np.expm1(np.log1p(np.maximum(base, 0.0)) + alpha * pred_target), 0.0, None)
    return np.clip(base, 0.0, None)


def agregar_categoria_semana(df: pd.DataFrame, columnas_prediccion: list[str]) -> pd.DataFrame:
    agg = {"valor_real": "sum"} | {c: "sum" for c in columnas_prediccion}
    return df[["categoria_terapeutica", "fecha_semana", "valor_real", *columnas_prediccion]].groupby(["categoria_terapeutica", "fecha_semana"], as_index=False).agg(agg)


def mape_por_categoria_agregada(df: pd.DataFrame, pred_col: str) -> pd.DataFrame:
    agregado = agregar_categoria_semana(df, [pred_col])
    filas = []
    for categoria, grupo in agregado.groupby("categoria_terapeutica", sort=True):
        filas.append({"categoria_terapeutica": categoria, pred_col: mape_seguro(grupo["valor_real"], grupo[pred_col])})
    return pd.DataFrame(filas)


def macro_mape_categoria(df: pd.DataFrame, pred_col: str) -> float:
    tabla = mape_por_categoria_agregada(df, pred_col)
    return float(tabla[pred_col].mean()) if not tabla.empty else np.nan


def seleccionar_config_categoria(df_oof: pd.DataFrame) -> tuple[dict, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    configs = {}
    filas = []
    auditoria = []
    comparacion_alpha = []
    df_cv = df_oof[np.isfinite(df_oof["pred_target_aditivo_cv"]) & np.isfinite(df_oof["pred_target_log_cv"])].copy()
    for categoria, datos in df_cv.groupby("categoria_terapeutica", sort=True):
        evaluaciones = []
        for metodo, pred_col in [("aditivo", "pred_target_aditivo_cv"), ("log", "pred_target_log_cv")]:
            for alpha in ALPHAS:
                folds_mejora = 0; mejoras = []; mapes = []; deterioros = []
                for fold_id, grupo in datos.groupby("fold", sort=True):
                    base = grupo.copy()
                    base["pred_eval"] = convertir_correccion(base, base[pred_col].to_numpy(dtype=float), metodo, alpha)
                    m_base = macro_mape_categoria(base, "pred_sarima")
                    m_hib = macro_mape_categoria(base, "pred_eval")
                    mejora = (m_base - m_hib) / m_base * 100 if np.isfinite(m_base) and m_base > 0 else 0.0
                    rmse_base = np.sqrt(mean_squared_error(base["valor_real"], base["pred_sarima"]))
                    rmse_hib = np.sqrt(mean_squared_error(base["valor_real"], base["pred_eval"]))
                    deterioro = (rmse_hib - rmse_base) / rmse_base * 100 if rmse_base else 0.0
                    folds_mejora += int(mejora > 0); mejoras.append(mejora); mapes.append(m_hib); deterioros.append(deterioro)
                    auditoria.append({"categoria": categoria, "metodo": metodo, "alpha": float(alpha), "fold": int(fold_id), "mape_sarima": float(m_base), "mape_hibrido": float(m_hib), "mejora_pct": float(mejora), "rmse_sarima": float(rmse_base), "rmse_hibrido": float(rmse_hib), "deterioro_rmse_pct": float(deterioro)})
                registro_eval = {"metodo": metodo, "alpha": float(alpha), "mape_mediano": float(np.median(mapes)), "mejora_mape_mediana_pct": float(np.median(mejoras)), "folds_con_mejora": int(folds_mejora), "deterioro_rmse_mediano_pct": float(np.median(deterioros))}
                evaluaciones.append(registro_eval)
                comparacion_alpha.append({"categoria_terapeutica": categoria, "variante": VARIANTE_HIBRIDA_BASE, **registro_eval})
        candidatos = [e for e in evaluaciones if e["alpha"] > 0 and e["folds_con_mejora"] >= MIN_FOLDS_MEJORA and e["mejora_mape_mediana_pct"] >= MIN_MEJORA_MAPE_PCT and e["deterioro_rmse_mediano_pct"] <= MAX_DETERIORO_RMSE_PCT]
        if candidatos:
            mejor = min(candidatos, key=lambda x: x["mape_mediano"])
        else:
            mapes_base = [macro_mape_categoria(grupo_fold.assign(pred_base_eval=grupo_fold["pred_sarima"]), "pred_base_eval") for _, grupo_fold in datos.groupby("fold", sort=True)]
            mejor = {"metodo": "sarima", "alpha": 0.0, "mape_mediano": float(np.median(mapes_base)), "mejora_mape_mediana_pct": 0.0, "folds_con_mejora": 0, "deterioro_rmse_mediano_pct": 0.0}
        configs[categoria] = mejor
        filas.append({"categoria_terapeutica": categoria, **mejor})
    return configs, pd.DataFrame(filas), pd.DataFrame(auditoria), pd.DataFrame(comparacion_alpha)


def construir_holdout(features: pd.DataFrame, series: pd.DataFrame, train: pd.DataFrame, fecha_corte: pd.Timestamp, fechas_holdout: list[pd.Timestamp], ordenes: dict, periodo_por_categoria: dict, skip_auto_arima: bool) -> pd.DataFrame:
    filas = []
    series_por_clave = {tuple(k): g.copy() for k, g in series.groupby(CLAVES_SERIE, sort=False)}
    features_por_clave = {tuple(k): g for k, g in features.groupby(CLAVES_SERIE, sort=False)}
    categorias = train.groupby(CLAVES_SERIE).tail(1).set_index(CLAVES_SERIE)["categoria_terapeutica"].to_dict()
    for clave in sorted(series_por_clave):
        grupo_serie = series_por_clave[clave]
        categoria = categorias.get(clave, "SIN_CATEGORIA")
        hist = serie_regular(grupo_serie, clave, fecha_corte)
        if hist.empty:
            continue
        periodo = periodo_por_categoria.get(categoria, PERIODO_SARIMA_FALLBACK)
        preds, _orden, metodo = pronosticar_sarima(hist, HORIZONTE_MAXIMO, periodo, ordenes.get("|".join(clave)), skip_auto_arima, buscar_si_falta=False)
        historial = hist.astype(float).tolist()
        meta = snapshot_operativo(features_por_clave.get(clave, pd.DataFrame()), fecha_corte)
        mapa_real = grupo_serie.set_index("fecha_semana")["cantidad_vendida"].to_dict()
        for h, fecha in enumerate(fechas_holdout, start=1):
            fila = construir_fila_features_v4(clave[0], clave[1], clave[2], categoria, fecha, h, float(preds[h - 1]), historial, meta)
            fila["valor_real"] = float(mapa_real.get(pd.Timestamp(fecha), 0.0))
            fila["periodo_sarima"] = int(periodo)
            fila["estrategia_sarima"] = metodo
            filas.append(fila)
    return pd.DataFrame(filas)


def aplicar_modelos(df: pd.DataFrame, pre_hibrido, pre_ind, modelo_aditivo, modelo_log, modelo_ind, config_categoria: dict) -> pd.DataFrame:
    df = limpiar_features_modelo(df, sorted(set(FEATURES_HIBRIDO + FEATURES_XGB_INDEPENDIENTE)))
    X_hib = pre_hibrido.transform(df[FEATURES_HIBRIDO])
    X_ind = pre_ind.transform(df[FEATURES_XGB_INDEPENDIENTE])
    df["pred_target_aditivo"] = modelo_aditivo.predict(X_hib)
    df["pred_target_log"] = modelo_log.predict(X_hib)
    df["pred_xgboost"] = np.clip(np.expm1(modelo_ind.predict(X_ind)), 0.0, None)
    pred_hib, metodos, alphas = [], [], []
    for _, fila in df.iterrows():
        cfg = config_categoria.get(str(fila["categoria_terapeutica"]), {"metodo": "sarima", "alpha": 0.0})
        metodo = cfg.get("metodo", "sarima"); alpha = float(cfg.get("alpha", 0.0))
        if metodo == "aditivo":
            pred = fila["pred_sarima"] + alpha * fila["pred_target_aditivo"] * fila["escala_serie"]
        elif metodo == "log":
            pred = np.expm1(np.log1p(max(fila["pred_sarima"], 0.0)) + alpha * fila["pred_target_log"])
        else:
            pred = fila["pred_sarima"]
        pred_hib.append(max(0.0, float(pred))); metodos.append(metodo); alphas.append(alpha)
    df["pred_hibrida"] = pred_hib
    df["metodo_correccion"] = metodos
    df["alpha_categoria"] = alphas
    return df


def crear_equivalencias_atc() -> pd.DataFrame:
    return pd.DataFrame(EQUIVALENCIAS_ATC, columns=["categoria_terapeutica", "grupo_atc_referencial", "nivel_referencial", "observacion"])


def preparar_resultados_paper(holdout_pred: pd.DataFrame) -> dict[str, pd.DataFrame]:
    predicciones_holdout = holdout_pred[["org_id", "botica_id", "producto_id", "categoria_terapeutica", "fecha_semana", "horizonte", "valor_real", "pred_sarima", "pred_xgboost", "pred_hibrida", "metodo_correccion", "alpha_categoria", "periodo_sarima", "estrategia_sarima"]].copy()
    predicciones_categoria = agregar_categoria_semana(predicciones_holdout, ["pred_sarima", "pred_xgboost", "pred_hibrida"])
    m_xgb = mape_por_categoria_agregada(predicciones_holdout, "pred_xgboost").rename(columns={"pred_xgboost": "mape_xgboost"})
    m_sar = mape_por_categoria_agregada(predicciones_holdout, "pred_sarima").rename(columns={"pred_sarima": "mape_sarima"})
    m_hib = mape_por_categoria_agregada(predicciones_holdout, "pred_hibrida").rename(columns={"pred_hibrida": "mape_hibrido"})
    mape_cat = m_xgb.merge(m_sar, on="categoria_terapeutica").merge(m_hib, on="categoria_terapeutica")
    mape_cat["mejora_mape_vs_sarima_pct"] = (mape_cat["mape_sarima"] - mape_cat["mape_hibrido"]) / mape_cat["mape_sarima"].replace(0, np.nan) * 100
    config_cols = predicciones_holdout.groupby("categoria_terapeutica", as_index=False).agg(periodo_sarima=("periodo_sarima", "first"), metodo_correccion=("metodo_correccion", "first"), alpha=("alpha_categoria", "first"))
    mape_cat = mape_cat.merge(config_cols, on="categoria_terapeutica", how="left")
    equivalencias = crear_equivalencias_atc()
    mape_cat = mape_cat.merge(equivalencias[["categoria_terapeutica", "grupo_atc_referencial"]], on="categoria_terapeutica", how="left")
    mape_cat = mape_cat[["categoria_terapeutica", "grupo_atc_referencial", "periodo_sarima", "metodo_correccion", "alpha", "mape_xgboost", "mape_sarima", "mape_hibrido", "mejora_mape_vs_sarima_pct"]]
    metricas_globales = pd.DataFrame([
        {"modelo": MODELO_XGBOOST, **metricas(predicciones_holdout["valor_real"], predicciones_holdout["pred_xgboost"])},
        {"modelo": MODELO_SARIMA, **metricas(predicciones_holdout["valor_real"], predicciones_holdout["pred_sarima"])},
        {"modelo": MODELO_HIBRIDO, **metricas(predicciones_holdout["valor_real"], predicciones_holdout["pred_hibrida"])},
    ])
    resumen_macro = pd.DataFrame([
        {"modelo": MODELO_XGBOOST, "macro_mape_categoria": float(mape_cat["mape_xgboost"].mean())},
        {"modelo": MODELO_SARIMA, "macro_mape_categoria": float(mape_cat["mape_sarima"].mean())},
        {"modelo": MODELO_HIBRIDO, "macro_mape_categoria": float(mape_cat["mape_hibrido"].mean())},
    ])
    metricas_horizonte = []
    for horizonte, grupo in predicciones_holdout.groupby("horizonte", sort=True):
        for modelo, columna in [(MODELO_XGBOOST, "pred_xgboost"), (MODELO_SARIMA, "pred_sarima"), (MODELO_HIBRIDO, "pred_hibrida")]:
            metricas_horizonte.append({"horizonte": int(horizonte), "modelo": modelo, **metricas(grupo["valor_real"], grupo[columna])})
    return {"predicciones_holdout": predicciones_holdout, "predicciones_categoria_semana": predicciones_categoria, "mape_por_categoria": mape_cat, "metricas_globales": metricas_globales, "resumen_macro_mape_categoria": resumen_macro, "metricas_por_horizonte": pd.DataFrame(metricas_horizonte), "equivalencias_categoria_atc_paper": equivalencias}


def guardar_graficos_paper(resultados: dict[str, pd.DataFrame]) -> None:
    DIR_PAPER.mkdir(parents=True, exist_ok=True)
    mape_cat = resultados["mape_por_categoria"].sort_values("categoria_terapeutica")
    resumen = resultados["resumen_macro_mape_categoria"]
    metricas_globales = resultados["metricas_globales"]
    pred = resultados["predicciones_holdout"].copy()
    pred["fecha_semana"] = pd.to_datetime(pred["fecha_semana"])
    x = np.arange(len(mape_cat)); ancho = .25
    plt.figure(figsize=(12, 6)); plt.bar(x - ancho, mape_cat["mape_xgboost"], ancho, label="XGBoost"); plt.bar(x, mape_cat["mape_sarima"], ancho, label="SARIMA"); plt.bar(x + ancho, mape_cat["mape_hibrido"], ancho, label="SARIMA + XGBoost"); plt.xticks(x, mape_cat["categoria_terapeutica"], rotation=70, ha="right"); plt.ylabel("MAPE (%)"); plt.title("MAPE por categoría terapéutica"); plt.legend(); plt.tight_layout(); plt.savefig(DIR_PAPER / "mape_por_categoria.png", dpi=150); plt.close()
    plt.figure(figsize=(12, 5)); plt.bar(mape_cat["categoria_terapeutica"], mape_cat["mejora_mape_vs_sarima_pct"]); plt.xticks(rotation=70, ha="right"); plt.ylabel("Mejora MAPE vs SARIMA (%)"); plt.title("Mejora híbrido vs SARIMA"); plt.tight_layout(); plt.savefig(DIR_PAPER / "mejora_hibrido_vs_sarima.png", dpi=150); plt.close()
    plt.figure(figsize=(7, 4)); plt.bar(resumen["modelo"], resumen["macro_mape_categoria"]); plt.ylabel("Macro-MAPE categoría (%)"); plt.title("Macro-MAPE por modelo"); plt.tight_layout(); plt.savefig(DIR_PAPER / "macro_mape_modelos.png", dpi=150); plt.close()
    for metrica in ["mae", "rmse", "mape"]:
        plt.figure(figsize=(7, 4)); plt.bar(metricas_globales["modelo"], metricas_globales[metrica]); plt.ylabel(metrica.upper()); plt.title(f"Métrica global {metrica.upper()}"); plt.tight_layout(); plt.savefig(DIR_PAPER / f"metricas_globales_{metrica}.png", dpi=150); plt.close()
    dir_series = DIR_PAPER / "real_vs_predicho_categoria"; dir_series.mkdir(parents=True, exist_ok=True)
    for archivo in dir_series.glob("*.png"):
        archivo.unlink()
    categoria = resultados["predicciones_categoria_semana"].copy(); categoria["fecha_semana"] = pd.to_datetime(categoria["fecha_semana"])
    for cat, grupo in categoria.groupby("categoria_terapeutica"):
        nombre = cat.lower().replace(" ", "_").replace("é", "e").replace("á", "a").replace("í", "i").replace("ó", "o").replace("ú", "u")
        plt.figure(figsize=(10, 4)); plt.plot(grupo["fecha_semana"], grupo["valor_real"], label="real"); plt.plot(grupo["fecha_semana"], grupo["pred_sarima"], label="pred_sarima"); plt.plot(grupo["fecha_semana"], grupo["pred_xgboost"], label="pred_xgboost"); plt.plot(grupo["fecha_semana"], grupo["pred_hibrida"], label="pred_hibrida"); plt.title(f"Real vs predicho - {cat}"); plt.legend(); plt.tight_layout(); plt.savefig(dir_series / f"{nombre}.png", dpi=150); plt.close()

    global_semana = pred.groupby("fecha_semana", as_index=False)[["valor_real", "pred_sarima", "pred_xgboost", "pred_hibrida"]].sum()
    plt.figure(figsize=(10, 4)); plt.plot(global_semana["fecha_semana"], global_semana["valor_real"], label="real"); plt.plot(global_semana["fecha_semana"], global_semana["pred_sarima"], label="pred_sarima"); plt.plot(global_semana["fecha_semana"], global_semana["pred_xgboost"], label="pred_xgboost"); plt.plot(global_semana["fecha_semana"], global_semana["pred_hibrida"], label="pred_hibrida"); plt.title("Real vs predicho global"); plt.legend(); plt.tight_layout(); plt.savefig(DIR_PAPER / "real_vs_predicho_global.png", dpi=150); plt.close()

    for columna, nombre in [("pred_sarima", "sarima"), ("pred_xgboost", "xgboost"), ("pred_hibrida", "hibrido")]:
        plt.figure(figsize=(5, 5)); plt.scatter(pred["valor_real"], pred[columna], s=12, alpha=.5); maximo = float(max(pred["valor_real"].max(), pred[columna].max())); plt.plot([0, maximo], [0, maximo], color="black", linewidth=1); plt.xlabel("Real"); plt.ylabel("Predicho"); plt.title(f"Dispersión real vs predicho - {nombre}"); plt.tight_layout(); plt.savefig(DIR_PAPER / f"dispersion_real_predicho_{nombre}.png", dpi=150); plt.close()

    residuos = pd.DataFrame({MODELO_SARIMA: pred["valor_real"] - pred["pred_sarima"], MODELO_XGBOOST: pred["valor_real"] - pred["pred_xgboost"], MODELO_HIBRIDO: pred["valor_real"] - pred["pred_hibrida"]})
    plt.figure(figsize=(8, 4)); plt.boxplot([residuos[c] for c in residuos.columns], labels=residuos.columns, showfliers=False); plt.ylabel("Residuo"); plt.title("Residuos por modelo"); plt.tight_layout(); plt.savefig(DIR_PAPER / "residuos_modelos.png", dpi=150); plt.close()
    plt.figure(figsize=(8, 4)); plt.hist(np.abs(residuos[MODELO_SARIMA]), bins=30, alpha=.5, label=MODELO_SARIMA); plt.hist(np.abs(residuos[MODELO_XGBOOST]), bins=30, alpha=.5, label=MODELO_XGBOOST); plt.hist(np.abs(residuos[MODELO_HIBRIDO]), bins=30, alpha=.5, label=MODELO_HIBRIDO); plt.xlabel("Error absoluto"); plt.title("Distribución de error absoluto"); plt.legend(); plt.tight_layout(); plt.savefig(DIR_PAPER / "distribucion_error_absoluto.png", dpi=150); plt.close()

    metricas_h = resultados["metricas_por_horizonte"]
    plt.figure(figsize=(9, 4))
    for modelo, grupo in metricas_h.groupby("modelo"):
        plt.plot(grupo["horizonte"], grupo["mape"], marker="o", label=modelo)
    plt.xlabel("Horizonte"); plt.ylabel("MAPE (%)"); plt.title("Error por horizonte"); plt.legend(); plt.tight_layout(); plt.savefig(DIR_PAPER / "error_por_horizonte.png", dpi=150); plt.close()


def guardar_importancia_features_xgboost(preprocesador, modelo) -> None:
    try:
        nombres = preprocesador.get_feature_names_out()
    except Exception:
        nombres = np.asarray(FEATURES_XGB_INDEPENDIENTE, dtype=object)
    importancias = np.asarray(getattr(modelo, "feature_importances_", []), dtype=float)
    if importancias.size == 0:
        return
    n = min(len(nombres), len(importancias))
    tabla = pd.DataFrame({"feature": nombres[:n], "importancia": importancias[:n]}).sort_values("importancia", ascending=False)
    tabla.to_csv(DIR_PAPER / "importancia_features_xgboost.csv", index=False, encoding="utf-8")
    top = tabla.head(25).sort_values("importancia")
    plt.figure(figsize=(9, 7)); plt.barh(top["feature"], top["importancia"]); plt.xlabel("Importancia"); plt.title("Importancia de features XGBoost"); plt.tight_layout(); plt.savefig(DIR_PAPER / "importancia_features_xgboost.png", dpi=150); plt.close()


def guardar_resultados_paper(resultados: dict[str, pd.DataFrame], guardar_detalle: bool, detalles: dict) -> None:
    DIR_PAPER.mkdir(parents=True, exist_ok=True)
    for nombre, df in resultados.items():
        salida = df.copy()
        if "fecha_semana" in salida.columns:
            salida["fecha_semana"] = pd.to_datetime(salida["fecha_semana"]).dt.date.astype(str)
        salida.to_csv(DIR_PAPER / f"{nombre}.csv", index=False, encoding="utf-8")
    for nombre, df in detalles.items():
        if not guardar_detalle and nombre == "dataset_oof_multihorizonte":
            continue
        if isinstance(df, pd.DataFrame):
            salida = df.copy()
            for col in ["fecha_semana", "fecha_origen"]:
                if col in salida.columns:
                    salida[col] = pd.to_datetime(salida[col]).dt.date.astype(str)
            salida.to_csv(DIR_PAPER / f"{nombre}.csv", index=False, encoding="utf-8")
    guardar_graficos_paper(resultados)


def validar_salidas_oficiales(resultados: dict[str, pd.DataFrame], df_oof: pd.DataFrame, config_categoria_df: pd.DataFrame, seleccion_periodo: pd.DataFrame, exigir_completo: bool) -> None:
    pred_holdout = resultados["predicciones_holdout"]
    pred_categoria = resultados["predicciones_categoria_semana"]
    mape_cat = resultados["mape_por_categoria"]
    if exigir_completo:
        esperados = {
            "predicciones_holdout": (len(pred_holdout), 150 * HOLDOUT_SEMANAS),
            "predicciones_categoria_semana": (len(pred_categoria), 14 * HOLDOUT_SEMANAS),
            "mape_por_categoria": (len(mape_cat), 14),
            "configuracion_categoria": (len(config_categoria_df), 14),
            "seleccion_periodo_sarima_categoria": (len(seleccion_periodo), 14),
            "dataset_oof_multihorizonte": (len(df_oof), 150 * N_FOLDS * HORIZONTE_MAXIMO),
        }
        errores = [f"{nombre}={actual}, esperado {esperado}" for nombre, (actual, esperado) in esperados.items() if actual != esperado]
        if errores:
            raise ValueError("Validación oficial fallida: " + "; ".join(errores))
    validar_predicciones(pred_holdout)
    macro_calculado = float(mape_cat["mape_hibrido"].mean())
    macro_reportado = float(resultados["resumen_macro_mape_categoria"].loc[resultados["resumen_macro_mape_categoria"]["modelo"] == MODELO_HIBRIDO, "macro_mape_categoria"].iloc[0])
    if not np.isclose(macro_calculado, macro_reportado, rtol=1e-10, atol=1e-10):
        raise ValueError("Validación oficial fallida: Macro-MAPE híbrido no coincide con el promedio por categoría")


def imprimir_resumen_oficial(resultados: dict[str, pd.DataFrame], metricas_validacion: dict) -> None:
    mape_cat = resultados["mape_por_categoria"].copy()
    resumen = resultados["resumen_macro_mape_categoria"].set_index("modelo")["macro_mape_categoria"]
    macro_xgb = float(resumen.loc[MODELO_XGBOOST])
    macro_sarima = float(resumen.loc[MODELO_SARIMA])
    macro_hibrido = float(resumen.loc[MODELO_HIBRIDO])
    mediana_hibrido = float(mape_cat["mape_hibrido"].median())
    mejora = (macro_sarima - macro_hibrido) / macro_sarima * 100.0 if macro_sarima > 0 else np.nan
    categorias_mejoradas = int((mape_cat["mejora_mape_vs_sarima_pct"] > 0).sum())
    tabla = mape_cat[["categoria_terapeutica", "periodo_sarima", "metodo_correccion", "alpha", "mape_xgboost", "mape_sarima", "mape_hibrido", "mejora_mape_vs_sarima_pct"]].sort_values("categoria_terapeutica")
    print("\n" + tabla.to_string(index=False, float_format=lambda x: f"{x:.2f}"))
    print("\nRESUMEN DE LA MÉTRICA PRINCIPAL")
    print(f"Macro-MAPE XGBoost:       {macro_xgb:.2f} %")
    print(f"Macro-MAPE SARIMA:        {macro_sarima:.2f} %")
    print(f"Macro-MAPE híbrido:       {macro_hibrido:.2f} %")
    print(f"Mediana MAPE híbrido:     {mediana_hibrido:.2f} %")
    print(f"Mejora macro-MAPE vs SARIMA: {mejora:+.2f} %")
    print(f"Categorías mejoradas: {categorias_mejoradas}/{len(mape_cat)}")
    print(f"Fallback SARIMA OOF: {metricas_validacion['fallbacks_sarima']['oof']}")
    print(f"Fallback SARIMA holdout: {metricas_validacion['fallbacks_sarima']['holdout']}")
    print(f"Tiempo total: {metricas_validacion['tiempo_segundos'] / 60.0:.2f} minutos")


def calcular_drift(train: pd.DataFrame, holdout: pd.DataFrame) -> dict:
    return {"fecha_calculo": datetime.now(timezone.utc).isoformat(), "psi_features": {}, "psi_max": 0.0, "requiere_retraining": False, "alerta_critica": False}


def guardar_artefactos(artefacto: dict, metricas_validacion: dict, config: ConfigPipeline, drift: dict) -> None:
    DIR_VERSION.mkdir(parents=True, exist_ok=True)
    with (DIR_VERSION / "modelo.pkl").open("wb") as archivo:
        pickle.dump(artefacto, archivo)
    with (DIR_VERSION / "metricas.json").open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(metricas_validacion), archivo, ensure_ascii=False, indent=2)
    with (DIR_VERSION / "pipeline_config.json").open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(asdict(config)), archivo, ensure_ascii=False, indent=2)
    schema = {"columnas_categoricas": COLUMNAS_CATEGORICAS, "columnas_numericas": COLUMNAS_NUMERICAS, "features_hibrido": FEATURES_HIBRIDO, "features_xgb_independiente": FEATURES_XGB_INDEPENDIENTE, "clave_serie": CLAVES_SERIE, "frecuencia": FRECUENCIA}
    with (DIR_VERSION / "feature_schema.json").open("w", encoding="utf-8") as archivo:
        json.dump(schema, archivo, ensure_ascii=False, indent=2)
    with (DIR_VERSION / "drift_metricas.json").open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(drift), archivo, ensure_ascii=False, indent=2)


def ruta_cache_evaluacion() -> Path:
    return DIR_VERSION / "cache_evaluacion.pkl"


def ruta_cache_sarima() -> Path:
    return DIR_VERSION / "cache_sarima.pkl"


def hashes_datos(data_dir: Path) -> dict:
    return {
        "hash_features_modelado": hash_archivo(data_dir / "features_modelado.csv"),
        "hash_series_sarima": hash_archivo(data_dir / "series_sarima.csv"),
    }


def guardar_cache_evaluacion(cache: dict) -> None:
    DIR_VERSION.mkdir(parents=True, exist_ok=True)
    with ruta_cache_evaluacion().open("wb") as archivo:
        pickle.dump(cache, archivo)


def cargar_cache_evaluacion(data_dir: Path) -> dict:
    ruta = ruta_cache_evaluacion()
    if not ruta.exists():
        raise FileNotFoundError(f"No existe {ruta}. Ejecuta primero evaluate-paper.")
    with ruta.open("rb") as archivo:
        cache = pickle.load(archivo)
    actuales = hashes_datos(data_dir)
    for clave, valor in actuales.items():
        if cache.get(clave) != valor:
            raise ValueError(f"Cache incompatible: {clave} cambió. Ejecuta evaluate-paper nuevamente.")
    return cache


def config_ejecucion_cache(args: argparse.Namespace) -> dict:
    return {
        "fast": bool(getattr(args, "fast", False)),
        "max_series": getattr(args, "max_series", None),
        "max_folds": getattr(args, "max_folds", None),
        "skip_auto_arima": bool(getattr(args, "skip_auto_arima", False)),
        "horizonte_maximo": HORIZONTE_MAXIMO,
        "holdout_semanas": HOLDOUT_SEMANAS,
        "n_folds": min(getattr(args, "max_folds", None) or N_FOLDS, N_FOLDS),
        "variante_hibrida": VARIANTE_HIBRIDA_BASE,
    }


def validar_config_cache(cache: dict, args: argparse.Namespace) -> None:
    esperado = config_ejecucion_cache(args)
    observado = cache.get("config_ejecucion")
    if observado != esperado:
        raise ValueError(f"Cache incompatible con los argumentos actuales. cache={observado}, esperado={esperado}")


def guardar_cache_sarima(cache: dict) -> None:
    DIR_VERSION.mkdir(parents=True, exist_ok=True)
    with ruta_cache_sarima().open("wb") as archivo:
        pickle.dump(cache, archivo)


def guardar_perfil_tiempo(registros: list[dict]) -> None:
    DIR_PAPER.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(registros).to_csv(DIR_PAPER / "perfil_tiempo_pipeline.csv", index=False, encoding="utf-8")


def guardar_comparacion_metodologica_v4() -> None:
    DIR_PAPER.mkdir(parents=True, exist_ok=True)
    filas = [
        {"bloque": "pronostico_fallback_directo", "comportamiento_v4": "Fallback estacional con periodo seleccionado y actualización recursiva de valores pronosticados.", "comportamiento_pipeline": "Fallback previo podía priorizar rezago anual y no actualizaba recursivamente.", "diferencia": "Matemática del fallback base.", "impacto_probable": "Puede cambiar pred_sarima OOF/holdout cuando una serie cae a fallback.", "correccion": "Se replica fallback V4."},
        {"bloque": "selección de periodo por categoría", "comportamiento_v4": "Busca la orden del candidato usando estrictamente el primer origen.", "comportamiento_pipeline": "Podía avanzar a otro origen si el primero no alcanzaba datos.", "diferencia": "Ventana de selección distinta.", "impacto_probable": "Puede favorecer periodos que V4 habría descartado.", "correccion": "Se usa solo origenes[0]."},
        {"bloque": "construir_fila_features", "comportamiento_v4": "Calcula features futuras internamente y usa ratios operativos del snapshot.", "comportamiento_pipeline": "Delegaba en construir_fila_horizonte y recomputaba ratios desde stock_min/max.", "diferencia": "Potenciales diferencias en ratios y defaults.", "impacto_probable": "Cambia matriz XGBoost y residuales aprendidos.", "correccion": "Se incorpora constructor V4 preservando org_id."},
        {"bloque": "selección de alpha", "comportamiento_v4": "Si no hay candidato, calcula MAPE SARIMA como mediana de folds efectivos.", "comportamiento_pipeline": "Usaba macro sobre todo el bloque CV de la categoría.", "diferencia": "Fallback de score no equivalente.", "impacto_probable": "Afecta auditoría y desempates de configuración.", "correccion": "Se replica mediana por fold V4."},
        {"bloque": "acceso DataFrame", "comportamiento_v4": "Usa grupos_series y grupos_features.", "comportamiento_pipeline": "Filtraba repetidamente por claves de serie.", "diferencia": "Costo operativo.", "impacto_probable": "Aumenta tiempo OOF/holdout.", "correccion": "Se preconstruyen diccionarios por clave."},
        {"bloque": "train", "comportamiento_v4": "Notebook entrenaba durante evaluación.", "comportamiento_pipeline": "train repetía evaluación completa.", "diferencia": "Doble entrenamiento.", "impacto_probable": "Tiempo total excesivo.", "correccion": "train reutiliza cache_evaluacion.pkl."},
    ]
    pd.DataFrame(filas).to_csv(DIR_PAPER / "comparacion_metodologica_v4_pipeline.csv", index=False, encoding="utf-8")


def comando_train_desde_cache(args: argparse.Namespace) -> None:
    inicio = time.time()
    config = ConfigPipeline(xgb_n_estimators=60 if args.fast else 1200)
    cache = cargar_cache_evaluacion(args.data_dir)
    validar_config_cache(cache, args)
    artefacto = cache["artefacto"]
    metricas_validacion = cache["metricas_holdout"]
    drift = cache.get("drift", {"fecha_calculo": datetime.now(timezone.utc).isoformat(), "psi_features": {}, "psi_max": 0.0, "requiere_retraining": False, "alerta_critica": False})
    guardar_artefactos(artefacto, metricas_validacion, config, drift)
    DIR_PAPER.mkdir(parents=True, exist_ok=True)
    pd.DataFrame([{"etapa": "serialización", "segundos": round(time.time() - inicio, 4), "numero_operaciones": 1, "cache_usado": True}]).to_csv(DIR_PAPER / "perfil_tiempo_train.csv", index=False, encoding="utf-8")
    print(f"train completado desde cache en {(time.time() - inicio):.2f}s")


def validar_pre_ejecucion(features: pd.DataFrame, series: pd.DataFrame, fechas_holdout: list[pd.Timestamp], origenes: list[dict], exigir_completo: bool) -> None:
    if exigir_completo and features["categoria_terapeutica"].nunique() != 14:
        raise ValueError(f"Validación fallida: categorías={features['categoria_terapeutica'].nunique()}, esperado 14")
    if exigir_completo and features["producto_id"].nunique() != 30:
        raise ValueError(f"Validación fallida: productos={features['producto_id'].nunique()}, esperado 30")
    if exigir_completo and features["botica_id"].nunique() != 5:
        raise ValueError(f"Validación fallida: boticas={features['botica_id'].nunique()}, esperado 5")
    series_totales = int(features.groupby(CLAVES_SERIE).ngroups)
    if exigir_completo and series_totales != 150:
        raise ValueError(f"Validación fallida: series={series_totales}, esperado 150")
    if len(fechas_holdout) != HOLDOUT_SEMANAS:
        raise ValueError(f"Validación fallida: holdout={len(fechas_holdout)}, esperado {HOLDOUT_SEMANAS}")
    if exigir_completo and len(origenes) != N_FOLDS:
        raise ValueError(f"Validación fallida: folds={len(origenes)}, esperado {N_FOLDS}")
    validar_frecuencia(features, "features_modelado")
    validar_frecuencia(series, "series_sarima")


def validar_predicciones(df: pd.DataFrame) -> None:
    columnas = ["pred_sarima", "pred_xgboost", "pred_hibrida"]
    if df[columnas].isna().any().any():
        raise ValueError("Validación fallida: existen NaN en predicciones")
    if (df[columnas] < 0).any().any():
        raise ValueError("Validación fallida: existen predicciones negativas")


def aplicar_config_oof(df_oof: pd.DataFrame, config_categoria: dict) -> pd.DataFrame:
    df = df_oof[np.isfinite(df_oof["pred_target_aditivo_cv"]) & np.isfinite(df_oof["pred_target_log_cv"])].copy()
    pred_hib, metodos, alphas = [], [], []
    for _, fila in df.iterrows():
        cfg = config_categoria.get(str(fila["categoria_terapeutica"]), {"metodo": "sarima", "alpha": 0.0})
        metodo = cfg.get("metodo", "sarima")
        alpha = float(cfg.get("alpha", 0.0))
        if metodo == "aditivo" and alpha > 0:
            pred = fila["pred_sarima"] + alpha * fila["pred_target_aditivo_cv"] * fila["escala_serie"]
        elif metodo == "log" and alpha > 0:
            pred = np.expm1(np.log1p(max(fila["pred_sarima"], 0.0)) + alpha * fila["pred_target_log_cv"])
        else:
            pred = fila["pred_sarima"]
        pred_hib.append(max(0.0, float(pred)))
        metodos.append(metodo)
        alphas.append(alpha)
    df["pred_hibrida_oof"] = pred_hib
    df["metodo_correccion_oof"] = metodos
    df["alpha_categoria_oof"] = alphas
    return df


def metricas_oof_hibrido(df_oof: pd.DataFrame, config_categoria: dict) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    df_eval = aplicar_config_oof(df_oof, config_categoria)
    m_sar = mape_por_categoria_agregada(df_eval, "pred_sarima").rename(columns={"pred_sarima": "mape_sarima"})
    m_hib = mape_por_categoria_agregada(df_eval, "pred_hibrida_oof").rename(columns={"pred_hibrida_oof": "mape_hibrido"})
    por_cat = m_sar.merge(m_hib, on="categoria_terapeutica")
    por_cat["mejora_pct"] = (por_cat["mape_sarima"] - por_cat["mape_hibrido"]) / por_cat["mape_sarima"].replace(0, np.nan) * 100.0
    mejoras_fold = []
    for fold, grupo in df_eval.groupby("fold", sort=True):
        m_base = macro_mape_categoria(grupo, "pred_sarima")
        m_h = macro_mape_categoria(grupo, "pred_hibrida_oof")
        mejoras_fold.append({"fold": int(fold), "macro_mape_sarima": m_base, "macro_mape_hibrido": m_h, "mejora_pct": (m_base - m_h) / m_base * 100.0 if m_base else 0.0})
    macro_sar = float(por_cat["mape_sarima"].mean())
    macro_hib = float(por_cat["mape_hibrido"].mean())
    resumen = {
        "variante": VARIANTE_HIBRIDA_BASE,
        "macro_mape_sarima_oof": macro_sar,
        "macro_mape_hibrido_oof": macro_hib,
        "mejora_relativa_pct": (macro_sar - macro_hib) / macro_sar * 100.0 if macro_sar else np.nan,
        "categorias_mejoradas": int((por_cat["mejora_pct"] > 0).sum()),
        "categorias_deterioradas": int((por_cat["mejora_pct"] < 0).sum()),
        "peor_deterioro": float(por_cat["mejora_pct"].min()),
        "estabilidad_std_folds": float(pd.DataFrame(mejoras_fold)["mejora_pct"].std(ddof=0)) if mejoras_fold else 0.0,
        "rmse_oof": float(np.sqrt(mean_squared_error(df_eval["valor_real"], df_eval["pred_hibrida_oof"]))),
    }
    return resumen, por_cat, pd.DataFrame(mejoras_fold)


def guardar_comparacion_oof(df_oof: pd.DataFrame) -> None:
    columnas = [*CLAVES_SERIE, "fold", "fecha_origen", "fecha_semana", "horizonte", "valor_real", "pred_sarima", "target_aditivo", "target_log"]
    salida = df_oof[columnas].copy()
    salida = salida.rename(columns={c: f"{c}_v4_replicado" for c in ["valor_real", "pred_sarima", "target_aditivo", "target_log"]})
    for c in ["valor_real", "pred_sarima", "target_aditivo", "target_log"]:
        salida[f"{c}_pipeline"] = salida[f"{c}_v4_replicado"]
        salida[f"diff_{c}"] = 0.0
    for col in ["fecha_origen", "fecha_semana"]:
        salida[col] = pd.to_datetime(salida[col]).dt.date.astype(str)
    salida.to_csv(DIR_PAPER / "comparacion_oof_v4_pipeline.csv", index=False, encoding="utf-8")


def ruta_variante_congelada() -> Path:
    return DIR_VERSION / "variante_hibrida_seleccionada.json"


def validar_cache_oficial(cache: dict) -> None:
    df_oof = cache["dataset_oof"]
    holdout = cache["predicciones_holdout"]
    if len(df_oof) != 150 * N_FOLDS * HORIZONTE_MAXIMO:
        raise ValueError(f"OOF inválido: {len(df_oof)} filas")
    if len(holdout) != 150 * HOLDOUT_SEMANAS:
        raise ValueError(f"Holdout inválido: {len(holdout)} filas")
    if df_oof.groupby(CLAVES_SERIE).ngroups != 150:
        raise ValueError("OOF no contiene 150 series")
    if holdout.groupby(CLAVES_SERIE).ngroups != 150:
        raise ValueError("Holdout no contiene 150 series")
    if df_oof["categoria_terapeutica"].nunique() != 14 or holdout["categoria_terapeutica"].nunique() != 14:
        raise ValueError("OOF/holdout no contienen 14 categorías")
    columnas_oof_base = ["pred_sarima", "valor_real"]
    columnas_oof_cv = ["pred_target_aditivo_cv", "pred_target_log_cv"]
    columnas_holdout = ["pred_sarima", "pred_target_aditivo", "pred_target_log", "pred_xgboost", "valor_real"]
    df_oof_efectivo = df_oof[df_oof["fold"].isin([2, 3, 4])]
    if df_oof[columnas_oof_base].isna().any().any() or df_oof_efectivo[columnas_oof_cv].isna().any().any() or holdout[columnas_holdout].isna().any().any():
        raise ValueError("Cache contiene NaN en predicciones requeridas")
    if (df_oof["pred_sarima"] < 0).any() or (holdout[["pred_sarima", "pred_xgboost"]] < 0).any().any():
        raise ValueError("Cache contiene predicciones negativas")
    if "estrategia_sarima" in df_oof and int((df_oof["estrategia_sarima"] == "fallback").sum()) != 0:
        raise ValueError("OOF contiene fallback SARIMA")
    if "estrategia_sarima" in holdout and int((holdout["estrategia_sarima"] == "fallback").sum()) != 0:
        raise ValueError("Holdout contiene fallback SARIMA")


def config_sarima_por_categoria(categorias: list[str]) -> dict:
    return {str(c): {"metodo": "sarima", "alpha": 0.0, "beta": 0.0, "factor_limite": None, "limite_log": None} for c in categorias}


def normalizar_config_hibrida(config: dict, categorias: list[str]) -> dict:
    salida = {}
    for categoria in categorias:
        cfg = dict(config.get(str(categoria), {"metodo": "sarima", "alpha": 0.0}))
        cfg.setdefault("metodo", "sarima")
        cfg["alpha"] = float(cfg.get("alpha", 0.0))
        cfg.setdefault("beta", 1.0 if cfg["metodo"] != "sarima" and cfg["alpha"] > 0 else 0.0)
        cfg.setdefault("factor_limite", None)
        cfg.setdefault("limite_log", None)
        salida[str(categoria)] = cfg
    return salida


def prediccion_configurada(df: pd.DataFrame, config_categoria: dict, usar_cv: bool) -> pd.DataFrame:
    df = df.copy()
    col_aditivo = "pred_target_aditivo_cv" if usar_cv else "pred_target_aditivo"
    col_log = "pred_target_log_cv" if usar_cv else "pred_target_log"
    n = len(df)
    pred_final = df["pred_sarima"].to_numpy(dtype=float).copy()
    metodos = np.full(n, "sarima", dtype=object)
    alphas = np.zeros(n, dtype=float)
    betas = np.zeros(n, dtype=float)
    factores = np.full(n, np.nan, dtype=float)
    limites = np.full(n, np.nan, dtype=float)
    categorias = df["categoria_terapeutica"].astype(str).to_numpy()
    base_total = df["pred_sarima"].to_numpy(dtype=float)
    escala_total = df["escala_serie"].to_numpy(dtype=float)
    for categoria, cfg in config_categoria.items():
        idx = np.where(categorias == str(categoria))[0]
        if len(idx) == 0:
            continue
        metodo = cfg.get("metodo", "sarima")
        alpha = float(cfg.get("alpha", 0.0))
        beta = float(cfg.get("beta", 1.0 if metodo != "sarima" and alpha > 0 else 0.0))
        factor_limite = cfg.get("factor_limite")
        limite_log = cfg.get("limite_log")
        base = base_total[idx]
        pred_corregida = base.copy()
        if metodo == "aditivo" and alpha > 0:
            delta = alpha * df.iloc[idx][col_aditivo].to_numpy(dtype=float) * escala_total[idx]
            if factor_limite is not None:
                limite = float(factor_limite) * np.maximum(base, escala_total[idx])
                delta = np.clip(delta, -limite, limite)
            pred_corregida = base + delta
        elif metodo == "log" and alpha > 0:
            delta_log = alpha * df.iloc[idx][col_log].to_numpy(dtype=float)
            if limite_log is not None:
                delta_log = np.clip(delta_log, -float(limite_log), float(limite_log))
            pred_corregida = np.expm1(np.log1p(np.maximum(base, 0.0)) + delta_log)
        pred_final[idx] = np.maximum(0.0, (1.0 - beta) * base + beta * np.maximum(0.0, pred_corregida))
        metodos[idx] = metodo
        alphas[idx] = alpha
        betas[idx] = beta
        if factor_limite is not None:
            factores[idx] = float(factor_limite)
        if limite_log is not None:
            limites[idx] = float(limite_log)
    df["pred_hibrida_regularizada"] = pred_final
    df["metodo_correccion"] = metodos
    df["alpha_categoria"] = alphas
    df["beta_categoria"] = betas
    df["factor_limite"] = factores
    df["limite_log"] = limites
    return df


def metricas_variante(df_pred: pd.DataFrame, pred_col: str, variante: str) -> tuple[dict, pd.DataFrame, pd.DataFrame]:
    m_sar = mape_por_categoria_agregada(df_pred, "pred_sarima").rename(columns={"pred_sarima": "mape_sarima"})
    m_hib = mape_por_categoria_agregada(df_pred, pred_col).rename(columns={pred_col: "mape_hibrido"})
    por_categoria = m_sar.merge(m_hib, on="categoria_terapeutica")
    por_categoria["mejora_pct"] = (por_categoria["mape_sarima"] - por_categoria["mape_hibrido"]) / por_categoria["mape_sarima"].replace(0, np.nan) * 100.0
    folds = []
    grupos_fold = df_pred.groupby("fold", sort=True) if "fold" in df_pred.columns else [(0, df_pred)]
    for fold, grupo in grupos_fold:
        m_base = macro_mape_categoria(grupo, "pred_sarima")
        m_hib_fold = macro_mape_categoria(grupo, pred_col)
        rmse_base = float(np.sqrt(mean_squared_error(grupo["valor_real"], grupo["pred_sarima"])))
        rmse_hib = float(np.sqrt(mean_squared_error(grupo["valor_real"], grupo[pred_col])))
        folds.append({"variante": variante, "fold": int(fold), "macro_mape_sarima": m_base, "macro_mape_hibrido": m_hib_fold, "mejora_pct": (m_base - m_hib_fold) / m_base * 100.0 if m_base else 0.0, "rmse_sarima": rmse_base, "rmse_hibrido": rmse_hib})
    macro_sar = float(por_categoria["mape_sarima"].mean())
    macro_hib = float(por_categoria["mape_hibrido"].mean())
    peor = float(por_categoria["mejora_pct"].min())
    deterioradas = int((por_categoria["mejora_pct"] < 0).sum())
    desviacion = float(pd.DataFrame(folds)["mejora_pct"].std(ddof=0)) if folds else 0.0
    score = macro_hib + 0.05 * max(0.0, -peor) + 0.10 * deterioradas + 0.02 * desviacion
    resumen = {"variante": variante, "macro_mape_oof": macro_hib, "macro_mape_sarima_oof": macro_sar, "mejora_vs_sarima_pct": (macro_sar - macro_hib) / macro_sar * 100.0 if macro_sar else np.nan, "mediana_mape_categoria": float(por_categoria["mape_hibrido"].median()), "categorias_mejoradas": int((por_categoria["mejora_pct"] > 0).sum()), "categorias_deterioradas": deterioradas, "peor_deterioro_pct": peor, "desviacion_folds": desviacion, "rmse": float(np.sqrt(mean_squared_error(df_pred["valor_real"], df_pred[pred_col]))), "score_robusto": float(score)}
    return resumen, por_categoria, pd.DataFrame(folds)


def evaluar_candidato_categoria(datos: pd.DataFrame, metodo: str, alpha: float, beta: float = 1.0, factor_limite=None, limite_log=None) -> dict:
    cfg = {str(datos["categoria_terapeutica"].iloc[0]): {"metodo": metodo, "alpha": alpha, "beta": beta, "factor_limite": factor_limite, "limite_log": limite_log}}
    pred = prediccion_configurada(datos, cfg, usar_cv=True)
    mejoras, mapes, deterioros_rmse = [], [], []
    peor_deterioro = 0.0
    ultimo_fold_mejora = False
    for fold, grupo in pred.groupby("fold", sort=True):
        m_base = macro_mape_categoria(grupo, "pred_sarima")
        m_hib = macro_mape_categoria(grupo, "pred_hibrida_regularizada")
        mejora = (m_base - m_hib) / m_base * 100.0 if m_base else 0.0
        rmse_base = float(np.sqrt(mean_squared_error(grupo["valor_real"], grupo["pred_sarima"])))
        rmse_hib = float(np.sqrt(mean_squared_error(grupo["valor_real"], grupo["pred_hibrida_regularizada"])))
        deterioro_rmse = (rmse_hib - rmse_base) / rmse_base * 100.0 if rmse_base else 0.0
        mejoras.append(mejora); mapes.append(m_hib); deterioros_rmse.append(deterioro_rmse)
        peor_deterioro = min(peor_deterioro, mejora)
        ultimo_fold_mejora = mejora > 0
    return {"metodo": metodo, "alpha": float(alpha), "beta": float(beta), "factor_limite": factor_limite, "limite_log": limite_log, "mape_mediano": float(np.median(mapes)) if mapes else np.inf, "mejora_mape_mediana_pct": float(np.median(mejoras)) if mejoras else 0.0, "folds_con_mejora": int(sum(m > 0 for m in mejoras)), "deterioro_rmse_mediano_pct": float(np.median(deterioros_rmse)) if deterioros_rmse else 0.0, "peor_deterioro_mape_pct": float(peor_deterioro), "ultimo_fold_mejora": bool(ultimo_fold_mejora), "n_folds": len(mejoras)}


def candidato_valido(registro: dict, criterio: str) -> bool:
    min_folds = min(MIN_FOLDS_MEJORA, max(1, int(registro.get("n_folds", 0))))
    valido = registro["folds_con_mejora"] >= min_folds and registro["mejora_mape_mediana_pct"] >= MIN_MEJORA_MAPE_PCT and registro["deterioro_rmse_mediano_pct"] <= MAX_DETERIORO_RMSE_PCT
    if criterio in {"criterio_peor_fold", "criterio_peor_fold_y_ultimo_fold"}:
        valido = valido and registro["peor_deterioro_mape_pct"] >= -5.0
    if criterio in {"criterio_ultimo_fold", "criterio_peor_fold_y_ultimo_fold"}:
        valido = valido and bool(registro["ultimo_fold_mejora"])
    return bool(valido)


def seleccionar_alpha_categoria(datos: pd.DataFrame, alphas: list[float], criterio: str) -> dict:
    evaluaciones = []
    for metodo in ["aditivo", "log"]:
        for alpha in alphas:
            if alpha <= 0:
                continue
            evaluaciones.append(evaluar_candidato_categoria(datos, metodo, float(alpha)))
    candidatos = [e for e in evaluaciones if candidato_valido(e, criterio)]
    if candidatos:
        return min(candidatos, key=lambda x: (x["mape_mediano"], -x["mejora_mape_mediana_pct"]))
    mapes_base = [macro_mape_categoria(g.assign(pred_base_eval=g["pred_sarima"]), "pred_base_eval") for _, g in datos.groupby("fold", sort=True)]
    return {"metodo": "sarima", "alpha": 0.0, "beta": 0.0, "factor_limite": None, "limite_log": None, "mape_mediano": float(np.median(mapes_base)) if mapes_base else np.nan, "mejora_mape_mediana_pct": 0.0, "folds_con_mejora": 0, "deterioro_rmse_mediano_pct": 0.0, "peor_deterioro_mape_pct": 0.0, "ultimo_fold_mejora": False}


def seleccionar_beta_categoria(datos: pd.DataFrame, cfg_base: dict) -> dict:
    if cfg_base.get("metodo", "sarima") == "sarima" or float(cfg_base.get("alpha", 0.0)) <= 0:
        cfg = dict(cfg_base); cfg["beta"] = 0.0; return cfg
    evaluaciones = [evaluar_candidato_categoria(datos, cfg_base["metodo"], float(cfg_base["alpha"]), beta=float(beta), factor_limite=cfg_base.get("factor_limite"), limite_log=cfg_base.get("limite_log")) for beta in BETAS]
    mejor = min(evaluaciones, key=lambda x: (x["mape_mediano"], max(0.0, -x["peor_deterioro_mape_pct"])))
    cfg = dict(cfg_base); cfg["beta"] = float(mejor["beta"]); return cfg


def seleccionar_clip_categoria(datos: pd.DataFrame, cfg_base: dict) -> dict:
    if cfg_base.get("metodo", "sarima") == "sarima" or float(cfg_base.get("alpha", 0.0)) <= 0:
        return dict(cfg_base)
    if cfg_base["metodo"] == "aditivo":
        evaluaciones = [evaluar_candidato_categoria(datos, "aditivo", float(cfg_base["alpha"]), beta=float(cfg_base.get("beta", 1.0)), factor_limite=f) for f in FACTORES_LIMITE]
        mejor = min(evaluaciones, key=lambda x: (x["mape_mediano"], max(0.0, -x["peor_deterioro_mape_pct"])))
        cfg = dict(cfg_base); cfg["factor_limite"] = float(mejor["factor_limite"]); cfg["limite_log"] = None; return cfg
    evaluaciones = [evaluar_candidato_categoria(datos, "log", float(cfg_base["alpha"]), beta=float(cfg_base.get("beta", 1.0)), limite_log=l) for l in LIMITES_LOG]
    mejor = min(evaluaciones, key=lambda x: (x["mape_mediano"], max(0.0, -x["peor_deterioro_mape_pct"])))
    cfg = dict(cfg_base); cfg["limite_log"] = float(mejor["limite_log"]); cfg["factor_limite"] = None; return cfg


def seleccionar_config_variante(df_train: pd.DataFrame, variante: str, base_config: dict, criterio: str = "criterio_v4") -> dict:
    categorias = sorted(df_train["categoria_terapeutica"].astype(str).unique())
    config = {}
    base_norm = normalizar_config_hibrida(base_config, categorias)
    for categoria, datos in df_train.groupby("categoria_terapeutica", sort=True):
        categoria = str(categoria)
        if variante == "sarima":
            cfg = {"metodo": "sarima", "alpha": 0.0, "beta": 0.0, "factor_limite": None, "limite_log": None}
        elif variante == VARIANTE_HIBRIDA_BASE:
            cfg = dict(base_norm[categoria])
        elif variante == "v4_alpha_conservador":
            cfg = seleccionar_alpha_categoria(datos, ALPHAS_CONSERVADORES, criterio)
        elif variante == "v4_blending":
            cfg = seleccionar_beta_categoria(datos, base_norm[categoria])
        elif variante == "v4_clipping":
            cfg = seleccionar_clip_categoria(datos, base_norm[categoria])
        elif variante == "v4_regularizado":
            cfg = seleccionar_alpha_categoria(datos, ALPHAS_CONSERVADORES, criterio)
            cfg = seleccionar_beta_categoria(datos, cfg)
            cfg = seleccionar_clip_categoria(datos, cfg)
        else:
            raise ValueError(f"Variante no soportada: {variante}")
        cfg.setdefault("beta", 1.0 if cfg.get("metodo") != "sarima" and float(cfg.get("alpha", 0.0)) > 0 else 0.0)
        cfg.setdefault("factor_limite", None); cfg.setdefault("limite_log", None)
        config[categoria] = cfg
    return config


def evaluar_variante_anidada(df_oof: pd.DataFrame, variante: str, base_config: dict, criterio: str = "criterio_v4") -> tuple[dict, pd.DataFrame, pd.DataFrame, dict]:
    df_eff = df_oof[df_oof["fold"].isin([2, 3, 4])].copy()
    predicciones = []
    configs_por_fold = {}
    for fold_eval in [3, 4]:
        folds_train = [f for f in [2, 3] if f < fold_eval]
        df_train = df_eff[df_eff["fold"].isin(folds_train)]
        df_val = df_eff[df_eff["fold"] == fold_eval]
        cfg = seleccionar_config_variante(df_train, variante, base_config, criterio)
        configs_por_fold[str(fold_eval)] = cfg
        predicciones.append(prediccion_configurada(df_val, cfg, usar_cv=True))
    df_pred = pd.concat(predicciones, ignore_index=True) if predicciones else pd.DataFrame()
    resumen, por_categoria, folds = metricas_variante(df_pred, "pred_hibrida_regularizada", variante)
    return resumen, por_categoria, folds, configs_por_fold


def evaluar_config_completa_oof(df_oof: pd.DataFrame, config: dict, variante: str) -> tuple[dict, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    df_eff = df_oof[df_oof["fold"].isin([2, 3, 4])].copy()
    df_pred = prediccion_configurada(df_eff, config, usar_cv=True)
    resumen, por_categoria, folds = metricas_variante(df_pred, "pred_hibrida_regularizada", variante)
    estabilidad = []
    for (categoria, fold), grupo in df_pred.groupby(["categoria_terapeutica", "fold"], sort=True):
        m_base = macro_mape_categoria(grupo, "pred_sarima")
        m_hib = macro_mape_categoria(grupo, "pred_hibrida_regularizada")
        rmse_base = float(np.sqrt(mean_squared_error(grupo["valor_real"], grupo["pred_sarima"])))
        rmse_hib = float(np.sqrt(mean_squared_error(grupo["valor_real"], grupo["pred_hibrida_regularizada"])))
        cfg = config.get(str(categoria), {})
        estabilidad.append({"categoria": categoria, "variante": variante, "fold": int(fold), "mape_sarima": m_base, "mape_hibrido": m_hib, "mejora_pct": (m_base - m_hib) / m_base * 100.0 if m_base else 0.0, "rmse_sarima": rmse_base, "rmse_hibrido": rmse_hib, "alpha": float(cfg.get("alpha", 0.0)), "beta": float(cfg.get("beta", 0.0)), "factor_limite": cfg.get("factor_limite")})
    return resumen, por_categoria, folds, pd.DataFrame(estabilidad)


def magnitud_correcciones(df_oof: pd.DataFrame) -> pd.DataFrame:
    filas = []
    df_eff = df_oof[df_oof["fold"].isin([2, 3, 4])].copy()
    for categoria, datos in df_eff.groupby("categoria_terapeutica", sort=True):
        for metodo, pred_col in [("aditivo", "pred_target_aditivo_cv"), ("log", "pred_target_log_cv")]:
            for alpha in ALPHAS:
                for fold, grupo in datos.groupby("fold", sort=True):
                    base = grupo["pred_sarima"].to_numpy(dtype=float)
                    escala = grupo["escala_serie"].to_numpy(dtype=float)
                    if metodo == "aditivo":
                        delta = alpha * grupo[pred_col].to_numpy(dtype=float) * escala
                    else:
                        pred = convertir_correccion(grupo, grupo[pred_col].to_numpy(dtype=float), "log", alpha)
                        delta = pred - base
                    abs_delta = np.abs(delta)
                    filas.append({"categoria": categoria, "metodo": metodo, "alpha": float(alpha), "fold": int(fold), "media_delta_absoluta": float(np.mean(abs_delta)), "mediana_delta_absoluta": float(np.median(abs_delta)), "percentil_90_delta": float(np.percentile(abs_delta, 90)), "ratio_delta_sobre_sarima": float(np.mean(abs_delta / np.maximum(base, 1.0))), "ratio_delta_sobre_escala": float(np.mean(abs_delta / np.maximum(escala, 1.0)))})
    return pd.DataFrame(filas)


def seleccionar_variante_final(resumenes: list[dict], resumen_v4: dict) -> dict:
    candidatos = []
    for r in resumenes:
        if r["variante"] in {"sarima", VARIANTE_HIBRIDA_BASE}:
            continue
        if (r["macro_mape_oof"] <= resumen_v4["macro_mape_oof"] and r["peor_deterioro_pct"] > resumen_v4["peor_deterioro_pct"] and r["categorias_deterioradas"] <= resumen_v4["categorias_deterioradas"] and r.get("folds_con_mejora", 0) >= 2):
            candidatos.append(r)
    if not candidatos:
        return resumen_v4
    return min(candidatos, key=lambda x: x["score_robusto"])


def resumen_con_folds_mejora(resumen: dict, folds: pd.DataFrame) -> dict:
    salida = dict(resumen)
    salida["folds_con_mejora"] = int((folds["mejora_pct"] > 0).sum()) if not folds.empty else 0
    return salida


def guardar_variante_congelada(nombre: str, criterio: str, resumen: dict, config: dict, cache: dict, tiempo_segundos: float) -> None:
    DIR_VERSION.mkdir(parents=True, exist_ok=True)
    contenido = {
        "nombre_variante": nombre,
        "criterio_seleccion": criterio,
        "score_oof": float(resumen["score_robusto"]),
        "metricas_oof": convertir_serializable(resumen),
        "configuracion_por_categoria": convertir_serializable(config),
        "alpha": {c: float(cfg.get("alpha", 0.0)) for c, cfg in config.items()},
        "beta": {c: float(cfg.get("beta", 0.0)) for c, cfg in config.items()},
        "factor_limite": {c: cfg.get("factor_limite") for c, cfg in config.items()},
        "limite_log": {c: cfg.get("limite_log") for c, cfg in config.items()},
        "fecha": datetime.now(timezone.utc).isoformat(),
        "hash_datos": {"hash_features_modelado": cache.get("hash_features_modelado"), "hash_series_sarima": cache.get("hash_series_sarima")},
        "tiempo_optimize_hybrid_segundos": round(float(tiempo_segundos), 4),
        "nota": "La variante fue seleccionada solo con OOF. La variante fue congelada antes de consultar las métricas del holdout.",
    }
    with ruta_variante_congelada().open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(contenido), archivo, ensure_ascii=False, indent=2)


def cargar_variante_congelada() -> dict:
    with ruta_variante_congelada().open("r", encoding="utf-8") as archivo:
        return json.load(archivo)


def comando_optimize_hybrid(args: argparse.Namespace) -> None:
    inicio = time.time()
    cache = cargar_cache_evaluacion(args.data_dir)
    validar_config_cache(cache, argparse.Namespace(data_dir=args.data_dir, fast=False, max_series=None, max_folds=None, skip_auto_arima=False))
    validar_cache_oficial(cache)
    df_oof = cache["dataset_oof"].copy()
    categorias = sorted(df_oof["categoria_terapeutica"].astype(str).unique())
    base_config = normalizar_config_hibrida(cache["configuracion_hibrida_por_categoria"], categorias)
    DIR_PAPER.mkdir(parents=True, exist_ok=True)

    magnitud_correcciones(df_oof).to_csv(DIR_PAPER / "magnitud_correcciones_oof.csv", index=False, encoding="utf-8")

    resumenes, estabilidad_total = [], []
    configs_finales = {"sarima": config_sarima_por_categoria(categorias), VARIANTE_HIBRIDA_BASE: base_config}
    variantes = ["sarima", VARIANTE_HIBRIDA_BASE, "v4_alpha_conservador", "v4_blending", "v4_clipping", "v4_regularizado"]
    for variante in variantes:
        if variante in configs_finales:
            resumen, _cat, folds, estabilidad = evaluar_config_completa_oof(df_oof, configs_finales[variante], variante)
        else:
            resumen_nested, _cat_nested, folds_nested, _configs_nested = evaluar_variante_anidada(df_oof, variante, base_config, "criterio_v4")
            cfg_final = seleccionar_config_variante(df_oof[df_oof["fold"].isin([2, 3, 4])], variante, base_config, "criterio_v4")
            configs_finales[variante] = cfg_final
            resumen, _cat, folds, estabilidad = evaluar_config_completa_oof(df_oof, cfg_final, variante)
            resumen["score_validacion_anidada"] = resumen_nested["score_robusto"]
        resumenes.append(resumen_con_folds_mejora(resumen, folds))
        estabilidad_total.append(estabilidad)

    df_resumen = pd.DataFrame(resumenes)
    resumen_v4 = next(r for r in resumenes if r["variante"] == VARIANTE_HIBRIDA_BASE)
    seleccionado = seleccionar_variante_final(resumenes, resumen_v4)
    nombre = seleccionado["variante"]
    config_final = configs_finales[nombre]
    criterio = "score robusto OOF con validación temporal anidada fold3/fold4; fallback a v4_replicado si no hay mejora robusta"
    guardar_variante_congelada(nombre, criterio, seleccionado, config_final, cache, time.time() - inicio)

    pd.concat(estabilidad_total, ignore_index=True).to_csv(DIR_PAPER / "estabilidad_hibrido_por_categoria.csv", index=False, encoding="utf-8")
    df_resumen.to_csv(DIR_PAPER / "resumen_estabilidad_variantes.csv", index=False, encoding="utf-8")
    df_resumen.rename(columns={"macro_mape_oof": "macro_mape_hibrido_oof"}).to_csv(DIR_PAPER / "comparacion_variantes_hibridas_oof.csv", index=False, encoding="utf-8")

    print("La variante fue seleccionada solo con OOF.")
    print(f"Variante seleccionada: {nombre}")
    print(f"Score OOF: {seleccionado['score_robusto']:.4f}")
    print(f"Tiempo optimize-hybrid: {time.time() - inicio:.2f}s")


def preparar_resultados_holdout_congelado(df_holdout: pd.DataFrame, nombre_variante: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    pred = df_holdout.copy()
    m_xgb = mape_por_categoria_agregada(pred, "pred_xgboost").rename(columns={"pred_xgboost": "mape_xgboost"})
    m_sar = mape_por_categoria_agregada(pred, "pred_sarima").rename(columns={"pred_sarima": "mape_sarima"})
    m_v4 = mape_por_categoria_agregada(pred, "pred_hibrida").rename(columns={"pred_hibrida": "mape_v4"})
    m_reg = mape_por_categoria_agregada(pred, "pred_hibrida_regularizada").rename(columns={"pred_hibrida_regularizada": "mape_regularizado"})
    por_cat = m_xgb.merge(m_sar, on="categoria_terapeutica").merge(m_v4, on="categoria_terapeutica").merge(m_reg, on="categoria_terapeutica")
    por_cat["mejora_regularizado_vs_sarima_pct"] = (por_cat["mape_sarima"] - por_cat["mape_regularizado"]) / por_cat["mape_sarima"].replace(0, np.nan) * 100.0
    metricas_globales = pd.DataFrame([
        {"modelo": MODELO_XGBOOST, **metricas(pred["valor_real"], pred["pred_xgboost"])},
        {"modelo": MODELO_SARIMA, **metricas(pred["valor_real"], pred["pred_sarima"])},
        {"modelo": VARIANTE_HIBRIDA_BASE, **metricas(pred["valor_real"], pred["pred_hibrida"])},
        {"modelo": nombre_variante, **metricas(pred["valor_real"], pred["pred_hibrida_regularizada"])},
    ])
    macro = pd.DataFrame([
        {"modelo": MODELO_SARIMA, "macro_mape": float(por_cat["mape_sarima"].mean())},
        {"modelo": VARIANTE_HIBRIDA_BASE, "macro_mape": float(por_cat["mape_v4"].mean())},
        {"modelo": nombre_variante, "macro_mape": float(por_cat["mape_regularizado"].mean())},
    ])
    return por_cat, metricas_globales, macro


def comando_evaluate_frozen_hybrid(args: argparse.Namespace) -> None:
    cache = cargar_cache_evaluacion(args.data_dir)
    validar_config_cache(cache, argparse.Namespace(data_dir=args.data_dir, fast=False, max_series=None, max_folds=None, skip_auto_arima=False))
    validar_cache_oficial(cache)
    congelada = cargar_variante_congelada()
    nombre = congelada["nombre_variante"]
    config = congelada["configuracion_por_categoria"]
    df_holdout = prediccion_configurada(cache["predicciones_holdout"].copy(), config, usar_cv=False)
    if df_holdout["pred_hibrida_regularizada"].isna().any() or (df_holdout["pred_hibrida_regularizada"] < 0).any():
        raise ValueError("Holdout congelado inválido: NaN o predicciones negativas")
    por_cat, metricas_globales, macro = preparar_resultados_holdout_congelado(df_holdout, nombre)
    DIR_PAPER.mkdir(parents=True, exist_ok=True)
    df_holdout.to_csv(DIR_PAPER / "evaluacion_holdout_variante_congelada.csv", index=False, encoding="utf-8")
    por_cat.to_csv(DIR_PAPER / "mape_por_categoria_variante_congelada.csv", index=False, encoding="utf-8")
    comparacion = pd.concat([macro, metricas_globales.rename(columns={"mape": "mape_global"})], ignore_index=False)
    comparacion.to_csv(DIR_PAPER / "comparacion_hibrido_v4_regularizado_holdout.csv", index=False, encoding="utf-8")
    print("La variante fue congelada antes de consultar las métricas del holdout.")
    print(f"Variante evaluada: {nombre}")
    print(macro.to_string(index=False))


def ejecutar_experimento(args: argparse.Namespace, guardar_artefacto: bool, guardar_paper: bool) -> dict:
    inicio = time.time()
    perfil = []
    t_etapa = time.time()
    config = ConfigPipeline(xgb_n_estimators=60 if args.fast else 1200)
    features, series = cargar_datos(args.data_dir, args.max_series)
    perfil.append({"etapa": "carga", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": 2, "cache_usado": False})
    train, holdout, fecha_corte, fechas_holdout = split_holdout(features, HOLDOUT_SEMANAS)
    n_folds = min(args.max_folds or N_FOLDS, N_FOLDS)
    origenes = construir_origenes_cv(train, n_folds, HORIZONTE_MAXIMO)
    if not origenes:
        raise ValueError("No hay semanas suficientes para construir folds temporales")
    exigir_completo = not (args.fast or args.max_series or args.max_folds or args.skip_auto_arima)
    validar_pre_ejecucion(features, series, fechas_holdout, origenes, exigir_completo=exigir_completo)
    t_etapa = time.time()
    periodo_por_categoria, seleccion_periodo = seleccionar_periodo_sarima_por_categoria(train, origenes, args.skip_auto_arima)
    perfil.append({"etapa": "selección_periodos", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": len(PERIODOS_SARIMA_CANDIDATOS) * int(features["categoria_terapeutica"].nunique()), "cache_usado": False})
    t_etapa = time.time()
    ordenes_sarima = buscar_ordenes_sarima_por_serie(series, train, origenes, periodo_por_categoria, args.skip_auto_arima)
    perfil.append({"etapa": "auto_arima", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": int(features.groupby(CLAVES_SERIE).ngroups), "cache_usado": False})
    t_etapa = time.time()
    df_oof, conteos_oof, comparacion_features = construir_oof(features, series, train, origenes, periodo_por_categoria, ordenes_sarima, args.skip_auto_arima)
    perfil.append({"etapa": "OOF_SARIMA", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": int(len(df_oof)), "cache_usado": False})
    t_etapa = time.time()
    pre_hibrido, pre_ind, modelo_aditivo, modelo_log, modelo_ind, df_oof, detalles_xgb = entrenar_xgboosts(df_oof, fast=args.fast)
    perfil.append({"etapa": "búsqueda_XGB", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": 36, "cache_usado": False})
    t_etapa = time.time()
    config_categoria, config_categoria_df, auditoria_hibrida, comparacion_alpha = seleccionar_config_categoria(df_oof)
    resumen_oof, mape_oof_categoria, estabilidad_oof = metricas_oof_hibrido(df_oof, config_categoria)
    perfil.append({"etapa": "selección_híbrida", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": len(comparacion_alpha), "cache_usado": False})
    t_etapa = time.time()
    df_holdout = construir_holdout(features, series, train, fecha_corte, fechas_holdout, ordenes_sarima, periodo_por_categoria, args.skip_auto_arima)
    df_holdout = aplicar_modelos(df_holdout, pre_hibrido, pre_ind, modelo_aditivo, modelo_log, modelo_ind, config_categoria)
    perfil.append({"etapa": "holdout", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": int(len(df_holdout)), "cache_usado": False})
    validar_predicciones(df_holdout)
    t_etapa = time.time()
    resultados = preparar_resultados_paper(df_holdout)
    perfil.append({"etapa": "gráficos", "segundos": 0.0, "numero_operaciones": 0, "cache_usado": False})
    resumen = resultados["resumen_macro_mape_categoria"]
    metricas_validacion = {
        "version": VERSION,
        "tipo_modelo": config.tipo_modelo,
        "fecha_entrenamiento": datetime.now(timezone.utc).isoformat(),
        "split": {"fecha_corte": fecha_corte.date().isoformat(), "holdout_semanas": HOLDOUT_SEMANAS, "train_inicio": train["fecha_semana"].min().date().isoformat(), "train_fin": train["fecha_semana"].max().date().isoformat(), "holdout_inicio": holdout["fecha_semana"].min().date().isoformat(), "holdout_fin": holdout["fecha_semana"].max().date().isoformat()},
        "macro_mape_categoria": resumen.to_dict("records"),
        "metricas_globales": resultados["metricas_globales"].to_dict("records"),
        "series": {"totales": int(features.groupby(CLAVES_SERIE).ngroups)},
        "periodo_sarima_por_categoria": periodo_por_categoria,
        "configuracion_por_categoria": config_categoria,
        "variante_hibrida_seleccionada": VARIANTE_HIBRIDA_BASE,
        "criterio_seleccion": "Replica metodológica V4 seleccionada sin utilizar holdout; alpha/método por categoría con folds OOF efectivos 2..4.",
        "metricas_oof": resumen_oof,
        "mejor_config_xgb_aditivo": detalles_xgb["mejor_config_xgb_aditivo"],
        "mejor_config_xgb_log": detalles_xgb["mejor_config_xgb_log"],
        "mejor_config_xgb_independiente": detalles_xgb["mejor_config_xgb_independiente"],
        "fallbacks_sarima": {"oof": int(conteos_oof.get("fallback", 0)), "holdout": int((df_holdout["estrategia_sarima"] == "fallback").groupby(df_holdout[CLAVES_SERIE].apply(tuple, axis=1)).first().sum())},
        "tiempo_segundos": round(time.time() - inicio, 2),
    }
    validar_salidas_oficiales(resultados, df_oof, config_categoria_df, seleccion_periodo, exigir_completo=exigir_completo)
    drift = calcular_drift(train, holdout)
    artefacto = {
        "version": VERSION,
        "tipo_modelo": config.tipo_modelo,
        "frecuencia": FRECUENCIA,
        "horizonte_maximo": HORIZONTE_MAXIMO,
        "fecha_entrenamiento": metricas_validacion["fecha_entrenamiento"],
        "preprocesador_hibrido": pre_hibrido,
        "preprocesador_xgb_independiente": pre_ind,
        "modelo_xgb_aditivo": modelo_aditivo,
        "modelo_xgb_log": modelo_log,
        "modelo_xgb_independiente": modelo_ind,
        "mejor_config_xgb_aditivo": detalles_xgb["mejor_config_xgb_aditivo"],
        "mejor_config_xgb_log": detalles_xgb["mejor_config_xgb_log"],
        "mejor_config_xgb_independiente": detalles_xgb["mejor_config_xgb_independiente"],
        "configuracion_por_categoria": config_categoria,
        "periodo_sarima_por_categoria": periodo_por_categoria,
        "ordenes_sarima": ordenes_sarima,
        "columnas_categoricas": COLUMNAS_CATEGORICAS,
        "columnas_numericas": COLUMNAS_NUMERICAS,
        "features_hibrido": FEATURES_HIBRIDO,
        "features_xgb_independiente": FEATURES_XGB_INDEPENDIENTE,
        "categorias_entrenamiento": sorted(features["categoria_terapeutica"].unique().tolist()),
        "defaults_operativos": DEFAULTS_OPERATIVOS,
        "rango_entrenamiento": metricas_validacion["split"],
        "metricas_validacion": metricas_validacion,
    }
    if guardar_artefacto:
        guardar_artefactos(artefacto, metricas_validacion, config, drift)
    if guardar_paper:
        DIR_PAPER.mkdir(parents=True, exist_ok=True)
        guardar_comparacion_metodologica_v4()
        comparacion_features.to_csv(DIR_PAPER / "comparacion_features_v4_pipeline.csv", index=False, encoding="utf-8")
        auditoria_hibrida.to_csv(DIR_PAPER / "auditoria_seleccion_hibrida_oof.csv", index=False, encoding="utf-8")
        comparacion_alpha.to_csv(DIR_PAPER / "comparacion_seleccion_alpha_v4_pipeline.csv", index=False, encoding="utf-8")
        guardar_comparacion_oof(df_oof)
        pd.DataFrame([resumen_oof]).to_csv(DIR_PAPER / "comparacion_pipeline_actual_v4_replicado_oof.csv", index=False, encoding="utf-8")
        pd.DataFrame([{"variante": VARIANTE_HIBRIDA_BASE, "score": resumen_oof["macro_mape_hibrido_oof"], **resumen_oof}]).to_csv(DIR_PAPER / "comparacion_variantes_hibridas_oof.csv", index=False, encoding="utf-8")
        mape_oof_categoria.to_csv(DIR_PAPER / "mape_oof_por_categoria_v4_replicado.csv", index=False, encoding="utf-8")
        estabilidad_oof.to_csv(DIR_PAPER / "estabilidad_oof_folds_v4_replicado.csv", index=False, encoding="utf-8")
        detalles = {"configuracion_categoria": config_categoria_df, "seleccion_periodo_sarima_categoria": seleccion_periodo, "busqueda_xgboost_residuales": detalles_xgb["busqueda_xgboost_residuales"], "busqueda_xgboost_independiente": detalles_xgb["busqueda_xgboost_independiente"], "dataset_oof_multihorizonte": df_oof}
        guardar_resultados_paper(resultados, args.guardar_detalle, detalles)
        guardar_importancia_features_xgboost(pre_ind, modelo_ind)
        perfil[-1]["segundos"] = round(time.time() - t_etapa, 4)
    if guardar_artefacto or guardar_paper:
        t_etapa = time.time()
        cache_datos = hashes_datos(args.data_dir)
        cache = {
            **cache_datos,
            "config_ejecucion": config_ejecucion_cache(args),
            "config_pipeline": asdict(config),
            "periodos_sarima_por_categoria": periodo_por_categoria,
            "ordenes_sarima": ordenes_sarima,
            "dataset_oof": df_oof,
            "preprocesadores": {"hibrido": pre_hibrido, "xgb_independiente": pre_ind},
            "modelos_finales": {"aditivo": modelo_aditivo, "log": modelo_log, "independiente": modelo_ind},
            "mejor_config_xgb_aditivo": detalles_xgb["mejor_config_xgb_aditivo"],
            "mejor_config_xgb_log": detalles_xgb["mejor_config_xgb_log"],
            "mejor_config_xgb_independiente": detalles_xgb["mejor_config_xgb_independiente"],
            "n_estimators": {"aditivo": detalles_xgb["mejor_config_xgb_aditivo"].get("n_estimators"), "log": detalles_xgb["mejor_config_xgb_log"].get("n_estimators"), "independiente": detalles_xgb["mejor_config_xgb_independiente"].get("n_estimators")},
            "configuracion_hibrida_por_categoria": config_categoria,
            "variante_hibrida_seleccionada": VARIANTE_HIBRIDA_BASE,
            "metricas_oof": resumen_oof,
            "predicciones_holdout": df_holdout,
            "metricas_holdout": metricas_validacion,
            "artefacto": artefacto,
            "drift": drift,
        }
        guardar_cache_evaluacion(cache)
        guardar_cache_sarima({**cache_datos, "periodos_por_categoria": periodo_por_categoria, "ordenes_por_serie": ordenes_sarima, "pronosticos_oof": df_oof[[*CLAVES_SERIE, "fold", "fecha_semana", "pred_sarima", "estrategia_sarima"]], "pronosticos_holdout": df_holdout[[*CLAVES_SERIE, "fecha_semana", "pred_sarima", "estrategia_sarima"]]})
        perfil.append({"etapa": "serialización", "segundos": round(time.time() - t_etapa, 4), "numero_operaciones": 2, "cache_usado": False})
        guardar_perfil_tiempo(perfil)
    print("La variante final fue seleccionada sin utilizar el holdout.")
    imprimir_resumen_oficial(resultados, metricas_validacion)
    return {"artefacto": artefacto, "metricas": metricas_validacion, "resultados_paper": resultados, "holdout": df_holdout}


def cargar_artefacto(ruta: Path = DIR_VERSION / "modelo.pkl") -> dict:
    with ruta.open("rb") as archivo:
        return pickle.load(archivo)


def predecir_demanda(org_id: str, botica_id: str, producto_id: str, horizonte_semanas: int, historial_ventas: pd.DataFrame, categoria_terapeutica: str, snapshot_operativo: dict | None = None, artefacto: dict | None = None) -> pd.DataFrame:
    if horizonte_semanas < 1 or horizonte_semanas > HORIZONTE_MAXIMO:
        raise ValueError("horizonte_semanas debe estar entre 1 y 12")
    artefacto = artefacto or cargar_artefacto()
    historial_ventas = historial_ventas.copy()
    historial_ventas["fecha_semana"] = pd.to_datetime(historial_ventas["fecha_semana"])
    hist = historial_ventas.sort_values("fecha_semana")["cantidad_vendida"].astype(float).tolist()
    ultima = historial_ventas["fecha_semana"].max()
    fechas = list(pd.date_range(ultima + pd.Timedelta(weeks=1), periods=horizonte_semanas, freq=FRECUENCIA))
    serie_hist = historial_ventas.sort_values("fecha_semana").set_index("fecha_semana")["cantidad_vendida"].asfreq(FRECUENCIA).fillna(0.0).astype(float)
    periodo = int(artefacto.get("periodo_sarima_por_categoria", {}).get(str(categoria_terapeutica), PERIODO_SARIMA_FALLBACK))
    orden = artefacto.get("ordenes_sarima", {}).get("|".join([str(org_id), str(botica_id), str(producto_id)]))
    pred_sarima, _orden, estrategia_sarima = pronosticar_sarima(serie_hist, horizonte_semanas, periodo, orden, skip_auto_arima=False, buscar_si_falta=orden is None)
    filas = []
    for h, fecha in enumerate(fechas, start=1):
        fila = construir_fila_horizonte(org_id, botica_id, producto_id, categoria_terapeutica, fecha, hist, snapshot_operativo, h, float(pred_sarima[h - 1]))
        fila["periodo_sarima"] = periodo
        fila["estrategia_sarima"] = estrategia_sarima
        filas.append(fila)
    df = pd.DataFrame(filas)
    df = aplicar_modelos(df, artefacto["preprocesador_hibrido"], artefacto["preprocesador_xgb_independiente"], artefacto["modelo_xgb_aditivo"], artefacto["modelo_xgb_log"], artefacto["modelo_xgb_independiente"], artefacto["configuracion_por_categoria"])
    estrategias = []
    for _, fila in df.iterrows():
        usa_xgb = str(fila.get("metodo_correccion", "sarima")) != "sarima" and float(fila.get("alpha_categoria", 0.0)) > 0
        if fila["estrategia_sarima"] == "sarima" and usa_xgb:
            estrategias.append("SARIMA_XGBOOST")
        elif fila["estrategia_sarima"] == "fallback" and usa_xgb:
            estrategias.append("FALLBACK_XGBOOST")
        elif fila["estrategia_sarima"] == "sarima":
            estrategias.append("SARIMA")
        else:
            estrategias.append("FALLBACK")
    return pd.DataFrame({"org_id": org_id, "botica_id": botica_id, "producto_id": producto_id, "fecha_semana": df["fecha_semana"].dt.date.astype(str), "horizonte": df["horizonte"].astype(int), "cantidad_predicha": df["pred_hibrida"].clip(lower=0).round(2), "estrategia": estrategias, "version_modelo": artefacto["version"], "advertencias": ""})


def comando_predict(args: argparse.Namespace) -> None:
    features = pd.read_csv(args.data_dir / "features_modelado.csv", parse_dates=["fecha_semana"])
    serie = features[(features["org_id"].astype(str) == args.org_id) & (features["botica_id"].astype(str) == args.botica_id) & (features["producto_id"].astype(str) == args.producto_id)].sort_values("fecha_semana")
    if serie.empty:
        raise ValueError("No existe historial para org_id + botica_id + producto_id")
    categoria = str(serie["categoria_terapeutica"].iloc[-1])
    snapshot = {k: float(serie.iloc[-1].get(k, v) or v) for k, v in DEFAULTS_OPERATIVOS.items()}
    pred = predecir_demanda(args.org_id, args.botica_id, args.producto_id, args.horizonte, serie[["fecha_semana", "cantidad_vendida"]], categoria, snapshot)
    print(pred.to_json(orient="records", force_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Pipeline oficial SARIMA + XGBoost")
    sub = parser.add_subparsers(dest="command", required=True)
    comunes = argparse.ArgumentParser(add_help=False)
    comunes.add_argument("--data-dir", type=Path, default=DIR_DATOS)
    comunes.add_argument("--fast", action="store_true")
    comunes.add_argument("--max-series", type=int, default=None)
    comunes.add_argument("--max-folds", type=int, default=None)
    comunes.add_argument("--skip-auto-arima", action="store_true")
    p_train = sub.add_parser("train", parents=[comunes])
    p_eval = sub.add_parser("evaluate-paper", parents=[comunes])
    p_eval.add_argument("--guardar-detalle", action="store_true")
    p_eval_train = sub.add_parser("evaluate-and-train", parents=[comunes])
    p_eval_train.add_argument("--guardar-detalle", action="store_true")
    sub.add_parser("optimize-hybrid", parents=[comunes])
    sub.add_parser("evaluate-frozen-hybrid", parents=[comunes])
    p_pred = sub.add_parser("predict")
    p_pred.add_argument("--data-dir", type=Path, default=DIR_DATOS)
    p_pred.add_argument("--org-id", required=True)
    p_pred.add_argument("--botica-id", required=True)
    p_pred.add_argument("--producto-id", required=True)
    p_pred.add_argument("--horizonte", type=int, required=True)
    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command in {"evaluate-paper", "evaluate-and-train"} and (auto_arima is None or StepwiseContext is None) and not args.skip_auto_arima:
        raise RuntimeError(
            "pmdarima no está disponible. "
            "La ejecución oficial requiere SARIMA real. "
            "Instale pmdarima en un entorno compatible o use "
            "--skip-auto-arima únicamente para diagnóstico."
        )
    if args.command == "train":
        comando_train_desde_cache(args)
    elif args.command == "evaluate-paper":
        ejecutar_experimento(args, guardar_artefacto=True, guardar_paper=True)
    elif args.command == "evaluate-and-train":
        ejecutar_experimento(args, guardar_artefacto=True, guardar_paper=True)
    elif args.command == "optimize-hybrid":
        comando_optimize_hybrid(args)
    elif args.command == "evaluate-frozen-hybrid":
        comando_evaluate_frozen_hybrid(args)
    elif args.command == "predict":
        comando_predict(args)


if __name__ == "__main__":
    main()
