from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.feature_engineering import FEATURES_HIBRIDO, FEATURES_XGB_INDEPENDIENTE


def test_feature_counts():
    assert len(FEATURES_XGB_INDEPENDIENTE) == 27
    assert len(FEATURES_HIBRIDO) == 29


def test_inventory_features_are_not_forecast_inputs():
    prohibited = {
        "stock_inicio_semana",
        "stock_minimo",
        "stock_maximo",
        "lead_time_dias",
        "demanda_insatisfecha",
        "stockout_flag",
        "es_invierno",
        "es_verano",
    }
    assert not prohibited.intersection(FEATURES_XGB_INDEPENDIENTE)
    assert not prohibited.intersection(FEATURES_HIBRIDO)


def test_hybrid_adds_only_sarima_forecast_features():
    assert FEATURES_HIBRIDO[:-2] == FEATURES_XGB_INDEPENDIENTE
    assert FEATURES_HIBRIDO[-2:] == ["pred_sarima", "log_pred_sarima"]
