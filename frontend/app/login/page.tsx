import AuthMethods from "./AuthMethods";
import Logo from "@/components/Logo";

const FEATURES = [
  {
    icon: "M3 3v18h18M7 14l3-3 3 3 5-5",
    label: "Framework readiness scoring",
    detail: "Live maturity across the five pillars of reasonable procedures",
  },
  {
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6L19 8.4V19a2 2 0 01-2 2z",
    label: "Board-ready evidence pack",
    detail: "One-click 'reasonable procedures' report for regulator or court",
  },
  {
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    label: "On-premises deployment",
    detail: "No organisational data leaves your infrastructure",
  },
];

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-[58%] bg-[#0F1B2D] flex-col justify-between p-14 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }}
        />

        <div className="relative flex items-center gap-3">
          <Logo size={34} className="text-white shrink-0" />
          <span className="text-white font-semibold text-[16px] tracking-[0.2em]">EIGG PREVENT</span>
        </div>

        <div className="relative space-y-10">
          <div>
            <h1 className="text-white text-[40px] font-bold leading-[1.15] tracking-tight mb-5">
              Reasonable procedures,<br />evidenced.
            </h1>
            <p className="text-white/45 text-[15px] leading-relaxed max-w-[420px]">
              Build, run and evidence your fraud prevention framework for the UK failure-to-prevent-fraud
              offence (ECCTA 2023). Every control dated, attributable and defensible.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0 mt-px">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </div>
                <div>
                  <div className="text-white/80 text-[13px] font-medium">{f.label}</div>
                  <div className="text-white/35 text-[12px] mt-0.5">{f.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6">
          {["ECCTA 2023", "Home Office six principles", "GDPR-aware"].map((tag) => (
            <span key={tag} className="text-white/25 text-[11px] font-medium tracking-wide">{tag}</span>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center bg-white px-8">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <Logo size={30} className="text-zinc-900 shrink-0" />
            <span className="font-semibold text-zinc-900 text-[15px] tracking-[0.2em]">EIGG PREVENT</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[26px] font-bold text-zinc-900 tracking-tight mb-2">Welcome back</h2>
            <p className="text-[14px] text-zinc-500">Sign in to your fraud prevention workspace.</p>
          </div>

          <AuthMethods error={searchParams.error} />

          <p className="text-[11px] text-zinc-400 text-center mt-8 leading-relaxed">
            Sessions expire after 8 hours of inactivity.<br />
            Contact your administrator if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
