"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CLIENT_BASE, runGapAnalysis, updateGapStatus, type Gap } from "@/lib/api";
import { SeverityPill } from "@/components/ui";

type Tab = "open" | "addressed" | "dismissed";

export default function GapsPage() {
  const [tab, setTab] = useState<Tab>("open");
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      const res = await fetch(`${CLIENT_BASE}/gaps?status=${t}`, { cache: "no-store" });
      const data = await res.json();
      setGaps(data.gaps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function analyze() {
    setRunning(true);
    setNote("");
    try {
      const r = await runGapAnalysis();
      setNote(`AI found ${r.count} gap${r.count === 1 ? "" : "s"} using ${r.model}.`);
      setTab("open");
      await load("open");
    } catch (e) {
      setNote(`Analysis failed: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await updateGapStatus(id, status);
    setGaps((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Gaps</h1>
          <p className="text-[13px] text-zinc-500 mt-1 max-w-2xl">
            Where the framework falls short of <span className="font-medium text-zinc-700">reasonable procedures</span>.
            Run the AI analysis to surface gaps; you decide how to triage them.
          </p>
        </div>
        <button
          onClick={analyze}
          disabled={running}
          className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
        >
          {running ? "Analysing…" : "✦ Run AI gap analysis"}
        </button>
      </div>

      {note && <div className="text-[12px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">{note}</div>}

      <div className="flex gap-1 border-b border-zinc-200">
        {(["open", "addressed", "dismissed"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[13px] capitalize border-b-2 -mb-px transition-colors ${
              tab === t ? "border-ink text-zinc-900 font-medium" : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-zinc-400 text-[13px]">Loading…</div>
      ) : gaps.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-zinc-700 text-[14px] font-medium">No {tab} gaps</p>
          {tab === "open" && (
            <p className="text-zinc-400 text-[13px] mt-1">Run the AI analysis to identify weaknesses in the framework.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {gaps.map((g) => (
            <div key={g.id} className="px-4 py-3.5 rounded-lg border border-zinc-200">
              <div className="flex items-start gap-3">
                <SeverityPill severity={g.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {g.requirement_code && <span className="text-[11px] font-mono text-zinc-400">{g.requirement_code}</span>}
                    {g.requirement_id ? (
                      <Link href={`/requirements/${g.requirement_id}`} className="text-[13px] font-medium text-zinc-900 hover:text-brand hover:underline">
                        {g.title}
                      </Link>
                    ) : (
                      <span className="text-[13px] font-medium text-zinc-900">{g.title}</span>
                    )}
                    {g.pillar_name && <span className="text-[11px] text-zinc-400">· {g.pillar_name}</span>}
                    {g.source === "ai" && (
                      <span className="text-[9px] font-semibold tracking-wide text-brand bg-emerald-50 rounded px-1.5 py-0.5">AI</span>
                    )}
                  </div>
                  <p className="text-[12px] text-zinc-600 mt-1">{g.detail}</p>
                  {g.recommendation && (
                    <p className="text-[12px] text-zinc-500 mt-1.5">
                      <span className="font-medium">Recommendation:</span> {g.recommendation}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2.5">
                    {g.requirement_id && (
                      <Link href={`/requirements/${g.requirement_id}`} className="text-[11px] text-brand hover:underline">
                        Open requirement →
                      </Link>
                    )}
                    {tab === "open" && (
                      <>
                        <button onClick={() => setStatus(g.id, "addressed")} className="text-[11px] text-zinc-500 hover:text-emerald-600">
                          Mark addressed
                        </button>
                        <button onClick={() => setStatus(g.id, "dismissed")} className="text-[11px] text-zinc-400 hover:text-zinc-600">
                          Dismiss
                        </button>
                      </>
                    )}
                    {tab !== "open" && (
                      <button onClick={() => setStatus(g.id, "open")} className="text-[11px] text-zinc-400 hover:text-zinc-600">
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
