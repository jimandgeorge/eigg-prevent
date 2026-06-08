from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.tenant import current_workspace
from app.models.schemas import LlmConfig, OrgProfileUpdate
from app.services.llm import provider_availability

router = APIRouter(prefix="/settings", tags=["settings"])


# ── LLM provider ──────────────────────────────────────────────────────────────

async def _get_setting(db: AsyncSession, key: str) -> str | None:
    return (await db.execute(text(
        "SELECT value FROM app_settings WHERE key = :k"), {"k": key})).scalar()


@router.get("/llm")
async def get_llm(db: AsyncSession = Depends(get_db)):
    active = await _get_setting(db, "llm_provider") or app_settings.llm_provider
    return {
        "active": active,
        "default": app_settings.llm_provider,
        "providers": provider_availability(),
    }


@router.put("/llm")
async def set_llm(body: LlmConfig, db: AsyncSession = Depends(get_db)):
    providers = {p["id"]: p for p in provider_availability()}
    if body.provider not in providers:
        raise HTTPException(400, f"Unknown provider: {body.provider}")
    if not providers[body.provider]["available"]:
        raise HTTPException(400, f"Provider '{body.provider}' is not configured on this server")
    await db.execute(text("""
        INSERT INTO app_settings (key, value) VALUES ('llm_provider', :v)
        ON CONFLICT (key) DO UPDATE SET value = :v, updated_at = NOW()
    """), {"v": body.provider})
    await db.commit()
    return {"ok": True, "active": body.provider}


# ── Organisation profile ──────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(db: AsyncSession = Depends(get_db), wid: str = Depends(current_workspace)):
    row = (await db.execute(text("SELECT * FROM org_profile WHERE workspace_id = :wid"),
                            {"wid": wid})).mappings().first()
    if not row:
        return {}
    d = dict(row)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


@router.put("/profile")
async def update_profile(
    body: OrgProfileUpdate,
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    x_actor: str | None = Header(default=None),
):
    await db.execute(text(
        "INSERT INTO org_profile (workspace_id) VALUES (:wid) ON CONFLICT (workspace_id) DO NOTHING"
    ), {"wid": wid})
    fields, params = [], {"wid": wid}
    for col in ("name", "sector", "turnover_over_36m", "balance_sheet_over_18m",
                "employees_over_250", "assessment_owner", "notes"):
        val = getattr(body, col)
        if val is not None:
            fields.append(f"{col} = :{col}")
            params[col] = val
    if fields:
        fields.append("updated_at = NOW()")
        await db.execute(text(f"UPDATE org_profile SET {', '.join(fields)} WHERE workspace_id = :wid"), params)
        await db.execute(text("""
            INSERT INTO audit_log (workspace_id, entity_type, entity_id, action, actor, summary)
            VALUES (:wid, 'profile', :wid, 'updated', :actor, 'Organisation profile updated')
        """), {"wid": wid, "actor": x_actor or "unknown"})
        await db.commit()
    return {"ok": True}
