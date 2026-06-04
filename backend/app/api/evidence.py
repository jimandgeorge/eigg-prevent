from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.schemas import EvidenceCreate

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.post("/{requirement_id}")
async def add_evidence(
    requirement_id: str,
    body: EvidenceCreate,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    exists = (await db.execute(text(
        "SELECT code FROM requirements WHERE id = :rid"), {"rid": requirement_id})).scalar()
    if not exists:
        raise HTTPException(404, "Requirement not found")

    new_id = (await db.execute(text("""
        INSERT INTO evidence_items (requirement_id, title, kind, reference, description, dated, added_by)
        VALUES (:rid, :title, :kind, :reference, :description, :dated, :actor)
        RETURNING id
    """), {
        "rid": requirement_id, "title": body.title, "kind": body.kind,
        "reference": body.reference, "description": body.description,
        "dated": body.dated, "actor": x_actor or "unknown",
    })).scalar()

    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('evidence', :eid, 'created', :actor, :summary)
    """), {"eid": str(new_id), "actor": x_actor or "unknown",
           "summary": f"{exists}: evidence added — {body.title}"})
    await db.commit()
    return {"id": str(new_id)}


@router.delete("/{evidence_id}")
async def delete_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    row = (await db.execute(text(
        "SELECT title FROM evidence_items WHERE id = :eid"), {"eid": evidence_id})).scalar()
    if not row:
        raise HTTPException(404, "Evidence not found")
    await db.execute(text("DELETE FROM evidence_items WHERE id = :eid"), {"eid": evidence_id})
    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('evidence', :eid, 'deleted', :actor, :summary)
    """), {"eid": evidence_id, "actor": x_actor or "unknown",
           "summary": f"Evidence removed — {row}"})
    await db.commit()
    return {"ok": True}
