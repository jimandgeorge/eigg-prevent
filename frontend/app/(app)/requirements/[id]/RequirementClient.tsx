"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CLIENT_BASE,
  addEvidence,
  deleteEvidence,
  draftControl,
  evidenceFileUrl,
  fetchMembers,
  updateControl,
  uploadEvidence,
  type Member,
  type RequirementDetail,
  type Status,
} from "@/lib/api";
import { ReviewBadge, STATUS_META, SeverityPill, formatDate } from "@/components/ui";

const STATUSES: Status[] = ["not_started", "in_progress", "implemented", "embedded"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function RequirementClient({ id }: { id: string }) {
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [lastReviewed, setLastReviewed] = useState("");
  const [nextReviewDue, setNextReviewDue] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`${CLIENT_BASE}/framework/requirements/${id}`, { cache: "no-store" });
    if (!res.ok) return setErr("Failed to load requirement");
    const data: RequirementDetail = await res.json();
    setReq(data);
    setOwner(data.owner ?? "");
    setDescription(data.control_description ?? "");
    setLastReviewed(data.last_reviewed ?? "");
    setNextReviewDue(data.next_review_due ?? "");
  }, [id]);

  useEffect(() => {
    load();
    fetchMembers().then(setMembers).catch(() => {});
  }, [load]);

  if (err) return <div className="py-20 text-center text-zinc-500 text-[13px]">{err}</div>;
  if (!req) return <div className="py-20 text-center text-zinc-400 text-[13px]">Loading…</div>;

  const overdue = !!nextReviewDue && nextReviewDue < today();
  // Keep the current owner selectable even if they're no longer an active member.
  const ownerOptions = members.map((m) => m.name);
  if (owner && !ownerOptions.includes(owner)) ownerOptions.unshift(owner);

  async function setStatus(status: Status) {
    setSaving(true);
    try {
      await updateControl(id, { status });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveControl() {
    setSaving(true);
    try {
      await updateControl(id, {
        owner: owner || undefined,
        description,
        last_reviewed: lastReviewed || undefined,
        next_review_due: nextReviewDue || undefined,
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function aiDraft() {
    setDrafting(true);
    try {
      const { draft } = await draftControl(id);
      setDescription(draft);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="space-y-8">
      <Link href={`/pillars/${req.pillar_id}`} className="text-[12px] text-zinc-400 hover:text-zinc-700">
        ← {req.pillar_name}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400">{req.code}</span>
          <span className="text-[11px] text-brand font-medium">{req.principle}</span>
        </div>
        <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900 mt-1">{req.title}</h1>
        <p className="text-[13px] text-zinc-500 mt-2 max-w-2xl">{req.description}</p>
        {req.guidance && (
          <p className="text-[12px] text-zinc-400 mt-2 max-w-2xl">
            <span className="font-medium text-zinc-500">What good looks like:</span> {req.guidance}
          </p>
        )}
      </div>

      {/* Maturity */}
      <section>
        <Label>Maturity</Label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => {
            const active = req.status === s;
            const m = STATUS_META[s];
            return (
              <button
                key={s}
                disabled={saving}
                onClick={() => setStatus(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                  active ? `${m.bg} ${m.text} border-current` : "text-zinc-500 border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Control narrative */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="mb-0">How we meet this requirement</Label>
          <div className="flex items-center gap-3">
            {req.template && (
              <button
                onClick={() => setDescription(req.template as string)}
                className="text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
                title="Insert a starter narrative you can edit"
              >
                Use template
              </button>
            )}
            <button onClick={aiDraft} disabled={drafting} className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50">
              {drafting ? "Drafting…" : "✦ AI draft"}
            </button>
          </div>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the control: how it operates, who owns it, how it's evidenced."
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-800 focus:border-zinc-400 focus:outline-none resize-y"
        />

        {/* Owner + review dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <Field label="Owner">
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] bg-white focus:border-zinc-400 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {ownerOptions.map((name) => {
                const m = members.find((x) => x.name === name);
                return (
                  <option key={name} value={name}>
                    {name}{m?.role ? ` — ${m.role}` : ""}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Last reviewed">
            <input type="date" value={lastReviewed} onChange={(e) => setLastReviewed(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none" />
          </Field>
          <Field label="Next review due">
            <input type="date" value={nextReviewDue} onChange={(e) => setNextReviewDue(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-[13px] focus:outline-none ${overdue ? "border-red-300 text-red-700" : "border-zinc-200 focus:border-zinc-400"}`} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          {nextReviewDue ? <ReviewBadge due={nextReviewDue} overdue={overdue} /> : <span className="text-[11px] text-zinc-400">No review scheduled</span>}
          <div className="flex-1" />
          <button onClick={saveControl} disabled={saving} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* Gaps */}
      {req.gaps.length > 0 && (
        <section className="space-y-2">
          <Label>Open gaps</Label>
          {req.gaps.map((g) => (
            <div key={g.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-red-100 bg-red-50/40">
              <SeverityPill severity={g.severity} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-zinc-900">{g.title}</div>
                <div className="text-[12px] text-zinc-600 mt-0.5">{g.detail}</div>
                {g.recommendation && (
                  <div className="text-[12px] text-zinc-500 mt-1">
                    <span className="font-medium">Recommendation:</span> {g.recommendation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Cross-pillar dependencies */}
      {req.related.length > 0 && (
        <section className="space-y-2">
          <Label>Related across pillars</Label>
          <p className="text-[12px] text-zinc-500 -mt-1">Strengthening this requirement also reinforces these in other pillars.</p>
          {req.related.map((rel) => {
            const m = STATUS_META[rel.status] ?? STATUS_META.not_started;
            return (
              <Link key={rel.id} href={`/requirements/${rel.id}`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 transition-colors">
                <span className="text-[11px] font-mono text-zinc-400 shrink-0">{rel.code}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-zinc-800 truncate">{rel.title} <span className="text-zinc-400">· {rel.pillar_name}</span></div>
                  <div className="text-[12px] text-zinc-400 truncate">{rel.reason}</div>
                </div>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} title={m.label} />
              </Link>
            );
          })}
        </section>
      )}

      {/* Evidence */}
      <section className="space-y-3">
        <Label>Evidence ({req.evidence.length})</Label>
        {req.evidence.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-200">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">
              {e.kind}
            </span>
            <div className="flex-1 min-w-0">
              {e.is_file ? (
                <a href={evidenceFileUrl(e.id)} target="_blank" rel="noopener noreferrer" className="text-[13px] text-zinc-800 hover:text-brand truncate inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3.5h7L19 8.5V20a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1zM14 3.5V8.5H19" /></svg>
                  {e.title}
                </a>
              ) : (
                <div className="text-[13px] text-zinc-800 truncate">{e.title}</div>
              )}
              {e.is_file ? (
                <div className="text-[11px] text-zinc-400 truncate">{e.original_filename} · {fmtSize(e.size_bytes)}</div>
              ) : e.reference ? (
                <div className="text-[11px] text-zinc-400 font-mono truncate">{e.reference}</div>
              ) : null}
            </div>
            {e.dated && <span className="text-[11px] text-zinc-400 shrink-0">{formatDate(e.dated)}</span>}
            <button onClick={async () => { await deleteEvidence(e.id); load(); }} className="text-zinc-300 hover:text-red-500 text-[14px] shrink-0" aria-label="Delete evidence">×</button>
          </div>
        ))}
        <EvidenceForm requirementId={id} onChanged={load} />
      </section>

      <div className="text-[11px] text-zinc-400 pt-4 border-t border-zinc-100">
        {req.updated_by ? `Last updated by ${req.updated_by}` : "Not yet updated"}
        {req.updated_at ? ` · ${new Date(req.updated_at).toLocaleString("en-GB")}` : ""}
      </div>
    </div>
  );
}

const KINDS = ["policy", "document", "record", "minutes", "training", "attestation", "link"];

function EvidenceForm({ requirementId, onChanged }: { requirementId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // shared
  const [title, setTitle] = useState("");
  const [dated, setDated] = useState("");
  // link mode
  const [kind, setKind] = useState("document");
  const [reference, setReference] = useState("");

  function reset() {
    setTitle(""); setDated(""); setReference(""); setKind("document"); setErr("");
    if (fileRef.current) fileRef.current.value = "";
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[12px] text-brand hover:underline">
        + Add evidence
      </button>
    );
  }

  async function submit() {
    setBusy(true); setErr("");
    try {
      if (mode === "file") {
        const file = fileRef.current?.files?.[0];
        if (!file) { setErr("Choose a file to upload."); setBusy(false); return; }
        await uploadEvidence(requirementId, file, { title: title || undefined, dated: dated || undefined });
      } else {
        if (!title) { setErr("Give the evidence a title."); setBusy(false); return; }
        await addEvidence(requirementId, { title, kind, reference: reference || undefined, dated: dated || undefined });
      }
      reset(); setOpen(false); onChanged();
    } catch (e) {
      setErr((e as Error).message || "Failed to add evidence");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-3 space-y-3 bg-zinc-50/50">
      {/* Mode toggle — upload primary, link secondary */}
      <div className="flex items-center gap-1 text-[12px]">
        <button onClick={() => setMode("file")} className={`px-2.5 py-1 rounded ${mode === "file" ? "bg-ink text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>Upload file</button>
        <button onClick={() => setMode("link")} className={`px-2.5 py-1 rounded ${mode === "link" ? "bg-ink text-white" : "text-zinc-500 hover:bg-zinc-100"}`}>Link instead</button>
        <span className="text-[11px] text-zinc-400 ml-1">{mode === "file" ? "Recommended — store the document itself" : "Reference a document held elsewhere"}</span>
      </div>

      {mode === "file" ? (
        <input ref={fileRef} type="file"
          className="block w-full text-[12px] text-zinc-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-zinc-200 file:text-zinc-700 file:text-[12px] hover:file:bg-zinc-300" />
      ) : (
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded border border-zinc-200 px-2 py-1.5 text-[12px] bg-white focus:border-zinc-400 focus:outline-none">
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / URL / location"
            className="flex-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[13px] focus:border-zinc-400 focus:outline-none" />
        </div>
      )}

      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "file" ? "Title (optional — defaults to filename)" : "Evidence title"}
          className="flex-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[13px] focus:border-zinc-400 focus:outline-none" />
        <input type="date" value={dated} onChange={(e) => setDated(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1.5 text-[12px] focus:border-zinc-400 focus:outline-none" />
      </div>

      {err && <p className="text-[12px] text-red-600">{err}</p>}

      <div className="flex gap-2 justify-end">
        <button onClick={() => { reset(); setOpen(false); }} className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-700">Cancel</button>
        <button disabled={busy} onClick={submit} className="px-3 py-1.5 rounded bg-ink text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50">
          {busy ? (mode === "file" ? "Uploading…" : "Adding…") : mode === "file" ? "Upload" : "Add link"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-zinc-500 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 ${className}`}>{children}</div>;
}
