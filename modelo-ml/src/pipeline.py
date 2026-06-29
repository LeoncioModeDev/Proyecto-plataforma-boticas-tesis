# -*- coding: utf-8 -*-
"""CLI productivo para entrenamiento e inferencia del modelo V4.

La lógica experimental oficial permanece en ``pipeline_v4_oficial.py`` para no
alterar features, folds, métricas ni selección de modelos del paper. Este
módulo expone una API estable y subcomandos reales para uso operativo.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import pickle
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from pmdarima.arima import ARIMA

from feature_engineering import (
    CLAVES_SERIE,
    FEATURES_HIBRIDO,
    FEATURES_XGB_INDEPENDIENTE,
    construir_fila_horizonte,
)
from recomendaciones import calcular_reposicion, generar_alertas_vencimiento


RAIZ_MODELO = Path(__file__).resolve().parents[1]
DIR_DATOS = RAIZ_MODELO / "data"
DIR_MODELO = RAIZ_MODELO / "modelos" / "v1.0.0"
DIR_REPORTS = RAIZ_MODELO / "reports"
DIR_OPERATIVO = DIR_REPORTS / "operativo"
RUTA_SERIES = DIR_DATOS / "series_sarima.csv"
RUTA_FEATURES = DIR_DATOS / "features_modelado.csv"
RUTA_MODELO = DIR_MODELO / "modelo.pkl"
RUTA_PREDICCIONES = DIR_MODELO / "predicciones_demanda.csv"
RUTA_VALIDACION_PKL = DIR_REPORTS / "validacion_modelo_pkl.json"
FRECUENCIA = "W-MON"
HORIZONTE_MAXIMO = 12
PERIODO_SARIMA_FALLBACK = 4

CLAVES_OBLIGATORIAS_MODELO = [
    "version_modelo",
    "fecha_entrenamiento",
    "preprocesador_hibrido",
    "preprocesador_xgb_independiente",
    "modelo_xgb_aditivo",
    "modelo_xgb_log",
    "modelo_xgb_independiente",
    "ordenes_sarima",
    "periodos_sarima_por_categoria",
    "configuracion_categoria",
    "features_hibrido",
    "features_xgb_independiente",
    "frecuencia",
    "horizonte",
    "metricas",
    "hash_datos",
    "version_feature_engineering",
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
    "metodo_aplicado",
    "alpha",
    "version_modelo",
]


def calcular_hash_archivos(rutas) -> str:
    sha = hashlib.sha256()
    for ruta in rutas:
        ruta = Path(ruta)
        if not ruta.exists():
            continue
        sha.update(ruta.name.encode("utf-8"))
        with ruta.open("rb") as archivo:
            for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
                sha.update(bloque)
    return sha.hexdigest()


def validar_horizonte(horizonte: int) -> int:
    horizonte = int(horizonte)
    if horizonte < 1 or horizonte > HORIZONTE_MAXIMO:
        raise ValueError("--horizonte debe estar entre 1 y 12")
    return horizonte


def cargar_csv_modelo(ruta: Path, parse_dates=None) -> pd.DataFrame:
    if not ruta.exists():
        raise FileNotFoundError(f"No existe el archivo requerido: {ruta}")
    return pd.read_csv(ruta, parse_dates=parse_dates)


def cargar_datos_modelado(data_dir: str | Path | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    base = Path(data_dir) if data_dir else DIR_DATOS
    series = cargar_csv_modelo(base / "series_sarima.csv", parse_dates=["fecha_semana"])
    features = cargar_csv_modelo(base / "features_modelado.csv", parse_dates=["fecha_semana"])
    requeridas_series = {"fecha_semana", *CLAVES_SERIE, "cantidad_vendida"}
    requeridas_features = {"fecha_semana", *CLAVES_SERIE, "categoria_terapeutica"}
    faltantes_series = requeridas_series - set(series.columns)
    faltantes_features = requeridas_features - set(features.columns)
    if faltantes_series or faltantes_features:
        raise ValueError(
            f"Esquema inválido: series faltantes={sorted(faltantes_series)} "
            f"features faltantes={sorted(faltantes_features)}"
        )
    for df in (series, features):
        for columna in CLAVES_SERIE:
            df[columna] = df[columna].astype(str)
    return series, features


def cargar_modelo(ruta_modelo: str | Path = RUTA_MODELO) -> dict:
    ruta = Path(ruta_modelo)
    if not ruta.exists():
        raise FileNotFoundError(f"No existe modelo.pkl: {ruta}")
    with ruta.open("rb") as archivo:
        artefacto = pickle.load(archivo)
    if not isinstance(artefacto, dict):
        raise TypeError(f"modelo.pkl debe contener dict, recibido {type(artefacto).__name__}")
    faltantes = [clave for clave in CLAVES_OBLIGATORIAS_MODELO if clave not in artefacto]
    if faltantes:
        raise RuntimeError(f"modelo.pkl incompleto. Faltan claves: {faltantes}")
    return artefacto


def validar_modelo_pkl(ruta_modelo: str | Path = RUTA_MODELO, salida: str | Path = RUTA_VALIDACION_PKL) -> dict:
    ruta = Path(ruta_modelo)
    reporte = {
        "ruta": str(ruta),
        "tamaño_bytes": ruta.stat().st_size if ruta.exists() else 0,
        "carga_exitosa": False,
        "tipo_objeto": None,
        "claves_presentes": [],
        "claves_faltantes": CLAVES_OBLIGATORIAS_MODELO.copy(),
        "modelos_cargables": False,
        "preprocesadores_cargables": False,
        "numero_ordenes_sarima": 0,
        "numero_configuraciones_categoria": 0,
        "version_modelo": None,
    }
    try:
        artefacto = cargar_modelo(ruta)
        reporte["carga_exitosa"] = True
        reporte["tipo_objeto"] = type(artefacto).__name__
        reporte["claves_presentes"] = sorted(artefacto.keys())
        reporte["claves_faltantes"] = [c for c in CLAVES_OBLIGATORIAS_MODELO if c not in artefacto]
        reporte["modelos_cargables"] = all(
            hasattr(artefacto.get(c), "predict")
            for c in ["modelo_xgb_aditivo", "modelo_xgb_log", "modelo_xgb_independiente"]
        )
        reporte["preprocesadores_cargables"] = all(
            hasattr(artefacto.get(c), "transform")
            for c in ["preprocesador_hibrido", "preprocesador_xgb_independiente"]
        )
        reporte["numero_ordenes_sarima"] = len(artefacto.get("ordenes_sarima", {}))
        reporte["numero_configuraciones_categoria"] = len(artefacto.get("configuracion_categoria", {}))
        reporte["version_modelo"] = artefacto.get("version_modelo")
    finally:
        salida = Path(salida)
        salida.parent.mkdir(parents=True, exist_ok=True)
        with salida.open("w", encoding="utf-8") as archivo:
            json.dump(reporte, archivo, ensure_ascii=False, indent=2)
    return reporte


def _script_oficial() -> Path:
    ruta = Path(__file__).with_name("pipeline_v4_oficial.py")
    if not ruta.exists():
        raise FileNotFoundError(f"No existe el pipeline oficial V4: {ruta}")
    return ruta


def entrenar_modelo(usar_cache: bool = False, data_dir: str | Path | None = None) -> dict:
    if usar_cache and RUTA_MODELO.exists():
        return validar_modelo_pkl(RUTA_MODELO)
    if data_dir is not None:
        raise ValueError("El entrenamiento oficial actual usa data/ como fuente canónica; data_dir no está soportado en train productivo.")
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    subprocess.run([sys.executable, str(_script_oficial()), "train"], cwd=RAIZ_MODELO, check=True, env=env)
    return validar_modelo_pkl(RUTA_MODELO)


def ejecutar_experimento(args=None, guardar_artefacto: bool = True, guardar_paper: bool = True) -> dict:
    del args, guardar_artefacto, guardar_paper
    validacion = entrenar_modelo(usar_cache=False)
    metricas = cargar_modelo(RUTA_MODELO).get("metricas", {})
    return {"validacion_modelo": validacion, "metricas": metricas}


def serie_regular(grupo: pd.DataFrame, fecha_origen: pd.Timestamp) -> pd.Series:
    datos = grupo.copy()
    datos["fecha_semana"] = pd.to_datetime(datos["fecha_semana"])
    datos = datos.sort_values("fecha_semana")
    inicio = datos["fecha_semana"].min()
    indice = pd.date_range(inicio, fecha_origen, freq=FRECUENCIA)
    serie = datos.set_index("fecha_semana")["cantidad_vendida"].astype(float)
    return serie.reindex(indice, fill_value=0.0)


def obtener_snapshot_meta(features_serie: pd.DataFrame, fecha_origen: pd.Timestamp) -> dict:
    if features_serie.empty:
        return {}
    datos = features_serie.sort_values("fecha_semana")
    historico = datos[datos["fecha_semana"] <= fecha_origen]
    fila = historico.iloc[-1] if not historico.empty else datos.iloc[-1]
    return {
        "stock_inicio_semana": float(fila.get("stock_inicio_semana", 0.0) or 0.0),
        "lead_time_dias": float(fila.get("lead_time_dias", 7.0) or 7.0),
        "ratio_stock_minimo": float(fila.get("ratio_stock_minimo", 0.0) or 0.0),
        "ratio_stock_maximo": float(fila.get("ratio_stock_maximo", 0.0) or 0.0),
        "stock_minimo": float(fila.get("stock_minimo", 0.0) or 0.0),
        "stock_maximo": float(fila.get("stock_maximo", 0.0) or 0.0),
    }


def pronosticar_sarima_fijo(serie_vals, pasos, order, seasonal_order, with_intercept=True):
    serie_vals = pd.Series(serie_vals).astype(float).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    if serie_vals.empty or serie_vals.sum() <= 0 or serie_vals.nunique() <= 1:
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
        modelo.fit(np.log1p(serie_vals.to_numpy(dtype=float)))
        forecast_log = modelo.predict(n_periods=int(pasos))
        return np.clip(np.expm1(forecast_log), 0.0, None)
    except Exception:
        return None


def pronostico_fallback_directo(serie_hist: pd.Series, fechas_futuras, periodo: int) -> np.ndarray:
    historial = serie_hist.copy().sort_index().astype(float)
    valores = {pd.Timestamp(fecha): float(valor) for fecha, valor in historial.items()}
    salida = []
    for fecha in fechas_futuras:
        fecha = pd.Timestamp(fecha)
        fecha_estacional = fecha - pd.Timedelta(weeks=int(periodo))
        if fecha_estacional in valores:
            pred = valores[fecha_estacional]
        elif valores:
            pred = float(np.mean(list(valores.values())[-4:]))
        else:
            pred = 0.0
        pred = max(0.0, float(pred))
        salida.append(pred)
        valores[fecha] = pred
    return np.asarray(salida, dtype=float)


def _filtrar_series(series: pd.DataFrame, features: pd.DataFrame, org_id=None, botica_id=None, producto_id=None) -> tuple[pd.DataFrame, pd.DataFrame]:
    filtradas = series.copy()
    features_filtradas = features.copy()
    filtros = {"org_id": org_id, "botica_id": botica_id, "producto_id": producto_id}
    for columna, valor in filtros.items():
        if valor is None:
            continue
        valor = str(valor)
        if valor not in set(series[columna].astype(str)):
            raise ValueError(f"{columna} inexistente en series_sarima.csv: {valor}")
        filtradas = filtradas[filtradas[columna] == valor]
        features_filtradas = features_filtradas[features_filtradas[columna] == valor]
    if filtradas.empty:
        raise ValueError("Los filtros no devuelven series disponibles para predecir")
    return filtradas, features_filtradas


def predecir_demanda(
    org_id: str | None = None,
    botica_id: str | None = None,
    producto_id: str | None = None,
    horizonte: int = 12,
    serie: pd.DataFrame | None = None,
    categoria: str | None = None,
    metadata_operativa: dict | None = None,
    artefacto: dict | None = None,
    fuente: str = "local",
    data_dir: str | Path | None = None,
) -> pd.DataFrame:
    horizonte = validar_horizonte(horizonte)
    if fuente != "local":
        raise ValueError("Solo fuente local está soportada por el CLI offline; use los servicios API para Supabase.")
    artefacto = artefacto or cargar_modelo(RUTA_MODELO)

    if serie is not None:
        if org_id is None or botica_id is None or producto_id is None:
            raise ValueError("org_id, botica_id y producto_id son obligatorios cuando se pasa una serie explícita")
        serie_local = serie.copy()
        serie_local["org_id"] = str(org_id)
        serie_local["botica_id"] = str(botica_id)
        serie_local["producto_id"] = str(producto_id)
        if "fecha_semana" not in serie_local or "cantidad_vendida" not in serie_local:
            raise ValueError("serie debe contener fecha_semana y cantidad_vendida")
        features_local = serie_local.copy()
        features_local["categoria_terapeutica"] = categoria or "SIN_CATEGORIA"
    else:
        series_local, features_local = cargar_datos_modelado(data_dir)
        serie_local, features_local = _filtrar_series(series_local, features_local, org_id, botica_id, producto_id)

    fecha_origen = pd.Timestamp(serie_local["fecha_semana"].max())
    fechas_futuras = pd.date_range(fecha_origen + pd.Timedelta(weeks=1), periods=horizonte, freq=artefacto.get("frecuencia", FRECUENCIA))
    grupos_features = {clave: grupo.copy() for clave, grupo in features_local.groupby(CLAVES_SERIE, sort=False)}
    filas = []
    fecha_generacion = datetime.now(timezone.utc).isoformat()

    for clave, grupo in serie_local.groupby(CLAVES_SERIE, sort=False):
        oid, bid, pid = map(str, clave)
        features_serie = grupos_features.get(clave, pd.DataFrame())
        cat = categoria or (str(features_serie["categoria_terapeutica"].iloc[-1]) if not features_serie.empty else "SIN_CATEGORIA")
        periodo = artefacto.get("periodos_sarima_por_categoria", {}).get(cat, PERIODO_SARIMA_FALLBACK)
        orden = artefacto.get("ordenes_sarima", {}).get("|".join([oid, bid, pid])) or artefacto.get("ordenes_sarima", {}).get(clave)
        hist = serie_regular(grupo, fecha_origen)
        historial_demanda = hist.to_list()
        meta = dict(obtener_snapshot_meta(features_serie, fecha_origen))
        if metadata_operativa:
            meta.update(metadata_operativa)

        pred_sarima = None
        if orden is not None:
            pred_sarima = pronosticar_sarima_fijo(
                hist,
                horizonte,
                orden["order"],
                orden["seasonal_order"],
                orden.get("with_intercept", True),
            )
        if pred_sarima is None:
            pred_sarima = pronostico_fallback_directo(hist, fechas_futuras, periodo)

        for h, fecha_objetivo in enumerate(fechas_futuras, start=1):
            pred_base = float(pred_sarima[h - 1])
            fila = construir_fila_horizonte(
                org_id=oid,
                botica_id=bid,
                producto_id=pid,
                categoria=cat,
                fecha_objetivo=fecha_objetivo,
                historial_demanda=historial_demanda,
                metadata_operativa=meta,
                horizonte=h,
                pred_sarima=pred_base,
            )
            x_hibrido = artefacto["preprocesador_hibrido"].transform(pd.DataFrame([fila])[artefacto.get("features_hibrido", FEATURES_HIBRIDO)])
            pred_target_aditivo = float(artefacto["modelo_xgb_aditivo"].predict(x_hibrido)[0])
            pred_target_log = float(artefacto["modelo_xgb_log"].predict(x_hibrido)[0])
            x_solo = artefacto["preprocesador_xgb_independiente"].transform(pd.DataFrame([fila])[artefacto.get("features_xgb_independiente", FEATURES_XGB_INDEPENDIENTE)])
            pred_xgb = float(np.clip(np.expm1(artefacto["modelo_xgb_independiente"].predict(x_solo)[0]), 0.0, None))
            config = artefacto.get("configuracion_categoria", {}).get(cat, {"metodo": "sarima", "alpha": 0.0})
            metodo = config.get("metodo", "sarima")
            alpha = float(config.get("alpha", 0.0))
            if metodo == "aditivo" and alpha > 0:
                pred_hibrida = pred_base + alpha * pred_target_aditivo * float(fila["escala_serie"])
            elif metodo == "log" and alpha > 0:
                pred_hibrida = np.expm1(np.log1p(max(pred_base, 0.0)) + alpha * pred_target_log)
            else:
                pred_hibrida = pred_base
            filas.append({
                "org_id": oid,
                "botica_id": bid,
                "producto_id": pid,
                "categoria_terapeutica": cat,
                "fecha_generacion": fecha_generacion,
                "fecha_objetivo": pd.Timestamp(fecha_objetivo).date().isoformat(),
                "horizonte": h,
                "prediccion_sarima": max(0.0, pred_base),
                "prediccion_xgboost": max(0.0, pred_xgb),
                "prediccion_hibrida": max(0.0, float(pred_hibrida)),
                "metodo_aplicado": metodo,
                "alpha": alpha,
                "version_modelo": artefacto.get("version_modelo", artefacto.get("version", "v1.0.0")),
            })
            historial_demanda.append(max(0.0, float(pred_hibrida)))
    return pd.DataFrame(filas, columns=COLUMNAS_PREDICCION)


def validar_predicciones(df: pd.DataFrame, horizonte: int) -> dict:
    faltantes = [c for c in COLUMNAS_PREDICCION if c not in df.columns]
    if faltantes:
        raise ValueError(f"Predicciones sin columnas obligatorias: {faltantes}")
    numericas = ["prediccion_sarima", "prediccion_xgboost", "prediccion_hibrida", "alpha"]
    duplicados = int(df.duplicated([*CLAVES_SERIE, "fecha_objetivo"]).sum())
    nulos = int(df.isna().sum().sum())
    infinitos = int(np.isinf(df[numericas].to_numpy(dtype=float)).sum())
    negativos = int((df[["prediccion_sarima", "prediccion_xgboost", "prediccion_hibrida"]] < 0).sum().sum())
    series = int(df.groupby(CLAVES_SERIE).ngroups) if not df.empty else 0
    horizontes_por_serie = df.groupby(CLAVES_SERIE)["horizonte"].nunique().unique().tolist() if not df.empty else []
    reporte = {
        "filas": int(len(df)),
        "series": series,
        "horizonte": int(horizonte),
        "horizontes_por_serie": [int(v) for v in horizontes_por_serie],
        "duplicados": duplicados,
        "nan": nulos,
        "infinitos": infinitos,
        "predicciones_negativas": negativos,
    }
    if duplicados or nulos or infinitos or negativos:
        raise ValueError(f"Predicciones inválidas: {reporte}")
    return reporte


def _leer_csv_opcional(nombre: str) -> pd.DataFrame:
    ruta = DIR_DATOS / nombre
    return pd.read_csv(ruta) if ruta.exists() else pd.DataFrame()


def generar_reportes_operativos(predicciones: pd.DataFrame) -> dict:
    DIR_OPERATIVO.mkdir(parents=True, exist_ok=True)
    stock = _leer_csv_opcional("stock_ubicaciones.csv")
    lotes = _leer_csv_opcional("lotes.csv")
    proveedor_producto = _leer_csv_opcional("proveedor_producto.csv")
    productos = _leer_csv_opcional("productos.csv")
    boticas = _leer_csv_opcional("boticas.csv")
    if stock.empty:
        return {"alertas_generadas": 0, "recomendaciones_generadas": 0}
    for df in (stock, lotes, proveedor_producto, productos, boticas):
        for columna in ["org_id", "botica_id", "ubicacion_id", "producto_id", "proveedor_id", "id"]:
            if columna in df.columns:
                df[columna] = df[columna].astype(str)
    demanda = predicciones.groupby(CLAVES_SERIE, as_index=False).agg(
        demanda_horizonte=("prediccion_hibrida", "sum"),
        demanda_semanal=("prediccion_hibrida", "mean"),
    )
    stock_norm = stock.rename(columns={"ubicacion_id": "botica_id"}).copy()
    base = demanda.merge(stock_norm, on=["org_id", "botica_id", "producto_id"], how="left")
    base = base.merge(proveedor_producto, on=["org_id", "producto_id"], how="left", suffixes=("", "_prov"))
    for columna, default in {
        "cantidad_disponible": 0.0,
        "stock_minimo": 0.0,
        "stock_maximo": 0.0,
        "lead_time_dias": 7.0,
        "precio_referencial": 0.0,
    }.items():
        base[columna] = pd.to_numeric(base.get(columna, default), errors="coerce").fillna(default)

    calculos = []
    for _, fila in base.iterrows():
        serie_pred = predicciones[
            (predicciones["org_id"] == fila["org_id"])
            & (predicciones["botica_id"] == fila["botica_id"])
            & (predicciones["producto_id"] == fila["producto_id"])
        ]["prediccion_hibrida"]
        desviacion = float(serie_pred.std(ddof=0) if len(serie_pred) > 1 else 0.0)
        calculo = calcular_reposicion(
            demanda_horizonte=fila["demanda_horizonte"],
            demanda_semanal_pronosticada=fila["demanda_semanal"],
            stock_actual=fila["cantidad_disponible"],
            lead_time_dias=fila["lead_time_dias"],
            desviacion_demanda=desviacion,
        )
        calculos.append(calculo)
    calc_df = pd.concat([base.reset_index(drop=True), pd.DataFrame(calculos)], axis=1)
    calc_df["costo_estimado"] = (calc_df["cantidad_recomendada"].clip(lower=0) * calc_df["precio_referencial"].clip(lower=0)).round(2)
    calc_df["stock_bajo"] = calc_df["cantidad_disponible"] <= calc_df["stock_minimo"]
    calc_df["stockout_inminente"] = calc_df["stock_proyectado"] <= 0

    productos_validos = set(productos["id"].astype(str)) if "id" in productos else set(calc_df["producto_id"])
    boticas_validas = set(boticas["id"].astype(str)) if "id" in boticas else set(calc_df["botica_id"])
    calc_df = calc_df[calc_df["producto_id"].isin(productos_validos) & calc_df["botica_id"].isin(boticas_validas)].copy()

    calc_df[calc_df["stock_bajo"]].to_csv(DIR_OPERATIVO / "productos_con_stock_bajo.csv", index=False)
    calc_df[calc_df["stockout_inminente"]].to_csv(DIR_OPERATIVO / "productos_con_stockout_inminente.csv", index=False)
    calc_df[calc_df["cantidad_recomendada"] > 0].to_csv(DIR_OPERATIVO / "recomendaciones_de_compra.csv", index=False)
    calc_df[[*CLAVES_SERIE, "cantidad_recomendada", "precio_referencial", "costo_estimado"]].to_csv(DIR_OPERATIVO / "costo_estimado_reposicion.csv", index=False)
    calc_df[[*CLAVES_SERIE, "demanda_horizonte", "cantidad_disponible", "stock_proyectado", "stock_seguridad"]].to_csv(DIR_OPERATIVO / "demanda_pronosticada_vs_stock.csv", index=False)

    if not lotes.empty:
        lotes_vencimiento = lotes.copy()
        if "lote_id" not in lotes_vencimiento.columns and "id" in lotes_vencimiento.columns:
            lotes_vencimiento = lotes_vencimiento.rename(columns={"id": "lote_id"})
        alertas_vencimiento = generar_alertas_vencimiento(lotes_vencimiento.to_dict("records"))
    else:
        alertas_vencimiento = []
    pd.DataFrame(alertas_vencimiento).to_csv(DIR_OPERATIVO / "lotes_por_vencer.csv", index=False)

    validacion = {
        "alertas_generadas": int(calc_df["stock_bajo"].sum() + calc_df["stockout_inminente"].sum() + len(alertas_vencimiento)),
        "recomendaciones_generadas": int((calc_df["cantidad_recomendada"] > 0).sum()),
        "cantidad_recomendada_negativa": int((calc_df["cantidad_recomendada"] < 0).sum()),
        "stock_seguridad_negativo": int((calc_df["stock_seguridad"] < 0).sum()),
        "costo_estimado_negativo": int((calc_df["costo_estimado"] < 0).sum()),
        "stock_proyectado_no_finito": int((~np.isfinite(calc_df["stock_proyectado"])).sum()),
        "proveedor_id_valido": bool(calc_df["proveedor_id"].notna().all()) if "proveedor_id" in calc_df else False,
        "producto_id_valido": bool(calc_df["producto_id"].isin(productos_validos).all()),
        "botica_id_valido": bool(calc_df["botica_id"].isin(boticas_validas).all()),
        "org_id_valido": bool(calc_df["org_id"].notna().all()),
    }
    with (DIR_OPERATIVO / "validacion_operativa.json").open("w", encoding="utf-8") as archivo:
        json.dump(validacion, archivo, ensure_ascii=False, indent=2)
    return validacion


def ejecutar_predict(args) -> dict:
    horizonte = validar_horizonte(args.horizonte)
    salida = Path(args.salida) if args.salida else RUTA_PREDICCIONES
    df = predecir_demanda(
        org_id=args.org_id,
        botica_id=args.botica_id,
        producto_id=args.producto_id,
        horizonte=horizonte,
        fuente=args.fuente,
    )
    validacion = validar_predicciones(df, horizonte)
    salida.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(salida, index=False)
    operativo = generar_reportes_operativos(df)
    print(f"Predicciones guardadas en: {salida}")
    print(json.dumps({**validacion, **operativo}, ensure_ascii=False, indent=2))
    return {"salida": str(salida), "validacion": validacion, "operativo": operativo}


def escribir_reporte_rls() -> dict:
    reporte = {
        "security_invoker_requerido": True,
        "vistas": [
            "vw_demanda_semanal_ml",
            "vw_predicciones_demanda",
            "vw_alertas_inventario",
            "vw_recomendaciones_reposicion",
        ],
        "tablas_base_con_org_id": [
            "ventas_historicas",
            "productos",
            "stock_historico",
            "stock_ubicaciones",
            "proveedor_producto",
            "predicciones_ml",
            "alertas_ml",
            "recomendaciones_ml",
            "modelos_ml",
        ],
        "prueba_sql": "supabase/migrations/00000000000034_ml_vistas_productivas.sql",
        "resultado_esperado": "Las vistas se ejecutan con permisos del invocador y heredan RLS de tablas base por org_id.",
    }
    ruta = DIR_REPORTS / "rls_vistas_ml.json"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", encoding="utf-8") as archivo:
        json.dump(reporte, archivo, ensure_ascii=False, indent=2)
    return reporte


def construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Pipeline ML V4: entrenamiento e inferencia")
    sub = parser.add_subparsers(dest="comando", required=True)
    p_train = sub.add_parser("train", help="Entrena el modelo oficial V4 y valida modelo.pkl")
    p_train.add_argument("--usar-cache", action="store_true", help="Usa modelo.pkl existente si está completo")
    p_predict = sub.add_parser("predict", help="Genera predicciones futuras reales")
    p_predict.add_argument("--org-id")
    p_predict.add_argument("--botica-id")
    p_predict.add_argument("--producto-id")
    p_predict.add_argument("--horizonte", type=int, default=12)
    p_predict.add_argument("--fuente", choices=["local", "supabase"], default="local")
    p_predict.add_argument("--salida")
    p_eval = sub.add_parser("evaluate-paper", help="Ejecuta el experimento oficial V4 del paper")
    p_eval.add_argument("--usar-cache", action="store_true")
    return parser


def main(argv: list[str] | None = None):
    parser = construir_parser()
    args = parser.parse_args(argv)
    try:
        if args.comando == "train":
            reporte = entrenar_modelo(usar_cache=args.usar_cache)
            escribir_reporte_rls()
            print(json.dumps(reporte, ensure_ascii=False, indent=2))
            return reporte
        if args.comando == "predict":
            return ejecutar_predict(args)
        if args.comando == "evaluate-paper":
            return ejecutar_experimento()
    except Exception as exc:
        parser.exit(1, f"ERROR: {exc}\n")


if __name__ == "__main__":
    main()
