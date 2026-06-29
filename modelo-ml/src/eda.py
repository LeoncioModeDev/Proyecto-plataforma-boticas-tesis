# -*- coding: utf-8 -*-
"""EDA reproducible para demanda semanal producto-botica."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


RAIZ_MODELO = Path(__file__).resolve().parents[1]
DIR_DATOS = RAIZ_MODELO / "data"
DIR_REPORTES = RAIZ_MODELO / "reports"
DIR_EDA = DIR_REPORTES / "eda"
DIR_GRAFICOS = DIR_REPORTES / "graficos"
RUTA_DATOS = DIR_DATOS / "features_entrenamiento.csv"
CLAVES_SERIE = ["org_id", "botica_id", "producto_id"]
CLAVE_SEMANAL = [*CLAVES_SERIE, "fecha_semana"]
FRECUENCIA = "W-MON"


def cargar_datos(ruta: Path = RUTA_DATOS) -> pd.DataFrame:
    if not ruta.exists():
        raise FileNotFoundError(f"No existe {ruta}")
    df = pd.read_csv(ruta)
    df["fecha_semana"] = pd.to_datetime(df["fecha_semana"], errors="coerce")
    return df.sort_values(CLAVE_SEMANAL).reset_index(drop=True)


def validar_datos(df: pd.DataFrame) -> pd.DataFrame:
    validaciones = []

    def agregar(nombre: str, ok: bool, cantidad: int = 0, detalle: str = "") -> None:
        validaciones.append({"validacion": nombre, "resultado": "ok" if ok else "error", "cantidad": int(cantidad), "detalle": detalle})

    for columna in ["org_id", "botica_id", "producto_id", "categoria_terapeutica"]:
        nulos = int(df[columna].isna().sum()) if columna in df.columns else len(df)
        agregar(f"{columna}_no_nulo", nulos == 0, nulos)

    fechas_invalidas = int(df["fecha_semana"].isna().sum())
    agregar("fecha_semana_valida", fechas_invalidas == 0, fechas_invalidas)
    negativos = int((pd.to_numeric(df["cantidad_vendida"], errors="coerce").fillna(-1) < 0).sum())
    agregar("cantidad_vendida_no_negativa", negativos == 0, negativos)
    duplicados = int(df.duplicated(CLAVE_SEMANAL).sum())
    agregar("sin_duplicados_org_botica_producto_semana", duplicados == 0, duplicados)

    series_incompletas = 0
    for clave, grupo in df.groupby(CLAVES_SERIE):
        fechas = pd.Index(pd.to_datetime(grupo["fecha_semana"].dropna().sort_values().unique()))
        if fechas.empty:
            series_incompletas += 1
            continue
        esperado = pd.date_range(fechas.min(), fechas.max(), freq=FRECUENCIA)
        if len(fechas) != len(esperado) or not fechas.equals(pd.Index(esperado)):
            series_incompletas += 1
    agregar("frecuencia_w_mon_completa", series_incompletas == 0, series_incompletas, "series incompletas")
    return pd.DataFrame(validaciones)


def resumen_general(df: pd.DataFrame) -> pd.DataFrame:
    metricas = {
        "numero_organizaciones": df["org_id"].nunique(),
        "numero_boticas": df["botica_id"].nunique(),
        "numero_productos": df["producto_id"].nunique(),
        "numero_categorias": df["categoria_terapeutica"].nunique(),
        "numero_series_producto_botica": df.groupby(CLAVES_SERIE).ngroups,
        "numero_semanas": df["fecha_semana"].nunique(),
        "fecha_inicial": df["fecha_semana"].min().date().isoformat(),
        "fecha_final": df["fecha_semana"].max().date().isoformat(),
        "nivel_prediccion": "producto_botica",
        "nivel_agregacion_paper": "categoria_terapeutica",
    }
    return pd.DataFrame([{"metrica": k, "valor": v} for k, v in metricas.items()])


def _coef(std, mean):
    return std / mean if mean and mean > 0 else 0.0


def _semanas_desde_ultima_venta(serie: pd.Series) -> float:
    valores = serie.astype(float).tolist()
    for i, valor in enumerate(reversed(valores)):
        if valor > 0:
            return float(i)
    return float(len(valores))


def resumen_series(df: pd.DataFrame) -> pd.DataFrame:
    filas = []
    for clave, grupo in df.groupby(CLAVES_SERIE, sort=False):
        cantidades = grupo["cantidad_vendida"].astype(float)
        media = float(cantidades.mean())
        std = float(cantidades.std(ddof=0))
        filas.append({
            "org_id": clave[0], "botica_id": clave[1], "producto_id": clave[2],
            "categoria_terapeutica": grupo["categoria_terapeutica"].iloc[-1],
            "semanas": int(len(grupo)), "fecha_inicio": grupo["fecha_semana"].min().date().isoformat(), "fecha_fin": grupo["fecha_semana"].max().date().isoformat(),
            "demanda_total": float(cantidades.sum()), "demanda_promedio": media, "demanda_std": std,
            "coeficiente_variacion": _coef(std, media), "porcentaje_ceros": float((cantidades == 0).mean() * 100),
            "semanas_desde_ultima_venta": _semanas_desde_ultima_venta(cantidades),
            "serie_constante": bool(cantidades.nunique() <= 1), "serie_sin_demanda": bool(cantidades.sum() == 0),
        })
    return pd.DataFrame(filas)


def resumen_productos(df: pd.DataFrame) -> pd.DataFrame:
    base = df.groupby(["org_id", "producto_id", "categoria_terapeutica"], as_index=False).agg(
        boticas=("botica_id", "nunique"), series=("botica_id", "nunique"), semanas_observadas=("fecha_semana", "nunique"),
        demanda_total=("cantidad_vendida", "sum"), demanda_promedio=("cantidad_vendida", "mean"), demanda_std=("cantidad_vendida", "std"),
    )
    base["demanda_std"] = base["demanda_std"].fillna(0.0)
    base["coeficiente_variacion"] = base.apply(lambda r: _coef(r["demanda_std"], r["demanda_promedio"]), axis=1)
    return base


def resumen_boticas(df: pd.DataFrame) -> pd.DataFrame:
    return df.groupby(["org_id", "botica_id"], as_index=False).agg(
        productos=("producto_id", "nunique"), series=("producto_id", "nunique"), demanda_total=("cantidad_vendida", "sum"), demanda_promedio=("cantidad_vendida", "mean"), demanda_std=("cantidad_vendida", "std")
    ).fillna({"demanda_std": 0.0})


def resumen_categorias(df: pd.DataFrame) -> pd.DataFrame:
    base = df.groupby("categoria_terapeutica", as_index=False).agg(
        productos=("producto_id", "nunique"), boticas=("botica_id", "nunique"), demanda_total=("cantidad_vendida", "sum"), demanda_promedio=("cantidad_vendida", "mean"), demanda_std=("cantidad_vendida", "std")
    )
    series_unicas = df[["categoria_terapeutica", *CLAVES_SERIE]].drop_duplicates().groupby("categoria_terapeutica").size().rename("series").reset_index()
    base = base.merge(series_unicas, on="categoria_terapeutica", how="left")
    base["demanda_std"] = base["demanda_std"].fillna(0.0)
    base["coeficiente_variacion"] = base.apply(lambda r: _coef(r["demanda_std"], r["demanda_promedio"]), axis=1)
    return base[["categoria_terapeutica", "productos", "boticas", "series", "demanda_total", "demanda_promedio", "demanda_std", "coeficiente_variacion"]].sort_values("demanda_total", ascending=False)


def resumen_inventario_opcional(df: pd.DataFrame) -> dict:
    requeridas = {"stock_inicio_semana", "stock_minimo", "stock_maximo"}
    resultado = {"disponible": requeridas.issubset(df.columns)}
    if not resultado["disponible"]:
        resultado["motivo"] = "No existen columnas completas de inventario."
        return resultado
    resultado.update({
        "porcentaje_bajo_minimo": float((df["stock_inicio_semana"] < df["stock_minimo"]).mean() * 100),
        "porcentaje_sobre_maximo": float((df["stock_inicio_semana"] > df["stock_maximo"]).mean() * 100),
    })
    if {"stockout_flag", "demanda_insatisfecha"}.issubset(df.columns):
        resultado["stockout_disponible"] = True
        resultado["porcentaje_stockout"] = float(df["stockout_flag"].fillna(0).astype(bool).mean() * 100)
        resultado["demanda_insatisfecha_total"] = float(df["demanda_insatisfecha"].fillna(0).sum())
    else:
        resultado["stockout_disponible"] = False
    return resultado


def guardar_figuras(df: pd.DataFrame, resumen_cat: pd.DataFrame) -> dict:
    DIR_GRAFICOS.mkdir(parents=True, exist_ok=True)
    rutas = {}
    demanda_semana = df.groupby("fecha_semana", as_index=False)["cantidad_vendida"].sum()
    plt.figure(figsize=(10, 4)); plt.plot(demanda_semana["fecha_semana"], demanda_semana["cantidad_vendida"]); plt.title("Demanda semanal total"); plt.xlabel("Semana"); plt.ylabel("Cantidad vendida"); plt.tight_layout()
    rutas["demanda_semanal_total"] = str(DIR_GRAFICOS / "demanda_semanal_total.png"); plt.savefig(rutas["demanda_semanal_total"], dpi=140); plt.close()
    top = resumen_cat.sort_values("demanda_total", ascending=True)
    plt.figure(figsize=(8, 5)); plt.barh(top["categoria_terapeutica"], top["demanda_total"]); plt.title("Demanda por categoría terapéutica"); plt.xlabel("Cantidad vendida"); plt.tight_layout()
    rutas["demanda_por_categoria"] = str(DIR_GRAFICOS / "demanda_por_categoria.png"); plt.savefig(rutas["demanda_por_categoria"], dpi=140); plt.close()
    return rutas


def ejecutar(ruta_datos: Path = RUTA_DATOS) -> dict:
    df = cargar_datos(ruta_datos)
    DIR_EDA.mkdir(parents=True, exist_ok=True)
    validacion = validar_datos(df)
    general = resumen_general(df)
    series = resumen_series(df)
    productos = resumen_productos(df)
    boticas = resumen_boticas(df)
    categorias = resumen_categorias(df)
    inventario = resumen_inventario_opcional(df)
    graficos = guardar_figuras(df, categorias)

    validacion.to_csv(DIR_EDA / "validacion_datos.csv", index=False, encoding="utf-8")
    general.to_csv(DIR_EDA / "resumen_general.csv", index=False, encoding="utf-8")
    series.to_csv(DIR_EDA / "resumen_series.csv", index=False, encoding="utf-8")
    productos.to_csv(DIR_EDA / "resumen_productos.csv", index=False, encoding="utf-8")
    boticas.to_csv(DIR_EDA / "resumen_boticas.csv", index=False, encoding="utf-8")
    categorias.to_csv(DIR_EDA / "resumen_categorias.csv", index=False, encoding="utf-8")
    reporte = {"validaciones_error": int((validacion["resultado"] != "ok").sum()), "inventario": inventario, "graficos": graficos}
    with (DIR_EDA / "eda_reporte.json").open("w", encoding="utf-8") as archivo:
        json.dump(reporte, archivo, ensure_ascii=False, indent=2)
    return reporte


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera EDA de demanda producto-botica")
    parser.add_argument("--input", type=Path, default=RUTA_DATOS)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    reporte = ejecutar(args.input)
    print(f"EDA generado en {DIR_EDA}. Errores de validación: {reporte['validaciones_error']}")


if __name__ == "__main__":
    main()
