"use client";

import { useEffect, useState } from "react";
import { CLIENT_BASE, setLlmProvider, type LlmSettings, type OrgProfile } from "@/lib/api";

export default function SettingsPage() {
  const [llm, setLlm] = useState<LlmSettings | null>(null);
  const [profile, setProfile] = useState<Partial<OrgProfile>>({});
  const [actor, setActor] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    fetch(`${CLIENT_BASE}/settings/llm`, { cache: "no-store" }).then((r) => r.json()).then(setLlm).catch(() => {});
    fetch(`${CLIENT_BASE}/settings/profile`, { cache: "no-store" }).then((r) => r.json()).then(setProfile).catch(() => {});
    setActor(localStorage.getItem("eigg_actor") || "");
  }, []);

  function flash(m: string) {
    setSaved(m);
    setTimeout(() => setSaved(""), 2500);
  }

  async function chooseProvider(id: string) {
    await setLlmProvider(id);
    setLlm((prev) => (prev ? { ...prev, active: id } : prev));
    flash("LLM provider updated");
  }

  function saveActor() {
    localStorage.setItem("eigg_actor", actor);
    flash("Identity saved — changes will be attributed to this name");
  }

  async function saveProfile() {
    await fetch(`${CLIENT_BASE}/settings/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(actor ? { "x-actor": actor } : {}) },
      body: JSON.stringify(profile),
    });
    flash("Organisation profile saved");
  }

  return (
    <div className="space-y-10 max-w-2xl">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900">Settings</h1>
        {saved && <p className="text-[12px] text-emerald-600 mt-1">{saved}</p>}
      </div>

      {/* Identity */}
      <Section title="Your identity" desc="Changes you make are attributed to this name in the audit trail.">
        <div className="flex gap-2">
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="e.g. Priya Shah, MLRO"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none"
          />
          <button onClick={saveActor} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90">
            Save
          </button>
        </div>
      </Section>

      {/* Org profile */}
      <Section title="Organisation profile" desc="Used to assess whether you're in scope of the offence and to head the evidence pack.">
        <div className="space-y-3">
          <input
            value={profile.name ?? ""}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            placeholder="Organisation name"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none"
          />
          <input
            value={profile.sector ?? ""}
            onChange={(e) => setProfile({ ...profile, sector: e.target.value })}
            placeholder="Sector (e.g. e-money institution)"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none"
          />
          <input
            value={profile.assessment_owner ?? ""}
            onChange={(e) => setProfile({ ...profile, assessment_owner: e.target.value })}
            placeholder="Framework owner (e.g. MLRO)"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] focus:border-zinc-400 focus:outline-none"
          />
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest">Large-organisation thresholds</div>
            {([
              ["turnover_over_36m", "Turnover over £36m"],
              ["balance_sheet_over_18m", "Balance sheet over £18m"],
              ["employees_over_250", "More than 250 employees"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[13px] text-zinc-700">
                <input
                  type="checkbox"
                  checked={!!profile[key]}
                  onChange={(e) => setProfile({ ...profile, [key]: e.target.checked })}
                  className="accent-ink"
                />
                {label}
              </label>
            ))}
          </div>
          <button onClick={saveProfile} className="px-4 py-2 rounded-lg bg-ink text-white text-[12px] font-medium hover:opacity-90">
            Save profile
          </button>
        </div>
      </Section>

      {/* LLM */}
      <Section title="AI model" desc="The AI drafts records and flags gaps — it never attests compliance. Runs on your infrastructure.">
        {!llm ? (
          <div className="text-[13px] text-zinc-400">Loading…</div>
        ) : (
          <div className="space-y-2">
            {llm.providers.map((p) => {
              const active = llm.active === p.id;
              return (
                <button
                  key={p.id}
                  disabled={!p.available && !active}
                  onClick={() => chooseProvider(p.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                    active ? "border-ink bg-zinc-50" : p.available ? "border-zinc-200 hover:border-zinc-300" : "border-zinc-100 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div>
                    <div className="text-[13px] font-medium text-zinc-900">{p.label}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">{p.model}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.available && <span className="text-[10px] text-zinc-400">not configured</span>}
                    {active && <span className="text-[11px] font-medium text-emerald-600">Active</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[14px] font-semibold text-zinc-900">{title}</h2>
      <p className="text-[12px] text-zinc-500 mt-0.5 mb-3 max-w-xl">{desc}</p>
      {children}
    </section>
  );
}
