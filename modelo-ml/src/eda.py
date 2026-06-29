"""Análisis exploratorio sencillo del dataset de entrenamiento."""

from pathlib import Path
import json

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.tsa.stattools import adfuller


RAIZ = Path(__file__).parents[1]
RUTA_DATOS = RAIZ / "data" / "features_entrenamiento.csv"
RUTA_REPORTES = RAIZ / "reports" / "eda"
RUTA_GRAFICOS = RAIZ / "reports" / "graficos"


def convertir_serializable(valor):
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


def guardar_figura(ruta):
    plt.tight_layout()
    plt.savefig(ruta, dpi=140, bbox_inches="tight")
    plt.close()


def cargar_datos():
    df = pd.read_csv(RUTA_DATOS)
    df["fecha_semana"] = pd.to_datetime(df["fecha_semana"], errors="coerce")
    df = df.sort_values(["producto_id", "botica_id", "fecha_semana"]).reset_index(drop=True)
    return df


def validar_datos(df):
    columnas_clave = ["producto_id", "botica_id", "fecha_semana"]
    fechas_unicas = pd.Series(df["fecha_semana"].dropna().unique()).sort_values()
    semanas_esperadas = pd.date_range(fechas_unicas.min(), fechas_unicas.max(), freq="W-MON")

    faltantes_por_serie = []
    for (producto_id, botica_id), grupo in df.groupby(["producto_id", "botica_id"]):
        semanas_serie = pd.Index(grupo["fecha_semana"].dropna().unique())
        faltantes = semanas_esperadas.difference(semanas_serie)
        if len(faltantes) > 0:
            faltantes_por_serie.append(
                {
                    "producto_id": producto_id,
                    "botica_id": botica_id,
                    "semanas_faltantes": len(faltantes),
                    "primera_semana_faltante": faltantes.min(),
                    "ultima_semana_faltante": faltantes.max(),
                }
            )

    columnas_numericas = df.select_dtypes(include=[np.number]).columns.tolist()
    negativos = {col: int((df[col] < 0).sum()) for col in columnas_numericas}

    return {
        "nulos_total": int(df.isna().sum().sum()),
        "nulos_por_columna": df.isna().sum().astype(int).to_dict(),
        "duplicados_exactos": int(df.duplicated().sum()),
        "duplicados_clave_producto_botica_semana": int(df.duplicated(columnas_clave).sum()),
        "valores_negativos_por_columna": negativos,
        "series_con_semanas_faltantes": len(faltantes_por_serie),
        "semanas_faltantes_total": int(sum(x["semanas_faltantes"] for x in faltantes_por_serie)),
        "detalle_semanas_faltantes": faltantes_por_serie[:20],
    }


def calcular_resumen_general(df):
    return {
        "registros": len(df),
        "productos": df["producto_id"].nunique(),
        "boticas": df["botica_id"].nunique(),
        "categorias": df["categoria_terapeutica"].nunique(),
        "semanas": df["fecha_semana"].nunique(),
        "fecha_inicio": df["fecha_semana"].min(),
        "fecha_fin": df["fecha_semana"].max(),
    }


def analizar_demanda(df):
    demanda_semanal = df.groupby("fecha_semana", as_index=False)["cantidad_vendida"].sum()
    demanda_producto = (
        df.groupby(["producto_id", "codigo_producto", "nombre_comercial", "categoria_terapeutica"], as_index=False)
        .agg(
            demanda_total=("cantidad_vendida", "sum"),
            demanda_promedio=("cantidad_vendida", "mean"),
            demanda_std=("cantidad_vendida", "std"),
            registros=("cantidad_vendida", "size"),
        )
        .sort_values("demanda_total", ascending=False)
    )
    demanda_producto["coef_variacion"] = (
        demanda_producto["demanda_std"] / demanda_producto["demanda_promedio"].replace(0, np.nan)
    ).replace([np.inf, -np.inf], np.nan)

    demanda_botica = (
        df.groupby("botica_id", as_index=False)
        .agg(demanda_total=("cantidad_vendida", "sum"), demanda_promedio=("cantidad_vendida", "mean"))
        .sort_values("demanda_total", ascending=False)
    )

    demanda_categoria = (
        df.groupby("categoria_terapeutica", as_index=False)["cantidad_vendida"]
        .sum()
        .rename(columns={"cantidad_vendida": "demanda_total"})
        .sort_values("demanda_total", ascending=False)
    )

    resumen_distribucion = df["cantidad_vendida"].describe(percentiles=[0.25, 0.5, 0.75, 0.9, 0.95]).to_dict()
    variabilidad = demanda_producto.sort_values("coef_variacion", ascending=False, na_position="last")

    return {
        "demanda_semanal": demanda_semanal,
        "resumen_productos": demanda_producto,
        "resumen_boticas": demanda_botica,
        "demanda_categoria": demanda_categoria,
        "top_10_productos": demanda_producto.head(10).to_dict("records"),
        "bottom_10_productos": demanda_producto.tail(10).sort_values("demanda_total").to_dict("records"),
        "distribucion_cantidad_vendida": resumen_distribucion,
        "productos_mayor_variabilidad": variabilidad.head(10).to_dict("records"),
        "productos_menor_variabilidad": variabilidad.dropna(subset=["coef_variacion"]).tail(10).to_dict("records"),
    }


def analizar_inventario(df):
    bajo_minimo = df["stock_inicio_semana"] < df["stock_minimo"]
    sobre_maximo = df["stock_inicio_semana"] > df["stock_maximo"]
    stock_cero = df["stock_inicio_semana"] == 0
    stock_normal = ~(bajo_minimo | sobre_maximo)

    inventario = {
        "porcentaje_stock_bajo_minimo": float(bajo_minimo.mean() * 100),
        "porcentaje_stock_sobre_maximo": float(sobre_maximo.mean() * 100),
        "porcentaje_stock_cero": float(stock_cero.mean() * 100),
        "porcentaje_stock_normal": float(stock_normal.mean() * 100),
        "conteos_estado_stock": {
            "normal": int(stock_normal.sum()),
            "bajo_minimo": int(bajo_minimo.sum()),
            "sobrestock": int(sobre_maximo.sum()),
        },
    }

    if {"stockout_flag", "demanda_insatisfecha"}.issubset(df.columns):
        quiebres = df["stockout_flag"].fillna(0).astype(bool)
        inventario["stockout"] = {
            "disponible": True,
            "porcentaje_semanas_con_quiebre": float(quiebres.mean() * 100),
            "demanda_total_insatisfecha": float(df["demanda_insatisfecha"].fillna(0).sum()),
            "productos_con_mas_quiebres": (
                df.assign(stockout_flag_bool=quiebres)
                .groupby(["producto_id", "nombre_comercial"], as_index=False)["stockout_flag_bool"]
                .sum()
                .rename(columns={"stockout_flag_bool": "quiebres"})
                .sort_values("quiebres", ascending=False)
                .head(10)
                .to_dict("records")
            ),
            "boticas_con_mas_quiebres": (
                df.assign(stockout_flag_bool=quiebres)
                .groupby("botica_id", as_index=False)["stockout_flag_bool"]
                .sum()
                .rename(columns={"stockout_flag_bool": "quiebres"})
                .sort_values("quiebres", ascending=False)
                .head(10)
                .to_dict("records")
            ),
        }
    else:
        inventario["stockout"] = {
            "disponible": False,
            "motivo": "No existen las columnas stockout_flag y demanda_insatisfecha.",
        }

    return inventario


def ejecutar_adf(serie):
    serie = serie.dropna()
    if len(serie) < 12 or serie.nunique() <= 1:
        return {"ejecutada": False, "motivo": "Serie demasiado corta o constante."}

    resultado = adfuller(serie, autolag="AIC")
    return {
        "ejecutada": True,
        "estadistico": float(resultado[0]),
        "p_value": float(resultado[1]),
        "lags_usados": int(resultado[2]),
        "observaciones": int(resultado[3]),
        "estacionaria_5pct": bool(resultado[1] < 0.05),
    }


def analizar_series_representativas(df):
    resumen_series = (
        df.groupby(["producto_id", "botica_id", "codigo_producto", "nombre_comercial"], as_index=False)
        .agg(
            demanda_total=("cantidad_vendida", "sum"),
            demanda_promedio=("cantidad_vendida", "mean"),
            demanda_std=("cantidad_vendida", "std"),
            semanas=("fecha_semana", "nunique"),
        )
        .sort_values("demanda_promedio", ascending=False)
        .reset_index(drop=True)
    )
    resumen_series["coef_variacion"] = (
        resumen_series["demanda_std"] / resumen_series["demanda_promedio"].replace(0, np.nan)
    ).replace([np.inf, -np.inf], np.nan)

    if resumen_series.empty:
        return {"resumen_series": resumen_series, "representativas": []}

    indice_alta = resumen_series["demanda_promedio"].idxmax()
    indice_baja = resumen_series["demanda_promedio"].idxmin()
    mediana = resumen_series["demanda_promedio"].median()
    indice_media = (resumen_series["demanda_promedio"] - mediana).abs().idxmin()

    seleccion = [
        ("alta", resumen_series.loc[indice_alta]),
        ("media", resumen_series.loc[indice_media]),
        ("baja", resumen_series.loc[indice_baja]),
    ]

    representativas = []
    resumen_series["tipo_representativa"] = ""
    resumen_series["adf_p_value"] = np.nan
    resumen_series["adf_estacionaria_5pct"] = pd.Series(pd.NA, index=resumen_series.index, dtype="object")

    for tipo, fila in seleccion:
        mascara = (df["producto_id"] == fila["producto_id"]) & (df["botica_id"] == fila["botica_id"])
        serie_df = df.loc[mascara, ["fecha_semana", "cantidad_vendida"]].sort_values("fecha_semana")
        serie = serie_df.set_index("fecha_semana")["cantidad_vendida"].asfreq("W-MON")
        adf = ejecutar_adf(serie)

        resumen_series.loc[
            (resumen_series["producto_id"] == fila["producto_id"]) & (resumen_series["botica_id"] == fila["botica_id"]),
            "tipo_representativa",
        ] = tipo
        if adf.get("ejecutada"):
            resumen_series.loc[
                (resumen_series["producto_id"] == fila["producto_id"]) & (resumen_series["botica_id"] == fila["botica_id"]),
                "adf_p_value",
            ] = adf["p_value"]
            resumen_series.loc[
                (resumen_series["producto_id"] == fila["producto_id"]) & (resumen_series["botica_id"] == fila["botica_id"]),
                "adf_estacionaria_5pct",
            ] = adf["estacionaria_5pct"]

        representativas.append(
            {
                "tipo": tipo,
                "producto_id": fila["producto_id"],
                "botica_id": fila["botica_id"],
                "codigo_producto": fila["codigo_producto"],
                "nombre_comercial": fila["nombre_comercial"],
                "demanda_promedio": fila["demanda_promedio"],
                "demanda_total": fila["demanda_total"],
                "semanas": fila["semanas"],
                "adf": adf,
            }
        )

    return {"resumen_series": resumen_series, "representativas": representativas}


def generar_graficos(df, demanda, inventario, series):
    RUTA_GRAFICOS.mkdir(parents=True, exist_ok=True)
    rutas = {}

    demanda["demanda_semanal"].plot(x="fecha_semana", y="cantidad_vendida", legend=False, figsize=(11, 5))
    plt.title("Demanda semanal total")
    plt.xlabel("Semana")
    plt.ylabel("Cantidad vendida")
    rutas["demanda_semanal_total"] = str(RUTA_GRAFICOS / "demanda_semanal_total.png")
    guardar_figura(rutas["demanda_semanal_total"])

    top_productos = demanda["resumen_productos"].head(10).sort_values("demanda_total")
    plt.figure(figsize=(10, 6))
    plt.barh(top_productos["nombre_comercial"], top_productos["demanda_total"])
    plt.title("Top 10 productos por demanda")
    plt.xlabel("Demanda total")
    rutas["top_10_productos"] = str(RUTA_GRAFICOS / "top_10_productos.png")
    guardar_figura(rutas["top_10_productos"])

    demanda["resumen_boticas"].sort_values("demanda_total").plot(
        x="botica_id", y="demanda_total", kind="barh", legend=False, figsize=(9, 5)
    )
    plt.title("Demanda por botica")
    plt.xlabel("Demanda total")
    plt.ylabel("Botica")
    rutas["demanda_por_botica"] = str(RUTA_GRAFICOS / "demanda_por_botica.png")
    guardar_figura(rutas["demanda_por_botica"])

    demanda["demanda_categoria"].sort_values("demanda_total").plot(
        x="categoria_terapeutica", y="demanda_total", kind="barh", legend=False, figsize=(10, 7)
    )
    plt.title("Demanda por categoría")
    plt.xlabel("Demanda total")
    plt.ylabel("Categoría")
    rutas["demanda_por_categoria"] = str(RUTA_GRAFICOS / "demanda_por_categoria.png")
    guardar_figura(rutas["demanda_por_categoria"])

    if "stockout_flag" in df.columns:
        stockout_categoria = (
            df.groupby("categoria_terapeutica", as_index=False)["stockout_flag"]
            .mean()
            .assign(porcentaje_stockout=lambda datos: datos["stockout_flag"] * 100.0)
            .sort_values("porcentaje_stockout")
        )
        stockout_categoria.plot(
            x="categoria_terapeutica", y="porcentaje_stockout", kind="barh", legend=False, figsize=(10, 7)
        )
        plt.title("Stockout por categoría")
        plt.xlabel("Semanas con stockout (%)")
        plt.ylabel("Categoría")
        rutas["stockout_por_categoria"] = str(RUTA_GRAFICOS / "stockout_por_categoria.png")
        guardar_figura(rutas["stockout_por_categoria"])

    if "demanda_insatisfecha" in df.columns:
        insatisfecha_categoria = (
            df.groupby("categoria_terapeutica", as_index=False)["demanda_insatisfecha"]
            .sum()
            .sort_values("demanda_insatisfecha")
        )
        insatisfecha_categoria.plot(
            x="categoria_terapeutica", y="demanda_insatisfecha", kind="barh", legend=False, figsize=(10, 7)
        )
        plt.title("Demanda insatisfecha por categoría")
        plt.xlabel("Demanda insatisfecha total")
        plt.ylabel("Categoría")
        rutas["demanda_insatisfecha_por_categoria"] = str(RUTA_GRAFICOS / "demanda_insatisfecha_por_categoria.png")
        guardar_figura(rutas["demanda_insatisfecha_por_categoria"])

    plt.figure(figsize=(9, 5))
    plt.hist(df["cantidad_vendida"], bins=30, edgecolor="black")
    plt.title("Distribución de cantidad vendida")
    plt.xlabel("Cantidad vendida")
    plt.ylabel("Frecuencia")
    rutas["distribucion_cantidad_vendida"] = str(RUTA_GRAFICOS / "distribucion_cantidad_vendida.png")
    guardar_figura(rutas["distribucion_cantidad_vendida"])

    demanda_semana_anio = (
        df.assign(semana_anio=df["fecha_semana"].dt.isocalendar().week.astype(int))
        .groupby("semana_anio", as_index=False)["cantidad_vendida"]
        .mean()
    )
    demanda_semana_anio.plot(x="semana_anio", y="cantidad_vendida", legend=False, figsize=(10, 5))
    plt.title("Demanda promedio por semana del año")
    plt.xlabel("Semana del año")
    plt.ylabel("Demanda promedio")
    rutas["demanda_promedio_semana_anio"] = str(RUTA_GRAFICOS / "demanda_promedio_semana_anio.png")
    guardar_figura(rutas["demanda_promedio_semana_anio"])

    plt.figure(figsize=(11, 5))
    for item in series["representativas"]:
        mascara = (df["producto_id"] == item["producto_id"]) & (df["botica_id"] == item["botica_id"])
        serie_df = df.loc[mascara, ["fecha_semana", "cantidad_vendida"]].sort_values("fecha_semana")
        etiqueta = f"{item['tipo']} - {item['nombre_comercial']}"
        plt.plot(serie_df["fecha_semana"], serie_df["cantidad_vendida"], label=etiqueta)
    plt.title("Series representativas de demanda")
    plt.xlabel("Semana")
    plt.ylabel("Cantidad vendida")
    plt.legend()
    rutas["series_representativas"] = str(RUTA_GRAFICOS / "series_representativas.png")
    guardar_figura(rutas["series_representativas"])

    fig, axes = plt.subplots(len(series["representativas"]), 1, figsize=(10, 8))
    if len(series["representativas"]) == 1:
        axes = [axes]
    for ax, item in zip(axes, series["representativas"]):
        mascara = (df["producto_id"] == item["producto_id"]) & (df["botica_id"] == item["botica_id"])
        serie = df.loc[mascara].sort_values("fecha_semana").set_index("fecha_semana")["cantidad_vendida"].asfreq("W-MON")
        plot_acf(serie.dropna(), lags=min(52, max(1, len(serie.dropna()) // 2 - 1)), ax=ax)
        ax.set_title(f"ACF serie {item['tipo']} - {item['nombre_comercial']}")
    rutas["acf_series_representativas"] = str(RUTA_GRAFICOS / "acf_series_representativas.png")
    guardar_figura(rutas["acf_series_representativas"])

    numericas = df.select_dtypes(include=[np.number])
    correlacion = numericas.corr()
    plt.figure(figsize=(8, 6))
    plt.imshow(correlacion, cmap="coolwarm", vmin=-1, vmax=1)
    plt.colorbar(label="Correlación")
    plt.xticks(range(len(correlacion.columns)), correlacion.columns, rotation=45, ha="right")
    plt.yticks(range(len(correlacion.columns)), correlacion.columns)
    for i in range(len(correlacion.columns)):
        for j in range(len(correlacion.columns)):
            plt.text(j, i, f"{correlacion.iloc[i, j]:.2f}", ha="center", va="center", fontsize=8)
    plt.title("Matriz de correlación")
    rutas["matriz_correlacion"] = str(RUTA_GRAFICOS / "matriz_correlacion.png")
    guardar_figura(rutas["matriz_correlacion"])

    estados_stock = pd.Series(inventario["conteos_estado_stock"]).rename(
        {"normal": "Normal", "bajo_minimo": "Bajo mínimo", "sobrestock": "Sobrestock"}
    )
    plt.figure(figsize=(7, 5))
    plt.pie(estados_stock, labels=estados_stock.index, autopct="%1.1f%%", startangle=90)
    plt.title("Porcentaje de estado de stock")
    rutas["estado_stock_porcentaje"] = str(RUTA_GRAFICOS / "estado_stock_porcentaje.png")
    guardar_figura(rutas["estado_stock_porcentaje"])

    return rutas, correlacion


def construir_conclusiones(df, validacion, demanda, inventario, series, correlacion):
    demanda_semanal = demanda["demanda_semanal"].copy()
    demanda_semanal["orden"] = np.arange(len(demanda_semanal))
    corr_tiempo = demanda_semanal[["orden", "cantidad_vendida"]].corr().iloc[0, 1]
    corr_demanda_stock = correlacion.get("cantidad_vendida", pd.Series(dtype=float)).drop(labels=["cantidad_vendida"], errors="ignore")

    p_values_adf = [s["adf"].get("p_value") for s in series["representativas"] if s["adf"].get("ejecutada")]
    estacionarias = [p < 0.05 for p in p_values_adf]
    hay_estacionalidad = bool(
        df.assign(semana_anio=df["fecha_semana"].dt.isocalendar().week.astype(int))
        .groupby("semana_anio")["cantidad_vendida"]
        .mean()
        .std()
        > 0
    )

    hallazgos = [
        f"La demanda total acumulada es {int(df['cantidad_vendida'].sum())} unidades.",
        f"El producto con mayor demanda es {demanda['top_10_productos'][0]['nombre_comercial']}.",
        f"La categoría con mayor demanda es {demanda['demanda_categoria'].iloc[0]['categoria_terapeutica']}.",
        f"La correlación lineal demanda-tiempo es {corr_tiempo:.3f}.",
    ]

    riesgos = []
    if validacion["series_con_semanas_faltantes"] > 0:
        riesgos.append("Existen series con semanas faltantes; SARIMA requiere series regulares.")
    if validacion["nulos_total"] > 0:
        riesgos.append("Existen valores nulos que deben resolverse antes de entrenar.")
    if validacion["duplicados_clave_producto_botica_semana"] > 0:
        riesgos.append("Existen duplicados por producto-botica-semana que pueden sesgar el entrenamiento.")
    if inventario["porcentaje_stock_bajo_minimo"] > 10:
        riesgos.append("Hay una proporción relevante de registros con stock bajo el mínimo.")
    if not riesgos:
        riesgos.append("No se observan problemas críticos de calidad en las validaciones básicas.")

    aptitud_sarima = {
        "apta_para_continuar": validacion["series_con_semanas_faltantes"] == 0 and df["fecha_semana"].nunique() >= 52,
        "observacion": "Las series son semanales y tienen más de un año de historia; conviene evaluar estacionariedad y estacionalidad por serie antes de entrenar.",
        "adf_series_representativas_estacionarias": int(sum(estacionarias)),
        "adf_series_representativas_evaluadas": len(estacionarias),
    }

    aptitud_xgboost = {
        "apta_para_continuar": validacion["nulos_total"] == 0 and validacion["duplicados_clave_producto_botica_semana"] == 0,
        "observacion": "El dataset es adecuado para continuar, pero las variables temporales derivadas deben construirse en Feature Engineering, no en este EDA.",
    }

    recomendaciones = [
        "Mantener este EDA como control previo antes de generar features.",
        "Construir lags, ventanas móviles y variables calendario en el módulo de Feature Engineering.",
        "Evaluar SARIMA por familias de series o por series representativas antes de escalar a todos los productos.",
        "Incorporar columnas de quiebre de stock si se desea medir demanda censurada o insatisfecha.",
    ]

    if corr_demanda_stock.notna().any():
        variable_mas_relacionada = corr_demanda_stock.abs().sort_values(ascending=False).index[0]
        hallazgos.append(
            f"La variable numérica más relacionada linealmente con la demanda es {variable_mas_relacionada}."
        )
    if hay_estacionalidad:
        hallazgos.append("La demanda promedio por semana del año permite revisar un posible patrón estacional anual.")

    return {
        "hallazgos": hallazgos,
        "riesgos": riesgos,
        "aptitud_sarima": aptitud_sarima,
        "aptitud_xgboost": aptitud_xgboost,
        "recomendaciones": recomendaciones,
    }


def guardar_reporte(df, resumen, validacion, demanda, inventario, series, graficos, correlacion, conclusiones):
    RUTA_REPORTES.mkdir(parents=True, exist_ok=True)

    demanda["resumen_productos"].to_csv(RUTA_REPORTES / "resumen_productos.csv", index=False)
    demanda["resumen_boticas"].to_csv(RUTA_REPORTES / "resumen_boticas.csv", index=False)
    series["resumen_series"].to_csv(RUTA_REPORTES / "resumen_series.csv", index=False)

    reporte = {
        "resumen_general": resumen,
        "validacion_datos": validacion,
        "demanda": {
            "total": int(df["cantidad_vendida"].sum()),
            "promedio": float(df["cantidad_vendida"].mean()),
            "top_10_productos": demanda["top_10_productos"],
            "bottom_10_productos": demanda["bottom_10_productos"],
            "boticas_mayor_demanda": demanda["resumen_boticas"].head(10).to_dict("records"),
            "categorias_mayor_demanda": demanda["demanda_categoria"].head(10).to_dict("records"),
            "distribucion_cantidad_vendida": demanda["distribucion_cantidad_vendida"],
            "productos_mayor_variabilidad": demanda["productos_mayor_variabilidad"],
            "productos_menor_variabilidad": demanda["productos_menor_variabilidad"],
        },
        "inventario": inventario,
        "relacion_demanda_stock_lead_time": correlacion.to_dict(),
        "series_representativas": series["representativas"],
        "graficos": graficos,
        **conclusiones,
    }

    ruta_reporte = RUTA_REPORTES / "eda_reporte.json"
    with ruta_reporte.open("w", encoding="utf-8") as archivo:
        json.dump(convertir_serializable(reporte), archivo, ensure_ascii=False, indent=2)

    return ruta_reporte


def main():
    df = cargar_datos()
    validacion = validar_datos(df)
    resumen = calcular_resumen_general(df)
    demanda = analizar_demanda(df)
    inventario = analizar_inventario(df)
    series = analizar_series_representativas(df)
    graficos, correlacion = generar_graficos(df, demanda, inventario, series)
    conclusiones = construir_conclusiones(df, validacion, demanda, inventario, series, correlacion)
    ruta_reporte = guardar_reporte(df, resumen, validacion, demanda, inventario, series, graficos, correlacion, conclusiones)

    print("Resumen EDA")
    print(f"Registros: {resumen['registros']}")
    print(f"Productos: {resumen['productos']}")
    print(f"Boticas: {resumen['boticas']}")
    print(f"Semanas: {resumen['semanas']}")
    print(f"Nulos: {validacion['nulos_total']}")
    print(f"Duplicados: {validacion['duplicados_exactos']}")
    print(f"Stock bajo minimo: {inventario['porcentaje_stock_bajo_minimo']:.2f}%")
    print(f"Sobrestock: {inventario['porcentaje_stock_sobre_maximo']:.2f}%")
    if inventario["stockout"]["disponible"]:
        print(f"Quiebres: {inventario['stockout']['porcentaje_semanas_con_quiebre']:.2f}%")
    print(f"Reportes generados en: {ruta_reporte.parent}")
    print(f"Graficos generados en: {RUTA_GRAFICOS}")


if __name__ == "__main__":
    main()
