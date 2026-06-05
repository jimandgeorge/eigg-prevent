"""Create the schema and seed the framework.

Idempotent: safe to run repeatedly. Run with:  python -m app.db.seed
Add --demo to populate illustrative members, control statuses, evidence, gaps and a
clean audit trail so the dashboard shows a realistic in-progress framework on first run.
The --demo path resets demo state (evidence, gaps, audit, control status) so reseeding
always yields one clean snapshot — no duplicate audit entries.
"""
import asyncio
import hashlib
import json
import ssl
import sys
from datetime import date
from pathlib import Path

import asyncpg

from app.core.config import settings
from app.db.framework import PILLARS, REQUIREMENTS

# Mirror of app.services.governance hashing so seeded chains verify.
_GOV_GENESIS = hashlib.sha256(b"EIGG-PREVENT-GOVERNANCE-GENESIS").hexdigest()


def _gov_hash(prev_hash: str, title, version, summary, approved_by, approved_at) -> str:
    fields = {
        "title": title, "version": version, "summary": summary,
        "approved_by": approved_by,
        "approved_at": approved_at.isoformat() if approved_at else None,
    }
    payload = json.dumps(fields, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256((prev_hash + payload).encode()).hexdigest()

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _dsn() -> str:
    return settings.database_url.replace("+asyncpg", "").split("?")[0]


def _ssl_arg():
    if not settings.db_ssl:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# Workspace members — control owners / approvers. (name, role, email)
MEMBERS = [
    ("Priya Shah", "MLRO", "priya.shah@example.com"),
    ("James Okafor", "Head of Financial Crime", "james.okafor@example.com"),
    ("Sarah Bennett", "Chief Compliance Officer", "sarah.bennett@example.com"),
    ("David Lin", "CFO", "david.lin@example.com"),
    ("Rachel Adeyemi", "Head of HR", "rachel.adeyemi@example.com"),
    ("Tom Fletcher", "Procurement Lead", "tom.fletcher@example.com"),
    ("Elena Rossi", "L&D Manager", "elena.rossi@example.com"),
    ("Mark Davies", "Company Secretary", "mark.davies@example.com"),
]

# Illustrative demo state: requirement code -> (status, owner, description)
DEMO_CONTROLS = {
    "RA-1": ("embedded", "Priya Shah", "Board-approved fraud risk assessment, v3.2, reviewed annually."),
    "RA-2": ("implemented", "Priya Shah", "Risk register maps 14 fraud scenarios to categories of associated person."),
    "RA-3": ("implemented", "James Okafor", "5x5 likelihood/impact scoring with residual-risk view."),
    "RA-4": ("in_progress", "James Okafor", "Annual cadence agreed; event-driven trigger process being formalised."),
    "RA-5": ("in_progress", "James Okafor", "Subscribed to UK Finance + FCA alerts; integration into register is manual."),
    "CT-1": ("embedded", "Sarah Bennett", "Anti-fraud policy v4 published on intranet, acknowledged at onboarding."),
    "CT-2": ("implemented", "David Lin", "Controls matrix links material risks to approval limits and dual authorisation."),
    "CT-3": ("implemented", "James Okafor", "Transaction monitoring + daily exception reporting in place."),
    "CT-4": ("embedded", "Rachel Adeyemi", "Confidential speak-up line operated by external provider."),
    "CT-5": ("in_progress", "James Okafor", "Response plan drafted; escalation matrix pending sign-off."),
    "CT-6": ("not_started", None, None),
    "BG-1": ("embedded", "Mark Davies", "Board statement against fraud minuted Q1; reaffirmed annually."),
    "BG-2": ("implemented", "Sarah Bennett", "MLRO holds SMF17; framework ownership in role mandate."),
    "BG-3": ("in_progress", "Mark Davies", "Fraud MI added to quarterly risk committee pack."),
    "BG-4": ("not_started", None, None),
    "BG-5": ("in_progress", "David Lin", "Dedicated fraud budget line approved for FY26."),
    "DD-1": ("implemented", "Tom Fletcher", "Tiered due-diligence procedure by risk and counterparty type."),
    "DD-2": ("implemented", "Rachel Adeyemi", "Pre-employment screening for finance and payments roles."),
    "DD-3": ("in_progress", "Tom Fletcher", "Anti-fraud clauses added to standard contract; rollout to legacy suppliers ongoing."),
    "DD-4": ("not_started", None, None),
    "TR-1": ("implemented", "Elena Rossi", "Annual fraud awareness module, 94% completion."),
    "TR-2": ("in_progress", "Elena Rossi", "Enhanced module for payments + procurement teams in build."),
    "TR-3": ("implemented", "Sarah Bennett", "Policy and speak-up channel promoted via intranet and posters."),
    "TR-4": ("implemented", "Elena Rossi", "LMS tracks completion; overdue chased monthly."),
    "TR-5": ("not_started", None, None),
}

# A few reviews are deliberately in the past so overdue status is visible in the demo.
DEMO_OVERDUE = {"RA-4", "BG-3", "TR-1"}

DEMO_EVIDENCE = {
    "RA-1": [("Fraud Risk Assessment v3.2", "document", "intranet://compliance/fra-v3.2.pdf", "2026-02-10")],
    "CT-1": [("Anti-Fraud Policy v4", "policy", "intranet://policies/anti-fraud-v4", "2026-01-15")],
    "BG-1": [("Board minutes — anti-fraud statement", "minutes", "boardpacks://2026-Q1", "2026-03-04")],
    "TR-1": [("FY26 fraud awareness completion report", "training", "lms://reports/fraud-2026", "2026-05-01")],
}

# (pillar_id, code, severity, status, title, detail, recommendation)
DEMO_GAPS = [
    ("controls", "CT-6", "high", "open", "No anti-fraud controls over third parties acting on the firm's behalf",
     "Agents and outsourced functions can commit fraud that benefits the organisation, yet no contractual anti-fraud terms or oversight exist for them. This is a direct exposure under the offence.",
     "Add standard anti-fraud clauses to third-party contracts and define oversight of outsourced controls."),
    ("board_governance", "BG-4", "high", "open", "Framework effectiveness is not monitored or reviewed",
     "Principle 6 requires monitoring and review. There is currently no assurance activity testing whether the controls actually work, which weakens the reasonable-procedures defence.",
     "Commission an internal audit / assurance review and stand up a tracked improvement-actions log."),
    ("due_diligence", "DD-4", "medium", "open", "No ongoing re-screening of associated persons",
     "Due diligence is performed at onboarding but never refreshed, so risk that emerges during a relationship is missed.",
     "Define a risk-based re-screening cadence and log refreshed checks."),
    # Resolved items so the Addressed / Dismissed tabs feel real.
    ("controls", "CT-5", "medium", "addressed", "Fraud response plan not finalised",
     "The incident response plan existed in draft without a signed-off escalation matrix.",
     "Finalise and sign off the escalation matrix; socialise with fraud ops."),
    ("training", "TR-2", "low", "dismissed", "Enhanced training not yet live for all high-risk roles",
     "Enhanced modules are in build; general awareness training already covers these staff in the interim.",
     "Accept interim coverage; revisit once enhanced modules ship."),
]

# Board approvals (hash-chained). (title, version, summary, approved_by, approved_at)
DEMO_APPROVALS = [
    ("Fraud Prevention Framework", "2026 annual review",
     "Board sign-off of the fraud prevention framework and statement of top-level commitment against fraud.",
     "Board (resolution 2026-03)", date(2026, 3, 4)),
    ("Anti-Fraud Policy", "v4.0",
     "Board approval of the refreshed anti-fraud policy following the annual fraud risk assessment.",
     "Mark Davies", date(2026, 1, 15)),
    ("Whistleblowing / Speak-Up Policy", "v2.1",
     "Approval of the updated speak-up policy and anti-retaliation provisions.",
     "Sarah Bennett", date(2026, 4, 20)),
]

# Seeded audit trail — named actors, one clean export. (entity_type, action, actor, summary)
DEMO_AUDIT = [
    ("control", "status_changed", "Priya Shah", "RA-1: status implemented → embedded"),
    ("evidence", "created", "Sarah Bennett", "CT-1: evidence added — Anti-Fraud Policy v4"),
    ("control", "status_changed", "David Lin", "CT-2: status in_progress → implemented"),
    ("gap", "marked_addressed", "James Okafor", "Gap addressed — Fraud response plan not finalised"),
    ("pack", "exported", "Priya Shah", "Evidence pack generated — overall readiness snapshot"),
]


async def seed(demo: bool = False):
    conn = await asyncpg.connect(_dsn(), ssl=_ssl_arg())
    try:
        print("-> applying schema...")
        await conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))

        print("-> ensuring org profile...")
        await conn.execute("INSERT INTO org_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING")

        print("-> seeding pillars...")
        for order, (pid, name, principle, weight, desc) in enumerate(PILLARS):
            await conn.execute(
                """
                INSERT INTO pillars (id, name, principle, description, weight, sort_order)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (id) DO UPDATE SET
                    name=$2, principle=$3, description=$4, weight=$5, sort_order=$6
                """,
                pid, name, principle, desc, weight, order,
            )

        print("-> seeding requirements + control rows...")
        for pid, reqs in REQUIREMENTS.items():
            for order, (code, title, desc, guidance) in enumerate(reqs):
                req_id = await conn.fetchval(
                    """
                    INSERT INTO requirements (pillar_id, code, title, description, guidance, sort_order)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    ON CONFLICT (code) DO UPDATE SET
                        pillar_id=$1, title=$3, description=$4, guidance=$5, sort_order=$6
                    RETURNING id
                    """,
                    pid, code, title, desc, guidance, order,
                )
                await conn.execute(
                    """
                    INSERT INTO controls (requirement_id, status)
                    VALUES ($1, 'not_started')
                    ON CONFLICT (requirement_id) DO NOTHING
                    """,
                    req_id,
                )

        if demo:
            await _seed_demo(conn)

        print("[ok] seed complete")
    finally:
        await conn.close()


async def _seed_demo(conn):
    print("-> resetting + seeding demo state...")
    # Clean slate for demo so reseeding never duplicates (TRUNCATE bypasses the
    # audit_log append-only row trigger; safe for a dev/demo reset only).
    await conn.execute("TRUNCATE audit_log")
    await conn.execute("TRUNCATE policy_versions")
    await conn.execute("DELETE FROM evidence_items")
    await conn.execute("DELETE FROM gap_findings")
    await conn.execute("DELETE FROM workspace_members")
    await conn.execute(
        "UPDATE controls SET status='not_started', owner=NULL, description=NULL, "
        "last_reviewed=NULL, next_review_due=NULL, updated_by=NULL"
    )

    for name, role, email in MEMBERS:
        await conn.execute(
            "INSERT INTO workspace_members (name, role, email) VALUES ($1,$2,$3)",
            name, role, email,
        )

    code_to_req = {r["code"]: r["id"] for r in await conn.fetch("SELECT id, code FROM requirements")}

    for code, (status, owner, desc) in DEMO_CONTROLS.items():
        rid = code_to_req.get(code)
        if not rid:
            continue
        # Past due for the deliberately-overdue set; otherwise next year.
        next_due = "next_overdue" if code in DEMO_OVERDUE else "next_year"
        await conn.execute(
            """
            UPDATE controls
            SET status=$2, owner=$3, description=$4,
                last_reviewed = CASE WHEN $2 = 'not_started' THEN NULL ELSE CURRENT_DATE - INTERVAL '11 months' END,
                next_review_due = CASE
                    WHEN $2 = 'not_started' THEN NULL
                    WHEN $5 = 'next_overdue' THEN CURRENT_DATE - INTERVAL '3 weeks'
                    ELSE CURRENT_DATE + INTERVAL '1 month' END,
                updated_by='Priya Shah', updated_at=NOW()
            WHERE requirement_id=$1
            """,
            rid, status, owner, desc, next_due,
        )

    for code, items in DEMO_EVIDENCE.items():
        rid = code_to_req.get(code)
        if not rid:
            continue
        for title, kind, ref, dated in items:
            await conn.execute(
                """
                INSERT INTO evidence_items (requirement_id, title, kind, reference, dated, added_by)
                VALUES ($1,$2,$3,$4,$5,'Sarah Bennett')
                """,
                rid, title, kind, ref, date.fromisoformat(dated),
            )

    for pillar_id, code, severity, status, title, detail, rec in DEMO_GAPS:
        rid = code_to_req.get(code)
        source = "ai" if status == "open" else "manual"
        await conn.execute(
            """
            INSERT INTO gap_findings (pillar_id, requirement_id, severity, title, detail, recommendation, status, source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            """,
            pillar_id, rid, severity, title, detail, rec, status, source,
        )

    prev = _GOV_GENESIS
    for title, version, summary, approved_by, approved_at in DEMO_APPROVALS:
        h = _gov_hash(prev, title, version, summary, approved_by, approved_at)
        await conn.execute(
            """
            INSERT INTO policy_versions (title, version, summary, author, approved_by, approved_at, prev_hash, hash)
            VALUES ($1,$2,$3,'Priya Shah',$4,$5,$6,$7)
            """,
            title, version, summary, approved_by, approved_at, prev, h,
        )
        prev = h

    for entity_type, action, actor, summary in DEMO_AUDIT:
        await conn.execute(
            "INSERT INTO audit_log (entity_type, action, actor, summary) VALUES ($1,$2,$3,$4)",
            entity_type, action, actor, summary,
        )


if __name__ == "__main__":
    demo = "--demo" in sys.argv
    asyncio.run(seed(demo=demo))
