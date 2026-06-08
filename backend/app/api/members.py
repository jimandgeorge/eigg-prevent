from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import current_workspace

router = APIRouter(prefix="/members", tags=["members"])


class MemberCreate(BaseModel):
    name: str
    role: str | None = None
    email: str | None = None


def _ser(rows):
    out = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["created_at"] = d["created_at"].isoformat() if d.get("created_at") else None
        out.append(d)
    return out


@router.get("")
async def list_members(db: AsyncSession = Depends(get_db), wid: str = Depends(current_workspace)):
    rows = (await db.execute(text(
        "SELECT id, name, email, role, active, created_at FROM workspace_members "
        "WHERE active = TRUE AND workspace_id = :wid ORDER BY name"
    ), {"wid": wid})).mappings().all()
    return {"members": _ser(rows)}


@router.post("")
async def create_member(
    body: MemberCreate,
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    x_actor: str | None = Header(default=None),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    new_id = (await db.execute(text("""
        INSERT INTO workspace_members (workspace_id, name, role, email)
        VALUES (:wid, :name, :role, :email) RETURNING id
    """), {"wid": wid, "name": name, "role": body.role, "email": body.email})).scalar()
    await db.execute(text("""
        INSERT INTO audit_log (workspace_id, entity_type, entity_id, action, actor, summary)
        VALUES (:wid, 'member', :mid, 'created', :actor, :summary)
    """), {"wid": wid, "mid": str(new_id), "actor": x_actor or "unknown",
           "summary": f"Workspace member added — {name}"})
    await db.commit()
    return {"id": str(new_id)}


@router.delete("/{member_id}")
async def deactivate_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    x_actor: str | None = Header(default=None),
):
    name = (await db.execute(text(
        "SELECT name FROM workspace_members WHERE id = :id AND workspace_id = :wid"),
        {"id": member_id, "wid": wid})).scalar()
    if not name:
        raise HTTPException(404, "Member not found")
    # Soft delete — keep the row so historical owner/approver references resolve.
    await db.execute(text("UPDATE workspace_members SET active = FALSE WHERE id = :id AND workspace_id = :wid"),
                     {"id": member_id, "wid": wid})
    await db.execute(text("""
        INSERT INTO audit_log (workspace_id, entity_type, entity_id, action, actor, summary)
        VALUES (:wid, 'member', :mid, 'deactivated', :actor, :summary)
    """), {"wid": wid, "mid": member_id, "actor": x_actor or "unknown",
           "summary": f"Workspace member removed — {name}"})
    await db.commit()
    return {"ok": True}
