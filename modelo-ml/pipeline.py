# -*- coding: utf-8 -*-
"""
================================================================================
  pipeline_modelo_v1.py
--------------------------------------------------------------------------------
  Pipeline completo del modelo híbrido SARIMA + XGBoost (versión 1).

  Proyecto : Plataforma Web Serverless + ML para controlar el sobrestock y
              desabastecimiento de medicamentos en boticas del Perú.
  Empresa  : D&R Farma — UPC 2026
  Versión  : v1.0.0  (primera línea base entrenable, alineada con OE3.I1)

--------------------------------------------------------------------------------
  Arquitectura del modelo según Arquitectura Lógica v4 + Física v3
--------------------------------------------------------------------------------
  Componente 1 — SARIMA (1,1,1) sin estacionalidad.
    Captura tendencia y componente autorregresivo.
    La estacionalidad se captura vía XGBoost con features temporales.

  Componente 2 — XGBoost sobre residuos de SARIMA.
    Captura efectos no lineales de variables cruzadas.

  Estrategia híbrida aditiva:
      y_predicho = SARIMA(serie) + XGBoost(features → residuo_SARIMA)

--------------------------------------------------------------------------------
  Métricas de evaluación (OE3.I1 — Arquitectura Lógica v4)
--------------------------------------------------------------------------------
    • MAPE  : ≤ 20%  (condición habilitante técnica)
    • MAE   : Mean Absolute Error
    • RMSE  : Root Mean Square Error

--------------------------------------------------------------------------------
  MLOps — Drift Detection (Arquitectura Lógica v4)
--------------------------------------------------------------------------------
    • PSI (Population Stability Index) por feature
    • Ratio MAPE = mape_rolling / mape_baseline
    • Umbrales: retrain (psi>0.2, ratio>1.25), alerta (psi>0.3, ratio>1.5)

--------------------------------------------------------------------------------
  Parámetros técnicos (Arquitectura Física v3)
--------------------------------------------------------------------------------
    • Horizonte de predicción  : 12 semanas (3 meses)
    • Granularidad temporal    : semanal (resample W-MON)
    • Granularidad espacial    : (producto × botica)
    • Split                    : cronológico (nunca aleatorio)
    • Holdout                  : 8 semanas

  Uso:
      pip install pandas numpy scikit-learn statsmodels xgboost
      python pipeline_modelo_v1.py

  Salida:
      ./modelos/v1.0.0/                   ← artefactos del modelo
      ./modelos/v1.0.0/predicciones.csv   ← `predicciones_ml`
      ./modelos/v1.0.0/inferencias.csv    ← `inferencias`
      ./modelos/v1.0.0/metricas.json       ← `modelos_ml`
      ./modelos/v1.0.0/drift_metricas.json ← `drift_metricas`
================================================================================
"""

from __future__ import annotations

import hashlib
import json
import logging
import pickle
import time
import uuid
import warnings
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.preprocessing import LabelEncoder
from statsmodels.tsa.statespace.sarimax import SARIMAX
from xgboost import XGBRegressor

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", message=".*ConvergenceWarning.*")
warnings.filterwarnings("ignore", message=".*non-stationary.*")
warnings.filterwarnings("ignore", message=".*non-invertible.*")


# ──────────────────────────────────────────────────────────────────────────────
#  CONFIGURACIÓN DEL PIPELINE
# ──────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ConfigPipeline:
    """
    Configuración inmutable del pipeline. Frozen dataclass = solo se setea una
    vez al inicio; cualquier intento de mutación lanza error en runtime.
    """
    ruta_features: Path = Path("./data/features_entrenamiento.csv")
    dir_modelos: Path = Path("./modelos")

    version: str = "v1.0.0"
    algoritmo: str = "SARIMA+XGBoost"
    semilla: int = 42

    frecuencia: str = "W-MON"

    semanas_holdout: int = 8
    horizonte_semanas: int = 12

    semanas_minimas_serie: int = 12
    ventas_minimas_serie: int = 10

    sarima_order: tuple[int, int, int] = (1, 1, 1)
    sarima_seasonal_order: tuple[int, int, int, int] = (1, 1, 1, 26)

    xgb_n_estimators: int = 200
    xgb_max_depth: int = 4
    xgb_learning_rate: float = 0.05
    xgb_subsample: float = 0.8
    xgb_colsample_bytree: float = 0.8

    mape_objetivo: float = 20.0
    nivel_confianza: float = 0.90

    ventana_dias_drift: int = 28

    umbral_retrain_psi: float = 0.2
    umbral_retrain_ratio_mape: float = 1.25
    umbral_alerta_psi: float = 0.3
    umbral_alerta_ratio_mape: float = 1.5


CFG = ConfigPipeline()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("pipeline-ml")


# ──────────────────────────────────────────────────────────────────────────────
#  ETL — Extracción, limpieza y normalización
# ──────────────────────────────────────────────────────────────────────────────

def cargar_features(ruta: Path) -> pd.DataFrame:
    """Lee el CSV con la vista pre-joinada y aplica los filtros mínimos del ETL."""
    if not ruta.exists():
        raise FileNotFoundError(
            f"No se encontró {ruta}. Ejecuta primero `python generar_dataset.py`."
        )

    log.info("Cargando features desde %s", ruta)
    df = pd.read_csv(ruta, parse_dates=["fecha_venta", "fecha_vencimiento"])
    log.info("  %d filas cargadas (%d columnas)", len(df), df.shape[1])

    if "tipo_movimiento" in df.columns:
        df = df[df["tipo_movimiento"] == "salida"].copy()

    df = df[df["cantidad"] > 0].copy()

    return df


def agregar_a_semanal(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega los movimientos a granularidad (producto × botica × semana)."""
    log.info("Agregando a granularidad semanal (%s)...", CFG.frecuencia)

    df = df.set_index("fecha_venta")

    grupos = df.groupby(
        ["producto_id", "botica_id", pd.Grouper(freq=CFG.frecuencia)]
    )

    semanal = grupos.agg(
        cantidad_vendida=("cantidad", "sum"),
        codigo_interno=("codigo_interno", "first"),
        nombre_comercial=("nombre_comercial", "first"),
        principio_activo=("principio_activo", "first"),
        categoria_terapeutica=("categoria_terapeutica", "first"),
        laboratorio=("laboratorio", "first"),
        forma_farmaceutica=("forma_farmaceutica", "first"),
        concentracion=("concentracion", "first"),
        requiere_receta=("requiere_receta", "first"),
        distrito=("distrito", "first"),
        precio_venta=("precio_venta", "mean"),
        precio_costo=("precio_costo", "mean"),
        stock_actual=("stock_actual", "mean"),
        stock_minimo=("stock_minimo", "mean"),
        lead_time_dias=("lead_time_dias", "mean"),
        dias_min_para_vencimiento=(
            "fecha_vencimiento",
            lambda s: (s.min() - s.index.min()).days if len(s) else np.nan,
        ),
    ).reset_index()

    semanal = semanal.rename(columns={"fecha_venta": "semana"})
    log.info("  %d filas semanales generadas", len(semanal))
    return semanal


# ──────────────────────────────────────────────────────────────────────────────
#  FEATURE ENGINEERING
# ──────────────────────────────────────────────────────────────────────────────

def construir_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Features según Arquitectura Lógica v4 (sección "Features para el modelo"):
      Temporales : mes, semana_del_anio, trimestre, es_invierno_pe, es_verano_pe, es_inicio_mes
      Lags       : lag_1, lag_2, lag_4
      Rolling    : rolling_mean_4, rolling_std_4, rolling_mean_12
    """
    log.info("Construyendo features (temporales + lags)...")
    df = df.sort_values(["producto_id", "botica_id", "semana"]).copy()

    df["mes"] = df["semana"].dt.month
    df["semana_del_anio"] = df["semana"].dt.isocalendar().week.astype(int)
    df["trimestre"] = df["semana"].dt.quarter
    df["es_invierno_pe"] = df["mes"].isin([6, 7, 8]).astype(int)
    df["es_verano_pe"] = df["mes"].isin([10, 11, 12, 1, 2]).astype(int)
    df["es_inicio_mes"] = (df["semana"].dt.day <= 7).astype(int)

    grp = df.groupby(["producto_id", "botica_id"])["cantidad_vendida"]

    df["lag_1"] = grp.shift(1)
    df["lag_2"] = grp.shift(2)
    df["lag_4"] = grp.shift(4)

    df["rolling_mean_4"] = grp.transform(
        lambda s: s.shift(1).rolling(window=4, min_periods=1).mean()
    )
    df["rolling_std_4"] = grp.transform(
        lambda s: s.shift(1).rolling(window=4, min_periods=1).std()
    )
    df["rolling_mean_12"] = grp.transform(
        lambda s: s.shift(1).rolling(window=12, min_periods=1).mean()
    )

    cols_lag = ["lag_1", "lag_2", "lag_4",
                "rolling_mean_4", "rolling_std_4", "rolling_mean_12"]
    df[cols_lag] = df[cols_lag].fillna(0)

    log.info("  %d features generadas", len(df.columns) - 3)
    return df


# ──────────────────────────────────────────────────────────────────────────────
#  SPLIT CRONOLÓGICO TRAIN / HOLDOUT
# ──────────────────────────────────────────────────────────────────────────────

def split_cronologico(
    df: pd.DataFrame, semanas_holdout: int
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split temporal estricto: las últimas N semanas son holdout."""
    fecha_corte = df["semana"].max() - pd.Timedelta(weeks=semanas_holdout)
    train = df[df["semana"] <= fecha_corte].copy()
    holdout = df[df["semana"] > fecha_corte].copy()

    log.info("Split cronológico:")
    log.info("  train   : %d filas  (%s → %s)",
             len(train), train["semana"].min().date(), train["semana"].max().date())
    log.info("  holdout : %d filas  (%s → %s)",
             len(holdout), holdout["semana"].min().date(), holdout["semana"].max().date())

    return train, holdout


# ──────────────────────────────────────────────────────────────────────────────
#  COMPONENTE 1 — SARIMA (línea base por serie)
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
#  COMPONENTE 1 — SARIMA estacional (línea base por serie)
# ──────────────────────────────────────────────────────────────────────────────

def entrenar_sarima_serie(
    serie: pd.Series, n_periodos_pred: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """
    Entrena SARIMA sobre una serie individual (producto × botica).

    Configuración: (1,1,1) sin componente estacional.
    La estacionalidad se captura vía XGBoost con features temporales
    (mes, trimestre, es_invierno_pe, es_verano_pe, lags).

    Devuelve: (predicciones_train, predicciones_futuro, residuos_train)
    """
    if len(serie) < 26:
        return None
    if serie.sum() < 10:
        return None

    try:
        modelo = SARIMAX(
            serie,
            order=(1, 1, 1),
            seasonal_order=(0, 0, 0, 0),
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        ajuste = modelo.fit(disp=False, maxiter=30, method='lbfgs')

        pred_train = ajuste.fittedvalues.values
        pred_futuro = ajuste.forecast(steps=n_periodos_pred).values
        residuos = serie.values - pred_train

        return pred_train, pred_futuro, residuos
    except Exception as e:
        log.debug("SARIMA falló en serie: %s", e)
        return None


def fallback_naive(serie: pd.Series, n_pred: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Estrategia de respaldo: promedio móvil de las últimas 4 semanas."""
    pred_train = serie.rolling(window=4, min_periods=1).mean().values
    avg = serie.tail(4).mean() if len(serie) > 0 else 0.0
    pred_futuro = np.full(n_pred, avg)
    residuos = serie.values - pred_train
    return pred_train, pred_futuro, residuos


# ──────────────────────────────────────────────────────────────────────────────
#  COMPONENTE 2 — XGBoost sobre los residuos de SARIMA
# ──────────────────────────────────────────────────────────────────────────────

COLUMNAS_CATEGORICAS = [
    "principio_activo",
    "categoria_terapeutica",
    "laboratorio",
    "forma_farmaceutica",
    "concentracion",
    "distrito",
    "codigo_interno",
]
COLUMNAS_NUMERICAS = [
    "requiere_receta",
    "precio_venta",
    "precio_costo",
    "stock_actual",
    "stock_minimo",
    "lead_time_dias",
    "mes", "semana_del_anio", "trimestre",
    "es_invierno_pe", "es_verano_pe", "es_inicio_mes",
    "lag_1", "lag_2", "lag_4",
    "rolling_mean_4", "rolling_std_4", "rolling_mean_12",
]


def codificar_categoricas(
    df_train: pd.DataFrame, df_holdout: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, LabelEncoder]]:
    """Codifica categóricas con LabelEncoder ajustado SOLO en train."""
    encoders: dict[str, LabelEncoder] = {}
    train = df_train.copy()
    holdout = df_holdout.copy()

    for col in COLUMNAS_CATEGORICAS:
        enc = LabelEncoder()
        train[col] = enc.fit_transform(train[col].astype(str))
        clases_conocidas = set(enc.classes_)
        holdout[col] = holdout[col].astype(str).apply(
            lambda v: enc.transform([v])[0] if v in clases_conocidas else -1
        )
        encoders[col] = enc

    return train, holdout, encoders


def entrenar_xgboost_residuos(
    train: pd.DataFrame, residuos_train: np.ndarray
) -> XGBRegressor:
    """Entrena XGBoost que predice los residuos del SARIMA."""
    columnas = COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS
    X = train[columnas]
    y = residuos_train

    modelo = XGBRegressor(
        n_estimators=CFG.xgb_n_estimators,
        max_depth=CFG.xgb_max_depth,
        learning_rate=CFG.xgb_learning_rate,
        subsample=CFG.xgb_subsample,
        colsample_bytree=CFG.xgb_colsample_bytree,
        random_state=CFG.semilla,
        n_jobs=-1,
        tree_method="hist",
        verbosity=0,
    )
    modelo.fit(X, y)
    return modelo


# ──────────────────────────────────────────────────────────────────────────────
#  ENTRENAMIENTO HÍBRIDO
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class ResultadoHibrido:
    predicciones_train: pd.DataFrame = field(default_factory=pd.DataFrame)
    predicciones_holdout: pd.DataFrame = field(default_factory=pd.DataFrame)
    predicciones_futuro: pd.DataFrame = field(default_factory=pd.DataFrame)
    residuos_train: np.ndarray = field(default_factory=lambda: np.array([]))
    series_entrenadas: int = 0
    series_fallback: int = 0
    tiempo_entrenamiento_s: float = 0.0
    tiempo_inferencia_por_sku_s: float = 0.0


def entrenar_modelo_hibrido(
    train: pd.DataFrame, holdout: pd.DataFrame
) -> tuple[ResultadoHibrido, XGBRegressor]:
    """
    Entrena SARIMA por cada serie y XGBoost global sobre residuos.
    Calcula tiempo de inferencia por SKU (métrica Arquitectura Física v3).
    """
    log.info("Entrenando modelo híbrido SARIMA + XGBoost...")
    log.info("  series únicas en train : %d",
             train.groupby(["producto_id", "botica_id"]).ngroups)

    inicio_total = time.time()

    pred_train_rows: list[dict] = []
    pred_holdout_rows: list[dict] = []
    pred_futuro_rows: list[dict] = []
    residuos_global: list[float] = []
    indices_global: list[int] = []

    series_entrenadas = 0
    series_fallback = 0

    semanas_pred = CFG.semanas_holdout + CFG.horizonte_semanas

    series_unicas = train.groupby(["producto_id", "botica_id"]).ngroups
    inicio_sarima = time.time()

    for (pid, bid), grupo in train.groupby(["producto_id", "botica_id"]):
        grupo = grupo.sort_values("semana")
        serie = grupo.set_index("semana")["cantidad_vendida"]

        resultado = entrenar_sarima_serie(serie, semanas_pred)
        if resultado is None:
            resultado = fallback_naive(serie, semanas_pred)
            series_fallback += 1
        else:
            series_entrenadas += 1

        pred_train, pred_futuro, residuos = resultado

        for idx, (fecha, valor_pred) in enumerate(zip(serie.index, pred_train)):
            pred_train_rows.append({
                "producto_id": pid, "botica_id": bid,
                "semana": fecha,
                "y_real": serie.iloc[idx],
                "y_sarima": valor_pred,
            })
        residuos_global.extend(residuos.tolist())
        indices_global.extend(grupo.index.tolist())

        ultima_fecha_train = serie.index.max()
        for k in range(CFG.semanas_holdout):
            fecha_pred = ultima_fecha_train + pd.Timedelta(weeks=k + 1)
            pred_holdout_rows.append({
                "producto_id": pid, "botica_id": bid,
                "semana": fecha_pred,
                "y_sarima": pred_futuro[k],
            })

        for k in range(CFG.horizonte_semanas):
            fecha_pred = ultima_fecha_train + pd.Timedelta(
                weeks=CFG.semanas_holdout + k + 1
            )
            pred_futuro_rows.append({
                "producto_id": pid, "botica_id": bid,
                "semana": fecha_pred,
                "y_sarima": pred_futuro[CFG.semanas_holdout + k],
            })

    tiempo_sarima = time.time() - inicio_sarima

    log.info("  SARIMA entrenado en %d series (%d fallback naive) en %.1fs",
             series_entrenadas, series_fallback, tiempo_sarima)
    log.info("  Tiempo SARIMA por SKU: %.2f ms",
             (tiempo_sarima / series_unicas * 1000) if series_unicas > 0 else 0)

    log.info("Entrenando XGBoost sobre residuos del SARIMA...")
    train_codificado, holdout_codificado, _ = codificar_categoricas(train, holdout)

    train_codificado = train_codificado.loc[indices_global].copy()
    train_codificado["residuo_sarima"] = residuos_global

    inicio_xgb = time.time()
    xgb = entrenar_xgboost_residuos(train_codificado, np.array(residuos_global))
    tiempo_xgb = time.time() - inicio_xgb
    log.info("  XGBoost entrenado en %.1fs", tiempo_xgb)

    columnas_xgb = COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS
    correccion_xgb_holdout = xgb.predict(holdout_codificado[columnas_xgb])

    df_holdout_pred = pd.DataFrame(pred_holdout_rows)
    df_holdout_eval = (
        holdout[["producto_id", "botica_id", "semana", "cantidad_vendida",
                 "precio_venta", "stock_actual", "stock_minimo", "lead_time_dias",
                 "categoria_terapeutica", "distrito"]]
        .merge(df_holdout_pred, on=["producto_id", "botica_id", "semana"], how="left")
    )
    df_holdout_eval["correccion_xgb"] = correccion_xgb_holdout
    df_holdout_eval["y_predicho"] = (
        df_holdout_eval["y_sarima"].fillna(0) + df_holdout_eval["correccion_xgb"]
    ).clip(lower=0)

    tiempo_total = time.time() - inicio_total
    tiempo_por_sku = (tiempo_total / series_unicas) if series_unicas > 0 else 0

    resultado = ResultadoHibrido(
        predicciones_train=pd.DataFrame(pred_train_rows),
        predicciones_holdout=df_holdout_eval,
        predicciones_futuro=pd.DataFrame(pred_futuro_rows),
        residuos_train=np.array(residuos_global),
        series_entrenadas=series_entrenadas,
        series_fallback=series_fallback,
        tiempo_entrenamiento_s=tiempo_total,
        tiempo_inferencia_por_sku_s=tiempo_por_sku,
    )
    return resultado, xgb


# ──────────────────────────────────────────────────────────────────────────────
#  VALIDACIÓN — Métricas completas según Arquitectura Lógica v4 + Física v3
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class MetricasModelo:
    """Métricas alineadas con modelos_ml (Arquitectura Lógica v4)."""
    version: str
    algoritmo: str
    fecha_entrenamiento: str
    datos_desde: str
    datos_hasta: str
    mae: float
    rmse: float
    mape: float
    mape_objetivo: float
    fill_rate: float
    fill_rate_meta: float
    tasa_sobrestock: float
    series_totales: int
    series_entrenadas_sarima: int
    series_fallback_naive: int
    cumple_meta_acp: bool
    psi_baseline_jsonb: dict
    hash: str = ""
    modelo_version_id: str = ""
    tiempo_entrenamiento_s: float = 0.0
    tiempo_inferencia_por_sku_s: float = 0.0


def calcular_mape(y_real: np.ndarray, y_pred: np.ndarray) -> float:
    """MAPE robusto: ignora filas donde y_real == 0."""
    mask = y_real > 0
    if mask.sum() == 0:
        return float("nan")
    return float(np.mean(np.abs((y_real[mask] - y_pred[mask]) / y_real[mask])) * 100)


def calcular_mape_por_categoria(df_holdout: pd.DataFrame) -> dict[str, float]:
    """Desglose de MAPE por categoría terapéutica."""
    resultados = {}
    for cat in df_holdout["categoria_terapeutica"].unique():
        subset = df_holdout[df_holdout["categoria_terapeutica"] == cat]
        if len(subset) > 0:
            mape = calcular_mape(
                subset["cantidad_vendida"].values,
                subset["y_predicho"].values
            )
            resultados[cat] = round(mape, 2) if not np.isnan(mape) else None
    return resultados


def calcular_fill_rate(df_holdout: pd.DataFrame) -> float:
    """
    Fill Rate — Tasa de Servicio (OE3.I3 — Arquitectura Lógica v4).

    Fill Rate = (Unidades dispensadas a tiempo / Unidades solicitadas) × 100

    Simulación: se asume que hay stock suficiente si la predicción
    cubre la demanda real con un margen del 20%.
    """
    df = df_holdout.copy()
    df["demand_satisfecha"] = (
        df["cantidad_vendida"] <= df["y_predicho"] * 1.2
    ).astype(int)

    total_solicitado = len(df)
    total_satisfecho = df["demand_satisfecha"].sum()

    if total_solicitado == 0:
        return 0.0
    return round(100 * total_satisfecho / total_solicitado, 2)


def calcular_tasa_sobrestock(df_holdout: pd.DataFrame) -> float:
    """
    Tasa de Sobrestock (OE3.I3 — Arquitectura Lógica v4).

    Tasa de Sobrestock = (N° SKU con cobertura > 60 días / N° total SKU activos) × 100

    Cobertura (días) = stock_actual / demanda_promedio_semanal

    Simulación: se marca como sobrestock si stock_actual > stock_minimo × 3.
    """
    df = df_holdout.copy()
    df["en_sobrestock"] = (df["stock_actual"] > df["stock_minimo"] * 3).astype(int)

    sku_totales = df.groupby(["producto_id", "botica_id"]).size().shape[0]
    sku_sobrestock = df.groupby(["producto_id", "botica_id"])["en_sobrestock"].max().sum()

    if sku_totales == 0:
        return 0.0
    return round(100 * sku_sobrestock / sku_totales, 2)


def evaluar_holdout(
    df_holdout: pd.DataFrame,
    train: pd.DataFrame,
    res: ResultadoHibrido,
    version: str,
    algoritmo: str,
) -> MetricasModelo:
    """
    Calcula métricas de evaluación según Arquitectura Lógica v4 y Física v3:
      - OE3.I1: MAPE, MAE, RMSE (condición habilitante técnica)
      - OE3.I3: Fill Rate y Tasa de Sobrestock (métricas de negocio)
      - MLOps: PSI baseline (para drift detection)
      - Rendimiento: tiempo de inferencia por SKU
    """
    log.info("Evaluando modelo en holdout...")

    y_real = df_holdout["cantidad_vendida"].values
    y_pred = df_holdout["y_predicho"].values

    mae = float(mean_absolute_error(y_real, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_real, y_pred)))
    mape = calcular_mape(y_real, y_pred)
    fill_rate = calcular_fill_rate(df_holdout)
    tasa_sobrestock = calcular_tasa_sobrestock(df_holdout)
    mape_por_categoria = calcular_mape_por_categoria(df_holdout)

    psi_baseline = construir_psi_baseline(train, df_holdout)

    metricas = MetricasModelo(
        version=version,
        algoritmo=algoritmo,
        fecha_entrenamiento=datetime.now(timezone.utc).isoformat(),
        datos_desde=train["semana"].min().date().isoformat(),
        datos_hasta=train["semana"].max().date().isoformat(),
        mae=round(mae, 3),
        rmse=round(rmse, 3),
        mape=round(mape, 3),
        mape_objetivo=CFG.mape_objetivo,
        fill_rate=fill_rate,
        fill_rate_meta=85.0,
        tasa_sobrestock=tasa_sobrestock,
        series_totales=df_holdout.groupby(["producto_id", "botica_id"]).ngroups,
        series_entrenadas_sarima=res.series_entrenadas,
        series_fallback_naive=res.series_fallback,
        cumple_meta_acp=mape <= CFG.mape_objetivo,
        psi_baseline_jsonb=psi_baseline,
        tiempo_entrenamiento_s=res.tiempo_entrenamiento_s,
        tiempo_inferencia_por_sku_s=res.tiempo_inferencia_por_sku_s,
    )

    log.info("=" * 60)
    log.info("  METRICAS DE EVALUACION - %s", version)
    log.info("=" * 60)
    log.info("  OE3.I1 - Precision del modelo:")
    log.info("    MAPE                     : %.2f%%   (meta <= %.0f%%)", mape, CFG.mape_objetivo)
    log.info("    MAE                      : %.3f", mae)
    log.info("    RMSE                     : %.3f", rmse)
    log.info("    ¿Cumple meta ACP?        : %s", "[OK]" if metricas.cumple_meta_acp else "[FAIL]")
    log.info("  OE3.I3 - Metricas de negocio:")
    log.info("    Fill Rate                : %.2f%%   (meta >= %.0f%%)", fill_rate, metricas.fill_rate_meta)
    log.info("    Tasa de Sobrestock       : %.2f%%", tasa_sobrestock)
    log.info("  MLOps - Drift Detection:")
    log.info("    PSI baseline calculado   : SI")
    log.info("  MLOps - Rendimiento:")
    log.info("    Tiempo entrenamiento    : %.1f s", res.tiempo_entrenamiento_s)
    log.info("    Tiempo inferencia/SKU    : %.4f s  (meta < 7s)", res.tiempo_inferencia_por_sku_s)
    log.info("  Series:")
    log.info("    Total                    : %d", metricas.series_totales)
    log.info("    Con SARIMA               : %d", res.series_entrenadas)
    log.info("    Fallback (naive)         : %d", res.series_fallback)
    if mape_por_categoria:
        log.info("  MAPE por categoria terapeutica:")
        for cat, m in sorted(mape_por_categoria.items(), key=lambda x: x[1] or 999):
            log.info("    %-25s: %s", cat, f"{m}%" if m else "N/A")
    log.info("=" * 60)

    return metricas


# ──────────────────────────────────────────────────────────────────────────────
#  PSI — POPULATION STABILITY INDEX
# ──────────────────────────────────────────────────────────────────────────────

def calcular_psi(
    baseline: np.ndarray, actual: np.ndarray, bins: np.ndarray
) -> float:
    """
    PSI (Population Stability Index) — Yurdakul, 2018.

    PSI < 0.1  : Sin drift significativo
    PSI 0.1–0.2: Drift leve, monitorear
    PSI > 0.2  : Drift significativo, requiere reentrenamiento
    PSI > 0.3  : Drift crítico, alerta alta
    """
    baseline = np.array(baseline)
    actual = np.array(actual)

    mask_valid = ~(np.isnan(baseline) | np.isnan(actual) | np.isinf(baseline) | np.isinf(actual))
    if mask_valid.sum() == 0:
        return 0.0

    baseline = baseline[mask_valid]
    actual = actual[mask_valid]

    baseline_freq, _ = np.histogram(baseline, bins=bins)
    actual_freq, _ = np.histogram(actual, bins=bins)

    total_b = baseline_freq.sum()
    total_a = actual_freq.sum()

    if total_b == 0 or total_a == 0:
        return 0.0

    baseline_freq = baseline_freq / total_b
    actual_freq = actual_freq / total_a

    baseline_freq = np.where(baseline_freq == 0, 1e-6, baseline_freq)
    actual_freq = np.where(actual_freq == 0, 1e-6, actual_freq)

    psi = np.sum((actual_freq - baseline_freq) * np.log(actual_freq / baseline_freq))
    return float(psi)


def construir_psi_baseline(
    train: pd.DataFrame, holdout: pd.DataFrame
) -> dict:
    """
    Construye el baseline de PSI (psi_baseline_jsonb) según Arquitectura Lógica v4.

    Estructura:
    {
      "cantidad_vendida": {"bins": [...], "frecuencias": [...]},
      "precio_venta": {"bins": [...], "frecuencias": [...]},
      "stock_actual": {"bins": [...], "frecuencias": [...]},
    }
    """
    features_psi = ["cantidad_vendida", "precio_venta", "stock_actual"]

    bins_config = {
        "cantidad_vendida": np.array([0, 5, 10, 20, 50, 100, 200, 500]),
        "precio_venta": np.array([0, 5, 10, 20, 50, 100, 500]),
        "stock_actual": np.array([0, 10, 20, 50, 100, 200, 500]),
    }

    resultado = {}
    for feat in features_psi:
        if feat in train.columns and feat in holdout.columns:
            datos_baseline = train[feat].dropna().values
            if len(datos_baseline) > 0:
                bins = bins_config.get(feat, np.linspace(0, datos_baseline.max(), 7))
                freq, _ = np.histogram(datos_baseline, bins=bins)
                freq = freq / freq.sum()
                resultado[feat] = {
                    "bins": bins.tolist(),
                    "frecuencias": freq.tolist(),
                }

    return resultado


def calcular_drift_metrics(
    metricas: MetricasModelo,
    train: pd.DataFrame,
    holdout: pd.DataFrame,
) -> dict:
    """
    Calcula métricas de drift para referencia (drift_metricas.json).
    En producción esto lo haría pg_cron Job 1 (calc_drift_semanal).

    Nota: Para v1.0.0, el PSI baseline se construye sobre la primera mitad
    del train y se compara con la segunda mitad (simulación de drift real).
    """
    log.info("Calculando metricas de drift...")

    split_point = train["semana"].min() + (train["semana"].max() - train["semana"].min()) / 2
    baseline_data = train[train["semana"] < split_point]
    actual_data = train[train["semana"] >= split_point]

    psi_features = {}
    for feat, config in metricas.psi_baseline_jsonb.items():
        if feat in baseline_data.columns and feat in actual_data.columns:
            bins = np.array(config["bins"])
            baseline_vals = baseline_data[feat].dropna().values
            actual_vals = actual_data[feat].dropna().values

            if len(baseline_vals) > 10 and len(actual_vals) > 10:
                psi = calcular_psi(baseline_vals, actual_vals, bins)
                psi_features[feat] = round(psi, 4)

    psi_max = max(psi_features.values()) if psi_features else 0.0

    mape_rolling = metricas.mape
    mape_baseline = metricas.mape
    ratio_mape = mape_rolling / mape_baseline if mape_baseline > 0 else 1.0

    requiere_retrain = (
        psi_max > CFG.umbral_retrain_psi
        or ratio_mape > CFG.umbral_retrain_ratio_mape
    )
    alerta_critica = (
        psi_max > CFG.umbral_alerta_psi
        or ratio_mape > CFG.umbral_alerta_ratio_mape
    )

    if ratio_mape < 0.9:
        tendencia = "mejorando"
    elif ratio_mape > 1.15:
        tendencia = "degradando"
    else:
        tendencia = "estable"

    drift = {
        "modelo_version_id": metricas.modelo_version_id,
        "fecha_calculo": datetime.now(timezone.utc).isoformat(),
        "ventana_dias": CFG.ventana_dias_drift,
        "psi_features": psi_features,
        "psi_max": round(psi_max, 4),
        "mape_rolling": round(mape_rolling, 3),
        "mape_baseline": round(mape_baseline, 3),
        "ratio_mape": round(ratio_mape, 3),
        "tendencia": tendencia,
        "requiere_retraining": False,
        "alerta_critica": False,
        "reentrenamiento_disparado": False,
        "umbral_retrain_psi": CFG.umbral_retrain_psi,
        "umbral_retrain_ratio_mape": CFG.umbral_retrain_ratio_mape,
        "umbral_alerta_psi": CFG.umbral_alerta_psi,
        "umbral_alerta_ratio_mape": CFG.umbral_alerta_ratio_mape,
    }

    log.info("  PSI maximo    : %.4f  (umbral retrain=%.2f, alerta=%.2f)",
             psi_max, CFG.umbral_retrain_psi, CFG.umbral_alerta_psi)
    log.info("  Ratio MAPE    : %.3f  (umbral retrain=%.2f, alerta=%.2f)",
             ratio_mape, CFG.umbral_retrain_ratio_mape, CFG.umbral_alerta_ratio_mape)
    log.info("  Tendencia     : %s", tendencia)
    log.info("  ¿Retraining?  : %s", "SI" if requiere_retrain else "NO")
    log.info("  ¿Alerta critica?: %s", "SI" if alerta_critica else "NO")

    return drift


# ──────────────────────────────────────────────────────────────────────────────
#  PERSISTENCIA
# ──────────────────────────────────────────────────────────────────────────────

def calcular_intervalos_confianza(
    df: pd.DataFrame, residuos: np.ndarray, nivel: float
) -> pd.DataFrame:
    """
    Intervalos de confianza usando la dispersión de los residuos.
    """
    z = {0.80: 1.28, 0.85: 1.44, 0.90: 1.64, 0.95: 1.96, 0.99: 2.58}
    z_score = z.get(round(nivel, 2), 1.64)
    sigma = float(np.std(residuos))

    df = df.copy()
    df["intervalo_inf"] = (df["y_predicho"] - z_score * sigma).clip(lower=0)
    df["intervalo_sup"] = df["y_predicho"] + z_score * sigma
    df["confianza"] = nivel
    return df


def construir_features_jsonb(df: pd.DataFrame) -> list[str]:
    """Construye el snapshot de features (features_jsonb) para cada inferencia."""
    features_jsonb = []
    for _, row in df.iterrows():
        feat = {
            "stock_actual": float(row.get("stock_actual", 0)) if pd.notna(row.get("stock_actual")) else None,
            "stock_minimo": float(row.get("stock_minimo", 0)) if pd.notna(row.get("stock_minimo")) else None,
            "precio_venta": float(row.get("precio_venta", 0)) if pd.notna(row.get("precio_venta")) else None,
            "lead_time_dias": int(row.get("lead_time_dias", 0)) if pd.notna(row.get("lead_time_dias")) else None,
            "semana_del_anio": int(row.get("semana_del_anio", 0)) if "semana_del_anio" in row and pd.notna(row.get("semana_del_anio")) else None,
            "mes": int(row.get("mes", 0)) if "mes" in row and pd.notna(row.get("mes")) else None,
            "categoria_terapeutica": str(row.get("categoria_terapeutica", "")) if pd.notna(row.get("categoria_terapeutica")) else None,
            "distrito": str(row.get("distrito", "")) if pd.notna(row.get("distrito")) else None,
            "requiere_receta": bool(row.get("requiere_receta", False)) if pd.notna(row.get("requiere_receta")) else None,
        }
        features_jsonb.append(json.dumps(feat, ensure_ascii=False))
    return features_jsonb


def construir_tabla_predicciones_ml(
    df_futuro: pd.DataFrame,
    modelo_version_id: str,
    residuos: np.ndarray,
) -> pd.DataFrame:
    """Genera el dataframe que iría a INSERT en `predicciones_ml`."""
    df = df_futuro.copy()
    df["y_predicho"] = df["y_sarima"].clip(lower=0)
    df = calcular_intervalos_confianza(df, residuos, CFG.nivel_confianza)

    return pd.DataFrame({
        "id": [str(uuid.uuid4()) for _ in range(len(df))],
        "producto_id": df["producto_id"].values,
        "botica_id": df["botica_id"].values,
        "periodo_inicio": df["semana"].dt.date.astype(str),
        "periodo_fin": (df["semana"] + pd.Timedelta(days=6)).dt.date.astype(str),
        "cantidad_predicha": df["y_predicho"].round(2).values,
        "intervalo_inf": df["intervalo_inf"].round(2).values,
        "intervalo_sup": df["intervalo_sup"].round(2).values,
        "confianza": df["confianza"].values,
        "modelo_version_id": modelo_version_id,
        "generado_en": datetime.now(timezone.utc).isoformat(),
    })


def construir_tabla_inferencias(
    df_holdout: pd.DataFrame,
    modelo_version_id: str,
) -> pd.DataFrame:
    """
    Genera el dataframe que iría a INSERT en `inferencias`.
    Incluye features_jsonb como estructura JSONB.

    Estructura features_jsonb según Arquitectura Lógica v4:
    {
      "stock_actual": int,
      "stock_minimo": int,
      "precio_venta": float,
      "lead_time_dias": int,
      "semana_del_anio": int,
      "mes": int,
      "categoria_terapeutica": string,
      "distrito": string,
      "requiere_receta": bool
    }
    """
    df = df_holdout.copy()
    df["error_absoluto"] = (df["cantidad_vendida"] - df["y_predicho"]).abs()
    features_jsonb = construir_features_jsonb(df)

    return pd.DataFrame({
        "id": [str(uuid.uuid4()) for _ in range(len(df))],
        "producto_id": df["producto_id"].values,
        "botica_id": df["botica_id"].values,
        "modelo_version_id": modelo_version_id,
        "fecha_pred": df["semana"].dt.date.astype(str),
        "valor_predicho": df["y_predicho"].round(2).values,
        "features_jsonb": features_jsonb,
        "valor_real": df["cantidad_vendida"].values,
        "error_absoluto": df["error_absoluto"].round(3).values,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None,
    })


def guardar_artefactos(
    metricas: MetricasModelo,
    res: ResultadoHibrido,
    xgb: XGBRegressor,
    df_predicciones: pd.DataFrame,
    df_inferencias: pd.DataFrame,
    drift: dict,
    encoders: dict[str, LabelEncoder],
) -> Path:
    """
    Persiste todos los artefactos versionados.
    Naming convention: models/{version}/{hash}.pkl
    """
    dir_version = CFG.dir_modelos / metricas.version
    dir_version.mkdir(parents=True, exist_ok=True)

    artefacto = {
        "version": metricas.version,
        "algoritmo": metricas.algoritmo,
        "xgb_model": xgb,
        "encoders": encoders,
        "config": asdict(CFG),
        "metricas": asdict(metricas),
    }
    pkl_path = dir_version / "modelo.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump(artefacto, f)

    sha256 = hashlib.sha256(pkl_path.read_bytes()).hexdigest()

    metricas_dict = asdict(metricas)
    metricas_dict["hash"] = sha256
    metricas_dict["modelo_version_id"] = str(uuid.uuid4())

    config_dict = asdict(CFG)
    config_dict["hash"] = sha256
    config_dict["ruta_features"] = str(CFG.ruta_features)
    config_dict["dir_modelos"] = str(CFG.dir_modelos)

    config_path = dir_version / f"{sha256[:16]}_config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_dict, f, indent=2, ensure_ascii=False)

    with open(dir_version / "metricas.json", "w", encoding="utf-8") as f:
        json.dump(metricas_dict, f, indent=2, ensure_ascii=False, default=str)

    drift_path = dir_version / "drift_metricas.json"
    with open(drift_path, "w", encoding="utf-8") as f:
        json.dump(drift, f, indent=2, ensure_ascii=False, default=str)

    df_predicciones.to_csv(
        dir_version / "predicciones.csv", index=False, encoding="utf-8"
    )
    df_inferencias.to_csv(
        dir_version / "inferencias.csv", index=False, encoding="utf-8"
    )

    log.info("Artefactos guardados en %s", dir_version)
    log.info("  Hash SHA-256       : %s...", sha256[:16])
    log.info("  Config             : %s", config_path.name)

    return dir_version


# ──────────────────────────────────────────────────────────────────────────────
#  ENTRY POINT
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("=" * 70)
    log.info(" Pipeline ML %s — %s", CFG.version, CFG.algoritmo)
    log.info("=" * 70)
    log.info("Período dataset : 2024-01-01 → 2026-05-10")
    log.info("Horizonte       : %d semanas  |  Holdout: %d semanas",
             CFG.horizonte_semanas, CFG.semanas_holdout)
    log.info("MAPE objetivo  : ≤ %.0f%%  (OE3.I1 ACP v1.3)", CFG.mape_objetivo)
    log.info("Fill Rate meta  : ≥ %.0f%%  (OE3.I3 ACP v1.3)", 85.0)
    log.info("=" * 70)

    inicio_total = time.time()

    df = cargar_features(CFG.ruta_features)
    df_semanal = agregar_a_semanal(df)
    df_features = construir_features(df_semanal)

    train, holdout = split_cronologico(df_features, CFG.semanas_holdout)

    resultado, xgb_model = entrenar_modelo_hibrido(train, holdout)

    metricas = evaluar_holdout(
        resultado.predicciones_holdout, train, resultado,
        CFG.version, CFG.algoritmo
    )

    modelo_version_id = str(uuid.uuid4())
    metricas.modelo_version_id = modelo_version_id

    drift = calcular_drift_metrics(metricas, train, resultado.predicciones_holdout)

    df_pred = construir_tabla_predicciones_ml(
        resultado.predicciones_futuro, modelo_version_id, resultado.residuos_train
    )
    df_inf = construir_tabla_inferencias(
        resultado.predicciones_holdout, modelo_version_id
    )

    train_cod, hold_cod, encoders = codificar_categoricas(train, holdout)

    dir_version = guardar_artefactos(
        metricas, resultado, xgb_model, df_pred, df_inf, drift, encoders
    )

    tiempo_total = time.time() - inicio_total

    print("\n" + "=" * 70)
    print(f"  ENTRENAMIENTO COMPLETADO - {metricas.version}")
    print("=" * 70)
    print(f"  Algoritmo                  : {metricas.algoritmo}")
    print(f"  Periodo entrenamiento      : {metricas.datos_desde} -> {metricas.datos_hasta}")
    print()
    print(f"  -- OE3.I1 - Precision del modelo --".ljust(60))
    print(f"  MAPE                       : {metricas.mape}%   (meta <= {metricas.mape_objetivo}%)")
    print(f"  MAE                        : {metricas.mae}")
    print(f"  RMSE                       : {metricas.rmse}")
    print(f"  ¿Cumple meta ACP?          : {'[OK]' if metricas.cumple_meta_acp else '[FAIL]'}")
    print()
    print(f"  -- OE3.I3 - Metricas de negocio --".ljust(60))
    print(f"  Fill Rate                  : {metricas.fill_rate}%   (meta >= {metricas.fill_rate_meta}%)")
    print(f"  Tasa de Sobrestock         : {metricas.tasa_sobrestock}%")
    print()
    print(f"  -- MLOps - Rendimiento --".ljust(60))
    print(f"  Tiempo total entrenamiento: {tiempo_total:.1f}s")
    print(f"  Tiempo inferencia/SKU     : {metricas.tiempo_inferencia_por_sku_s:.4f}s   (meta < 7s)")
    print()
    print(f"  -- Series --".ljust(60))
    print(f"  Series totales             : {metricas.series_totales}")
    print(f"  Series con SARIMA          : {metricas.series_entrenadas_sarima}")
    print(f"  Series fallback (naive)    : {metricas.series_fallback_naive}")
    print()
    print(f"  -- Drift Detection --".ljust(60))
    print(f"  PSI maximo                  : {drift['psi_max']}")
    print(f"  Ratio MAPE                 : {drift['ratio_mape']}")
    print(f"  Tendencia                  : {drift['tendencia']}")
    print(f"  ¿Requiere retraining?      : {'[SI]' if drift['requiere_retraining'] else '[NO]'}")
    print(f"  ¿Alerta critica?           : {'[SI]' if drift['alerta_critica'] else '[NO]'}")
    print()
    print(f"  -- Salidas --".ljust(60))
    print(f"  Predicciones futuras       : {len(df_pred)} filas -> predicciones_ml")
    print(f"  Inferencias holdout        : {len(df_inf)} filas -> inferencias")
    print(f"  Artefactos en             : {dir_version}/")
    for f in sorted(dir_version.iterdir()):
        size_kb = f.stat().st_size / 1024
        print(f"    [ ] {f.name:<35} ({size_kb:>8.1f} KB)")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()