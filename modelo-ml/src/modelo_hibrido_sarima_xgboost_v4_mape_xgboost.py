# ==============================================================
# MODELO HÍBRIDO ADAPTATIVO SARIMA + XGBOOST (V4)
# Métrica principal: MAPE por categoría terapéutica
# Comparación: SARIMA, XGBoost independiente y modelo híbrido
#
# Mejoras metodológicas:
# - Holdout final de 12 semanas, no usado para seleccionar el modelo.
# - Cuatro folds temporales multihorizonte de 12 semanas.
# - SARIMA genera directamente los horizontes 1..12.
# - XGBoost global aprende errores SARIMA multihorizonte.
# - Features esenciales: predicción SARIMA y horizonte.
# - Comparación de corrección aditiva normalizada y logarítmica.
# - Alpha y tipo de corrección seleccionados por categoría según MAPE.
# - XGBoost se activa solo si mejora de forma estable en validación.
# - Predicción final directa, sin recursividad ni datos reales futuros.
# - Selección opcional del periodo SARIMA por categoría entre m=4,13,26.
# - XGBoost independiente entrenado sin variables derivadas de SARIMA.
# - Seasonal Naive se conserva solo como fallback interno, no como baseline evaluado.
# ==============================================================

# En Google Colab, ejecutar antes:
# !pip install -q pmdarima xgboost scikit-learn

import os
import json
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import mean_squared_error, mean_absolute_error

from xgboost import XGBRegressor
from pmdarima.arima import auto_arima, ARIMA, StepwiseContext

warnings.filterwarnings("ignore")

# ==============================================================
# 1. CONFIGURACIÓN
# ==============================================================

SEMILLA = 42
FRECUENCIA = "W-MON"

HORIZONTE = 12
N_FOLDS = 4
MIN_FOLDS_MEJORA = 2       # Se evalúan folds 2, 3 y 4 para XGBoost.
MIN_MEJORA_MAPE_PCT = 3.0
MAX_DETERIORO_RMSE_PCT = 5.0

# Para mantener estrictamente el alcance SARIMA, no se incluye m=1.
SELECCIONAR_PERIODO_POR_CATEGORIA = True
PERIODOS_SARIMA_CANDIDATOS = [4, 13, 26]
PERIODO_SARIMA_FALLBACK = 4
MIN_SEMANAS_SARIMA = 36
MIN_CICLOS_POR_PERIODO = 1.5

MAX_SEGUNDOS_AUTO_ARIMA = 20
MAX_PASOS_AUTO_ARIMA = 12

ALPHAS = [
    0.0, 0.1, 0.2, 0.3, 0.4,
    0.5, 0.6, 0.7, 0.8, 0.9,
    1.0, 1.2, 1.5,
]

# Búsqueda deliberadamente pequeña para reducir sobreajuste y tiempo.
GRID_XGB = [
    {
        "max_depth": 2,
        "learning_rate": 0.03,
        "min_child_weight": 5,
        "reg_alpha": 0.1,
        "reg_lambda": 10.0,
        "gamma": 0.0,
        "subsample": 0.80,
        "colsample_bytree": 0.80,
    },
    {
        "max_depth": 2,
        "learning_rate": 0.02,
        "min_child_weight": 10,
        "reg_alpha": 0.5,
        "reg_lambda": 10.0,
        "gamma": 0.1,
        "subsample": 0.80,
        "colsample_bytree": 0.80,
    },
    {
        "max_depth": 3,
        "learning_rate": 0.03,
        "min_child_weight": 10,
        "reg_alpha": 0.1,
        "reg_lambda": 15.0,
        "gamma": 0.1,
        "subsample": 0.85,
        "colsample_bytree": 0.80,
    },
]

OBJETIVOS_XGB = [
    "reg:squarederror",
    "reg:pseudohubererror",
]

COLUMNAS_CATEGORICAS = [
    "producto_id",
    "botica_id",
    "categoria_terapeutica",
]

COLUMNAS_NUMERICAS = [
    "horizonte",
    "pred_sarima",
    "log_pred_sarima",
    "mes",
    "semana_anio",
    "semana_sin",
    "semana_cos",
    "es_invierno",
    "es_verano",
    "stock_inicio_semana",
    "lead_time_dias",
    "ratio_stock_minimo",
    "ratio_stock_maximo",
    "lag_1",
    "lag_2",
    "lag_4",
    "lag_8",
    "lag_13",
    "lag_26",
    "rolling_mean_4",
    "rolling_mean_8",
    "rolling_mean_13",
    "rolling_mean_26",
    "rolling_std_4",
    "rolling_std_13",
    "rolling_std_26",
    "tendencia_4",
    "tendencia_13",
    "ratio_lag1_sarima",
    "ratio_media4_sarima",
    "escala_serie",
    "porcentaje_ceros",
    "semanas_desde_ultima_venta",
    "coeficiente_variacion",
]

FEATURES_XGB = COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS

# Para medir el MAPE de XGBoost como modelo independiente, se excluyen
# todas las variables que contienen información producida por SARIMA.
COLUMNAS_DERIVADAS_SARIMA = [
    "pred_sarima",
    "log_pred_sarima",
    "ratio_lag1_sarima",
    "ratio_media4_sarima",
]
COLUMNAS_NUMERICAS_XGB_SOLO = [
    columna for columna in COLUMNAS_NUMERICAS
    if columna not in COLUMNAS_DERIVADAS_SARIMA
]
FEATURES_XGB_SOLO = COLUMNAS_CATEGORICAS + COLUMNAS_NUMERICAS_XGB_SOLO

# ==============================================================
# 2. GOOGLE DRIVE Y RUTAS
# ==============================================================

from google.colab import drive

drive.mount("/content/drive")

RUTA_BASE = "/content/drive/MyDrive/Tesis"
RUTA_SERIES = os.path.join(RUTA_BASE, "series_sarima.csv")
RUTA_FEATURES = os.path.join(RUTA_BASE, "features_modelado.csv")
RUTA_SALIDA = os.path.join(RUTA_BASE, "resultados_modelo_hibrido_v4_mape_xgboost")

os.makedirs(RUTA_SALIDA, exist_ok=True)

# ==============================================================
# 3. FUNCIONES DE MÉTRICAS
# ==============================================================


def rmse(y_real, y_pred):
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    return float(np.sqrt(mean_squared_error(y_real, y_pred)))


def mape_seguro(y_real, y_pred):
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    mascara = np.isfinite(y_real) & np.isfinite(y_pred) & (np.abs(y_real) > 1e-12)
    if not mascara.any():
        return np.nan
    return float(
        np.mean(np.abs((y_real[mascara] - y_pred[mascara]) / y_real[mascara]))
        * 100.0
    )


def calcular_metricas(y_real, y_pred):
    y_real = np.asarray(y_real, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    error_abs = np.abs(y_real - y_pred)

    mae = float(mean_absolute_error(y_real, y_pred))
    valor_rmse = rmse(y_real, y_pred)
    mape = mape_seguro(y_real, y_pred)

    denominador_smape = np.abs(y_real) + np.abs(y_pred)
    mascara_smape = denominador_smape > 1e-12
    smape = (
        float(np.mean(2.0 * error_abs[mascara_smape] / denominador_smape[mascara_smape]) * 100.0)
        if mascara_smape.any()
        else np.nan
    )

    suma_real = np.sum(np.abs(y_real))
    wape = float(np.sum(error_abs) / suma_real * 100.0) if suma_real > 1e-12 else np.nan

    return {
        "MAE": mae,
        "RMSE": valor_rmse,
        "MAPE": mape,
        "sMAPE": smape,
        "WAPE": wape,
    }


def imprimir_metricas(nombre, metricas):
    print(
        f"{nombre:24s} | "
        f"MAE={metricas['MAE']:.2f} | "
        f"RMSE={metricas['RMSE']:.2f} | "
        f"MAPE={metricas['MAPE']:.2f}% | "
        f"sMAPE={metricas['sMAPE']:.2f}% | "
        f"WAPE={metricas['WAPE']:.2f}%"
    )


def agregar_categoria_semana(df, columnas_prediccion):
    columnas = ["categoria_terapeutica", "fecha_semana", "valor_real"] + columnas_prediccion
    faltantes = [c for c in columnas if c not in df.columns]
    if faltantes:
        raise ValueError(f"Faltan columnas para agregar por categoría: {faltantes}")

    agregaciones = {"valor_real": "sum"}
    agregaciones.update({col: "sum" for col in columnas_prediccion})

    return (
        df[columnas]
        .groupby(["categoria_terapeutica", "fecha_semana"], as_index=False)
        .agg(agregaciones)
        .sort_values(["categoria_terapeutica", "fecha_semana"])
    )


def mape_por_categoria_agregada(df, pred_col):
    agregado = agregar_categoria_semana(df, [pred_col])
    registros = []

    for categoria, grupo in agregado.groupby("categoria_terapeutica", sort=True):
        registros.append(
            {
                "categoria_terapeutica": str(categoria),
                "MAPE": mape_seguro(grupo["valor_real"], grupo[pred_col]),
                "n_semanas": int(len(grupo)),
            }
        )

    return pd.DataFrame(registros)


def macro_mape_categoria(df, pred_col):
    tabla = mape_por_categoria_agregada(df, pred_col)
    return float(tabla["MAPE"].mean()) if not tabla.empty else np.nan

# ==============================================================
# 4. FUNCIONES AUXILIARES
# ==============================================================


def safe_float(valor, default=0.0):
    convertido = pd.to_numeric(valor, errors="coerce")
    return float(convertido) if pd.notna(convertido) else float(default)


def valor_lag(historial, n):
    return float(historial[-n]) if len(historial) >= n else 0.0


def media_ventana(historial, n):
    if not historial:
        return 0.0
    ventana = historial[-n:] if len(historial) >= n else historial
    return float(np.mean(ventana))


def std_ventana(historial, n):
    if not historial:
        return 0.0
    ventana = historial[-n:] if len(historial) >= n else historial
    return float(np.std(ventana, ddof=0))


def tendencia_ventanas(historial, n):
    if len(historial) < 2:
        return 0.0
    mitad = max(1, n // 2)
    recientes = historial[-mitad:]
    anteriores = historial[-n:-mitad] if len(historial) >= n else historial[:-mitad]
    if not anteriores:
        return 0.0
    return float(np.mean(recientes) - np.mean(anteriores))


def semanas_desde_ultima_venta(historial):
    for i, valor in enumerate(reversed(historial)):
        if valor > 0:
            return float(i)
    return float(len(historial))


def obtener_snapshot_meta(features_serie, fecha_origen):
    historial = features_serie[features_serie["fecha_semana"] <= fecha_origen]
    if historial.empty:
        historial = features_serie

    if historial.empty:
        return {
            "categoria_terapeutica": "DESCONOCIDA",
            "stock_inicio_semana": 0.0,
            "lead_time_dias": 0.0,
            "ratio_stock_minimo": 0.0,
            "ratio_stock_maximo": 0.0,
        }

    fila = historial.sort_values("fecha_semana").iloc[-1]
    return {
        "categoria_terapeutica": str(fila.get("categoria_terapeutica", "DESCONOCIDA")),
        "stock_inicio_semana": safe_float(fila.get("stock_inicio_semana", 0.0)),
        "lead_time_dias": safe_float(fila.get("lead_time_dias", 0.0)),
        "ratio_stock_minimo": safe_float(fila.get("ratio_stock_minimo", 0.0)),
        "ratio_stock_maximo": safe_float(fila.get("ratio_stock_maximo", 0.0)),
    }


def construir_fila_features(
    pid,
    bid,
    categoria,
    fecha_objetivo,
    horizonte,
    pred_sarima,
    historial_demanda,
    meta,
):
    fecha_objetivo = pd.Timestamp(fecha_objetivo)
    semana = int(fecha_objetivo.isocalendar().week)

    escala = max(float(np.mean(historial_demanda)) if historial_demanda else 0.0, 1.0)
    porcentaje_ceros = (
        float(np.mean(np.asarray(historial_demanda, dtype=float) == 0.0))
        if historial_demanda
        else 1.0
    )
    coef_variacion = (
        float(np.std(historial_demanda, ddof=0) / escala)
        if historial_demanda
        else 0.0
    )

    lag1 = valor_lag(historial_demanda, 1)
    media4 = media_ventana(historial_demanda, 4)
    denominador_pred = max(float(pred_sarima), 1.0)

    return {
        "producto_id": str(pid),
        "botica_id": str(bid),
        "categoria_terapeutica": str(categoria),
        "horizonte": int(horizonte),
        "pred_sarima": float(pred_sarima),
        "log_pred_sarima": float(np.log1p(max(float(pred_sarima), 0.0))),
        "mes": int(fecha_objetivo.month),
        "semana_anio": semana,
        "semana_sin": float(np.sin(2.0 * np.pi * semana / 52.0)),
        "semana_cos": float(np.cos(2.0 * np.pi * semana / 52.0)),
        "es_invierno": int(fecha_objetivo.month in [6, 7, 8]),
        "es_verano": int(fecha_objetivo.month in [12, 1, 2, 3]),
        "stock_inicio_semana": safe_float(meta.get("stock_inicio_semana", 0.0)),
        "lead_time_dias": safe_float(meta.get("lead_time_dias", 0.0)),
        "ratio_stock_minimo": safe_float(meta.get("ratio_stock_minimo", 0.0)),
        "ratio_stock_maximo": safe_float(meta.get("ratio_stock_maximo", 0.0)),
        "lag_1": lag1,
        "lag_2": valor_lag(historial_demanda, 2),
        "lag_4": valor_lag(historial_demanda, 4),
        "lag_8": valor_lag(historial_demanda, 8),
        "lag_13": valor_lag(historial_demanda, 13),
        "lag_26": valor_lag(historial_demanda, 26),
        "rolling_mean_4": media4,
        "rolling_mean_8": media_ventana(historial_demanda, 8),
        "rolling_mean_13": media_ventana(historial_demanda, 13),
        "rolling_mean_26": media_ventana(historial_demanda, 26),
        "rolling_std_4": std_ventana(historial_demanda, 4),
        "rolling_std_13": std_ventana(historial_demanda, 13),
        "rolling_std_26": std_ventana(historial_demanda, 26),
        "tendencia_4": tendencia_ventanas(historial_demanda, 4),
        "tendencia_13": tendencia_ventanas(historial_demanda, 13),
        "ratio_lag1_sarima": float(lag1 / denominador_pred),
        "ratio_media4_sarima": float(media4 / denominador_pred),
        "escala_serie": escala,
        "porcentaje_ceros": porcentaje_ceros,
        "semanas_desde_ultima_venta": semanas_desde_ultima_venta(historial_demanda),
        "coeficiente_variacion": coef_variacion,
    }

# ==============================================================
# 5. FUNCIONES SARIMA
# ==============================================================


def serie_regular(grupo, fecha_fin=None):
    grupo = grupo.sort_values("fecha_semana")
    if fecha_fin is not None:
        grupo = grupo[grupo["fecha_semana"] <= fecha_fin]
    if grupo.empty:
        return pd.Series(dtype=float)
    return (
        grupo.set_index("fecha_semana")["cantidad_vendida"]
        .asfreq(FRECUENCIA)
        .fillna(0.0)
        .astype(float)
    )


def buscar_orden_sarima(serie_vals, periodo):
    serie_vals = pd.Series(serie_vals).astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0)

    minimo_periodo = int(np.ceil(periodo * MIN_CICLOS_POR_PERIODO))
    if len(serie_vals) < max(MIN_SEMANAS_SARIMA, minimo_periodo):
        return None
    if serie_vals.sum() <= 0 or serie_vals.nunique() <= 1:
        return None

    y_log = np.log1p(serie_vals.to_numpy(dtype=float))

    try:
        with StepwiseContext(max_steps=MAX_PASOS_AUTO_ARIMA, max_dur=MAX_SEGUNDOS_AUTO_ARIMA):
            modelo = auto_arima(
                y_log,
                seasonal=True,
                m=int(periodo),
                start_p=0,
                max_p=2,
                start_q=0,
                max_q=2,
                start_P=0,
                max_P=1,
                start_Q=0,
                max_Q=1,
                max_d=1,
                max_D=1,
                D=None,
                stepwise=True,
                trace=False,
                error_action="ignore",
                suppress_warnings=True,
                max_order=4,
                information_criterion="aic",
                method="lbfgs",
                maxiter=40,
                random_state=SEMILLA,
            )

        return {
            "order": tuple(modelo.order),
            "seasonal_order": tuple(modelo.seasonal_order),
            "with_intercept": bool(getattr(modelo, "with_intercept", True)),
        }
    except Exception:
        return None


def pronosticar_sarima_fijo(serie_vals, pasos, order, seasonal_order, with_intercept=True):
    serie_vals = pd.Series(serie_vals).astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    if serie_vals.empty or serie_vals.sum() <= 0 or serie_vals.nunique() <= 1:
        return None

    y_log = np.log1p(serie_vals.to_numpy(dtype=float))

    try:
        modelo = ARIMA(
            order=tuple(order),
            seasonal_order=tuple(seasonal_order),
            method="lbfgs",
            maxiter=50,
            suppress_warnings=True,
            with_intercept=bool(with_intercept),
        )
        modelo.fit(y_log)
        forecast_log = modelo.predict(n_periods=int(pasos))
        return np.clip(np.expm1(forecast_log), 0.0, None)
    except Exception:
        return None


def pronostico_fallback_directo(serie_hist, fechas_futuras, periodo):
    historial = serie_hist.copy().sort_index().astype(float)
    valores = {pd.Timestamp(fecha): float(valor) for fecha, valor in historial.items()}
    salida = []

    for fecha in fechas_futuras:
        fecha = pd.Timestamp(fecha)
        fecha_estacional = fecha - pd.Timedelta(weeks=int(periodo))

        if fecha_estacional in valores:
            pred = valores[fecha_estacional]
        elif valores:
            ultimos = list(valores.values())[-4:]
            pred = float(np.mean(ultimos))
        else:
            pred = 0.0

        pred = max(0.0, float(pred))
        salida.append(pred)
        valores[fecha] = pred

    return np.asarray(salida, dtype=float)

# ==============================================================
# 6. CARGA Y VALIDACIÓN DE DATOS
# ==============================================================

print("=" * 78)
print("CARGA DE DATOS")
print("=" * 78)

for ruta in [RUTA_SERIES, RUTA_FEATURES]:
    if not os.path.exists(ruta):
        raise FileNotFoundError(f"No se encontró el archivo: {ruta}")

series = pd.read_csv(RUTA_SERIES)
features = pd.read_csv(RUTA_FEATURES)

requeridas_series = {"fecha_semana", "producto_id", "botica_id", "cantidad_vendida"}
requeridas_features = {"fecha_semana", "producto_id", "botica_id", "categoria_terapeutica"}

faltan_series = requeridas_series - set(series.columns)
faltan_features = requeridas_features - set(features.columns)

if faltan_series:
    raise ValueError(f"Faltan columnas en series_sarima.csv: {sorted(faltan_series)}")
if faltan_features:
    raise ValueError(f"Faltan columnas en features_modelado.csv: {sorted(faltan_features)}")

series["fecha_semana"] = pd.to_datetime(series["fecha_semana"])
features["fecha_semana"] = pd.to_datetime(features["fecha_semana"])

for df in [series, features]:
    df["producto_id"] = df["producto_id"].astype(str)
    df["botica_id"] = df["botica_id"].astype(str)

series["cantidad_vendida"] = pd.to_numeric(series["cantidad_vendida"], errors="coerce").fillna(0.0)
features["categoria_terapeutica"] = features["categoria_terapeutica"].astype(str)

series = series.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)
features = features.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)

# Categoría estable por serie producto-botica.
mapa_categoria = (
    features.sort_values("fecha_semana")
    .groupby(["producto_id", "botica_id"], as_index=False)
    .tail(1)[["producto_id", "botica_id", "categoria_terapeutica"]]
)

series = series.merge(
    mapa_categoria,
    on=["producto_id", "botica_id"],
    how="left",
)
series["categoria_terapeutica"] = series["categoria_terapeutica"].fillna("DESCONOCIDA").astype(str)

categorias = sorted(series["categoria_terapeutica"].unique())
claves = sorted(series[["producto_id", "botica_id"]].drop_duplicates().itertuples(index=False, name=None))

print(f"Series: {len(series):,} filas")
print(f"Features: {len(features):,} filas")
print(f"Series producto-botica: {len(claves)}")
print(f"Categorías ({len(categorias)}): {categorias}")

# ==============================================================
# 7. SPLIT TEMPORAL Y FOLDS MULTIHORIZONTE
# ==============================================================

print("\n" + "=" * 78)
print("SPLIT TEMPORAL")
print("=" * 78)

fechas_features = sorted(pd.to_datetime(features["fecha_semana"].dropna().unique()))
if len(fechas_features) <= HORIZONTE:
    raise ValueError("No existen suficientes semanas para separar el holdout final.")

fechas_holdout = [pd.Timestamp(f) for f in fechas_features[-HORIZONTE:]]
fecha_corte = fechas_holdout[0] - pd.Timedelta(weeks=1)

fechas_train = sorted(pd.to_datetime(series.loc[series["fecha_semana"] <= fecha_corte, "fecha_semana"].unique()))
semanas_necesarias = N_FOLDS * HORIZONTE + MIN_SEMANAS_SARIMA
if len(fechas_train) < semanas_necesarias:
    raise ValueError(
        f"Se requieren al menos {semanas_necesarias} semanas antes del holdout; "
        f"solo se encontraron {len(fechas_train)}."
    )

folds = []
inicio_bloques = len(fechas_train) - N_FOLDS * HORIZONTE
for fold_id in range(1, N_FOLDS + 1):
    inicio = inicio_bloques + (fold_id - 1) * HORIZONTE
    fin = inicio + HORIZONTE
    fechas_val = [pd.Timestamp(f) for f in fechas_train[inicio:fin]]
    fecha_origen = fechas_val[0] - pd.Timedelta(weeks=1)
    folds.append(
        {
            "fold": fold_id,
            "fecha_origen": fecha_origen,
            "fechas_validacion": fechas_val,
        }
    )

train_series = series[series["fecha_semana"] <= fecha_corte].copy()
holdout_series = series[series["fecha_semana"].isin(fechas_holdout)].copy()

print(
    f"Entrenamiento disponible: {train_series['fecha_semana'].min().date()} → "
    f"{train_series['fecha_semana'].max().date()} ({len(fechas_train)} semanas)"
)
for info in folds:
    print(
        f"Fold {info['fold']}: origen={info['fecha_origen'].date()} | "
        f"validación={info['fechas_validacion'][0].date()} → "
        f"{info['fechas_validacion'][-1].date()}"
    )
print(f"Holdout final: {fechas_holdout[0].date()} → {fechas_holdout[-1].date()}")

# Diccionarios para acceso rápido.
grupos_series = {
    clave: grupo.copy()
    for clave, grupo in series.groupby(["producto_id", "botica_id"], sort=False)
}
grupos_features = {
    clave: grupo.copy()
    for clave, grupo in features.groupby(["producto_id", "botica_id"], sort=False)
}

# ==============================================================
# 8. SELECCIÓN DEL PERIODO SARIMA POR CATEGORÍA
# ==============================================================

print("\n" + "=" * 78)
print("SELECCIÓN DEL PERIODO SARIMA POR CATEGORÍA")
print("=" * 78)

periodo_por_categoria = {}
orden_categoria_periodo = {}
registros_periodos = []

serie_categoria = (
    train_series.groupby(["categoria_terapeutica", "fecha_semana"], as_index=False)["cantidad_vendida"]
    .sum()
)

for categoria in categorias:
    grupo_cat = serie_categoria[serie_categoria["categoria_terapeutica"] == categoria].copy()

    if not SELECCIONAR_PERIODO_POR_CATEGORIA:
        periodo_por_categoria[categoria] = PERIODO_SARIMA_FALLBACK
        print(f"{categoria:25s} → m={PERIODO_SARIMA_FALLBACK} (fijo)")
        continue

    mejor_periodo = None
    mejor_mape_mediano = np.inf

    for periodo in PERIODOS_SARIMA_CANDIDATOS:
        primer_origen = folds[0]["fecha_origen"]
        hist_inicial = serie_regular(grupo_cat, primer_origen)
        orden = buscar_orden_sarima(hist_inicial, periodo)

        if orden is None:
            registros_periodos.append(
                {
                    "categoria_terapeutica": categoria,
                    "periodo": periodo,
                    "mape_mediano": np.nan,
                    "folds_validos": 0,
                    "estado": "sin_orden",
                }
            )
            continue

        orden_categoria_periodo[(categoria, periodo)] = orden
        mapes_fold = []

        for info in folds:
            hist = serie_regular(grupo_cat, info["fecha_origen"])
            minimo_periodo = int(np.ceil(periodo * MIN_CICLOS_POR_PERIODO))
            if len(hist) < max(MIN_SEMANAS_SARIMA, minimo_periodo):
                continue

            pred = pronosticar_sarima_fijo(
                hist,
                HORIZONTE,
                orden["order"],
                orden["seasonal_order"],
                orden.get("with_intercept", True),
            )
            if pred is None:
                pred = pronostico_fallback_directo(hist, info["fechas_validacion"], periodo)

            real_map = grupo_cat.set_index("fecha_semana")["cantidad_vendida"].to_dict()
            reales = [safe_float(real_map.get(fecha, 0.0)) for fecha in info["fechas_validacion"]]
            mapes_fold.append(mape_seguro(reales, pred))

        mapes_validos = [m for m in mapes_fold if np.isfinite(m)]
        mediana = float(np.median(mapes_validos)) if mapes_validos else np.inf

        registros_periodos.append(
            {
                "categoria_terapeutica": categoria,
                "periodo": periodo,
                "mape_mediano": mediana if np.isfinite(mediana) else np.nan,
                "folds_validos": len(mapes_validos),
                "estado": "ok" if mapes_validos else "sin_folds",
            }
        )

        if mediana < mejor_mape_mediano:
            mejor_mape_mediano = mediana
            mejor_periodo = periodo

    if mejor_periodo is None:
        mejor_periodo = PERIODO_SARIMA_FALLBACK

    periodo_por_categoria[categoria] = int(mejor_periodo)
    texto_mape = f"{mejor_mape_mediano:.2f}%" if np.isfinite(mejor_mape_mediano) else "N/D"
    print(f"{categoria:25s} → m={mejor_periodo} | MAPE mediano={texto_mape}")

# ==============================================================
# 9. ORDEN SARIMA POR SERIE, ELEGIDO EN EL PRIMER ORIGEN
# ==============================================================

print("\n" + "=" * 78)
print("BÚSQUEDA DEL ORDEN SARIMA POR SERIE")
print("=" * 78)

orden_por_serie = {}
inicio_ordenes = time.time()

for i, clave in enumerate(claves, start=1):
    pid, bid = clave
    grupo = grupos_series[clave]
    categoria = str(grupo["categoria_terapeutica"].iloc[0])
    periodo = periodo_por_categoria.get(categoria, PERIODO_SARIMA_FALLBACK)
    hist_inicial = serie_regular(grupo, folds[0]["fecha_origen"])

    orden = buscar_orden_sarima(hist_inicial, periodo)
    orden_por_serie[clave] = orden

    if i == 1 or i % 10 == 0 or i == len(claves):
        transcurrido = time.time() - inicio_ordenes
        promedio = transcurrido / i
        restante = promedio * (len(claves) - i)
        exitosos = sum(v is not None for v in orden_por_serie.values())
        print(
            f"Órdenes: {i}/{len(claves)} | OK={exitosos} | "
            f"restante≈{restante / 60:.1f} min"
        )

# ==============================================================
# 10. DATASET OOF MULTIHORIZONTE
# ==============================================================

print("\n" + "=" * 78)
print("GENERACIÓN OOF MULTIHORIZONTE")
print("=" * 78)

oof_rows = []
inicio_oof = time.time()
n_fallback_oof = 0

for i, clave in enumerate(claves, start=1):
    pid, bid = clave
    grupo = grupos_series[clave]
    features_serie = grupos_features.get(clave, pd.DataFrame())
    categoria = str(grupo["categoria_terapeutica"].iloc[0])
    periodo = periodo_por_categoria.get(categoria, PERIODO_SARIMA_FALLBACK)
    orden = orden_por_serie.get(clave)
    mapa_real = grupo.set_index("fecha_semana")["cantidad_vendida"].to_dict()

    for info in folds:
        hist = serie_regular(grupo, info["fecha_origen"])
        historial_demanda = hist.to_list()
        meta = obtener_snapshot_meta(features_serie, info["fecha_origen"])

        pred_sarima = None
        if orden is not None:
            pred_sarima = pronosticar_sarima_fijo(
                hist,
                HORIZONTE,
                orden["order"],
                orden["seasonal_order"],
                orden.get("with_intercept", True),
            )

        if pred_sarima is None:
            pred_sarima = pronostico_fallback_directo(
                hist,
                info["fechas_validacion"],
                periodo,
            )
            n_fallback_oof += 1

        escala = max(float(np.mean(historial_demanda)) if historial_demanda else 0.0, 1.0)

        for h, fecha in enumerate(info["fechas_validacion"], start=1):
            pred_base = float(pred_sarima[h - 1])
            real = safe_float(mapa_real.get(fecha, 0.0))

            fila = construir_fila_features(
                pid=pid,
                bid=bid,
                categoria=categoria,
                fecha_objetivo=fecha,
                horizonte=h,
                pred_sarima=pred_base,
                historial_demanda=historial_demanda,
                meta=meta,
            )

            fila.update(
                {
                    "fold": int(info["fold"]),
                    "fecha_semana": pd.Timestamp(fecha),
                    "fecha_origen": pd.Timestamp(info["fecha_origen"]),
                    "valor_real": real,
                    "target_aditivo": float((real - pred_base) / escala),
                    "target_log": float(np.log1p(max(real, 0.0)) - np.log1p(max(pred_base, 0.0))),
                }
            )
            oof_rows.append(fila)

    if i == 1 or i % 10 == 0 or i == len(claves):
        transcurrido = time.time() - inicio_oof
        promedio = transcurrido / i
        restante = promedio * (len(claves) - i)
        print(
            f"OOF: {i}/{len(claves)} | filas={len(oof_rows):,} | "
            f"fallback={n_fallback_oof} | restante≈{restante / 60:.1f} min"
        )

df_oof = pd.DataFrame(oof_rows)
if df_oof.empty:
    raise RuntimeError("No se generaron registros OOF.")

print(f"Filas OOF: {len(df_oof):,}")
print(f"Folds presentes: {sorted(df_oof['fold'].unique())}")

# ==============================================================
# 11. PREPROCESAMIENTO XGBOOST
# ==============================================================

for columna in COLUMNAS_CATEGORICAS:
    df_oof[columna] = df_oof[columna].astype(str)
for columna in COLUMNAS_NUMERICAS:
    df_oof[columna] = pd.to_numeric(df_oof[columna], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0)

try:
    encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
except TypeError:
    encoder = OneHotEncoder(handle_unknown="ignore", sparse=True)

preprocesador = ColumnTransformer(
    transformers=[
        ("categoricas", encoder, COLUMNAS_CATEGORICAS),
        ("numericas", "passthrough", COLUMNAS_NUMERICAS),
    ],
    remainder="drop",
)

X_oof = preprocesador.fit_transform(df_oof[FEATURES_XGB])

# Preprocesamiento separado para XGBoost independiente. No se reutiliza el
# preprocesador híbrido porque este sí contiene predicciones de SARIMA.
try:
    encoder_xgb_solo = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
except TypeError:
    encoder_xgb_solo = OneHotEncoder(handle_unknown="ignore", sparse=True)

preprocesador_xgb_solo = ColumnTransformer(
    transformers=[
        ("categoricas", encoder_xgb_solo, COLUMNAS_CATEGORICAS),
        ("numericas", "passthrough", COLUMNAS_NUMERICAS_XGB_SOLO),
    ],
    remainder="drop",
)

X_oof_xgb_solo = preprocesador_xgb_solo.fit_transform(df_oof[FEATURES_XGB_SOLO])
df_oof["target_xgb_solo_log"] = np.log1p(
    np.maximum(df_oof["valor_real"].to_numpy(dtype=float), 0.0)
)

# Peso balanceado por categoría para alinear el entrenamiento con macro-MAPE.
conteos_categoria = df_oof["categoria_terapeutica"].value_counts()
df_oof["peso_categoria"] = df_oof["categoria_terapeutica"].map(
    lambda cat: 1.0 / float(conteos_categoria.loc[cat])
)
df_oof["peso_categoria"] = df_oof["peso_categoria"] / df_oof["peso_categoria"].mean()

# ==============================================================
# 12. XGBOOST: VALIDACIÓN TEMPORAL EXPANSIVA
# ==============================================================


def crear_xgb(params, objective, n_estimators=1200, early_stopping=True):
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


def best_iteration_seguro(modelo, default=400):
    try:
        return max(int(modelo.best_iteration) + 1, 20)
    except Exception:
        return int(default)


def convertir_correccion(df, pred_target, tipo, alpha):
    pred_base = df["pred_sarima"].to_numpy(dtype=float)
    pred_target = np.asarray(pred_target, dtype=float)

    if tipo == "aditivo":
        escala = df["escala_serie"].to_numpy(dtype=float)
        return np.clip(pred_base + float(alpha) * pred_target * escala, 0.0, None)

    if tipo == "log":
        return np.clip(
            np.expm1(np.log1p(np.maximum(pred_base, 0.0)) + float(alpha) * pred_target),
            0.0,
            None,
        )

    raise ValueError(f"Tipo de corrección desconocido: {tipo}")


def seleccionar_alpha_simple(df_pred, pred_target_col, tipo):
    mejor_alpha = 0.0
    mejor_macro_mape = macro_mape_categoria(df_pred.assign(pred_eval=df_pred["pred_sarima"]), "pred_eval")

    for alpha in ALPHAS:
        temporal = df_pred.copy()
        temporal["pred_eval"] = convertir_correccion(
            temporal,
            temporal[pred_target_col].to_numpy(dtype=float),
            tipo,
            alpha,
        )
        score = macro_mape_categoria(temporal, "pred_eval")
        if score < mejor_macro_mape:
            mejor_macro_mape = score
            mejor_alpha = float(alpha)

    return mejor_alpha, mejor_macro_mape


def predicciones_cv_xgb(target_col, tipo, params, objective):
    pred_cv = np.full(len(df_oof), np.nan, dtype=float)
    mejores_iteraciones = []

    # Fold 1 sirve de entrenamiento inicial; se predicen folds 2, 3 y 4.
    for fold_val in range(2, N_FOLDS + 1):
        idx_train = np.where(df_oof["fold"].to_numpy() < fold_val)[0]
        idx_val = np.where(df_oof["fold"].to_numpy() == fold_val)[0]

        if len(idx_train) == 0 or len(idx_val) == 0:
            continue

        modelo = crear_xgb(params, objective, early_stopping=True)
        modelo.fit(
            X_oof[idx_train],
            df_oof.iloc[idx_train][target_col].to_numpy(dtype=float),
            sample_weight=df_oof.iloc[idx_train]["peso_categoria"].to_numpy(dtype=float),
            eval_set=[
                (
                    X_oof[idx_val],
                    df_oof.iloc[idx_val][target_col].to_numpy(dtype=float),
                )
            ],
            verbose=False,
        )

        pred_cv[idx_val] = modelo.predict(X_oof[idx_val])
        mejores_iteraciones.append(best_iteration_seguro(modelo))

    mascara = np.isfinite(pred_cv)
    df_cv = df_oof.loc[mascara].copy()
    df_cv["pred_target_cv"] = pred_cv[mascara]

    alpha_global, macro_mape = seleccionar_alpha_simple(
        df_cv,
        "pred_target_cv",
        tipo,
    )

    return {
        "df_cv": df_cv,
        "alpha_global": alpha_global,
        "macro_mape": macro_mape,
        "n_estimators": int(np.median(mejores_iteraciones)) if mejores_iteraciones else 400,
    }


def predicciones_cv_xgb_solo(params, objective):
    """Valida XGBoost como predictor directo de demanda, sin usar SARIMA."""
    pred_cv = np.full(len(df_oof), np.nan, dtype=float)
    mejores_iteraciones = []

    # Fold 1 sirve como entrenamiento inicial; se predicen folds 2, 3 y 4.
    for fold_val in range(2, N_FOLDS + 1):
        idx_train = np.where(df_oof["fold"].to_numpy() < fold_val)[0]
        idx_val = np.where(df_oof["fold"].to_numpy() == fold_val)[0]

        if len(idx_train) == 0 or len(idx_val) == 0:
            continue

        modelo = crear_xgb(params, objective, early_stopping=True)
        modelo.fit(
            X_oof_xgb_solo[idx_train],
            df_oof.iloc[idx_train]["target_xgb_solo_log"].to_numpy(dtype=float),
            sample_weight=df_oof.iloc[idx_train]["peso_categoria"].to_numpy(dtype=float),
            eval_set=[
                (
                    X_oof_xgb_solo[idx_val],
                    df_oof.iloc[idx_val]["target_xgb_solo_log"].to_numpy(dtype=float),
                )
            ],
            verbose=False,
        )

        pred_log = modelo.predict(X_oof_xgb_solo[idx_val])
        pred_cv[idx_val] = np.clip(np.expm1(pred_log), 0.0, None)
        mejores_iteraciones.append(best_iteration_seguro(modelo))

    mascara = np.isfinite(pred_cv)
    df_cv = df_oof.loc[mascara].copy()
    df_cv["pred_xgboost_cv"] = pred_cv[mascara]
    macro_mape = macro_mape_categoria(df_cv, "pred_xgboost_cv")

    return {
        "df_cv": df_cv,
        "macro_mape": macro_mape,
        "n_estimators": int(np.median(mejores_iteraciones)) if mejores_iteraciones else 400,
    }


print("\n" + "=" * 78)
print("SELECCIÓN DE XGBOOST GLOBAL POR MACRO-MAPE DE CATEGORÍA")
print("=" * 78)

resultados_xgb = []
mejor_xgb_por_tipo = {}

for tipo, target_col in [("aditivo", "target_aditivo"), ("log", "target_log")]:
    mejor_tipo = None

    for objective in OBJETIVOS_XGB:
        for numero, params in enumerate(GRID_XGB, start=1):
            resultado = predicciones_cv_xgb(
                target_col=target_col,
                tipo=tipo,
                params=params,
                objective=objective,
            )

            registro = {
                "tipo": tipo,
                "objective": objective,
                "config_num": numero,
                "macro_mape_validacion": resultado["macro_mape"],
                "alpha_global_exploratorio": resultado["alpha_global"],
                "n_estimators": resultado["n_estimators"],
                **params,
            }
            resultados_xgb.append(registro)

            print(
                f"{tipo:8s} | {objective:22s} | cfg={numero} | "
                f"macro-MAPE={resultado['macro_mape']:.2f}% | "
                f"alpha≈{resultado['alpha_global']:.1f} | "
                f"trees={resultado['n_estimators']}"
            )

            candidato = {
                "tipo": tipo,
                "target_col": target_col,
                "objective": objective,
                "params": params.copy(),
                **resultado,
            }
            if mejor_tipo is None or candidato["macro_mape"] < mejor_tipo["macro_mape"]:
                mejor_tipo = candidato

    mejor_xgb_por_tipo[tipo] = mejor_tipo
    print(
        f"MEJOR {tipo.upper()}: objective={mejor_tipo['objective']} | "
        f"macro-MAPE={mejor_tipo['macro_mape']:.2f}%"
    )

print("\n" + "=" * 78)
print("SELECCIÓN DE XGBOOST INDEPENDIENTE POR MACRO-MAPE DE CATEGORÍA")
print("=" * 78)

resultados_xgb_solo = []
mejor_xgb_solo = None

for objective in OBJETIVOS_XGB:
    for numero, params in enumerate(GRID_XGB, start=1):
        resultado = predicciones_cv_xgb_solo(
            params=params,
            objective=objective,
        )

        registro = {
            "objective": objective,
            "config_num": numero,
            "macro_mape_validacion": resultado["macro_mape"],
            "n_estimators": resultado["n_estimators"],
            **params,
        }
        resultados_xgb_solo.append(registro)

        print(
            f"XGBoost solo | {objective:22s} | cfg={numero} | "
            f"macro-MAPE={resultado['macro_mape']:.2f}% | "
            f"trees={resultado['n_estimators']}"
        )

        candidato = {
            "objective": objective,
            "params": params.copy(),
            **resultado,
        }
        if mejor_xgb_solo is None or candidato["macro_mape"] < mejor_xgb_solo["macro_mape"]:
            mejor_xgb_solo = candidato

if mejor_xgb_solo is None:
    raise RuntimeError("No fue posible seleccionar una configuración para XGBoost independiente.")

print(
    f"MEJOR XGBOOST SOLO: objective={mejor_xgb_solo['objective']} | "
    f"macro-MAPE={mejor_xgb_solo['macro_mape']:.2f}% | "
    f"trees={mejor_xgb_solo['n_estimators']}"
)

# ==============================================================
# 13. ALPHA Y TIPO DE CORRECCIÓN POR CATEGORÍA
# ==============================================================

print("\n" + "=" * 78)
print("SELECCIÓN ADAPTATIVA POR CATEGORÍA (MAPE PRINCIPAL)")
print("=" * 78)

# Unir las predicciones CV de los dos mejores modelos.
df_cv_base = mejor_xgb_por_tipo["aditivo"]["df_cv"].copy()
df_cv_base = df_cv_base.rename(columns={"pred_target_cv": "pred_target_aditivo"})

df_cv_log = mejor_xgb_por_tipo["log"]["df_cv"][[
    "producto_id",
    "botica_id",
    "fecha_semana",
    "fold",
    "pred_target_cv",
]].copy()
df_cv_log = df_cv_log.rename(columns={"pred_target_cv": "pred_target_log"})

df_cv = df_cv_base.merge(
    df_cv_log,
    on=["producto_id", "botica_id", "fecha_semana", "fold"],
    how="inner",
)

config_categoria = {}
registros_config_categoria = []

for categoria in categorias:
    datos_cat = df_cv[df_cv["categoria_terapeutica"] == categoria].copy()
    if datos_cat.empty:
        config_categoria[categoria] = {"metodo": "sarima", "alpha": 0.0}
        continue

    evaluaciones = []

    for tipo, pred_col in [
        ("aditivo", "pred_target_aditivo"),
        ("log", "pred_target_log"),
    ]:
        for alpha in ALPHAS:
            fold_mapes = []
            fold_rmse_deterioro = []
            folds_mejora = 0

            for fold_id, grupo_fold in datos_cat.groupby("fold", sort=True):
                base = grupo_fold.copy()
                base["pred_base_eval"] = base["pred_sarima"]
                base["pred_hibrida_eval"] = convertir_correccion(
                    base,
                    base[pred_col].to_numpy(dtype=float),
                    tipo,
                    alpha,
                )

                mape_base = macro_mape_categoria(base, "pred_base_eval")
                mape_hib = macro_mape_categoria(base, "pred_hibrida_eval")
                mejora = (
                    (mape_base - mape_hib) / mape_base * 100.0
                    if np.isfinite(mape_base) and mape_base > 0
                    else 0.0
                )

                rmse_base = rmse(base["valor_real"], base["pred_base_eval"])
                rmse_hib = rmse(base["valor_real"], base["pred_hibrida_eval"])
                deterioro_rmse = (
                    (rmse_hib - rmse_base) / rmse_base * 100.0
                    if rmse_base > 0
                    else 0.0
                )

                fold_mapes.append((mape_base, mape_hib, mejora))
                fold_rmse_deterioro.append(deterioro_rmse)
                if mejora > 0:
                    folds_mejora += 1

            mejoras = [x[2] for x in fold_mapes]
            mapes_hib = [x[1] for x in fold_mapes]

            evaluaciones.append(
                {
                    "metodo": tipo,
                    "alpha": float(alpha),
                    "mape_mediano": float(np.median(mapes_hib)),
                    "mejora_mape_mediana_pct": float(np.median(mejoras)),
                    "folds_con_mejora": int(folds_mejora),
                    "deterioro_rmse_mediano_pct": float(np.median(fold_rmse_deterioro)),
                }
            )

    candidatos_validos = [
        e
        for e in evaluaciones
        if e["alpha"] > 0
        and e["folds_con_mejora"] >= MIN_FOLDS_MEJORA
        and e["mejora_mape_mediana_pct"] >= MIN_MEJORA_MAPE_PCT
        and e["deterioro_rmse_mediano_pct"] <= MAX_DETERIORO_RMSE_PCT
    ]

    if candidatos_validos:
        mejor = min(candidatos_validos, key=lambda x: x["mape_mediano"])
    else:
        # Fallback conservador: solo SARIMA.
        mejor = {
            "metodo": "sarima",
            "alpha": 0.0,
            "mape_mediano": float(
                np.median([
                    macro_mape_categoria(
                        grupo_fold.assign(pred_base_eval=grupo_fold["pred_sarima"]),
                        "pred_base_eval",
                    )
                    for _, grupo_fold in datos_cat.groupby("fold", sort=True)
                ])
            ),
            "mejora_mape_mediana_pct": 0.0,
            "folds_con_mejora": 0,
            "deterioro_rmse_mediano_pct": 0.0,
        }

    config_categoria[categoria] = mejor.copy()
    registros_config_categoria.append({"categoria_terapeutica": categoria, **mejor})

    print(
        f"{categoria:25s} | método={mejor['metodo']:8s} | "
        f"alpha={mejor['alpha']:.1f} | "
        f"MAPE mediano={mejor['mape_mediano']:.2f}% | "
        f"mejora={mejor['mejora_mape_mediana_pct']:+.2f}% | "
        f"folds={mejor['folds_con_mejora']}"
    )

# ==============================================================
# 14. ENTRENAMIENTO FINAL DE LOS DOS XGBOOST GLOBALES
# ==============================================================

print("\nEntrenando XGBoost globales finales con todos los folds OOF...")

modelos_xgb_finales = {}
for tipo in ["aditivo", "log"]:
    config = mejor_xgb_por_tipo[tipo]
    modelo = crear_xgb(
        config["params"],
        config["objective"],
        n_estimators=config["n_estimators"],
        early_stopping=False,
    )
    modelo.fit(
        X_oof,
        df_oof[config["target_col"]].to_numpy(dtype=float),
        sample_weight=df_oof["peso_categoria"].to_numpy(dtype=float),
        verbose=False,
    )
    modelos_xgb_finales[tipo] = modelo
    print(
        f"Modelo {tipo}: objective={config['objective']} | "
        f"n_estimators={config['n_estimators']}"
    )

print("Entrenando XGBoost independiente final...")
modelo_xgb_solo_final = crear_xgb(
    mejor_xgb_solo["params"],
    mejor_xgb_solo["objective"],
    n_estimators=mejor_xgb_solo["n_estimators"],
    early_stopping=False,
)
modelo_xgb_solo_final.fit(
    X_oof_xgb_solo,
    df_oof["target_xgb_solo_log"].to_numpy(dtype=float),
    sample_weight=df_oof["peso_categoria"].to_numpy(dtype=float),
    verbose=False,
)
print(
    f"XGBoost solo: objective={mejor_xgb_solo['objective']} | "
    f"n_estimators={mejor_xgb_solo['n_estimators']}"
)

# ==============================================================
# 15. SARIMA FINAL Y FEATURES DEL HOLDOUT
# ==============================================================

print("\n" + "=" * 78)
print("PRONÓSTICO DIRECTO DEL HOLDOUT")
print("=" * 78)

holdout_rows = []
inicio_holdout = time.time()
n_fallback_holdout = 0

for i, clave in enumerate(claves, start=1):
    pid, bid = clave
    grupo = grupos_series[clave]
    features_serie = grupos_features.get(clave, pd.DataFrame())
    categoria = str(grupo["categoria_terapeutica"].iloc[0])
    periodo = periodo_por_categoria.get(categoria, PERIODO_SARIMA_FALLBACK)
    orden = orden_por_serie.get(clave)

    hist = serie_regular(grupo, fecha_corte)
    historial_demanda = hist.to_list()
    meta = obtener_snapshot_meta(features_serie, fecha_corte)
    mapa_real = grupo.set_index("fecha_semana")["cantidad_vendida"].to_dict()

    pred_sarima = None
    if orden is not None:
        pred_sarima = pronosticar_sarima_fijo(
            hist,
            HORIZONTE,
            orden["order"],
            orden["seasonal_order"],
            orden.get("with_intercept", True),
        )

    if pred_sarima is None:
        pred_sarima = pronostico_fallback_directo(hist, fechas_holdout, periodo)
        n_fallback_holdout += 1


    for h, fecha in enumerate(fechas_holdout, start=1):
        pred_base = float(pred_sarima[h - 1])
        fila = construir_fila_features(
            pid=pid,
            bid=bid,
            categoria=categoria,
            fecha_objetivo=fecha,
            horizonte=h,
            pred_sarima=pred_base,
            historial_demanda=historial_demanda,
            meta=meta,
        )
        fila.update(
            {
                "fecha_semana": pd.Timestamp(fecha),
                "valor_real": safe_float(mapa_real.get(fecha, 0.0)),
            }
        )
        holdout_rows.append(fila)

    if i == 1 or i % 10 == 0 or i == len(claves):
        transcurrido = time.time() - inicio_holdout
        promedio = transcurrido / i
        restante = promedio * (len(claves) - i)
        print(
            f"Holdout: {i}/{len(claves)} | fallback={n_fallback_holdout} | "
            f"restante≈{restante / 60:.1f} min"
        )

df_holdout = pd.DataFrame(holdout_rows)

for columna in COLUMNAS_CATEGORICAS:
    df_holdout[columna] = df_holdout[columna].astype(str)
for columna in COLUMNAS_NUMERICAS:
    df_holdout[columna] = pd.to_numeric(df_holdout[columna], errors="coerce").replace([np.inf, -np.inf], np.nan).fillna(0.0)

X_holdout = preprocesador.transform(df_holdout[FEATURES_XGB])
df_holdout["pred_target_aditivo"] = modelos_xgb_finales["aditivo"].predict(X_holdout)
df_holdout["pred_target_log"] = modelos_xgb_finales["log"].predict(X_holdout)

X_holdout_xgb_solo = preprocesador_xgb_solo.transform(df_holdout[FEATURES_XGB_SOLO])
pred_xgb_solo_log = modelo_xgb_solo_final.predict(X_holdout_xgb_solo)
df_holdout["pred_xgboost"] = np.clip(np.expm1(pred_xgb_solo_log), 0.0, None)

pred_hibrida = []
metodos_aplicados = []
alphas_aplicados = []

for _, fila in df_holdout.iterrows():
    categoria = str(fila["categoria_terapeutica"])
    config = config_categoria.get(categoria, {"metodo": "sarima", "alpha": 0.0})
    metodo = config["metodo"]
    alpha = float(config["alpha"])
    pred_base = float(fila["pred_sarima"])

    if metodo == "aditivo" and alpha > 0:
        pred = pred_base + alpha * float(fila["pred_target_aditivo"]) * float(fila["escala_serie"])
    elif metodo == "log" and alpha > 0:
        pred = np.expm1(
            np.log1p(max(pred_base, 0.0))
            + alpha * float(fila["pred_target_log"])
        )
    else:
        pred = pred_base

    pred_hibrida.append(max(0.0, float(pred)))
    metodos_aplicados.append(metodo)
    alphas_aplicados.append(alpha)

df_holdout["pred_hibrida"] = pred_hibrida
df_holdout["metodo_correccion"] = metodos_aplicados
df_holdout["alpha_categoria"] = alphas_aplicados

# ==============================================================
# 16. EVALUACIÓN PRINCIPAL: MAPE POR CATEGORÍA TERAPÉUTICA
# ==============================================================

print("\n" + "=" * 78)
print("EVALUACIÓN FINAL: MAPE POR CATEGORÍA TERAPÉUTICA")
print("=" * 78)

agregado_categoria = agregar_categoria_semana(
    df_holdout,
    ["pred_xgboost", "pred_sarima", "pred_hibrida"],
)

resultados_categoria = []
for categoria, grupo in agregado_categoria.groupby("categoria_terapeutica", sort=True):
    mape_xgboost = mape_seguro(grupo["valor_real"], grupo["pred_xgboost"])
    mape_sarima = mape_seguro(grupo["valor_real"], grupo["pred_sarima"])
    mape_hibrido = mape_seguro(grupo["valor_real"], grupo["pred_hibrida"])

    mejora = (
        (mape_sarima - mape_hibrido) / mape_sarima * 100.0
        if np.isfinite(mape_sarima) and mape_sarima > 0
        else np.nan
    )

    config = config_categoria.get(str(categoria), {"metodo": "sarima", "alpha": 0.0})
    resultados_categoria.append(
        {
            "categoria_terapeutica": str(categoria),
            "periodo_sarima": periodo_por_categoria.get(str(categoria), PERIODO_SARIMA_FALLBACK),
            "metodo_correccion": config.get("metodo", "sarima"),
            "alpha": config.get("alpha", 0.0),
            "mape_xgboost": mape_xgboost,
            "mape_sarima": mape_sarima,
            "mape_hibrido": mape_hibrido,
            "mejora_mape_vs_sarima_pct": mejora,
        }
    )

df_resultados_categoria = pd.DataFrame(resultados_categoria).sort_values(
    "mejora_mape_vs_sarima_pct",
    ascending=False,
)

macro_mape_xgboost = float(df_resultados_categoria["mape_xgboost"].mean())
macro_mape_sarima = float(df_resultados_categoria["mape_sarima"].mean())
macro_mape_hibrido = float(df_resultados_categoria["mape_hibrido"].mean())
mediana_mape_hibrido = float(df_resultados_categoria["mape_hibrido"].median())

mejora_macro_mape = (
    (macro_mape_sarima - macro_mape_hibrido) / macro_mape_sarima * 100.0
    if macro_mape_sarima > 0
    else np.nan
)

print(
    df_resultados_categoria.to_string(
        index=False,
        float_format=lambda x: f"{x:.2f}",
    )
)

print("\nRESUMEN DE LA MÉTRICA PRINCIPAL")
print(f"Macro-MAPE XGBoost:       {macro_mape_xgboost:.2f}%")
print(f"Macro-MAPE SARIMA:        {macro_mape_sarima:.2f}%")
print(f"Macro-MAPE híbrido:       {macro_mape_hibrido:.2f}%")
print(f"Mediana MAPE híbrido:     {mediana_mape_hibrido:.2f}%")
print(f"Mejora macro-MAPE vs SARIMA: {mejora_macro_mape:+.2f}%")
print(
    "Categorías mejoradas: "
    f"{int((df_resultados_categoria['mejora_mape_vs_sarima_pct'] > 0).sum())}/"
    f"{len(df_resultados_categoria)}"
)

# ==============================================================
# 17. MÉTRICAS SECUNDARIAS GLOBALES
# ==============================================================

print("\n" + "=" * 78)
print("MÉTRICAS SECUNDARIAS GLOBALES")
print("=" * 78)

metricas_xgboost = calcular_metricas(df_holdout["valor_real"], df_holdout["pred_xgboost"])
metricas_sarima = calcular_metricas(df_holdout["valor_real"], df_holdout["pred_sarima"])
metricas_hibrido = calcular_metricas(df_holdout["valor_real"], df_holdout["pred_hibrida"])

imprimir_metricas("XGBoost", metricas_xgboost)
imprimir_metricas("SARIMA", metricas_sarima)
imprimir_metricas("SARIMA + XGBoost", metricas_hibrido)

# ==============================================================
# 18. GUARDAR RESULTADOS
# ==============================================================

Path(RUTA_SALIDA).mkdir(parents=True, exist_ok=True)

pd.DataFrame(registros_periodos).to_csv(
    os.path.join(RUTA_SALIDA, "seleccion_periodo_sarima_categoria.csv"),
    index=False,
)
pd.DataFrame(resultados_xgb).to_csv(
    os.path.join(RUTA_SALIDA, "busqueda_xgboost_residuales.csv"),
    index=False,
)
pd.DataFrame(resultados_xgb_solo).to_csv(
    os.path.join(RUTA_SALIDA, "busqueda_xgboost_independiente.csv"),
    index=False,
)
pd.DataFrame(registros_config_categoria).to_csv(
    os.path.join(RUTA_SALIDA, "configuracion_categoria.csv"),
    index=False,
)
df_oof.to_csv(
    os.path.join(RUTA_SALIDA, "dataset_oof_multihorizonte.csv"),
    index=False,
)
df_holdout.to_csv(
    os.path.join(RUTA_SALIDA, "predicciones_holdout.csv"),
    index=False,
)
agregado_categoria.to_csv(
    os.path.join(RUTA_SALIDA, "predicciones_categoria_semana.csv"),
    index=False,
)
df_resultados_categoria.to_csv(
    os.path.join(RUTA_SALIDA, "mape_por_categoria.csv"),
    index=False,
)

metricas_globales = pd.DataFrame(
    [
        {"modelo": "XGBoost", **metricas_xgboost},
        {"modelo": "SARIMA", **metricas_sarima},
        {"modelo": "SARIMA_XGBoost", **metricas_hibrido},
    ]
)
metricas_globales.to_csv(
    os.path.join(RUTA_SALIDA, "metricas_globales_secundarias.csv"),
    index=False,
)

resumen_principal = pd.DataFrame(
    [
        {
            "modelo": "XGBoost",
            "macro_MAPE_categoria": macro_mape_xgboost,
        },
        {
            "modelo": "SARIMA",
            "macro_MAPE_categoria": macro_mape_sarima,
        },
        {
            "modelo": "SARIMA_XGBoost",
            "macro_MAPE_categoria": macro_mape_hibrido,
        },
    ]
)
resumen_principal.to_csv(
    os.path.join(RUTA_SALIDA, "resumen_macro_mape_categoria.csv"),
    index=False,
)

config_exportar = {
    "metrica_principal": "MAPE agregado por categoria terapeutica y semana",
    "horizonte": HORIZONTE,
    "n_folds": N_FOLDS,
    "periodo_por_categoria": periodo_por_categoria,
    "config_categoria": config_categoria,
    "mejor_xgb_aditivo": {
        "objective": mejor_xgb_por_tipo["aditivo"]["objective"],
        "params": mejor_xgb_por_tipo["aditivo"]["params"],
        "n_estimators": mejor_xgb_por_tipo["aditivo"]["n_estimators"],
        "macro_mape_validacion": mejor_xgb_por_tipo["aditivo"]["macro_mape"],
    },
    "mejor_xgb_log": {
        "objective": mejor_xgb_por_tipo["log"]["objective"],
        "params": mejor_xgb_por_tipo["log"]["params"],
        "n_estimators": mejor_xgb_por_tipo["log"]["n_estimators"],
        "macro_mape_validacion": mejor_xgb_por_tipo["log"]["macro_mape"],
    },
    "mejor_xgb_independiente": {
        "objective": mejor_xgb_solo["objective"],
        "params": mejor_xgb_solo["params"],
        "n_estimators": mejor_xgb_solo["n_estimators"],
        "macro_mape_validacion": mejor_xgb_solo["macro_mape"],
        "features_excluidas_por_dependencia_sarima": COLUMNAS_DERIVADAS_SARIMA,
    },
    "macro_mape_xgboost": macro_mape_xgboost,
    "macro_mape_sarima": macro_mape_sarima,
    "macro_mape_hibrido": macro_mape_hibrido,
    "mejora_macro_mape_vs_sarima_pct": mejora_macro_mape,
}

with open(os.path.join(RUTA_SALIDA, "configuracion_final.json"), "w", encoding="utf-8") as archivo:
    json.dump(config_exportar, archivo, ensure_ascii=False, indent=2, default=str)

print("\n" + "=" * 78)
print("RESUMEN FINAL")
print("=" * 78)
print("Modelo: SARIMA + XGBoost global adaptativo por categoría")
print("Métrica principal: MAPE por categoría terapéutica")
print(f"Macro-MAPE XGBoost: {macro_mape_xgboost:.2f}%")
print(f"Macro-MAPE SARIMA:  {macro_mape_sarima:.2f}%")
print(f"Macro-MAPE híbrido: {macro_mape_hibrido:.2f}%")
print(f"Mejora: {mejora_macro_mape:+.2f}%")
print(f"Fallback SARIMA en OOF: {n_fallback_oof}")
print(f"Fallback SARIMA en holdout: {n_fallback_holdout}")
print(f"Resultados guardados en:\n{RUTA_SALIDA}")