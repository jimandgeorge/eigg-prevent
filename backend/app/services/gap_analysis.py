"""AI gap analysis.

Reads the current framework state and produces gap findings: where the organisation
falls short of *reasonable fraud prevention procedures*. The AI flags; humans decide.
Re-running replaces previously open AI findings so the list stays current.
"""
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import llm
from app.services.framework_service import load_framework

SYSTEM = """You are a UK fraud prevention compliance specialist advising on the
"failure to prevent fraud" offence (Economic Crime and Corporate Transparency Act 2023,
in force 1 September 2025). A large organisation has a defence if it had reasonable
fraud prevention procedures, assessed against the Home Office guidance's six principles.

You are given the organisation's current framework: five pillars, each with requirements,
a maturity status (not_started | in_progress | implemented | embedded), and an evidence
count. Identify the most important GAPS that weaken the reasonable-procedures defence.

Rules:
- Ground every finding in the data provided. Do not invent controls that aren't listed.
- Prioritise: not_started requirements and material risks first.
- Be specific about WHY each gap matters under the offence.
- You flag gaps; you never declare the organisation compliant.
- Output valid JSON only, no prose outside it.

Output schema:
{
  "findings": [
    {
      "requirement_code": "e.g. CT-6 (or null if pillar-level)",
      "pillar_id": "risk_assessment|controls|board_governance|due_diligence|training",
      "severity": "high|medium|low",
      "title": "short gap title",
      "detail": "why this is a gap and why it matters under the offence",
      "recommendation": "concrete next step"
    }
  ]
}"""


def _build_prompt(fw: dict) -> str:
    lines = [f"Overall readiness: {fw['overall_score']}/100 ({fw['overall_band']})", ""]
    for p in fw["pillars"]:
        lines.append(f"## {p['name']} ({p['principle']}) — {p['score']}/100")
        for r in p["requirements"]:
            lines.append(
                f"- [{r['code']}] {r['title']} — status: {r['status']}, "
                f"evidence: {r['evidence_count']} item(s)"
            )
        lines.append("")
    return "\n".join(lines)


def _mock_findings(fw: dict) -> list[dict]:
    findings: list[dict] = []
    for p in fw["pillars"]:
        for r in p["requirements"]:
            if r["status"] == "not_started":
                findings.append({
                    "requirement_code": r["code"], "pillar_id": p["id"], "severity": "high",
                    "title": f"{r['title']} is not in place",
                    "detail": (f"[MOCK] {r['code']} ({p['name']}) has not been started. "
                               f"{r['description']} Without it the reasonable-procedures defence is weaker."),
                    "recommendation": r["guidance"] or "Stand up this requirement and record evidence.",
                })
            elif r["status"] == "implemented" and r["evidence_count"] == 0:
                findings.append({
                    "requirement_code": r["code"], "pillar_id": p["id"], "severity": "medium",
                    "title": f"{r['title']} has no evidence on record",
                    "detail": (f"[MOCK] {r['code']} is marked implemented but no evidence is attached. "
                               "A defence relies on demonstrable evidence, not assertion."),
                    "recommendation": "Attach the document or record that demonstrates this control.",
                })
    # Surface high-severity items first, keep it digestible.
    findings.sort(key=lambda f: {"high": 0, "medium": 1, "low": 2}[f["severity"]])
    return findings[:8]


async def run_gap_analysis(db: AsyncSession, provider: str | None = None,
                           actor: str | None = None) -> dict:
    fw = await load_framework(db)
    provider = provider or llm.settings.llm_provider

    if provider == "mock":
        findings = _mock_findings(fw)
    else:
        raw = await llm.complete(SYSTEM, _build_prompt(fw), provider=provider, json_mode=True)
        findings = json.loads(raw).get("findings", [])

    # Map requirement codes to ids.
    rows = (await db.execute(text("SELECT id, code FROM requirements"))).mappings().all()
    code_to_id = {r["code"]: str(r["id"]) for r in rows}

    # Replace previously open AI findings with this fresh run.
    await db.execute(text("DELETE FROM gap_findings WHERE source = 'ai' AND status = 'open'"))

    model = llm.model_name(provider)
    stored = []
    for f in findings:
        rid = code_to_id.get(f.get("requirement_code"))
        await db.execute(text("""
            INSERT INTO gap_findings
                (pillar_id, requirement_id, severity, title, detail, recommendation,
                 status, source, llm_provider, llm_model)
            VALUES
                (:pillar_id, :rid, :severity, :title, :detail, :rec,
                 'open', 'ai', :provider, :model)
        """), {
            "pillar_id": f.get("pillar_id"),
            "rid": rid,
            "severity": f.get("severity", "medium"),
            "title": f.get("title", "Gap"),
            "detail": f.get("detail", ""),
            "rec": f.get("recommendation"),
            "provider": provider,
            "model": model,
        })
        stored.append(f)

    await db.execute(text("""
        INSERT INTO audit_log (entity_type, action, actor, summary, detail)
        VALUES ('gap', 'analysis_run', :actor, :summary, CAST(:detail AS jsonb))
    """), {
        "actor": actor or "system",
        "summary": f"AI gap analysis identified {len(stored)} finding(s)",
        "detail": json.dumps({"provider": provider, "model": model, "count": len(stored)}),
    })
    await db.commit()
    return {"count": len(stored), "provider": provider, "model": model}
