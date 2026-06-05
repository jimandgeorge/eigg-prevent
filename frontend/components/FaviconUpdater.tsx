"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FAVICON_ROUTES } from "@/lib/nav";

function toFavicon(d: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='${d}' fill='none' stroke='%230F1B2D' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>`;
  return `data:image/svg+xml,${svg}`;
}

// Mirror the active page's sidebar icon into the browser-tab favicon, matching
// the EIGG original. Base favicon (app/icon.svg = EIGG mark) stays the fallback.
export default function FaviconUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    const match = FAVICON_ROUTES.find(([route]) => pathname.startsWith(route));
    if (!match) return;
    const href = toFavicon(match[1]);

    // Get-or-create our managed link — never touch other links.
    let link = document.querySelector<HTMLLinkElement>("link[data-eigg]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-eigg", "");
    }
    link.href = href;
    // appendChild moves an existing element to the end — no removal, no errors.
    // Being last in <head> means we win over Next.js's re-injected link.
    document.head.appendChild(link);

    // Re-assert position whenever Next.js adds something after us.
    const el = link;
    const observer = new MutationObserver(() => {
      if (document.head.lastElementChild !== el) {
        document.head.appendChild(el);
      }
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
