"""AI drafting — help a compliance officer author a control narrative for a requirement,
grounded in the evidence on record. The human edits and owns the final text.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import llm

SYSTEM = """You are a UK fraud prevention compliance specialist drafting the narrative
that describes how an organisation meets a specific requirement of its fraud prevention
framework, under the "failure to prevent fraud" offence (ECCTA 2023).

Write a concise, professional paragraph (3-5 sentences) a compliance officer can edit and
adopt. Describe how the control operates, who owns it, and how it is evidenced. Ground the
narrative in the evidence provided — do not invent evidence. If evidence is thin, say plainly
what should be added. Output the paragraph only, no preamble."""


async def draft_control(db: AsyncSession, requirement_id: str,
                        provider: str | None = None) -> dict:
    req = (await db.execute(text("""
        SELECT r.code, r.title, r.description, r.guidance, p.name AS pillar_name,
               c.status, c.owner, c.description AS control_description
        FROM requirements r
        JOIN pillars p ON p.id = r.pillar_id
        JOIN controls c ON c.requirement_id = r.id
        WHERE r.id = :rid
    """), {"rid": requirement_id})).mappings().first()
    if not req:
        raise ValueError("Requirement not found")

    evidence = (await db.execute(text(
        "SELECT title, kind, description, dated FROM evidence_items "
        "WHERE requirement_id = :rid ORDER BY created_at"
    ), {"rid": requirement_id})).mappings().all()

    ev_lines = "\n".join(
        f"- {e['title']} ({e['kind']})" + (f": {e['description']}" if e['description'] else "")
        for e in evidence
    ) or "None on record."

    user = f"""Pillar: {req['pillar_name']}
Requirement [{req['code']}]: {req['title']}
What it asks for: {req['description']}
What good looks like: {req['guidance']}
Current maturity: {req['status']}
Owner: {req['owner'] or 'unassigned'}
Existing narrative: {req['control_description'] or 'none'}

Evidence on record:
{ev_lines}

Draft the control narrative."""

    draft = await llm.complete(SYSTEM, user, provider=provider or llm.settings.llm_provider)
    return {"draft": draft, "provider": provider or llm.settings.llm_provider,
            "model": llm.model_name(provider)}
