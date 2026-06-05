"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { setActor } from "@/lib/api";

// When signed in, the session identity becomes the audit identity: every control
// change, evidence add, gap decision and pack export is attributed to this name
// (via the x-actor header in lib/api.ts). setActor keeps it in memory (available
// synchronously) and in localStorage. When OIDC is used the name/email is verified;
// with the shared password it's self-declared at login.
export default function IdentitySync() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    const who = session?.user?.name || session?.user?.email;
    if (who) setActor(who);
  }, [status, session]);

  return null;
}
