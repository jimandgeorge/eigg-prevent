"""Guard for internal endpoints (admin + auth).

These are only ever called server-side by the Next.js proxy, which holds the secret
and enforces the is_admin session check before forwarding. The browser never sees it.
"""
from fastapi import Header, HTTPException

from app.core.config import settings


def require_internal(x_internal_secret: str | None = Header(default=None)):
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    return True
