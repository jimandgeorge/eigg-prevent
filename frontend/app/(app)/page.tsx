import Link from "next/link";
import { fetchFramework, fetchGaps } from "@/lib/api";
import { ReadinessRing, ScoreBar, SeverityPill, scoreColor } from "@/components/ui";

export const dynamic = "force-dynamic";

const PILLAR_ICON: Record<string, string> = {
  risk_assessment: "M3 3v18h18M7 14l3-3 3 3 5-5",
  controls: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z",
  board_governance: "M3 21h18M5 21V10m4 11V10m6 11V10m4 11V10M3 10l9-6 9 6",
  due_diligence: "M11 4a7 7 0 100 14 7 7 0 000-14zm10 17l-5-5",
  training: "M12 4L2 9l10 5 10-5-10-5zm0 12v6m-6-9v4c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-4",
};

export default async function DashboardPage() {
  let fw, gaps;
  try {
    [fw, gaps] = await Promise.all([fetchFramework(), fetchGaps("open")]);
  } catch {
    return <ConnError />;
  }

  const highGaps = gaps.filter((g) => g.severity === "high").length;
  const notStarted = fw.pillars.reduce((s, p) => s + (p.status_breakdown.not_started || 0), 0);
  const totalReqs = fw.pillars.reduce((s, p) => s + p.requirement_count, 0);

  return (
    <div className="space-y-9">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Framework readiness</h1>
        <p className="text-[13px] text-zinc-500 mt-1 max-w-2xl">
          Your defence against the <span className="font-medium text-zinc-700">failure to prevent fraud</span> offence
          (ECCTA 2023), evidenced across the five pillars of reasonable procedures.
        </p>
      </div>

      {/* Headline */}
      <section className="flex items-center gap-10 flex-wrap">
        <ReadinessRing score={fw.overall_score} band={fw.overall_band} />
        <div className="flex items-center gap-10 flex-wrap">
          <Stat label="Requirements" value={totalReqs} />
          <Stat label="Not started" value={notStarted} tone={notStarted > 0 ? "warn" : "ok"} />
          <Stat label="Open gaps" value={gaps.length} tone={gaps.length > 0 ? "warn" : "ok"} />
          <Stat label="High severity" value={highGaps} tone={highGaps > 0 ? "bad" : "ok"} />
        </div>
      </section>

      {/* Pillars */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Pillars</span>
          <Link href="/pack" className="text-[12px] text-brand hover:underline">Generate evidence pack →</Link>
        </div>
        {fw.pillars.map((p) => (
          <Link
            key={p.id}
            href={`/pillars/${p.id}`}
            className="group flex items-center gap-4 px-4 py-3.5 rounded-lg border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 transition-colors"
          >
            <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${scoreColor(p.score)}1a`, color: scoreColor(p.score) }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d={PILLAR_ICON[p.id] ?? PILLAR_ICON.controls} />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-zinc-900 truncate">{p.name}</span>
                {p.open_gaps > 0 && (
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded px-1.5 py-0.5">
                    {p.open_gaps} gap{p.open_gaps > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{p.principle}</div>
              <div className="mt-2 max-w-md"><ScoreBar score={p.score} /></div>
            </div>
            <div className="text-right shrink-0 w-16">
              <div className="text-[18px] font-semibold tabular-nums" style={{ color: scoreColor(p.score) }}>
                {Math.round(p.score)}
              </div>
              <div className="text-[10px] text-zinc-400">{p.band}</div>
            </div>
          </Link>
        ))}
      </section>

      {/* Top gaps */}
      {gaps.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Priority gaps</span>
            <Link href="/gaps" className="text-[12px] text-zinc-500 hover:text-zinc-700">All gaps →</Link>
          </div>
          {gaps.slice(0, 4).map((g) => (
            <div key={g.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-zinc-200">
              <SeverityPill severity={g.severity} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-zinc-900">{g.title}</div>
                <div className="text-[12px] text-zinc-500 mt-0.5 line-clamp-2">{g.detail}</div>
              </div>
              {g.requirement_code && (
                <span className="text-[11px] font-mono text-zinc-400 shrink-0">{g.requirement_code}</span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "ok" | "warn" | "bad" }) {
  const color = { neutral: "text-zinc-700", ok: "text-zinc-400", warn: "text-amber-600", bad: "text-red-600" }[tone];
  return (
    <div>
      <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-[22px] font-semibold tabular-nums leading-none ${color}`}>{value}</div>
    </div>
  );
}

function ConnError() {
  return (
    <div className="py-20 text-center">
      <p className="text-zinc-700 text-[14px] font-medium">Can&apos;t reach the backend</p>
      <p className="text-zinc-400 text-[13px] mt-1">
        Start it with <code className="bg-zinc-100 px-1 rounded">uvicorn app.main:app --port 8001</code> and seed the framework
        (<code className="bg-zinc-100 px-1 rounded">python -m app.db.seed --demo</code>).
      </p>
    </div>
  );
}
