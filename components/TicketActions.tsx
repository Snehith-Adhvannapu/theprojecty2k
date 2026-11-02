"use client";
import { useEffect, useState } from "react";

/** Registers the tiny service worker (ticket pages open offline) and offers "email me a copy". */
export function TicketActions({ token, whatsapp }: { token: string; whatsapp: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  async function email() {
    setState("loading");
    try {
      const r = await fetch(`/api/tickets/${encodeURIComponent(token)}/email`, { method: "POST" });
      const j = await r.json();
      setState(j.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex gap-3">
      <button type="button" onClick={email} disabled={state === "loading" || state === "sent"} aria-live="polite" className="btn btn-calm min-h-12 flex-1 text-sm">
        {state === "loading" && <span className="spinner" aria-hidden="true" />}
        {state === "sent" ? "Sent. Check your inbox" : state === "error" ? "Couldn't send. Try again" : "Email me a copy"}
      </button>
      {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-calm btn-quiet min-h-12 flex-1 text-sm">WhatsApp help</a>}
    </div>
  );
}
