# -*- coding: utf-8 -*-
"""Inferencia productiva del modelo SARIMA-XGBoost validado en Colab.

Este módulo NO reentrena el modelo. Carga el artefacto oficial y expone la
función ``predecir_demanda`` utilizada por FastAPI.

Reglas de inferencia
--------------------
- Las 27 features del XGBoost independiente se calculan desde el mismo origen
  temporal para todos los horizontes 1..12.
- Para h > 1 no se añaden predicciones futuras al historial observado.
- El híbrido se usa solo cuando la serie tiene madurez suficiente y existe un
  orden SARIMA seleccionado para esa serie en el artefacto.
- En caso contrario, la salida productiva es XGBoost independiente.
"""

from __future__ import annotations

import argparse
import json
import os
import pickle
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from pmdarima.arima import ARIMA

from src.feature_engineering import (
    CLAVES_SERIE,
    FEATURES_HIBRIDO,
    FEATURES_XGB_INDEPENDIENTE,
    construir_fila_horizonte,
)


RAIZ_MODELO = Path(__file__).resolve().parents[1]
RUTA_MODELO_DEFAULT = RAIZ_MODELO / "modelos" / "modelo_hibrido" / "artefacto_modelo.pkl"
FRECUENCIA_DEFAULT = "W-MON"
HORIZONTE_MAXIMO = 12
MIN_SEMANAS_XGBOOST = 26
MIN_SEMANAS_HIBRIDO = 84

CLAVES_OBLIGATORIAS_MODELO = [
    "version_modelo",
    "fecha_entrenamiento_utc",
    "tipo_modelo",
    "target",
    "frecuencia",
    "horizonte",
    "features_hibrido",
    "features_xgb_independiente",
    "preprocesador_hibrido",
    "preprocesador_xgb_independiente",
    "modelo_xgb_aditivo",
    "modelo_xgb_log",
    "modelo_xgb_independiente",
    "ordenes_sarima",
    "periodos_sarima_por_categoria",
    "configuracion_categoria",
    "metricas",
    "hash_datos_modelado",
]

COLUMNAS_PREDICCION = [
    "org_id",
    "botica_id",
    "producto_id",
    "categoria_terapeutica",
    "fecha_generacion",
    "fecha_objetivo",
    "horizonte",
    "prediccion_sarima",
    "prediccion_xgboost",
    "prediccion_hibrida",
    "cantidad_predicha",
    "metodo_aplicado",
    "alpha",
    "version_modelo",
]


def validar_horizonte(horizonte: int) -> int:
    horizonte = int(horizonte)
    if not 1 <= horizonte <= HORIZONTE_MAXIMO:
        raise ValueError("horizonte debe estar entre 1 y 12")
    return horizonte


def ruta_modelo_desde_entorno() -> Path:
    ruta = Path(os.getenv("MODEL_PATH", str(RUTA_MODELO_DEFAULT)))
    if not ruta.is_absolute():
        ruta = RAIZ_MODELO / ruta
    return ruta


def cargar_modelo(ruta_modelo: str | Path | None = None) -> dict:
    ruta = Path(ruta_modelo) if ruta_modelo else ruta_modelo_desde_entorno()
    if not ruta.exists():
        raise FileNotFoundError(f"No existe el artefacto del modelo: {ruta}")

    with ruta.open("rb") as archivo:
        artefacto = pickle.load(archivo)

    if not isinstance(artefacto, dict):
        raise TypeError(
            "El artefacto debe contener un diccionario, recibido "
            f"{type(artefacto).__name__}."
        )

    faltantes = [
        clave
        for clave in CLAVES_OBLIGATORIAS_MODELO
        if clave not in artefacto
    ]
    if faltantes:
        raise RuntimeError(
            "Artefacto incompleto. Faltan claves: "
            f"{faltantes}"
        )

    return artefacto


def validar_modelo_pkl(ruta_modelo: str | Path | None = None) -> dict:
    artefacto = cargar_modelo(ruta_modelo)
    return {
        "carga_exitosa": True,
        "version_modelo": artefacto.get("version_modelo"),
        "tipo_modelo": artefacto.get("tipo_modelo"),
        "horizonte": artefacto.get("horizonte"),
        "features_xgb_independiente": len(
            artefacto.get("features_xgb_independiente", [])
        ),
        "features_hibrido": len(
            artefacto.get("features_hibrido", [])
        ),
        "ordenes_sarima": len(
            artefacto.get("ordenes_sarima", {})
        ),
        "categorias_configuradas": len(
            artefacto.get("configuracion_categoria", {})
        ),
        "modelos_cargables": all(
            hasattr(artefacto.get(clave), "predict")
            for clave in [
                "modelo_xgb_aditivo",
                "modelo_xgb_log",
                "modelo_xgb_independiente",
            ]
        ),
        "preprocesadores_cargables": all(
            hasattr(artefacto.get(clave), "transform")
            for clave in [
                "preprocesador_hibrido",
                "preprocesador_xgb_independiente",
            ]
        ),
    }


def _normalizar_serie(
    serie: pd.DataFrame,
    org_id: str,
    botica_id: str,
    producto_id: str,
) -> pd.DataFrame:
    requeridas = {"fecha_semana", "cantidad_vendida"}
    faltantes = requeridas - set(serie.columns)
    if faltantes:
        raise ValueError(
            f"La serie no contiene columnas obligatorias: {sorted(faltantes)}"
        )

    salida = serie.copy()
    salida["fecha_semana"] = pd.to_datetime(
        salida["fecha_semana"], errors="coerce"
    )
    salida["cantidad_vendida"] = pd.to_numeric(
        salida["cantidad_vendida"], errors="coerce"
    ).fillna(0.0)
    salida = salida.dropna(subset=["fecha_semana"])
    salida["org_id"] = str(org_id)
    salida["botica_id"] = str(botica_id)
    salida["producto_id"] = str(producto_id)
    salida = salida.sort_values("fecha_semana")

    # Regularizar semanalmente para que una semana faltante se interprete como
    # ausencia de venta observada, exactamente como la vista semanal productiva.
    inicio = salida["fecha_semana"].min()
    fin = salida["fecha_semana"].max()
    indice = pd.date_range(inicio, fin, freq=FRECUENCIA_DEFAULT)
    base = (
        salida.set_index("fecha_semana")["cantidad_vendida"]
        .reindex(indice, fill_value=0.0)
        .rename("cantidad_vendida")
        .reset_index()
        .rename(columns={"index": "fecha_semana"})
    )
    base["org_id"] = str(org_id)
    base["botica_id"] = str(botica_id)
    base["producto_id"] = str(producto_id)
    return base


def _orden_sarima(
    artefacto: dict,
    org_id: str,
    botica_id: str,
    producto_id: str,
) -> dict | None:
    clave = "|".join(
        [str(org_id), str(botica_id), str(producto_id)]
    )
    return artefacto.get("ordenes_sarima", {}).get(clave)


def pronosticar_sarima_fijo(
    serie_vals,
    pasos: int,
    order,
    seasonal_order,
    with_intercept: bool = True,
):
    valores = (
        pd.Series(serie_vals)
        .astype(float)
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0.0)
    )

    if valores.empty or valores.sum() <= 0 or valores.nunique() <= 1:
        return None

    try:
        modelo = ARIMA(
            order=tuple(order),
            seasonal_order=tuple(seasonal_order),
            method="lbfgs",
            maxiter=50,
            suppress_warnings=True,
            with_intercept=bool(with_intercept),
        )
        modelo.fit(np.log1p(valores.to_numpy(dtype=float)))
        forecast_log = modelo.predict(n_periods=int(pasos))
        return np.clip(np.expm1(forecast_log), 0.0, None)
    except Exception:
        return None


def _prediccion_xgboost_independiente(
    artefacto: dict,
    filas_xgb: pd.DataFrame,
) -> np.ndarray:
    features = artefacto.get(
        "features_xgb_independiente",
        FEATURES_XGB_INDEPENDIENTE,
    )
    X = artefacto["preprocesador_xgb_independiente"].transform(
        filas_xgb[features]
    )
    pred_log = artefacto["modelo_xgb_independiente"].predict(X)
    return np.clip(np.expm1(pred_log), 0.0, None)


def _prediccion_hibrida(
    artefacto: dict,
    filas_hibrido: pd.DataFrame,
    pred_sarima: np.ndarray,
    categoria: str,
) -> tuple[np.ndarray, str, float]:
    features = artefacto.get(
        "features_hibrido",
        FEATURES_HIBRIDO,
    )
    X = artefacto["preprocesador_hibrido"].transform(
        filas_hibrido[features]
    )

    pred_aditivo = artefacto["modelo_xgb_aditivo"].predict(X)
    pred_log = artefacto["modelo_xgb_log"].predict(X)

    config = artefacto.get("configuracion_categoria", {}).get(
        str(categoria),
        {"metodo": "sarima", "alpha": 0.0},
    )
    metodo = str(config.get("metodo", "sarima"))
    alpha = float(config.get("alpha", 0.0))

    salida = []
    for i, base in enumerate(pred_sarima):
        base = max(0.0, float(base))
        if metodo == "aditivo" and alpha > 0:
            escala = float(filas_hibrido.iloc[i]["escala_serie"])
            pred = base + alpha * float(pred_aditivo[i]) * escala
        elif metodo == "log" and alpha > 0:
            pred = np.expm1(
                np.log1p(base) + alpha * float(pred_log[i])
            )
        else:
            pred = base
        salida.append(max(0.0, float(pred)))

    return np.asarray(salida, dtype=float), metodo, alpha


def predecir_demanda(
    org_id: str,
    botica_id: str,
    producto_id: str,
    horizonte: int = 12,
    serie: pd.DataFrame | None = None,
    categoria: str | None = None,
    artefacto: dict | None = None,
    min_semanas_hibrido: int = MIN_SEMANAS_HIBRIDO,
) -> pd.DataFrame:
    """Genera predicciones directas 1..H desde un único origen temporal.

    La función espera al menos 26 semanas porque las features oficiales incluyen
    lag_26 y rolling_26. Series más cortas deben resolverse en la capa de
    ``PredictionService`` mediante fallback.
    """

    horizonte = validar_horizonte(horizonte)
    artefacto = artefacto or cargar_modelo()

    if serie is None:
        raise ValueError(
            "predecir_demanda requiere una serie explícita en producción."
        )

    serie_norm = _normalizar_serie(
        serie,
        org_id,
        botica_id,
        producto_id,
    )
    historial = serie_norm["cantidad_vendida"].astype(float).tolist()

    if len(historial) < MIN_SEMANAS_XGBOOST:
        raise ValueError(
            "Se requieren al menos 26 semanas para las features oficiales."
        )

    if categoria is None:
        if "categoria_terapeutica" in serie.columns:
            categorias = (
                serie["categoria_terapeutica"]
                .dropna()
                .astype(str)
            )
            categoria = categorias.iloc[-1] if not categorias.empty else None
    categoria = str(categoria or "SIN_CATEGORIA")

    fecha_origen = pd.Timestamp(serie_norm["fecha_semana"].max())
    frecuencia = artefacto.get("frecuencia", FRECUENCIA_DEFAULT)
    fechas_futuras = pd.date_range(
        fecha_origen + pd.Timedelta(weeks=1),
        periods=horizonte,
        freq=frecuencia,
    )

    # XGBoost independiente: todas las filas usan el MISMO historial observado.
    filas_xgb = pd.DataFrame(
        [
            construir_fila_horizonte(
                org_id=str(org_id),
                botica_id=str(botica_id),
                producto_id=str(producto_id),
                categoria_terapeutica=categoria,
                fecha_objetivo=fecha,
                historial_demanda=historial,
                horizonte=h,
            )
            for h, fecha in enumerate(fechas_futuras, start=1)
        ]
    )
    pred_xgb = _prediccion_xgboost_independiente(
        artefacto,
        filas_xgb,
    )

    orden = _orden_sarima(
        artefacto,
        str(org_id),
        str(botica_id),
        str(producto_id),
    )
    usar_hibrido = (
        len(historial) >= int(min_semanas_hibrido)
        and orden is not None
    )

    pred_sarima = np.full(horizonte, np.nan, dtype=float)
    pred_final = pred_xgb.copy()
    metodo = "xgboost_independiente"
    alpha = 0.0

    if usar_hibrido:
        pred_s = pronosticar_sarima_fijo(
            historial,
            horizonte,
            order=orden["order"],
            seasonal_order=orden["seasonal_order"],
            with_intercept=orden.get("with_intercept", True),
        )

        if pred_s is not None:
            pred_sarima = np.asarray(pred_s, dtype=float)
            filas_hibrido = pd.DataFrame(
                [
                    construir_fila_horizonte(
                        org_id=str(org_id),
                        botica_id=str(botica_id),
                        producto_id=str(producto_id),
                        categoria_terapeutica=categoria,
                        fecha_objetivo=fecha,
                        historial_demanda=historial,
                        horizonte=h,
                        pred_sarima=float(pred_sarima[h - 1]),
                    )
                    for h, fecha in enumerate(
                        fechas_futuras,
                        start=1,
                    )
                ]
            )
            pred_final, metodo, alpha = _prediccion_hibrida(
                artefacto,
                filas_hibrido,
                pred_sarima,
                categoria,
            )
        else:
            usar_hibrido = False

    fecha_generacion = datetime.now(timezone.utc).isoformat()
    version = artefacto.get("version_modelo", "desconocido")

    filas = []
    for i, fecha in enumerate(fechas_futuras):
        filas.append(
            {
                "org_id": str(org_id),
                "botica_id": str(botica_id),
                "producto_id": str(producto_id),
                "categoria_terapeutica": categoria,
                "fecha_generacion": fecha_generacion,
                "fecha_objetivo": pd.Timestamp(fecha).date().isoformat(),
                "horizonte": i + 1,
                "prediccion_sarima": (
                    None
                    if not np.isfinite(pred_sarima[i])
                    else float(max(0.0, pred_sarima[i]))
                ),
                "prediccion_xgboost": float(max(0.0, pred_xgb[i])),
                "prediccion_hibrida": float(max(0.0, pred_final[i])),
                "cantidad_predicha": float(max(0.0, pred_final[i])),
                "metodo_aplicado": metodo,
                "alpha": float(alpha),
                "version_modelo": version,
            }
        )

    return pd.DataFrame(filas, columns=COLUMNAS_PREDICCION)


def _cargar_serie_local(
    org_id: str,
    botica_id: str,
    producto_id: str,
) -> tuple[pd.DataFrame, str]:
    ruta_series = RAIZ_MODELO / "data" / "series_sarima.csv"
    ruta_features = RAIZ_MODELO / "data" / "features_modelado.csv"
    if not ruta_series.exists():
        raise FileNotFoundError(ruta_series)

    df = pd.read_csv(ruta_series, parse_dates=["fecha_semana"])
    for c in CLAVES_SERIE:
        df[c] = df[c].astype(str)
    serie = df[
        (df["org_id"] == str(org_id))
        & (df["botica_id"] == str(botica_id))
        & (df["producto_id"] == str(producto_id))
    ].copy()
    if serie.empty:
        raise ValueError("No existe la serie solicitada en data/series_sarima.csv")

    categoria = "SIN_CATEGORIA"
    if ruta_features.exists():
        feat = pd.read_csv(ruta_features)
        for c in CLAVES_SERIE:
            feat[c] = feat[c].astype(str)
        f = feat[
            (feat["org_id"] == str(org_id))
            & (feat["botica_id"] == str(botica_id))
            & (feat["producto_id"] == str(producto_id))
        ]
        if not f.empty and "categoria_terapeutica" in f:
            categoria = str(f["categoria_terapeutica"].iloc[-1])

    return serie, categoria


def main(argv: list[str] | None = None):
    parser = argparse.ArgumentParser(
        description="Inferencia del modelo SARIMA-XGBoost productivo"
    )
    sub = parser.add_subparsers(dest="comando", required=True)

    sub.add_parser("validate-model", help="Valida que el artefacto pueda cargarse")

    p = sub.add_parser("predict", help="Predice una serie local de prueba")
    p.add_argument("--org-id", required=True)
    p.add_argument("--botica-id", required=True)
    p.add_argument("--producto-id", required=True)
    p.add_argument("--horizonte", type=int, default=12)
    p.add_argument("--salida")

    args = parser.parse_args(argv)

    if args.comando == "validate-model":
        print(json.dumps(validar_modelo_pkl(), ensure_ascii=False, indent=2))
        return

    if args.comando == "predict":
        serie, categoria = _cargar_serie_local(
            args.org_id,
            args.botica_id,
            args.producto_id,
        )
        df = predecir_demanda(
            org_id=args.org_id,
            botica_id=args.botica_id,
            producto_id=args.producto_id,
            horizonte=args.horizonte,
            serie=serie,
            categoria=categoria,
        )
        if args.salida:
            ruta = Path(args.salida)
            ruta.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(ruta, index=False)
            print(f"Predicciones guardadas en {ruta}")
        else:
            print(df.to_string(index=False))


if __name__ == "__main__":
    main()
