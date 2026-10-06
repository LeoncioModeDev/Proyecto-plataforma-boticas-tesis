import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from feature_engineering import construir_features_historicas, construir_series_sarima, ejecutar
from generar_dataset import ejecutar as generar


def test_features_schema_y_claves(tmp_path):
    generar(dir_salida=tmp_path, max_productos=4)
    features, series = ejecutar(tmp_path / "features_entrenamiento.csv", tmp_path)
    assert {"org_id", "botica_id", "producto_id", "fecha_semana"}.issubset(features.columns)
    assert list(series.columns) == ["fecha_semana", "org_id", "botica_id", "producto_id", "cantidad_vendida"]
    assert not features.duplicated(["org_id", "botica_id", "producto_id", "fecha_semana"]).any()
    assert "lag_13" in features.columns
    assert "lag_12" not in features.columns
    assert "rolling_mean_26" in features.columns


def test_lags_y_rolling_sin_leakage():
    df = pd.DataFrame({
        "fecha_semana": pd.date_range("2025-01-06", periods=30, freq="W-MON"),
        "org_id": "org", "botica_id": "bot", "producto_id": "prod", "categoria_terapeutica": "Analgésico",
        "cantidad_vendida": np.arange(30),
    })
    features = construir_features_historicas(df)
    fila = features.iloc[10]
    assert fila["lag_1"] == 9
    assert fila["lag_4"] == 6
    assert fila["rolling_mean_4"] == np.mean([6, 7, 8, 9])
    assert "stockout_flag" not in features.columns
    assert "demanda_insatisfecha" not in features.columns


def test_tolera_operativas_faltantes():
    df = pd.DataFrame({
        "fecha_semana": pd.date_range("2025-01-06", periods=8, freq="W-MON"),
        "org_id": "org", "botica_id": "bot", "producto_id": "prod", "categoria_terapeutica": "Vitamina",
        "cantidad_vendida": [0, 1, 0, 2, 0, 3, 0, 4],
    })
    features = construir_features_historicas(df)
    series = construir_series_sarima(df)
    assert (features["lead_time_dias"] == 7).all()
    assert len(series) == 8
    assert np.isfinite(features["semana_sin"]).all()
    assert np.isfinite(features["semana_cos"]).all()
