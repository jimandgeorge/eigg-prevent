// EIGG Prevent API client. Backend routes are namespaced under /api (see backend main.py).
const API_PREFIX = "/api";

// Server-side (Docker) uses API_URL; the browser uses NEXT_PUBLIC_API_URL.
const BASE =
  (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001") + API_PREFIX;

export const CLIENT_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001") + API_PREFIX;

// ── Types ───────────────────────────────────────────────────────────────────

export type Status = "not_started" | "in_progress" | "implemented" | "embedded";

export interface RequirementSummary {
  id: string;
  code: string;
  title: string;
  description: string;
  guidance: string | null;
  status: Status;
  status_label: string;
  score: number;
  owner: string | null;
  control_description: string | null;
  last_reviewed: string | null;
  next_review_due: string | null;
  updated_at: string | null;
  updated_by: string | null;
  evidence_count: number;
  open_gaps: number;
}

export interface Pillar {
  id: string;
  name: string;
  principle: string;
  description: string;
  weight: number;
  score: number;
  band: string;
  requirement_count: number;
  status_breakdown: Record<Status, number>;
  open_gaps: number;
  requirements: RequirementSummary[];
}

export interface Framework {
  overall_score: number;
  overall_band: string;
  pillars: Pillar[];
}

export interface Evidence {
  id: string;
  title: string;
  kind: string;
  reference: string | null;
  description: string | null;
  dated: string | null;
  added_by: string | null;
  created_at: string;
}

export interface Gap {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  recommendation: string | null;
  status: string;
  source: "ai" | "manual";
  pillar_id: string | null;
  pillar_name: string | null;
  requirement_id: string | null;
  requirement_code: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  created_at: string;
}

export interface RequirementDetail extends RequirementSummary {
  pillar_id: string;
  pillar_name: string;
  principle: string;
  evidence: Evidence[];
  gaps: Gap[];
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  actor: string | null;
  summary: string;
  detail: Record<string, unknown>;
  created_at: string;
}

// ── Reads (server components) ─────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchFramework = () => get<Framework>("/framework");
export const fetchPillar = (id: string) => get<Pillar>(`/framework/pillars/${id}`);
export const fetchRequirement = (id: string) => get<RequirementDetail>(`/framework/requirements/${id}`);
export const fetchGaps = (status = "open") =>
  get<{ gaps: Gap[] }>(`/gaps?status=${status}`).then((d) => d.gaps);
export const fetchAudit = () => get<{ entries: AuditEntry[] }>("/audit").then((d) => d.entries);

export interface SystemInfo {
  version: string;
  environment: string;
  llm_provider: string;
  llm_model: string;
}
export const fetchSystem = () => get<SystemInfo>("/system");

export interface LlmSettings {
  active: string;
  default: string;
  providers: { id: string; label: string; model: string; available: boolean }[];
}
export const fetchLlmSettings = () => get<LlmSettings>("/settings/llm");

export interface OrgProfile {
  name: string | null;
  sector: string | null;
  turnover_over_36m: boolean;
  balance_sheet_over_18m: boolean;
  employees_over_250: boolean;
  assessment_owner: string | null;
  notes: string | null;
}
export const fetchProfile = () => get<Partial<OrgProfile>>("/settings/profile");

export interface Pack {
  generated_at: string;
  generated_by: string | null;
  organisation: { name: string | null; sector: string | null; assessment_owner: string | null; notes: string | null };
  scope: { criteria: { label: string; met: boolean }[]; met_count: number; in_scope: boolean };
  overall_score: number;
  overall_band: string;
  pillars: (Omit<Pillar, "requirements"> & { requirements: (RequirementSummary & { evidence: Evidence[] })[] })[];
  open_gaps: { severity: string; title: string; detail: string; recommendation: string | null; pillar_id: string | null; requirement_code: string | null }[];
  offence: { name: string; act: string; in_force: string; defence: string };
}
export const fetchPack = () => get<Pack>("/pack");

// ── Writes (client) ───────────────────────────────────────────────────────────

function actorHeaders(): Record<string, string> {
  const actor = typeof window !== "undefined" ? localStorage.getItem("eigg_actor") || "" : "";
  return actor ? { "x-actor": actor } : {};
}

async function mutate(path: string, method: string, body?: unknown) {
  const res = await fetch(`${CLIENT_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...actorHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.text()) || `${method} ${path} failed`);
  return res.json();
}

export const updateControl = (
  requirementId: string,
  patch: Partial<Pick<RequirementSummary, "status" | "owner"> & { description: string; last_reviewed: string; next_review_due: string }>
) => mutate(`/controls/${requirementId}`, "PUT", patch);

export const draftControl = (requirementId: string, provider?: string) =>
  mutate(`/controls/${requirementId}/draft${provider ? `?provider=${provider}` : ""}`, "POST");

export const addEvidence = (
  requirementId: string,
  body: { title: string; kind: string; reference?: string; description?: string; dated?: string }
) => mutate(`/evidence/${requirementId}`, "POST", body);

export const deleteEvidence = (evidenceId: string) =>
  mutate(`/evidence/${evidenceId}`, "DELETE");

export const runGapAnalysis = () => mutate(`/gaps/analyze`, "POST");
export const updateGapStatus = (gapId: string, status: string) =>
  mutate(`/gaps/${gapId}`, "PUT", { status });

export const setLlmProvider = (provider: string) =>
  mutate(`/settings/llm`, "PUT", { provider });
