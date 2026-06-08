import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

// Tenant proxy: the browser calls /api/t/<path>; this reads the authenticated session,
// injects a TRUSTED x-workspace-id (+ actor) behind the internal secret, and forwards to
// the backend /api/v1/<path>. The browser can't choose its own workspace. Sessions with
// no workspace (shared-password / platform admin) fall back to the default workspace.
const BACKEND = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001") + "/api/v1";
const SECRET = process.env.INTERNAL_API_SECRET ?? "";
const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

async function proxy(req: NextRequest, path: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const wid = session.user.workspace_id || DEFAULT_WORKSPACE_ID;
  const actor = session.user.name || session.user.email || "unknown";

  const headers: Record<string, string> = {
    "x-internal-secret": SECRET,
    "x-workspace-id": wid,
    "x-actor": actor,
  };
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "DELETE") {
    // Forward the raw body so multipart uploads (evidence) survive intact.
    headers["content-type"] = req.headers.get("content-type") ?? "application/json";
    init.body = Buffer.from(await req.arrayBuffer());
  }
  const res = await fetch(`${BACKEND}/${path.join("/")}${req.nextUrl.search}`, init);
  const buf = Buffer.from(await res.arrayBuffer());
  return new NextResponse(buf, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

type Ctx = { params: { path: string[] } };
export const GET = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const POST = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const PUT = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const PATCH = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
export const DELETE = (req: NextRequest, { params }: Ctx) => proxy(req, params.path);
