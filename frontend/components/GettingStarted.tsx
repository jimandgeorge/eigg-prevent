"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "eigg_gs_active";

export interface GsAction {
  label: string;
  href: string;
  severity: string;
}

// First-run "Getting started" banner. Activated when the user lands from the
// onboarding wizard (?onboarded=1); persists across navigation until dismissed.
export default function GettingStarted({ justOnboarded, actions }: { justOnboarded: boolean; actions: GsAction[] }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (justOnboarded) localStorage.setItem(KEY, "1");
    setShow(localStorage.getItem(KEY) === "1");
  }, [justOnboarded]);

  if (!show) return null;

  function dismiss() {
    localStorage.removeItem(KEY);
    setShow(false);
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
            </span>
            <h2 className="text-[14px] font-semibold text-zinc-900">Your framework is live</h2>
          </div>
          <p className="text-[13px] text-zinc-600 mt-1.5 max-w-xl">
            We&apos;ve generated a conservative first pass. Strengthen these priority areas first — then generate
            your evidence pack when you&apos;re ready.
          </p>
        </div>
        <button onClick={dismiss} className="text-zinc-400 hover:text-zinc-700 text-[16px] leading-none shrink-0" aria-label="Dismiss">×</button>
      </div>

      {actions.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700/70">Top priority actions</div>
          {actions.map((a, i) => (
            <Link key={i} href={a.href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-emerald-100 hover:border-emerald-200 transition-colors">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1 text-[13px] text-zinc-800 truncate">{a.label}</span>
              <span className="text-[12px] text-emerald-700 shrink-0">Open →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
