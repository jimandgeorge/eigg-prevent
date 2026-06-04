# EIGG Prevent

Fraud prevention **compliance** platform for the UK "failure to prevent fraud" offence
(Economic Crime and Corporate Transparency Act 2023, in force 1 Sept 2025).

Sibling to **EIGG** (the transaction-facing APP-fraud copilot in `../fraud-copilot`).
This is the **organisation-facing** product: evidence a *reasonable fraud prevention
procedures* defence. **Fully standalone** — own backend, frontend and database. Do not
import from or depend on fraud-copilot.

## Product

Compliance officers / MLROs / boards build and evidence their fraud prevention framework
across five pillars, which map to the Home Office guidance six principles:

| Pillar              | Home Office principle                          |
|---------------------|------------------------------------------------|
| Risk assessment     | 2. Risk assessment                             |
| Controls            | 3. Proportionate risk-based prevention procedures |
| Board governance    | 1. Top-level commitment + 6. Monitoring & review |
| Due diligence       | 4. Due diligence                               |
| Training            | 5. Communication (incl. training)              |

## Stack

**Backend:** Python, FastAPI, PostgreSQL
**LLM:** swappable adapter via `LLM_PROVIDER` — `mock` (default) | `anthropic` | `azure` | `bedrock` | `ollama`
**Frontend:** Next.js, React, Tailwind

Ports (kept distinct from EIGG's 8000/3000): **backend 8001**, **frontend 3001**.

## Key principles

- Human owns the judgement — AI drafts records and flags gaps; never auto-attests compliance
- Everything is evidence — dated, attributable, append-only audit trail
- Defensible by design — exportable "reasonable procedures" pack for the board / regulator / court
- Self-contained — on-prem, data never leaves customer infrastructure

## Conventions

- Backend API namespaced under `/api`. `/health` at root for probes.
- LLM integration is the single file `backend/app/services/llm.py`.
- The framework definition (pillars + requirements) is seeded from `backend/app/db/seed.py`.
- Readiness scoring lives in `backend/app/services/scoring.py`.
