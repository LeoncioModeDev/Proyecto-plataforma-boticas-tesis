import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.main import app


client = TestClient(app)
ORG_ID = "e8aeb018-f679-5670-b210-de4f62ff2111"
BOTICA_ID = "26f7241d-a84e-5e4a-a43d-33eea1e54eea"
PRODUCTO_ID = "012857cc-907f-5e7d-b8fb-796d2c9f1621"


def headers(org_id=ORG_ID):
    return {"X-Org-Id": org_id}


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["model_loaded"] is True


def test_estado_modelo():
    res = client.get("/api/v1/modelos/estado")
    assert res.status_code == 200
    assert res.json()["modelo_version_id"]


def test_prediccion_sin_historial():
    res = client.post(
        "/api/v1/predicciones",
        headers=headers("org-sin-historial"),
        json={"botica_id": "bot-nueva", "producto_id": "prod-nuevo", "horizonte_semanas": 2, "demanda_inicial_manual": 5},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["nivel_madurez"] == "SIN_HISTORIAL"
    assert data["estrategia_utilizada"] == "REGLAS_INICIALES"


def test_prediccion_con_historial_corto(monkeypatch):
    from api.services import prediction_service as modulo
    import pandas as pd

    df = pd.DataFrame(
        {
            "fecha_semana": pd.to_datetime(["2026-01-05", "2026-01-12"]),
            "org_id": [ORG_ID, ORG_ID],
            "botica_id": ["bot-corto", "bot-corto"],
            "producto_id": ["prod-corto", "prod-corto"],
            "cantidad_vendida": [3, 5],
        }
    )
    monkeypatch.setattr(modulo.data_service, "serie", lambda org_id, botica_id, producto_id: df)
    res = client.post(
        "/api/v1/predicciones",
        headers=headers(),
        json={"botica_id": "bot-corto", "producto_id": "prod-corto", "horizonte_semanas": 2},
    )
    assert res.status_code == 200
    assert res.json()["nivel_madurez"] == "HISTORIAL_CORTO"


def test_validacion_horizonte():
    res = client.post(
        "/api/v1/predicciones",
        headers=headers(),
        json={"botica_id": BOTICA_ID, "producto_id": PRODUCTO_ID, "horizonte_semanas": 13},
    )
    assert res.status_code == 422


def test_recomendacion_reposicion():
    res = client.post(
        "/api/v1/recomendaciones/reposicion",
        headers=headers(),
        json={"botica_id": BOTICA_ID, "drogueria_id": BOTICA_ID, "producto_id": PRODUCTO_ID, "horizonte_semanas": 2, "nivel_servicio": 0.9},
    )
    assert res.status_code == 200
    assert res.json()["tipo"] == "REPOSICION_INTERNA"


def test_recomendacion_compra():
    res = client.post(
        "/api/v1/recomendaciones/compra",
        headers=headers(),
        json={"almacen_id": BOTICA_ID, "producto_id": PRODUCTO_ID, "horizonte_semanas": 2, "nivel_servicio": 0.9},
    )
    assert res.status_code == 200
    assert res.json()["tipo"] == "ORDEN_COMPRA"


def test_aislamiento_org_id():
    res = client.get(f"/api/v1/predicciones/{BOTICA_ID}/{PRODUCTO_ID}", headers=headers("otra-org"))
    assert res.status_code == 200
    assert res.json()["predicciones"] == []


def test_reentrenamiento_sin_secreto():
    res = client.post("/api/v1/modelos/reentrenar", headers=headers(), json={"alcance": "GLOBAL", "forzar": False})
    assert res.status_code in (202, 403)
