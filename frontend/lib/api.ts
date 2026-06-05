// EIGG Prevent API client. Backend routes are namespaced under /api (see backend main.py).
const API_PREFIX = "/api/v1";

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
  overdue: boolean;
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
  next_review_due: string | null;
  overdue_count: number;
  requirements: RequirementSummary[];
}

export interface Framework {
  overall_score: number;
  overall_band: string;
  next_review_due: string | null;
  overdue_count: number;
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
  is_file?: boolean;
  original_filename?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
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
  template: string | null;
  evidence: Evidence[];
  gaps: Gap[];
  related: { id: string; code: string; title: string; pillar_id: string; pillar_name: string; status: Status; reason: string }[];
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

// ── Actor (audit identity) ────────────────────────────────────────────────────
// Every action is attributed to a named actor. Set from the auth session at app
// load (IdentitySync → setActor), kept in memory so it's available synchronously,
// and mirrored to localStorage so it survives reloads.
const ACTOR_KEY = "eigg_actor";
let _actor: string | null = null;

export function setActor(name: string) {
  _actor = name;
  if (typeof window !== "undefined") localStorage.setItem(ACTOR_KEY, name);
}

function currentActor(): string | null {
  if (_actor) return _actor;
  if (typeof window !== "undefined") return localStorage.getItem(ACTOR_KEY);
  return null;
}

function actorHeaders(): Record<string, string> {
  const actor = currentActor();
  return actor ? { "x-actor": actor } : {};
}

// ── Reads (server components) ─────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  // actorHeaders is a no-op server-side (no window / in-memory actor); client
  // reads that trigger audited side effects (e.g. pack export) carry the actor.
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", headers: actorHeaders() });
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
  integrity_hash: string;
}
export const fetchPack = () => get<Pack>("/pack");

// ── Writes (client) ───────────────────────────────────────────────────────────

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

export const evidenceFileUrl = (evidenceId: string) => `${CLIENT_BASE}/evidence/file/${evidenceId}`;

export async function uploadEvidence(
  requirementId: string,
  file: File,
  meta: { title?: string; description?: string; dated?: string } = {}
) {
  const fd = new FormData();
  fd.append("file", file);
  if (meta.title) fd.append("title", meta.title);
  if (meta.description) fd.append("description", meta.description);
  if (meta.dated) fd.append("dated", meta.dated);
  const res = await fetch(`${CLIENT_BASE}/evidence/${requirementId}/upload`, {
    method: "POST",
    headers: { ...actorHeaders() }, // no Content-Type — browser sets multipart boundary
    body: fd,
  });
  if (!res.ok) throw new Error((await res.text()) || "Upload failed");
  return res.json();
}

// ── Workspace members ─────────────────────────────────────────────────────────
export const fetchMembers = () => get<{ members: Member[] }>("/members").then((d) => d.members);
export const addMember = (body: { name: string; role?: string; email?: string }) =>
  mutate("/members", "POST", body);
export const deleteMember = (id: string) => mutate(`/members/${id}`, "DELETE");

// ── Board governance (hash-chained approvals) ─────────────────────────────────
export interface Approval {
  id: string;
  seq: number;
  title: string;
  version: string;
  summary: string | null;
  author: string | null;
  approved_by: string;
  approved_at: string | null;
  prev_hash: string;
  hash: string;
  created_at: string;
  verified: boolean;
}
export interface ApprovalChain {
  entries: Approval[];
  chain_valid: boolean;
  genesis: string;
  count: number;
}
// ── Onboarding ────────────────────────────────────────────────────────────────
export interface OnboardingProfile {
  name?: string;
  org_type: string;
  employee_band: string;
  turnover_band: string;
  existing_policy: string;
  culture_level: string;
}
export interface GeneratedItem {
  code: string;
  status: Status;
  narrative: string;
  owner: string;
  pillar_id: string;
  pillar_name: string;
  title: string;
  flagged: boolean;
}
export interface Generated {
  items: GeneratedItem[];
  projected_score: number;
  projected_band: string;
  scope: { employees_over_250: boolean; turnover_over_36m: boolean; in_scope: boolean; note: string };
  provider: string;
  model: string;
}
export const fetchOnboardingStatus = () =>
  get<{ needs_onboarding: boolean; onboarded_at: string | null }>("/onboarding/status");
export const generateOnboarding = (profile: OnboardingProfile) =>
  mutate("/onboarding/generate", "POST", { profile }) as Promise<Generated>;
export const commitOnboarding = (profile: OnboardingProfile, items: { code: string; status: string; narrative?: string; owner?: string }[]) =>
  mutate("/onboarding/commit", "POST", { profile, items });

// ── Invite acceptance (public, token-gated) ───────────────────────────────────
export interface InviteInfo {
  valid: boolean;
  reason?: string;
  email?: string;
  org?: string;
  role?: string;
}
export async function getInvite(token: string): Promise<InviteInfo> {
  const res = await fetch(`${CLIENT_BASE}/invite/${token}`, { cache: "no-store" });
  if (!res.ok) return { valid: false, reason: "not_found" };
  return res.json();
}
export async function acceptInvite(token: string, password: string, name?: string) {
  const res = await fetch(`${CLIENT_BASE}/invite/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, name }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Could not accept invite");
  return res.json() as Promise<{ email: string; first_user: boolean }>;
}

export const fetchApprovals = () => get<ApprovalChain>("/governance/approvals");
export const addApproval = (body: {
  title: string;
  version: string;
  summary?: string;
  approved_by: string;
  approved_at?: string;
}) => mutate("/governance/approvals", "POST", body);

export const deleteEvidence = (evidenceId: string) =>
  mutate(`/evidence/${evidenceId}`, "DELETE");

export const runGapAnalysis = () => mutate(`/gaps/analyze`, "POST");
export const updateGapStatus = (gapId: string, status: string) =>
  mutate(`/gaps/${gapId}`, "PUT", { status });

export const setLlmProvider = (provider: string) =>
  mutate(`/settings/llm`, "PUT", { provider });
