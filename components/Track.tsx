"use client";
// Counts a page view on every public page. No cookies, nothing stored on the visitor's device, skipped for staff screens
// and for visitors who send Do Not Track. Fire-and-forget: it never delays or breaks the page.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function Track() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    try {
      if (navigator.doNotTrack === "1" || /^\/(admin|scan|login|api)(\/|$)/.test(path)) return;
      const body = JSON.stringify({
        path,
        ...(first.current ? { ref: document.referrer || undefined, utm: new URLSearchParams(location.search).get("utm_source") ?? undefined } : {}),
      });
      first.current = false;
      if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
        fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
      }
    } catch { /* analytics never breaks a page */ }
  }, [path]);
  return null;
}
