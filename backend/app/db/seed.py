"""Create the schema and seed the framework.

Idempotent: safe to run repeatedly. Run with:  python -m app.db.seed
Add --demo to populate illustrative control statuses, evidence and gaps so the
dashboard shows a realistic in-progress framework on first run.
"""
import asyncio
import ssl
import sys
from datetime import date
from pathlib import Path

import asyncpg

from app.core.config import settings
from app.db.framework import PILLARS, REQUIREMENTS

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def _dsn() -> str:
    # asyncpg wants a plain postgres DSN, not the SQLAlchemy +asyncpg form.
    return settings.database_url.replace("+asyncpg", "").split("?")[0]


def _ssl_arg():
    if not settings.db_ssl:
        return None
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# Illustrative demo state: requirement code -> (status, owner, description)
DEMO_CONTROLS = {
    "RA-1": ("embedded", "Priya Shah, MLRO", "Board-approved fraud risk assessment, v3.2, reviewed annually."),
    "RA-2": ("implemented", "Priya Shah, MLRO", "Risk register maps 14 fraud scenarios to categories of associated person."),
    "RA-3": ("implemented", "Risk team", "5x5 likelihood/impact scoring with residual-risk view."),
    "RA-4": ("in_progress", "Risk team", "Annual cadence agreed; event-driven trigger process being formalised."),
    "RA-5": ("in_progress", "Fraud intelligence", "Subscribed to UK Finance + FCA alerts; integration into register is manual."),
    "CT-1": ("embedded", "Compliance", "Anti-fraud policy v4 published on intranet, acknowledged at onboarding."),
    "CT-2": ("implemented", "Finance / Ops", "Controls matrix links material risks to approval limits and dual authorisation."),
    "CT-3": ("implemented", "Fraud ops", "Transaction monitoring + daily exception reporting in place."),
    "CT-4": ("embedded", "HR / Compliance", "Confidential speak-up line operated by external provider."),
    "CT-5": ("in_progress", "Fraud ops", "Response plan drafted; escalation matrix pending sign-off."),
    "CT-6": ("not_started", None, None),
    "BG-1": ("embedded", "Board", "Board statement against fraud minuted Q1; reaffirmed annually."),
    "BG-2": ("implemented", "CEO", "MLRO holds SMF17; framework ownership in role mandate."),
    "BG-3": ("in_progress", "Company Secretary", "Fraud MI added to quarterly risk committee pack."),
    "BG-4": ("not_started", None, None),
    "BG-5": ("in_progress", "CFO", "Dedicated fraud budget line approved for FY26."),
    "DD-1": ("implemented", "Procurement / HR", "Tiered due-diligence procedure by risk and counterparty type."),
    "DD-2": ("implemented", "HR", "Pre-employment screening for finance and payments roles."),
    "DD-3": ("in_progress", "Procurement", "Anti-fraud clauses added to standard contract; rollout to legacy suppliers ongoing."),
    "DD-4": ("not_started", None, None),
    "TR-1": ("implemented", "L&D", "Annual fraud awareness module, 94% completion."),
    "TR-2": ("in_progress", "L&D", "Enhanced module for payments + procurement teams in build."),
    "TR-3": ("implemented", "Comms", "Policy and speak-up channel promoted via intranet and posters."),
    "TR-4": ("implemented", "L&D", "LMS tracks completion; overdue chased monthly."),
    "TR-5": ("not_started", None, None),
}

DEMO_EVIDENCE = {
    "RA-1": [("Fraud Risk Assessment v3.2", "document", "intranet://compliance/fra-v3.2.pdf", "2026-02-10")],
    "CT-1": [("Anti-Fraud Policy v4", "policy", "intranet://policies/anti-fraud-v4", "2026-01-15")],
    "BG-1": [("Board minutes — anti-fraud statement", "minutes", "boardpacks://2026-Q1", "2026-03-04")],
    "TR-1": [("FY26 fraud awareness completion report", "training", "lms://reports/fraud-2026", "2026-05-01")],
}

DEMO_GAPS = [
    ("controls", "CT-6", "high", "No anti-fraud controls over third parties acting on the firm's behalf",
     "Agents and outsourced functions can commit fraud that benefits the organisation, yet no contractual anti-fraud terms or oversight exist for them. This is a direct exposure under the offence.",
     "Add standard anti-fraud clauses to third-party contracts and define oversight of outsourced controls."),
    ("board_governance", "BG-4", "high", "Framework effectiveness is not monitored or reviewed",
     "Principle 6 requires monitoring and review. There is currently no assurance activity testing whether the controls actually work, which weakens the reasonable-procedures defence.",
     "Commission an internal audit / assurance review and stand up a tracked improvement-actions log."),
    ("due_diligence", "DD-4", "medium", "No ongoing re-screening of associated persons",
     "Due diligence is performed at onboarding but never refreshed, so risk that emerges during a relationship is missed.",
     "Define a risk-based re-screening cadence and log refreshed checks."),
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
                # One control row per requirement (created not_started, never downgraded).
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
    print("-> seeding demo state...")
    # Only populate demo state on a fresh framework (no evidence yet) to stay idempotent.
    already = await conn.fetchval("SELECT COUNT(*) FROM evidence_items")
    if already:
        print("  (evidence already present — skipping demo data)")
        return

    code_to_req = {r["code"]: r["id"] for r in await conn.fetch("SELECT id, code FROM requirements")}

    for code, (status, owner, desc) in DEMO_CONTROLS.items():
        rid = code_to_req.get(code)
        if not rid:
            continue
        await conn.execute(
            """
            UPDATE controls
            SET status=$2, owner=$3, description=$4, last_reviewed=CURRENT_DATE,
                next_review_due=(CURRENT_DATE + INTERVAL '1 year')::date,
                updated_by='Demo seed', updated_at=NOW()
            WHERE requirement_id=$1
            """,
            rid, status, owner, desc,
        )

    for code, items in DEMO_EVIDENCE.items():
        rid = code_to_req.get(code)
        if not rid:
            continue
        for title, kind, ref, dated in items:
            await conn.execute(
                """
                INSERT INTO evidence_items (requirement_id, title, kind, reference, dated, added_by)
                VALUES ($1,$2,$3,$4,$5,'Demo seed')
                """,
                rid, title, kind, ref, date.fromisoformat(dated),
            )

    for pillar_id, code, severity, title, detail, rec in DEMO_GAPS:
        rid = code_to_req.get(code)
        await conn.execute(
            """
            INSERT INTO gap_findings (pillar_id, requirement_id, severity, title, detail, recommendation, source)
            VALUES ($1,$2,$3,$4,$5,$6,'ai')
            """,
            pillar_id, rid, severity, title, detail, rec,
        )

    await conn.execute(
        """
        INSERT INTO audit_log (entity_type, action, actor, summary)
        VALUES ('framework', 'seeded', 'Demo seed', 'Framework populated with illustrative demo state')
        """
    )


if __name__ == "__main__":
    demo = "--demo" in sys.argv
    asyncio.run(seed(demo=demo))
