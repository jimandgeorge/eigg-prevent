import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPillar } from "@/lib/api";
import { ReadinessRing, ReviewBadge, StatusPill, scoreColor } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PillarPage({ params }: { params: { id: string } }) {
  let pillar;
  try {
    pillar = await fetchPillar(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-8">
      <Link href="/" className="text-[12px] text-zinc-400 hover:text-zinc-700">← Overview</Link>

      <div className="flex items-start gap-8 flex-wrap">
        <ReadinessRing score={pillar.score} band={pillar.band} size={116} />
        <div className="flex-1 min-w-[260px]">
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900">{pillar.name}</h1>
          <div className="text-[12px] text-brand font-medium mt-1">{pillar.principle}</div>
          <p className="text-[13px] text-zinc-500 mt-2 max-w-xl">{pillar.description}</p>
          <div className="mt-2"><ReviewBadge due={pillar.next_review_due} overdue={pillar.overdue_count > 0} /></div>
          <div className="flex gap-6 mt-4">
            <MiniStat label="Requirements" value={pillar.requirement_count} />
            <MiniStat label="Embedded" value={pillar.status_breakdown.embedded + pillar.status_breakdown.implemented} />
            <MiniStat label="Open gaps" value={pillar.open_gaps} warn={pillar.open_gaps > 0} />
            <MiniStat label="Overdue" value={pillar.overdue_count} warn={pillar.overdue_count > 0} />
          </div>
        </div>
      </div>

      {pillar.id === "board_governance" && (
        <Link href="/governance" className="flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 transition-colors">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" /><path d="M9 12l2 2 4-4" /></svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-zinc-900">Approval ledger</div>
            <div className="text-[12px] text-zinc-400">Hash-chained record of board approvals — tamper-evident</div>
          </div>
          <span className="text-[12px] text-brand">Open →</span>
        </Link>
      )}

      <section className="space-y-2">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest px-1">Requirements</span>
        {pillar.requirements.map((r) => (
          <Link
            key={r.id}
            href={`/requirements/${r.id}`}
            className="flex items-center gap-4 px-4 py-3.5 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 transition-colors"
          >
            <span className="text-[11px] font-mono text-zinc-400 w-12 shrink-0">{r.code}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-zinc-900 truncate">{r.title}</span>
                {r.open_gaps > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Open gap" />}
                {r.overdue && <span className="text-[9px] font-semibold text-orange-600 bg-orange-50 rounded px-1 py-px shrink-0">OVERDUE</span>}
              </div>
              <div className="text-[12px] text-zinc-400 mt-0.5 truncate">{r.description}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-zinc-400 tabular-nums">{r.evidence_count} evid.</span>
              <StatusPill status={r.status} />
              <span className="w-10 text-right text-[13px] font-semibold tabular-nums" style={{ color: scoreColor(r.score) }}>
                {r.score}
              </span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-[18px] font-semibold tabular-nums leading-none ${warn ? "text-red-600" : "text-zinc-700"}`}>{value}</div>
    </div>
  );
}
