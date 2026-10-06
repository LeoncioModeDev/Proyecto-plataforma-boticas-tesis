from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd


RAIZ = Path(__file__).resolve().parents[1]
DIR_BASE = RAIZ / "data" / "importacion_plataforma"
DIR_SALIDA = RAIZ / "data" / "importacion_plataforma_incremental_20260620"

FECHA_INICIO_NUEVAS = pd.Timestamp("2025-05-12")
FECHA_PRIMERA_FALTANTE = pd.Timestamp("2026-05-11")
FECHA_CORTE = pd.Timestamp("2026-06-20")
FECHA_ULTIMA_SEMANA = pd.Timestamp("2026-06-15")
TAMANO_LOTE = 200

BOTICAS_NUEVAS = [
    ("BOT-006", "Botica D&R Jesús María", "150113", "Av. Brasil 1250", "014201007"),
    ("BOT-007", "Botica D&R Pueblo Libre", "150121", "Av. Bolívar 940", "014201008"),
    ("BOT-008", "Botica D&R Magdalena", "150120", "Av. Javier Prado Oeste 610", "014201009"),
    ("BOT-009", "Botica D&R Lince", "150116", "Av. Arenales 1800", "014201010"),
    ("BOT-010", "Botica D&R Barranco", "150104", "Av. Grau 310", "014201011"),
    ("BOT-011", "Botica D&R Chorrillos", "150108", "Av. Defensores del Morro 860", "014201012"),
    ("BOT-012", "Botica D&R San Isidro", "150131", "Av. Conquistadores 420", "014201013"),
    ("BOT-013", "Botica D&R Breña", "150105", "Av. Venezuela 1320", "014201014"),
    ("BOT-014", "Botica D&R Cercado", "150101", "Jr. De la Unión 780", "014201015"),
    ("BOT-015", "Botica D&R Ate", "150103", "Av. Nicolás Ayllón 4200", "014201016"),
    ("BOT-016", "Botica D&R Santa Anita", "150137", "Av. Los Ruiseñores 710", "014201017"),
    ("BOT-017", "Botica D&R Los Olivos", "150117", "Av. Carlos Izaguirre 980", "014201018"),
    ("BOT-018", "Botica D&R Comas", "150110", "Av. Túpac Amaru 2450", "014201019"),
    ("BOT-019", "Botica D&R San Juan de Lurigancho", "150132", "Av. Próceres 1800", "014201020"),
    ("BOT-020", "Botica D&R Villa El Salvador", "150142", "Av. Revolución 990", "014201021"),
    ("BOT-021", "Botica D&R Villa María", "150143", "Av. Pachacútec 1450", "014201022"),
    ("BOT-022", "Botica D&R Rímac", "150128", "Av. Alcázar 560", "014201023"),
]


def leer_csv(nombre: str, **kwargs) -> pd.DataFrame:
    ruta = DIR_BASE / nombre
    if not ruta.exists():
        raise FileNotFoundError(f"No existe fuente requerida: {ruta}")
    return pd.read_csv(ruta, **kwargs)


def escribir_csv(df: pd.DataFrame, ruta: Path) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(ruta, index=False, encoding="utf-8", lineterminator="\n")


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1024 * 1024), b""):
            h.update(bloque)
    return h.hexdigest()


def dividir(df: pd.DataFrame, subdir: str, prefijo: str, col_fecha: str, columnas_orden: list[str]) -> list[dict]:
    directorio = DIR_SALIDA / subdir
    directorio.mkdir(parents=True, exist_ok=True)
    for archivo in directorio.glob(f"{prefijo}_*.csv"):
        archivo.unlink()

    tramos = []
    df_ordenado = df.sort_values(columnas_orden).reset_index(drop=True)
    for inicio in range(0, len(df_ordenado), TAMANO_LOTE):
        numero = inicio // TAMANO_LOTE + 1
        tramo = df_ordenado.iloc[inicio : inicio + TAMANO_LOTE].copy()
        nombre = f"{prefijo}_{numero:03d}.csv"
        ruta = directorio / nombre
        escribir_csv(tramo, ruta)
        fechas = pd.to_datetime(tramo[col_fecha])
        tramos.append({
            "archivo": f"{subdir}/{nombre}",
            "numero_tramo": numero,
            "fila_desde": inicio + 1,
            "fila_hasta": inicio + len(tramo),
            "cantidad_filas": len(tramo),
            "fecha_minima": str(fechas.min().date()),
            "fecha_maxima": str(fechas.max().date()),
            "sha256": sha256(ruta),
        })
    return tramos


def factor_botica(codigo_botica: str) -> float:
    numero = int(codigo_botica.split("-")[1])
    return 0.82 + (numero % 7) * 0.065 + (numero // 7) * 0.025


def demanda_sintetica(base: float, fecha: pd.Timestamp, codigo_producto: str, codigo_botica: str) -> int:
    semana = int(fecha.isocalendar().week)
    producto = int(codigo_producto.split("-")[1])
    botica = int(codigo_botica.split("-")[1])
    estacional = 1 + 0.18 * np.sin(2 * np.pi * semana / 52) + 0.07 * np.cos(2 * np.pi * (semana + producto) / 13)
    invierno = 1.14 if fecha.month in (6, 7, 8) and producto % 5 in (0, 2) else 1.0
    variacion = 1 + (((producto * 17 + botica * 11 + semana * 5) % 13) - 6) / 100
    cantidad = max(0, round(float(base) * factor_botica(codigo_botica) * estacional * invierno * variacion))
    if (producto + botica + semana) % 31 == 0:
        return 0
    return int(cantidad)


def construir_boticas() -> pd.DataFrame:
    return pd.DataFrame([
        {
            "codigo_interno": codigo,
            "nombre": nombre,
            "tipo": "botica",
            "ubigeo": ubigeo,
            "direccion": direccion,
            "telefono": telefono,
        }
        for codigo, nombre, ubigeo, direccion, telefono in BOTICAS_NUEVAS
    ])


def construir_precios(precios_base: pd.DataFrame, productos: list[str]) -> pd.DataFrame:
    base = precios_base.sort_values(["codigo_producto", "codigo_botica"]).drop_duplicates("codigo_producto").set_index("codigo_producto")
    filas = []
    for producto in productos:
        precio = base.loc[producto]
        for codigo, *_ in BOTICAS_NUEVAS:
            ajuste = 1 + ((int(codigo.split("-")[1]) % 5) - 2) * 0.015
            filas.append({
                "codigo_producto": producto,
                "codigo_botica": codigo,
                "precio_venta": round(float(precio["precio_venta"]) * ajuste, 2),
                "precio_costo": round(float(precio["precio_costo"]), 2),
                "vigente_desde": "2024-01-01",
                "vigente_hasta": "",
            })
    return pd.DataFrame(filas)


def preparar_bases(ventas_base: pd.DataFrame, stock_base: pd.DataFrame) -> tuple[dict, dict]:
    ventas_base = ventas_base.copy()
    ventas_base["fecha_venta"] = pd.to_datetime(ventas_base["fecha_venta"])
    promedio_producto = ventas_base.groupby("codigo_producto")["cantidad"].mean().to_dict()
    promedio_serie = ventas_base.groupby(["codigo_producto", "codigo_botica"])["cantidad"].tail(8).groupby([ventas_base["codigo_producto"], ventas_base["codigo_botica"]]).mean().to_dict()

    stock_base = stock_base.copy()
    stock_base["fecha_snapshot"] = pd.to_datetime(stock_base["fecha_snapshot"])
    stock_ref = (
        stock_base.sort_values("fecha_snapshot")
        .groupby("codigo_producto")[["stock_minimo", "stock_maximo", "cantidad_disponible"]]
        .median()
        .to_dict("index")
    )
    return {"producto": promedio_producto, "serie": promedio_serie}, stock_ref


def construir_historicos(ventas_base: pd.DataFrame, stock_base: pd.DataFrame, precios: pd.DataFrame, productos: list[str], boticas_existentes: list[str]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    bases_demanda, stock_ref = preparar_bases(ventas_base, stock_base)
    precio_map = precios.drop_duplicates(["codigo_producto", "codigo_botica"]).set_index(["codigo_producto", "codigo_botica"])["precio_venta"].to_dict()
    semanas_nuevas = pd.date_range(FECHA_INICIO_NUEVAS, FECHA_ULTIMA_SEMANA, freq="W-MON")
    semanas_faltantes = pd.date_range(FECHA_PRIMERA_FALTANTE, FECHA_ULTIMA_SEMANA, freq="W-MON")

    filas_ventas = []
    filas_stock = []
    stock_actual = {}

    def agregar_serie(codigo_botica: str, semanas: pd.DatetimeIndex, es_nueva: bool) -> None:
        for producto in productos:
            ref = stock_ref.get(producto, {})
            minimo = int(round(float(ref.get("stock_minimo", 30))))
            maximo = int(round(float(ref.get("stock_maximo", max(minimo * 4, 120)))))
            stock = int(round(float(ref.get("cantidad_disponible", maximo * 0.72)) * factor_botica(codigo_botica)))
            stock = max(minimo, min(maximo + minimo, stock))
            for fecha in semanas:
                base = bases_demanda["producto"].get(producto, 8.0)
                if not es_nueva:
                    base = bases_demanda["serie"].get((producto, codigo_botica), base)
                cantidad = demanda_sintetica(base, fecha, producto, codigo_botica)
                stock = max(0, stock - cantidad)
                if stock < minimo:
                    stock += maximo - minimo
                stockout = 1 if stock <= minimo * 0.35 else 0
                demanda_insatisfecha = max(0, cantidad - stock) if stockout else 0
                filas_stock.append({
                    "codigo_producto": producto,
                    "codigo_botica": codigo_botica,
                    "fecha_snapshot": fecha.date().isoformat(),
                    "cantidad_disponible": int(stock),
                    "stock_minimo": minimo,
                    "stock_maximo": maximo,
                    "demanda_insatisfecha": int(demanda_insatisfecha),
                    "stockout_flag": stockout,
                })
                if cantidad > 0:
                    precio = precio_map.get((producto, codigo_botica)) or precio_map.get((producto, "BOT-001")) or 1.0
                    filas_ventas.append({
                        "codigo_producto": producto,
                        "codigo_botica": codigo_botica,
                        "fecha_venta": fecha.date().isoformat(),
                        "cantidad": int(cantidad),
                        "precio_unitario": round(float(precio), 2),
                    })
            stock_actual[(producto, codigo_botica)] = (stock, minimo, maximo)

    for codigo, *_ in BOTICAS_NUEVAS:
        agregar_serie(codigo, semanas_nuevas, True)
    for codigo in boticas_existentes:
        agregar_serie(codigo, semanas_faltantes, False)

    filas_stock_inicial = []
    proveedor_producto = leer_csv("05_proveedor_producto.csv")
    proveedor_map = proveedor_producto.drop_duplicates("codigo_producto").set_index("codigo_producto")["codigo_proveedor"].to_dict()
    for (producto, botica), (stock, minimo, maximo) in stock_actual.items():
        if botica not in {codigo for codigo, *_ in BOTICAS_NUEVAS}:
            continue
        filas_stock_inicial.append({
            "codigo_producto": producto,
            "codigo_botica": botica,
            "cantidad": int(stock),
            "numero_lote": f"INC-{producto}-{botica}",
            "fecha_vencimiento": "2028-12-31",
            "codigo_proveedor": proveedor_map.get(producto, "PROV-001"),
            "estrategia": "reemplazar",
            "stock_minimo": int(minimo),
            "stock_maximo": int(maximo),
        })

    return pd.DataFrame(filas_ventas), pd.DataFrame(filas_stock), pd.DataFrame(filas_stock_inicial)


def validar(dataframes: dict[str, pd.DataFrame]) -> dict:
    duplicados = {
        "boticas": int(dataframes["boticas"].duplicated(["codigo_interno"]).sum()),
        "precios": int(dataframes["precios"].duplicated(["codigo_producto", "codigo_botica", "vigente_desde"]).sum()),
        "stock_inicial": int(dataframes["stock_inicial"].duplicated(["codigo_producto", "codigo_botica", "numero_lote"]).sum()),
        "stock_historico": int(dataframes["stock_historico"].duplicated(["codigo_producto", "codigo_botica", "fecha_snapshot"]).sum()),
        "ventas_historicas": int(dataframes["ventas_historicas"].duplicated(["codigo_producto", "codigo_botica", "fecha_venta"]).sum()),
    }
    errores = [f"{nombre}: {valor} duplicados" for nombre, valor in duplicados.items() if valor]
    if dataframes["boticas"]["codigo_interno"].nunique() != 17:
        errores.append("boticas: no se generaron 17 boticas nuevas")
    if dataframes["stock_historico"]["fecha_snapshot"].max() != FECHA_ULTIMA_SEMANA.date().isoformat():
        errores.append("stock_historico: fecha final inesperada")
    if dataframes["ventas_historicas"]["fecha_venta"].max() != FECHA_ULTIMA_SEMANA.date().isoformat():
        errores.append("ventas_historicas: fecha final inesperada")
    return {
        "valido": not errores,
        "errores": errores,
        "duplicados": duplicados,
        "conteos": {nombre: int(len(df)) for nombre, df in dataframes.items()},
        "fecha_corte_solicitada": FECHA_CORTE.date().isoformat(),
        "fecha_ultima_semana_generada": FECHA_ULTIMA_SEMANA.date().isoformat(),
    }


def generar() -> dict:
    productos = leer_csv("03_productos.csv")["codigo_interno"].tolist()
    boticas_existentes = leer_csv("02_boticas.csv")["codigo_interno"].tolist()
    ventas_base = leer_csv("09_ventas_historicas.csv")
    stock_base = leer_csv("08_stock_historico.csv")
    precios_base = leer_csv("06_precios.csv")

    boticas = construir_boticas()
    precios = construir_precios(precios_base, productos)
    precios_completos = pd.concat([precios_base, precios], ignore_index=True)
    ventas, stock, stock_inicial = construir_historicos(ventas_base, stock_base, precios_completos, productos, boticas_existentes)

    dataframes = {
        "boticas": boticas,
        "precios": precios,
        "stock_inicial": stock_inicial,
        "stock_historico": stock,
        "ventas_historicas": ventas,
    }
    validacion = validar(dataframes)
    if not validacion["valido"]:
        return validacion

    if DIR_SALIDA.exists():
        shutil.rmtree(DIR_SALIDA)
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)

    archivos = {
        "02_boticas.csv": boticas,
        "06_precios.csv": precios,
        "07_stock_inicial.csv": stock_inicial,
        "08_stock_historico.csv": stock,
        "09_ventas_historicas.csv": ventas,
    }
    for nombre, df in archivos.items():
        escribir_csv(df, DIR_SALIDA / nombre)

    tramos_stock = dividir(stock, "stock_historico", "stock_historico", "fecha_snapshot", ["fecha_snapshot", "codigo_botica", "codigo_producto"])
    tramos_ventas = dividir(ventas, "ventas_historicas", "ventas_historicas", "fecha_venta", ["fecha_venta", "codigo_botica", "codigo_producto"])
    (DIR_SALIDA / "orden_importacion_historicos.json").write_text(
        json.dumps({"stock_historico": [t["archivo"] for t in tramos_stock], "ventas_historicas": [t["archivo"] for t in tramos_ventas]}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    hashes = {nombre: sha256(DIR_SALIDA / nombre) for nombre in archivos}
    manifiesto = {
        "version_paquete": "1.0.0-incremental",
        "fuente": "dataset_sintetico_incremental_20260620",
        "fecha_generacion": datetime.now(timezone.utc).isoformat(),
        "carpeta_base_no_modificada": str(DIR_BASE.relative_to(RAIZ)),
        "fecha_corte_solicitada": FECHA_CORTE.date().isoformat(),
        "fecha_ultima_semana_generada": FECHA_ULTIMA_SEMANA.date().isoformat(),
        "boticas_nuevas": 17,
        "boticas_totales_esperadas_post_importacion": 22,
        "productos": len(productos),
        "proveedores_existentes_reutilizados": 5,
        "conteos": validacion["conteos"],
        "historicos_divididos": True,
        "archivos_stock_historico": tramos_stock,
        "archivos_ventas_historicas": tramos_ventas,
        "hashes_sha256": hashes,
        "nota": "Paquete incremental: importar sobre la data ya cargada. No reemplaza ni modifica data/importacion_plataforma.",
    }
    (DIR_SALIDA / "manifiesto_importacion.json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DIR_SALIDA / "reporte_validacion_paquete.json").write_text(json.dumps(validacion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {**validacion, "salida": str(DIR_SALIDA), "tramos_stock": len(tramos_stock), "tramos_ventas": len(tramos_ventas)}


if __name__ == "__main__":
    resultado = generar()
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    raise SystemExit(0 if resultado.get("valido") else 2)
