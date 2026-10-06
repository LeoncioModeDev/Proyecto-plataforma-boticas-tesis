import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "src"))

from pipeline import (  # noqa: E402
    CLAVES_OBLIGATORIAS_MODELO,
    CLAVES_SERIE,
    cargar_modelo,
    entrenar_modelo,
    ejecutar_experimento,
    predecir_demanda,
    validar_modelo_pkl,
)


@pytest.fixture(scope="module")
def muestra_serie():
    series = pd.read_csv(RAIZ / "data" / "series_sarima.csv")
    fila = series.iloc[0]
    return {
        "org_id": str(fila["org_id"]),
        "botica_id": str(fila["botica_id"]),
        "producto_id": str(fila["producto_id"]),
    }


def test_train_cache_valida_modelo_pkl_completo():
    reporte = entrenar_modelo(usar_cache=True)
    assert (RAIZ / "modelos" / "v1.0.0" / "modelo.pkl").exists()
    assert reporte["carga_exitosa"] is True
    assert reporte["modelos_cargables"] is True
    assert reporte["preprocesadores_cargables"] is True
    assert reporte["claves_faltantes"] == []


def test_modelo_pkl_contiene_claves_obligatorias():
    artefacto = cargar_modelo()
    assert set(CLAVES_OBLIGATORIAS_MODELO).issubset(artefacto.keys())
    assert len(artefacto["ordenes_sarima"]) == 150
    assert len(artefacto["configuracion_categoria"]) == 14
    reporte = validar_modelo_pkl()
    assert reporte["carga_exitosa"] is True


def test_predecir_horizonte_4_por_todas_las_series():
    pred = predecir_demanda(horizonte=4)
    assert len(pred) == 150 * 4
    assert pred.groupby(CLAVES_SERIE)["horizonte"].nunique().eq(4).all()
    assert "org_id" in pred.columns
    assert pred.isna().sum().sum() == 0
    assert np.isfinite(pred[["prediccion_sarima", "prediccion_xgboost", "prediccion_hibrida"]].to_numpy()).all()
    assert (pred[["prediccion_sarima", "prediccion_xgboost", "prediccion_hibrida"]] >= 0).all().all()
    assert pred.duplicated([*CLAVES_SERIE, "fecha_objetivo"]).sum() == 0


def test_filtros_por_org_botica_producto(muestra_serie):
    pred_org = predecir_demanda(org_id=muestra_serie["org_id"], horizonte=2)
    assert set(pred_org["org_id"]) == {muestra_serie["org_id"]}

    pred_botica = predecir_demanda(org_id=muestra_serie["org_id"], botica_id=muestra_serie["botica_id"], horizonte=2)
    assert set(pred_botica["botica_id"]) == {muestra_serie["botica_id"]}
    assert set(pred_botica["org_id"]) == {muestra_serie["org_id"]}

    pred_producto = predecir_demanda(
        org_id=muestra_serie["org_id"],
        botica_id=muestra_serie["botica_id"],
        producto_id=muestra_serie["producto_id"],
        horizonte=4,
    )
    assert len(pred_producto) == 4
    assert set(pred_producto["producto_id"]) == {muestra_serie["producto_id"]}
    assert pred_producto.groupby(CLAVES_SERIE).ngroups == 1


def test_error_producto_inexistente_y_horizonte_invalido(muestra_serie):
    with pytest.raises(ValueError, match="producto_id inexistente"):
        predecir_demanda(producto_id="00000000-0000-0000-0000-000000000000", horizonte=1)
    with pytest.raises(ValueError, match="horizonte"):
        predecir_demanda(**muestra_serie, horizonte=13)


def test_cli_predict_filtrado_genera_cuatro_filas(tmp_path, muestra_serie):
    salida = tmp_path / "predicciones_filtradas.csv"
    subprocess.run(
        [
            sys.executable,
            "src/pipeline.py",
            "predict",
            "--org-id",
            muestra_serie["org_id"],
            "--botica-id",
            muestra_serie["botica_id"],
            "--producto-id",
            muestra_serie["producto_id"],
            "--horizonte",
            "4",
            "--salida",
            str(salida),
        ],
        cwd=RAIZ,
        check=True,
        timeout=120,
    )
    pred = pd.read_csv(salida)
    assert len(pred) == 4
    assert set(pred["horizonte"]) == {1, 2, 3, 4}
    assert set(pred["org_id"]) == {muestra_serie["org_id"]}


def test_cli_rechaza_horizonte_mayor_a_12():
    resultado = subprocess.run(
        [sys.executable, "src/pipeline.py", "predict", "--horizonte", "13"],
        cwd=RAIZ,
        text=True,
        capture_output=True,
        timeout=120,
    )
    assert resultado.returncode != 0
    assert "horizonte" in resultado.stderr


def test_metricas_oficiales_v4_preservadas():
    metricas = cargar_modelo()["metricas"]
    assert metricas["macro_mape_xgboost"] == pytest.approx(12.788940737964031, abs=1e-6)
    assert metricas["macro_mape_sarima"] == pytest.approx(12.85781441965303, abs=1e-6)
    assert metricas["macro_mape_hibrido"] == pytest.approx(12.349016982065416, abs=1e-6)


def test_ejecutar_experimento_expone_metricas_con_cache(monkeypatch):
    import pipeline

    monkeypatch.setattr(pipeline, "entrenar_modelo", lambda usar_cache=False: validar_modelo_pkl())
    resultado = ejecutar_experimento()
    assert "metricas" in resultado
    assert "macro_mape_hibrido" in resultado["metricas"]
