from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import current_workspace
from app.db.framework import CONTROL_TEMPLATES, related_codes
from app.services.framework_service import ensure_controls, load_framework

router = APIRouter(prefix="/framework", tags=["framework"])


@router.get("")
async def get_framework(db: AsyncSession = Depends(get_db), wid: str = Depends(current_workspace)):
    return await load_framework(db, wid)


@router.get("/pillars/{pillar_id}")
async def get_pillar(pillar_id: str, db: AsyncSession = Depends(get_db), wid: str = Depends(current_workspace)):
    fw = await load_framework(db, wid)
    for p in fw["pillars"]:
        if p["id"] == pillar_id:
            return p
    raise HTTPException(404, "Pillar not found")


@router.get("/requirements/{requirement_id}")
async def get_requirement(requirement_id: str, db: AsyncSession = Depends(get_db),
                          wid: str = Depends(current_workspace)):
    await ensure_controls(db, wid)
    req = (await db.execute(text("""
        SELECT r.id, r.code, r.title, r.description, r.guidance,
               r.pillar_id, p.name AS pillar_name, p.principle,
               c.status, c.owner, c.description AS control_description,
               c.last_reviewed, c.next_review_due, c.updated_at, c.updated_by
        FROM requirements r
        JOIN pillars p ON p.id = r.pillar_id
        JOIN controls c ON c.requirement_id = r.id AND c.workspace_id = :wid
        WHERE r.id = :rid
    """), {"rid": requirement_id, "wid": wid})).mappings().first()
    if not req:
        raise HTTPException(404, "Requirement not found")

    evidence = (await db.execute(text("""
        SELECT id, title, kind, reference, description, dated, added_by, created_at,
               original_filename, content_type, size_bytes,
               (stored_path IS NOT NULL) AS is_file
        FROM evidence_items WHERE requirement_id = :rid AND workspace_id = :wid ORDER BY created_at DESC
    """), {"rid": requirement_id, "wid": wid})).mappings().all()

    gaps = (await db.execute(text("""
        SELECT id, severity, title, detail, recommendation, status, source, created_at
        FROM gap_findings WHERE requirement_id = :rid AND workspace_id = :wid AND status = 'open'
        ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
    """), {"rid": requirement_id, "wid": wid})).mappings().all()

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
    result["overdue"] = bool(req["next_review_due"] and req["next_review_due"] < date.today())
    result["template"] = CONTROL_TEMPLATES.get(req["code"])
    result["evidence"] = _ser(evidence)
    result["gaps"] = _ser(gaps)

    # Cross-pillar dependencies — resolve linked requirement codes to their detail.
    links = related_codes(req["code"])
    related = []
    if links:
        codes = [c for c, _ in links]
        reason_by_code = {c: r for c, r in links}
        rows = (await db.execute(text("""
            SELECT r.id, r.code, r.title, r.pillar_id, p.name AS pillar_name, c.status
            FROM requirements r JOIN pillars p ON p.id = r.pillar_id
            JOIN controls c ON c.requirement_id = r.id AND c.workspace_id = :wid
            WHERE r.code = ANY(:codes)
        """), {"codes": codes, "wid": wid})).mappings().all()
        for r in rows:
            related.append({
                "id": str(r["id"]),
                "code": r["code"],
                "title": r["title"],
                "pillar_id": r["pillar_id"],
                "pillar_name": r["pillar_name"],
                "status": r["status"],
                "reason": reason_by_code.get(r["code"], ""),
            })
    result["related"] = related
    return result
