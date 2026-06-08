"""Board governance — append-only, hash-chained approvals / policy versions.

Each entry's hash = SHA-256(prev_hash + canonical(entry fields)). The first entry
chains from a fixed genesis hash. Tampering with any earlier approval changes its
hash, which breaks prev_hash on every later entry — so the whole chain is verifiable.
"""
import hashlib
import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

GENESIS = hashlib.sha256(b"EIGG-PREVENT-GOVERNANCE-GENESIS").hexdigest()


def _entry_hash(prev_hash: str, fields: dict) -> str:
    payload = json.dumps(fields, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256((prev_hash + payload).encode()).hexdigest()


def _fields(row: dict) -> dict:
    # The canonical content that the hash commits to.
    return {
        "title": row["title"],
        "version": row["version"],
        "summary": row["summary"],
        "approved_by": row["approved_by"],
        "approved_at": row["approved_at"].isoformat() if row.get("approved_at") else None,
    }


async def list_chain(db: AsyncSession, workspace_id: str) -> dict:
    rows = (await db.execute(text("""
        SELECT id, seq, title, version, summary, author, approved_by, approved_at,
               prev_hash, hash, created_at
        FROM policy_versions WHERE workspace_id = :wid ORDER BY seq
    """), {"wid": workspace_id})).mappings().all()

    entries = []
    expected_prev = GENESIS
    chain_valid = True
    for r in rows:
        recomputed = _entry_hash(r["prev_hash"], _fields(r))
        link_ok = (r["prev_hash"] == expected_prev)
        hash_ok = (recomputed == r["hash"])
        verified = link_ok and hash_ok
        if not verified:
            chain_valid = False
        entries.append({
            "id": str(r["id"]),
            "seq": r["seq"],
            "title": r["title"],
            "version": r["version"],
            "summary": r["summary"],
            "author": r["author"],
            "approved_by": r["approved_by"],
            "approved_at": r["approved_at"].isoformat() if r["approved_at"] else None,
            "prev_hash": r["prev_hash"],
            "hash": r["hash"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "verified": verified,
        })
        expected_prev = r["hash"]

    return {"entries": entries, "chain_valid": chain_valid, "genesis": GENESIS, "count": len(entries)}


async def add_entry(db: AsyncSession, workspace_id: str, *, title: str, version: str,
                    summary: str | None, approved_by: str, approved_at, author: str | None) -> dict:
    prev_hash = (await db.execute(text(
        "SELECT hash FROM policy_versions WHERE workspace_id = :wid ORDER BY seq DESC LIMIT 1"
    ), {"wid": workspace_id})).scalar() or GENESIS

    fields = {
        "title": title,
        "version": version,
        "summary": summary,
        "approved_by": approved_by,
        "approved_at": approved_at.isoformat() if approved_at else None,
    }
    h = _entry_hash(prev_hash, fields)

    new_id = (await db.execute(text("""
        INSERT INTO policy_versions (workspace_id, title, version, summary, author, approved_by, approved_at, prev_hash, hash)
        VALUES (:wid, :title, :version, :summary, :author, :approved_by, :approved_at, :prev_hash, :hash)
        RETURNING id
    """), {
        "wid": workspace_id,
        "title": title, "version": version, "summary": summary, "author": author,
        "approved_by": approved_by, "approved_at": approved_at, "prev_hash": prev_hash, "hash": h,
    })).scalar()

    await db.execute(text("""
        INSERT INTO audit_log (workspace_id, entity_type, entity_id, action, actor, summary, detail)
        VALUES (:wid, 'policy', :pid, 'approved', :actor, :summary, CAST(:detail AS jsonb))
    """), {
        "wid": workspace_id,
        "pid": str(new_id), "actor": author or "unknown",
        "summary": f"Policy approved — {title} {version} (by {approved_by})",
        "detail": json.dumps({"hash": h}),
    })
    await db.commit()
    return {"id": str(new_id), "hash": h, "prev_hash": prev_hash}
