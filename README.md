# EIGG Prevent

**Fraud prevention compliance platform** for the UK "failure to prevent fraud" offence
(Economic Crime and Corporate Transparency Act 2023 — in force **1 September 2025**).

Large organisations are criminally liable if an associated person commits fraud intending
to benefit the organisation, **unless** the organisation had *reasonable fraud prevention
procedures* in place. EIGG Prevent helps **compliance officers, MLROs and boards** build,
run and — critically — **evidence** that defence across five pillars:

1. **Risk assessment** — identify where the organisation is exposed to fraud
2. **Controls** — proportionate, risk-based prevention procedures
3. **Board governance** — top-level commitment, oversight, monitoring & review
4. **Due diligence** — checks on associated persons (staff, agents, suppliers)
5. **Training** — communication and awareness across the organisation

The pillars map directly to the Home Office *Guidance to organisations on the offence of
failure to prevent fraud* six principles, so the framework doubles as the statutory defence.

> Sibling product to **EIGG** (transaction-facing APP-fraud investigation copilot).
> Same idea — AI + a defensible audit trail — pointed at the **organisation-facing**
> compliance angle. Fully standalone: own backend, own frontend, own database.

## Stack

- **Backend:** Python · FastAPI · PostgreSQL
- **LLM:** swappable adapter — `mock` (default, no keys) · `anthropic` · `azure` · `bedrock` · `ollama`
- **Frontend:** Next.js · React · Tailwind

## Key principles

- **Human owns the judgement** — AI drafts and flags gaps; it never signs off compliance
- **Everything is evidence** — every control, assessment and review is a dated, attributable record
- **Defensible by design** — append-only audit trail; export a board-ready "reasonable procedures" pack
- **Self-contained** — runs on the customer's infrastructure; data never leaves

## Quick start

```bash
# 1. Database (local Postgres via Docker, or point at your own)
docker compose up -d db

# 2. Backend
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp .env.example .env                                # defaults work out of the box
python -m app.db.seed                               # create schema + seed the framework
uvicorn app.main:app --reload --port 8001

# 3. Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                                          # http://localhost:3001
```

Defaults to the **mock** LLM provider so it runs with no API keys. Set `LLM_PROVIDER`
and the relevant credentials in `backend/.env` to use a real model.

## Project structure

```
backend/
  app/
    core/       config, database connection
    models/     Pydantic schemas
    db/         schema.sql, seed (framework definition)
    services/   llm adapter, readiness scoring, gap analysis, evidence pack
    api/        framework, controls, evidence, gaps, pack endpoints
frontend/
  app/          dashboard, per-pillar views, evidence pack
  components/    shared UI
  lib/          API client
```
