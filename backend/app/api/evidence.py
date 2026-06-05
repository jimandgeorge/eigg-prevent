import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.schemas import EvidenceCreate

router = APIRouter(prefix="/evidence", tags=["evidence"])

UPLOAD_DIR = Path(settings.upload_dir)


async def _requirement_code(db: AsyncSession, requirement_id: str) -> str | None:
    return (await db.execute(text(
        "SELECT code FROM requirements WHERE id = :rid"), {"rid": requirement_id})).scalar()


@router.post("/{requirement_id}/upload")
async def upload_evidence(
    requirement_id: str,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    description: str | None = Form(default=None),
    dated: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    """Primary evidence path: upload the actual document. Regulators want the file,
    not a path that can break."""
    code = await _requirement_code(db, requirement_id)
    if not code:
        raise HTTPException(404, "Requirement not found")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / stored_name
    data = await file.read()
    dest.write_bytes(data)

    new_id = (await db.execute(text("""
        INSERT INTO evidence_items
            (requirement_id, title, kind, description, dated,
             stored_path, original_filename, content_type, size_bytes, added_by)
        VALUES (:rid, :title, 'file', :description, :dated,
                :stored, :orig, :ctype, :size, :actor)
        RETURNING id
    """), {
        "rid": requirement_id,
        "title": (title or file.filename or "Uploaded file").strip(),
        "description": description,
        "dated": dated or None,
        "stored": stored_name,
        "orig": file.filename,
        "ctype": file.content_type,
        "size": len(data),
        "actor": x_actor or "unknown",
    })).scalar()

    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('evidence', :eid, 'uploaded', :actor, :summary)
    """), {"eid": str(new_id), "actor": x_actor or "unknown",
           "summary": f"{code}: file uploaded — {file.filename}"})
    await db.commit()
    return {"id": str(new_id)}


@router.post("/{requirement_id}")
async def add_evidence(
    requirement_id: str,
    body: EvidenceCreate,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    """Secondary evidence path: a link / reference to where the document lives."""
    code = await _requirement_code(db, requirement_id)
    if not code:
        raise HTTPException(404, "Requirement not found")

    new_id = (await db.execute(text("""
        INSERT INTO evidence_items (requirement_id, title, kind, reference, description, dated, added_by)
        VALUES (:rid, :title, :kind, :reference, :description, :dated, :actor)
        RETURNING id
    """), {
        "rid": requirement_id, "title": body.title, "kind": body.kind,
        "reference": body.reference, "description": body.description,
        "dated": body.dated, "actor": x_actor or "unknown",
    })).scalar()

    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('evidence', :eid, 'created', :actor, :summary)
    """), {"eid": str(new_id), "actor": x_actor or "unknown",
           "summary": f"{code}: evidence linked — {body.title}"})
    await db.commit()
    return {"id": str(new_id)}


@router.get("/file/{evidence_id}")
async def download_evidence(evidence_id: str, db: AsyncSession = Depends(get_db)):
    row = (await db.execute(text(
        "SELECT stored_path, original_filename, content_type FROM evidence_items WHERE id = :eid"
    ), {"eid": evidence_id})).mappings().first()
    if not row or not row["stored_path"]:
        raise HTTPException(404, "File not found")
    path = UPLOAD_DIR / row["stored_path"]
    if not path.exists():
        raise HTTPException(404, "File missing on disk")
    return FileResponse(
        path,
        media_type=row["content_type"] or "application/octet-stream",
        filename=row["original_filename"] or "evidence",
    )


@router.delete("/{evidence_id}")
async def delete_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    x_actor: str | None = Header(default=None),
):
    row = (await db.execute(text(
        "SELECT title, stored_path FROM evidence_items WHERE id = :eid"), {"eid": evidence_id})).mappings().first()
    if not row:
        raise HTTPException(404, "Evidence not found")
    await db.execute(text("DELETE FROM evidence_items WHERE id = :eid"), {"eid": evidence_id})
    # Best-effort remove the stored file.
    if row["stored_path"]:
        try:
            (UPLOAD_DIR / row["stored_path"]).unlink(missing_ok=True)
        except OSError:
            pass
    await db.execute(text("""
        INSERT INTO audit_log (entity_type, entity_id, action, actor, summary)
        VALUES ('evidence', :eid, 'deleted', :actor, :summary)
    """), {"eid": evidence_id, "actor": x_actor or "unknown",
           "summary": f"Evidence removed — {row['title']}"})
    await db.commit()
    return {"ok": True}
