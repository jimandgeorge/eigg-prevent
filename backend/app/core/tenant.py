"""Per-request workspace context for tenant-scoped endpoints.

The workspace id is supplied by the Next.js tenant proxy (`/api/t`), which reads the
authenticated session and forwards `x-workspace-id` behind the internal secret. Tenant
routes trust `x-workspace-id` ONLY when `x-internal-secret` matches — so a browser can't
spoof which workspace's data it sees. These endpoints are therefore only reachable via
the proxy, never called cross-origin by the browser directly.
"""
from fastapi import Header, HTTPException

from .config import settings

# Stable id for the workspace that legacy single-tenant data is migrated into.
DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000"


def current_workspace(
    x_internal_secret: str | None = Header(default=None),
    x_workspace_id: str | None = Header(default=None),
) -> str:
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not x_workspace_id:
        raise HTTPException(status_code=400, detail="No workspace context")
    return x_workspace_id


def current_actor(x_actor: str | None = Header(default=None)) -> str | None:
    return x_actor
