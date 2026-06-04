import { fetchAudit } from "@/lib/api";

export const dynamic = "force-dynamic";

const ACTION_COLOR: Record<string, string> = {
  status_changed: "text-teal-600",
  created: "text-emerald-600",
  deleted: "text-red-600",
  updated: "text-zinc-600",
  exported: "text-blue-600",
  analysis_run: "text-violet-600",
};

const ENTITY_LABEL: Record<string, string> = {
  control: "Control",
  evidence: "Evidence",
  gap: "Gap",
  profile: "Profile",
  pack: "Pack",
  framework: "Framework",
};

export default async function AuditPage() {
  let entries;
  try {
    entries = await fetchAudit();
  } catch {
    return <div className="py-20 text-center text-zinc-500 text-[13px]">Can&apos;t reach the backend.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Audit trail</h1>
        <p className="text-[13px] text-zinc-500 mt-1 max-w-2xl">
          Every change to the framework is recorded — append-only and tamper-resistant. This is the
          evidence that the framework was actively maintained, not assembled after the fact.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="py-16 text-center text-zinc-400 text-[13px]">No activity recorded yet.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 bg-zinc-100 rounded px-1.5 py-0.5 w-16 text-center shrink-0">
                {ENTITY_LABEL[e.entity_type] ?? e.entity_type}
              </span>
              <span className={`text-[11px] font-medium w-24 shrink-0 ${ACTION_COLOR[e.action] ?? "text-zinc-500"}`}>
                {e.action.replace(/_/g, " ")}
              </span>
              <span className="flex-1 min-w-0 text-[13px] text-zinc-700 truncate">{e.summary}</span>
              <span className="text-[11px] text-zinc-400 shrink-0 hidden sm:block">{e.actor ?? "—"}</span>
              <span className="text-[11px] text-zinc-400 font-mono shrink-0 w-32 text-right">
                {new Date(e.created_at).toLocaleString("en-GB")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
