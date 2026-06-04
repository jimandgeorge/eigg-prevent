"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CLIENT_BASE,
  addEvidence,
  deleteEvidence,
  draftControl,
  updateControl,
  type RequirementDetail,
  type Status,
} from "@/lib/api";
import { STATUS_META, SeverityPill } from "@/components/ui";

const STATUSES: Status[] = ["not_started", "in_progress", "implemented", "embedded"];
const KINDS = ["policy", "document", "record", "minutes", "training", "attestation", "link"];

export default function RequirementClient({ id }: { id: string }) {
  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);

  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`${CLIENT_BASE}/framework/requirements/${id}`, { cache: "no-store" });
    if (!res.ok) return setErr("Failed to load requirement");
    const data: RequirementDetail = await res.json();
    setReq(data);
    setOwner(data.owner ?? "");
    setDescription(data.control_description ?? "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (err) return <div className="py-20 text-center text-zinc-500 text-[13px]">{err}</div>;
  if (!req) return <div className="py-20 text-center text-zinc-400 text-[13px]">Loading…</div>;

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
      await updateControl(id, { owner, description });
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
          <button
            onClick={aiDraft}
            disabled={drafting}
            className="text-[11px] font-medium text-brand hover:underline disabled:opacity-50"
          >
            {drafting ? "Drafting…" : "✦ AI draft"}
          </button>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the control: how it operates, who owns it, how it's evidenced."
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] text-zinc-800 focus:border-zinc-400 focus:outline-none resize-y"
        />
        <div className="flex items-center gap-3">
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner (e.g. MLRO)"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none"
          />
          <button
            onClick={saveControl}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
          >
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

      {/* Evidence */}
      <section className="space-y-3">
        <Label>Evidence ({req.evidence.length})</Label>
        {req.evidence.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-200">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5 shrink-0">
              {e.kind}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-zinc-800 truncate">{e.title}</div>
              {e.reference && <div className="text-[11px] text-zinc-400 font-mono truncate">{e.reference}</div>}
            </div>
            {e.dated && <span className="text-[11px] text-zinc-400 shrink-0">{e.dated}</span>}
            <button
              onClick={async () => {
                await deleteEvidence(e.id);
                load();
              }}
              className="text-zinc-300 hover:text-red-500 text-[14px] shrink-0"
              aria-label="Delete evidence"
            >
              ×
            </button>
          </div>
        ))}
        <EvidenceForm requirementId={id} onAdded={load} />
      </section>

      <div className="text-[11px] text-zinc-400 pt-4 border-t border-zinc-100">
        {req.updated_by ? `Last updated by ${req.updated_by}` : "Not yet updated"}
        {req.updated_at ? ` · ${new Date(req.updated_at).toLocaleString("en-GB")}` : ""}
      </div>
    </div>
  );
}

function EvidenceForm({ requirementId, onAdded }: { requirementId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("document");
  const [reference, setReference] = useState("");
  const [dated, setDated] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[12px] text-brand hover:underline">
        + Add evidence
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-3 space-y-2 bg-zinc-50/50">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Evidence title (e.g. Anti-Fraud Policy v4)"
        className="w-full rounded border border-zinc-200 px-2.5 py-1.5 text-[13px] focus:border-zinc-400 focus:outline-none"
      />
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1.5 text-[12px] focus:border-zinc-400 focus:outline-none">
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference / location"
          className="flex-1 rounded border border-zinc-200 px-2.5 py-1.5 text-[13px] focus:border-zinc-400 focus:outline-none" />
        <input type="date" value={dated} onChange={(e) => setDated(e.target.value)}
          className="rounded border border-zinc-200 px-2 py-1.5 text-[12px] focus:border-zinc-400 focus:outline-none" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-700">Cancel</button>
        <button
          disabled={busy || !title}
          onClick={async () => {
            setBusy(true);
            try {
              await addEvidence(requirementId, { title, kind, reference: reference || undefined, dated: dated || undefined });
              setTitle(""); setReference(""); setDated(""); setOpen(false);
              onAdded();
            } finally {
              setBusy(false);
            }
          }}
          className="px-3 py-1.5 rounded bg-ink text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 ${className}`}>{children}</div>;
}
