# -*- coding: utf-8 -*-
"""
Generador de dataset semisintético para demanda farmacéutica.

El dataset combina datos maestros proporcionados por la botica (organización,
boticas, productos, proveedores y precios) con históricos operativos generados
mediante simulación controlada.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


SEMILLA = 42
RNG = np.random.default_rng(SEMILLA)
NAMESPACE_UUID = uuid.uuid5(uuid.NAMESPACE_DNS, "botica-demand-ml")

FECHA_INICIO = date(2024, 1, 1)
FECHA_FIN = date(2026, 5, 10)
RAIZ_MODELO = Path(__file__).parents[1]
DIR_SALIDA = RAIZ_MODELO / "data"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("dataset")


def uuid_deterministico(clave: str) -> str:
    """Crea UUID5 estable para que los maestros sean idempotentes."""
    return str(uuid.uuid5(NAMESPACE_UUID, clave))


def fecha_iso(valor: date) -> str:
    return datetime.combine(valor, datetime.min.time()).isoformat()


@dataclass(frozen=True)
class ProductoCatalogo:
    nombre_comercial: str
    principio_activo: str
    forma_farmaceutica: str
    concentracion: str
    laboratorio: str
    categoria_terapeutica: str
    clasificacion: str
    requiere_receta: bool
    demanda_diaria_base: float
    volatilidad: float
    pico_invierno: float
    pico_verano: float
    precio_venta: float
    margen_costo: float = 0.55


CATALOGO = [
    ProductoCatalogo("Paracetamol 500mg", "Paracetamol", "Tableta", "500mg", "Farmindustria", "Analgésico", "OTC", False, 12, 0.30, 1.80, 1.10, 0.50),
    ProductoCatalogo("Paracetamol 1g", "Paracetamol", "Tableta", "1g", "Farmindustria", "Analgésico", "OTC", False, 8, 0.25, 1.70, 1.00, 0.80),
    ProductoCatalogo("Ibuprofeno 400mg", "Ibuprofeno", "Tableta", "400mg", "Medifarma", "Antiinflamatorio", "OTC", False, 9, 0.28, 1.50, 1.00, 0.70),
    ProductoCatalogo("Ibuprofeno 600mg", "Ibuprofeno", "Tableta", "600mg", "Medifarma", "Antiinflamatorio", "receta", True, 5, 0.30, 1.40, 1.00, 1.20),
    ProductoCatalogo("Diclofenaco 50mg", "Diclofenaco", "Tableta", "50mg", "Farmindustria", "Antiinflamatorio", "OTC", False, 6, 0.30, 1.30, 1.00, 0.60),
    ProductoCatalogo("Dipirona 500mg", "Metamizol", "Tableta", "500mg", "Farmindustria", "Analgésico", "OTC", False, 8, 0.28, 1.50, 1.00, 0.45),
    ProductoCatalogo("Amoxicilina 500mg", "Amoxicilina", "Cápsula", "500mg", "GlaxoSmithKline", "Antibiótico", "receta", True, 7, 0.35, 1.90, 0.90, 1.80),
    ProductoCatalogo("Amoxicilina jarabe", "Amoxicilina", "Suspensión", "250mg/5ml", "GlaxoSmithKline", "Antibiótico", "receta", True, 6, 0.40, 2.00, 0.80, 8.50),
    ProductoCatalogo("Azitromicina 500mg", "Azitromicina", "Tableta", "500mg", "Pfizer", "Antibiótico", "receta", True, 4, 0.35, 1.70, 0.90, 4.50),
    ProductoCatalogo("Ciprofloxacino 500mg", "Ciprofloxacino", "Tableta", "500mg", "Bayer", "Antibiótico", "receta", True, 3, 0.30, 1.20, 1.30, 2.20),
    ProductoCatalogo("Metronidazol 500mg", "Metronidazol", "Tableta", "500mg", "Medifarma", "Antibiótico", "receta", True, 4, 0.30, 1.00, 1.40, 1.30),
    ProductoCatalogo("Loratadina 10mg", "Loratadina", "Tableta", "10mg", "Schering-Plough", "Antihistamínico", "OTC", False, 8, 0.35, 1.10, 2.20, 0.60),
    ProductoCatalogo("Loratadina jarabe", "Loratadina", "Jarabe", "5mg/5ml", "Schering-Plough", "Antihistamínico", "OTC", False, 5, 0.40, 1.00, 2.00, 6.00),
    ProductoCatalogo("Cetirizina 10mg", "Cetirizina", "Tableta", "10mg", "UCB Pharma", "Antihistamínico", "OTC", False, 7, 0.30, 1.10, 1.80, 0.70),
    ProductoCatalogo("Omeprazol 20mg", "Omeprazol", "Cápsula", "20mg", "AstraZeneca", "Antiulceroso", "receta", True, 10, 0.20, 1.00, 1.00, 0.80),
    ProductoCatalogo("Omeprazol 40mg", "Omeprazol", "Cápsula", "40mg", "AstraZeneca", "Antiulceroso", "receta", True, 6, 0.22, 1.00, 1.00, 1.50),
    ProductoCatalogo("Ranitidina 150mg", "Ranitidina", "Tableta", "150mg", "Medifarma", "Antiulceroso", "OTC", False, 7, 0.25, 1.00, 1.20, 0.90),
    ProductoCatalogo("Metformina 850mg", "Metformina", "Tableta", "850mg", "Merck", "Antidiabético", "receta", True, 9, 0.15, 1.00, 1.00, 0.90),
    ProductoCatalogo("Enalapril 10mg", "Enalapril", "Tableta", "10mg", "AC Farma", "Antihipertensivo", "receta", True, 8, 0.15, 1.00, 1.00, 0.70),
    ProductoCatalogo("Losartán 50mg", "Losartán", "Tableta", "50mg", "AC Farma", "Antihipertensivo", "receta", True, 7, 0.15, 1.00, 1.00, 1.10),
    ProductoCatalogo("Atorvastatina 20mg", "Atorvastatina", "Tableta", "20mg", "Pfizer", "Hipolipemiante", "receta", True, 6, 0.18, 1.00, 1.00, 2.50),
    ProductoCatalogo("Salbutamol inhalador", "Salbutamol", "Inhalador", "100mcg", "GlaxoSmithKline", "Broncodilatador", "receta", True, 4, 0.40, 2.00, 0.80, 18.00),
    ProductoCatalogo("Dexametasona 4mg", "Dexametasona", "Inyectable", "4mg/ml", "AC Farma", "Corticosteroide", "receta", True, 3, 0.35, 1.60, 0.90, 3.50),
    ProductoCatalogo("Clotrimazol crema", "Clotrimazol", "Crema", "1%", "Bayer", "Antifúngico", "OTC", False, 5, 0.30, 0.90, 1.50, 7.50),
    ProductoCatalogo("Vitamina C 500mg", "Ácido ascórbico", "Tableta", "500mg", "Farmindustria", "Vitamina", "OTC", False, 11, 0.30, 1.60, 1.10, 0.40),
    ProductoCatalogo("Complejo B", "Vitaminas B", "Tableta", "Complejo", "Roemmers", "Vitamina", "OTC", False, 8, 0.25, 1.10, 1.00, 0.60),
    ProductoCatalogo("Calcio + Vit D", "Carbonato Ca", "Tableta", "500mg+200UI", "Roemmers", "Suplemento", "OTC", False, 6, 0.20, 1.00, 1.00, 1.20),
    ProductoCatalogo("Sulfato Ferroso", "Sulfato ferroso", "Tableta", "325mg", "Farmindustria", "Suplemento", "OTC", False, 5, 0.25, 1.00, 1.00, 0.80),
    ProductoCatalogo("Tramadol 50mg", "Tramadol", "Cápsula", "50mg", "AC Farma", "Analgésico", "receta", True, 2, 0.40, 1.00, 1.00, 2.80),
    ProductoCatalogo("Betahistina 16mg", "Betahistina", "Tableta", "16mg", "AC Farma", "Antivertiginoso", "receta", True, 3, 0.25, 1.00, 1.00, 2.20),
]

BOTICAS_RAW = [
    ("Droguería Central D&R", "drogueria", "150101", "Cercado de Lima", "Av. Abancay 101", "014201001", True),
    ("Botica D&R Miraflores", "botica", "150122", "Miraflores", "Av. Larco 450", "014201002", False),
    ("Botica D&R San Borja", "botica", "150131", "San Borja", "Av. Aviación 2800", "014201003", False),
    ("Botica D&R San Miguel", "botica", "150136", "San Miguel", "Av. La Marina 2200", "014201004", False),
    ("Botica D&R Surco", "botica", "150141", "Santiago de Surco", "Av. Caminos del Inca 1200", "014201005", False),
    ("Botica D&R La Molina", "botica", "150114", "La Molina", "Av. La Molina 980", "014201006", False),
]

PROVEEDORES_RAW = [
    ("Distribuidora Drokasa S.A.", "20100123456", "PE", 3),
    ("Quicornac Distribuciones S.A.C.", "20100789012", "PE", 5),
    ("Albis Pharma Perú S.A.", "20100345678", "PE", 7),
    ("Farmacéutica Internacional S.A.", "20100901234", "PE", 10),
    ("Laboratorios Roche del Perú", "20100567890", "PE", 14),
]

FACTOR_DISTRITO = {
    "Miraflores": 1.40,
    "San Borja": 1.30,
    "Santiago de Surco": 1.25,
    "La Molina": 1.20,
    "San Miguel": 1.10,
}


def crear_datos_maestros():
    """Construye organización, boticas, usuarios, productos y proveedores."""
    org_id = uuid_deterministico("organizacion:D&R Farma S.A.C.:20512345678")
    organizacion = {
        "id": org_id,
        "nombre": "D&R Farma S.A.C.",
        "tipo_identificacion": "ruc",
        "numero_identificacion": "20512345678",
        "pais_origen": "PE",
        "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
    }

    boticas = []
    distritos = {}
    for i, (nombre, tipo, ubigeo, distrito, direccion, telefono, es_drogueria) in enumerate(BOTICAS_RAW, start=1):
        botica_id = uuid_deterministico(f"botica:{ubigeo}:{nombre}")
        boticas.append({
            "id": botica_id,
            "org_id": org_id,
            "tipo": tipo,
            "codigo_interno": f"BOT-{i:06d}",
            "nombre": nombre,
            "ubigeo": ubigeo,
            "direccion": direccion,
            "telefono": telefono,
            "activa": True,
            "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
        })
        distritos[ubigeo] = distrito

    drogueria_id = next(b["id"] for b in boticas if b["tipo"] == "drogueria")
    usuarios = [{
        "id": uuid_deterministico("usuario:operador-drogueria:central"),
        "org_id": org_id,
        "botica_id": None,
        "drogueria_id": drogueria_id,
        "nombre": "Ana Torres",
        "email": "operador.drogueria@dyrfarma.pe",
        "rol": "operador_drogueria",
        "telefono": "999000001",
        "ultimo_acceso": None,
        "avatar": None,
        "activo": True,
        "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
    }]
    nombres_botica = ["Luis Ramos", "María Salazar", "Carlos Vega", "Rosa Medina", "Jorge Paredes"]
    for i, botica in enumerate([b for b in boticas if b["tipo"] == "botica"]):
        nombre = nombres_botica[i]
        usuarios.append({
            "id": uuid_deterministico(f"usuario:visor-botica:{botica['id']}:{nombre}"),
            "org_id": org_id,
            "botica_id": botica["id"],
            "drogueria_id": None,
            "nombre": nombre,
            "email": f"visor.botica{i + 1}@dyrfarma.pe",
            "rol": "visor_botica",
            "telefono": f"99900000{i + 2}",
            "ultimo_acceso": None,
            "avatar": None,
            "activo": True,
            "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
        })

    productos = []
    catalogo_ml = []
    for i, producto in enumerate(CATALOGO, start=1):
        producto_id = uuid_deterministico(f"producto:{producto.nombre_comercial}:{producto.concentracion}")
        codigo = f"SKU-{i:06d}"
        productos.append({
            "id": producto_id,
            "org_id": org_id,
            "codigo_interno": codigo,
            "nombre_comercial": producto.nombre_comercial,
            "forma_farmaceutica": producto.forma_farmaceutica,
            "codigo_barras": f"77512300{i:04d}",
            "requiere_receta": producto.requiere_receta,
            "estado": "activo",
            "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
        })
        catalogo_ml.append({
            "producto_id": producto_id,
            "codigo_producto": codigo,
            "nombre_comercial": producto.nombre_comercial,
            "principio_activo": producto.principio_activo,
            "concentracion": producto.concentracion,
            "laboratorio": producto.laboratorio,
            "categoria_terapeutica": producto.categoria_terapeutica,
            "clasificacion": producto.clasificacion,
            "requiere_receta": producto.requiere_receta,
            "demanda_diaria_base": producto.demanda_diaria_base,
            "volatilidad": producto.volatilidad,
            "pico_invierno": producto.pico_invierno,
            "pico_verano": producto.pico_verano,
            "precio_venta": producto.precio_venta,
            "margen_costo": producto.margen_costo,
        })

    proveedores = []
    for razon, ruc, pais, _lead in PROVEEDORES_RAW:
        proveedores.append({
            "id": uuid_deterministico(f"proveedor:{ruc}:{razon}"),
            "org_id": org_id,
            "razon_social": razon,
            "tipo_identificacion": "ruc",
            "numero_identificacion": ruc,
            "pais_origen": pais,
            "contacto": None,
            "activo": True,
            "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
        })

    precios = []
    proveedor_producto = []
    proveedores_ids = [p["id"] for p in proveedores]
    for i, producto in enumerate(catalogo_ml, start=1):
        precios.append({
            "id": uuid_deterministico(f"precio:{producto['producto_id']}:base"),
            "producto_id": producto["producto_id"],
            "botica_id": None,
            "precio_venta": round(producto["precio_venta"], 2),
            "precio_costo": round(producto["precio_venta"] * producto["margen_costo"], 2),
            "vigente_desde": datetime(2024, 1, 1).isoformat(),
            "vigente_hasta": None,
        })
        proveedor_id = proveedores_ids[(i - 1) % len(proveedores_ids)]
        lead_time = PROVEEDORES_RAW[(i - 1) % len(PROVEEDORES_RAW)][3]
        proveedor_producto.append({
            "id": uuid_deterministico(f"proveedor-producto:{proveedor_id}:{producto['producto_id']}"),
            "proveedor_id": proveedor_id,
            "producto_id": producto["producto_id"],
            "lead_time_especifico": lead_time,
            "precio_compra_referencial": round(producto["precio_venta"] * producto["margen_costo"], 2),
            "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
            "activo": True,
        })

    return {
        "organizaciones": pd.DataFrame([organizacion]),
        "boticas": pd.DataFrame(boticas),
        "usuarios": pd.DataFrame(usuarios),
        "productos": pd.DataFrame(productos),
        "proveedores": pd.DataFrame(proveedores),
        "proveedor_producto": pd.DataFrame(proveedor_producto),
        "precios": pd.DataFrame(precios),
        "_catalogo_ml": pd.DataFrame(catalogo_ml),
        "_distritos_por_ubigeo": distritos,
    }


def factor_estacional(fecha: date, pico_invierno: float, pico_verano: float) -> float:
    # Estacionalidad: invierno eleva respiratorios y verano eleva alergias/hongos.
    dia_anio = fecha.timetuple().tm_yday
    peso_invierno = max(0, np.cos((dia_anio - 196) / 365 * 2 * np.pi))
    peso_verano = max(0, np.cos((dia_anio - 30) / 365 * 2 * np.pi))
    return 1 + (pico_invierno - 1) * peso_invierno + (pico_verano - 1) * peso_verano


def factor_dia_semana(fecha: date) -> float:
    return {0: 1.30, 1: 1.20, 2: 1.10, 3: 1.05, 4: 1.10, 5: 0.90, 6: 0.55}[fecha.weekday()]


def factor_inicio_mes(fecha: date) -> float:
    return 1.15 if fecha.day <= 5 else 1.0


def calcular_demanda_real(producto: pd.Series, fecha: date, distrito: str, factor_semanal: float) -> int:
    media = (
        producto["demanda_diaria_base"]
        * factor_estacional(fecha, producto["pico_invierno"], producto["pico_verano"])
        * factor_dia_semana(fecha)
        * factor_inicio_mes(fecha)
        * FACTOR_DISTRITO.get(distrito, 1.0)
        * factor_semanal
    )
    evento = RNG.choice([0.45, 1.0, 2.2], p=[0.025, 0.95, 0.025])
    cantidad = int(RNG.lognormal(mean=np.log(max(media * evento, 0.1)), sigma=producto["volatilidad"]))
    return max(0, cantidad)


def crear_lookup_usuarios(usuarios: pd.DataFrame) -> tuple[dict[str, str], str]:
    por_botica = usuarios.dropna(subset=["botica_id"]).set_index("botica_id")["id"].to_dict()
    operador_drogueria = usuarios.dropna(subset=["drogueria_id"]).iloc[0]["id"]
    return por_botica, operador_drogueria


def consumir_lotes_fefo(clave, cantidad, lotes_por_clave, lotes_por_id, saldo_lotes):
    """FEFO: First Expired, First Out. Consume primero el lote que vence antes."""
    consumos = []
    pendiente = cantidad
    lotes = sorted(
        lotes_por_clave.get(clave, []),
        key=lambda lote_id: lotes_por_id[lote_id]["fecha_vencimiento"],
    )
    for lote_id in lotes:
        if pendiente <= 0:
            break
        disponible = saldo_lotes.get(lote_id, 0)
        if disponible <= 0:
            continue
        consumido = min(disponible, pendiente)
        saldo_lotes[lote_id] -= consumido
        pendiente -= consumido
        consumos.append((lote_id, consumido))

    if pendiente > 0:
        raise ValueError(f"Stock por lote insuficiente para {clave}: faltan {pendiente}")
    return consumos


def simular_operacion(tablas_maestras):
    """
    Simula ventas, reposiciones, lotes y movimientos día a día.

    La venta representa la demanda observada y genera también una salida
    de inventario. Las reposiciones, mermas y devoluciones no forman parte
    de la variable objetivo del modelo.
    """
    org_id = tablas_maestras["organizaciones"].iloc[0]["id"]
    boticas = tablas_maestras["boticas"]
    boticas_venta = boticas[boticas["tipo"] == "botica"].copy()
    usuarios = tablas_maestras["usuarios"]
    catalogo = tablas_maestras["_catalogo_ml"]
    productos = tablas_maestras["productos"]
    proveedor_producto = tablas_maestras["proveedor_producto"]
    distritos = tablas_maestras["_distritos_por_ubigeo"]

    producto_catalogo = catalogo.set_index("producto_id")
    producto_codigo = productos.set_index("id")["codigo_interno"].to_dict()
    proveedor_por_producto = proveedor_producto.set_index("producto_id").to_dict("index")
    usuarios_por_botica, operador_drogueria_id = crear_lookup_usuarios(usuarios)

    stock = {}
    stock_minimo = {}
    stock_maximo = {}
    lotes_por_clave = {}
    lotes_por_id = {}
    saldo_lotes = {}
    eventos_stock = []
    lotes = []
    ventas = []
    demanda_diaria = []
    movimientos = []
    secuencias = {"venta": 0, "movimiento": 0, "lote": 0}
    reposiciones_pendientes = {}
    factores_semanales = {}

    for _, producto in catalogo.iterrows():
        stock_minimo[producto["producto_id"]] = max(15, int(producto["demanda_diaria_base"] * 7))
        stock_maximo[producto["producto_id"]] = max(80, int(producto["demanda_diaria_base"] * 45))
        for _, botica in boticas_venta.iterrows():
            distrito = distritos[botica["ubigeo"]]
            clave = (producto["producto_id"], botica["id"])
            stock_inicial = max(40, int(producto["demanda_diaria_base"] * 30 * FACTOR_DISTRITO[distrito]))
            stock[clave] = stock_inicial
            proveedor_id = proveedor_por_producto[producto["producto_id"]]["proveedor_id"]
            secuencias["lote"] += 1
            lote_id = uuid_deterministico(
                f"lote:inicial:{producto['producto_id']}:{botica['id']}:{secuencias['lote']}"
            )
            lote = {
                "id": lote_id,
                "org_id": org_id,
                "producto_id": producto["producto_id"],
                "ubicacion_tipo": "botica",
                "ubicacion_id": botica["id"],
                "numero_lote": f"LT-{producto_codigo[producto['producto_id']].replace('SKU-', '')}-INICIAL",
                "fecha_vencimiento": (FECHA_INICIO + timedelta(days=720)).isoformat(),
                "cantidad": stock_inicial,
                "proveedor_id": proveedor_id,
            }
            lotes.append(lote)
            lotes_por_id[lote_id] = lote
            lotes_por_clave.setdefault(clave, []).append(lote_id)
            saldo_lotes[lote_id] = stock_inicial
            eventos_stock.append({
                "fecha": FECHA_INICIO - timedelta(days=1),
                "org_id": org_id,
                "producto_id": producto["producto_id"],
                "ubicacion_tipo": "botica",
                "ubicacion_id": botica["id"],
                "cantidad_disponible": stock_inicial,
                "stock_minimo": stock_minimo[producto["producto_id"]],
                "stock_maximo": stock_maximo[producto["producto_id"]],
            })

    fecha = FECHA_INICIO
    while fecha <= FECHA_FIN:
        for _, botica in boticas_venta.iterrows():
            distrito = distritos[botica["ubigeo"]]
            for _, producto in catalogo.iterrows():
                producto_id = producto["producto_id"]
                clave = (producto_id, botica["id"])

                reposicion = reposiciones_pendientes.get(clave)
                if reposicion and reposicion["fecha_llegada"] <= fecha:
                    cantidad = reposicion["cantidad"]
                    secuencias["lote"] += 1
                    lote_id = uuid_deterministico(
                        f"lote:entrada:{producto_id}:{botica['id']}:{fecha_iso(fecha)}:{secuencias['lote']}"
                    )
                    lote = {
                        "id": lote_id,
                        "org_id": org_id,
                        "producto_id": producto_id,
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": botica["id"],
                        "numero_lote": f"LT-{producto_codigo[producto_id].replace('SKU-', '')}-{fecha:%Y%m}-{len(lotes) + 1:04d}",
                        "fecha_vencimiento": (fecha + timedelta(days=int(RNG.integers(180, 1096)))).isoformat(),
                        "cantidad": cantidad,
                        "proveedor_id": reposicion["proveedor_id"],
                    }
                    lotes.append(lote)
                    lotes_por_id[lote_id] = lote
                    lotes_por_clave.setdefault(clave, []).append(lote_id)
                    saldo_lotes[lote_id] = cantidad
                    stock[clave] += cantidad
                    secuencias["movimiento"] += 1
                    movimientos.append({
                        "id": uuid_deterministico(f"movimiento:entrada:{producto_id}:{botica['id']}:{fecha_iso(fecha)}:{secuencias['movimiento']}"),
                        "org_id": org_id,
                        "producto_id": producto_id,
                        "lote_id": lote_id,
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": botica["id"],
                        "tipo_movimiento": "entrada",
                        "cantidad": cantidad,
                        "motivo": "Llegada de reposición programada por stock bajo mínimo",
                        "usuario_id": usuarios_por_botica[botica["id"]],
                        "transferencia_id": None,
                        "created_at": fecha_iso(fecha),
                    })
                    del reposiciones_pendientes[clave]

                if fecha.weekday() < 6:
                    semana = fecha - timedelta(days=fecha.weekday())
                    clave_semana = (producto_id, botica["id"], semana)
                    if clave_semana not in factores_semanales:
                        factores_semanales[clave_semana] = float(np.clip(RNG.normal(1.0, 0.16), 0.65, 1.45))

                    demanda_real = calcular_demanda_real(
                        producto, fecha, distrito, factores_semanales[clave_semana]
                    )
                    cantidad_vendida = min(demanda_real, stock[clave])
                    demanda_insatisfecha = max(demanda_real - cantidad_vendida, 0)
                    stockout_flag = 1 if demanda_insatisfecha > 0 else 0
                    demanda_diaria.append({
                        "fecha": fecha_iso(fecha),
                        "org_id": org_id,
                        "botica_id": botica["id"],
                        "producto_id": producto_id,
                        "demanda_real": demanda_real,
                        "cantidad_vendida": cantidad_vendida,
                        "demanda_insatisfecha": demanda_insatisfecha,
                        "stockout_flag": stockout_flag,
                    })

                    if cantidad_vendida > 0:
                        # Demanda observada: venta real que alimenta la variable objetivo.
                        consumos = consumir_lotes_fefo(clave, cantidad_vendida, lotes_por_clave, lotes_por_id, saldo_lotes)
                        stock[clave] -= cantidad_vendida
                        secuencias["venta"] += 1
                        clave_idempotencia = f"venta:{org_id}:{botica['id']}:{producto_id}:{fecha.isoformat()}"
                        venta_id = uuid_deterministico(f"{clave_idempotencia}:{secuencias['venta']}")
                        ventas.append({
                            "id": venta_id,
                            "org_id": org_id,
                            "botica_id": botica["id"],
                            "producto_id": producto_id,
                            "fecha_venta": fecha_iso(fecha),
                            "cantidad": cantidad_vendida,
                            "precio_unitario": None,
                            "importacion_id": None,
                            "clave_idempotencia": clave_idempotencia,
                            "created_at": fecha_iso(fecha),
                        })
                        # Venta y movimiento se separan: la venta mide demanda; la salida registra inventario.
                        for lote_id, cantidad_lote in consumos:
                            secuencias["movimiento"] += 1
                            movimientos.append({
                                "id": uuid_deterministico(f"movimiento:salida:{venta_id}:{lote_id}:{secuencias['movimiento']}"),
                                "org_id": org_id,
                                "producto_id": producto_id,
                                "lote_id": lote_id,
                                "ubicacion_tipo": "botica",
                                "ubicacion_id": botica["id"],
                                "tipo_movimiento": "salida",
                                "cantidad": cantidad_lote,
                                "motivo": "Venta al cliente",
                                "usuario_id": usuarios_por_botica[botica["id"]],
                                "transferencia_id": None,
                                "created_at": fecha_iso(fecha),
                            })

                    if stock[clave] <= stock_minimo[producto_id] and clave not in reposiciones_pendientes:
                        proveedor_id = proveedor_por_producto[producto_id]["proveedor_id"]
                        lead_time = int(proveedor_por_producto[producto_id]["lead_time_especifico"])
                        objetivo = int(RNG.integers(stock_minimo[producto_id] * 4, stock_minimo[producto_id] * 8 + 1))
                        cantidad_reposicion = max(stock_maximo[producto_id] - stock[clave], objetivo)
                        reposiciones_pendientes[clave] = {
                            "fecha_llegada": fecha + timedelta(days=lead_time),
                            "cantidad": int(cantidad_reposicion),
                            "proveedor_id": proveedor_id,
                        }

                if stock[clave] > 5 and RNG.random() < 0.01:
                    cantidad = int(RNG.integers(1, 4))
                    consumos = consumir_lotes_fefo(clave, cantidad, lotes_por_clave, lotes_por_id, saldo_lotes)
                    stock[clave] -= cantidad
                    for lote_id, cantidad_lote in consumos:
                        secuencias["movimiento"] += 1
                        movimientos.append({
                            "id": uuid_deterministico(f"movimiento:merma:{producto_id}:{botica['id']}:{fecha_iso(fecha)}:{secuencias['movimiento']}"),
                            "org_id": org_id,
                            "producto_id": producto_id,
                            "lote_id": lote_id,
                            "ubicacion_tipo": "botica",
                            "ubicacion_id": botica["id"],
                            "tipo_movimiento": "merma",
                            "cantidad": cantidad_lote,
                            "motivo": "Producto vencido o dañado",
                            "usuario_id": usuarios_por_botica[botica["id"]],
                            "transferencia_id": None,
                            "created_at": fecha_iso(fecha),
                        })

                if lotes_por_clave.get(clave) and stock[clave] > 0 and RNG.random() < 0.003:
                    lote_id = sorted(
                        lotes_por_clave[clave],
                        key=lambda item: lotes_por_id[item]["fecha_vencimiento"],
                    )[0]
                    saldo_lotes[lote_id] += 1
                    stock[clave] += 1
                    secuencias["movimiento"] += 1
                    movimientos.append({
                        "id": uuid_deterministico(f"movimiento:devolucion:{producto_id}:{botica['id']}:{fecha_iso(fecha)}:{secuencias['movimiento']}"),
                        "org_id": org_id,
                        "producto_id": producto_id,
                        "lote_id": lote_id,
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": botica["id"],
                        "tipo_movimiento": "devolucion",
                        "cantidad": 1,
                        "motivo": "Devolución de cliente",
                        "usuario_id": usuarios_por_botica[botica["id"]],
                        "transferencia_id": None,
                        "created_at": fecha_iso(fecha),
                    })

                eventos_stock.append({
                    "fecha": fecha,
                    "org_id": org_id,
                    "producto_id": producto_id,
                    "ubicacion_tipo": "botica",
                    "ubicacion_id": botica["id"],
                    "cantidad_disponible": stock[clave],
                    "stock_minimo": stock_minimo[producto_id],
                    "stock_maximo": stock_maximo[producto_id],
                })

        fecha += timedelta(days=1)

    for lote in lotes:
        lote["cantidad"] = saldo_lotes[lote["id"]]

    stock_ubicaciones = []
    for (producto_id, botica_id), cantidad in stock.items():
        pendiente = reposiciones_pendientes.get((producto_id, botica_id), {})
        stock_ubicaciones.append({
            "id": uuid_deterministico(f"stock:{producto_id}:{botica_id}"),
            "org_id": org_id,
            "producto_id": producto_id,
            "ubicacion_tipo": "botica",
            "ubicacion_id": botica_id,
            "cantidad_disponible": cantidad,
            "stock_minimo": stock_minimo[producto_id],
            "stock_por_recibir": int(pendiente.get("cantidad", 0)),
            "stock_en_transito": int(pendiente.get("cantidad", 0)),
            "stock_maximo": stock_maximo[producto_id],
            "updated_at": fecha_iso(FECHA_FIN),
        })

    return {
        "ventas_historicas": pd.DataFrame(ventas),
        "demanda_diaria": pd.DataFrame(demanda_diaria),
        "lotes": pd.DataFrame(lotes),
        "movimientos_inventario": pd.DataFrame(movimientos),
        "stock_ubicaciones": pd.DataFrame(stock_ubicaciones),
        "eventos_stock": pd.DataFrame(eventos_stock),
    }


def construir_stock_historico(eventos_stock):
    """
    Genera snapshots semanales de inventario.

    El stock histórico evita utilizar el stock actual para representar
    períodos pasados, lo que produciría fuga de información.
    """
    eventos = eventos_stock.copy()
    eventos["fecha"] = pd.to_datetime(eventos["fecha"])
    semanas = pd.date_range(FECHA_INICIO - timedelta(days=1), FECHA_FIN, freq="W-SUN")
    snapshots = []

    for (producto_id, ubicacion_id), grupo in eventos.groupby(["producto_id", "ubicacion_id"]):
        grupo = grupo.sort_values("fecha")
        for cierre in semanas:
            historico = grupo[grupo["fecha"] <= cierre]
            if historico.empty:
                continue
            fila = historico.iloc[-1]
            # Snapshot: estado del inventario al cierre del domingo.
            snapshots.append({
                "id": uuid_deterministico(f"stock-historico:{producto_id}:{ubicacion_id}:{cierre.date()}"),
                "org_id": fila["org_id"],
                "producto_id": producto_id,
                "ubicacion_tipo": fila["ubicacion_tipo"],
                "ubicacion_id": ubicacion_id,
                "cantidad_disponible": int(fila["cantidad_disponible"]),
                "stock_minimo": int(fila["stock_minimo"]),
                "stock_maximo": int(fila["stock_maximo"]),
                "fecha_snapshot_dia": cierre.date().isoformat(),
                "created_at": datetime.combine(cierre.date(), datetime.min.time()).isoformat(),
            })

    return pd.DataFrame(snapshots)


def construir_dataset_semanal(tablas):
    """
    Agrega las ventas por producto, botica y semana.

    Esta será la base para SARIMA y XGBoost. Los lags y medias móviles se
    calcularán posteriormente en pipeline.py.
    """
    ventas = tablas["ventas_historicas"].copy()
    ventas["fecha_venta"] = pd.to_datetime(ventas["fecha_venta"])
    ventas["fecha_semana"] = ventas["fecha_venta"].dt.to_period("W-SUN").dt.start_time
    demanda_diaria = tablas["demanda_diaria"].copy()
    demanda_diaria["fecha"] = pd.to_datetime(demanda_diaria["fecha"])
    demanda_diaria["fecha_semana"] = demanda_diaria["fecha"].dt.to_period("W-SUN").dt.start_time

    ventas_semanales = ventas.groupby(
        ["org_id", "botica_id", "producto_id", "fecha_semana"], as_index=False
    )["cantidad"].sum().rename(columns={"cantidad": "cantidad_vendida"})

    demanda_semanal = demanda_diaria.groupby(
        ["org_id", "botica_id", "producto_id", "fecha_semana"], as_index=False
    ).agg(
        demanda_insatisfecha=("demanda_insatisfecha", "sum"),
        stockout_flag=("stockout_flag", "max"),
    )

    boticas_venta = tablas["boticas"][tablas["boticas"]["tipo"] == "botica"]
    productos = tablas["productos"]
    catalogo = tablas["_catalogo_ml"]
    proveedor_producto = tablas["proveedor_producto"]
    stock_historico = tablas["stock_historico"].copy()
    semanas = pd.date_range(FECHA_INICIO, FECHA_FIN, freq="W-MON")

    # Granularidad semanal: grilla completa producto x botica x semana, incluso sin ventas.
    grilla = pd.MultiIndex.from_product(
        [boticas_venta["id"], productos["id"], semanas],
        names=["botica_id", "producto_id", "fecha_semana"],
    ).to_frame(index=False)
    grilla["org_id"] = tablas["organizaciones"].iloc[0]["id"]

    dataset = grilla.merge(
        ventas_semanales,
        on=["org_id", "botica_id", "producto_id", "fecha_semana"],
        how="left",
    )
    dataset["cantidad_vendida"] = dataset["cantidad_vendida"].fillna(0).astype(int)
    dataset = dataset.merge(
        demanda_semanal,
        on=["org_id", "botica_id", "producto_id", "fecha_semana"],
        how="left",
    )
    dataset["demanda_insatisfecha"] = dataset["demanda_insatisfecha"].fillna(0).astype(int)
    dataset["stockout_flag"] = dataset["stockout_flag"].fillna(0).astype(int)

    stock_historico["fecha_snapshot_dia"] = pd.to_datetime(stock_historico["fecha_snapshot_dia"])
    stock_historico["fecha_semana"] = stock_historico["fecha_snapshot_dia"] + pd.Timedelta(days=1)
    stock_semana = stock_historico.rename(columns={
        "ubicacion_id": "botica_id",
        "cantidad_disponible": "stock_inicio_semana",
    })[
        ["org_id", "botica_id", "producto_id", "fecha_semana", "stock_inicio_semana", "stock_minimo", "stock_maximo"]
    ]

    # Prevención de data leakage: se usa el cierre del domingo anterior, no el final de la semana predicha.
    dataset = dataset.merge(
        stock_semana,
        on=["org_id", "botica_id", "producto_id", "fecha_semana"],
        how="left",
    )
    columnas_producto = productos.rename(columns={"codigo_interno": "codigo_producto"})[
        ["id", "codigo_producto", "nombre_comercial"]
    ]
    dataset = dataset.merge(columnas_producto, left_on="producto_id", right_on="id", how="left")
    dataset = dataset.drop(columns=["id"])
    dataset = dataset.merge(
        catalogo[["producto_id", "categoria_terapeutica"]], on="producto_id", how="left"
    )
    dataset = dataset.merge(
        proveedor_producto[["producto_id", "lead_time_especifico"]], on="producto_id", how="left"
    ).rename(columns={"lead_time_especifico": "lead_time_dias"})

    columnas = [
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
    dataset = dataset[columnas].sort_values(["producto_id", "botica_id", "fecha_semana"])
    dataset["fecha_semana"] = dataset["fecha_semana"].dt.date.astype(str)
    return dataset.reset_index(drop=True)


def validar_dataset(tablas, dataset):
    """Comprueba FKs, duplicados, valores negativos, fechas y faltantes."""
    productos = set(tablas["productos"]["id"])
    boticas = tablas["boticas"]
    boticas_venta = set(boticas[boticas["tipo"] == "botica"]["id"])
    droguerias = set(boticas[boticas["tipo"] == "drogueria"]["id"])
    usuarios = set(tablas["usuarios"]["id"])
    proveedores = set(tablas["proveedores"]["id"])

    assert tablas["productos"]["id"].is_unique
    assert tablas["boticas"]["id"].is_unique
    assert tablas["usuarios"]["id"].is_unique
    assert tablas["proveedores"]["id"].is_unique
    assert tablas["ventas_historicas"]["id"].is_unique
    assert tablas["ventas_historicas"]["clave_idempotencia"].is_unique
    assert tablas["ventas_historicas"]["clave_idempotencia"].notna().all()
    assert tablas["movimientos_inventario"]["id"].is_unique
    assert tablas["lotes"]["id"].is_unique
    assert tablas["stock_ubicaciones"]["id"].is_unique
    assert tablas["stock_historico"]["id"].is_unique
    assert tablas["productos"]["codigo_interno"].is_unique
    assert tablas["boticas"]["codigo_interno"].is_unique

    assert set(tablas["ventas_historicas"]["producto_id"]).issubset(productos)
    assert set(tablas["ventas_historicas"]["botica_id"]).issubset(boticas_venta)
    assert set(tablas["demanda_diaria"]["producto_id"]).issubset(productos)
    assert set(tablas["demanda_diaria"]["botica_id"]).issubset(boticas_venta)
    assert set(tablas["movimientos_inventario"]["producto_id"]).issubset(productos)
    assert set(tablas["movimientos_inventario"]["usuario_id"]).issubset(usuarios)
    assert set(tablas["proveedor_producto"]["proveedor_id"]).issubset(proveedores)
    assert set(tablas["proveedor_producto"]["producto_id"]).issubset(productos)
    assert (tablas["lotes"]["cantidad"] >= 0).all()

    for nombre in ["ventas_historicas", "demanda_diaria", "movimientos_inventario", "stock_ubicaciones", "stock_historico"]:
        cantidad_cols = [c for c in tablas[nombre].columns if c.startswith("cantidad") or c.startswith("stock_")]
        for columna in cantidad_cols:
            assert (tablas[nombre][columna].fillna(0) >= 0).all(), f"{nombre}.{columna} contiene negativos"

    assert not set(tablas["ventas_historicas"]["botica_id"]).intersection(droguerias)
    assert not set(tablas["demanda_diaria"]["botica_id"]).intersection(droguerias)
    assert (tablas["demanda_diaria"][["demanda_real", "cantidad_vendida", "demanda_insatisfecha"]] >= 0).all().all()
    assert (tablas["demanda_diaria"]["cantidad_vendida"] <= tablas["demanda_diaria"]["demanda_real"]).all()
    assert not dataset.duplicated(["fecha_semana", "botica_id", "producto_id"]).any()
    assert dataset[["stock_inicio_semana", "stock_minimo", "stock_maximo", "lead_time_dias", "demanda_insatisfecha", "stockout_flag"]].notna().all().all()
    assert (dataset["cantidad_vendida"] >= 0).all()
    assert (dataset["demanda_insatisfecha"] >= 0).all()
    assert set(dataset["stockout_flag"].unique()).issubset({0, 1})
    assert set(tablas["demanda_diaria"]["stockout_flag"].unique()).issubset({0, 1})

    semanas_esperadas = len(pd.date_range(FECHA_INICIO, FECHA_FIN, freq="W-MON"))
    assert len(dataset) == len(boticas_venta) * len(productos) * semanas_esperadas
    stock_keys = ["producto_id", "ubicacion_id"]
    snapshot_keys = ["producto_id", "ubicacion_id", "fecha_snapshot_dia"]
    assert not tablas["stock_ubicaciones"].duplicated(stock_keys).any()
    assert not tablas["stock_historico"].duplicated(snapshot_keys).any()

    usuarios_botica = tablas["usuarios"].dropna(subset=["botica_id"]).set_index("botica_id")["id"].to_dict()
    movimientos_botica = tablas["movimientos_inventario"][tablas["movimientos_inventario"]["ubicacion_tipo"] == "botica"]
    assert movimientos_botica.apply(
        lambda fila: usuarios_botica.get(fila["ubicacion_id"]) == fila["usuario_id"], axis=1
    ).all()

    stock = tablas["stock_ubicaciones"]
    lotes_activos = tablas["lotes"][tablas["lotes"]["cantidad"] > 0]
    saldos_lotes = lotes_activos.groupby(["producto_id", "ubicacion_id"])["cantidad"].sum()
    saldos_stock = stock.set_index(["producto_id", "ubicacion_id"])["cantidad_disponible"]
    assert saldos_stock.sort_index().equals(saldos_lotes.reindex(saldos_stock.index, fill_value=0).sort_index())


def exportar_csvs(tablas, dataset):
    """Exporta los archivos en UTF-8 sin modificar los datos maestros."""
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)
    exportables = [
        "organizaciones",
        "boticas",
        "usuarios",
        "productos",
        "proveedores",
        "proveedor_producto",
        "precios",
        "ventas_historicas",
        "demanda_diaria",
        "lotes",
        "movimientos_inventario",
        "stock_historico",
        "stock_ubicaciones",
    ]
    for nombre in exportables:
        ruta = DIR_SALIDA / f"{nombre}.csv"
        tablas[nombre].to_csv(ruta, index=False, encoding="utf-8")
        log.info("%-28s %8d filas", ruta.name, len(tablas[nombre]))

    dataset.to_csv(DIR_SALIDA / "features_entrenamiento.csv", index=False, encoding="utf-8")
    log.info("%-28s %8d filas", "features_entrenamiento.csv", len(dataset))


def main():
    maestros = crear_datos_maestros()
    operacion = simular_operacion(maestros)
    tablas = {**maestros, **operacion}

    tablas["stock_historico"] = construir_stock_historico(
        operacion["eventos_stock"]
    )

    dataset = construir_dataset_semanal(tablas)
    validar_dataset(tablas, dataset)
    exportar_csvs(tablas, dataset)


if __name__ == "__main__":
    main()
