import json

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import current_workspace
from app.db.framework import STATUS_SCORE
from app.models.schemas import ControlUpdate
from app.services.drafting import draft_control
from app.services.framework_service import ensure_controls

router = APIRouter(prefix="/controls", tags=["controls"])


@router.put("/{requirement_id}")
async def update_control(
    requirement_id: str,
    body: ControlUpdate,
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    x_actor: str | None = Header(default=None),
):
    await ensure_controls(db, wid)
    current = (await db.execute(text(
        "SELECT status, owner, description FROM controls WHERE requirement_id = :rid AND workspace_id = :wid"
    ), {"rid": requirement_id, "wid": wid})).mappings().first()
    if not current:
        raise HTTPException(404, "Requirement not found")

    if body.status is not None and body.status not in STATUS_SCORE:
        raise HTTPException(400, f"Invalid status: {body.status}")

    fields, params = [], {"rid": requirement_id, "wid": wid}
    for col in ("status", "owner", "description", "last_reviewed", "next_review_due"):
        val = getattr(body, col)
        if val is not None:
            fields.append(f"{col} = :{col}")
            params[col] = val
    if not fields:
        raise HTTPException(400, "No fields to update")

    fields.append("updated_by = :actor")
    fields.append("updated_at = NOW()")
    params["actor"] = x_actor or "unknown"

    await db.execute(text(
        f"UPDATE controls SET {', '.join(fields)} WHERE requirement_id = :rid AND workspace_id = :wid"
    ), params)

    # Audit the change (status changes are the defensibility-critical ones).
    code = (await db.execute(text(
        "SELECT code FROM requirements WHERE id = :rid"), {"rid": requirement_id})).scalar()
    if body.status is not None and body.status != current["status"]:
        summary = f"{code}: status {current['status']} → {body.status}"
        action = "status_changed"
    else:
        summary = f"{code}: control updated"
        action = "updated"
    await db.execute(text("""
        INSERT INTO audit_log (workspace_id, entity_type, entity_id, action, actor, summary, detail)
        VALUES (:wid, 'control', :rid, :action, :actor, :summary, CAST(:detail AS jsonb))
    """), {
        "wid": wid, "rid": requirement_id, "action": action, "actor": x_actor or "unknown",
        "summary": summary,
        "detail": json.dumps({k: str(v) for k, v in params.items() if k not in ("rid", "actor", "wid")}),
    })
    await db.commit()
    return {"ok": True}


@router.post("/{requirement_id}/draft")
async def ai_draft(
    requirement_id: str,
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    provider: str | None = None,
):
    try:
        return await draft_control(db, requirement_id, wid, provider)
    except ValueError as e:
        raise HTTPException(404, str(e))
