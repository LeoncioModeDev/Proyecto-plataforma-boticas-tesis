import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from generar_dataset import CATEGORIAS, ejecutar


def test_generar_dataset_schema_reproducible(tmp_path):
    ejecutar(dir_salida=tmp_path, max_productos=6)
    productos_1 = pd.read_csv(tmp_path / "productos.csv")
    ventas_1 = pd.read_csv(tmp_path / "ventas_historicas.csv")
    ejecutar(dir_salida=tmp_path, max_productos=6)
    productos_2 = pd.read_csv(tmp_path / "productos.csv")
    ventas_2 = pd.read_csv(tmp_path / "ventas_historicas.csv")

    assert productos_1.equals(productos_2)
    assert ventas_1.head(50).equals(ventas_2.head(50))
    assert "categoria_terapeutica_id" in productos_1.columns
    assert "laboratorio" not in productos_1.columns
    assert "codigo_atc" not in productos_1.columns
    assert set(productos_1["clasificacion"]).issubset({"OTC", "receta", "generico"})
    assert set(productos_1["estado"]).issubset({"activo", "inactivo", "descontinuado"})
    assert "cantidad_vendida" in ventas_1.columns
    assert "cantidad" not in ventas_1.columns
    assert (ventas_1["cantidad_vendida"] >= 0).all()

    categorias = pd.read_csv(tmp_path / "categorias_terapeuticas.csv")
    assert set(CATEGORIAS).issubset(set(categorias["nombre"]))
    stock = pd.read_csv(tmp_path / "stock_historico.csv")
    assert "cantidad_disponible" in stock.columns


def test_integridad_referencial(tmp_path):
    ejecutar(dir_salida=tmp_path, max_productos=8)
    productos = pd.read_csv(tmp_path / "productos.csv")
    categorias = pd.read_csv(tmp_path / "categorias_terapeuticas.csv")
    ppa = pd.read_csv(tmp_path / "producto_principio_activo.csv")
    principios = pd.read_csv(tmp_path / "principios_activos.csv")
    proveedor_producto = pd.read_csv(tmp_path / "proveedor_producto.csv")
    proveedores = pd.read_csv(tmp_path / "proveedores.csv")

    assert productos["id"].is_unique
    assert productos["codigo_interno"].is_unique
    assert set(productos["categoria_terapeutica_id"]).issubset(set(categorias["id"]))
    assert set(ppa["producto_id"]).issubset(set(productos["id"]))
    assert set(ppa["principio_activo_id"]).issubset(set(principios["id"]))
    assert set(proveedor_producto["producto_id"]).issubset(set(productos["id"]))
    assert set(proveedor_producto["proveedor_id"]).issubset(set(proveedores["id"]))
