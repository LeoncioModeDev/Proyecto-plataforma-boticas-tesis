from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


RAIZ = Path(__file__).resolve().parents[1]
DIR_DATOS = RAIZ / "data"
DIR_MODELO = RAIZ / "modelos" / "v1.0.0"
DIR_SALIDA = DIR_DATOS / "importacion_plataforma"

ARCHIVOS_CSV = {
    "categorias_terapeuticas": "01_categorias_terapeuticas.csv",
    "boticas": "02_boticas.csv",
    "productos": "03_productos.csv",
    "proveedores": "04_proveedores.csv",
    "proveedor_producto": "05_proveedor_producto.csv",
    "precios": "06_precios.csv",
    "stock_inicial": "07_stock_inicial.csv",
    "stock_historico": "08_stock_historico.csv",
    "ventas_historicas": "09_ventas_historicas.csv",
}

ORDEN_IMPORTACION = list(ARCHIVOS_CSV.keys())
UUID_RE = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
MODOS_VENTAS = {"full": None, "104w": 104, "78w": 78, "52w": 52, "30w": 30}
MODOS_STOCK = {"full": None, "52w": 52, "26w": 26, "12w": 12, "4w": 4, "1w": 1, "none": 0}


def leer_csv(ruta: Path, **kwargs) -> pd.DataFrame:
    if not ruta.exists():
        raise FileNotFoundError(f"No existe fuente requerida: {ruta}")
    return pd.read_csv(ruta, **kwargs)


def escribir_csv(df: pd.DataFrame, ruta: Path) -> None:
    df.to_csv(ruta, index=False, encoding="utf-8", lineterminator="\n")


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
            h.update(bloque)
    return h.hexdigest()


def dividir_dataframe_csv(
    df: pd.DataFrame,
    directorio: Path,
    prefijo: str,
    tamano_lote: int,
    col_fecha: str,
    columnas_orden: list[str],
) -> list[dict]:
    directorio.mkdir(parents=True, exist_ok=True)
    for f in directorio.glob(f"{prefijo}_*.csv"):
        f.unlink()

    df_ordenado = df.sort_values(columnas_orden).reset_index(drop=True)
    tramos: list[dict] = []
    total = len(df_ordenado)

    for i in range(0, total, tamano_lote):
        numero = i // tamano_lote + 1
        df_tramo = df_ordenado.iloc[i : i + tamano_lote].copy()
        nombre = f"{prefijo}_{numero:03d}.csv"
        ruta = directorio / nombre
        escribir_csv(df_tramo, ruta)

        fechas = pd.to_datetime(df_tramo[col_fecha])
        tramos.append({
            "archivo": nombre,
            "numero_tramo": numero,
            "fila_desde": i + 1,
            "fila_hasta": i + len(df_tramo),
            "cantidad_filas": len(df_tramo),
            "fecha_minima": str(fechas.min().date()),
            "fecha_maxima": str(fechas.max().date()),
            "sha256": sha256(ruta),
        })

    return tramos


def validar_division(
    df_consolidado: pd.DataFrame,
    tramos: list[dict],
    directorio: Path,
    tamano_lote: int,
    columnas_orden: list[str],
) -> list[str]:
    errores: list[str] = []
    filas_tramos = sum(t["cantidad_filas"] for t in tramos)
    if filas_tramos != len(df_consolidado):
        errores.append(f"Suma de filas de tramos ({filas_tramos}) != consolidado ({len(df_consolidado)})")

    for t in tramos:
        if t["cantidad_filas"] > tamano_lote:
            errores.append(f"Tramo {t['archivo']} excede tamano_lote: {t['cantidad_filas']} > {tamano_lote}")
        if t["cantidad_filas"] == 0:
            errores.append(f"Tramo {t['archivo']} esta vacio")

    if tramos:
        primer_enc = pd.read_csv(directorio / tramos[0]["archivo"], nrows=0).columns.tolist()
        for t in tramos[1:]:
            enc = pd.read_csv(directorio / t["archivo"], nrows=0).columns.tolist()
            if enc != primer_enc:
                errores.append(f"Encabezados de {t['archivo']} no coinciden con el primer tramo")

    df_reconstruido = pd.concat(
        [pd.read_csv(directorio / t["archivo"]) for t in tramos],
        ignore_index=True,
    )
    df_original = df_consolidado.sort_values(columnas_orden).reset_index(drop=True)
    if not df_reconstruido.equals(df_original):
        errores.append("La concatenacion de tramos no reproduce exactamente el archivo consolidado")

    return errores


def normalizar_clasificacion(valor: object) -> str:
    texto = str(valor or "").strip().lower()
    if texto == "otc":
        return "otc"
    if texto in {"receta", "generico"}:
        return texto
    return "receta" if texto in {"rx", "prescripcion", "prescripción"} else "otc"


def partir_concentracion(valor: object) -> tuple[str, str]:
    texto = str(valor or "").strip()
    if not texto:
        return "", ""
    match = re.match(r"^([0-9]+(?:[.,][0-9]+)?)(.*)$", texto)
    if not match:
        return "", ""
    numero = match.group(1).replace(",", ".")
    unidad = match.group(2).strip() or "mg"
    return numero, unidad


def construir_mapeos(productos: pd.DataFrame, boticas: pd.DataFrame, proveedores: pd.DataFrame, categorias: list[str]) -> dict[str, dict[str, str]]:
    productos_ordenados = productos.sort_values("codigo_interno").reset_index(drop=True)
    boticas_ordenadas = boticas.sort_values("codigo_interno").reset_index(drop=True)
    proveedores_ordenados = proveedores.sort_values("razon_social").reset_index(drop=True)

    boticas_venta = boticas_ordenadas[boticas_ordenadas["tipo"].astype(str).str.lower() == "botica"].reset_index(drop=True)
    droguerias = boticas_ordenadas[boticas_ordenadas["tipo"].astype(str).str.lower() == "drogueria"].reset_index(drop=True)

    return {
        "producto_id_a_codigo": {
            fila.id: f"SKU-{i + 1:03d}" for i, fila in productos_ordenados.iterrows()
        },
        "botica_id_a_codigo": {
            **({droguerias.iloc[0].id: "DROG-001"} if len(droguerias) else {}),
            **{fila.id: f"BOT-{i + 1:03d}" for i, fila in boticas_venta.iterrows()},
        },
        "proveedor_id_a_codigo": {
            fila.id: f"PROV-{i + 1:03d}" for i, fila in proveedores_ordenados.iterrows()
        },
        "categoria_a_codigo": {
            categoria: f"CAT-{i + 1:03d}" for i, categoria in enumerate(categorias)
        },
    }


def construir_categorias(features: pd.DataFrame, configuracion: pd.DataFrame, mape: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    categorias_features = set(features["categoria_terapeutica"].dropna().astype(str))
    categorias_config = list(configuracion["categoria_terapeutica"].dropna().astype(str))
    categorias_mape = set(mape["categoria_terapeutica"].dropna().astype(str))
    if categorias_features != set(categorias_config) or categorias_features != categorias_mape:
        raise ValueError("Las categorias no coinciden entre features_entrenamiento, configuracion_categoria y mape_por_categoria")

    filas = [
        {
            "codigo": f"CAT-{i + 1:03d}",
            "nombre": categoria,
            "descripcion": "Categoria terapeutica utilizada por el modelo oficial V4",
            "activo": "true",
        }
        for i, categoria in enumerate(categorias_config)
    ]
    return pd.DataFrame(filas), categorias_config


def construir_boticas(boticas: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    filas = []
    boticas_publicas = boticas[boticas["tipo"].astype(str).str.lower() == "botica"].copy()
    for _, fila in boticas_publicas.sort_values("codigo_interno").iterrows():
        codigo = mapeos["botica_id_a_codigo"].get(fila["id"])
        if not codigo:
            continue
        filas.append({
            "codigo_interno": codigo,
            "nombre": fila["nombre"],
            "tipo": str(fila["tipo"]).lower(),
            "ubigeo": str(fila["ubigeo"]).zfill(6),
            "direccion": fila.get("direccion", ""),
            "telefono": str(fila.get("telefono", "")),
    })
    return pd.DataFrame(filas)


def reducir_historico_por_serie(features: pd.DataFrame, modo: str, modos: dict[str, int | None]) -> pd.DataFrame:
    if modo not in modos:
        raise ValueError(f"Modo historico invalido: {modo}")
    semanas = modos[modo]
    if semanas == 0:
        return features.iloc[0:0].copy()
    if semanas is None:
        return features.copy()
    return (
        features.sort_values(["producto_id", "botica_id", "fecha_semana"])
        .groupby(["producto_id", "botica_id"], group_keys=False)
        .tail(semanas)
        .reset_index(drop=True)
    )


def construir_productos(productos: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    filas = []
    for _, fila in productos.sort_values("codigo_interno").iterrows():
        concentracion, unidad = partir_concentracion(fila.get("concentracion", ""))
        filas.append({
            "codigo_interno": mapeos["producto_id_a_codigo"][fila["id"]],
            "nombre_comercial": fila["nombre_comercial"],
            "codigo_categoria": mapeos["categoria_a_codigo"][fila["categoria_terapeutica"]],
            "forma_farmaceutica": fila.get("forma_farmaceutica", ""),
            "presentacion": "",
            "clasificacion": normalizar_clasificacion(fila.get("clasificacion")),
            "principio_activo": fila.get("principio_activo", ""),
            "concentracion": concentracion,
            "unidad_medida": unidad,
        })
    return pd.DataFrame(filas)


def construir_proveedores(proveedores: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    filas = []
    for _, fila in proveedores.sort_values("razon_social").iterrows():
        filas.append({
            "codigo_interno": mapeos["proveedor_id_a_codigo"][fila["id"]],
            "razon_social": fila["razon_social"],
            "tipo_identificacion": str(fila["tipo_identificacion"]).lower(),
            "numero_identificacion": str(fila["numero_identificacion"]),
            "pais_origen": fila.get("pais_origen", "PE") or "PE",
            "moneda": "PEN",
            "activo": "true" if bool(fila.get("activo", True)) else "false",
        })
    return pd.DataFrame(filas)


def construir_proveedor_producto(relaciones: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    filas = []
    for _, fila in relaciones.sort_values("producto_id").iterrows():
        filas.append({
            "codigo_proveedor": mapeos["proveedor_id_a_codigo"][fila["proveedor_id"]],
            "codigo_producto": mapeos["producto_id_a_codigo"][fila["producto_id"]],
            "lead_time_dias": int(fila["lead_time_dias"]),
            "precio_referencial": round(float(fila["precio_referencial"]), 2),
            "cantidad_minima_compra": int(fila.get("cantidad_minima_compra", 1)),
            "multiplo_empaque": 1,
            "activo": "true" if bool(fila.get("activo", True)) else "false",
        })
    return pd.DataFrame(filas).sort_values(["codigo_producto", "codigo_proveedor"]).reset_index(drop=True)


def construir_precios(precios: pd.DataFrame, boticas_import: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    boticas_venta = boticas_import[boticas_import["tipo"] == "botica"]["codigo_interno"].tolist()
    filas = []
    for _, precio in precios.sort_values("producto_id").iterrows():
        codigo_producto = mapeos["producto_id_a_codigo"][precio["producto_id"]]
        vigente_desde = pd.to_datetime(precio["vigente_desde"]).date().isoformat()
        vigente_hasta = "" if pd.isna(precio.get("vigente_hasta")) else pd.to_datetime(precio["vigente_hasta"]).date().isoformat()
        for codigo_botica in boticas_venta:
            filas.append({
                "codigo_producto": codigo_producto,
                "codigo_botica": codigo_botica,
                "precio_venta": round(float(precio["precio_venta"]), 2),
                "precio_costo": round(float(precio["precio_costo"]), 2),
                "vigente_desde": vigente_desde,
                "vigente_hasta": vigente_hasta,
            })
    return pd.DataFrame(filas)


def construir_stock_inicial(stock: pd.DataFrame, proveedor_producto: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    proveedor_por_producto = (
        proveedor_producto.sort_values(["lead_time_dias", "precio_referencial", "proveedor_id"])
        .drop_duplicates("producto_id")
        .set_index("producto_id")["proveedor_id"]
        .to_dict()
    )
    filas = []
    for _, fila in stock.sort_values(["producto_id", "ubicacion_id"]).iterrows():
        codigo_producto = mapeos["producto_id_a_codigo"][fila["producto_id"]]
        codigo_botica = mapeos["botica_id_a_codigo"].get(fila["ubicacion_id"])
        if not codigo_botica or codigo_botica.startswith("DROG"):
            continue
        proveedor_id = proveedor_por_producto[fila["producto_id"]]
        filas.append({
            "codigo_producto": codigo_producto,
            "codigo_botica": codigo_botica,
            "cantidad": int(max(0, fila["cantidad_disponible"])),
            "numero_lote": f"INI-{codigo_producto}-{codigo_botica}",
            "fecha_vencimiento": "2028-12-31",
            "codigo_proveedor": mapeos["proveedor_id_a_codigo"][proveedor_id],
            "estrategia": "reemplazar",
        })
    return pd.DataFrame(filas)


def construir_stock_historico(features: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    df = features.copy()
    return pd.DataFrame({
        "codigo_producto": df["producto_id"].map(mapeos["producto_id_a_codigo"]),
        "codigo_botica": df["botica_id"].map(mapeos["botica_id_a_codigo"]),
        "fecha_snapshot": pd.to_datetime(df["fecha_semana"]).dt.date.astype(str),
        "cantidad_disponible": df["stock_inicio_semana"].round().astype(int),
        "stock_minimo": df["stock_minimo"].round().astype(int),
        "stock_maximo": df["stock_maximo"].round().astype(int),
        "demanda_insatisfecha": df["demanda_insatisfecha"].round().astype(int),
        "stockout_flag": df["stockout_flag"].round().astype(int),
    })


def construir_ventas_historicas(features: pd.DataFrame, precios_import: pd.DataFrame, mapeos: dict[str, dict[str, str]]) -> pd.DataFrame:
    df = features.copy()
    df["codigo_producto"] = df["producto_id"].map(mapeos["producto_id_a_codigo"])
    df["codigo_botica"] = df["botica_id"].map(mapeos["botica_id_a_codigo"])
    df = df[df["cantidad_vendida"] > 0].copy()
    precios = precios_import.drop_duplicates(["codigo_producto", "codigo_botica"]).set_index(["codigo_producto", "codigo_botica"])["precio_venta"]
    df["precio_unitario"] = [precios.loc[(p, b)] for p, b in zip(df["codigo_producto"], df["codigo_botica"])]
    return pd.DataFrame({
        "codigo_producto": df["codigo_producto"],
        "codigo_botica": df["codigo_botica"],
        "fecha_venta": pd.to_datetime(df["fecha_semana"]).dt.date.astype(str),
        "cantidad": df["cantidad_vendida"].round().astype(int),
        "precio_unitario": df["precio_unitario"].round(2),
    })


def detectar_uuid_publicos(dataframes: dict[str, pd.DataFrame]) -> dict[str, int]:
    resultado = {}
    for nombre, df in dataframes.items():
        texto = df.astype(str).to_csv(index=False)
        resultado[nombre] = len(UUID_RE.findall(texto))
    return resultado


def validar_paquete(
    dataframes: dict[str, pd.DataFrame],
    features: pd.DataFrame,
    mapeos: dict[str, dict[str, str]],
    ventas_modo: str,
    stock_modo: str,
) -> dict:
    errores: list[str] = []
    advertencias: list[str] = []

    conteos = {nombre: len(df) for nombre, df in dataframes.items()}
    uuid_publicos = detectar_uuid_publicos(dataframes)

    def esperar(nombre: str, valor: int, esperado: int) -> None:
        if valor != esperado:
            errores.append(f"{nombre}: esperado {esperado}, obtenido {valor}")

    esperar("categorias", conteos["categorias_terapeuticas"], 14)
    esperar("productos", conteos["productos"], 30)
    esperar("boticas", conteos["boticas"], 5)
    esperar("boticas_venta", int((dataframes["boticas"]["tipo"] == "botica").sum()), 5)
    esperar("drogueria", int((dataframes["boticas"]["tipo"] == "drogueria").sum()), 0)
    esperar("proveedores", conteos["proveedores"], 5)
    if conteos["proveedor_producto"] < 30:
        errores.append("proveedor_producto: menos de 30 relaciones")
    esperar("precios", conteos["precios"], 150)
    features_ventas = reducir_historico_por_serie(features, ventas_modo, MODOS_VENTAS)
    features_stock = reducir_historico_por_serie(features, stock_modo, MODOS_STOCK)

    if stock_modo != "none":
        esperar("stock_historico", conteos["stock_historico"], len(features_stock))
    else:
        esperar("stock_historico", conteos["stock_historico"], 0)

    series = features[["producto_id", "botica_id"]].drop_duplicates()
    esperar("series", len(series), 150)
    esperar("semanas", features["fecha_semana"].nunique(), 123)
    esperar("observaciones_semanales", len(features), 18450)

    claves = {
        "categorias_terapeuticas": ["codigo"],
        "boticas": ["codigo_interno"],
        "productos": ["codigo_interno"],
        "proveedores": ["codigo_interno"],
        "proveedor_producto": ["codigo_proveedor", "codigo_producto"],
        "precios": ["codigo_producto", "codigo_botica", "vigente_desde"],
        "stock_inicial": ["codigo_producto", "codigo_botica", "numero_lote"],
        "stock_historico": ["codigo_producto", "codigo_botica", "fecha_snapshot"],
        "ventas_historicas": ["codigo_producto", "codigo_botica", "fecha_venta", "cantidad", "precio_unitario"],
    }
    duplicados = {}
    for nombre, cols in claves.items():
        duplicados[nombre] = int(dataframes[nombre].duplicated(cols).sum())
        if duplicados[nombre] > 0:
            errores.append(f"{nombre}: {duplicados[nombre]} duplicados por clave logica")

    codigos_categoria = set(dataframes["categorias_terapeuticas"]["codigo"])
    codigos_producto = set(dataframes["productos"]["codigo_interno"])
    codigos_botica = set(dataframes["boticas"]["codigo_interno"])
    codigos_proveedor = set(dataframes["proveedores"]["codigo_interno"])

    categorias_inexistentes = int((~dataframes["productos"]["codigo_categoria"].isin(codigos_categoria)).sum())
    productos_sin_categoria = int(dataframes["productos"]["codigo_categoria"].isna().sum() + (dataframes["productos"]["codigo_categoria"].astype(str).str.len() == 0).sum())
    productos_inexistentes = sum(int((~df["codigo_producto"].isin(codigos_producto)).sum()) for df in [dataframes["proveedor_producto"], dataframes["precios"], dataframes["stock_inicial"], dataframes["stock_historico"], dataframes["ventas_historicas"]])
    boticas_inexistentes = sum(int((~df["codigo_botica"].isin(codigos_botica)).sum()) for df in [dataframes["precios"], dataframes["stock_inicial"], dataframes["stock_historico"], dataframes["ventas_historicas"]])
    proveedores_inexistentes = int((~dataframes["proveedor_producto"]["codigo_proveedor"].isin(codigos_proveedor)).sum() + (~dataframes["stock_inicial"]["codigo_proveedor"].isin(codigos_proveedor)).sum())

    for nombre, valor in {
        "categorias_inexistentes": categorias_inexistentes,
        "productos_sin_categoria": productos_sin_categoria,
        "productos_inexistentes": productos_inexistentes,
        "boticas_inexistentes": boticas_inexistentes,
        "proveedores_inexistentes": proveedores_inexistentes,
        "uuid_publicos_total": sum(uuid_publicos.values()),
    }.items():
        if valor != 0:
            errores.append(f"{nombre}: {valor}")

    negativos = {
        "precios_negativos": int(((dataframes["precios"][["precio_venta", "precio_costo"]].astype(float) < 0).any(axis=1)).sum()),
        "stocks_negativos": int((dataframes["stock_historico"][["cantidad_disponible", "stock_minimo", "stock_maximo", "demanda_insatisfecha"]].astype(float) < 0).any(axis=1).sum() + (dataframes["stock_inicial"]["cantidad"].astype(float) < 0).sum()),
    }
    for nombre, valor in negativos.items():
        if valor:
            errores.append(f"{nombre}: {valor}")

    base = features.copy()
    base["codigo_producto"] = base["producto_id"].map(mapeos["producto_id_a_codigo"])
    base["codigo_botica"] = base["botica_id"].map(mapeos["botica_id_a_codigo"])
    base["fecha_semana"] = pd.to_datetime(base["fecha_semana"])

    base_ventas = features_ventas.copy()
    base_ventas["codigo_producto"] = base_ventas["producto_id"].map(mapeos["producto_id_a_codigo"])
    base_ventas["codigo_botica"] = base_ventas["botica_id"].map(mapeos["botica_id_a_codigo"])
    base_ventas["fecha_semana"] = pd.to_datetime(base_ventas["fecha_semana"])

    ventas = dataframes["ventas_historicas"].copy()
    ventas["fecha_semana"] = pd.to_datetime(ventas["fecha_venta"])
    ventas_recon = ventas.groupby(["codigo_producto", "codigo_botica", "fecha_semana"], as_index=False)["cantidad"].sum()
    comparacion = base_ventas[["codigo_producto", "codigo_botica", "fecha_semana", "cantidad_vendida"]].merge(
        ventas_recon,
        on=["codigo_producto", "codigo_botica", "fecha_semana"],
        how="left",
    )
    comparacion["cantidad"] = comparacion["cantidad"].fillna(0)
    comparacion["dif"] = (comparacion["cantidad_vendida"] - comparacion["cantidad"]).abs()

    metricas_stock = {
        "diferencia_maxima_stock_inicio_semana": 0.0,
        "diferencia_maxima_stock_minimo_oficial": 0.0,
        "diferencia_maxima_stock_maximo_oficial": 0.0,
        "diferencia_maxima_demanda_insatisfecha_oficial": 0.0,
        "diferencia_maxima_stockout_flag_oficial": 0.0,
    }
    if stock_modo != "none" and not dataframes["stock_historico"].empty:
        base_stock = features_stock.copy()
        base_stock["codigo_producto"] = base_stock["producto_id"].map(mapeos["producto_id_a_codigo"])
        base_stock["codigo_botica"] = base_stock["botica_id"].map(mapeos["botica_id_a_codigo"])
        base_stock["fecha_semana"] = pd.to_datetime(base_stock["fecha_semana"])
        stock = dataframes["stock_historico"].copy()
        stock["fecha_semana"] = pd.to_datetime(stock["fecha_snapshot"])
        stock_comp = base_stock.merge(
            stock,
            on=["codigo_producto", "codigo_botica", "fecha_semana"],
            how="left",
            suffixes=("_oficial", "_paquete"),
        )
        for origen, destino in [
            ("stock_inicio_semana", "cantidad_disponible"),
            ("stock_minimo_oficial", "stock_minimo_paquete"),
            ("stock_maximo_oficial", "stock_maximo_paquete"),
            ("demanda_insatisfecha_oficial", "demanda_insatisfecha_paquete"),
            ("stockout_flag_oficial", "stockout_flag_paquete"),
        ]:
            metricas_stock[f"diferencia_maxima_{origen}"] = float((stock_comp[origen] - stock_comp[destino]).abs().max())

    consistencia_demanda = {
        "diferencia_maxima_cantidad_vendida": float(comparacion["dif"].max()),
        "filas_diferentes": int((comparacion["dif"] != 0).sum()),
        "series_diferentes": int(comparacion.loc[comparacion["dif"] != 0, ["codigo_producto", "codigo_botica"]].drop_duplicates().shape[0]),
        "semanas_diferentes": int(comparacion.loc[comparacion["dif"] != 0, "fecha_semana"].nunique()),
    }
    if consistencia_demanda["diferencia_maxima_cantidad_vendida"] != 0:
        errores.append("La demanda semanal reconstruida no coincide con features_entrenamiento.csv")
    if any(valor != 0 for valor in metricas_stock.values()):
        errores.append("El stock historico reconstruido no coincide con features_entrenamiento.csv")

    return {
        "valido": not errores,
        "errores": errores,
        "advertencias": advertencias,
        "conteos": conteos,
        "uuid_publicos": uuid_publicos,
        "duplicados": duplicados,
        "relaciones_invalidas": {
            "categorias_inexistentes": categorias_inexistentes,
            "productos_sin_categoria": productos_sin_categoria,
            "productos_inexistentes": productos_inexistentes,
            "boticas_inexistentes": boticas_inexistentes,
            "proveedores_inexistentes": proveedores_inexistentes,
        },
        "negativos": negativos,
        "consistencia_demanda": consistencia_demanda,
        "consistencia_stock": metricas_stock,
        "ventas": {
            "modo": ventas_modo,
            "filas_semana_total": int(len(features_ventas)),
            "filas_ventas_positivas": int(conteos["ventas_historicas"]),
            "filas_cero_omitidas": int(len(features_ventas) - conteos["ventas_historicas"]),
        },
        "stock_historico": {
            "modo": stock_modo,
            "filas_semana_total": int(len(features_stock)),
            "filas_generadas": int(conteos["stock_historico"]),
        },
        "series": {
            "productos": int(features["producto_id"].nunique()),
            "boticas_venta": int(features["botica_id"].nunique()),
            "series": int(series.shape[0]),
            "semanas": int(features["fecha_semana"].nunique()),
            "observaciones": int(len(features)),
        },
    }


def generar(
    overwrite: bool,
    validate_only: bool,
    ventas_historicas: str = "52w",
    stock_historico: str = "4w",
    tamano_lote: int = 500,
    dividir_historicos: bool = False,
) -> dict:
    features = leer_csv(DIR_DATOS / "features_entrenamiento.csv", parse_dates=["fecha_semana"])
    productos = leer_csv(DIR_DATOS / "productos.csv")
    boticas = leer_csv(DIR_DATOS / "boticas.csv")
    proveedores = leer_csv(DIR_DATOS / "proveedores.csv")
    proveedor_producto = leer_csv(DIR_DATOS / "proveedor_producto.csv")
    precios = leer_csv(DIR_DATOS / "precios.csv")
    stock_ubicaciones = leer_csv(DIR_DATOS / "stock_ubicaciones.csv")
    configuracion = leer_csv(DIR_MODELO / "configuracion_categoria.csv")
    mape = leer_csv(DIR_MODELO / "mape_por_categoria.csv")

    categorias_df, categorias = construir_categorias(features, configuracion, mape)
    mapeos = construir_mapeos(productos, boticas, proveedores, categorias)

    dataframes = {
        "categorias_terapeuticas": categorias_df,
        "boticas": construir_boticas(boticas, mapeos),
        "productos": construir_productos(productos, mapeos),
        "proveedores": construir_proveedores(proveedores, mapeos),
    }
    dataframes["proveedor_producto"] = construir_proveedor_producto(proveedor_producto, mapeos)
    dataframes["precios"] = construir_precios(precios, dataframes["boticas"], mapeos)
    dataframes["stock_inicial"] = construir_stock_inicial(stock_ubicaciones, proveedor_producto, mapeos)
    features_ventas = reducir_historico_por_serie(features, ventas_historicas, MODOS_VENTAS)
    features_stock = reducir_historico_por_serie(features, stock_historico, MODOS_STOCK)
    dataframes["stock_historico"] = construir_stock_historico(features_stock, mapeos)
    dataframes["ventas_historicas"] = construir_ventas_historicas(features_ventas, dataframes["precios"], mapeos)

    validacion = validar_paquete(dataframes, features, mapeos, ventas_historicas, stock_historico)

    existentes = [DIR_SALIDA / nombre for nombre in [*ARCHIVOS_CSV.values(), "manifiesto_importacion.json", "reporte_validacion_paquete.json"] if (DIR_SALIDA / nombre).exists()]
    if existentes and not overwrite and not validate_only:
        rutas = "\n".join(str(ruta) for ruta in existentes)
        raise FileExistsError(f"Ya existen archivos de salida. Usa --overwrite para reemplazar:\n{rutas}")

    if validate_only:
        return validacion

    DIR_SALIDA.mkdir(parents=True, exist_ok=True)
    for nombre, archivo in ARCHIVOS_CSV.items():
        escribir_csv(dataframes[nombre], DIR_SALIDA / archivo)

    tramos_stock: list[dict] = []
    tramos_ventas: list[dict] = []
    errores_division: list[str] = []

    if dividir_historicos:
        dir_stock = DIR_SALIDA / "stock_historico"
        dir_ventas = DIR_SALIDA / "ventas_historicas"

        tramos_stock = dividir_dataframe_csv(
            dataframes["stock_historico"],
            dir_stock,
            "stock_historico",
            tamano_lote,
            col_fecha="fecha_snapshot",
            columnas_orden=["fecha_snapshot", "codigo_botica", "codigo_producto"],
        )
        tramos_ventas = dividir_dataframe_csv(
            dataframes["ventas_historicas"],
            dir_ventas,
            "ventas_historicas",
            tamano_lote,
            col_fecha="fecha_venta",
            columnas_orden=["fecha_venta", "codigo_botica", "codigo_producto"],
        )

        errores_division.extend(
            validar_division(
                dataframes["stock_historico"],
                tramos_stock,
                dir_stock,
                tamano_lote,
                ["fecha_snapshot", "codigo_botica", "codigo_producto"],
            )
        )
        errores_division.extend(
            validar_division(
                dataframes["ventas_historicas"],
                tramos_ventas,
                dir_ventas,
                tamano_lote,
                ["fecha_venta", "codigo_botica", "codigo_producto"],
            )
        )

        orden_json = {
            "stock_historico": [f"stock_historico/{t['archivo']}" for t in tramos_stock],
            "ventas_historicas": [f"ventas_historicas/{t['archivo']}" for t in tramos_ventas],
        }
        (DIR_SALIDA / "orden_importacion_historicos.json").write_text(
            json.dumps(orden_json, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    hashes = {archivo: sha256(DIR_SALIDA / archivo) for archivo in ARCHIVOS_CSV.values()}
    manifiesto = {
        "version_paquete": "1.0.0",
        "fuente": "dataset_sintetico_oficial_v4",
        "fecha_generacion": datetime.now(timezone.utc).isoformat(),
        "orden_importacion": ORDEN_IMPORTACION,
        "conteos": validacion["conteos"],
        "ventas_historicas_modo": ventas_historicas,
        "ventas_historicas_semanas": MODOS_VENTAS[ventas_historicas],
        "ventas_historicas_fecha_desde": None if features_ventas.empty else pd.to_datetime(features_ventas["fecha_semana"]).min().date().isoformat(),
        "ventas_historicas_fecha_hasta": None if features_ventas.empty else pd.to_datetime(features_ventas["fecha_semana"]).max().date().isoformat(),
        "ventas_historicas_filas_generadas": int(validacion["conteos"]["ventas_historicas"]),
        "ventas_historicas_filas_cero_omitidas": int(validacion["ventas"]["filas_cero_omitidas"]),
        "stock_historico_modo": stock_historico,
        "stock_historico_semanas": MODOS_STOCK[stock_historico],
        "stock_historico_fecha_desde": None if features_stock.empty else pd.to_datetime(features_stock["fecha_semana"]).min().date().isoformat(),
        "stock_historico_fecha_hasta": None if features_stock.empty else pd.to_datetime(features_stock["fecha_semana"]).max().date().isoformat(),
        "stock_historico_filas_generadas": int(validacion["conteos"]["stock_historico"]),
        "tamano_lote": tamano_lote,
        "historicos_divididos": dividir_historicos,
        "ventas_historicas_total_filas": int(validacion["conteos"]["ventas_historicas"]),
        "ventas_historicas_total_tramos": len(tramos_ventas),
        "stock_historico_total_filas": int(validacion["conteos"]["stock_historico"]),
        "stock_historico_total_tramos": len(tramos_stock),
        "archivos_ventas_historicas": tramos_ventas,
        "archivos_stock_historico": tramos_stock,
        "errores_division": errores_division,
        "afecta_resultados_paper": False,
        "nota": "La reduccion se aplica unicamente al paquete operativo para Supabase. Los artefactos oficiales V4 permanecen intactos."
        + (" No importar el archivo consolidado y los tramos al mismo tiempo." if dividir_historicos else ""),
        "hashes_sha256": hashes,
        "modelo_referencia": "v1.0.0",
        "metricas_referencia": {
            "xgboost_macro_mape": 12.788940737964031,
            "sarima_macro_mape": 12.85781441965303,
            "sarima_xgboost_macro_mape": 12.349016982065416,
        },
    }
    (DIR_SALIDA / "manifiesto_importacion.json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    validacion["errores"].extend(errores_division)
    validacion["valido"] = validacion["valido"] and not errores_division
    (DIR_SALIDA / "reporte_validacion_paquete.json").write_text(json.dumps(validacion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {**validacion, "hashes_sha256": hashes, "tramos_stock": tramos_stock, "tramos_ventas": tramos_ventas}


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera paquete CSV para importacion relacional en plataforma Supabase.")
    parser.add_argument("--overwrite", action="store_true", help="Reemplaza archivos existentes en data/importacion_plataforma")
    parser.add_argument("--validate-only", action="store_true", help="Valida fuentes y paquete en memoria sin escribir archivos")
    parser.add_argument("--ventas-historicas", choices=MODOS_VENTAS.keys(), default="52w", help="Ventana de ventas historicas exportada al paquete Supabase")
    parser.add_argument("--stock-historico", choices=MODOS_STOCK.keys(), default="4w", help="Ventana de stock historico exportada al paquete Supabase")
    parser.add_argument("--tamano-lote", type=int, default=500, help="Maximo filas por tramo al dividir historicos")
    parser.add_argument("--dividir-historicos", action="store_true", help="Divide stock_historico y ventas_historicas en subdirectorios con tramos")
    args = parser.parse_args()

    if args.tamano_lote <= 0:
        print("ERROR: --tamano-lote debe ser > 0", file=sys.stderr)
        return 1

    try:
        resultado = generar(
            overwrite=args.overwrite,
            validate_only=args.validate_only,
            ventas_historicas=args.ventas_historicas,
            stock_historico=args.stock_historico,
            tamano_lote=args.tamano_lote,
            dividir_historicos=args.dividir_historicos,
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    resumen = {
        "valido": resultado.get("valido", False),
        "conteos": resultado.get("conteos", {}),
        "errores": resultado.get("errores", []),
        "salida": None if args.validate_only else str(DIR_SALIDA),
        "tramos_stock": len(resultado.get("tramos_stock", [])),
        "tramos_ventas": len(resultado.get("tramos_ventas", [])),
    }
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    return 0 if resultado.get("valido", False) else 2


if __name__ == "__main__":
    raise SystemExit(main())
