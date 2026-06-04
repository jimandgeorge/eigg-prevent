from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def get_audit(limit: int = 100, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT id, entity_type, entity_id, action, actor, summary, detail, created_at
        FROM audit_log ORDER BY created_at DESC LIMIT :limit
    """), {"limit": min(limit, 500)})).mappings().all()
    entries = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        d["created_at"] = d["created_at"].isoformat() if d["created_at"] else None
        entries.append(d)
    return {"entries": entries, "total": len(entries)}
