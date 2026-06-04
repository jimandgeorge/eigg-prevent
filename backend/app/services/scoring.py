"""Readiness scoring.

Each control's maturity status maps to a 0-100 contribution. A pillar's readiness is
the mean of its requirements' scores; overall readiness is the pillar-weighted mean.
Pure functions — no DB — so they're trivial to test.
"""
from app.db.framework import STATUS_SCORE


def control_score(status: str) -> int:
    return STATUS_SCORE.get(status, 0)


def mean_score(statuses: list[str]) -> float:
    if not statuses:
        return 0.0
    return sum(control_score(s) for s in statuses) / len(statuses)


def overall_score(pillars: list[dict]) -> float:
    """pillars: [{"score": float, "weight": float}, ...]"""
    total_weight = sum(p["weight"] for p in pillars) or 1
    return sum(p["score"] * p["weight"] for p in pillars) / total_weight


def band(score: float) -> str:
    if score >= 85:
        return "Embedded"
    if score >= 60:
        return "Established"
    if score >= 30:
        return "Developing"
    if score > 0:
        return "Initial"
    return "Not started"


def status_breakdown(statuses: list[str]) -> dict[str, int]:
    out = {k: 0 for k in STATUS_SCORE}
    for s in statuses:
        if s in out:
            out[s] += 1
    return out
