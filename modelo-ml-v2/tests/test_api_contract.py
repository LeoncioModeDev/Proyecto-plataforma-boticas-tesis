from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import importlib.metadata
import pytest


def _exact_runtime_available():
    try:
        return (
            importlib.metadata.version("scikit-learn") == "1.6.1"
            and importlib.metadata.version("xgboost") == "3.4.1"
        )
    except importlib.metadata.PackageNotFoundError:
        return False


@pytest.mark.skipif(
    not _exact_runtime_available(),
    reason="El API carga el pickle con las versiones ML fijadas en requirements.txt",
)
def test_health_and_openapi_contract(monkeypatch):
    from fastapi.testclient import TestClient
    from api.main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["model_loaded"] is True

    openapi = client.get("/openapi.json").json()
    paths = openapi["paths"]
    assert "/api/v1/predicciones" in paths
    assert "/api/v1/recomendaciones/reposicion" in paths
    assert "/api/v1/recomendaciones/compra" in paths
    assert "/api/v1/alertas" in paths
    assert "/api/v1/alertas/evaluar" in paths
