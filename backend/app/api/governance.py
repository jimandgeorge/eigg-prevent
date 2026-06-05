from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services import governance

router = APIRouter(prefix="/governance", tags=["governance"])


class ApprovalCreate(BaseModel):
    title: str
    version: str
    summary: str | None = None
    approved_by: str
    approved_at: date | None = None


@router.get("/approvals")
async def list_approvals(db: AsyncSession = Depends(get_db)):
    return await governance.list_chain(db)


@router.post("/approvals")
async def create_approval(
    body: ApprovalCreate,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    if not body.title.strip() or not body.version.strip() or not body.approved_by.strip():
        raise HTTPException(400, "title, version and approved_by are required")
    return await governance.add_entry(
        db,
        title=body.title.strip(),
        version=body.version.strip(),
        summary=(body.summary or None),
        approved_by=body.approved_by.strip(),
        approved_at=body.approved_at,
        author=x_actor,
    )
