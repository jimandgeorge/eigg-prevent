from datetime import date, datetime

from pydantic import BaseModel

# ── Controls ──────────────────────────────────────────────────────────────────

class ControlUpdate(BaseModel):
    status: str | None = None          # not_started | in_progress | implemented | embedded
    owner: str | None = None
    description: str | None = None
    last_reviewed: date | None = None
    next_review_due: date | None = None


# ── Evidence ──────────────────────────────────────────────────────────────────

class EvidenceCreate(BaseModel):
    title: str
    kind: str = "document"
    reference: str | None = None
    description: str | None = None
    dated: date | None = None


# ── Gaps ──────────────────────────────────────────────────────────────────────

class GapCreate(BaseModel):
    pillar_id: str | None = None
    requirement_id: str | None = None
    severity: str = "medium"
    title: str
    detail: str
    recommendation: str | None = None


class GapStatusUpdate(BaseModel):
    status: str                        # open | addressed | dismissed


# ── Org profile ───────────────────────────────────────────────────────────────

class OrgProfileUpdate(BaseModel):
    name: str | None = None
    sector: str | None = None
    turnover_over_36m: bool | None = None
    balance_sheet_over_18m: bool | None = None
    employees_over_250: bool | None = None
    assessment_owner: str | None = None
    notes: str | None = None


# ── LLM ───────────────────────────────────────────────────────────────────────

class LlmConfig(BaseModel):
    provider: str
