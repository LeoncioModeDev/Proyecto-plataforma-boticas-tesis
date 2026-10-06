from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import importlib.metadata
import pytest


def _exact_runtime_available():
    expected = {
        "scikit-learn": "1.6.1",
        "xgboost": "3.4.1",
    }
    for package, version in expected.items():
        try:
            if importlib.metadata.version(package) != version:
                return False
        except importlib.metadata.PackageNotFoundError:
            return False
    return True


@pytest.mark.skipif(
    not _exact_runtime_available(),
    reason="Este test requiere las versiones fijadas en requirements.txt",
)
def test_artifact_loads_and_has_expected_components():
    from src.pipeline import validar_modelo_pkl

    report = validar_modelo_pkl()
    assert report["carga_exitosa"] is True
    assert report["features_xgb_independiente"] == 27
    assert report["features_hibrido"] == 29
    assert report["modelos_cargables"] is True
    assert report["preprocesadores_cargables"] is True
