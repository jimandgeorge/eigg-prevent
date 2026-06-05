FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal; asyncpg/httpx ship wheels.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Uploaded evidence lives here (mount a volume in prod to persist it).
RUN mkdir -p /app/uploads

EXPOSE 8001

# Seed is idempotent (pillars/requirements/controls + admin user); safe on every boot.
CMD ["sh", "-c", "python -m app.db.seed && uvicorn app.main:app --host 0.0.0.0 --port 8001"]
