"""Assemble the scored framework from the database."""
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.framework import STATUS_LABELS
from app.services import scoring


def _is_overdue(due) -> bool:
    return bool(due) and due < date.today()


async def load_framework(db: AsyncSession) -> dict:
    """Return the full nested framework: pillars -> requirements -> control + evidence count,
    with readiness scores computed at every level."""
    pillars = (await db.execute(text(
        "SELECT id, name, principle, description, weight, sort_order "
        "FROM pillars ORDER BY sort_order"
    ))).mappings().all()

    reqs = (await db.execute(text("""
        SELECT r.id, r.pillar_id, r.code, r.title, r.description, r.guidance, r.sort_order,
               c.status, c.owner, c.description AS control_description,
               c.last_reviewed, c.next_review_due, c.updated_at, c.updated_by,
               (SELECT COUNT(*) FROM evidence_items e WHERE e.requirement_id = r.id) AS evidence_count
        FROM requirements r
        JOIN controls c ON c.requirement_id = r.id
        ORDER BY r.pillar_id, r.sort_order
    """))).mappings().all()

    open_gaps = (await db.execute(text(
        "SELECT requirement_id, pillar_id, severity FROM gap_findings WHERE status = 'open'"
    ))).mappings().all()
    gaps_by_req: dict[str, int] = {}
    gaps_by_pillar: dict[str, int] = {}
    for g in open_gaps:
        if g["requirement_id"]:
            gaps_by_req[str(g["requirement_id"])] = gaps_by_req.get(str(g["requirement_id"]), 0) + 1
        if g["pillar_id"]:
            gaps_by_pillar[g["pillar_id"]] = gaps_by_pillar.get(g["pillar_id"], 0) + 1

    reqs_by_pillar: dict[str, list] = {}
    for r in reqs:
        reqs_by_pillar.setdefault(r["pillar_id"], []).append(r)

    today = date.today()
    pillar_out = []
    for p in pillars:
        prs = reqs_by_pillar.get(p["id"], [])
        statuses = [r["status"] for r in prs]
        score = scoring.mean_score(statuses)

        due_dates = [r["next_review_due"] for r in prs if r["next_review_due"]]
        pillar_next_due = min(due_dates) if due_dates else None
        pillar_overdue = sum(1 for r in prs if _is_overdue(r["next_review_due"]))

        pillar_out.append({
            "id": p["id"],
            "name": p["name"],
            "principle": p["principle"],
            "description": p["description"],
            "weight": float(p["weight"]),
            "score": round(score, 1),
            "band": scoring.band(score),
            "requirement_count": len(prs),
            "status_breakdown": scoring.status_breakdown(statuses),
            "open_gaps": gaps_by_pillar.get(p["id"], 0),
            "next_review_due": pillar_next_due.isoformat() if pillar_next_due else None,
            "overdue_count": pillar_overdue,
            "requirements": [
                {
                    "id": str(r["id"]),
                    "code": r["code"],
                    "title": r["title"],
                    "description": r["description"],
                    "guidance": r["guidance"],
                    "status": r["status"],
                    "status_label": STATUS_LABELS.get(r["status"], r["status"]),
                    "score": scoring.control_score(r["status"]),
                    "owner": r["owner"],
                    "control_description": r["control_description"],
                    "last_reviewed": r["last_reviewed"].isoformat() if r["last_reviewed"] else None,
                    "next_review_due": r["next_review_due"].isoformat() if r["next_review_due"] else None,
                    "overdue": _is_overdue(r["next_review_due"]),
                    "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                    "updated_by": r["updated_by"],
                    "evidence_count": r["evidence_count"],
                    "open_gaps": gaps_by_req.get(str(r["id"]), 0),
                }
                for r in prs
            ],
        })

    overall = scoring.overall_score([{"score": p["score"], "weight": p["weight"]} for p in pillar_out])
    all_due = [r["next_review_due"] for r in reqs if r["next_review_due"]]
    return {
        "overall_score": round(overall, 1),
        "overall_band": scoring.band(overall),
        "next_review_due": min(all_due).isoformat() if all_due else None,
        "overdue_count": sum(1 for r in reqs if _is_overdue(r["next_review_due"])),
        "pillars": pillar_out,
    }
