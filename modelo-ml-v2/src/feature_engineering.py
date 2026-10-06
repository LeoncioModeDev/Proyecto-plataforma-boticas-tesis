# -*- coding: utf-8 -*-
"""
Feature Engineering para pronóstico semanal de demanda farmacéutica.

Responsabilidad
---------------
Transformar el dataset semanal generado por `generar_dataset.ipynb` en:

1. `features_modelado.csv`
   Dataset histórico con variables construidas exclusivamente a partir de
   información disponible antes de la semana objetivo.

2. `series_sarima.csv`
   Series semanales completas producto-botica para el ajuste de SARIMA.

3. `catalogo_features.csv`
   Catálogo auditable de las variables que podrán utilizar XGBoost y el
   componente híbrido.

4. `feature_engineering_reporte.json`
   Reporte de calidad, trazabilidad y decisiones metodológicas.

Este módulo NO entrena SARIMA, XGBoost ni el modelo híbrido.

Principios metodológicos
------------------------
- El target oficial es `cantidad_vendida`.
- No se usan como predictores `demanda_insatisfecha` ni `stockout_flag`;
  se conservan únicamente como diagnósticos del escenario sintético.
- Tampoco se usan variables de política/estado de inventario
  (`stock_inicio_semana`, `stock_minimo`, `stock_maximo`, `lead_time_dias`)
  dentro del forecasting oficial. Estas variables pertenecen a la capa
  posterior de recomendaciones e inventario.
- Los lags, ventanas móviles, tendencias y estadísticas de serie utilizan
  únicamente observaciones anteriores a la semana objetivo (`shift(1)`).
- La estacionalidad anual se representa mediante codificación cíclica de la
  semana del año. No se incluye un `lag_52` en la especificación oficial
  porque el experimento contiene 123 semanas, es decir, poco más de dos
  ciclos anuales.
- La categoría terapéutica se conserva como metadato, feature categórica y
  nivel de adaptación/evaluación; no se interpreta como evidencia empírica
  de comportamiento farmacéutico real.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


# =============================================================================
# 1. CONFIGURACIÓN GENERAL
# =============================================================================

RUTA_COLAB_PROYECTO = Path(
    "/content/drive/MyDrive/Universidad/UNIVERSIDAD 10MO CICLO/TP2/Modelo Corregido"
)


def resolver_raiz_proyecto() -> Path:
    """
    Resuelve la raíz del proyecto.

    Prioridad:
    1. Ruta oficial utilizada en Google Colab.
    2. Carpeta del script o alguno de sus padres que contenga
       data/ml/features_entrenamiento.csv.
    """
    if RUTA_COLAB_PROYECTO.exists():
        return RUTA_COLAB_PROYECTO

    if "__file__" in globals():
        ruta_script = Path(__file__).resolve()
        candidatos = [ruta_script.parent, *ruta_script.parents]
        for candidato in candidatos:
            if (candidato / "data" / "ml" / "features_entrenamiento.csv").exists():
                return candidato

    return Path.cwd()


RAIZ_PROYECTO = resolver_raiz_proyecto()

DIR_DATA_ML = RAIZ_PROYECTO / "data" / "ml"
DIR_REPORTES = RAIZ_PROYECTO / "reportes" / "feature_engineering"

RUTA_ENTRADA = DIR_DATA_ML / "features_entrenamiento.csv"
RUTA_FEATURES_MODELADO = DIR_DATA_ML / "features_modelado.csv"
RUTA_SERIES_SARIMA = DIR_DATA_ML / "series_sarima.csv"
RUTA_CATALOGO_FEATURES = DIR_REPORTES / "catalogo_features.csv"
RUTA_REPORTE = DIR_REPORTES / "feature_engineering_reporte.json"

CLAVES_SERIE = ["org_id", "botica_id", "producto_id"]
CLAVE_TEMPORAL = [*CLAVES_SERIE, "fecha_semana"]

TARGET = "cantidad_vendida"

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

# Variables válidas en el dataset operativo, pero excluidas del forecasting
# oficial para mantener separación entre pronóstico e inventario y reducir
# circularidad del escenario sintético.
COLUMNAS_EXCLUIDAS_PRONOSTICO = [
    "demanda_insatisfecha",
    "stockout_flag",
    "stock_inicio_semana",
    "stock_minimo",
    "stock_maximo",
    "lead_time_dias",
]

# Variables internas que el simulador puede conocer, pero que nunca deben
# aparecer como predictors.
COLUMNAS_INTERNAS_SIMULADOR_PROHIBIDAS = [
    "demanda_latente",
    "mu_esperada",
    "factor_latente_semanal",
    "shock_multiplicador",
    "base_diaria_serie",
    "volatilidad_observacion",
    "amplitud_estacional",
    "centro_estacional_dia_anio",
    "desfase_estacional_dias",
    "tendencia_anual",
    "rho_ar",
    "sigma_ar",
    "cambio_estructural_activo",
    "fecha_cambio_estructural",
    "multiplicador_cambio_estructural",
    "prob_cero_extra",
    "shock_probabilidad",
]

LAGS_DEMANDA = [1, 2, 4, 8, 13, 26]
VENTANAS_MEDIA = [4, 8, 13, 26]
VENTANAS_STD = [4, 13, 26]
VENTANAS_TENDENCIA = [4, 13]
MAX_HISTORIA_REQUERIDA = max(
    LAGS_DEMANDA + VENTANAS_MEDIA + VENTANAS_STD + VENTANAS_TENDENCIA
)

COLUMNAS_CATEGORICAS_MODELO = [
    "producto_id",
    "botica_id",
    "categoria_terapeutica",
]

# `horizonte` se añade en el pipeline multihorizonte. Las demás variables
# existen también en features_modelado.csv.
COLUMNAS_NUMERICAS_BASE = [
    "horizonte",
    "semana_sin",
    "semana_cos",
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
    "variacion_1_semana",
    "variacion_4_semanas",
    "escala_serie",
    "porcentaje_ceros",
    "semanas_desde_ultima_venta",
    "coeficiente_variacion",
]

# El componente híbrido recibe el forecast SARIMA como información adicional.
COLUMNAS_SARIMA_HIBRIDO = [
    "pred_sarima",
    "log_pred_sarima",
]

FEATURES_XGB_INDEPENDIENTE = (
    COLUMNAS_CATEGORICAS_MODELO + COLUMNAS_NUMERICAS_BASE
)

FEATURES_HIBRIDO = (
    COLUMNAS_CATEGORICAS_MODELO
    + COLUMNAS_NUMERICAS_BASE
    + COLUMNAS_SARIMA_HIBRIDO
)

# Alias para el pipeline oficial.
FEATURES_MODELO_OFICIAL = FEATURES_HIBRIDO

# Columnas que sí se exportan en features_modelado.csv. `horizonte` y las
# features SARIMA se construyen después dentro del pipeline.
COLUMNAS_FEATURES_HISTORICAS = [
    "semana_sin",
    "semana_cos",
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
    "variacion_1_semana",
    "variacion_4_semanas",
    "escala_serie",
    "porcentaje_ceros",
    "semanas_desde_ultima_venta",
    "coeficiente_variacion",
]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("feature-engineering")


# =============================================================================
# 2. UTILIDADES Y TRAZABILIDAD
# =============================================================================

def convertir_serializable(valor):
    """Convierte objetos NumPy/Pandas en tipos serializables a JSON."""
    if isinstance(valor, dict):
        return {str(k): convertir_serializable(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [convertir_serializable(v) for v in valor]
    if isinstance(valor, tuple):
        return [convertir_serializable(v) for v in valor]
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating,)):
        return None if np.isnan(valor) else float(valor)
    if isinstance(valor, (np.bool_,)):
        return bool(valor)
    if isinstance(valor, pd.Timestamp):
        return valor.strftime("%Y-%m-%d")
    if pd.isna(valor):
        return None
    return valor


def sha256_archivo(ruta: Path) -> str | None:
    """Calcula SHA-256 para identificar exactamente el archivo procesado."""
    if not ruta.exists():
        return None

    hash_obj = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
            hash_obj.update(bloque)
    return hash_obj.hexdigest()


def _safe_float(valor, default: float = 0.0) -> float:
    convertido = pd.to_numeric(valor, errors="coerce")
    return float(convertido) if pd.notna(convertido) else float(default)


def _valor_lag(historial: list[float], n: int) -> float:
    return float(historial[-n]) if len(historial) >= n else np.nan


def _media_ventana(historial: list[float], n: int) -> float:
    if len(historial) < n:
        return np.nan
    return float(np.mean(historial[-n:]))


def _std_ventana(historial: list[float], n: int) -> float:
    if len(historial) < n:
        return np.nan
    return float(np.std(historial[-n:], ddof=0))


def _pendiente_lineal(valores: Iterable[float]) -> float:
    """
    Calcula pendiente lineal por semana.

    Se usa como descriptor de tendencia reciente. La función necesita al menos
    dos observaciones y no utiliza datos posteriores al origen de predicción.
    """
    serie = np.asarray(list(valores), dtype=float)
    if len(serie) < 2 or np.allclose(serie, serie[0]):
        return 0.0
    x = np.arange(len(serie), dtype=float)
    return float(np.polyfit(x, serie, 1)[0])


def _tendencia_ventana(historial: list[float], n: int) -> float:
    if len(historial) < n:
        return np.nan
    return _pendiente_lineal(historial[-n:])


def _semanas_desde_ultima_venta(historial: list[float]) -> float:
    """
    Semanas transcurridas desde la última venta positiva.

    Para una semana objetivo solo inspecciona el historial previo.
    """
    for distancia, valor in enumerate(reversed(historial)):
        if valor > 0:
            return float(distancia)
    return float(len(historial))


def _estadisticas_expandidas(historial: list[float]) -> dict[str, float]:
    """Calcula estadísticas acumuladas usando exclusivamente el pasado."""
    if not historial:
        return {
            "escala_serie": np.nan,
            "porcentaje_ceros": np.nan,
            "semanas_desde_ultima_venta": np.nan,
            "coeficiente_variacion": np.nan,
        }

    valores = np.asarray(historial, dtype=float)
    media = float(np.mean(valores))
    escala = max(media, 1.0)
    std = float(np.std(valores, ddof=0))

    return {
        "escala_serie": escala,
        "porcentaje_ceros": float(np.mean(valores == 0.0)),
        "semanas_desde_ultima_venta": _semanas_desde_ultima_venta(historial),
        "coeficiente_variacion": float(std / escala),
    }


# =============================================================================
# 3. CARGA Y VALIDACIÓN DEL DATASET DE ENTRADA
# =============================================================================

def cargar_datos(ruta: Path = RUTA_ENTRADA) -> pd.DataFrame:
    """
    Carga features_entrenamiento.csv sin modificar el archivo original.

    La validación exige el esquema generado por el módulo de simulación, aunque
    varias columnas operativas se excluirán del forecasting posteriormente.
    """
    if not ruta.exists():
        raise FileNotFoundError(
            f"No se encontró el dataset semanal esperado: {ruta}"
        )

    df = pd.read_csv(ruta)

    faltantes = sorted(set(COLUMNAS_ORIGINALES_ESPERADAS) - set(df.columns))
    if faltantes:
        raise ValueError(
            "Faltan columnas requeridas en features_entrenamiento.csv: "
            + ", ".join(faltantes)
        )

    df = df[COLUMNAS_ORIGINALES_ESPERADAS].copy()
    df["fecha_semana"] = pd.to_datetime(df["fecha_semana"], errors="coerce")

    if df["fecha_semana"].isna().any():
        raise ValueError("Existen fechas inválidas en fecha_semana.")

    # Identificadores como texto para evitar cambios accidentales de tipo.
    for columna in ["org_id", "botica_id", "producto_id"]:
        df[columna] = df[columna].astype(str)

    df = df.sort_values(CLAVE_TEMPORAL).reset_index(drop=True)

    validar_dataset_entrada(df)
    return df


def validar_dataset_entrada(df: pd.DataFrame) -> None:
    """Valida integridad mínima antes de construir cualquier feature."""
    if df.duplicated(CLAVE_TEMPORAL).any():
        raise ValueError(
            "Existen duplicados por org_id-botica_id-producto_id-fecha_semana."
        )

    if df[COLUMNAS_ORIGINALES_ESPERADAS].isna().any().any():
        nulos = df[COLUMNAS_ORIGINALES_ESPERADAS].isna().sum()
        nulos = nulos[nulos > 0].to_dict()
        raise ValueError(f"Existen valores nulos en el dataset de entrada: {nulos}")

    if (df[TARGET] < 0).any():
        raise ValueError("cantidad_vendida contiene valores negativos.")

    if (df["demanda_insatisfecha"] < 0).any():
        raise ValueError("demanda_insatisfecha contiene valores negativos.")

    if not set(df["stockout_flag"].unique()).issubset({0, 1}):
        raise ValueError("stockout_flag debe contener únicamente 0 o 1.")

    # Cada serie debe ser semanal y regular.
    problemas = []
    for claves, grupo in df.groupby(CLAVES_SERIE, sort=False):
        fechas = grupo["fecha_semana"].sort_values()
        esperadas = pd.date_range(fechas.iloc[0], fechas.iloc[-1], freq="W-MON")
        if len(fechas) != len(esperadas) or not np.array_equal(
            fechas.to_numpy(dtype="datetime64[ns]"),
            esperadas.to_numpy(dtype="datetime64[ns]"),
        ):
            problemas.append(claves)

    if problemas:
        raise ValueError(
            f"Se detectaron {len(problemas)} series no regulares; "
            "Feature Engineering requiere frecuencia semanal W-MON."
        )


# =============================================================================
# 4. VARIABLES DE CALENDARIO CONOCIDAS EN INFERENCIA
# =============================================================================

def agregar_variables_calendario(df: pd.DataFrame) -> pd.DataFrame:
    """
    Construye metadatos temporales y codificación cíclica anual.

    `anio`, `mes` y `semana_anio` se conservan para trazabilidad/EDA, pero las
    features oficiales de XGBoost utilizan únicamente `semana_sin` y
    `semana_cos`. Así se representa la proximidad entre el final y el inicio
    del año sin introducir flags estacionales manuales.
    """
    salida = df.copy()
    salida["anio"] = salida["fecha_semana"].dt.year.astype(int)
    salida["mes"] = salida["fecha_semana"].dt.month.astype(int)
    salida["semana_anio"] = (
        salida["fecha_semana"].dt.isocalendar().week.astype(int)
    )

    # 52.1775 aproxima la duración media del año expresada en semanas y evita
    # una discontinuidad artificial entre años ISO con 52/53 semanas.
    periodo_anual_semanas = 365.2425 / 7.0
    angulo = 2.0 * np.pi * (salida["semana_anio"] - 1) / periodo_anual_semanas
    salida["semana_sin"] = np.sin(angulo)
    salida["semana_cos"] = np.cos(angulo)

    return salida


# =============================================================================
# 5. LAGS DE DEMANDA
# =============================================================================

def agregar_lags_demanda(df: pd.DataFrame) -> pd.DataFrame:
    """
    Crea rezagos de la cantidad vendida.

    `shift(lag)` garantiza que la fila de la semana t nunca vea la venta de t
    ni de semanas futuras.
    """
    salida = df.copy()
    grupo = salida.groupby(CLAVES_SERIE, sort=False)[TARGET]

    for lag in LAGS_DEMANDA:
        salida[f"lag_{lag}"] = grupo.shift(lag)

    return salida


# =============================================================================
# 6. VENTANAS MÓVILES Y TENDENCIAS PASADAS
# =============================================================================

def agregar_ventanas_moviles(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula medias y desviaciones móviles usando datos hasta t-1.
    """
    salida = df.copy()

    for ventana in VENTANAS_MEDIA:
        salida[f"rolling_mean_{ventana}"] = (
            salida.groupby(CLAVES_SERIE, sort=False)[TARGET]
            .transform(
                lambda s, w=ventana:
                s.shift(1).rolling(w, min_periods=w).mean()
            )
        )

    for ventana in VENTANAS_STD:
        salida[f"rolling_std_{ventana}"] = (
            salida.groupby(CLAVES_SERIE, sort=False)[TARGET]
            .transform(
                lambda s, w=ventana:
                s.shift(1).rolling(w, min_periods=w).std(ddof=0)
            )
        )

    return salida


def agregar_tendencias(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula la pendiente lineal de las últimas 4 y 13 semanas observadas.

    Una pendiente positiva indica crecimiento reciente y una negativa,
    disminución. La semana objetivo no participa en el cálculo.
    """
    salida = df.copy()

    for ventana in VENTANAS_TENDENCIA:
        salida[f"tendencia_{ventana}"] = (
            salida.groupby(CLAVES_SERIE, sort=False)[TARGET]
            .transform(
                lambda s, w=ventana:
                s.shift(1)
                .rolling(w, min_periods=w)
                .apply(_pendiente_lineal, raw=True)
            )
        )

    return salida


# =============================================================================
# 7. ESTADÍSTICAS EXPANDIDAS DE CADA SERIE
# =============================================================================

def _semanas_desde_ultima_venta_serie(serie: pd.Series) -> pd.Series:
    """Versión histórica de semanas-desde-venta, sin usar la semana actual."""
    resultado = []
    historial: list[float] = []

    for valor in serie.astype(float).tolist():
        resultado.append(_semanas_desde_ultima_venta(historial))
        historial.append(float(valor))

    return pd.Series(resultado, index=serie.index, dtype=float)


def agregar_estadisticas_serie(df: pd.DataFrame) -> pd.DataFrame:
    """
    Añade escala histórica, porcentaje de ceros, semanas desde última venta y CV.

    Todas son estadísticas *expanding* basadas en t-1 o anteriores.
    """
    salida = df.copy()
    grupo = salida.groupby(CLAVES_SERIE, sort=False)[TARGET]

    salida["escala_serie"] = grupo.transform(
        lambda s:
        s.shift(1).expanding(min_periods=1).mean().clip(lower=1.0)
    )

    salida["porcentaje_ceros"] = grupo.transform(
        lambda s:
        s.shift(1).eq(0).astype(float).expanding(min_periods=1).mean()
    )

    media_pasada = grupo.transform(
        lambda s: s.shift(1).expanding(min_periods=2).mean()
    )
    std_pasada = grupo.transform(
        lambda s: s.shift(1).expanding(min_periods=2).std(ddof=0)
    )

    salida["coeficiente_variacion"] = (
        std_pasada / media_pasada.clip(lower=1.0)
    )

    salida["semanas_desde_ultima_venta"] = (
        grupo.apply(_semanas_desde_ultima_venta_serie)
        .reset_index(level=CLAVES_SERIE, drop=True)
        .sort_index()
    )

    return salida


# =============================================================================
# 8. CAMBIOS RECIENTES DERIVADOS DE LAGS
# =============================================================================

def agregar_variaciones_recientes(df: pd.DataFrame) -> pd.DataFrame:
    """
    Resume cambios recientes sin utilizar el target de la semana objetivo.
    """
    salida = df.copy()
    salida["variacion_1_semana"] = salida["lag_1"] - salida["lag_2"]
    salida["variacion_4_semanas"] = salida["lag_1"] - salida["lag_4"]
    return salida


# =============================================================================
# 9. CONSTRUCCIÓN DEL DATASET HISTÓRICO DE FEATURES
# =============================================================================

def construir_features_historicas(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ejecuta todas las transformaciones históricas en orden reproducible.
    """
    salida = agregar_variables_calendario(df)
    salida = agregar_lags_demanda(salida)
    salida = agregar_ventanas_moviles(salida)
    salida = agregar_tendencias(salida)
    salida = agregar_estadisticas_serie(salida)
    salida = agregar_variaciones_recientes(salida)
    return salida


def construir_series_sarima(df: pd.DataFrame) -> pd.DataFrame:
    """
    Conserva las series completas para SARIMA.

    No se eliminan las primeras 26 semanas: SARIMA debe disponer de todo el
    histórico observado. La categoría se conserva para que el pipeline pueda
    realizar selección/adaptación a ese nivel sin alterar el target.
    """
    columnas = [
        "fecha_semana",
        "org_id",
        "botica_id",
        "producto_id",
        "codigo_producto",
        "nombre_comercial",
        "categoria_terapeutica",
        TARGET,
    ]
    return (
        df[columnas]
        .sort_values(CLAVE_TEMPORAL)
        .reset_index(drop=True)
    )


# =============================================================================
# 10. LIMPIEZA DEL WARM-UP TEMPORAL
# =============================================================================

def eliminar_warmup_temporal(
    df_features: pd.DataFrame,
) -> tuple[pd.DataFrame, dict]:
    """
    Elimina solo las filas iniciales necesarias para tener 26 semanas previas.

    No se imputan lags con cero porque eso introduciría valores artificiales.
    Con 123 semanas por serie, se conservan 97 observaciones modelables por
    serie cuando el historial es completo.
    """
    columnas_requeridas = list(COLUMNAS_FEATURES_HISTORICAS)

    filas_antes = len(df_features)
    salida = df_features.dropna(subset=columnas_requeridas).copy()
    salida = salida.sort_values(CLAVE_TEMPORAL).reset_index(drop=True)
    filas_despues = len(salida)

    conteos_antes = (
        df_features.groupby(CLAVES_SERIE, sort=False)
        .size()
        .rename("filas_originales")
    )
    conteos_despues = (
        salida.groupby(CLAVES_SERIE, sort=False)
        .size()
        .rename("filas_modelado")
    )
    conteos = pd.concat([conteos_antes, conteos_despues], axis=1).fillna(0)
    conteos["filas_eliminadas"] = (
        conteos["filas_originales"] - conteos["filas_modelado"]
    )

    detalle = {
        "filas_antes": int(filas_antes),
        "filas_despues": int(filas_despues),
        "filas_eliminadas": int(filas_antes - filas_despues),
        "historia_minima_semanas": int(MAX_HISTORIA_REQUERIDA),
        "filas_eliminadas_por_serie_min": int(conteos["filas_eliminadas"].min()),
        "filas_eliminadas_por_serie_mediana": float(
            conteos["filas_eliminadas"].median()
        ),
        "filas_eliminadas_por_serie_max": int(conteos["filas_eliminadas"].max()),
        "filas_finales_por_serie_min": int(conteos["filas_modelado"].min()),
        "filas_finales_por_serie_mediana": float(
            conteos["filas_modelado"].median()
        ),
        "filas_finales_por_serie_max": int(conteos["filas_modelado"].max()),
    }

    return salida, detalle


# =============================================================================
# 11. DATASET FINAL DE MODELADO
# =============================================================================

def seleccionar_columnas_modelado(df: pd.DataFrame) -> pd.DataFrame:
    """
    Construye la salida segura para modelado.

    Las variables operativas excluidas siguen existiendo en
    features_entrenamiento.csv, pero no se exportan en features_modelado.csv.
    Esto reduce el riesgo de incluirlas accidentalmente en XGBoost.
    """
    columnas = [
        "fecha_semana",
        "org_id",
        "botica_id",
        "producto_id",
        "codigo_producto",
        "nombre_comercial",
        "categoria_terapeutica",
        TARGET,
        "anio",
        "mes",
        "semana_anio",
        *COLUMNAS_FEATURES_HISTORICAS,
    ]

    return df[columnas].copy()


# =============================================================================
# 12. FEATURES PARA UNA PREDICCIÓN MULTIHORIZONTE
# =============================================================================

def construir_fila_horizonte(
    org_id: str,
    botica_id: str,
    producto_id: str,
    categoria_terapeutica: str,
    fecha_objetivo,
    historial_demanda: Iterable[float],
    horizonte: int,
    pred_sarima: float | None = None,
) -> dict:
    """
    Construye exactamente las features disponibles en una inferencia futura.

    Parameters
    ----------
    fecha_objetivo:
        Semana que se desea pronosticar.
    historial_demanda:
        Ventas observadas SOLO hasta el origen de predicción. Para h > 1 no
        debe incluir ventas reales de semanas intermedias futuras.
    horizonte:
        Número de semanas desde el origen (1..H).
    pred_sarima:
        Forecast SARIMA para la misma fecha objetivo. Solo es obligatorio para
        el modelo híbrido.

    Returns
    -------
    dict
        Fila compatible con FEATURES_XGB_INDEPENDIENTE y, si se proporciona
        pred_sarima, también con FEATURES_HIBRIDO.
    """
    if horizonte < 1:
        raise ValueError("horizonte debe ser mayor o igual que 1.")

    fecha = pd.Timestamp(fecha_objetivo)
    historial = [
        float(v)
        for v in historial_demanda
        if pd.notna(v)
    ]

    if len(historial) < MAX_HISTORIA_REQUERIDA:
        raise ValueError(
            f"Se requieren al menos {MAX_HISTORIA_REQUERIDA} semanas "
            "históricas para construir las features oficiales."
        )

    semana_anio = int(fecha.isocalendar().week)
    periodo_anual_semanas = 365.2425 / 7.0
    angulo = 2.0 * np.pi * (semana_anio - 1) / periodo_anual_semanas

    fila = {
        "producto_id": str(producto_id),
        "botica_id": str(botica_id),
        "categoria_terapeutica": str(categoria_terapeutica),
        "horizonte": int(horizonte),
        "semana_sin": float(np.sin(angulo)),
        "semana_cos": float(np.cos(angulo)),
        "lag_1": _valor_lag(historial, 1),
        "lag_2": _valor_lag(historial, 2),
        "lag_4": _valor_lag(historial, 4),
        "lag_8": _valor_lag(historial, 8),
        "lag_13": _valor_lag(historial, 13),
        "lag_26": _valor_lag(historial, 26),
        "rolling_mean_4": _media_ventana(historial, 4),
        "rolling_mean_8": _media_ventana(historial, 8),
        "rolling_mean_13": _media_ventana(historial, 13),
        "rolling_mean_26": _media_ventana(historial, 26),
        "rolling_std_4": _std_ventana(historial, 4),
        "rolling_std_13": _std_ventana(historial, 13),
        "rolling_std_26": _std_ventana(historial, 26),
        "tendencia_4": _tendencia_ventana(historial, 4),
        "tendencia_13": _tendencia_ventana(historial, 13),
        "variacion_1_semana": float(
            _valor_lag(historial, 1) - _valor_lag(historial, 2)
        ),
        "variacion_4_semanas": float(
            _valor_lag(historial, 1) - _valor_lag(historial, 4)
        ),
        **_estadisticas_expandidas(historial),
    }

    # org_id no es feature oficial, pero se conserva para trazabilidad del
    # registro de inferencia.
    fila["org_id"] = str(org_id)

    if pred_sarima is not None:
        pred = max(_safe_float(pred_sarima), 0.0)
        fila["pred_sarima"] = float(pred)
        fila["log_pred_sarima"] = float(np.log1p(pred))

    return fila


# =============================================================================
# 13. CATÁLOGO DE FEATURES Y DECISIONES METODOLÓGICAS
# =============================================================================

def construir_catalogo_features() -> pd.DataFrame:
    """
    Documenta fuente, disponibilidad en inferencia y uso oficial de features.
    """
    registros = []

    def agregar(
        feature,
        grupo,
        fuente,
        xgb,
        hibrido,
        comentario,
    ):
        registros.append(
            {
                "feature": feature,
                "grupo": grupo,
                "fuente": fuente,
                "conocida_en_inferencia": True,
                "xgb_independiente": bool(xgb),
                "hibrido": bool(hibrido),
                "comentario": comentario,
            }
        )

    for feature in COLUMNAS_CATEGORICAS_MODELO:
        agregar(
            feature,
            "categorica",
            "maestro/identidad de serie",
            True,
            True,
            "Disponible antes del forecast.",
        )

    agregar(
        "horizonte",
        "horizonte",
        "pipeline multihorizonte",
        True,
        True,
        "Horizonte futuro 1..H conocido al construir cada forecast.",
    )

    for feature in ["semana_sin", "semana_cos"]:
        agregar(
            feature,
            "calendario",
            "fecha objetivo",
            True,
            True,
            "Codificación cíclica anual conocida en inferencia.",
        )

    for feature in [f"lag_{x}" for x in LAGS_DEMANDA]:
        agregar(
            feature,
            "historia_demanda",
            "cantidad_vendida pasada",
            True,
            True,
            "Construido únicamente con observaciones anteriores al origen.",
        )

    for feature in [f"rolling_mean_{x}" for x in VENTANAS_MEDIA]:
        agregar(
            feature,
            "historia_demanda",
            "cantidad_vendida pasada",
            True,
            True,
            "Media móvil calculada hasta t-1.",
        )

    for feature in [f"rolling_std_{x}" for x in VENTANAS_STD]:
        agregar(
            feature,
            "historia_demanda",
            "cantidad_vendida pasada",
            True,
            True,
            "Volatilidad móvil calculada hasta t-1.",
        )

    for feature in [f"tendencia_{x}" for x in VENTANAS_TENDENCIA]:
        agregar(
            feature,
            "historia_demanda",
            "cantidad_vendida pasada",
            True,
            True,
            "Pendiente lineal reciente calculada hasta t-1.",
        )

    for feature in ["variacion_1_semana", "variacion_4_semanas"]:
        agregar(
            feature,
            "historia_demanda",
            "lags de cantidad_vendida",
            True,
            True,
            "Diferencia entre observaciones ya conocidas.",
        )

    for feature in [
        "escala_serie",
        "porcentaje_ceros",
        "semanas_desde_ultima_venta",
        "coeficiente_variacion",
    ]:
        agregar(
            feature,
            "estadistica_expandida",
            "histórico de cantidad_vendida",
            True,
            True,
            "Estadística acumulada calculada solo con el pasado.",
        )

    for feature in COLUMNAS_SARIMA_HIBRIDO:
        agregar(
            feature,
            "sarima",
            "forecast SARIMA del mismo origen",
            False,
            True,
            "Disponible únicamente para la corrección híbrida.",
        )

    return pd.DataFrame(registros)


def decisiones_metodologicas() -> dict:
    """Registra explícitamente las decisiones derivadas del EDA."""
    return {
        "target_oficial": TARGET,
        "unidad_pronostico": "producto-botica-semana",
        "historia_minima_features_semanas": MAX_HISTORIA_REQUERIDA,
        "lag_52_incluido": False,
        "motivo_lag_52": (
            "El EDA encontró señal en lag 52 para parte de las series, pero "
            "123 semanas contienen poco más de dos ciclos anuales. Se conserva "
            "la representación cíclica anual y se evita convertir lag 52 en "
            "predictor oficial sin mayor historia."
        ),
        "flags_invierno_verano_incluidos": False,
        "motivo_flags_estacionales": (
            "Se evita codificar manualmente estaciones definidas por el "
            "generador; la posición anual se representa mediante seno/coseno."
        ),
        "variables_inventario_en_forecasting": False,
        "variables_inventario_excluidas": [
            "stock_inicio_semana",
            "stock_minimo",
            "stock_maximo",
            "lead_time_dias",
        ],
        "motivo_exclusion_inventario": (
            "El EDA mostró fuerte asociación entre políticas de inventario y "
            "escala de ventas en el escenario sintético. Se separan del "
            "forecasting para reducir circularidad y se reservan para "
            "recomendaciones/alertas."
        ),
        "stockout_y_demanda_insatisfecha_como_features": False,
        "motivo_exclusion_censura": (
            "Se mantienen como diagnóstico de censura por inventario. No se "
            "asume que estén disponibles de forma equivalente en inferencia "
            "real ni se usan para enseñar el target al modelo."
        ),
        "categoria_terapeutica_como_feature": True,
        "categoria_terapeutica_uso": (
            "Metadato del producto, feature categórica y nivel de adaptación/"
            "evaluación. No se interpreta como evidencia empírica de efectos "
            "terapéuticos reales."
        ),
    }


# =============================================================================
# 14. VALIDACIONES CONTRA LEAKAGE Y CIRCULARIDAD DIRECTA
# =============================================================================

def validar_features_modelado(
    df_original: pd.DataFrame,
    df_features_completo: pd.DataFrame,
    df_modelado: pd.DataFrame,
) -> dict:
    """Ejecuta controles estructurales y temporales antes de exportar."""
    errores = []

    if df_modelado.duplicated(CLAVE_TEMPORAL).any():
        errores.append("Existen duplicados en la clave temporal del modelado.")

    if (df_modelado[TARGET] < 0).any():
        errores.append("cantidad_vendida contiene valores negativos.")

    columnas_feature_presentes = set(
        COLUMNAS_CATEGORICAS_MODELO + COLUMNAS_FEATURES_HISTORICAS
    )

    excluidas_presentes = sorted(
        columnas_feature_presentes.intersection(COLUMNAS_EXCLUIDAS_PRONOSTICO)
    )
    if excluidas_presentes:
        errores.append(
            "Features operativas excluidas presentes: "
            + ", ".join(excluidas_presentes)
        )

    internas_presentes = sorted(
        set(df_modelado.columns).intersection(
            COLUMNAS_INTERNAS_SIMULADOR_PROHIBIDAS
        )
    )
    if internas_presentes:
        errores.append(
            "Variables internas del simulador presentes en features_modelado: "
            + ", ".join(internas_presentes)
        )

    # Validación exacta de lags sobre el dataset completo antes del warm-up.
    validacion_lags = {}
    for lag in LAGS_DEMANDA:
        esperado = (
            df_original.groupby(CLAVES_SERIE, sort=False)[TARGET]
            .shift(lag)
        )
        observado = df_features_completo[f"lag_{lag}"]
        mascara = esperado.notna() & observado.notna()
        coincide = bool(
            np.allclose(
                esperado.loc[mascara].to_numpy(dtype=float),
                observado.loc[mascara].to_numpy(dtype=float),
                equal_nan=True,
            )
        )
        validacion_lags[f"lag_{lag}"] = coincide
        if not coincide:
            errores.append(f"lag_{lag} no coincide con shift({lag}).")

    # El target actual no debe aparecer dentro de las columnas oficiales.
    target_en_features = TARGET in (
        COLUMNAS_CATEGORICAS_MODELO
        + COLUMNAS_NUMERICAS_BASE
        + COLUMNAS_SARIMA_HIBRIDO
    )
    if target_en_features:
        errores.append("El target aparece accidentalmente en la lista de features.")

    nulos_features = (
        df_modelado[COLUMNAS_FEATURES_HISTORICAS]
        .isna()
        .sum()
        .astype(int)
        .to_dict()
    )
    if any(v > 0 for v in nulos_features.values()):
        errores.append("Existen nulos en las features históricas finales.")

    valores = df_modelado[COLUMNAS_FEATURES_HISTORICAS].select_dtypes(
        include=[np.number]
    )
    infinitos = int(np.isinf(valores.to_numpy(dtype=float)).sum())
    if infinitos > 0:
        errores.append("Existen valores infinitos en las features finales.")

    return {
        "aprobada": len(errores) == 0,
        "errores": errores,
        "validacion_lags": validacion_lags,
        "features_operativas_excluidas_presentes": excluidas_presentes,
        "variables_internas_simulador_presentes": internas_presentes,
        "target_en_lista_features": target_en_features,
        "nulos_features_finales": nulos_features,
        "infinitos_features_finales": infinitos,
    }


def validar_consistencia_constructor_inferencia(
    df_original: pd.DataFrame,
    df_modelado: pd.DataFrame,
    max_series: int = 10,
) -> dict:
    """
    Compara el constructor de inferencia con filas históricas.

    Esto reduce el riesgo de *training-serving skew*: las mismas definiciones
    de lag, rolling, tendencia y estadísticas deben producir valores
    equivalentes en entrenamiento e inferencia.
    """
    columnas_comparar = list(COLUMNAS_FEATURES_HISTORICAS)
    diferencias_maximas = {col: 0.0 for col in columnas_comparar}
    comparaciones = 0
    errores = []

    series = (
        df_original[CLAVES_SERIE]
        .drop_duplicates()
        .head(max_series)
        .to_dict("records")
    )

    for claves in series:
        mascara_original = np.ones(len(df_original), dtype=bool)
        mascara_modelado = np.ones(len(df_modelado), dtype=bool)

        for clave in CLAVES_SERIE:
            mascara_original &= (df_original[clave] == str(claves[clave])).to_numpy()
            mascara_modelado &= (df_modelado[clave] == str(claves[clave])).to_numpy()

        serie_original = (
            df_original.loc[mascara_original]
            .sort_values("fecha_semana")
            .reset_index(drop=True)
        )
        serie_modelado = (
            df_modelado.loc[mascara_modelado]
            .sort_values("fecha_semana")
            .reset_index(drop=True)
        )

        if serie_modelado.empty:
            continue

        # Se comprueba la primera y última fila modelable de la serie.
        filas_prueba = [
            serie_modelado.iloc[0],
            serie_modelado.iloc[-1],
        ]

        for fila_hist in filas_prueba:
            fecha_objetivo = pd.Timestamp(fila_hist["fecha_semana"])
            historial = serie_original.loc[
                serie_original["fecha_semana"] < fecha_objetivo,
                TARGET,
            ].tolist()

            fila_inf = construir_fila_horizonte(
                org_id=fila_hist["org_id"],
                botica_id=fila_hist["botica_id"],
                producto_id=fila_hist["producto_id"],
                categoria_terapeutica=fila_hist["categoria_terapeutica"],
                fecha_objetivo=fecha_objetivo,
                historial_demanda=historial,
                horizonte=1,
                pred_sarima=None,
            )

            for col in columnas_comparar:
                a = float(fila_hist[col])
                b = float(fila_inf[col])
                diferencia = abs(a - b)
                diferencias_maximas[col] = max(
                    diferencias_maximas[col],
                    diferencia,
                )

                if not np.isclose(a, b, atol=1e-9, rtol=1e-9):
                    errores.append(
                        {
                            "serie": {
                                k: fila_hist[k]
                                for k in CLAVES_SERIE
                            },
                            "fecha": fecha_objetivo,
                            "feature": col,
                            "historico": a,
                            "inferencia": b,
                            "diferencia": diferencia,
                        }
                    )

            comparaciones += 1

    return {
        "aprobada": len(errores) == 0,
        "filas_comparadas": comparaciones,
        "diferencias_maximas": diferencias_maximas,
        "errores_muestra": errores[:20],
    }


# =============================================================================
# 15. EXPORTACIÓN Y REPORTE
# =============================================================================

def exportar_resultados(
    df_modelado: pd.DataFrame,
    series_sarima: pd.DataFrame,
    catalogo: pd.DataFrame,
    reporte: dict,
) -> None:
    """Exporta artefactos sin sobrescribir el dataset de entrada."""
    DIR_DATA_ML.mkdir(parents=True, exist_ok=True)
    DIR_REPORTES.mkdir(parents=True, exist_ok=True)

    modelado_export = df_modelado.copy()
    sarima_export = series_sarima.copy()

    modelado_export["fecha_semana"] = (
        modelado_export["fecha_semana"].dt.strftime("%Y-%m-%d")
    )
    sarima_export["fecha_semana"] = (
        sarima_export["fecha_semana"].dt.strftime("%Y-%m-%d")
    )

    modelado_export.to_csv(
        RUTA_FEATURES_MODELADO,
        index=False,
        encoding="utf-8",
    )
    sarima_export.to_csv(
        RUTA_SERIES_SARIMA,
        index=False,
        encoding="utf-8",
    )
    catalogo.to_csv(
        RUTA_CATALOGO_FEATURES,
        index=False,
        encoding="utf-8",
    )

    # Añadir hashes de salida después de escribir los CSV.
    reporte["trazabilidad"]["features_modelado_sha256"] = sha256_archivo(
        RUTA_FEATURES_MODELADO
    )
    reporte["trazabilidad"]["series_sarima_sha256"] = sha256_archivo(
        RUTA_SERIES_SARIMA
    )
    reporte["trazabilidad"]["catalogo_features_sha256"] = sha256_archivo(
        RUTA_CATALOGO_FEATURES
    )

    with RUTA_REPORTE.open("w", encoding="utf-8") as archivo:
        json.dump(
            convertir_serializable(reporte),
            archivo,
            ensure_ascii=False,
            indent=2,
        )


# =============================================================================
# 16. EJECUCIÓN COMPLETA
# =============================================================================

def ejecutar_feature_engineering() -> dict:
    """
    Ejecuta Feature Engineering completo y devuelve los objetos principales.
    """
    log.info("Raíz del proyecto: %s", RAIZ_PROYECTO)

    df_original = cargar_datos()
    series_sarima = construir_series_sarima(df_original)

    df_features_completo = construir_features_historicas(df_original)
    df_limpio, warmup = eliminar_warmup_temporal(df_features_completo)
    df_modelado = seleccionar_columnas_modelado(df_limpio)

    validacion = validar_features_modelado(
        df_original=df_original,
        df_features_completo=df_features_completo,
        df_modelado=df_modelado,
    )

    consistencia = validar_consistencia_constructor_inferencia(
        df_original=df_original,
        df_modelado=df_modelado,
        max_series=10,
    )

    if not validacion["aprobada"]:
        raise ValueError(
            "Feature Engineering no superó la validación: "
            + " | ".join(validacion["errores"])
        )

    if not consistencia["aprobada"]:
        raise ValueError(
            "Existe diferencia entre features históricas y features de "
            "inferencia. Revise el reporte antes de continuar."
        )

    catalogo = construir_catalogo_features()

    resumen_series = (
        df_modelado.groupby(CLAVES_SERIE, sort=False)
        .agg(
            filas=("fecha_semana", "size"),
            fecha_inicio=("fecha_semana", "min"),
            fecha_fin=("fecha_semana", "max"),
        )
        .reset_index()
    )

    reporte = {
        "trazabilidad": {
            "dataset_entrada": str(RUTA_ENTRADA),
            "dataset_entrada_sha256": sha256_archivo(RUTA_ENTRADA),
            "features_modelado": str(RUTA_FEATURES_MODELADO),
            "series_sarima": str(RUTA_SERIES_SARIMA),
            "catalogo_features": str(RUTA_CATALOGO_FEATURES),
            "reporte": str(RUTA_REPORTE),
        },
        "entrada": {
            "filas": int(len(df_original)),
            "columnas": int(len(df_original.columns)),
            "productos": int(df_original["producto_id"].nunique()),
            "boticas": int(df_original["botica_id"].nunique()),
            "categorias": int(
                df_original["categoria_terapeutica"].nunique()
            ),
            "series": int(
                df_original[CLAVES_SERIE].drop_duplicates().shape[0]
            ),
            "semanas": int(df_original["fecha_semana"].nunique()),
            "fecha_inicio": df_original["fecha_semana"].min(),
            "fecha_fin": df_original["fecha_semana"].max(),
        },
        "salida_modelado": {
            "filas": int(len(df_modelado)),
            "columnas": int(len(df_modelado.columns)),
            "series": int(
                df_modelado[CLAVES_SERIE].drop_duplicates().shape[0]
            ),
            "fecha_inicio": df_modelado["fecha_semana"].min(),
            "fecha_fin": df_modelado["fecha_semana"].max(),
            "filas_por_serie_min": int(resumen_series["filas"].min()),
            "filas_por_serie_mediana": float(
                resumen_series["filas"].median()
            ),
            "filas_por_serie_max": int(resumen_series["filas"].max()),
        },
        "salida_sarima": {
            "filas": int(len(series_sarima)),
            "series": int(
                series_sarima[CLAVES_SERIE].drop_duplicates().shape[0]
            ),
            "semanas": int(series_sarima["fecha_semana"].nunique()),
        },
        "warmup_temporal": warmup,
        "features": {
            "categoricas": COLUMNAS_CATEGORICAS_MODELO,
            "numericas_base_multihorizonte": COLUMNAS_NUMERICAS_BASE,
            "sarima_hibrido": COLUMNAS_SARIMA_HIBRIDO,
            "xgb_independiente": FEATURES_XGB_INDEPENDIENTE,
            "hibrido": FEATURES_HIBRIDO,
            "historicas_exportadas": COLUMNAS_FEATURES_HISTORICAS,
        },
        "decisiones_metodologicas": decisiones_metodologicas(),
        "validacion": validacion,
        "consistencia_training_serving": consistencia,
    }

    exportar_resultados(
        df_modelado=df_modelado,
        series_sarima=series_sarima,
        catalogo=catalogo,
        reporte=reporte,
    )

    log.info("%-30s %8d filas", RUTA_FEATURES_MODELADO.name, len(df_modelado))
    log.info("%-30s %8d filas", RUTA_SERIES_SARIMA.name, len(series_sarima))
    log.info("%-30s %8d features", RUTA_CATALOGO_FEATURES.name, len(catalogo))
    log.info("%-30s generado", RUTA_REPORTE.name)

    print("\nResumen Feature Engineering")
    print("-" * 62)
    print(f"Dataset original:              {len(df_original):,} filas")
    print(f"Series SARIMA:                 {len(series_sarima):,} filas")
    print(f"Dataset final XGBoost/híbrido: {len(df_modelado):,} filas")
    print(f"Filas eliminadas por warm-up:  {warmup['filas_eliminadas']:,}")
    print(
        "Historia mínima requerida:    "
        f"{MAX_HISTORIA_REQUERIDA} semanas"
    )
    print(
        "Rango modelable:              "
        f"{df_modelado['fecha_semana'].min().date()} → "
        f"{df_modelado['fecha_semana'].max().date()}"
    )
    print(
        "Validación leakage/estructura:",
        "APROBADA" if validacion["aprobada"] else "REVISAR",
    )
    print(
        "Consistencia train/inferencia:",
        "APROBADA" if consistencia["aprobada"] else "REVISAR",
    )
    print(f"\nFeatures modelado: {RUTA_FEATURES_MODELADO}")
    print(f"Series SARIMA:     {RUTA_SERIES_SARIMA}")
    print(f"Catálogo:          {RUTA_CATALOGO_FEATURES}")
    print(f"Reporte:           {RUTA_REPORTE}")

    return {
        "df_original": df_original,
        "df_features_completo": df_features_completo,
        "df_modelado": df_modelado,
        "series_sarima": series_sarima,
        "catalogo_features": catalogo,
        "reporte": reporte,
    }


def main():
    ejecutar_feature_engineering()


if __name__ == "__main__":
    main()
