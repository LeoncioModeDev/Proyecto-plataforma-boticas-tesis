# -*- coding: utf-8 -*-
"""Elimina artefactos generados para probar el flujo completo desde cero.

Uso recomendado desde modelo-ml/:

    python src/limpiar_generados.py --ejecutar

Por defecto corre en modo simulacion y solo muestra que eliminaria.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


RAIZ_MODELO = Path(__file__).resolve().parents[1]

ARCHIVOS_GENERADOS = [
    # generar_dataset.py
    "data/boticas.csv",
    "data/categorias_terapeuticas.csv",
    "data/features_entrenamiento.csv",
    "data/formas_farmaceuticas.csv",
    "data/principios_activos.csv",
    "data/producto_principio_activo.csv",
    "data/productos.csv",
    "data/proveedor_producto.csv",
    "data/proveedores.csv",
    "data/stock_historico.csv",
    "data/unidades_medida.csv",
    "data/ventas_historicas.csv",
    # feature_engineering.py
    "data/features_modelado.csv",
    "data/series_sarima.csv",
    # pipeline.py
    "modelos/v1.0.0/cache_evaluacion.pkl",
    "modelos/v1.0.0/cache_sarima.pkl",
    "modelos/v1.0.0/drift_metricas.json",
    "modelos/v1.0.0/feature_engineering_reporte.json",
    "modelos/v1.0.0/feature_schema.json",
    "modelos/v1.0.0/metricas.json",
    "modelos/v1.0.0/modelo.pkl",
    "modelos/v1.0.0/pipeline_config.json",
    "modelos/v1.0.0/variante_hibrida_seleccionada.json",
]

DIRECTORIOS_GENERADOS = [
    "modelos/v1.0.0_fallback_diagnostico",
    "reports/eda",
    "reports/graficos",
    "reports/paper",
    "reports/paper_fallback_diagnostico",
]

PATRONES_GENERADOS = [
]

DIRECTORIOS_PROTEGIDOS = {
    ".git",
    "api",
    "src",
    "tests",
    "notebooks",
}

DIRECTORIOS_SIEMPRE_PROTEGIDOS = {
    ".venv",
    ".venv311",
}


def esta_protegido(ruta: Path) -> bool:
    try:
        relativa = ruta.resolve().relative_to(RAIZ_MODELO.resolve())
    except ValueError:
        return True
    partes = set(relativa.parts)
    if partes & DIRECTORIOS_SIEMPRE_PROTEGIDOS:
        return True
    return bool(partes & DIRECTORIOS_PROTEGIDOS) and "__pycache__" not in partes and ruta.suffix != ".pyc"


def eliminar_ruta(ruta: Path, ejecutar: bool) -> bool:
    if not ruta.exists():
        return False
    if esta_protegido(ruta):
        print(f"PROTEGIDO  {ruta.relative_to(RAIZ_MODELO)}")
        return False
    accion = "ELIMINA" if ejecutar else "SIMULA"
    print(f"{accion:8s} {ruta.relative_to(RAIZ_MODELO)}")
    if ejecutar:
        if ruta.is_dir():
            shutil.rmtree(ruta)
        else:
            ruta.unlink()
    return True


def recolectar_rutas() -> list[Path]:
    rutas: list[Path] = []
    rutas.extend(RAIZ_MODELO / ruta for ruta in ARCHIVOS_GENERADOS)
    rutas.extend(RAIZ_MODELO / ruta for ruta in DIRECTORIOS_GENERADOS)
    return sorted(set(rutas), key=lambda p: (len(p.parts), str(p)))


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Elimina archivos generados por el flujo ML")
    parser.add_argument("--ejecutar", action="store_true", help="Elimina realmente. Sin este flag solo simula.")
    args = parser.parse_args(argv)

    eliminadas = 0
    for ruta in recolectar_rutas():
        eliminadas += int(eliminar_ruta(ruta, args.ejecutar))

    modo = "eliminadas" if args.ejecutar else "detectadas en simulacion"
    print(f"\nRutas {modo}: {eliminadas}")
    if not args.ejecutar:
        print("Para eliminar realmente ejecuta: python src/limpiar_generados.py --ejecutar")


if __name__ == "__main__":
    main()
