from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import current_workspace
from app.services.pack_service import build_pack

router = APIRouter(prefix="/pack", tags=["pack"])


@router.get("")
async def get_pack(
    db: AsyncSession = Depends(get_db),
    wid: str = Depends(current_workspace),
    x_actor: str | None = Header(default=None),
):
    return await build_pack(db, wid, actor=x_actor)
