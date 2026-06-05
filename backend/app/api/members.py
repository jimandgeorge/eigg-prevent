from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

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
async def list_members(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text(
        "SELECT id, name, email, role, active, created_at FROM workspace_members "
        "WHERE active = TRUE ORDER BY name"
    ))).mappings().all()
    return {"members": _ser(rows)}


@router.post("")
async def create_member(
    body: MemberCreate,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    new_id = (await db.execute(text("""
        INSERT INTO workspace_members (name, role, email)
        VALUES (:name, :role, :email) RETURNING id
    """), {"name": name, "role": body.role, "email": body.email})).scalar()
    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('member', :mid, 'created', :actor, :summary)
    """), {"mid": str(new_id), "actor": x_actor or "unknown",
           "summary": f"Workspace member added — {name}"})
    await db.commit()
    return {"id": str(new_id)}


@router.delete("/{member_id}")
async def deactivate_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    name = (await db.execute(text(
        "SELECT name FROM workspace_members WHERE id = :id"), {"id": member_id})).scalar()
    if not name:
        raise HTTPException(404, "Member not found")
    # Soft delete — keep the row so historical owner/approver references resolve.
    await db.execute(text("UPDATE workspace_members SET active = FALSE WHERE id = :id"), {"id": member_id})
    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('member', :mid, 'deactivated', :actor, :summary)
    """), {"mid": member_id, "actor": x_actor or "unknown",
           "summary": f"Workspace member removed — {name}"})
    await db.commit()
    return {"ok": True}
