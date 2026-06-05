-- EIGG Prevent — fraud prevention compliance framework
-- Postgres 13+ (uses built-in gen_random_uuid()).

-- ── Organisation profile (single row) ───────────────────────────────────────
-- Establishes whether the org is in scope of the offence and frames the assessment.
CREATE TABLE IF NOT EXISTS org_profile (
    id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name            TEXT,
    sector          TEXT,
    -- "large organisation" test: ANY 2 of turnover >£36m, balance sheet >£18m, >250 employees
    turnover_over_36m       BOOLEAN NOT NULL DEFAULT FALSE,
    balance_sheet_over_18m  BOOLEAN NOT NULL DEFAULT FALSE,
    employees_over_250      BOOLEAN NOT NULL DEFAULT FALSE,
    assessment_owner        TEXT,
    last_assessed_at        TIMESTAMPTZ,
    notes           TEXT,
    -- Onboarding inputs (captured by the first-run wizard)
    org_type        TEXT,            -- fintech | emi | payments | charity | other
    employee_band   TEXT,            -- under_50 | 50_250 | over_250
    turnover_band   TEXT,            -- under_10m | 10_36m | over_36m
    existing_policy TEXT,            -- yes | no | draft
    culture_level   TEXT,            -- ad_hoc | developing | established
    onboarded_at    TIMESTAMPTZ,     -- set when the wizard completes (null = needs onboarding)
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Platform admin: workspaces registry, user accounts, invites, audit ───────
-- NOTE: this is a registry/control-plane layer. The single-tenant framework data
-- (org_profile, controls, ...) is not yet partitioned by workspace_id.
CREATE TABLE IF NOT EXISTS workspaces (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    org_type        TEXT,
    tier            TEXT NOT NULL DEFAULT 'free',      -- free | starter | growth | scale | enterprise
    products        TEXT[] NOT NULL DEFAULT '{}',      -- investigate | prevent
    is_pilot        BOOLEAN NOT NULL DEFAULT FALSE,
    pilot_ends_at   TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'active',     -- active | suspended
    internal_notes  TEXT,
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID REFERENCES workspaces(id),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT,
    password_hash   TEXT,
    role            TEXT NOT NULL DEFAULT 'admin',      -- admin | analyst | viewer (workspace role)
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,     -- platform super-admin (can access /admin)
    status          TEXT NOT NULL DEFAULT 'invited',    -- invited | active | suspended
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'admin',
    token           TEXT NOT NULL UNIQUE,
    invited_by      UUID,
    status          TEXT NOT NULL DEFAULT 'pending',    -- pending | accepted | expired
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
    accepted_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID,
    action          TEXT NOT NULL,
    target_type     TEXT,                               -- workspace | user | invite
    target_id       UUID,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_workspace ON users (workspace_id);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites (status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);

-- ── Workspace members (control owners, approvers, training/DD subjects) ──────
CREATE TABLE IF NOT EXISTS workspace_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    email       TEXT,
    role        TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Board governance: append-only, hash-chained approvals / policy versions ──
-- Each row's hash chains the previous row's hash, so any tampering with an earlier
-- approval breaks every subsequent hash — a cryptographic, verifiable record that the
-- board approved the framework and its policies, and when.
CREATE TABLE IF NOT EXISTS policy_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq         BIGSERIAL,
    title       TEXT NOT NULL,
    version     TEXT NOT NULL,
    summary     TEXT,
    author      TEXT,                  -- who recorded the approval (actor)
    approved_by TEXT NOT NULL,         -- approver (workspace member / board)
    approved_at DATE,
    prev_hash   TEXT NOT NULL,
    hash        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Framework definition (seeded, reference data) ───────────────────────────
CREATE TABLE IF NOT EXISTS pillars (
    id          TEXT PRIMARY KEY,          -- e.g. 'risk_assessment'
    name        TEXT NOT NULL,
    principle   TEXT NOT NULL,             -- mapped Home Office guidance principle(s)
    description TEXT NOT NULL,
    weight      NUMERIC NOT NULL DEFAULT 1, -- relative weight in overall readiness
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS requirements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pillar_id   TEXT NOT NULL REFERENCES pillars(id),
    code        TEXT NOT NULL UNIQUE,      -- e.g. 'RA-1'
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    guidance    TEXT,                      -- what "good" looks like / evidence to expect
    sort_order  INT NOT NULL DEFAULT 0
);

-- ── The organisation's live framework state ─────────────────────────────────
-- One control record per requirement: how the org meets (or doesn't) that requirement.
CREATE TABLE IF NOT EXISTS controls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id  UUID NOT NULL UNIQUE REFERENCES requirements(id),
    -- maturity: not_started | in_progress | implemented | embedded
    status          TEXT NOT NULL DEFAULT 'not_started',
    owner           TEXT,
    description     TEXT,                  -- how the org meets this requirement
    last_reviewed   DATE,
    next_review_due DATE,
    updated_by      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evidence attached to a requirement (policies, board minutes, training logs, ...).
CREATE TABLE IF NOT EXISTS evidence_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement_id  UUID NOT NULL REFERENCES requirements(id),
    title           TEXT NOT NULL,
    -- kind: file | policy | document | record | link | attestation | training | minutes
    kind            TEXT NOT NULL DEFAULT 'document',
    reference       TEXT,                  -- URL/location (for link evidence)
    description     TEXT,
    dated           DATE,                  -- date the evidence relates to
    -- uploaded file (primary path): stored on disk, original name kept for download
    stored_path     TEXT,
    original_filename TEXT,
    content_type    TEXT,
    size_bytes      BIGINT,
    added_by        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI- or human-identified gaps in the framework.
CREATE TABLE IF NOT EXISTS gap_findings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pillar_id       TEXT REFERENCES pillars(id),
    requirement_id  UUID REFERENCES requirements(id),
    severity        TEXT NOT NULL DEFAULT 'medium',  -- high | medium | low
    title           TEXT NOT NULL,
    detail          TEXT NOT NULL,
    recommendation  TEXT,
    status          TEXT NOT NULL DEFAULT 'open',     -- open | addressed | dismissed
    source          TEXT NOT NULL DEFAULT 'ai',       -- ai | manual
    llm_provider    TEXT,
    llm_model       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Append-only audit trail (defensibility) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,             -- control | evidence | gap | profile | pack
    entity_id   TEXT,
    action      TEXT NOT NULL,             -- created | updated | status_changed | exported | ...
    actor       TEXT,
    summary     TEXT NOT NULL,
    detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requirements_pillar ON requirements (pillar_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_evidence_requirement ON evidence_items (requirement_id);
CREATE INDEX IF NOT EXISTS idx_gap_status ON gap_findings (status, severity);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC);

-- Audit immutability: the trail is append-only (tamper-resistance for the defence).
CREATE OR REPLACE FUNCTION block_audit_mutation()
RETURNS trigger AS $fn$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only: % blocked', TG_OP
        USING ERRCODE = 'insufficient_privilege',
              HINT = 'The audit trail is an immutable compliance record.';
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_log;
CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION block_audit_mutation();

-- Policy/approval ledger is append-only too (the hash chain enforces integrity,
-- the trigger stops casual edits/deletes).
DROP TRIGGER IF EXISTS trg_policy_versions_immutable ON policy_versions;
CREATE TRIGGER trg_policy_versions_immutable
    BEFORE UPDATE OR DELETE ON policy_versions
    FOR EACH ROW EXECUTE FUNCTION block_audit_mutation();
