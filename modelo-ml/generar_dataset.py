# -*- coding: utf-8 -*-
"""
================================================================================
 generar_dataset.py
--------------------------------------------------------------------------------
 Generador de dataset sintético farmacéutico para entrenamiento del modelo
 híbrido SARIMA + XGBoost.

 Proyecto : Plataforma Web Serverless + ML para controlar el sobrestock y
            desabastecimiento de medicamentos en boticas del Perú.
 Empresa  : D&R Farma — UPC 2026
 Versión  : 2.0  (alineada al modelo de datos Supabase v4)

--------------------------------------------------------------------------------
 ¿Qué genera este script?
--------------------------------------------------------------------------------
 Un conjunto de archivos CSV que **emulan exactamente** las tablas que vivirán
 en PostgreSQL gestionado por Supabase. Cada CSV corresponde a una tabla del
 modelo de datos v4, con los mismos nombres de columna, tipos y FKs por UUID.

 Esto permite que el pipeline ML (`pipeline_modelo_v1.py`) consuma el dataset
 con la misma lógica que usaría sobre la vista `features_entrenamiento`
 cuando lea desde Supabase vía PostgREST en producción.

 Tablas generadas (5 dominios del modelo de datos):

   Dominio 1 — Organización y Acceso
     • organizaciones.csv
     • boticas.csv

   Dominio 2 — Catálogo de Productos
     • productos.csv
     • precios.csv

   Dominio 3 — Inventario
     • stock_ubicaciones.csv
     • lotes.csv
     • movimientos_inventario.csv      <-- tabla central para ML

   Dominio 4 — Distribución y Proveedores
     • proveedores.csv

 Adicionalmente:
     • features_entrenamiento.csv      <-- replica de la VISTA SQL del backend,
                                           lista para ser leída por el pipeline.

--------------------------------------------------------------------------------
 Reglas de negocio respetadas (ACP v1.3 + Arquitectura Lógica v4)
--------------------------------------------------------------------------------
 - Solo medicamentos: sin dispositivos médicos, higiene ni sanitarios.
 - Sin medicamentos refrigerados ni con cambios regulatorios.
 - Sin variables exógenas (clima, epidemiología) — solo señal interna.
 - Sin datos de cliente (nombre, DNI, etc.).
 - Sin promociones ni feriados explícitos.
 - tipo_movimiento es OBLIGATORIO en cada registro
   (entrada / salida / ajuste / merma / devolucion).
 - Solo 'salida' representa demanda real para el modelo ML.
 - Formato fecha: ISO 8601 (compatible con timestamptz de PostgreSQL).
 - IDs en formato UUID v4 (compatibles con `gen_random_uuid()` de Postgres).

--------------------------------------------------------------------------------
 Uso
--------------------------------------------------------------------------------
     pip install pandas numpy
     python generar_dataset.py

 Salida: directorio ./data/ con todos los CSV listos para Supabase.
================================================================================
"""

from __future__ import annotations

import logging
import random
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd


# ──────────────────────────────────────────────────────────────────────────────
#  CONFIGURACIÓN GLOBAL
# ──────────────────────────────────────────────────────────────────────────────
# Semillas para reproducibilidad: si dos personas ejecutan el script obtienen
# exactamente el mismo dataset. Crítico para validar el modelo en revisiones.
SEMILLA = 42
random.seed(SEMILLA)
np.random.seed(SEMILLA)

# Período cubierto por el dataset.
# 29 meses (ene 2024 → may 2026) para cubrir 24 meses mínimos de SARIMA
# más 5 meses holdout hasta la fecha actual del proyecto.
FECHA_INICIO = date(2024, 1, 1)
FECHA_FIN = date(2026, 5, 10)

# Directorio de salida (se crea si no existe).
DIR_SALIDA = Path("./data")

# Logger limpio: sustituye los `print` esparcidos del script anterior.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("dataset")


def _uuid() -> str:
    """Devuelve un UUID v4 como string. Equivalente a gen_random_uuid() en PG."""
    return str(uuid.uuid4())


# ──────────────────────────────────────────────────────────────────────────────
#  DOMINIO 1 — ORGANIZACIÓN Y BOTICAS
# ──────────────────────────────────────────────────────────────────────────────
# La organización es D&R Farma (caso de estudio del proyecto).
# Cinco boticas en Lima Metropolitana cubren el alcance del piloto (ACP).

ORG_ID = _uuid()

ORGANIZACION = {
    "id": ORG_ID,
    "nombre": "D&R Farma S.A.C.",
    "tipo_identificacion": "ruc",
    "numero_identificacion": "20512345678",
    "pais_origen": "PE",
    "created_at": datetime(2023, 1, 15, 10, 0, 0).isoformat(),
}

# Cada botica tiene su ubigeo INEI (2 dpto + 2 prov + 2 dist) y distrito.
# La droguería central no recibe ventas: solo produce transferencias.
BOTICAS_RAW = [
    # (nombre, ubigeo, distrito, es_drogueria)
    ("Droguería Central D&R", "150101", "Cercado de Lima", True),
    ("Botica D&R Miraflores", "150122", "Miraflores", False),
    ("Botica D&R San Borja", "150131", "San Borja", False),
    ("Botica D&R San Miguel", "150136", "San Miguel", False),
    ("Botica D&R Surco", "150141", "Santiago de Surco", False),
    ("Botica D&R La Molina", "150114", "La Molina", False),
]

BOTICAS: list[dict] = []
for nombre, ubigeo, distrito, es_drogueria in BOTICAS_RAW:
    BOTICAS.append({
        "id": _uuid(),
        "org_id": ORG_ID,
        "nombre": nombre,
        "ubigeo": ubigeo,
        "distrito": distrito,
        "activa": True,
        "es_drogueria": es_drogueria,  # campo auxiliar (no se exporta a Supabase)
    })

# Atajos para el resto del script.
DROGUERIA = next(b for b in BOTICAS if b["es_drogueria"])
BOTICAS_VENTA = [b for b in BOTICAS if not b["es_drogueria"]]

# Factor multiplicativo de demanda por distrito (refleja poder adquisitivo
# y densidad farmacéutica). Calibrado con literatura local.
FACTOR_DISTRITO = {
    "Miraflores": 1.40,
    "San Borja": 1.30,
    "Santiago de Surco": 1.25,
    "La Molina": 1.20,
    "San Miguel": 1.10,
}


# ──────────────────────────────────────────────────────────────────────────────
#  DOMINIO 2 — CATÁLOGO DE PRODUCTOS
# ──────────────────────────────────────────────────────────────────────────────
# 30 SKU farmacéuticos peruanos realistas. Todos cumplen las exclusiones del
# ACP: sin refrigerados (no hay vacunas ni insulinas inyectables), sin
# cambios regulatorios y sin productos no-farmacológicos.

@dataclass(frozen=True)
class ProductoCatalogo:
    """Definición declarativa de un SKU. Usar dataclass mejora la legibilidad
    frente a tuplas posicionales y permite autocompletado en IDEs."""
    nombre_comercial: str
    principio_activo: str
    forma_farmaceutica: str
    concentracion: str
    laboratorio: str
    categoria_terapeutica: str
    clasificacion: str           # 'OTC' | 'receta' | 'generico'
    requiere_receta: bool
    demanda_diaria_base: float   # unidades vendidas por día por botica
    volatilidad: float           # coeficiente de variación lognormal
    pico_invierno: float         # multiplicador jun–ago
    pico_verano: float           # multiplicador oct–feb
    precio_venta: float          # S/ por unidad
    margen_costo: float = 0.55   # costo = precio * margen_costo


CATALOGO: list[ProductoCatalogo] = [
    # ── Analgésicos / antiinflamatorios (alta rotación, pico invierno) ──
    ProductoCatalogo("Paracetamol 500mg",  "Paracetamol",   "Tableta",   "500mg",  "Farmindustria",   "Analgésico",       "OTC",     False, 12, 0.30, 1.80, 1.10, 0.50),
    ProductoCatalogo("Paracetamol 1g",     "Paracetamol",   "Tableta",   "1g",     "Farmindustria",   "Analgésico",       "OTC",     False,  8, 0.25, 1.70, 1.00, 0.80),
    ProductoCatalogo("Ibuprofeno 400mg",   "Ibuprofeno",    "Tableta",   "400mg",  "Medifarma",       "Antiinflamatorio", "OTC",     False,  9, 0.28, 1.50, 1.00, 0.70),
    ProductoCatalogo("Ibuprofeno 600mg",   "Ibuprofeno",    "Tableta",   "600mg",  "Medifarma",       "Antiinflamatorio", "receta",  True,   5, 0.30, 1.40, 1.00, 1.20),
    ProductoCatalogo("Diclofenaco 50mg",   "Diclofenaco",   "Tableta",   "50mg",   "Farmindustria",   "Antiinflamatorio", "OTC",     False,  6, 0.30, 1.30, 1.00, 0.60),
    ProductoCatalogo("Dipirona 500mg",     "Metamizol",     "Tableta",   "500mg",  "Farmindustria",   "Analgésico",       "OTC",     False,  8, 0.28, 1.50, 1.00, 0.45),

    # ── Antibióticos (pico fuerte de invierno) ──
    ProductoCatalogo("Amoxicilina 500mg",  "Amoxicilina",   "Cápsula",   "500mg",  "GlaxoSmithKline", "Antibiótico",      "receta",  True,   7, 0.35, 1.90, 0.90, 1.80),
    ProductoCatalogo("Amoxicilina jarabe", "Amoxicilina",   "Suspensión","250mg/5ml","GlaxoSmithKline","Antibiótico",     "receta",  True,   6, 0.40, 2.00, 0.80, 8.50),
    ProductoCatalogo("Azitromicina 500mg", "Azitromicina",  "Tableta",   "500mg",  "Pfizer",          "Antibiótico",      "receta",  True,   4, 0.35, 1.70, 0.90, 4.50),
    ProductoCatalogo("Ciprofloxacino 500mg","Ciprofloxacino","Tableta",  "500mg",  "Bayer",           "Antibiótico",      "receta",  True,   3, 0.30, 1.20, 1.30, 2.20),
    ProductoCatalogo("Metronidazol 500mg", "Metronidazol",  "Tableta",   "500mg",  "Medifarma",       "Antibiótico",      "receta",  True,   4, 0.30, 1.00, 1.40, 1.30),

    # ── Antihistamínicos (pico verano por alergias) ──
    ProductoCatalogo("Loratadina 10mg",    "Loratadina",    "Tableta",   "10mg",   "Schering-Plough", "Antihistamínico",  "OTC",     False,  8, 0.35, 1.10, 2.20, 0.60),
    ProductoCatalogo("Loratadina jarabe",  "Loratadina",    "Jarabe",    "5mg/5ml","Schering-Plough", "Antihistamínico",  "OTC",     False,  5, 0.40, 1.00, 2.00, 6.00),
    ProductoCatalogo("Cetirizina 10mg",    "Cetirizina",    "Tableta",   "10mg",   "UCB Pharma",      "Antihistamínico",  "OTC",     False,  7, 0.30, 1.10, 1.80, 0.70),

    # ── Crónicos (demanda muy estable, sin estacionalidad) ──
    ProductoCatalogo("Omeprazol 20mg",     "Omeprazol",     "Cápsula",   "20mg",   "AstraZeneca",     "Antiulceroso",     "receta",  True,  10, 0.20, 1.00, 1.00, 0.80),
    ProductoCatalogo("Omeprazol 40mg",     "Omeprazol",     "Cápsula",   "40mg",   "AstraZeneca",     "Antiulceroso",     "receta",  True,   6, 0.22, 1.00, 1.00, 1.50),
    ProductoCatalogo("Ranitidina 150mg",   "Ranitidina",    "Tableta",   "150mg",  "Medifarma",       "Antiulceroso",     "OTC",     False,  7, 0.25, 1.00, 1.20, 0.90),
    ProductoCatalogo("Metformina 850mg",   "Metformina",    "Tableta",   "850mg",  "Merck",           "Antidiabético",    "receta",  True,   9, 0.15, 1.00, 1.00, 0.90),
    ProductoCatalogo("Enalapril 10mg",     "Enalapril",     "Tableta",   "10mg",   "AC Farma",        "Antihipertensivo", "receta",  True,   8, 0.15, 1.00, 1.00, 0.70),
    ProductoCatalogo("Losartán 50mg",      "Losartán",      "Tableta",   "50mg",   "AC Farma",        "Antihipertensivo", "receta",  True,   7, 0.15, 1.00, 1.00, 1.10),
    ProductoCatalogo("Atorvastatina 20mg", "Atorvastatina", "Tableta",   "20mg",   "Pfizer",          "Hipolipemiante",   "receta",  True,   6, 0.18, 1.00, 1.00, 2.50),

    # ── Respiratorios (pico fuerte invierno) ──
    ProductoCatalogo("Salbutamol inhalador","Salbutamol",   "Inhalador", "100mcg", "GlaxoSmithKline", "Broncodilatador",  "receta",  True,   4, 0.40, 2.00, 0.80, 18.00),
    ProductoCatalogo("Dexametasona 4mg",   "Dexametasona",  "Inyectable","4mg/ml", "AC Farma",        "Corticosteroide",  "receta",  True,   3, 0.35, 1.60, 0.90, 3.50),

    # ── Antifúngicos (pico verano por humedad) ──
    ProductoCatalogo("Clotrimazol crema",  "Clotrimazol",   "Crema",     "1%",     "Bayer",           "Antifúngico",      "OTC",     False,  5, 0.30, 0.90, 1.50, 7.50),

    # ── Vitaminas y suplementos (pico invierno por prevención) ──
    ProductoCatalogo("Vitamina C 500mg",   "Ácido ascórbico","Tableta",  "500mg",  "Farmindustria",   "Vitamina",         "OTC",     False, 11, 0.30, 1.60, 1.10, 0.40),
    ProductoCatalogo("Complejo B",         "Vitaminas B",   "Tableta",   "Complejo","Roemmers",       "Vitamina",         "OTC",     False,  8, 0.25, 1.10, 1.00, 0.60),
    ProductoCatalogo("Calcio + Vit D",     "Carbonato Ca",  "Tableta",   "500mg+200UI","Roemmers",    "Suplemento",       "OTC",     False,  6, 0.20, 1.00, 1.00, 1.20),
    ProductoCatalogo("Sulfato Ferroso",    "Sulfato ferroso","Tableta",  "325mg",  "Farmindustria",   "Suplemento",       "OTC",     False,  5, 0.25, 1.00, 1.00, 0.80),

    # ── Otros ──
    ProductoCatalogo("Tramadol 50mg",      "Tramadol",      "Cápsula",   "50mg",   "AC Farma",        "Analgésico",       "receta",  True,   2, 0.40, 1.00, 1.00, 2.80),
    ProductoCatalogo("Betahistina 16mg",   "Betahistina",   "Tableta",   "16mg",   "AC Farma",        "Antivertiginoso",  "receta",  True,   3, 0.25, 1.00, 1.00, 2.20),
]


# ──────────────────────────────────────────────────────────────────────────────
#  DOMINIO 4 — PROVEEDORES (lead_time_dias es feature "oro" para ML)
# ──────────────────────────────────────────────────────────────────────────────
PROVEEDORES_RAW = [
    # (razon_social, ruc, pais, lead_time_dias)
    ("Distribuidora Drokasa S.A.",     "20100123456", "PE", 3),
    ("Quicornac Distribuciones S.A.C.","20100789012", "PE", 5),
    ("Albis Pharma Perú S.A.",         "20100345678", "PE", 7),
    ("Farmacéutica Internacional S.A.","20100901234", "PE", 10),
    ("Laboratorios Roche del Perú",    "20100567890", "PE", 14),
]

PROVEEDORES: list[dict] = []
for razon, ruc, pais, lead in PROVEEDORES_RAW:
    PROVEEDORES.append({
        "id": _uuid(),
        "org_id": ORG_ID,
        "razon_social": razon,
        "tipo_identificacion": "ruc",
        "numero_identificacion": ruc,
        "pais_origen": pais,
        "lead_time_dias": lead,
        "contacto": None,
        "activo": True,
    })


# ──────────────────────────────────────────────────────────────────────────────
#  GENERACIÓN DE LA SEÑAL DE DEMANDA (corazón del simulador)
# ──────────────────────────────────────────────────────────────────────────────

def factor_estacional(fecha: date, pico_invierno: float, pico_verano: float) -> float:
    """
    Modela la estacionalidad farmacéutica peruana usando una **transición suave**
    en lugar de un escalón mes-a-mes. Esto produce series más realistas (sin
    saltos artificiales el día 1 de cada mes) y SARIMA aprende mejor el patrón.

    - Junio–agosto:    máximo invierno (gripe, infecciones)
    - Octubre–febrero: máximo verano (alergias, hongos)
    - Resto:           transiciones suaves
    """
    # Día del año normalizado a [0, 2π].
    dia_anio = fecha.timetuple().tm_yday
    # En Perú, el pico de invierno cae alrededor del día 196 (15 julio).
    fase_invierno = np.cos((dia_anio - 196) / 365 * 2 * np.pi)
    fase_verano = np.cos((dia_anio - 30) / 365 * 2 * np.pi)  # pico ~30 enero

    # Cada fase es 1 cuando estamos en el pico, 0 en el opuesto.
    peso_invierno = max(0, fase_invierno)
    peso_verano = max(0, fase_verano)

    # Mezcla ponderada con base 1 (línea base anual).
    return (
        1.0
        + (pico_invierno - 1.0) * peso_invierno
        + (pico_verano - 1.0) * peso_verano
    )


def factor_dia_semana(fecha: date) -> float:
    """Tráfico por día. Lun–vie altos, sáb medio, dom muy bajo."""
    factores = {0: 1.30, 1: 1.20, 2: 1.10, 3: 1.05, 4: 1.10, 5: 0.90, 6: 0.55}
    return factores[fecha.weekday()]


def factor_inicio_mes(fecha: date) -> float:
    """Pico moderado los primeros 5 días del mes (efecto quincena/sueldo)."""
    return 1.15 if fecha.day <= 5 else 1.0


def cantidad_demandada(
    producto: ProductoCatalogo,
    fecha: date,
    distrito: str,
    stock_actual: int,
    rng: np.random.Generator,
) -> int:
    """
    Genera la cantidad demandada en un día concreto para un (producto, botica).

    Modelo:
        demanda = base * f_estacion * f_dia_sem * f_inicio_mes * f_distrito
                  * ruido_lognormal
                  capada por stock disponible
    """
    mu = (
        producto.demanda_diaria_base
        * factor_estacional(fecha, producto.pico_invierno, producto.pico_verano)
        * factor_dia_semana(fecha)
        * factor_inicio_mes(fecha)
        * FACTOR_DISTRITO.get(distrito, 1.0)
    )

    # Lognormal: garantiza no-negatividad y captura colas largas (días fuertes).
    cantidad = int(rng.lognormal(mean=np.log(max(mu, 0.1)), sigma=producto.volatilidad))
    return max(0, min(cantidad, stock_actual))


def numero_lote(producto: ProductoCatalogo, fecha: date) -> str:
    """Genera un número de lote con formato trazable: LT-{INICIALES}-{YYYYMM}-{SEQ}."""
    iniciales = "".join(w[0] for w in producto.nombre_comercial.split()[:2]).upper()
    seq = random.randint(100, 999)
    return f"LT-{iniciales}-{fecha:%Y%m}-{seq}"


def fecha_vencimiento(desde: date) -> date:
    """Vencimiento entre 6 meses y 3 años (típico farmacéutico)."""
    return desde + timedelta(days=random.randint(180, 1095))


# ──────────────────────────────────────────────────────────────────────────────
#  GENERACIÓN DE LAS TABLAS DE INVENTARIO Y MOVIMIENTOS
# ──────────────────────────────────────────────────────────────────────────────

def generar_dominios() -> dict[str, pd.DataFrame]:
    """
    Genera todas las tablas del modelo de datos en el orden correcto, respetando
    las dependencias de FK. Devuelve un diccionario {nombre_tabla: DataFrame}.
    """
    log.info("Período: %s → %s (%d días)",
             FECHA_INICIO, FECHA_FIN, (FECHA_FIN - FECHA_INICIO).days + 1)
    log.info("Boticas: %d (1 droguería + %d boticas de venta)",
             len(BOTICAS), len(BOTICAS_VENTA))
    log.info("SKU activos: %d", len(CATALOGO))

    rng = np.random.default_rng(SEMILLA)

    # ── Tabla `productos` ─────────────────────────────────────────────────────
    productos_rows: list[dict] = []
    producto_ids: dict[str, str] = {}  # nombre → uuid (lookup interno)

    for i, p in enumerate(CATALOGO, start=1):
        pid = _uuid()
        producto_ids[p.nombre_comercial] = pid
        productos_rows.append({
            "id": pid,
            "org_id": ORG_ID,
            "codigo_interno": f"SKU-{i:03d}",
            "nombre_comercial": p.nombre_comercial,
            "principio_activo": p.principio_activo,
            "forma_farmaceutica": p.forma_farmaceutica,
            "concentracion": p.concentracion,
            "laboratorio": p.laboratorio,
            "codigo_barras": f"77512300{i:04d}",   # EAN-13 sintético
            "categoria_terapeutica": p.categoria_terapeutica,
            "clasificacion": p.clasificacion,
            "requiere_receta": p.requiere_receta,
            "estado": "activo",
        })

    # ── Tabla `precios` (un precio vigente por producto, sin botica = base) ──
    precios_rows: list[dict] = []
    for p in CATALOGO:
        precios_rows.append({
            "id": _uuid(),
            "producto_id": producto_ids[p.nombre_comercial],
            "botica_id": None,            # NULL = precio base de la organización
            "precio_venta": round(p.precio_venta, 2),
            "precio_costo": round(p.precio_venta * p.margen_costo, 2),
            "vigente_desde": datetime(2024, 1, 1).isoformat(),
            "vigente_hasta": None,        # NULL = precio actualmente vigente
        })

    # ── Estado mutable por (producto, botica): stock + lote activo ────────────
    # Se inicializa con un stock razonable: ~30 días de demanda esperada.
    stock: dict[tuple[str, str], int] = {}
    lote_actual: dict[tuple[str, str], dict] = {}

    for p in CATALOGO:
        for b in BOTICAS_VENTA:
            stock_inicial = max(40, int(p.demanda_diaria_base * 30 *
                                         FACTOR_DISTRITO.get(b["distrito"], 1.0)))
            stock[(p.nombre_comercial, b["id"])] = stock_inicial

    # Stock mínimo: ~7 días de cobertura → umbral de alerta de quiebre.
    stock_minimo: dict[str, int] = {
        p.nombre_comercial: max(15, int(p.demanda_diaria_base * 7))
        for p in CATALOGO
    }

    # ── Generación día a día ─────────────────────────────────────────────────
    movimientos: list[dict] = []
    lotes: list[dict] = []

    fecha = FECHA_INICIO
    total_dias = (FECHA_FIN - FECHA_INICIO).days + 1
    proveedor_default = PROVEEDORES[0]["id"]

    while fecha <= FECHA_FIN:
        for botica in BOTICAS_VENTA:
            bid = botica["id"]
            distrito = botica["distrito"]

            for p in CATALOGO:
                pid = producto_ids[p.nombre_comercial]
                clave = (p.nombre_comercial, bid)
                stock_pre = stock[clave]

                # ─── 1. REPOSICIÓN (entrada) si bajamos del mínimo ──────────
                if stock_pre < stock_minimo[p.nombre_comercial]:
                    cant_repo = random.randint(stock_minimo[p.nombre_comercial] * 4,
                                               stock_minimo[p.nombre_comercial] * 8)
                    venc = fecha_vencimiento(fecha)
                    nuevo_lote = {
                        "id": _uuid(),
                        "producto_id": pid,
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": bid,
                        "numero_lote": numero_lote(p, fecha),
                        "fecha_vencimiento": venc.isoformat(),
                        "cantidad": cant_repo,
                        "proveedor_id": random.choice(PROVEEDORES)["id"],
                    }
                    lotes.append(nuevo_lote)
                    lote_actual[clave] = nuevo_lote
                    stock[clave] += cant_repo

                    movimientos.append({
                        "id": _uuid(),
                        "producto_id": pid,
                        "lote_id": nuevo_lote["id"],
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": bid,
                        "tipo_movimiento": "entrada",
                        "cantidad": cant_repo,
                        "motivo": "Reposición por stock bajo mínimo",
                        "usuario_id": _uuid(),
                        "transferencia_id": None,
                        "created_at": datetime.combine(fecha, datetime.min.time()).isoformat(),
                    })

                # ─── 2. SALIDAS (demanda real, único input válido para ML) ──
                # Se generan solo lun–sáb (los domingos algunas boticas cierran).
                if fecha.weekday() < 6:
                    cant = cantidad_demandada(p, fecha, distrito, stock[clave], rng)
                    if cant > 0:
                        # Si no hay lote activo (caso borde), crear uno mínimo.
                        if clave not in lote_actual:
                            venc = fecha_vencimiento(fecha)
                            nuevo_lote = {
                                "id": _uuid(),
                                "producto_id": pid,
                                "ubicacion_tipo": "botica",
                                "ubicacion_id": bid,
                                "numero_lote": numero_lote(p, fecha),
                                "fecha_vencimiento": venc.isoformat(),
                                "cantidad": stock[clave],
                                "proveedor_id": proveedor_default,
                            }
                            lotes.append(nuevo_lote)
                            lote_actual[clave] = nuevo_lote

                        stock[clave] -= cant

                        movimientos.append({
                            "id": _uuid(),
                            "producto_id": pid,
                            "lote_id": lote_actual[clave]["id"],
                            "ubicacion_tipo": "botica",
                            "ubicacion_id": bid,
                            "tipo_movimiento": "salida",
                            "cantidad": cant,
                            "motivo": "Venta al cliente",
                            "usuario_id": _uuid(),
                            "transferencia_id": None,
                            "created_at": datetime.combine(fecha, datetime.min.time()).isoformat(),
                        })

                # ─── 3. MERMA ocasional (1% diario, simula vencidos/dañados) ──
                if random.random() < 0.01 and stock[clave] > 5:
                    cant_merma = random.randint(1, 3)
                    stock[clave] -= cant_merma
                    movimientos.append({
                        "id": _uuid(),
                        "producto_id": pid,
                        "lote_id": lote_actual[clave]["id"],
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": bid,
                        "tipo_movimiento": "merma",
                        "cantidad": cant_merma,
                        "motivo": random.choice([
                            "Producto vencido",
                            "Daño en almacén",
                            "Mal almacenamiento",
                        ]),
                        "usuario_id": _uuid(),
                        "transferencia_id": None,
                        "created_at": datetime.combine(fecha, datetime.min.time()).isoformat(),
                    })

                # ─── 4. DEVOLUCIÓN ocasional (0.3% diario; no es demanda) ──
                if random.random() < 0.003 and stock[clave] > 0:
                    cant_dev = 1
                    stock[clave] += cant_dev
                    movimientos.append({
                        "id": _uuid(),
                        "producto_id": pid,
                        "lote_id": lote_actual[clave]["id"],
                        "ubicacion_tipo": "botica",
                        "ubicacion_id": bid,
                        "tipo_movimiento": "devolucion",
                        "cantidad": cant_dev,
                        "motivo": "Devolución de cliente",
                        "usuario_id": _uuid(),
                        "transferencia_id": None,
                        "created_at": datetime.combine(fecha, datetime.min.time()).isoformat(),
                    })

        fecha += timedelta(days=1)
        if (fecha - FECHA_INICIO).days % 90 == 0:
            log.info("  → progreso: %s (%d movimientos)", fecha, len(movimientos))

    log.info("Movimientos totales generados: %d", len(movimientos))

    # ── Tabla `stock_ubicaciones` (snapshot al final del período) ─────────────
    stock_rows: list[dict] = []
    for p in CATALOGO:
        for b in BOTICAS_VENTA:
            stock_rows.append({
                "id": _uuid(),
                "producto_id": producto_ids[p.nombre_comercial],
                "ubicacion_tipo": "botica",
                "ubicacion_id": b["id"],
                "cantidad_disponible": stock[(p.nombre_comercial, b["id"])],
                "stock_minimo": stock_minimo[p.nombre_comercial],
                "updated_at": datetime.combine(FECHA_FIN, datetime.min.time()).isoformat(),
            })

    # ── Tabla `boticas` final (sin el campo auxiliar es_drogueria) ────────────
    boticas_export = [
        {k: v for k, v in b.items() if k != "es_drogueria"}
        for b in BOTICAS
    ]

    return {
        "organizaciones": pd.DataFrame([ORGANIZACION]),
        "boticas": pd.DataFrame(boticas_export),
        "productos": pd.DataFrame(productos_rows),
        "precios": pd.DataFrame(precios_rows),
        "proveedores": pd.DataFrame(PROVEEDORES),
        "lotes": pd.DataFrame(lotes),
        "stock_ubicaciones": pd.DataFrame(stock_rows),
        "movimientos_inventario": pd.DataFrame(movimientos),
    }


# ──────────────────────────────────────────────────────────────────────────────
#  VISTA `features_entrenamiento` — réplica del JOIN SQL del backend
# ──────────────────────────────────────────────────────────────────────────────
# En producción esta vista vive en PostgreSQL y la consume Cloud Run vía
# PostgREST con service_key. Aquí la reproducimos en Python para que el
# pipeline ML pueda consumir un único CSV ya joinado.

def construir_features_entrenamiento(tablas: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Replica la vista `features_entrenamiento` documentada en la arquitectura
    física, sección "Feature layer SQL".

    Filtros aplicados (alineados al ETL de Cloud Run):
        - Solo tipo_movimiento = 'salida' (demanda real)
        - Solo productos con estado = 'activo'
    """
    log.info("Construyendo vista features_entrenamiento (réplica del JOIN SQL)...")

    mov = tablas["movimientos_inventario"].copy()
    productos = tablas["productos"].copy()
    boticas = tablas["boticas"].copy()
    stock = tablas["stock_ubicaciones"].copy()
    lotes = tablas["lotes"].copy()
    precios = tablas["precios"].copy()
    proveedores = tablas["proveedores"].copy()

    # Filtro 1: solo salidas → única señal válida de demanda.
    mov = mov[mov["tipo_movimiento"] == "salida"]
    # Filtro 2: solo productos activos.
    productos_activos = productos[productos["estado"] == "activo"]["id"]
    mov = mov[mov["producto_id"].isin(productos_activos)]

    # JOINs replican exactamente la vista SQL.
    df = (
        mov.merge(productos, left_on="producto_id", right_on="id",
                  suffixes=("", "_prod"))
           .merge(boticas, left_on="ubicacion_id", right_on="id",
                  suffixes=("", "_bot"))
           .merge(lotes[["id", "fecha_vencimiento", "proveedor_id"]],
                  left_on="lote_id", right_on="id",
                  suffixes=("", "_lote"))
    )

    # Stock: join por producto + ubicación (fuente de verdad actual).
    df = df.merge(
        stock[["producto_id", "ubicacion_id", "cantidad_disponible", "stock_minimo"]],
        on=["producto_id", "ubicacion_id"],
        how="left",
    )

    # Precios: el precio vigente es el que tiene vigente_hasta IS NULL.
    precios_vigentes = precios[precios["vigente_hasta"].isna()][
        ["producto_id", "precio_venta", "precio_costo"]
    ]
    df = df.merge(precios_vigentes, on="producto_id", how="left")

    # Lead time del proveedor.
    df = df.merge(
        proveedores[["id", "lead_time_dias"]].rename(columns={"id": "proveedor_id"}),
        on="proveedor_id", how="left",
    )

    # Selección final con el contrato de columnas que el pipeline espera.
    df = df.rename(columns={
        "created_at": "fecha_venta",
        "ubicacion_id": "botica_id",
        "cantidad_disponible": "stock_actual",
        "nombre": "nombre_botica",
    })

    columnas_salida = [
        "fecha_venta",
        "producto_id", "codigo_interno", "nombre_comercial",
        "principio_activo", "categoria_terapeutica", "laboratorio",
        "forma_farmaceutica", "concentracion", "requiere_receta",
        "botica_id", "nombre_botica", "distrito",
        "cantidad",                          # cantidad vendida
        "stock_actual", "stock_minimo",
        "fecha_vencimiento",
        "precio_venta", "precio_costo",
        "lead_time_dias",
    ]
    df = df[columnas_salida].copy()

    # Convertir fecha a tipo datetime (el pipeline lo necesita para el resample).
    df["fecha_venta"] = pd.to_datetime(df["fecha_venta"])
    df = df.sort_values(["producto_id", "botica_id", "fecha_venta"]).reset_index(drop=True)

    log.info("  filas en features_entrenamiento: %d", len(df))
    return df


# ──────────────────────────────────────────────────────────────────────────────
#  EXPORTACIÓN
# ──────────────────────────────────────────────────────────────────────────────

def exportar_csvs(tablas: dict[str, pd.DataFrame], features: pd.DataFrame) -> None:
    """Vuelca todas las tablas a CSV con encoding UTF-8 (compatible con Postgres)."""
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)

    for nombre, df in tablas.items():
        ruta = DIR_SALIDA / f"{nombre}.csv"
        df.to_csv(ruta, index=False, encoding="utf-8")
        log.info("  ✓ %-25s → %d filas", f"{nombre}.csv", len(df))

    ruta_features = DIR_SALIDA / "features_entrenamiento.csv"
    features.to_csv(ruta_features, index=False, encoding="utf-8")
    log.info("  ✓ %-25s → %d filas", "features_entrenamiento.csv", len(features))


def imprimir_resumen(tablas: dict[str, pd.DataFrame], features: pd.DataFrame) -> None:
    """Resumen amigable para validar que el dataset cumple los criterios del ACP."""
    mov = tablas["movimientos_inventario"]

    print("\n" + "=" * 70)
    print("  RESUMEN DEL DATASET GENERADO")
    print("=" * 70)
    print(f"  Periodo                : {FECHA_INICIO} -> {FECHA_FIN}")
    print(f"  Dias cubiertos         : {(FECHA_FIN - FECHA_INICIO).days + 1}")
    print(f"  Organizaciones         : {len(tablas['organizaciones'])}")
    print(f"  Boticas (total)        : {len(tablas['boticas'])}")
    print(f"  Boticas con ventas     : {len(BOTICAS_VENTA)}")
    print(f"  Productos (SKU)        : {len(tablas['productos'])}")
    print(f"  Proveedores            : {len(tablas['proveedores'])}")
    print(f"  Lotes registrados      : {len(tablas['lotes'])}")
    print(f"  Movimientos totales    : {len(mov):,}")
    print()
    print("  Distribucion por tipo_movimiento:")
    for tipo, cnt in mov["tipo_movimiento"].value_counts().items():
        pct = 100 * cnt / len(mov)
        print(f"    -> {tipo:<12}: {cnt:>7,}  ({pct:5.1f}%)")
    print()
    print(f"  features_entrenamiento : {len(features):,} filas")
    print(f"  Columnas en features   : {len(features.columns)}")
    print()
    print("  Archivos en ./data/")
    for f in sorted(DIR_SALIDA.glob("*.csv")):
        size_kb = f.stat().st_size / 1024
        print(f"    [ ] {f.name:<35} ({size_kb:>7.1f} KB)")
    print("=" * 70 + "\n")


# ──────────────────────────────────────────────────────────────────────────────
#  ENTRY POINT
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("Iniciando generación de dataset (semilla=%d)...", SEMILLA)
    tablas = generar_dominios()
    features = construir_features_entrenamiento(tablas)
    exportar_csvs(tablas, features)
    imprimir_resumen(tablas, features)
    log.info("Dataset listo en %s/", DIR_SALIDA.resolve())


if __name__ == "__main__":
    main()