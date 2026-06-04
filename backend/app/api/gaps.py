from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.schemas import GapCreate, GapStatusUpdate
from app.services.gap_analysis import run_gap_analysis

router = APIRouter(prefix="/gaps", tags=["gaps"])


def _active_provider_dep():
    # AI provider currently always the env default; runtime switch is in settings.
    return None


@router.get("")
async def list_gaps(status: str = "open", db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT g.id, g.severity, g.title, g.detail, g.recommendation, g.status, g.source,
               g.pillar_id, g.requirement_id, g.llm_provider, g.llm_model, g.created_at,
               r.code AS requirement_code, p.name AS pillar_name
        FROM gap_findings g
        LEFT JOIN requirements r ON r.id = g.requirement_id
        LEFT JOIN pillars p ON p.id = g.pillar_id
        WHERE g.status = :status
        ORDER BY CASE g.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 g.created_at DESC
    """), {"status": status})).mappings().all()
    out = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["requirement_id"] = str(d["requirement_id"]) if d["requirement_id"] else None
        d["created_at"] = d["created_at"].isoformat() if d["created_at"] else None
        out.append(d)
    return {"gaps": out}


@router.post("/analyze")
async def analyze(
    db: AsyncSession = Depends(get_db),
    provider: str | None = None,
    x_actor: str | None = Header(default=None),
):
    # Use the workspace-selected provider if none specified.
    if provider is None:
        active = (await db.execute(text(
            "SELECT value FROM app_settings WHERE key = 'llm_provider'"
        ))).scalar() if await _has_settings(db) else None
        provider = active or settings.llm_provider
    return await run_gap_analysis(db, provider=provider, actor=x_actor)


async def _has_settings(db: AsyncSession) -> bool:
    return bool((await db.execute(text(
        "SELECT to_regclass('app_settings')"))).scalar())


@router.post("")
async def create_gap(
    body: GapCreate,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    new_id = (await db.execute(text("""
        INSERT INTO gap_findings
            (pillar_id, requirement_id, severity, title, detail, recommendation, status, source)
        VALUES (:pillar_id, :rid, :severity, :title, :detail, :rec, 'open', 'manual')
        RETURNING id
    """), {
        "pillar_id": body.pillar_id, "rid": body.requirement_id,
        "severity": body.severity, "title": body.title,
        "detail": body.detail, "rec": body.recommendation,
    })).scalar()
    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('gap', :gid, 'created', :actor, :summary)
    """), {"gid": str(new_id), "actor": x_actor or "unknown",
           "summary": f"Gap logged — {body.title}"})
    await db.commit()
    return {"id": str(new_id)}


@router.put("/{gap_id}")
async def update_gap_status(
    gap_id: str,
    body: GapStatusUpdate,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    if body.status not in ("open", "addressed", "dismissed"):
        raise HTTPException(400, "Invalid status")
    title = (await db.execute(text(
        "SELECT title FROM gap_findings WHERE id = :gid"), {"gid": gap_id})).scalar()
    if not title:
        raise HTTPException(404, "Gap not found")
    await db.execute(text("UPDATE gap_findings SET status = :s WHERE id = :gid"),
                     {"s": body.status, "gid": gap_id})
    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('gap', :gid, :action, :actor, :summary)
    """), {"gid": gap_id, "action": f"marked_{body.status}", "actor": x_actor or "unknown",
           "summary": f"Gap {body.status} — {title}"})
    await db.commit()
    return {"ok": True}
