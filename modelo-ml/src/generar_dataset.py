# -*- coding: utf-8 -*-
"""Generador reproducible de datos sintéticos alineados al esquema ML/Supabase."""

from __future__ import annotations

import argparse
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd


SEMILLA = 42
NAMESPACE_UUID = uuid.uuid5(uuid.NAMESPACE_DNS, "botica-demand-ml")
FECHA_INICIO = date(2024, 1, 1)
FECHA_FIN = date(2026, 5, 10)
RAIZ_MODELO = Path(__file__).resolve().parents[1]
DIR_DATOS = RAIZ_MODELO / "data"

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("generar-dataset")


CATEGORIAS = [
    "Analgésico", "Antibiótico", "Antidiabético", "Antifúngico", "Antihipertensivo",
    "Antihistamínico", "Antiinflamatorio", "Antiulceroso", "Antivertiginoso",
    "Broncodilatador", "Corticosteroide", "Hipolipemiante", "Suplemento", "Vitamina",
]

FORMAS = ["Tableta", "Cápsula", "Jarabe", "Suspensión", "Inhalador", "Inyectable", "Crema"]
UNIDADES = [("Miligramo", "mg"), ("Gramo", "g"), ("Mililitro", "mL"), ("Microgramo", "mcg"), ("Unidad internacional", "UI"), ("Porcentaje", "%")]


@dataclass(frozen=True)
class ProductoSimulado:
    nombre_comercial: str
    principio_activo: str
    forma: str
    presentacion: str
    concentracion: float
    unidad: str
    categoria: str
    clasificacion: str
    demanda_diaria_base: float
    volatilidad: float
    pico_invierno: float
    pico_verano: float
    precio_venta_simulado: float
    margen_costo_simulado: float = 0.55


CATALOGO = [
    ProductoSimulado("Paracetamol 500mg", "Paracetamol", "Tableta", "Caja x 100 tabletas", 500, "mg", "Analgésico", "OTC", 12, .30, 1.8, 1.1, .50),
    ProductoSimulado("Paracetamol 1g", "Paracetamol", "Tableta", "Caja x 50 tabletas", 1, "g", "Analgésico", "OTC", 8, .25, 1.7, 1.0, .80),
    ProductoSimulado("Ibuprofeno 400mg", "Ibuprofeno", "Tableta", "Caja x 100 tabletas", 400, "mg", "Antiinflamatorio", "OTC", 9, .28, 1.5, 1.0, .70),
    ProductoSimulado("Ibuprofeno 600mg", "Ibuprofeno", "Tableta", "Caja x 50 tabletas", 600, "mg", "Antiinflamatorio", "receta", 5, .30, 1.4, 1.0, 1.20),
    ProductoSimulado("Diclofenaco 50mg", "Diclofenaco", "Tableta", "Caja x 100 tabletas", 50, "mg", "Antiinflamatorio", "OTC", 6, .30, 1.3, 1.0, .60),
    ProductoSimulado("Dipirona 500mg", "Metamizol", "Tableta", "Caja x 100 tabletas", 500, "mg", "Analgésico", "OTC", 8, .28, 1.5, 1.0, .45),
    ProductoSimulado("Amoxicilina 500mg", "Amoxicilina", "Cápsula", "Caja x 100 cápsulas", 500, "mg", "Antibiótico", "receta", 7, .35, 1.9, .9, 1.80),
    ProductoSimulado("Amoxicilina jarabe", "Amoxicilina", "Suspensión", "Frasco x 60 mL", 250, "mg", "Antibiótico", "receta", 6, .40, 2.0, .8, 8.50),
    ProductoSimulado("Azitromicina 500mg", "Azitromicina", "Tableta", "Caja x 30 tabletas", 500, "mg", "Antibiótico", "receta", 4, .35, 1.7, .9, 4.50),
    ProductoSimulado("Ciprofloxacino 500mg", "Ciprofloxacino", "Tableta", "Caja x 100 tabletas", 500, "mg", "Antibiótico", "receta", 3, .30, 1.2, 1.3, 2.20),
    ProductoSimulado("Metronidazol 500mg", "Metronidazol", "Tableta", "Caja x 100 tabletas", 500, "mg", "Antibiótico", "receta", 4, .30, 1.0, 1.4, 1.30),
    ProductoSimulado("Loratadina 10mg", "Loratadina", "Tableta", "Caja x 100 tabletas", 10, "mg", "Antihistamínico", "OTC", 8, .35, 1.1, 2.2, .60),
    ProductoSimulado("Loratadina jarabe", "Loratadina", "Jarabe", "Frasco x 60 mL", 5, "mg", "Antihistamínico", "OTC", 5, .40, 1.0, 2.0, 6.00),
    ProductoSimulado("Cetirizina 10mg", "Cetirizina", "Tableta", "Caja x 100 tabletas", 10, "mg", "Antihistamínico", "OTC", 7, .30, 1.1, 1.8, .70),
    ProductoSimulado("Omeprazol 20mg", "Omeprazol", "Cápsula", "Caja x 100 cápsulas", 20, "mg", "Antiulceroso", "receta", 10, .20, 1.0, 1.0, .80),
    ProductoSimulado("Omeprazol 40mg", "Omeprazol", "Cápsula", "Caja x 50 cápsulas", 40, "mg", "Antiulceroso", "receta", 6, .22, 1.0, 1.0, 1.50),
    ProductoSimulado("Ranitidina 150mg", "Ranitidina", "Tableta", "Caja x 100 tabletas", 150, "mg", "Antiulceroso", "OTC", 7, .25, 1.0, 1.2, .90),
    ProductoSimulado("Metformina 850mg", "Metformina", "Tableta", "Caja x 100 tabletas", 850, "mg", "Antidiabético", "receta", 9, .15, 1.0, 1.0, .90),
    ProductoSimulado("Enalapril 10mg", "Enalapril", "Tableta", "Caja x 100 tabletas", 10, "mg", "Antihipertensivo", "receta", 8, .15, 1.0, 1.0, .70),
    ProductoSimulado("Losartán 50mg", "Losartán", "Tableta", "Caja x 100 tabletas", 50, "mg", "Antihipertensivo", "receta", 7, .15, 1.0, 1.0, 1.10),
    ProductoSimulado("Atorvastatina 20mg", "Atorvastatina", "Tableta", "Caja x 100 tabletas", 20, "mg", "Hipolipemiante", "receta", 6, .18, 1.0, 1.0, 2.50),
    ProductoSimulado("Salbutamol inhalador", "Salbutamol", "Inhalador", "Inhalador x 200 dosis", 100, "mcg", "Broncodilatador", "receta", 4, .40, 2.0, .8, 18.00),
    ProductoSimulado("Dexametasona 4mg", "Dexametasona", "Inyectable", "Ampolla x 2 mL", 4, "mg", "Corticosteroide", "receta", 3, .35, 1.6, .9, 3.50),
    ProductoSimulado("Clotrimazol crema", "Clotrimazol", "Crema", "Tubo x 20 g", 1, "%", "Antifúngico", "OTC", 5, .30, .9, 1.5, 7.50),
    ProductoSimulado("Vitamina C 500mg", "Ácido ascórbico", "Tableta", "Caja x 100 tabletas", 500, "mg", "Vitamina", "OTC", 11, .30, 1.6, 1.1, .40),
    ProductoSimulado("Complejo B", "Vitaminas B", "Tableta", "Caja x 100 tabletas", 1, "UI", "Vitamina", "OTC", 8, .25, 1.1, 1.0, .60),
    ProductoSimulado("Calcio + Vit D", "Carbonato de calcio", "Tableta", "Caja x 60 tabletas", 500, "mg", "Suplemento", "OTC", 6, .20, 1.0, 1.0, 1.20),
    ProductoSimulado("Sulfato Ferroso", "Sulfato ferroso", "Tableta", "Caja x 100 tabletas", 325, "mg", "Suplemento", "OTC", 5, .25, 1.0, 1.0, .80),
    ProductoSimulado("Tramadol 50mg", "Tramadol", "Cápsula", "Caja x 50 cápsulas", 50, "mg", "Analgésico", "receta", 2, .40, 1.0, 1.0, 2.80),
    ProductoSimulado("Betahistina 16mg", "Betahistina", "Tableta", "Caja x 60 tabletas", 16, "mg", "Antivertiginoso", "receta", 3, .25, 1.0, 1.0, 2.20),
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

FACTOR_DISTRITO = {"Miraflores": 1.40, "San Borja": 1.30, "Santiago de Surco": 1.25, "La Molina": 1.20, "San Miguel": 1.10}
DEFAULT_CREATED_AT = datetime(2023, 1, 15, 10, 0, 0).isoformat()


def uuid_deterministico(clave: str) -> str:
    return str(uuid.uuid5(NAMESPACE_UUID, clave))


def codigo_categoria(nombre: str) -> str:
    reemplazos = str.maketrans("ÁÉÍÓÚÜÑáéíóúüñ", "AEIOUUNaeiouun")
    return nombre.translate(reemplazos).upper().replace(" ", "_").replace("-", "_")


def fecha_iso(valor: date) -> str:
    return datetime.combine(valor, datetime.min.time()).isoformat()


def crear_datos_maestros(max_productos: int | None = None) -> dict[str, pd.DataFrame | dict]:
    org_id = uuid_deterministico("organizacion:D&R Farma S.A.C.:20512345678")
    organizaciones = pd.DataFrame([{"id": org_id, "nombre": "D&R Farma S.A.C.", "tipo_identificacion": "ruc", "numero_identificacion": "20512345678", "pais_origen": "PE", "created_at": DEFAULT_CREATED_AT}])

    categorias = pd.DataFrame([{"id": uuid_deterministico(f"categoria:{c}"), "codigo": codigo_categoria(c), "nombre": c, "descripcion": f"Categoría terapéutica {c}", "activa": True, "created_at": DEFAULT_CREATED_AT, "modified_at": None} for c in CATEGORIAS])
    formas = pd.DataFrame([{"id": uuid_deterministico(f"forma:{f}"), "nombre": f} for f in FORMAS])
    unidades = pd.DataFrame([{"id": uuid_deterministico(f"unidad:{simbolo}"), "nombre": nombre, "simbolo": simbolo} for nombre, simbolo in UNIDADES])
    categoria_id = categorias.set_index("nombre")["id"].to_dict()
    forma_id = formas.set_index("nombre")["id"].to_dict()
    unidad_id = unidades.set_index("simbolo")["id"].to_dict()

    distritos = {}
    boticas = []
    for i, (nombre, tipo, ubigeo, distrito, direccion, telefono, _es_drogueria) in enumerate(BOTICAS_RAW, start=1):
        boticas.append({"id": uuid_deterministico(f"botica:{ubigeo}:{nombre}"), "org_id": org_id, "codigo_interno": f"BOT-{i:06d}", "nombre": nombre, "tipo": tipo, "ubigeo": ubigeo, "direccion": direccion, "telefono": telefono, "activa": True, "created_at": DEFAULT_CREATED_AT})
        distritos[ubigeo] = distrito
    boticas = pd.DataFrame(boticas)

    principios_unicos = sorted({p.principio_activo for p in CATALOGO[:max_productos]})
    principios = pd.DataFrame([{"id": uuid_deterministico(f"principio:{p}"), "nombre": p} for p in principios_unicos])
    principio_id = principios.set_index("nombre")["id"].to_dict()

    productos = []
    producto_principio_activo = []
    catalogo_ml = []
    for i, producto in enumerate(CATALOGO[:max_productos], start=1):
        producto_id = uuid_deterministico(f"producto:{producto.nombre_comercial}:{producto.presentacion}")
        productos.append({
            "id": producto_id,
            "org_id": org_id,
            "codigo_interno": f"SKU-{i:06d}",
            "nombre_comercial": producto.nombre_comercial,
            "forma_farmaceutica_id": forma_id[producto.forma],
            "presentacion": producto.presentacion,
            "clasificacion": producto.clasificacion,
            "estado": "activo",
            "categoria_terapeutica_id": categoria_id[producto.categoria],
            "created_at": DEFAULT_CREATED_AT,
            "modified_at": None,
            "modified_by": None,
        })
        producto_principio_activo.append({"id": uuid_deterministico(f"producto-pa:{producto_id}:{producto.principio_activo}"), "producto_id": producto_id, "principio_activo_id": principio_id[producto.principio_activo], "concentracion": producto.concentracion, "unidad_medida_id": unidad_id[producto.unidad], "es_principal": True})
        catalogo_ml.append({"producto_id": producto_id, "categoria_terapeutica": producto.categoria, **producto.__dict__})

    proveedores = []
    for i, (razon, ruc, pais, _lead) in enumerate(PROVEEDORES_RAW, start=1):
        proveedores.append({"id": uuid_deterministico(f"proveedor:{ruc}:{razon}"), "org_id": org_id, "codigo_interno": f"PRV-{i:06d}", "razon_social": razon, "tipo_identificacion": "ruc", "numero_identificacion": ruc, "pais_origen": pais, "moneda_id": None, "activo": True, "created_at": DEFAULT_CREATED_AT})

    proveedor_producto = []
    proveedor_ids = [p["id"] for p in proveedores]
    for i, producto in enumerate(catalogo_ml, start=1):
        proveedor_id = proveedor_ids[(i - 1) % len(proveedor_ids)]
        lead = PROVEEDORES_RAW[(i - 1) % len(PROVEEDORES_RAW)][3]
        proveedor_producto.append({"id": uuid_deterministico(f"proveedor-producto:{proveedor_id}:{producto['producto_id']}"), "proveedor_id": proveedor_id, "producto_id": producto["producto_id"], "lead_time_especifico": lead, "precio_compra_referencial": round(producto["precio_venta_simulado"] * producto["margen_costo_simulado"], 2), "cantidad_minima_compra": int(10 + (i % 4) * 5), "multiplo_empaque": int([1, 6, 10, 12][i % 4]), "activo": True, "created_at": DEFAULT_CREATED_AT})

    return {
        "organizaciones": organizaciones,
        "boticas": boticas,
        "categorias_terapeuticas": categorias,
        "formas_farmaceuticas": formas,
        "unidades_medida": unidades,
        "productos": pd.DataFrame(productos),
        "principios_activos": principios,
        "producto_principio_activo": pd.DataFrame(producto_principio_activo),
        "proveedores": pd.DataFrame(proveedores),
        "proveedor_producto": pd.DataFrame(proveedor_producto),
        "_catalogo_ml": pd.DataFrame(catalogo_ml),
        "_distritos_por_ubigeo": distritos,
    }


def factor_estacional(fecha: date, pico_invierno: float, pico_verano: float) -> float:
    dia_anio = fecha.timetuple().tm_yday
    peso_invierno = max(0.0, np.cos((dia_anio - 196) / 365 * 2 * np.pi))
    peso_verano = max(0.0, np.cos((dia_anio - 30) / 365 * 2 * np.pi))
    return 1 + (pico_invierno - 1) * peso_invierno + (pico_verano - 1) * peso_verano


def simular_operacion(tablas: dict, fecha_inicio: date, fecha_fin: date, semilla: int) -> dict[str, pd.DataFrame]:
    rng = np.random.default_rng(semilla)
    org_id = tablas["organizaciones"].iloc[0]["id"]
    boticas_venta = tablas["boticas"][tablas["boticas"]["tipo"] == "botica"].copy()
    catalogo = tablas["_catalogo_ml"].copy()
    proveedor_producto = tablas["proveedor_producto"].set_index("producto_id").to_dict("index")
    distritos = tablas["_distritos_por_ubigeo"]

    stock: dict[tuple[str, str], int] = {}
    stock_minimo: dict[str, int] = {}
    stock_maximo: dict[str, int] = {}
    ventas = []
    eventos_stock = []
    demanda_diaria = []
    factores_semanales = {}

    for _, producto in catalogo.iterrows():
        pid = producto["producto_id"]
        stock_minimo[pid] = max(15, int(producto["demanda_diaria_base"] * 7))
        stock_maximo[pid] = max(80, int(producto["demanda_diaria_base"] * 45))
        for _, botica in boticas_venta.iterrows():
            distrito = distritos[botica["ubigeo"]]
            clave = (pid, botica["id"])
            stock[clave] = max(40, int(producto["demanda_diaria_base"] * 30 * FACTOR_DISTRITO[distrito]))
            eventos_stock.append({"fecha": fecha_inicio - timedelta(days=1), "org_id": org_id, "producto_id": pid, "ubicacion_tipo": "botica", "ubicacion_id": botica["id"], "cantidad_disponible": stock[clave], "stock_minimo": stock_minimo[pid], "stock_maximo": stock_maximo[pid]})

    secuencia = 0
    fecha = fecha_inicio
    while fecha <= fecha_fin:
        if fecha.weekday() < 6:
            for _, botica in boticas_venta.iterrows():
                distrito = distritos[botica["ubigeo"]]
                for _, producto in catalogo.iterrows():
                    pid = producto["producto_id"]
                    clave = (pid, botica["id"])
                    fecha_semana = fecha - timedelta(days=fecha.weekday())
                    factor_key = (pid, botica["id"], fecha_semana)
                    factores_semanales.setdefault(factor_key, float(np.clip(rng.normal(1.0, 0.16), 0.65, 1.45)))
                    media = producto["demanda_diaria_base"] * factor_estacional(fecha, producto["pico_invierno"], producto["pico_verano"]) * FACTOR_DISTRITO[distrito] * factores_semanales[factor_key]
                    media *= {0: 1.30, 1: 1.20, 2: 1.10, 3: 1.05, 4: 1.10, 5: 0.90}[fecha.weekday()]
                    if fecha.day <= 5:
                        media *= 1.15
                    demanda_real = max(0, int(rng.lognormal(mean=np.log(max(media, 0.1)), sigma=producto["volatilidad"])))
                    cantidad_vendida = min(demanda_real, stock[clave])
                    demanda_insatisfecha = max(demanda_real - cantidad_vendida, 0)
                    stockout_flag = int(demanda_insatisfecha > 0)
                    demanda_diaria.append({"fecha_venta": fecha_iso(fecha), "org_id": org_id, "botica_id": botica["id"], "producto_id": pid, "demanda_real": demanda_real, "cantidad_vendida": cantidad_vendida, "demanda_insatisfecha": demanda_insatisfecha, "stockout_flag": stockout_flag})
                    if cantidad_vendida > 0:
                        stock[clave] -= cantidad_vendida
                        secuencia += 1
                        ventas.append({"id": uuid_deterministico(f"venta:{org_id}:{botica['id']}:{pid}:{fecha.isoformat()}:{secuencia}"), "org_id": org_id, "botica_id": botica["id"], "producto_id": pid, "fecha_venta": fecha_iso(fecha), "cantidad_vendida": cantidad_vendida, "precio_unitario": producto["precio_venta_simulado"], "created_at": fecha_iso(fecha)})
                    if stock[clave] <= stock_minimo[pid]:
                        lead = int(proveedor_producto[pid]["lead_time_especifico"])
                        # Reposición sintética inmediata al vencimiento del lead time promedio acumulado.
                        if fecha.weekday() == 0 or rng.random() < (1 / max(lead, 1)):
                            reposicion = int(max(stock_maximo[pid] - stock[clave], stock_minimo[pid] * 3))
                            stock[clave] += reposicion
                    eventos_stock.append({"fecha": fecha, "org_id": org_id, "producto_id": pid, "ubicacion_tipo": "botica", "ubicacion_id": botica["id"], "cantidad_disponible": stock[clave], "stock_minimo": stock_minimo[pid], "stock_maximo": stock_maximo[pid]})
        fecha += timedelta(days=1)

    return {"ventas_historicas": pd.DataFrame(ventas), "demanda_diaria": pd.DataFrame(demanda_diaria), "eventos_stock": pd.DataFrame(eventos_stock)}


def construir_stock_historico(eventos_stock: pd.DataFrame, fecha_inicio: date, fecha_fin: date) -> pd.DataFrame:
    eventos = eventos_stock.copy()
    eventos["fecha"] = pd.to_datetime(eventos["fecha"])
    semanas = pd.date_range(fecha_inicio - timedelta(days=1), fecha_fin, freq="W-SUN")
    filas = []
    for (producto_id, ubicacion_id), grupo in eventos.groupby(["producto_id", "ubicacion_id"]):
        grupo = grupo.sort_values("fecha")
        for cierre in semanas:
            hist = grupo[grupo["fecha"] <= cierre]
            if hist.empty:
                continue
            fila = hist.iloc[-1]
            filas.append({"id": uuid_deterministico(f"stock-historico:{producto_id}:{ubicacion_id}:{cierre.date()}"), "org_id": fila["org_id"], "producto_id": producto_id, "ubicacion_tipo": fila["ubicacion_tipo"], "ubicacion_id": ubicacion_id, "cantidad_disponible": int(fila["cantidad_disponible"]), "stock_minimo": int(fila["stock_minimo"]), "stock_maximo": int(fila["stock_maximo"]), "fecha_snapshot_dia": cierre.date().isoformat(), "created_at": datetime.combine(cierre.date(), datetime.min.time()).isoformat()})
    return pd.DataFrame(filas)


def construir_dataset_semanal(tablas: dict, fecha_inicio: date, fecha_fin: date) -> pd.DataFrame:
    ventas = tablas["ventas_historicas"].copy()
    ventas["fecha_venta"] = pd.to_datetime(ventas["fecha_venta"])
    ventas["fecha_semana"] = ventas["fecha_venta"].dt.to_period("W-SUN").dt.start_time
    ventas_semanales = ventas.groupby(["org_id", "botica_id", "producto_id", "fecha_semana"], as_index=False)["cantidad_vendida"].sum()

    demanda_diaria = tablas["demanda_diaria"].copy()
    demanda_diaria["fecha_venta"] = pd.to_datetime(demanda_diaria["fecha_venta"])
    demanda_diaria["fecha_semana"] = demanda_diaria["fecha_venta"].dt.to_period("W-SUN").dt.start_time
    demanda_semanal = demanda_diaria.groupby(["org_id", "botica_id", "producto_id", "fecha_semana"], as_index=False).agg(demanda_insatisfecha=("demanda_insatisfecha", "sum"), stockout_flag=("stockout_flag", "max"))

    boticas_venta = tablas["boticas"][tablas["boticas"]["tipo"] == "botica"]
    productos = tablas["productos"]
    semanas = pd.date_range(fecha_inicio, fecha_fin, freq="W-MON")
    grilla = pd.MultiIndex.from_product([boticas_venta["id"], productos["id"], semanas], names=["botica_id", "producto_id", "fecha_semana"]).to_frame(index=False)
    grilla["org_id"] = tablas["organizaciones"].iloc[0]["id"]

    dataset = grilla.merge(ventas_semanales, on=["org_id", "botica_id", "producto_id", "fecha_semana"], how="left")
    dataset["cantidad_vendida"] = dataset["cantidad_vendida"].fillna(0).astype(int)
    dataset = dataset.merge(demanda_semanal, on=["org_id", "botica_id", "producto_id", "fecha_semana"], how="left")
    dataset["demanda_insatisfecha"] = dataset["demanda_insatisfecha"].fillna(0).astype(int)
    dataset["stockout_flag"] = dataset["stockout_flag"].fillna(0).astype(int)

    stock = tablas["stock_historico"].copy()
    stock["fecha_snapshot_dia"] = pd.to_datetime(stock["fecha_snapshot_dia"])
    stock["fecha_semana"] = stock["fecha_snapshot_dia"] + pd.Timedelta(days=1)
    stock_semana = stock.rename(columns={"ubicacion_id": "botica_id", "cantidad_disponible": "stock_inicio_semana"})[["org_id", "botica_id", "producto_id", "fecha_semana", "stock_inicio_semana", "stock_minimo", "stock_maximo"]]
    dataset = dataset.merge(stock_semana, on=["org_id", "botica_id", "producto_id", "fecha_semana"], how="left")

    categorias = tablas["categorias_terapeuticas"][["id", "nombre"]].rename(columns={"id": "categoria_terapeutica_id", "nombre": "categoria_terapeutica"})
    dataset = dataset.merge(productos[["id", "categoria_terapeutica_id"]], left_on="producto_id", right_on="id", how="left").drop(columns=["id"])
    dataset = dataset.merge(categorias, on="categoria_terapeutica_id", how="left").drop(columns=["categoria_terapeutica_id"])
    dataset = dataset.merge(tablas["proveedor_producto"][["producto_id", "lead_time_especifico"]], on="producto_id", how="left").rename(columns={"lead_time_especifico": "lead_time_dias"})
    columnas = ["fecha_semana", "org_id", "botica_id", "producto_id", "categoria_terapeutica", "cantidad_vendida", "stock_inicio_semana", "stock_minimo", "stock_maximo", "lead_time_dias", "stockout_flag", "demanda_insatisfecha"]
    dataset = dataset[columnas].sort_values(["org_id", "botica_id", "producto_id", "fecha_semana"])
    dataset["fecha_semana"] = dataset["fecha_semana"].dt.date.astype(str)
    return dataset.reset_index(drop=True)


def validar_dataset(tablas: dict, dataset: pd.DataFrame) -> None:
    productos = set(tablas["productos"]["id"])
    boticas = set(tablas["boticas"].query("tipo == 'botica'")["id"])
    categorias = set(tablas["categorias_terapeuticas"]["id"])
    assert tablas["productos"]["id"].is_unique
    assert tablas["productos"]["codigo_interno"].is_unique
    assert set(tablas["productos"]["categoria_terapeutica_id"]).issubset(categorias)
    assert set(tablas["productos"]["clasificacion"]).issubset({"OTC", "receta", "generico"})
    assert set(tablas["productos"]["estado"]).issubset({"activo", "inactivo", "descontinuado"})
    assert set(tablas["boticas"]["tipo"]).issubset({"drogueria", "botica"})
    assert set(tablas["ventas_historicas"]["producto_id"]).issubset(productos)
    assert set(tablas["ventas_historicas"]["botica_id"]).issubset(boticas)
    assert (tablas["ventas_historicas"]["cantidad_vendida"] >= 0).all()
    assert "codigo_atc" not in tablas["principios_activos"].columns
    assert "laboratorio" not in tablas["productos"].columns
    assert "cantidad_disponible" in tablas["stock_historico"].columns
    assert "categoria_terapeutica_id" in tablas["productos"].columns
    assert not dataset.duplicated(["org_id", "botica_id", "producto_id", "fecha_semana"]).any()
    assert (dataset["cantidad_vendida"] >= 0).all()


def exportar_csvs(tablas: dict, dataset: pd.DataFrame, dir_salida: Path) -> None:
    dir_salida.mkdir(parents=True, exist_ok=True)
    exportables = ["organizaciones", "boticas", "categorias_terapeuticas", "formas_farmaceuticas", "unidades_medida", "productos", "principios_activos", "producto_principio_activo", "proveedores", "proveedor_producto", "ventas_historicas", "stock_historico"]
    for nombre in exportables:
        ruta = dir_salida / f"{nombre}.csv"
        tablas[nombre].to_csv(ruta, index=False, encoding="utf-8")
        log.info("%-34s %8d filas", ruta.name, len(tablas[nombre]))
    dataset.to_csv(dir_salida / "features_entrenamiento.csv", index=False, encoding="utf-8")
    log.info("%-34s %8d filas", "features_entrenamiento.csv", len(dataset))


def ejecutar(dir_salida: Path = DIR_DATOS, fecha_inicio: date = FECHA_INICIO, fecha_fin: date = FECHA_FIN, max_productos: int | None = None, semilla: int = SEMILLA) -> pd.DataFrame:
    maestros = crear_datos_maestros(max_productos=max_productos)
    operacion = simular_operacion(maestros, fecha_inicio, fecha_fin, semilla)
    tablas = {**maestros, **operacion}
    tablas["stock_historico"] = construir_stock_historico(tablas["eventos_stock"], fecha_inicio, fecha_fin)
    dataset = construir_dataset_semanal(tablas, fecha_inicio, fecha_fin)
    validar_dataset(tablas, dataset)
    exportar_csvs(tablas, dataset, dir_salida)
    return dataset


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera datasets sintéticos reproducibles para modelo ML.")
    parser.add_argument("--output-dir", type=Path, default=DIR_DATOS)
    parser.add_argument("--fast", action="store_true", help="Genera un dataset reducido para pruebas.")
    parser.add_argument("--max-productos", type=int, default=None)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    if args.fast:
        ejecutar(dir_salida=args.output_dir, fecha_inicio=date(2025, 1, 6), fecha_fin=date(2025, 10, 5), max_productos=args.max_productos or 8)
    else:
        ejecutar(dir_salida=args.output_dir, max_productos=args.max_productos)


if __name__ == "__main__":
    main()
