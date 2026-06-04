"use client";

import { useEffect, useState } from "react";
import { CLIENT_BASE, type Pack } from "@/lib/api";
import { ReadinessRing, ScoreBar, SeverityPill, StatusPill, scoreColor } from "@/components/ui";

export default function PackPage() {
  const [pack, setPack] = useState<Pack | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${CLIENT_BASE}/pack`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load pack"))))
      .then(setPack)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="py-20 text-center text-zinc-500 text-[13px]">{err}</div>;
  if (!pack) return <div className="py-20 text-center text-zinc-400 text-[13px]">Assembling evidence pack…</div>;

  const generated = new Date(pack.generated_at).toLocaleString("en-GB");

  return (
    <div className="space-y-8">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Evidence pack</h1>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-2xl">
            A point-in-time record of the organisation&apos;s fraud prevention framework — the basis of a
            reasonable-procedures defence. Print or save as PDF for the board, regulator or court.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 shrink-0"
        >
          Print / Save PDF
        </button>
      </div>

      {/* The report */}
      <article className="space-y-8 print:text-black">
        {/* Cover */}
        <header className="border border-zinc-200 rounded-xl p-6 print:border-zinc-300">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-brand">Fraud prevention framework</div>
          <h2 className="text-[22px] font-semibold tracking-tight text-zinc-900 mt-1">
            {pack.organisation.name || "Reasonable procedures evidence pack"}
          </h2>
          <p className="text-[12px] text-zinc-500 mt-2 max-w-2xl">
            {pack.offence.name} — {pack.offence.act} (in force {pack.offence.in_force}). Defence:{" "}
            {pack.offence.defence}.
          </p>
          <div className="flex items-center gap-8 mt-5 flex-wrap">
            <ReadinessRing score={pack.overall_score} band={pack.overall_band} size={104} />
            <div className="space-y-1.5">
              <Meta k="Generated" v={generated} />
              {pack.generated_by && <Meta k="By" v={pack.generated_by} />}
              {pack.organisation.sector && <Meta k="Sector" v={pack.organisation.sector} />}
              {pack.organisation.assessment_owner && <Meta k="Owner" v={pack.organisation.assessment_owner} />}
            </div>
          </div>
        </header>

        {/* Scope */}
        <section className="border border-zinc-200 rounded-xl p-5">
          <SectionTitle>Scope — is the organisation in scope of the offence?</SectionTitle>
          <p className="text-[12px] text-zinc-500 mb-3">
            A &quot;large organisation&quot; meets at least two of the following thresholds.
          </p>
          <div className="space-y-1.5">
            {pack.scope.criteria.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-[13px]">
                <span className={c.met ? "text-emerald-600" : "text-zinc-300"}>{c.met ? "✓" : "○"}</span>
                <span className={c.met ? "text-zinc-800" : "text-zinc-400"}>{c.label}</span>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-[13px] font-medium ${pack.scope.in_scope ? "text-zinc-900" : "text-zinc-500"}`}>
            {pack.scope.in_scope
              ? "→ In scope of the failure-to-prevent-fraud offence."
              : "→ Below the large-organisation threshold on current inputs (set in Settings)."}
          </div>
        </section>

        {/* Pillars */}
        {pack.pillars.map((p) => (
          <section key={p.id} className="border border-zinc-200 rounded-xl p-5 break-inside-avoid">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-zinc-900">{p.name}</h3>
                <div className="text-[11px] text-zinc-400">{p.principle}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[18px] font-semibold tabular-nums" style={{ color: scoreColor(p.score) }}>
                  {Math.round(p.score)}
                </div>
                <div className="text-[10px] text-zinc-400">{p.band}</div>
              </div>
            </div>
            <div className="mt-2 mb-4"><ScoreBar score={p.score} /></div>

            <div className="space-y-3">
              {p.requirements.map((r) => (
                <div key={r.id} className="pl-3 border-l-2 border-zinc-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-zinc-400">{r.code}</span>
                    <span className="text-[13px] font-medium text-zinc-800">{r.title}</span>
                    <StatusPill status={r.status} />
                  </div>
                  {r.control_description && (
                    <p className="text-[12px] text-zinc-600 mt-1">{r.control_description}</p>
                  )}
                  {r.owner && <div className="text-[11px] text-zinc-400 mt-0.5">Owner: {r.owner}</div>}
                  {r.evidence.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {r.evidence.map((e, i) => (
                        <li key={i} className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                          <span className="text-zinc-300">▪</span>
                          <span className="font-medium text-zinc-600">{e.title}</span>
                          <span className="text-zinc-400">({e.kind}{e.dated ? `, ${e.dated}` : ""})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[11px] text-amber-600 mt-1">No evidence on record.</div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Open gaps */}
        <section className="border border-zinc-200 rounded-xl p-5 break-inside-avoid">
          <SectionTitle>Open gaps and remediation</SectionTitle>
          {pack.open_gaps.length === 0 ? (
            <p className="text-[13px] text-zinc-500">No open gaps recorded.</p>
          ) : (
            <div className="space-y-2.5">
              {pack.open_gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-3">
                  <SeverityPill severity={g.severity} />
                  <div>
                    <div className="text-[13px] font-medium text-zinc-800">
                      {g.title}
                      {g.requirement_code && <span className="text-[11px] font-mono text-zinc-400 ml-2">{g.requirement_code}</span>}
                    </div>
                    {g.recommendation && <div className="text-[12px] text-zinc-500 mt-0.5">{g.recommendation}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="text-[11px] text-zinc-400 pt-2">
          Generated by EIGG Prevent on {generated}. This pack reflects recorded framework state at the time
          of generation and does not itself constitute legal advice or a determination of compliance.
        </footer>
      </article>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-zinc-400 w-20 shrink-0">{k}</span>
      <span className="text-zinc-700">{v}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-3">{children}</h3>;
}
