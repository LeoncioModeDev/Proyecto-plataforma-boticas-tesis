import argparse
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from generar_dataset import ejecutar as generar
from feature_engineering import ejecutar as features
from pipeline import ejecutar_experimento, predecir_demanda


def _args(data_dir):
    return argparse.Namespace(data_dir=data_dir, fast=True, max_series=6, max_folds=2, skip_auto_arima=True, guardar_detalle=False)


def test_pipeline_reducido_genera_metricas(tmp_path):
    generar(dir_salida=tmp_path, max_productos=6)
    features(tmp_path / "features_entrenamiento.csv", tmp_path)
    resultado = ejecutar_experimento(_args(tmp_path), guardar_artefacto=False, guardar_paper=False)
    metricas = resultado["metricas"]
    assert metricas["split"]["holdout_semanas"] == 12
    assert "macro_mape_categoria" in metricas
    holdout = resultado["holdout"]
    assert {"org_id", "botica_id", "producto_id", "pred_hibrida"}.issubset(holdout.columns)


def test_predecir_demanda_horizontes(tmp_path):
    generar(dir_salida=tmp_path, max_productos=6)
    feat, _series = features(tmp_path / "features_entrenamiento.csv", tmp_path)
    resultado = ejecutar_experimento(_args(tmp_path), guardar_artefacto=False, guardar_paper=False)
    fila = feat.iloc[0]
    serie = feat[(feat["org_id"] == fila["org_id"]) & (feat["botica_id"] == fila["botica_id"]) & (feat["producto_id"] == fila["producto_id"])]
    for h in [4, 8, 12]:
        pred = predecir_demanda(fila["org_id"], fila["botica_id"], fila["producto_id"], h, serie[["fecha_semana", "cantidad_vendida"]], fila["categoria_terapeutica"], None, resultado["artefacto"])
        assert len(pred) == h
        assert (pred["cantidad_predicha"] >= 0).all()
    with pytest.raises(ValueError):
        predecir_demanda(fila["org_id"], fila["botica_id"], fila["producto_id"], 13, serie[["fecha_semana", "cantidad_vendida"]], fila["categoria_terapeutica"], None, resultado["artefacto"])
