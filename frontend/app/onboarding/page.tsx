"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { ReadinessRing } from "@/components/ui";
import {
  commitOnboarding,
  fetchOnboardingStatus,
  generateOnboarding,
  type Generated,
  type GeneratedItem,
  type OnboardingProfile,
  type Status,
} from "@/lib/api";

type Step = "profile" | "generating" | "review" | "committing";

const QUESTIONS = [
  {
    key: "org_type" as const,
    label: "What kind of organisation are you?",
    options: [
      ["fintech", "Fintech"],
      ["emi", "E-money institution"],
      ["payments", "Payment firm"],
      ["charity", "Charity"],
      ["other", "Other"],
    ],
  },
  {
    key: "employee_band" as const,
    label: "How many employees?",
    hint: "Helps determine if the offence applies to you.",
    options: [
      ["under_50", "Under 50"],
      ["50_250", "50–250"],
      ["over_250", "250+"],
    ],
  },
  {
    key: "turnover_band" as const,
    label: "Annual turnover or income?",
    hint: "Helps determine ECCTA scope.",
    options: [
      ["under_10m", "Under £10m"],
      ["10_36m", "£10–36m"],
      ["over_36m", "£36m+"],
    ],
  },
  {
    key: "existing_policy" as const,
    label: "Do you have an anti-fraud policy?",
    options: [
      ["yes", "Yes"],
      ["draft", "In draft"],
      ["no", "No"],
    ],
  },
  {
    key: "culture_level" as const,
    label: "How would you describe your fraud awareness culture?",
    options: [
      ["ad_hoc", "Ad hoc"],
      ["developing", "Developing"],
      ["established", "Established"],
    ],
  },
];

const STATUS_SCORE: Record<Status, number> = { not_started: 0, in_progress: 40, implemented: 75, embedded: 100 };
const PILLAR_WEIGHT: Record<string, number> = { risk_assessment: 1.2, controls: 1.2, board_governance: 1, due_diligence: 1, training: 1 };
const STATUSES: Status[] = ["not_started", "in_progress", "implemented", "embedded"];

function band(score: number): string {
  if (score >= 86) return "Robust";
  if (score >= 71) return "Established";
  if (score >= 51) return "Progressing";
  if (score >= 31) return "Developing";
  return "Not started";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [answers, setAnswers] = useState<Partial<OnboardingProfile>>({});
  const [name, setName] = useState("");
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [err, setErr] = useState("");

  // If this workspace is already set up, don't show the wizard.
  useEffect(() => {
    fetchOnboardingStatus().then((s) => { if (!s.needs_onboarding) router.replace("/"); }).catch(() => {});
  }, [router]);

  const complete = QUESTIONS.every((q) => answers[q.key]);

  async function generate() {
    setErr(""); setStep("generating");
    try {
      const profile = { ...(answers as OnboardingProfile), name: name || undefined };
      const g = await generateOnboarding(profile);
      setGenerated(g);
      setItems(g.items);
      setStep("review");
    } catch (e) {
      setErr((e as Error).message || "Generation failed");
      setStep("profile");
    }
  }

  async function commit() {
    setStep("committing");
    try {
      const profile = { ...(answers as OnboardingProfile), name: name || undefined };
      await commitOnboarding(profile, items.map((i) => ({ code: i.code, status: i.status, narrative: i.narrative, owner: i.owner })));
      router.replace("/?onboarded=1");
    } catch (e) {
      setErr((e as Error).message || "Could not save framework");
      setStep("review");
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="h-16 px-8 flex items-center gap-2.5 border-b border-zinc-100 shrink-0">
        <Logo size={26} className="text-ink" />
        <span className="text-[14px] font-semibold tracking-tight text-zinc-900">EIGG Prevent</span>
        <span className="text-[12px] text-zinc-400 ml-2">· Set up your framework</span>
      </header>

      <main className="flex-1 overflow-y-auto">
        {step === "profile" && (
          <ProfileStep
            answers={answers} setAnswers={setAnswers} name={name} setName={setName}
            complete={complete} err={err} onGenerate={generate}
          />
        )}
        {step === "generating" && <Generating />}
        {(step === "review" || step === "committing") && generated && (
          <ReviewStep
            generated={generated} items={items} setItems={setItems}
            committing={step === "committing"} err={err} onCommit={commit} onBack={() => setStep("profile")}
          />
        )}
      </main>
    </div>
  );
}

// ── Step 1: profile ─────────────────────────────────────────────────────────

function ProfileStep({ answers, setAnswers, name, setName, complete, err, onGenerate }: {
  answers: Partial<OnboardingProfile>;
  setAnswers: (a: Partial<OnboardingProfile>) => void;
  name: string; setName: (s: string) => void;
  complete: boolean; err: string; onGenerate: () => void;
}) {
  return (
    <div className="max-w-xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">Tell us about your organisation</h1>
        <p className="text-[13px] text-zinc-500 mt-1.5">
          Five quick questions. We&apos;ll generate a realistic first-pass of your fraud prevention framework —
          you can adjust everything before saving.
        </p>
      </div>

      <div>
        <div className="text-[13px] font-medium text-zinc-700 mb-2">Organisation name <span className="text-zinc-400 font-normal">(optional)</span></div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Payments Ltd"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-[14px] focus:border-zinc-400 focus:outline-none" />
      </div>

      {QUESTIONS.map((q) => (
        <div key={q.key}>
          <div className="text-[13px] font-medium text-zinc-700">{q.label}</div>
          {q.hint && <div className="text-[12px] text-zinc-400 mt-0.5">{q.hint}</div>}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {q.options.map(([value, label]) => {
              const selected = answers[q.key] === value;
              return (
                <button
                  key={value}
                  onClick={() => setAnswers({ ...answers, [q.key]: value })}
                  className={`px-3.5 py-2 rounded-lg text-[13px] border transition-colors ${
                    selected ? "border-ink bg-zinc-900 text-white" : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {err && <p className="text-[13px] text-red-600">{err}</p>}

      <div className="pt-2">
        <button onClick={onGenerate} disabled={!complete}
          className="px-5 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-40">
          Generate my framework →
        </button>
        {!complete && <p className="text-[12px] text-zinc-400 mt-2">Answer all five questions to continue.</p>}
      </div>
    </div>
  );
}

// ── Step 2: generating ────────────────────────────────────────────────────────

function Generating() {
  const messages = [
    "Reviewing your organisation profile…",
    "Mapping the six principles of reasonable procedures…",
    "Proposing a conservative starting maturity for 25 requirements…",
    "Drafting control narratives and owners…",
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, messages.length - 1)), 1800);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <div className="max-w-md mx-auto px-8 py-24 text-center">
      <div className="inline-block w-8 h-8 border-2 border-zinc-200 border-t-zinc-800 rounded-full animate-spin" />
      <p className="text-[14px] font-medium text-zinc-800 mt-5">Building your framework</p>
      <p className="text-[13px] text-zinc-500 mt-1">{messages[i]}</p>
    </div>
  );
}

// ── Step 3: review ─────────────────────────────────────────────────────────────

function ReviewStep({ generated, items, setItems, committing, err, onCommit, onBack }: {
  generated: Generated;
  items: GeneratedItem[];
  setItems: (i: GeneratedItem[]) => void;
  committing: boolean; err: string; onCommit: () => void; onBack: () => void;
}) {
  const projected = useMemo(() => {
    const byPillar: Record<string, number[]> = {};
    items.forEach((it) => { (byPillar[it.pillar_id] ||= []).push(STATUS_SCORE[it.status]); });
    let wsum = 0, w = 0;
    Object.entries(byPillar).forEach(([pid, scores]) => {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const weight = PILLAR_WEIGHT[pid] ?? 1;
      wsum += mean * weight; w += weight;
    });
    return w ? Math.round((wsum / w) * 10) / 10 : 0;
  }, [items]);

  const pillars = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, GeneratedItem[]> = {};
    items.forEach((it) => { if (!map[it.pillar_id]) order.push(it.pillar_id); (map[it.pillar_id] ||= []).push(it); });
    return order.map((pid) => ({ id: pid, name: map[pid][0].pillar_name, items: map[pid] }));
  }, [items]);

  function setStatus(code: string, status: Status) {
    setItems(items.map((it) => (it.code === code ? { ...it, status } : it)));
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">Your first-pass framework</h1>
        <p className="text-[13px] text-zinc-500 mt-1.5">
          AI-proposed and deliberately conservative — start here and earn improvement. Adjust any maturity level,
          then save.
        </p>
      </div>

      {/* Scope + projected score */}
      <div className="flex items-center gap-8 flex-wrap p-5 rounded-xl border border-zinc-200">
        <ReadinessRing score={projected} band={band(projected)} size={104} />
        <div className="flex-1 min-w-[260px]">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1">Projected readiness</div>
          <div className="text-[14px] font-medium text-zinc-800">{band(projected)} · {projected}/100</div>
          <div className={`mt-3 text-[12px] px-3 py-2 rounded-lg ${generated.scope.in_scope ? "bg-amber-50 text-amber-800" : "bg-zinc-50 text-zinc-600"}`}>
            <span className="font-medium">{generated.scope.in_scope ? "In scope" : "Likely out of scope"}.</span> {generated.scope.note}
          </div>
        </div>
      </div>

      {/* Requirements grouped by pillar */}
      <div className="space-y-6">
        {pillars.map((p) => (
          <div key={p.id}>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 px-1">{p.name}</div>
            <div className="space-y-1.5">
              {p.items.map((it) => (
                <div key={it.code} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-zinc-200">
                  <span className="text-[11px] font-mono text-zinc-400 w-12 shrink-0">{it.code}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-zinc-800 truncate">{it.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate">Owner: {it.owner}</div>
                  </div>
                  <select
                    value={it.status}
                    onChange={(e) => setStatus(it.code, e.target.value as Status)}
                    className="rounded-md border border-zinc-200 px-2 py-1.5 text-[12px] bg-white focus:border-zinc-400 focus:outline-none shrink-0"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {err && <p className="text-[13px] text-red-600">{err}</p>}

      <div className="flex items-center gap-3 pt-2 sticky bottom-0 bg-white py-4 border-t border-zinc-100">
        <button onClick={onBack} disabled={committing} className="text-[13px] text-zinc-500 hover:text-zinc-800 disabled:opacity-40">← Back</button>
        <div className="flex-1" />
        <button onClick={onCommit} disabled={committing}
          className="px-5 py-2.5 rounded-lg bg-ink text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50">
          {committing ? "Creating framework…" : "Looks good — start my framework"}
        </button>
      </div>
    </div>
  );
}
