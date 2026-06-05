"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Logo from "@/components/Logo";
import { ICONS, NAV_GROUPS, SETTINGS_ITEM, type NavItemDef } from "@/lib/nav";

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={path} />
    </svg>
  );
}

function NavItem({ href, label, icon, badge }: NavItemDef) {
  const pathname = usePathname();
  const active =
    href === "/"
      ? pathname === "/" || pathname.startsWith("/pillars") || pathname.startsWith("/requirements")
      : pathname.startsWith(href);
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
        <Logo size={30} className="text-ink shrink-0" />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        ))}
      </nav>

      <div className="px-2 py-2 border-t border-zinc-200 shrink-0 space-y-0.5">
        <NavItem {...SETTINGS_ITEM} />
        <Account />
      </div>
    </aside>
  );
}

function Account() {
  const { data: session, status } = useSession();
  // Auth may be disabled (no AUTH_PASSWORD / OIDC) — hide the account block then.
  if (status !== "authenticated" || !session?.user) return null;
  const name = session.user.name || session.user.email || "Signed in";
  return (
    <div className="pt-1.5 mt-1.5 border-t border-zinc-200/70">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="w-5 h-5 rounded-full bg-zinc-300 text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 text-[12px] text-zinc-600 truncate" title={name}>{name}</span>
      </div>
      {session.user.is_admin && (
        <Link
          href="/admin"
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[13px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
        >
          <Icon path="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
          <span className="flex-1">Admin</span>
          <span className="text-[9px] font-semibold tracking-widest text-zinc-400">INTERNAL</span>
        </Link>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex w-full items-center gap-2 px-2 py-1.5 rounded text-[13px] text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
      >
        <Icon path={ICONS.signout} />
        Sign out
      </button>
    </div>
  );
}
