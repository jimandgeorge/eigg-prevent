"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CLIENT_BASE, addMember, deleteMember, fetchMembers, setActor, type Member } from "@/lib/api";

const BACKEND_BASE = CLIENT_BASE;
const ACTOR_KEY = "eigg_actor";

const CATEGORIES = [
  { id: "system", label: "System" },
  { id: "model", label: "Model" },
  { id: "organisation", label: "Organisation" },
  { id: "members", label: "Members" },
  { id: "account", label: "Account" },
  { id: "compliance", label: "Compliance" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

// ── Shared primitives ─────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-[13px] text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 focus:border-zinc-300 transition-colors";

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-zinc-100 last:border-0">
      <span className="text-[13px] text-zinc-500 shrink-0">{label}</span>
      <span className={`text-[13px] text-zinc-800 text-right ${mono ? "font-mono" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">{children}</p>;
}

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-[12px] text-emerald-600 ml-3">Saved ✓</span>;
}

// ── System ────────────────────────────────────────────────────────────────────

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  ollama: "Ollama (self-hosted)",
  azure: "Azure OpenAI",
  bedrock: "AWS Bedrock",
  mock: "Mock (dev)",
};

function SystemPanel() {
  const [info, setInfo] = useState<Record<string, string> | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_BASE}/system`).then((r) => r.json()).then(setInfo).catch(() => setErr(true));
  }, []);

  if (err) return <p className="text-[13px] text-red-500">Could not reach backend.</p>;
  if (!info)
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-zinc-50 rounded border border-zinc-100" />)}
      </div>
    );

  return (
    <div>
      <Row label="Version" value={`v${info.version}`} />
      <Row label="Environment" value={info.environment} />
      <Row label="LLM provider" value={PROVIDER_LABEL[info.llm_provider] ?? info.llm_provider} />
      <Row label="LLM model" value={info.llm_model} mono />
      <Row label="Backend URL" value={BACKEND_BASE} mono />
    </div>
  );
}

// ── Model (LLM provider switcher) ───────────────────────────────────────────────

interface LlmProvider {
  id: string;
  label: string;
  model: string;
  available: boolean;
}

function ModelPanel() {
  const [providers, setProviders] = useState<LlmProvider[] | null>(null);
  const [active, setActive] = useState("");
  const [defaultProvider, setDefaultProvider] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/llm`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setProviders(d.providers);
      setActive(d.active);
      setDefaultProvider(d.default);
    } catch {
      setErr("Could not load model settings.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function select(id: string) {
    if (id === active) return;
    setSaving(id);
    setErr(null);
    try {
      const r = await fetch(`${BACKEND_BASE}/settings/llm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to switch provider");
      }
      setActive(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to switch.");
    } finally {
      setSaving(null);
    }
  }

  if (!providers)
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-zinc-50 rounded-lg border border-zinc-100" />)}
      </div>
    );

  return (
    <div>
      <Label>AI model</Label>
      <p className="text-[12px] text-zinc-500 -mt-1.5 mb-3">
        The AI drafts records and flags gaps — it never attests compliance. Switches live, no redeploy.
        Runs on your infrastructure.
      </p>
      {err && <p className="text-[12px] text-red-500 mb-3">{err}</p>}

      <div className="space-y-2">
        {providers.map((p) => {
          const isActive = p.id === active;
          const disabled = !p.available;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled || saving !== null}
              onClick={() => select(p.id)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                isActive
                  ? "border-zinc-900 bg-zinc-50"
                  : disabled
                    ? "border-zinc-100 bg-zinc-50/50 cursor-not-allowed opacity-60"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isActive ? "border-zinc-900" : "border-zinc-300"}`}>
                {isActive && <span className="w-2 h-2 rounded-full bg-zinc-900" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-zinc-800">
                  {p.label}
                  {p.id === defaultProvider && <span className="ml-2 text-[10px] font-normal text-zinc-400">env default</span>}
                </div>
                <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">{p.model}</div>
              </div>
              <span className="shrink-0 text-[11px]">
                {saving === p.id ? (
                  <span className="text-zinc-400">switching…</span>
                ) : isActive ? (
                  <span className="text-emerald-600 font-medium">active</span>
                ) : disabled ? (
                  <span className="text-zinc-400">not configured</span>
                ) : (
                  <span className="text-zinc-400">select</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-400 mt-3">
        Applies to gap analysis and control drafting. Unconfigured providers need their credentials set on
        the server (Ollama host, Anthropic / Azure / AWS keys).
      </p>
    </div>
  );
}

// ── Organisation ────────────────────────────────────────────────────────────────

interface OrgProfile {
  name: string | null;
  sector: string | null;
  turnover_over_36m: boolean;
  balance_sheet_over_18m: boolean;
  employees_over_250: boolean;
  assessment_owner: string | null;
}

function OrganisationPanel() {
  const [p, setP] = useState<Partial<OrgProfile>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_BASE}/settings/profile`).then((r) => r.json()).then(setP).catch(() => {});
  }, []);

  const met = [p.turnover_over_36m, p.balance_sheet_over_18m, p.employees_over_250].filter(Boolean).length;
  const inScope = met >= 2;

  async function save() {
    setSaving(true);
    const actor = localStorage.getItem(ACTOR_KEY) || "";
    await fetch(`${BACKEND_BASE}/settings/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(actor ? { "x-actor": actor } : {}) },
      body: JSON.stringify(p),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-zinc-500 -mt-1">
        Identifies the organisation on the evidence pack and assesses whether it is in scope of the offence.
      </p>

      <div className="space-y-3">
        <input className={inputCls} placeholder="Organisation name" value={p.name ?? ""} onChange={(e) => setP({ ...p, name: e.target.value })} />
        <input className={inputCls} placeholder="Sector (e.g. e-money institution)" value={p.sector ?? ""} onChange={(e) => setP({ ...p, sector: e.target.value })} />
        <input className={inputCls} placeholder="Framework owner (e.g. MLRO)" value={p.assessment_owner ?? ""} onChange={(e) => setP({ ...p, assessment_owner: e.target.value })} />
      </div>

      <div>
        <Label>Large-organisation thresholds</Label>
        <p className="text-[12px] text-zinc-500 -mt-1.5 mb-3">In scope if at least two are met.</p>
        <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
          {(
            [
              ["turnover_over_36m", "Turnover over £36m"],
              ["balance_sheet_over_18m", "Balance sheet over £18m"],
              ["employees_over_250", "More than 250 employees"],
            ] as const
          ).map(([key, label]) => {
            const checked = !!p[key];
            return (
              <label key={key} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-zinc-50 transition-colors">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-zinc-900 border-zinc-900" : "border-zinc-300"}`}>
                  {checked && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5l2.5 2.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => setP({ ...p, [key]: e.target.checked })} />
                <span className="text-[13px] text-zinc-700">{label}</span>
              </label>
            );
          })}
        </div>
        <div className={`mt-3 text-[13px] font-medium ${inScope ? "text-zinc-900" : "text-zinc-500"}`}>
          {inScope ? "→ In scope of the failure-to-prevent-fraud offence." : "→ Below the large-organisation threshold on current inputs."}
        </div>
      </div>

      <div className="flex items-center">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 text-white text-[13px] font-medium rounded-md transition-colors">
          {saving ? "Saving…" : "Save"}
        </button>
        <Saved show={saved} />
      </div>
    </div>
  );
}

// ── Members ───────────────────────────────────────────────────────────────────

function MembersPanel() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addMember({ name: name.trim(), role: role.trim() || undefined, email: email.trim() || undefined });
      setName(""); setRole(""); setEmail("");
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-zinc-500 -mt-1">
        Members can be assigned as control owners and appear on the evidence pack. Owners are chosen from
        this list — not free text — so identity is consistent and reminders can be targeted.
      </p>

      <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
        {members === null ? (
          <div className="px-4 py-3 text-[13px] text-zinc-400">Loading…</div>
        ) : members.length === 0 ? (
          <div className="px-4 py-3 text-[13px] text-zinc-400">No members yet — add your first below.</div>
        ) : (
          members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-600 text-[12px] font-semibold flex items-center justify-center shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-zinc-800 truncate">{m.name}</div>
                <div className="text-[11px] text-zinc-400 truncate">{[m.role, m.email].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <button onClick={async () => { await deleteMember(m.id); load(); }} className="text-[11px] text-zinc-400 hover:text-red-500 shrink-0">Remove</button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <Label>Add member</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={inputCls} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Role (e.g. MLRO)" value={role} onChange={(e) => setRole(e.target.value)} />
          <input className={inputCls} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button onClick={add} disabled={busy || !name.trim()} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 text-white text-[13px] font-medium rounded-md transition-colors">
          {busy ? "Adding…" : "Add member"}
        </button>
      </div>
    </div>
  );
}

// ── Account ───────────────────────────────────────────────────────────────────

function AccountPanel() {
  const { data: session, status } = useSession();
  const [actor, setActor] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setActor(localStorage.getItem(ACTOR_KEY) ?? "");
  }, []);

  const signedIn = status === "authenticated" && !!session?.user;
  const sessionName = session?.user?.name || session?.user?.email || "";

  function save() {
    setActor(actor);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>Signed in as</Label>
        {signedIn ? (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-zinc-300 text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
              {sessionName.charAt(0).toUpperCase()}
            </span>
            <div>
              <div className="text-[13px] font-medium text-zinc-800">{sessionName}</div>
              <div className="text-[11px] text-zinc-400">{session?.user?.email ? "Verified via SSO" : "Shared-password session"}</div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-zinc-400">Not signed in — authentication is disabled on this deployment.</p>
        )}
      </div>

      <div>
        <Label>Audit identity</Label>
        <p className="text-[12px] text-zinc-500 -mt-1.5 mb-3">
          {signedIn
            ? "Changes you make are attributed to your sign-in name in the audit trail. You can override it here for this browser."
            : "Set the name recorded against changes you make. With SSO this is set automatically from your login."}
        </p>
        <div className="flex items-center gap-2">
          <input className={inputCls} placeholder="e.g. Priya Shah, MLRO" value={actor} onChange={(e) => setActor(e.target.value)} />
          <button onClick={save} className="px-4 py-2 bg-zinc-900 hover:bg-zinc-700 text-white text-[13px] font-medium rounded-md transition-colors shrink-0">
            Save
          </button>
        </div>
        <Saved show={saved} />
      </div>
    </div>
  );
}

// ── Compliance ──────────────────────────────────────────────────────────────────

function CompliancePanel() {
  return (
    <div>
      <Row label="Offence" value="Failure to prevent fraud" />
      <Row label="Legislation" value="ECCTA 2023" />
      <Row label="In force" value="1 September 2025" />
      <Row label="Defence" value="Reasonable fraud prevention procedures" />
      <Row label="Framework basis" value="Home Office six principles" />
      <Row label="Audit retention" value="Permanent — append-only" />
      <Row label="Data residency" value="On-premises — no egress" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PANELS: Record<Category, React.ReactNode> = {
  system: <SystemPanel />,
  model: <ModelPanel />,
  organisation: <OrganisationPanel />,
  members: <MembersPanel />,
  account: <AccountPanel />,
  compliance: <CompliancePanel />,
};

export default function SettingsPage() {
  const [active, setActive] = useState<Category>("system");

  return (
    <div className="flex gap-8 max-w-3xl">
      {/* Left nav */}
      <nav className="w-36 shrink-0 space-y-0.5 pt-1">
        {CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`w-full text-left px-2.5 py-1.5 rounded text-[13px] transition-colors ${
              active === id ? "bg-zinc-200/70 text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right content */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[18px] font-semibold text-zinc-900 tracking-tight mb-6">
          {CATEGORIES.find((c) => c.id === active)?.label}
        </h1>
        {PANELS[active]}
      </div>
    </div>
  );
}
