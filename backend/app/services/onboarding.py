"""First-run onboarding — generate a conservative first-pass framework from a short
org profile, then commit it.

The AI proposes a starting maturity, a draft narrative and an owner for each of the 25
requirements. Generation is intentionally conservative: better to start low and earn
improvement than over-claim readiness on day one. Falls back to a deterministic mock so
onboarding works with no API key.
"""
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.framework import (
    CONTROL_TEMPLATES,
    PILLARS,
    REQUIREMENTS,
    STATUS_SCORE,
    related_codes,
)
from app.services import llm, scoring
from app.services.gap_analysis import run_gap_analysis

PILLAR_NAME = {pid: name for pid, name, *_ in PILLARS}
PILLAR_WEIGHT = {pid: w for pid, _n, _p, w, _d in PILLARS}

# Flat requirement metadata in canonical order.
REQ_META = [
    {"code": code, "pillar_id": pid, "title": title, "description": desc, "guidance": guidance}
    for pid, reqs in REQUIREMENTS.items()
    for (code, title, desc, guidance) in reqs
]

VALID_STATUS = set(STATUS_SCORE)

# Owner role suggestion by pillar, varied by organisation type.
_OWNERS = {
    "risk_assessment": {"charity": "Finance Trustee", "other": "Compliance Lead", "_": "MLRO"},
    "controls": {"charity": "Finance Manager", "other": "Operations Lead", "_": "Head of Financial Crime"},
    "board_governance": {"charity": "Board Chair", "other": "Company Secretary", "_": "Company Secretary"},
    "due_diligence": {"charity": "Operations Manager", "other": "HR Lead", "_": "Head of HR"},
    "training": {"charity": "People Lead", "other": "L&D Lead", "_": "L&D Manager"},
}


def _owner_for(pillar_id: str, org_type: str) -> str:
    opts = _OWNERS.get(pillar_id, {"_": "Compliance Lead"})
    return opts.get(org_type, opts["_"])


def scope_from_profile(profile: dict) -> dict:
    employees_over_250 = profile.get("employee_band") == "over_250"
    turnover_over_36m = profile.get("turnover_band") == "over_36m"
    # ECCTA "large organisation" = 2 of 3 thresholds. Balance sheet isn't asked at
    # onboarding, so on these inputs in-scope requires both employees and turnover.
    in_scope = employees_over_250 and turnover_over_36m
    return {
        "employees_over_250": employees_over_250,
        "turnover_over_36m": turnover_over_36m,
        "in_scope": in_scope,
        "note": (
            "Meets the large-organisation thresholds — the failure-to-prevent-fraud offence applies."
            if in_scope else
            "Below the large-organisation thresholds on these inputs, so the offence may not apply. "
            "Reasonable fraud-prevention procedures remain best practice and are expected by partners and regulators."
        ),
    }


# ── Mock generation (no API key) ──────────────────────────────────────────────

# Conservative per-position maturity patterns by current culture. Cycled across
# requirements so the result is a realistic mix rather than a flat line.
_PATTERNS = {
    "ad_hoc":      ["not_started", "not_started", "not_started", "in_progress", "not_started"],
    "developing":  ["in_progress", "not_started", "in_progress", "implemented", "in_progress"],
    "established": ["implemented", "in_progress", "implemented", "in_progress", "implemented"],
}
_POLICY_REQS = {"CT-1", "BG-1", "TR-3"}  # most affected by having an anti-fraud policy


def _bump(status: str) -> str:
    order = ["not_started", "in_progress", "implemented", "embedded"]
    i = min(order.index(status) + 1, len(order) - 1)
    return order[i]


def _mock_items(profile: dict) -> list[dict]:
    culture = profile.get("culture_level", "ad_hoc")
    pattern = _PATTERNS.get(culture, _PATTERNS["ad_hoc"])
    policy = profile.get("existing_policy", "no")
    org_type = profile.get("org_type", "other")

    items = []
    for i, r in enumerate(REQ_META):
        status = pattern[i % len(pattern)]
        if r["code"] in _POLICY_REQS:
            if policy == "yes":
                status = _bump(status)
            elif policy == "draft":
                status = "in_progress" if status == "not_started" else status
            elif policy == "no" and r["code"] == "CT-1":
                status = "not_started"
        items.append({
            "code": r["code"],
            "status": status,
            "narrative": CONTROL_TEMPLATES.get(r["code"], ""),
            "owner": _owner_for(r["pillar_id"], org_type),
        })
    return items


# ── LLM generation ────────────────────────────────────────────────────────────

_SYSTEM = """You are a UK fraud-prevention compliance specialist setting up an organisation's
fraud prevention framework for the "failure to prevent fraud" offence (Economic Crime and
Corporate Transparency Act 2023, in force 1 September 2025). The statutory defence is having
reasonable fraud prevention procedures, assessed against the Home Office guidance's SIX PRINCIPLES:
1) top-level commitment, 2) risk assessment, 3) proportionate risk-based prevention procedures,
4) due diligence, 5) communication (incl. training), 6) monitoring & review.

You are given a short organisation profile and the 25 requirements of the framework. For EACH
requirement propose a realistic STARTING state:
- status: not_started | in_progress | implemented | embedded
- narrative: 1-2 sentences on how an organisation like this would meet it (a draft to edit)
- owner: a suggested role (not a person)

Weight maturity CONSERVATIVELY. It is better to start low and earn improvement than to over-claim
readiness on day one. Only use "embedded" where the profile clearly supports it (e.g. an existing
policy and an established culture). Most early-stage organisations should sit at not_started or
in_progress. Ground proposals in the six principles and the profile — do not invent evidence.

Output valid JSON only: {"items":[{"code":"RA-1","status":"...","narrative":"...","owner":"..."}, ...]}
Include every requirement code exactly once."""


def _build_user(profile: dict) -> str:
    lines = [
        "Organisation profile:",
        f"- Type: {profile.get('org_type')}",
        f"- Employees: {profile.get('employee_band')}",
        f"- Turnover: {profile.get('turnover_band')}",
        f"- Existing anti-fraud policy: {profile.get('existing_policy')}",
        f"- Fraud awareness culture: {profile.get('culture_level')}",
        "",
        "Requirements:",
    ]
    for r in REQ_META:
        lines.append(f"- [{r['code']}] {PILLAR_NAME[r['pillar_id']]}: {r['title']} — {r['description']}")
    lines.append("\nPropose the starting state for every requirement as JSON.")
    return "\n".join(lines)


async def _llm_items(profile: dict, provider: str) -> list[dict]:
    raw = await llm.complete(_SYSTEM, _build_user(profile), provider=provider, json_mode=True, max_tokens=4096)
    parsed = json.loads(raw).get("items", [])
    by_code = {it.get("code"): it for it in parsed if it.get("code")}
    org_type = profile.get("org_type", "other")
    items = []
    for r in REQ_META:
        it = by_code.get(r["code"], {})
        status = it.get("status")
        if status not in VALID_STATUS:
            status = "not_started"
        items.append({
            "code": r["code"],
            "status": status,
            "narrative": (it.get("narrative") or CONTROL_TEMPLATES.get(r["code"], "")).strip(),
            "owner": (it.get("owner") or _owner_for(r["pillar_id"], org_type)).strip(),
        })
    return items


# ── Public API ────────────────────────────────────────────────────────────────

async def generate(profile: dict, provider: str | None = None) -> dict:
    provider = provider or llm.settings.llm_provider
    items = _mock_items(profile) if provider == "mock" else await _llm_items(profile, provider)

    meta_by_code = {r["code"]: r for r in REQ_META}
    by_pillar: dict[str, list[str]] = {}
    enriched = []
    for it in items:
        m = meta_by_code[it["code"]]
        by_pillar.setdefault(m["pillar_id"], []).append(it["status"])
        enriched.append({
            **it,
            "pillar_id": m["pillar_id"],
            "pillar_name": PILLAR_NAME[m["pillar_id"]],
            "title": m["title"],
            "flagged": it["status"] == "not_started",
        })

    pillar_scores = [
        {"score": scoring.mean_score(by_pillar.get(pid, [])), "weight": PILLAR_WEIGHT[pid]}
        for pid in PILLAR_NAME
    ]
    projected = round(scoring.overall_score(pillar_scores), 1)

    return {
        "items": enriched,
        "projected_score": projected,
        "projected_band": scoring.band(projected),
        "scope": scope_from_profile(profile),
        "provider": provider,
        "model": llm.model_name(provider),
    }


async def commit(db: AsyncSession, profile: dict, items: list[dict], actor: str | None) -> dict:
    scope = scope_from_profile(profile)

    # 1) Persist the org profile + derived scope booleans + mark onboarded.
    await db.execute(text("INSERT INTO org_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING"))
    await db.execute(text("""
        UPDATE org_profile SET
            name = COALESCE(:name, name),
            org_type = :org_type,
            employee_band = :employee_band,
            turnover_band = :turnover_band,
            existing_policy = :existing_policy,
            culture_level = :culture_level,
            employees_over_250 = :emp_over,
            turnover_over_36m = :turn_over,
            onboarded_at = NOW(),
            updated_at = NOW()
        WHERE id = 1
    """), {
        "name": profile.get("name"),
        "org_type": profile.get("org_type"),
        "employee_band": profile.get("employee_band"),
        "turnover_band": profile.get("turnover_band"),
        "existing_policy": profile.get("existing_policy"),
        "culture_level": profile.get("culture_level"),
        "emp_over": scope["employees_over_250"],
        "turn_over": scope["turnover_over_36m"],
    })

    # 2) Create workspace members from the distinct suggested owner roles.
    owners = {it["owner"].strip() for it in items if it.get("owner")}
    existing = {r["name"] for r in (await db.execute(text("SELECT name FROM workspace_members"))).mappings().all()}
    for name in sorted(owners - existing):
        await db.execute(text(
            "INSERT INTO workspace_members (name, role) VALUES (:n, 'Suggested owner')"
        ), {"n": name})

    # 3) Apply each requirement's control state.
    code_to_req = {r["code"]: str(r["id"]) for r in
                   (await db.execute(text("SELECT id, code FROM requirements"))).mappings().all()}
    applied = 0
    for it in items:
        rid = code_to_req.get(it["code"])
        if not rid:
            continue
        status = it["status"] if it["status"] in VALID_STATUS else "not_started"
        await db.execute(text("""
            UPDATE controls SET
                status = :status,
                description = :description,
                owner = :owner,
                last_reviewed = CASE WHEN :status = 'not_started' THEN NULL ELSE CURRENT_DATE END,
                next_review_due = CASE WHEN :status = 'not_started' THEN NULL ELSE (CURRENT_DATE + INTERVAL '1 year')::date END,
                updated_by = :actor, updated_at = NOW()
            WHERE requirement_id = :rid
        """), {"status": status, "description": it.get("narrative") or None,
               "owner": it.get("owner") or None, "actor": actor or "Onboarding", "rid": rid})
        applied += 1

    await db.execute(text("""
        INSERT INTO audit_log (entity_type, action, actor, summary, detail)
        VALUES ('framework', 'onboarded', :actor, :summary, CAST(:detail AS jsonb))
    """), {"actor": actor or "Onboarding",
           "summary": f"Framework created via onboarding — {applied} requirements set",
           "detail": json.dumps({"org_type": profile.get("org_type"), "in_scope": scope["in_scope"]})})
    await db.commit()

    # 4) First gap analysis over the committed state (the single source of truth for gaps).
    try:
        await run_gap_analysis(db, actor=actor or "Onboarding")
    except Exception:
        pass  # don't fail onboarding if analysis hiccups

    return {"applied": applied, "in_scope": scope["in_scope"]}


# related_codes re-exported for any caller that wants dependency hints during onboarding.
__all__ = ["generate", "commit", "scope_from_profile", "related_codes"]
