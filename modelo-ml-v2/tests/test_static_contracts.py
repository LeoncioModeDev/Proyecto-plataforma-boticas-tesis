from pathlib import Path
import ast

ROOT = Path(__file__).resolve().parents[1]


def test_cloud_run_files_exist():
    assert (ROOT / "Dockerfile").exists()
    assert (ROOT / "requirements.txt").exists()
    assert (ROOT / "modelos/modelo_hibrido/artefacto_modelo.pkl").exists()


def test_config_uses_new_model_and_history_thresholds():
    text = (ROOT / "api/config.py").read_text(encoding="utf-8")
    assert "modelos/modelo_hibrido/artefacto_modelo.pkl" in text
    assert 'MIN_WEEKS_XGBOOST", "26"' in text
    assert 'MIN_WEEKS_HYBRID", "84"' in text


def test_no_fake_25_percent_prediction_interval():
    paths = [
        ROOT / "api/services/prediction_service.py",
        ROOT / "api/services/data_service.py",
        ROOT / "src/pipeline.py",
    ]
    text = "\n".join(path.read_text(encoding="utf-8") for path in paths)
    assert "* 0.75" not in text
    assert "* 1.25" not in text


def test_modified_python_files_parse():
    paths = [
        ROOT / "src/pipeline.py",
        ROOT / "src/feature_engineering.py",
        ROOT / "api/config.py",
        ROOT / "api/schemas.py",
        ROOT / "api/main.py",
        ROOT / "api/services/model_service.py",
        ROOT / "api/services/data_service.py",
        ROOT / "api/services/prediction_service.py",
        ROOT / "api/services/recommendation_service.py",
        ROOT / "api/services/alert_service.py",
    ]
    for path in paths:
        ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
