"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Logo from "@/components/Logo";
import { acceptInvite, getInvite, type InviteInfo } from "@/lib/api";

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getInvite(params.token).then(setInfo).catch(() => setInfo({ valid: false, reason: "not_found" }));
  }, [params.token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (password !== confirm) return setErr("Passwords don't match.");
    setBusy(true);
    try {
      const res = await acceptInvite(params.token, password, name || info?.email);
      // Sign the new account in, then route to onboarding (first user) or the app.
      const signin = await signIn("account", { email: res.email, password, redirect: false });
      if (signin?.error) {
        router.push("/login");
      } else {
        router.push(res.first_user ? "/onboarding" : "/");
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[48%] bg-[#0F1B2D] flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <Logo size={34} className="text-white" />
          <span className="text-white font-semibold text-[16px] tracking-[0.2em]">EIGG PREVENT</span>
        </div>
        <div>
          <h1 className="text-white text-[34px] font-bold leading-tight tracking-tight">Welcome to EIGG.</h1>
          <p className="text-white/45 text-[15px] mt-4 max-w-[380px]">
            Set your password to access your organisation&apos;s fraud prevention workspace.
          </p>
        </div>
        <div className="text-white/25 text-[11px]">EIGG · eigg.io</div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-[360px]">
          {info === null ? (
            <div className="text-center text-zinc-400 text-[13px]">Checking your invitation…</div>
          ) : !info.valid ? (
            <div className="text-center">
              <h2 className="text-[20px] font-semibold text-zinc-900">
                {info.reason === "expired" ? "This invitation has expired" :
                 info.reason === "accepted" ? "Invitation already used" : "Invitation not found"}
              </h2>
              <p className="text-[13px] text-zinc-500 mt-2">
                {info.reason === "expired" ? "Ask your administrator to resend the invite." :
                 info.reason === "accepted" ? "Your account is already set up — please sign in." :
                 "This invite link is invalid."}
              </p>
              <a href="/login" className="inline-block mt-5 text-[13px] text-brand hover:underline">Go to sign in →</a>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 mb-8 lg:hidden">
                <Logo size={28} className="text-zinc-900" />
                <span className="font-semibold text-zinc-900 text-[15px] tracking-[0.2em]">EIGG PREVENT</span>
              </div>
              <h2 className="text-[24px] font-bold text-zinc-900 tracking-tight">Set your password</h2>
              <p className="text-[13px] text-zinc-500 mt-1.5">
                You&apos;ve been invited to <span className="font-medium text-zinc-700">{info.org}</span> as{" "}
                <span className="font-medium text-zinc-700">{info.email}</span>.
              </p>

              <form onSubmit={submit} className="space-y-4 mt-7">
                <Field label="Your name">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus
                    className={inputCls} />
                </Field>
                <Field label="Password">
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters" autoComplete="new-password" className={inputCls} />
                </Field>
                <Field label="Confirm password">
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password" className={inputCls} />
                </Field>
                {err && <p className="text-[13px] text-red-600">{err}</p>}
                <button type="submit" disabled={busy}
                  className="w-full bg-zinc-900 hover:bg-zinc-700 disabled:opacity-50 text-white text-[14px] font-medium rounded-lg px-4 py-3 transition-colors">
                  {busy ? "Setting up…" : "Set password & continue"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-white border border-zinc-300 rounded-lg px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-zinc-600 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}
