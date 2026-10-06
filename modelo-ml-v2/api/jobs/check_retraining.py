"""Job externo para verificar necesidad de reentrenamiento.

Uso:
    python -m api.jobs.check_retraining
"""

from api.services.retraining_service import retraining_service


def main():
    resultado = retraining_service.verificar()
    print(resultado)


if __name__ == "__main__":
    main()
