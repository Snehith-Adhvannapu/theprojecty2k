"use client";
import { useState } from "react";

export function FindTicketForm() {
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const r = await fetch("/api/tickets/find", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact }) });
      const j = await r.json();
      if (j.ok) { setState("sent"); setMsg(j.data.message); } else { setState("error"); setMsg(j.error?.message ?? "Something went wrong."); }
    } catch {
      setState("error");
      setMsg("No connection. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact" className="text-sm font-medium">Email or mobile number used to buy</label>
        <input id="contact" className="field" value={contact} onChange={(e) => { setContact(e.target.value); if (state !== "loading") setState("idle"); }}
          autoComplete="email" inputMode="email" placeholder="you@example.com or 98765 43210" aria-invalid={state === "error"} />
      </div>
      <button className="btn btn-primary btn-calm btn-block" disabled={state === "loading" || contact.trim().length < 5}>
        {state === "loading" && <span className="spinner" aria-hidden="true" />}
        {state === "loading" ? "Sending…" : "Email me my ticket link"}
      </button>
      {msg && <p role="status" className={`rounded-sm border p-3 text-sm ${state === "error" ? "border-danger" : "border-line-strong"}`}>{msg}</p>}
    </form>
  );
}
