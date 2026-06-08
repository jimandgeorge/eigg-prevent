import traceback
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import admin, audit, auth, controls, evidence, framework, gaps, governance, members, onboarding, pack, settings as settings_api
from app.core.config import settings
from app.core.database import engine

API_PREFIX = "/api/v1"


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
        # Onboarding columns on org_profile (added after initial schema).
        for col in (
            "ADD COLUMN IF NOT EXISTS org_type TEXT",
            "ADD COLUMN IF NOT EXISTS employee_band TEXT",
            "ADD COLUMN IF NOT EXISTS turnover_band TEXT",
            "ADD COLUMN IF NOT EXISTS existing_policy TEXT",
            "ADD COLUMN IF NOT EXISTS culture_level TEXT",
            "ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ",
        ):
            await conn.execute(text(f"ALTER TABLE org_profile {col}"))
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
        # Platform admin registry (workspaces / users / invites / audit).
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS workspaces (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL, org_type TEXT, tier TEXT NOT NULL DEFAULT 'free',
                products TEXT[] NOT NULL DEFAULT '{}', is_pilot BOOLEAN NOT NULL DEFAULT FALSE,
                pilot_ends_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'active',
                internal_notes TEXT, created_by UUID,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_active_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workspace_id UUID REFERENCES workspaces(id),
                email TEXT UNIQUE NOT NULL, name TEXT, password_hash TEXT,
                role TEXT NOT NULL DEFAULT 'admin', is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                status TEXT NOT NULL DEFAULT 'invited', last_login_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS invites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                workspace_id UUID NOT NULL REFERENCES workspaces(id),
                email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin',
                token TEXT NOT NULL UNIQUE, invited_by UUID,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
                accepted_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS admin_audit_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                admin_id UUID, action TEXT NOT NULL, target_type TEXT, target_id UUID,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))

        # ── Multi-tenancy: scope tenant data by workspace_id ───────────────────
        from app.core.tenant import DEFAULT_WORKSPACE_ID
        # The workspace legacy single-tenant data is migrated into.
        await conn.execute(text("""
            INSERT INTO workspaces (id, name, tier, products, status)
            VALUES (:wid, 'Default workspace', 'free', ARRAY['prevent'], 'active')
            ON CONFLICT (id) DO NOTHING
        """), {"wid": DEFAULT_WORKSPACE_ID})

        tenant_tables = ["controls", "evidence_items", "gap_findings", "workspace_members",
                         "policy_versions", "audit_log", "org_profile"]
        for tbl in tenant_tables:
            await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS workspace_id UUID"))
        # Backfill legacy rows to the default workspace. audit_log/policy_versions are
        # append-only (immutability trigger) — disable user triggers for the one-off update.
        for tbl in tenant_tables:
            immutable = tbl in ("audit_log", "policy_versions")
            if immutable:
                await conn.execute(text(f"ALTER TABLE {tbl} DISABLE TRIGGER USER"))
            await conn.execute(text(f"UPDATE {tbl} SET workspace_id = :wid WHERE workspace_id IS NULL"),
                               {"wid": DEFAULT_WORKSPACE_ID})
            if immutable:
                await conn.execute(text(f"ALTER TABLE {tbl} ENABLE TRIGGER USER"))
        for tbl in ("controls", "evidence_items", "gap_findings", "workspace_members",
                    "policy_versions", "audit_log"):
            await conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_ws ON {tbl} (workspace_id)"))

        # org_profile was a single row (id=1) — re-key per workspace.
        await conn.execute(text("ALTER TABLE org_profile DROP CONSTRAINT IF EXISTS org_profile_id_check"))
        await conn.execute(text("ALTER TABLE org_profile DROP CONSTRAINT IF EXISTS org_profile_pkey"))
        await conn.execute(text("ALTER TABLE org_profile ALTER COLUMN id DROP NOT NULL"))
        await conn.execute(text("ALTER TABLE org_profile ALTER COLUMN id DROP DEFAULT"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS org_profile_ws_uq ON org_profile (workspace_id)"))
        # controls: unique per (workspace, requirement) instead of per requirement.
        await conn.execute(text("ALTER TABLE controls DROP CONSTRAINT IF EXISTS controls_requirement_id_key"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS controls_ws_req_uq ON controls (workspace_id, requirement_id)"))

        # Seed the platform super-admin from env — the first-deploy backdoor into /admin.
        if settings.admin_email and settings.admin_password:
            from app.core.security import hash_password
            exists = await conn.scalar(
                text("SELECT 1 FROM users WHERE email = :e"), {"e": settings.admin_email.lower()})
            if not exists:
                await conn.execute(text("""
                    INSERT INTO users (email, name, password_hash, role, is_admin, status)
                    VALUES (:e, 'EIGG Admin', :ph, 'admin', TRUE, 'active')
                """), {"e": settings.admin_email.lower(),
                       "ph": hash_password(settings.admin_password)})
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

for r in (framework, controls, evidence, gaps, governance, members, onboarding, pack, audit,
          settings_api, admin, auth):
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
