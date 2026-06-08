from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.tenant import current_workspace
from app.services import onboarding

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class Profile(BaseModel):
    name: str | None = None
    org_type: str
    employee_band: str
    turnover_band: str
    existing_policy: str
    culture_level: str


class GenerateRequest(BaseModel):
    profile: Profile


class CommitItem(BaseModel):
    code: str
    status: str
    narrative: str | None = None
    owner: str | None = None


class CommitRequest(BaseModel):
    profile: Profile
    items: list[CommitItem]


async def _active_provider(db: AsyncSession) -> str:
    active = (await db.execute(text(
        "SELECT value FROM app_settings WHERE key = 'llm_provider'"))).scalar()
    return active or app_settings.llm_provider


@router.get("/status")
async def status(db: AsyncSession = Depends(get_db), wid: str = Depends(current_workspace)):
    """A workspace needs onboarding if it has never been onboarded and holds no real
    data yet (no advanced controls, evidence, gaps or members)."""
    onboarded_at = (await db.execute(text(
        "SELECT onboarded_at FROM org_profile WHERE workspace_id = :wid"), {"wid": wid})).scalar()
    advanced = (await db.execute(text(
        "SELECT COUNT(*) FROM controls WHERE status <> 'not_started' AND workspace_id = :wid"), {"wid": wid})).scalar() or 0
    evidence = (await db.execute(text("SELECT COUNT(*) FROM evidence_items WHERE workspace_id = :wid"), {"wid": wid})).scalar() or 0
    gaps = (await db.execute(text("SELECT COUNT(*) FROM gap_findings WHERE workspace_id = :wid"), {"wid": wid})).scalar() or 0
    members = (await db.execute(text("SELECT COUNT(*) FROM workspace_members WHERE workspace_id = :wid"), {"wid": wid})).scalar() or 0
    has_data = bool(advanced or evidence or gaps or members)
    return {"needs_onboarding": onboarded_at is None and not has_data,
            "onboarded_at": onboarded_at.isoformat() if onboarded_at else None}


@router.post("/generate")
async def generate(body: GenerateRequest, db: AsyncSession = Depends(get_db),
                   wid: str = Depends(current_workspace)):
    provider = await _active_provider(db)
    return await onboarding.generate(body.profile.model_dump(), provider=provider)


@router.post("/commit")
async def commit(
    body: CommitRequest,
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    x_actor: str | None = Header(default=None),
):
    if not body.items:
        raise HTTPException(400, "No requirement items to commit")
    return await onboarding.commit(db, wid, body.profile.model_dump(),
                                   [i.model_dump() for i in body.items], x_actor)
