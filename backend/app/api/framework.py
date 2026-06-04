from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.framework_service import load_framework

router = APIRouter(prefix="/framework", tags=["framework"])


@router.get("")
async def get_framework(db: AsyncSession = Depends(get_db)):
    return await load_framework(db)


@router.get("/pillars/{pillar_id}")
async def get_pillar(pillar_id: str, db: AsyncSession = Depends(get_db)):
    fw = await load_framework(db)
    for p in fw["pillars"]:
        if p["id"] == pillar_id:
            return p
    raise HTTPException(404, "Pillar not found")


@router.get("/requirements/{requirement_id}")
async def get_requirement(requirement_id: str, db: AsyncSession = Depends(get_db)):
    req = (await db.execute(text("""
        SELECT r.id, r.code, r.title, r.description, r.guidance,
               r.pillar_id, p.name AS pillar_name, p.principle,
               c.status, c.owner, c.description AS control_description,
               c.last_reviewed, c.next_review_due, c.updated_at, c.updated_by
        FROM requirements r
        JOIN pillars p ON p.id = r.pillar_id
        JOIN controls c ON c.requirement_id = r.id
        WHERE r.id = :rid
    """), {"rid": requirement_id})).mappings().first()
    if not req:
        raise HTTPException(404, "Requirement not found")

    evidence = (await db.execute(text("""
        SELECT id, title, kind, reference, description, dated, added_by, created_at
        FROM evidence_items WHERE requirement_id = :rid ORDER BY created_at DESC
    """), {"rid": requirement_id})).mappings().all()

    gaps = (await db.execute(text("""
        SELECT id, severity, title, detail, recommendation, status, source, created_at
        FROM gap_findings WHERE requirement_id = :rid AND status = 'open'
        ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
    """), {"rid": requirement_id})).mappings().all()

    def _ser(rows):
        out = []
        for r in rows:
            d = dict(r)
            for k, v in d.items():
                if hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
                else:
                    d[k] = str(v) if k == "id" else v
            out.append(d)
        return out

    result = dict(req)
    for k, v in result.items():
        if hasattr(v, "isoformat"):
            result[k] = v.isoformat()
    result["id"] = str(result["id"])
    result["evidence"] = _ser(evidence)
    result["gaps"] = _ser(gaps)
    return result
