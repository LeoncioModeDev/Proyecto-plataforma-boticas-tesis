FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    MODEL_PATH=modelos/modelo_hibrido/artefacto_modelo.pkl \
    MIN_WEEKS_XGBOOST=26 \
    MIN_WEEKS_HYBRID=84

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT}
