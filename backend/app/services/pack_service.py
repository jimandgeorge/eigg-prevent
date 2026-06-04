"""Evidence pack — a point-in-time "reasonable procedures" report.

Assembles the whole framework, evidence, open gaps and the in-scope test into one
structured document the frontend renders for the board / regulator / court. Generating
a pack is itself an audited event.
"""
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.framework_service import load_framework


def _scope_assessment(profile: dict) -> dict:
    criteria = [
        ("Turnover over £36m", profile.get("turnover_over_36m")),
        ("Balance sheet over £18m", profile.get("balance_sheet_over_18m")),
        ("More than 250 employees", profile.get("employees_over_250")),
    ]
    met = sum(1 for _, v in criteria if v)
    return {
        "criteria": [{"label": l, "met": bool(v)} for l, v in criteria],
        "met_count": met,
        # "large organisation" = any two of three thresholds
        "in_scope": met >= 2,
    }


async def build_pack(db: AsyncSession, actor: str | None = None) -> dict:
    profile = (await db.execute(text("SELECT * FROM org_profile WHERE id = 1"))).mappings().first()
    profile = dict(profile) if profile else {}

    fw = await load_framework(db)

    # Evidence per requirement.
    ev_rows = (await db.execute(text(
        "SELECT requirement_id, title, kind, reference, description, dated "
        "FROM evidence_items ORDER BY created_at"
    ))).mappings().all()
    evidence_by_req: dict[str, list] = {}
    for e in ev_rows:
        evidence_by_req.setdefault(str(e["requirement_id"]), []).append({
            "title": e["title"], "kind": e["kind"], "reference": e["reference"],
            "description": e["description"],
            "dated": e["dated"].isoformat() if e["dated"] else None,
        })

    open_gaps = (await db.execute(text("""
        SELECT g.severity, g.title, g.detail, g.recommendation, g.pillar_id, r.code AS requirement_code
        FROM gap_findings g
        LEFT JOIN requirements r ON r.id = g.requirement_id
        WHERE g.status = 'open'
        ORDER BY CASE g.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
    """))).mappings().all()

    # Attach evidence into the framework structure for the report.
    for p in fw["pillars"]:
        for r in p["requirements"]:
            r["evidence"] = evidence_by_req.get(r["id"], [])

    generated_at = datetime.now(timezone.utc).isoformat()

    await db.execute(text("""
        INSERT INTO audit_log (entity_type, action, actor, summary, detail)
        VALUES ('pack', 'exported', :actor, :summary, CAST(:detail AS jsonb))
    """), {
        "actor": actor or "system",
        "summary": f"Evidence pack generated — overall readiness {fw['overall_score']}/100",
        "detail": '{"overall_score": %s}' % fw["overall_score"],
    })
    await db.commit()

    return {
        "generated_at": generated_at,
        "generated_by": actor,
        "organisation": {
            "name": profile.get("name"),
            "sector": profile.get("sector"),
            "assessment_owner": profile.get("assessment_owner"),
            "notes": profile.get("notes"),
        },
        "scope": _scope_assessment(profile),
        "overall_score": fw["overall_score"],
        "overall_band": fw["overall_band"],
        "pillars": fw["pillars"],
        "open_gaps": [dict(g) for g in open_gaps],
        "offence": {
            "name": "Failure to prevent fraud",
            "act": "Economic Crime and Corporate Transparency Act 2023",
            "in_force": "1 September 2025",
            "defence": "Reasonable fraud prevention procedures (Home Office six principles)",
        },
    }
