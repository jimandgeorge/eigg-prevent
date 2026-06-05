import traceback
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import audit, controls, evidence, framework, gaps, governance, members, pack, settings as settings_api
from app.core.config import settings
from app.core.database import engine

API_PREFIX = "/api"


@asynccontextmanager
async def lifespan(_app):
    # Lightweight runtime key/value settings (e.g. active LLM provider).
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key        TEXT PRIMARY KEY,
                value      TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        # Ensure tables added after initial seed exist on already-seeded databases.
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS workspace_members (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        TEXT NOT NULL,
                email       TEXT,
                role        TEXT,
                active      BOOLEAN NOT NULL DEFAULT TRUE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        # Columns for uploaded-file evidence (added after initial schema).
        for col in (
            "ADD COLUMN IF NOT EXISTS stored_path TEXT",
            "ADD COLUMN IF NOT EXISTS original_filename TEXT",
            "ADD COLUMN IF NOT EXISTS content_type TEXT",
            "ADD COLUMN IF NOT EXISTS size_bytes BIGINT",
        ):
            await conn.execute(text(f"ALTER TABLE evidence_items {col}"))
        # Board governance hash-chained ledger (append-only).
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS policy_versions (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                seq         BIGSERIAL,
                title       TEXT NOT NULL,
                version     TEXT NOT NULL,
                summary     TEXT,
                author      TEXT,
                approved_by TEXT NOT NULL,
                approved_at DATE,
                prev_hash   TEXT NOT NULL,
                hash        TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE OR REPLACE FUNCTION block_audit_mutation()
            RETURNS trigger AS $fn$
            BEGIN
                RAISE EXCEPTION '% is append-only: % blocked', TG_TABLE_NAME, TG_OP
                    USING ERRCODE = 'insufficient_privilege',
                          HINT = 'This is an immutable compliance record.';
            END;
            $fn$ LANGUAGE plpgsql
        """))
        await conn.execute(text("DROP TRIGGER IF EXISTS trg_policy_versions_immutable ON policy_versions"))
        await conn.execute(text("""
            CREATE TRIGGER trg_policy_versions_immutable
                BEFORE UPDATE OR DELETE ON policy_versions
                FOR EACH ROW EXECUTE FUNCTION block_audit_mutation()
        """))
    yield


app = FastAPI(
    title="EIGG Prevent",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=f"{API_PREFIX}/docs" if settings.environment != "production" else None,
    openapi_url=f"{API_PREFIX}/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

for r in (framework, controls, evidence, gaps, governance, members, pack, audit, settings_api):
    app.include_router(r.router, prefix=API_PREFIX)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    error_id = uuid.uuid4().hex[:12]
    print(f"[error {error_id}] {request.method} {request.url.path}", flush=True)
    traceback.print_exc()
    if settings.environment == "production":
        return JSONResponse(status_code=500,
                            content={"detail": "Internal server error", "error_id": error_id})
    return JSONResponse(status_code=500,
                        content={"detail": str(exc), "type": type(exc).__name__, "error_id": error_id})


@app.get("/health")
async def health():
    return {"ok": True}


@app.get(f"{API_PREFIX}/system")
async def system_info():
    from app.services.llm import model_name
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        active = (await db.execute(text(
            "SELECT value FROM app_settings WHERE key = 'llm_provider'"))).scalar()
    active = active or settings.llm_provider
    return {
        "version": "0.1.0",
        "environment": settings.environment,
        "llm_provider": active,
        "llm_model": model_name(active),
    }
