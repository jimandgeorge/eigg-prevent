"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const NAV = [
  {
    items: [
      { href: "/", label: "Overview", icon: "M3 12l2-2 7-7 7 7 2 2M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10" },
      { href: "/gaps", label: "Gaps", icon: "M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" },
      { href: "/pack", label: "Evidence pack", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6L19 8.4V19a2 2 0 01-2 2z", badge: "ECCTA" },
    ],
  },
  {
    items: [
      { href: "/audit", label: "Audit trail", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    ],
  },
];

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={path} />
    </svg>
  );
}

function NavItem({ href, label, icon, badge }: { href: string; label: string; icon: string; badge?: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" || pathname.startsWith("/pillars") : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2 py-1.5 rounded text-[13px] transition-colors ${
        active ? "bg-zinc-200/70 text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
      }`}
    >
      <Icon path={icon} />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[9px] font-semibold tracking-widest px-1 py-px rounded bg-emerald-100 text-emerald-700">
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-[224px] shrink-0 h-screen sticky top-0 flex flex-col bg-[#F7F7F5] border-r border-zinc-200 select-none">
      <div className="flex items-center gap-2.5 px-4 h-16 shrink-0">
        <Logo size={24} className="text-ink shrink-0" />
        <div className="leading-none">
          <div className="text-[14px] font-semibold tracking-tight text-zinc-900">EIGG Prevent</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Failure to prevent fraud</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {NAV.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.items.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-2 py-2 border-t border-zinc-200 shrink-0">
        <NavItem
          href="/settings"
          label="Settings"
          icon="M10.3 4.3c.4-1.8 2.9-1.8 3.3 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.5c1.8.5 1.8 3 0 3.4a1.7 1.7 0 00-1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-2.9 1.8-3.3 0a1.7 1.7 0 00-2.6-1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-2.9 0-3.4a1.7 1.7 0 001-2.5c-.9-1.6.9-3.3 2.4-2.4a1.7 1.7 0 002.6-1z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </div>
    </aside>
  );
}
