"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { addApproval, fetchApprovals, fetchMembers, type Approval, type Member } from "@/lib/api";
import { formatDate } from "@/components/ui";

export default function GovernancePage() {
  const [entries, setEntries] = useState<Approval[]>([]);
  const [chainValid, setChainValid] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const chain = await fetchApprovals();
      setEntries(chain.entries);
      setChainValid(chain.chain_valid);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchMembers().then(setMembers).catch(() => {});
  }, [load]);

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/pillars/board_governance" className="text-[12px] text-zinc-400 hover:text-zinc-700">← Board governance</Link>
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 mt-1">Approval ledger</h1>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-2xl">
            A tamper-evident, hash-chained record of board and senior approvals of the framework and its
            policies. Each entry chains the previous one&apos;s SHA-256, so altering any past approval breaks the chain.
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 shrink-0">
          {open ? "Close" : "Record approval"}
        </button>
      </div>

      {/* Chain integrity banner */}
      {!loading && entries.length > 0 && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] ${chainValid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          <span className={`w-2 h-2 rounded-full ${chainValid ? "bg-emerald-500" : "bg-red-500"}`} />
          {chainValid
            ? `Chain verified — ${entries.length} approval${entries.length > 1 ? "s" : ""}, integrity intact.`
            : "Chain integrity check FAILED — an approval record has been altered."}
        </div>
      )}

      {open && <ApprovalForm members={members} onAdded={() => { setOpen(false); load(); }} />}

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-[13px]">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-700 text-[14px] font-medium">No approvals recorded</p>
          <p className="text-zinc-400 text-[13px] mt-1">Record board sign-off of the framework and key policies to build the chain.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-3.5 rounded-lg border border-zinc-200">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-zinc-400">#{e.seq}</span>
                <span className="text-[13px] font-medium text-zinc-900">{e.title}</span>
                <span className="text-[11px] text-zinc-500">{e.version}</span>
                {e.verified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                    VERIFIED
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-red-700 bg-red-50 rounded px-1.5 py-0.5">BROKEN</span>
                )}
              </div>
              {e.summary && <p className="text-[12px] text-zinc-600 mt-1">{e.summary}</p>}
              <div className="text-[12px] text-zinc-500 mt-1">
                Approved by <span className="font-medium text-zinc-700">{e.approved_by}</span>
                {e.approved_at ? ` · ${formatDate(e.approved_at)}` : ""}
                {e.author ? ` · recorded by ${e.author}` : ""}
              </div>
              <div className="mt-2 font-mono text-[10px] text-zinc-400 break-all">
                hash {e.hash.slice(0, 24)}… · prev {e.prev_hash.slice(0, 16)}…
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalForm({ members, onAdded }: { members: Member[]; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [summary, setSummary] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [approvedAt, setApprovedAt] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const cls = "w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none";

  async function submit() {
    if (!title || !version || !approvedBy) { setErr("Title, version and approver are required."); return; }
    setBusy(true); setErr("");
    try {
      await addApproval({ title, version, summary: summary || undefined, approved_by: approvedBy, approved_at: approvedAt || undefined });
      onAdded();
    } catch (e) {
      setErr((e as Error).message || "Failed to record approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 space-y-3 bg-zinc-50/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={cls} placeholder="What was approved (e.g. Anti-Fraud Policy)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={cls} placeholder="Version / reference (e.g. v4.0)" value={version} onChange={(e) => setVersion(e.target.value)} />
      </div>
      <textarea className={cls} rows={2} placeholder="Summary of what the board approved" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select className={`${cls} bg-white`} value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}>
          <option value="">Approved by…</option>
          {members.map((m) => <option key={m.id} value={m.name}>{m.name}{m.role ? ` — ${m.role}` : ""}</option>)}
          <option value="Board (resolution)">Board (resolution)</option>
        </select>
        <input type="date" className={cls} value={approvedAt} onChange={(e) => setApprovedAt(e.target.value)} />
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50">
          {busy ? "Signing…" : "Record & sign"}
        </button>
      </div>
    </div>
  );
}
