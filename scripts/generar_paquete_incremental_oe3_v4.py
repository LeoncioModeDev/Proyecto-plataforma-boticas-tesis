from pathlib import Path
import csv
import json
import hashlib
from datetime import datetime, timezone


RAIZ = Path(__file__).resolve().parents[1]
BASE = RAIZ / "modelo-ml" / "data" / "importacion_plataforma"
SALIDA = RAIZ / "data" / "importacion_plataforma_v4_incremental_oe3"
STOCK_DIR = SALIDA / "stock_historico"
VENTAS_DIR = SALIDA / "ventas_historicas"

FECHA_BASE = "2026-06-29"
FECHA_POSTERIOR = "2026-07-06"
TAMANO_LOTE = 200

STOCK_HEADERS = [
    "codigo_producto",
    "codigo_botica",
    "fecha_snapshot",
    "cantidad_disponible",
    "stock_minimo",
    "stock_maximo",
    "demanda_insatisfecha",
    "stockout_flag",
]
VENTAS_HEADERS = ["codigo_producto", "codigo_botica", "fecha_venta", "cantidad", "precio_unitario"]


def leer_codigos_existentes():
    with (BASE / "02_boticas.csv").open(newline="", encoding="utf-8") as archivo:
        boticas = [fila["codigo_interno"] for fila in csv.DictReader(archivo) if fila.get("tipo") == "botica"][:5]

    with (BASE / "03_productos.csv").open(newline="", encoding="utf-8") as archivo:
        productos = [fila["codigo_interno"] for fila in csv.DictReader(archivo)][:30]

    precios = {}
    with (BASE / "06_precios.csv").open(newline="", encoding="utf-8") as archivo:
        for fila in csv.DictReader(archivo):
            precios[(fila["codigo_producto"], fila["codigo_botica"])] = fila["precio_venta"]

    if len(boticas) != 5 or len(productos) != 30:
        raise RuntimeError("No hay suficientes boticas/productos existentes para generar el paquete v4")

    return boticas, productos, precios


def escribir_csv(ruta, encabezados, filas):
    with ruta.open("w", newline="", encoding="utf-8") as archivo:
        writer = csv.DictWriter(archivo, fieldnames=encabezados)
        writer.writeheader()
        writer.writerows(filas)


def sha256(ruta):
    hash_archivo = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(65536), b""):
            hash_archivo.update(bloque)
    return hash_archivo.hexdigest()


def fila_stock(indice, botica, producto, fecha, demanda_insatisfecha, tiene_sobrestock):
    stock_minimo = 50 + (indice % 5) * 5
    stock_maximo = 180 + (indice % 6) * 20
    factores_sobrestock = [1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40]

    if demanda_insatisfecha > 0:
        cantidad_disponible = max(stock_minimo - 8 - (indice % 6), 0)
        stockout_flag = 1
    elif tiene_sobrestock:
        cantidad_disponible = int(round(stock_maximo * factores_sobrestock[indice % len(factores_sobrestock)]))
        stockout_flag = 0
    else:
        cantidad_disponible = stock_minimo + 30 + (indice % 28)
        stockout_flag = 0

    return {
        "codigo_producto": producto,
        "codigo_botica": botica,
        "fecha_snapshot": fecha,
        "cantidad_disponible": cantidad_disponible,
        "stock_minimo": stock_minimo,
        "stock_maximo": stock_maximo,
        "demanda_insatisfecha": demanda_insatisfecha,
        "stockout_flag": stockout_flag,
    }


def dividir(filas, encabezados, carpeta, prefijo, campo_fecha):
    archivos = []
    for numero, inicio in enumerate(range(0, len(filas), TAMANO_LOTE), 1):
        tramo = filas[inicio:inicio + TAMANO_LOTE]
        relativo = f"{carpeta.name}/{prefijo}_{numero:03d}.csv"
        ruta = carpeta / f"{prefijo}_{numero:03d}.csv"
        escribir_csv(ruta, encabezados, tramo)
        fechas = [fila[campo_fecha] for fila in tramo]
        archivos.append({
            "archivo": relativo,
            "numero_tramo": numero,
            "fila_desde": inicio + 1,
            "fila_hasta": inicio + len(tramo),
            "cantidad_filas": len(tramo),
            "fecha_minima": min(fechas),
            "fecha_maxima": max(fechas),
            "sha256": sha256(ruta),
        })
    return archivos


def resumen(fecha, stock_rows, ventas_rows):
    ventas = sum(int(fila["cantidad"]) for fila in ventas_rows if fila["fecha_venta"] == fecha)
    stock_fecha = [fila for fila in stock_rows if fila["fecha_snapshot"] == fecha]
    demanda_insatisfecha = sum(int(fila["demanda_insatisfecha"]) for fila in stock_fecha)
    evaluados = sum(1 for fila in stock_fecha if int(fila["stock_maximo"]) > 0)
    sobrestock = sum(
        1
        for fila in stock_fecha
        if int(fila["stock_maximo"]) > 0 and int(fila["cantidad_disponible"]) > int(fila["stock_maximo"])
    )

    return {
        "fecha": fecha,
        "ventas": ventas,
        "demanda_insatisfecha": demanda_insatisfecha,
        "fill_rate": round((ventas / (ventas + demanda_insatisfecha)) * 100, 2),
        "sku_botica_evaluados": evaluados,
        "sku_botica_sobrestock": sobrestock,
        "tasa_sobrestock": round((sobrestock / evaluados) * 100, 2),
    }


def validar(linea_base, posterior, archivos_stock, archivos_ventas, stock_rows, ventas_rows):
    stock_ordenado = stock_rows == sorted(stock_rows, key=lambda fila: (fila["fecha_snapshot"], fila["codigo_botica"], fila["codigo_producto"]))
    ventas_ordenado = ventas_rows == sorted(ventas_rows, key=lambda fila: (fila["fecha_venta"], fila["codigo_botica"], fila["codigo_producto"]))
    criterios = [
        78 <= linea_base["fill_rate"] <= 82,
        91 <= posterior["fill_rate"] <= 93,
        13 <= linea_base["tasa_sobrestock"] <= 15,
        7 <= posterior["tasa_sobrestock"] <= 9,
        posterior["reduccion_sobrestock_porcentual"] >= 25,
        all(archivo["cantidad_filas"] <= TAMANO_LOTE for archivo in archivos_stock + archivos_ventas),
        stock_ordenado,
        ventas_ordenado,
    ]
    if not all(criterios):
        raise RuntimeError({"linea_base": linea_base, "resultado_posterior": posterior})


def main():
    STOCK_DIR.mkdir(parents=True, exist_ok=True)
    VENTAS_DIR.mkdir(parents=True, exist_ok=True)

    boticas, productos, precios = leer_codigos_existentes()
    combinaciones = [(botica, producto) for botica in boticas for producto in productos]

    sobrestock_base = set(range(21))
    sobrestock_posterior = set(range(9, 21))

    demanda_base = {indice: 0 for indice in range(len(combinaciones))}
    demanda_posterior = {indice: 0 for indice in range(len(combinaciones))}

    for indice in range(55, 85):
        demanda_base[indice] = 25

    for indice in range(90, 109):
        demanda_posterior[indice] = 15

    stock_rows = []
    ventas_rows = []

    for indice, (botica, producto) in enumerate(combinaciones):
        ventas_rows.append({
            "codigo_producto": producto,
            "codigo_botica": botica,
            "fecha_venta": FECHA_BASE,
            "cantidad": 20,
            "precio_unitario": precios.get((producto, botica), "1.00"),
        })
        ventas_rows.append({
            "codigo_producto": producto,
            "codigo_botica": botica,
            "fecha_venta": FECHA_POSTERIOR,
            "cantidad": 21,
            "precio_unitario": precios.get((producto, botica), "1.00"),
        })
        stock_rows.append(fila_stock(indice, botica, producto, FECHA_BASE, demanda_base[indice], indice in sobrestock_base))
        stock_rows.append(fila_stock(indice, botica, producto, FECHA_POSTERIOR, demanda_posterior[indice], indice in sobrestock_posterior))

    stock_rows.sort(key=lambda fila: (fila["fecha_snapshot"], fila["codigo_botica"], fila["codigo_producto"]))
    ventas_rows.sort(key=lambda fila: (fila["fecha_venta"], fila["codigo_botica"], fila["codigo_producto"]))

    escribir_csv(SALIDA / "08_stock_historico.csv", STOCK_HEADERS, stock_rows)
    escribir_csv(SALIDA / "09_ventas_historicas.csv", VENTAS_HEADERS, ventas_rows)

    archivos_stock = dividir(stock_rows, STOCK_HEADERS, STOCK_DIR, "stock_historico", "fecha_snapshot")
    archivos_ventas = dividir(ventas_rows, VENTAS_HEADERS, VENTAS_DIR, "ventas_historicas", "fecha_venta")

    linea_base = resumen(FECHA_BASE, stock_rows, ventas_rows)
    posterior = resumen(FECHA_POSTERIOR, stock_rows, ventas_rows)
    posterior["reduccion_sobrestock_porcentual"] = round(
        ((linea_base["tasa_sobrestock"] - posterior["tasa_sobrestock"]) / linea_base["tasa_sobrestock"]) * 100,
        2,
    )
    reporte = {"linea_base": linea_base, "resultado_posterior": posterior}
    validar(linea_base, posterior, archivos_stock, archivos_ventas, stock_rows, ventas_rows)

    orden = {
        "stock_historico": [archivo["archivo"] for archivo in archivos_stock],
        "ventas_historicas": [archivo["archivo"] for archivo in archivos_ventas],
    }
    manifiesto = {
        "version_paquete": "4.0.0-oe3-incremental",
        "fuente": "dataset_piloto_sintetico_controlado",
        "uso": "validacion_operativa_OE3",
        "dataset_piloto_sintetico_controlado": True,
        "fecha_generacion": datetime.now(timezone.utc).isoformat(),
        "carpeta_base_no_modificada": BASE.relative_to(RAIZ).as_posix(),
        "no_incluye_catalogos": True,
        "boticas_reutilizadas": boticas,
        "productos_reutilizados": productos,
        "fechas_validacion": {
            "linea_base": FECHA_BASE,
            "resultado_posterior": FECHA_POSTERIOR,
        },
        "tamano_lote": TAMANO_LOTE,
        "historicos_divididos": True,
        "advertencia": "No importar archivos consolidados y tramos al mismo tiempo.",
        "conteos": {
            "stock_historico": len(stock_rows),
            "ventas_historicas": len(ventas_rows),
            "stock_historico_tramos": len(archivos_stock),
            "ventas_historicas_tramos": len(archivos_ventas),
        },
        "archivos_stock_historico": archivos_stock,
        "archivos_ventas_historicas": archivos_ventas,
        "metricas_validacion": reporte,
    }

    for ruta, datos in [
        (SALIDA / "reporte_validacion_metricas.json", reporte),
        (SALIDA / "orden_importacion_historicos.json", orden),
        (SALIDA / "manifiesto_importacion.json", manifiesto),
    ]:
        with ruta.open("w", encoding="utf-8") as archivo:
            json.dump(datos, archivo, ensure_ascii=False, indent=2)
            archivo.write("\n")

    print(f"carpeta generada: {SALIDA}")
    print(f"filas stock_historico: {len(stock_rows)}")
    print(f"filas ventas_historicas: {len(ventas_rows)}")
    print(f"tramos stock_historico: {len(archivos_stock)}")
    print(f"tramos ventas_historicas: {len(archivos_ventas)}")
    print(f"Fill Rate base: {linea_base['fill_rate']}%")
    print(f"Fill Rate posterior: {posterior['fill_rate']}%")
    print(f"Tasa de Sobrestock base: {linea_base['tasa_sobrestock']}%")
    print(f"Tasa de Sobrestock posterior: {posterior['tasa_sobrestock']}%")
    print(f"Reducción de Sobrestock: {posterior['reduccion_sobrestock_porcentual']}%")


if __name__ == "__main__":
    main()
