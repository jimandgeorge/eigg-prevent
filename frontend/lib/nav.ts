// Single source of truth for navigation icons, shared by the Sidebar and the
// FaviconUpdater so the favicon always matches the active page's sidebar icon.
// Paths are 24-grid outline glyphs (stroke, no fill), drawn at strokeWidth 1.5.

export const ICONS = {
  // Overview — bar chart = framework readiness across the pillars
  overview: "M3 3v18h18M8 17v-5M13 17V8M18 17v-8",
  // Gaps — warning triangle
  gaps: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  // Evidence pack — document with a check
  pack: "M7 3.5h7L19 8.5V19.5a1 1 0 01-1 1H7a1 1 0 01-1-1V4.5a1 1 0 011-1zM14 3.5V8.5H19M9 14l2.3 2.3L15.5 12",
  // Audit trail — chronological log
  audit: "M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  // Settings — cog
  settings:
    "M10.3 4.3c.4-1.8 2.9-1.8 3.3 0a1.7 1.7 0 002.6 1.1c1.5-.9 3.3.8 2.4 2.4a1.7 1.7 0 001 2.5c1.8.5 1.8 3 0 3.4a1.7 1.7 0 00-1 2.6c.9 1.5-.8 3.3-2.4 2.4a1.7 1.7 0 00-2.6 1c-.4 1.8-2.9 1.8-3.3 0a1.7 1.7 0 00-2.6-1c-1.5.9-3.3-.8-2.4-2.4a1.7 1.7 0 00-1-2.6c-1.8-.4-1.8-2.9 0-3.4a1.7 1.7 0 001-2.5c-.9-1.6.9-3.3 2.4-2.4a1.7 1.7 0 002.6-1z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  // Sign out — arrow out of door
  signout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
} as const;

export interface NavItemDef {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}

// Main nav, grouped (a visual gap between groups in the sidebar).
export const NAV_GROUPS: NavItemDef[][] = [
  [
    { href: "/", label: "Overview", icon: ICONS.overview },
    { href: "/gaps", label: "Gaps", icon: ICONS.gaps },
    { href: "/pack", label: "Evidence pack", icon: ICONS.pack, badge: "ECCTA" },
  ],
  [{ href: "/audit", label: "Audit trail", icon: ICONS.audit }],
];

export const SETTINGS_ITEM: NavItemDef = { href: "/settings", label: "Settings", icon: ICONS.settings };

// Route → favicon icon. Ordered most-specific first; "/" is the catch-all last
// (startsWith matches everything). Sub-pages of Overview share its icon.
export const FAVICON_ROUTES: [string, string][] = [
  ["/gaps", ICONS.gaps],
  ["/pack", ICONS.pack],
  ["/audit", ICONS.audit],
  ["/settings", ICONS.settings],
  ["/pillars", ICONS.overview],
  ["/requirements", ICONS.overview],
  ["/", ICONS.overview],
];
