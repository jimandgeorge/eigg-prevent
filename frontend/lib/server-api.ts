import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import type { AuditEntry, Framework, Gap, Pillar } from "./api";

// Server-component data access. Reads the session, then calls the backend directly with
// the internal secret + the user's workspace (falling back to the default workspace for
// sessions with none, e.g. shared-password / platform admin). Mirrors the /api/t proxy.
const API = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001") + "/api/v1";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";
const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

async function sget<T>(path: string): Promise<T> {
  const session = await getServerSession(authOptions);
  const wid = session?.user?.workspace_id || DEFAULT_WORKSPACE_ID;
  const actor = session?.user?.name || session?.user?.email || "unknown";
  const res = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: { "x-internal-secret": SECRET, "x-workspace-id": wid, "x-actor": actor },
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchFramework = () => sget<Framework>("/framework");
export const fetchPillar = (id: string) => sget<Pillar>(`/framework/pillars/${id}`);
export const fetchGaps = (status = "open") => sget<{ gaps: Gap[] }>(`/gaps?status=${status}`).then((d) => d.gaps);
export const fetchAudit = () => sget<{ entries: AuditEntry[] }>("/audit").then((d) => d.entries);
export const fetchOnboardingStatus = () =>
  sget<{ needs_onboarding: boolean; onboarded_at: string | null }>("/onboarding/status");
