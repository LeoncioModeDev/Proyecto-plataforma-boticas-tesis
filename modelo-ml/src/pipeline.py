# -*- coding: utf-8 -*-
"""
Pipeline SARIMA + XGBoost para predicción de demanda farmacéutica.

El pipeline consume los archivos preparados por feature_engineering.py:
data/series_sarima.csv y data/features_modelado.csv.
"""

from __future__ import annotations

import json
import logging
import pickle
import time
import uuid
import warnings
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import OrdinalEncoder
from statsmodels.tools.sm_exceptions import ConvergenceWarning, ValueWarning
from statsmodels.tsa.statespace.sarimax import SARIMAX
from xgboost import XGBRegressor


# Se silencian solo advertencias conocidas de inicialización; la convergencia se evalúa explícitamente.
warnings.filterwarnings("ignore", category=UserWarning, message=".*Non-stationary.*")
warnings.filterwarnings("ignore", category=UserWarning, message=".*Non-invertible.*")
warnings.filterwarnings("ignore", category=ValueWarning, message=".*No frequency information.*")

RAIZ_MODELO = Path(__file__).parents[1]


@dataclass(frozen=True)
class ConfigPipeline:
    ruta_series_sarima: Path = RAIZ_MODELO / "data" / "series_sarima.csv"
    ruta_features_modelado: Path = RAIZ_MODELO / "data" / "features_modelado.csv"
    dir_version: Path = RAIZ_MODELO / "modelos" / "v1.0.0"
    version: str = "v1.0.0"
    semilla: int = 42
    frecuencia: str = "W-MON"
    semanas_holdout: int = 12
    horizonte_semanas: int = 12
    sarima_order: tuple[int, int, int] = (1, 1, 1)
    sarima_seasonal_order: tuple[int, int, int, int] = (1, 0, 0, 52)
    sarima_maxiter: int = 50
    semanas_minimas_sarima: int = 104
    xgb_n_estimators: int = 180
    xgb_max_depth: int = 4
    xgb_learning_rate: float = 0.05
    xgb_subsample: float = 0.85
    xgb_colsample_bytree: float = 0.85
    nivel_confianza: float = 0.90
    umbral_retrain_psi: float = 0.20
    umbral_alerta_psi: float = 0.30


CFG = ConfigPipeline()

COLUMNAS_CATEGORICAS = ["producto_id", "botica_id", "categoria_terapeutica"]
COLUMNAS_FEATURES = [
    "producto_id",
    "botica_id",
    "categoria_terapeutica",
    "anio",
    "mes",
    "trimestre",
    "semana_anio",
    "es_invierno",
    "es_verano",
    "stock_inicio_semana",
    "lead_time_dias",
    "ratio_stock_minimo",
    "ratio_stock_maximo",
    "stock_bajo_minimo",
    "sobrestock",
    "lag_1",
    "lag_2",
    "lag_4",
    "lag_8",
    "lag_12",
    "rolling_mean_4",
    "rolling_mean_8",
    "rolling_mean_12",
    "variacion_1_semana",
    "variacion_4_semanas",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pipeline-ml")


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


def crear_xgboost():
    return XGBRegressor(
        n_estimators=CFG.xgb_n_estimators,
        max_depth=CFG.xgb_max_depth,
        learning_rate=CFG.xgb_learning_rate,
        subsample=CFG.xgb_subsample,
        colsample_bytree=CFG.xgb_colsample_bytree,
        random_state=CFG.semilla,
        n_jobs=-1,
        tree_method="hist",
        objective="reg:squarederror",
        verbosity=0,
    )


def cargar_datos():
    series = pd.read_csv(CFG.ruta_series_sarima)
    features = pd.read_csv(CFG.ruta_features_modelado)
    series["fecha_semana"] = pd.to_datetime(series["fecha_semana"], errors="coerce")
    features["fecha_semana"] = pd.to_datetime(features["fecha_semana"], errors="coerce")
    series = series.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)
    features = features.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)
    return series, features


def validar_datos(series, features):
    for nombre, df in {"series_sarima": series, "features_modelado": features}.items():
        if df.isna().sum().sum() > 0:
            raise ValueError(f"{nombre} contiene valores nulos.")
        duplicados = df.duplicated(["fecha_semana", "producto_id", "botica_id"]).sum()
        if duplicados > 0:
            raise ValueError(f"{nombre} contiene {duplicados} duplicados producto-botica-fecha.")

    faltantes = set(COLUMNAS_FEATURES + ["cantidad_vendida", "demanda_insatisfecha", "sobrestock"]) - set(features.columns)
    if faltantes:
        raise ValueError(f"Faltan columnas en features_modelado.csv: {sorted(faltantes)}")

    for nombre, df in {"series_sarima": series, "features_modelado": features}.items():
        for clave, grupo in df.groupby(["producto_id", "botica_id"]):
            fechas = grupo["fecha_semana"].sort_values().reset_index(drop=True)
            esperado = pd.Series(pd.date_range(fechas.min(), fechas.max(), freq=CFG.frecuencia))
            if len(fechas) != len(esperado) or not fechas.equals(esperado):
                raise ValueError(f"{nombre} no tiene frecuencia semanal completa para {clave}.")


def split_cronologico(features):
    semanas = sorted(features["fecha_semana"].unique())
    fechas_holdout = [pd.Timestamp(fecha) for fecha in semanas[-CFG.semanas_holdout:]]
    fecha_corte = fechas_holdout[0] - pd.Timedelta(weeks=1)
    train = features[features["fecha_semana"] <= fecha_corte].copy()
    holdout = features[features["fecha_semana"].isin(fechas_holdout)].copy()
    return train, holdout, fecha_corte, fechas_holdout


def preparar_encoder(train):
    encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    encoder.fit(train[COLUMNAS_CATEGORICAS].astype(str))
    return encoder


def transformar_features(df, encoder):
    X = df[COLUMNAS_FEATURES].copy()
    X[COLUMNAS_CATEGORICAS] = encoder.transform(X[COLUMNAS_CATEGORICAS].astype(str))
    return X.astype(float)


def promedio_ultimas_4(serie):
    return float(serie.tail(4).mean()) if len(serie) else 0.0


def fechas_futuras_desde(ultima_fecha, pasos):
    if pasos <= 0:
        return []
    inicio = pd.Timestamp(ultima_fecha) + pd.Timedelta(weeks=1)
    return list(pd.date_range(inicio, periods=pasos, freq=CFG.frecuencia))


def prediccion_naive_fechas(serie_train, fechas_objetivo):
    serie = serie_train.sort_index()
    predicciones = []
    for fecha in fechas_objetivo:
        fecha = pd.Timestamp(fecha)
        fecha_estacional = fecha - pd.Timedelta(weeks=52)
        fecha_lag_1 = fecha - pd.Timedelta(weeks=1)
        if fecha_estacional in serie.index:
            valor = serie.loc[fecha_estacional]
        elif fecha_lag_1 in serie.index:
            valor = serie.loc[fecha_lag_1]
        else:
            valor = promedio_ultimas_4(serie)
        predicciones.append(float(valor))
    return np.array(predicciones, dtype=float)


def fitted_fallback(serie):
    return serie.shift(1).rolling(4, min_periods=1).mean().fillna(serie.expanding().mean()).fillna(0.0)


def ajustar_sarima(serie, pasos):
    if len(serie) < CFG.semanas_minimas_sarima:
        return None, "historia_insuficiente"
    if serie.sum() <= 0:
        return None, "serie_sin_demanda"
    try:
        modelo = SARIMAX(
            serie,
            order=CFG.sarima_order,
            seasonal_order=CFG.sarima_seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        with warnings.catch_warnings(record=True) as capturadas:
            warnings.simplefilter("always", ConvergenceWarning)
            ajuste = modelo.fit(disp=False, maxiter=CFG.sarima_maxiter, method="lbfgs")
        convergencia = ajuste.mle_retvals.get("converged", False)
        if not convergencia or any(isinstance(w.message, ConvergenceWarning) for w in capturadas):
            return None, "no_converge"

        fitted = pd.Series(ajuste.fittedvalues, index=serie.index).replace([np.inf, -np.inf], np.nan)
        forecast = np.asarray(ajuste.forecast(steps=pasos), dtype=float)
        if fitted.isna().any() or not np.isfinite(forecast).all():
            return None, "predicciones_no_finitas"
        return (ajuste, fitted.clip(lower=0), np.clip(forecast, 0, None)), None
    except Exception as exc:
        return None, f"error:{type(exc).__name__}"


def entrenar_sarima_por_series(series, fecha_corte, fechas_holdout, pasos_futuro=0, guardar_modelos=False):
    filas_train = []
    filas_holdout = []
    filas_futuro = []
    modelos = {}
    fallbacks = {}
    motivos_fallback = {}
    conteo_sarima = 0
    conteo_fallback = 0
    pasos = len(fechas_holdout) + pasos_futuro
    fecha_base_futuro = fechas_holdout[-1] if fechas_holdout else pd.Timestamp(fecha_corte)
    fechas_futuras = fechas_futuras_desde(fecha_base_futuro, pasos_futuro)

    for (producto_id, botica_id), grupo in series.groupby(["producto_id", "botica_id"]):
        grupo = grupo.sort_values("fecha_semana")
        serie_train = grupo[grupo["fecha_semana"] <= fecha_corte].set_index("fecha_semana")["cantidad_vendida"].asfreq(CFG.frecuencia)
        resultado, motivo = ajustar_sarima(serie_train, pasos)
        clave = (producto_id, botica_id)

        if resultado is None:
            fitted = fitted_fallback(serie_train).clip(lower=0)
            forecast = prediccion_naive_fechas(serie_train, list(fechas_holdout) + fechas_futuras)
            fallbacks[clave] = {"motivo": motivo, "tipo": "seasonal_naive_o_promedio_4"}
            motivos_fallback[motivo] = motivos_fallback.get(motivo, 0) + 1
            conteo_fallback += 1
        else:
            modelo, fitted, forecast = resultado
            if guardar_modelos:
                modelos[clave] = {
                    "order": CFG.sarima_order,
                    "seasonal_order": CFG.sarima_seasonal_order,
                    "parametros": modelo.params.to_dict(),
                    "aic": float(modelo.aic),
                    "bic": float(modelo.bic),
                    "ultima_fecha_entrenamiento": serie_train.index.max().date().isoformat(),
                    "observaciones": int(len(serie_train)),
                }
            conteo_sarima += 1

        for fecha, pred in fitted.items():
            filas_train.append({"producto_id": producto_id, "botica_id": botica_id, "fecha_semana": fecha, "pred_sarima": float(pred)})
        for i, fecha in enumerate(fechas_holdout):
            filas_holdout.append({"producto_id": producto_id, "botica_id": botica_id, "fecha_semana": fecha, "pred_sarima": float(forecast[i])})
        for i, fecha in enumerate(fechas_futuras):
            filas_futuro.append({"producto_id": producto_id, "botica_id": botica_id, "fecha_semana": fecha, "pred_sarima": float(forecast[len(fechas_holdout) + i])})

    if motivos_fallback:
        log.info("Fallback SARIMA por motivo: %s", motivos_fallback)

    return {
        "pred_train": pd.DataFrame(filas_train),
        "pred_holdout": pd.DataFrame(filas_holdout),
        "pred_futuro": pd.DataFrame(filas_futuro),
        "modelos": modelos,
        "fallbacks": fallbacks,
        "motivos_fallback": motivos_fallback,
        "series_sarima": conteo_sarima,
        "series_fallback": conteo_fallback,
    }


def evaluar_metricas(y_real, y_pred):
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    error = y_real - y_pred
    mae = float(np.mean(np.abs(error)))
    rmse = float(np.sqrt(np.mean(error ** 2)))
    mascara = y_real != 0
    mape = float(np.mean(np.abs(error[mascara] / y_real[mascara])) * 100) if mascara.any() else None
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "mape": None if mape is None else round(mape, 4)}


def construir_fila_modelo(meta, fecha, historial):
    valores = list(historial)

    def lag(n):
        return float(valores[-n]) if len(valores) >= n else 0.0

    lag_1 = lag(1)
    lag_2 = lag(2)
    lag_4 = lag(4)
    return {
        "fecha_semana": fecha,
        "producto_id": meta["producto_id"],
        "botica_id": meta["botica_id"],
        "categoria_terapeutica": meta["categoria_terapeutica"],
        "anio": fecha.year,
        "mes": fecha.month,
        "trimestre": fecha.quarter,
        "semana_anio": int(fecha.isocalendar().week),
        "es_invierno": int(fecha.month in [6, 7, 8]),
        "es_verano": int(fecha.month in [12, 1, 2, 3]),
        "stock_inicio_semana": meta["stock_inicio_semana"],
        "lead_time_dias": meta["lead_time_dias"],
        "ratio_stock_minimo": meta["ratio_stock_minimo"],
        "ratio_stock_maximo": meta["ratio_stock_maximo"],
        "stock_bajo_minimo": meta["stock_bajo_minimo"],
        "sobrestock": meta["sobrestock"],
        "lag_1": lag_1,
        "lag_2": lag_2,
        "lag_4": lag_4,
        "lag_8": lag(8),
        "lag_12": lag(12),
        "rolling_mean_4": float(np.mean(valores[-4:])) if len(valores) >= 4 else float(np.mean(valores)) if valores else 0.0,
        "rolling_mean_8": float(np.mean(valores[-8:])) if len(valores) >= 8 else float(np.mean(valores)) if valores else 0.0,
        "rolling_mean_12": float(np.mean(valores[-12:])) if len(valores) >= 12 else float(np.mean(valores)) if valores else 0.0,
        "variacion_1_semana": lag_1 - lag_2,
        "variacion_4_semanas": lag_1 - lag_4,
    }


def construir_seasonal_naive_holdout(series, holdout):
    filas = []
    for (producto_id, botica_id), grupo_holdout in holdout.groupby(["producto_id", "botica_id"]):
        serie = series[(series["producto_id"] == producto_id) & (series["botica_id"] == botica_id)].set_index("fecha_semana")["cantidad_vendida"]
        fechas = grupo_holdout.sort_values("fecha_semana")["fecha_semana"].tolist()
        preds = prediccion_naive_fechas(serie[serie.index < min(fechas)], fechas)
        for fecha, pred in zip(fechas, preds):
            filas.append({"producto_id": producto_id, "botica_id": botica_id, "fecha_semana": fecha, "pred_seasonal_naive": pred})
    return pd.DataFrame(filas)


def entrenar_modelos_holdout(series, features):
    train, holdout, fecha_corte, fechas_holdout = split_cronologico(features)
    sarima = entrenar_sarima_por_series(series, fecha_corte, fechas_holdout)
    naive_holdout = construir_seasonal_naive_holdout(series, holdout)

    encoder = preparar_encoder(train)
    xgb_directo = crear_xgboost()
    xgb_directo.fit(transformar_features(train, encoder), train["cantidad_vendida"])

    sarima_train = train.merge(sarima["pred_train"], on=["producto_id", "botica_id", "fecha_semana"], how="left")
    sarima_train["pred_sarima"] = sarima_train["pred_sarima"].fillna(0.0)
    sarima_train["residuo_sarima"] = sarima_train["cantidad_vendida"] - sarima_train["pred_sarima"]
    xgb_residuos = crear_xgboost()
    xgb_residuos.fit(transformar_features(sarima_train, encoder), sarima_train["residuo_sarima"])

    sarima_holdout = sarima["pred_holdout"].set_index(["producto_id", "botica_id", "fecha_semana"])["pred_sarima"]
    filas = []
    for (producto_id, botica_id), grupo_holdout in holdout.groupby(["producto_id", "botica_id"]):
        grupo_holdout = grupo_holdout.sort_values("fecha_semana")
        meta = train[(train["producto_id"] == producto_id) & (train["botica_id"] == botica_id)].sort_values("fecha_semana").iloc[-1].to_dict()
        historial_base = series[
            (series["producto_id"] == producto_id)
            & (series["botica_id"] == botica_id)
            & (series["fecha_semana"] <= fecha_corte)
        ].sort_values("fecha_semana")["cantidad_vendida"].astype(float).tolist()
        historial_xgboost = list(historial_base)
        historial_hibrido = list(historial_base)

        for _, real in grupo_holdout.iterrows():
            fecha = real["fecha_semana"]
            fila_xgb = construir_fila_modelo(meta, fecha, historial_xgboost)
            pred_xgboost = max(0.0, float(xgb_directo.predict(transformar_features(pd.DataFrame([fila_xgb]), encoder))[0]))
            historial_xgboost.append(pred_xgboost)

            fila_hibrido = construir_fila_modelo(meta, fecha, historial_hibrido)
            pred_sarima = float(sarima_holdout.loc[(producto_id, botica_id, fecha)])
            correccion = float(xgb_residuos.predict(transformar_features(pd.DataFrame([fila_hibrido]), encoder))[0])
            pred_hibrido = max(0.0, pred_sarima + correccion)
            historial_hibrido.append(pred_hibrido)

            filas.append({
                "fecha_semana": fecha,
                "producto_id": producto_id,
                "botica_id": botica_id,
                "categoria_terapeutica": real["categoria_terapeutica"],
                "valor_real": real["cantidad_vendida"],
                "demanda_insatisfecha": real["demanda_insatisfecha"],
                "sobrestock": real["sobrestock"],
                "pred_sarima": pred_sarima,
                "pred_xgboost": pred_xgboost,
                "pred_hibrido": pred_hibrido,
            })

    inferencias = pd.DataFrame(filas)
    inferencias = inferencias.merge(naive_holdout, on=["producto_id", "botica_id", "fecha_semana"], how="left")
    inferencias["error_absoluto_hibrido"] = (inferencias["valor_real"] - inferencias["pred_hibrido"]).abs()

    metricas_modelos = {
        "seasonal_naive": evaluar_metricas(inferencias["valor_real"], inferencias["pred_seasonal_naive"]),
        "sarima": evaluar_metricas(inferencias["valor_real"], inferencias["pred_sarima"]),
        "xgboost": evaluar_metricas(inferencias["valor_real"], inferencias["pred_xgboost"]),
        "hibrido": evaluar_metricas(inferencias["valor_real"], inferencias["pred_hibrido"]),
    }
    metricas_categoria = {
        categoria: evaluar_metricas(grupo["valor_real"], grupo["pred_hibrido"])
        for categoria, grupo in inferencias.groupby("categoria_terapeutica")
    }

    fill_den = (holdout["cantidad_vendida"] + holdout["demanda_insatisfecha"]).sum()
    fill_rate_real = float(holdout["cantidad_vendida"].sum() / fill_den * 100) if fill_den > 0 else 0.0
    sobrestock = float(holdout["sobrestock"].mean() * 100)

    return {
        "train": train,
        "holdout": holdout,
        "fecha_corte": fecha_corte,
        "fechas_holdout": fechas_holdout,
        "encoder": encoder,
        "xgb_directo": xgb_directo,
        "xgb_residuos": xgb_residuos,
        "sarima": sarima,
        "inferencias": inferencias,
        "metricas_modelos": metricas_modelos,
        "metricas_categoria_hibrido": metricas_categoria,
        "fill_rate_real": fill_rate_real,
        "porcentaje_sobrestock": sobrestock,
    }


def entrenar_modelo_final_y_predecir(series, features, residuos_std):
    encoder = preparar_encoder(features)
    xgb_directo = crear_xgboost()
    xgb_directo.fit(transformar_features(features, encoder), features["cantidad_vendida"])

    ultima_fecha = series["fecha_semana"].max()
    fechas_futuras = fechas_futuras_desde(ultima_fecha, CFG.horizonte_semanas)
    sarima_final = entrenar_sarima_por_series(series, ultima_fecha, [], pasos_futuro=CFG.horizonte_semanas, guardar_modelos=True)

    sarima_train = features.merge(sarima_final["pred_train"], on=["producto_id", "botica_id", "fecha_semana"], how="left")
    sarima_train["pred_sarima"] = sarima_train["pred_sarima"].fillna(0.0)
    sarima_train["residuo_sarima"] = sarima_train["cantidad_vendida"] - sarima_train["pred_sarima"]
    xgb_residuos = crear_xgboost()
    xgb_residuos.fit(transformar_features(sarima_train, encoder), sarima_train["residuo_sarima"])

    predicciones = []
    z = 1.64 if round(CFG.nivel_confianza, 2) == 0.90 else 1.96
    generado_en = datetime.now(timezone.utc).isoformat()
    sarima_futuro = sarima_final["pred_futuro"].set_index(["producto_id", "botica_id", "fecha_semana"])["pred_sarima"]

    for (producto_id, botica_id), grupo in features.groupby(["producto_id", "botica_id"]):
        grupo = grupo.sort_values("fecha_semana")
        meta = grupo.iloc[-1].to_dict()
        historial = series[(series["producto_id"] == producto_id) & (series["botica_id"] == botica_id)].sort_values("fecha_semana")["cantidad_vendida"].astype(float).tolist()
        for fecha in fechas_futuras:
            fila = construir_fila_modelo(meta, fecha, historial)
            pred_sarima = float(sarima_futuro.loc[(producto_id, botica_id, fecha)])
            correccion = float(xgb_residuos.predict(transformar_features(pd.DataFrame([fila]), encoder))[0])
            pred = max(0.0, pred_sarima + correccion)
            historial.append(pred)
            predicciones.append({
                "producto_id": producto_id,
                "botica_id": botica_id,
                "periodo_inicio": fecha.date().isoformat(),
                "periodo_fin": (fecha + pd.Timedelta(days=6)).date().isoformat(),
                "cantidad_predicha": round(pred, 2),
                "intervalo_inf": round(max(0.0, pred - z * residuos_std), 2),
                "intervalo_sup": round(pred + z * residuos_std, 2),
                "modelo_version": CFG.version,
                "generado_en": generado_en,
            })

    return {
        "encoder": encoder,
        "xgb_directo": xgb_directo,
        "xgb_residuos": xgb_residuos,
        "sarima": sarima_final,
        "predicciones": pd.DataFrame(predicciones),
    }


def calcular_psi(baseline, comparacion, bins=10):
    baseline = pd.Series(baseline).replace([np.inf, -np.inf], np.nan).dropna().astype(float)
    comparacion = pd.Series(comparacion).replace([np.inf, -np.inf], np.nan).dropna().astype(float)
    if len(baseline) < 2 or len(comparacion) < 2:
        return 0.0
    cortes = np.unique(np.quantile(baseline, np.linspace(0, 1, bins + 1)))
    if len(cortes) < 3:
        return 0.0
    base_freq, _ = np.histogram(baseline, bins=cortes)
    comp_freq, _ = np.histogram(comparacion, bins=cortes)
    base_pct = np.where(base_freq / max(base_freq.sum(), 1) == 0, 1e-6, base_freq / max(base_freq.sum(), 1))
    comp_pct = np.where(comp_freq / max(comp_freq.sum(), 1) == 0, 1e-6, comp_freq / max(comp_freq.sum(), 1))
    return float(np.sum((comp_pct - base_pct) * np.log(comp_pct / base_pct)))


def calcular_drift(train, holdout, modelo_version_id):
    columnas = ["cantidad_vendida", "stock_inicio_semana", "ratio_stock_minimo", "ratio_stock_maximo", "lag_1", "rolling_mean_4"]
    psi_features = {col: round(calcular_psi(train[col], holdout[col]), 4) for col in columnas if col in train.columns and col in holdout.columns}
    psi_max = max(psi_features.values()) if psi_features else 0.0
    return {
        "modelo_version_id": modelo_version_id,
        "fecha_calculo": datetime.now(timezone.utc).isoformat(),
        "psi_features": psi_features,
        "psi_max": round(psi_max, 4),
        "requiere_retraining": bool(psi_max > CFG.umbral_retrain_psi),
        "alerta_critica": bool(psi_max > CFG.umbral_alerta_psi),
        "umbral_retrain_psi": CFG.umbral_retrain_psi,
        "umbral_alerta_psi": CFG.umbral_alerta_psi,
    }


def seleccionar_mejor_modelo(metricas_modelos):
    return min(metricas_modelos.items(), key=lambda item: item[1]["rmse"])[0]


def construir_historial_inferencia(series, features):
    historial = {}
    columnas_contexto = [
        "categoria_terapeutica",
        "stock_inicio_semana",
        "lead_time_dias",
        "ratio_stock_minimo",
        "ratio_stock_maximo",
        "stock_bajo_minimo",
        "sobrestock",
    ]
    for (producto_id, botica_id), grupo in series.groupby(["producto_id", "botica_id"]):
        clave = f"{producto_id}|{botica_id}"
        contexto = features[(features["producto_id"] == producto_id) & (features["botica_id"] == botica_id)].sort_values("fecha_semana").iloc[-1]
        historial[clave] = {
            "producto_id": producto_id,
            "botica_id": botica_id,
            "ultimas_12_demandas": grupo.sort_values("fecha_semana").tail(12)["cantidad_vendida"].astype(float).tolist(),
            "ultimo_contexto": {col: contexto[col] for col in columnas_contexto},
        }
    return historial


def validar_resultados(resultado, final, metricas, inferencias, predicciones, drift, config, historial):
    series_totales = metricas["series"]["totales"]
    series_sarima = metricas["series"]["sarima"]
    series_fallback = metricas["series"]["fallback"]
    if series_totales != 150:
        raise ValueError(f"Validación fallida: series totales = {series_totales}, esperado 150.")
    if series_sarima <= 0:
        raise ValueError("Validación fallida: SARIMA no entrenó ninguna serie válida.")
    if series_sarima + series_fallback != 150:
        raise ValueError("Validación fallida: series_sarima + series_fallback debe ser 150.")
    if resultado["holdout"].groupby(["producto_id", "botica_id"]).size().nunique() != 1 or resultado["holdout"].groupby(["producto_id", "botica_id"]).size().iloc[0] != 12:
        raise ValueError("Validación fallida: el holdout no tiene 12 semanas por serie.")
    if len(inferencias) != 1800:
        raise ValueError(f"Validación fallida: inferencias = {len(inferencias)}, esperado 1800.")
    if len(predicciones) != 1800:
        raise ValueError(f"Validación fallida: predicciones futuras = {len(predicciones)}, esperado 1800.")
    if predicciones.isna().sum().sum() > 0:
        raise ValueError("Validación fallida: existen nulos en predicciones.")
    if (predicciones[["cantidad_predicha", "intervalo_inf", "intervalo_sup"]] < 0).any().any():
        raise ValueError("Validación fallida: existen predicciones negativas.")
    if inferencias.duplicated(["producto_id", "botica_id", "fecha_semana"]).any():
        raise ValueError("Validación fallida: inferencias duplicadas producto-botica-fecha.")
    if predicciones.duplicated(["producto_id", "botica_id", "periodo_inicio"]).any():
        raise ValueError("Validación fallida: predicciones duplicadas producto-botica-fecha.")
    if not final["sarima"]["modelos"]:
        raise ValueError("Validación fallida: modelos_sarima está vacío.")
    if final["xgb_directo"] is None or final["xgb_residuos"] is None or final["encoder"] is None:
        raise ValueError("Validación fallida: falta XGBoost directo, XGBoost residuos o encoder.")
    if len(historial) != 150:
        raise ValueError("Validación fallida: historial_inferencia no contiene 150 series.")
    ids = {
        metricas["modelo_version_id"],
        drift["modelo_version_id"],
        config["modelo_version_id"],
        predicciones["modelo_version_id"].iloc[0],
        inferencias["modelo_version_id"].iloc[0],
    }
    if len(ids) != 1:
        raise ValueError("Validación fallida: modelo_version_id no coincide en todos los artefactos.")


def guardar_artefactos(final, metricas, inferencias, predicciones, drift, config, historial_inferencia):
    if final["xgb_residuos"] is None or final["encoder"] is None or len(historial_inferencia) != 150:
        raise ValueError("No se puede guardar modelo.pkl: artefactos principales incompletos.")
    if not final["sarima"]["modelos"]:
        raise ValueError("No se puede guardar modelo.pkl: modelos_sarima está vacío.")

    CFG.dir_version.mkdir(parents=True, exist_ok=True)
    artefacto = {
        "modelo_version_id": config["modelo_version_id"],
        "version": CFG.version,
        "modelo_principal": "hibrido",
        "estrategia_hibrida": "SARIMA por serie + XGBoost global sobre residuos",
        "modelos_sarima": final["sarima"]["modelos"],
        "fallbacks": final["sarima"]["fallbacks"],
        "xgb_directo": final["xgb_directo"],
        "xgb_residuos": final["xgb_residuos"],
        "encoder": final["encoder"],
        "columnas_features": COLUMNAS_FEATURES,
        "columnas_categoricas": COLUMNAS_CATEGORICAS,
        "historial_inferencia": historial_inferencia,
        "config": config,
    }
    with (CFG.dir_version / "modelo.pkl").open("wb") as archivo:
        pickle.dump(artefacto, archivo)

    with (CFG.dir_version / "metricas.json").open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(metricas), archivo, indent=2, ensure_ascii=False)
    with (CFG.dir_version / "drift_metricas.json").open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(drift), archivo, indent=2, ensure_ascii=False)
    with (CFG.dir_version / "pipeline_config.json").open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(config), archivo, indent=2, ensure_ascii=False)

    predicciones.to_csv(CFG.dir_version / "predicciones.csv", index=False, encoding="utf-8")
    inferencias.to_csv(CFG.dir_version / "inferencias.csv", index=False, encoding="utf-8")
    return CFG.dir_version


def main():
    inicio = time.time()
    modelo_version_id = str(uuid.uuid4())
    series, features = cargar_datos()
    validar_datos(series, features)

    resultado = entrenar_modelos_holdout(series, features)
    inferencias = resultado["inferencias"]
    residuos_hibrido = inferencias["valor_real"] - inferencias["pred_hibrido"]
    residuos_std = float(np.std(residuos_hibrido)) if len(residuos_hibrido) else 0.0
    final = entrenar_modelo_final_y_predecir(series, features, residuos_std)

    mejor_modelo = seleccionar_mejor_modelo(resultado["metricas_modelos"])
    series_totales = features.groupby(["producto_id", "botica_id"]).ngroups
    metricas = {
        "modelo_version_id": modelo_version_id,
        "split": {
            "fecha_corte": resultado["fecha_corte"].date().isoformat(),
            "semanas_holdout": CFG.semanas_holdout,
            "horizonte_semanas": CFG.horizonte_semanas,
            "train_inicio": resultado["train"]["fecha_semana"].min().date().isoformat(),
            "train_fin": resultado["train"]["fecha_semana"].max().date().isoformat(),
            "holdout_inicio": resultado["holdout"]["fecha_semana"].min().date().isoformat(),
            "holdout_fin": resultado["holdout"]["fecha_semana"].max().date().isoformat(),
        },
        "modelos": resultado["metricas_modelos"],
        "mejor_modelo_evaluado": mejor_modelo,
        "modelo_exportado": "hibrido",
        "metricas_hibrido_por_categoria": resultado["metricas_categoria_hibrido"],
        "metricas_negocio": {
            "fill_rate_real": round(resultado["fill_rate_real"], 4),
            "porcentaje_registros_semanales_sobrestock": round(resultado["porcentaje_sobrestock"], 4),
        },
        "series": {
            "totales": series_totales,
            "sarima": resultado["sarima"]["series_sarima"],
            "fallback": resultado["sarima"]["series_fallback"],
            "motivos_fallback": resultado["sarima"]["motivos_fallback"],
        },
    }

    predicciones = final["predicciones"].copy()
    predicciones["modelo_version_id"] = modelo_version_id
    inferencias_export = inferencias[[
        "fecha_semana",
        "producto_id",
        "botica_id",
        "categoria_terapeutica",
        "valor_real",
        "pred_seasonal_naive",
        "pred_sarima",
        "pred_xgboost",
        "pred_hibrido",
        "error_absoluto_hibrido",
    ]].copy()
    inferencias_export["modelo_version_id"] = modelo_version_id
    inferencias_export["fecha_semana"] = inferencias_export["fecha_semana"].dt.date.astype(str)

    drift = calcular_drift(resultado["train"], resultado["holdout"], modelo_version_id)
    config = {
        **asdict(CFG),
        "modelo_version_id": modelo_version_id,
        "columnas_features": COLUMNAS_FEATURES,
        "columnas_categoricas": COLUMNAS_CATEGORICAS,
        "suposicion_inventario_holdout_y_futuro": "Las variables de inventario se aproximan con el último valor conocido del train o de la serie completa, según evaluación o predicción futura.",
    }
    historial = construir_historial_inferencia(series, features)
    validar_resultados(resultado, final, metricas, inferencias_export, predicciones, drift, config, historial)
    dir_salida = guardar_artefactos(final, metricas, inferencias_export, predicciones, drift, config, historial)
    tiempo = time.time() - inicio

    if metricas["series"]["sarima"] <= 0:
        print("ADVERTENCIA: el entrenamiento SARIMA no fue válido para ninguna serie.")

    print("Resumen Pipeline SARIMA + XGBoost")
    print(f"Periodo train: {metricas['split']['train_inicio']} -> {metricas['split']['train_fin']}")
    print(f"Periodo holdout: {metricas['split']['holdout_inicio']} -> {metricas['split']['holdout_fin']}")
    print(f"Series totales: {series_totales}")
    print(f"Series SARIMA: {resultado['sarima']['series_sarima']}")
    print(f"Series fallback: {resultado['sarima']['series_fallback']}")
    for nombre, valores in resultado["metricas_modelos"].items():
        print(f"{nombre}: MAE={valores['mae']:.4f} RMSE={valores['rmse']:.4f} MAPE={valores['mape']}")
    print(f"Mejor modelo evaluado: {mejor_modelo}")
    print("Modelo exportado: hibrido")
    print(f"Fill rate real: {resultado['fill_rate_real']:.2f}%")
    print(f"Porcentaje de registros semanales en sobrestock: {resultado['porcentaje_sobrestock']:.2f}%")
    print(f"PSI maximo: {drift['psi_max']}")
    print(f"Tiempo de entrenamiento: {tiempo:.1f}s")
    print(f"Predicciones futuras generadas: {len(predicciones)}")
    print(f"Ubicacion de artefactos: {dir_salida}")


if __name__ == "__main__":
    main()
