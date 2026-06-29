import subprocess
import sys
from pathlib import Path


def test_integracion_cli_reducida(tmp_path):
    raiz = Path(__file__).resolve().parents[1]
    py = sys.executable
    subprocess.run([py, "src/generar_dataset.py", "--fast", "--max-productos", "6", "--output-dir", str(tmp_path)], cwd=raiz, check=True, timeout=120)
    subprocess.run([py, "src/feature_engineering.py", "--input", str(tmp_path / "features_entrenamiento.csv"), "--output-dir", str(tmp_path)], cwd=raiz, check=True, timeout=120)
    subprocess.run([py, "src/eda.py", "--input", str(tmp_path / "features_entrenamiento.csv")], cwd=raiz, check=True, timeout=120)
    subprocess.run([py, "src/pipeline.py", "evaluate-paper", "--data-dir", str(tmp_path), "--fast", "--max-series", "6", "--max-folds", "2", "--skip-auto-arima"], cwd=raiz, check=True, timeout=180)
    assert (raiz / "modelos" / "v1.0.0" / "modelo.pkl").exists()
    assert (raiz / "reports" / "paper" / "predicciones_holdout.csv").exists()
    assert (raiz / "reports" / "paper" / "mape_por_categoria.png").exists()
