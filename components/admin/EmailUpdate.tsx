"use client";
// Email update: write a message once, see exactly how it will look, send a test to yourself, then send to a group.
import { useEffect, useState } from "react";
import { api } from "./api";

type Audience = "holders" | "registered" | "not_bought";
const AUDIENCES: { id: Audience; label: string; note: string }[] = [
  { id: "holders", label: "Ticket holders", note: "Everyone who has a ticket. Best for hype and event news." },
  { id: "not_bought", label: "Started but did not buy", note: "People who registered but have no ticket. Best for a nudge to get passes." },
  { id: "registered", label: "Everyone who registered", note: "Ticket holders plus everyone who started an order." },
];
const KEY = "y2k_email_draft";
const STARTER = `Hi [name],

[sold] people are already in for the night, and only [left] passes are left.

Doors open at noon on [date]. Bring your ID, bring your people, and get ready.

See you inside.`;

interface Preview { subject: string; html: string; count: number }

export function EmailUpdate() {
  const [subject, setSubject] = useState("Project Y2K: only [left] passes left");
  const [body, setBody] = useState(STARTER);
  const [button, setButton] = useState(true);
  const [audience, setAudience] = useState<Audience>("holders");
  const [counts, setCounts] = useState<Partial<Record<Audience, number>>>({});
  const [prev, setPrev] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"" | "preview" | "test" | "send">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (d) { setSubject(d.subject); setBody(d.body); setButton(!!d.button); } } catch { /* private mode */ }
    (async () => {
      const next: Partial<Record<Audience, number>> = {};
      for (const a of AUDIENCES) { try { next[a.id] = (await api<{ count: number }>("/api/admin/broadcast", { action: "count", audience: a.id })).count; } catch { /* leave blank */ } }
      setCounts(next);
    })();
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ subject, body, button })); } catch { /* private mode */ } setPrev(null); setConfirm(false); }, [subject, body, button, audience]);

  const payload = { subject, body, button, audience };
  const ready = subject.trim().length >= 3 && body.trim().length >= 5;
  async function run(action: "preview" | "test" | "send") {
    setBusy(action); setMsg(null);
    try {
      if (action === "preview") setPrev(await api<Preview>("/api/admin/broadcast", { action, ...payload }));
      else if (action === "test") { const r = await api<{ to: string }>("/api/admin/broadcast", { action, ...payload }); setMsg({ ok: true, text: `Test sent to ${r.to}. Check your inbox.` }); }
      else {
        const r = await api<{ sent: number; failed: number }>("/api/admin/broadcast", { action, ...payload });
        setConfirm(false);
        setMsg({ ok: r.failed === 0, text: r.failed === 0 ? `Sent to ${r.sent} people.` : `Sent to ${r.sent} people. ${r.failed} could not be sent (bad address or a temporary problem).` });
      }
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." }); }
    setBusy("");
  }
  const insert = (t: string) => setBody((b) => `${b}${b.endsWith(" ") || b.endsWith("\n") || !b ? "" : " "}${t}`);
  const n = counts[audience];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <section data-tour="eu-audience" className="card-plain p-5">
          <h2 className="text-lg">1. Who gets it</h2>
          <div role="radiogroup" aria-label="Who gets it" className="mt-3 flex flex-col gap-2">
            {AUDIENCES.map((a) => (
              <label key={a.id} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-sm border p-3 ${audience === a.id ? "border-crimson bg-[var(--selected)]" : "border-line"}`}>
                <input type="radio" name="aud" className="mt-1 size-5 accent-[var(--blood)]" checked={audience === a.id} onChange={() => setAudience(a.id)} />
                <span className="flex-1"><span className="font-semibold">{a.label}</span> <span className="tnum muted">({counts[a.id] ?? "…"})</span><span className="muted block text-sm leading-snug">{a.note}</span></span>
              </label>
            ))}
          </div>
        </section>

        <section data-tour="eu-write" className="card-plain flex flex-col gap-3 p-5">
          <h2 className="text-lg">2. Write it</h2>
          <label className="flex flex-col gap-1.5 text-sm">Subject
            <input className="field" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">Message
            <textarea className="field min-h-[220px] leading-relaxed" value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="muted">Add:</span>
            {([["[name]", "their first name"], ["[sold]", "tickets sold"], ["[left]", "passes left"], ["[date]", "event date"]] as const).map(([t, l]) => (
              <button key={t} type="button" onClick={() => insert(t)} className="btn btn-quiet btn-calm min-h-11 px-3 text-sm" title={l}>{t} <span className="muted hidden sm:inline">{l}</span></button>
            ))}
          </div>
          <p className="muted text-sm">Paste or type your text. A blank line starts a new paragraph. Put **two stars** around words to make them bold. Links turn into links by themselves. The words in [brackets] are filled in for each person.</p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input type="checkbox" className="size-5 accent-[var(--blood)]" checked={button} onChange={(e) => setButton(e.target.checked)} /> Add a &ldquo;Get your pass&rdquo; button
          </label>
        </section>
      </div>

      <div className="flex flex-col gap-5">
        <section data-tour="eu-preview" className="card-plain p-5">
          <h2 className="text-lg">3. Check how it looks</h2>
          <button className="btn btn-quiet btn-calm mt-3 min-h-12 px-5" disabled={!ready || busy !== ""} onClick={() => run("preview")}>{busy === "preview" ? "Preparing…" : prev ? "Refresh preview" : "Show preview"}</button>
          {prev ? (
            <div className="mt-3">
              <p className="muted text-sm">Subject: <span className="text-fg">{prev.subject}</span></p>
              <iframe title="Email preview" srcDoc={prev.html} sandbox="" className="mt-2 h-[460px] w-full rounded-sm border border-line bg-bg" />
            </div>
          ) : <p className="muted mt-3 text-sm">The preview shows your message in the Project Y2K email design, as the first person would see it.</p>}
        </section>

        <section data-tour="eu-send" className="card p-5">
          <h2 className="text-lg">4. Send</h2>
          <button className="btn btn-quiet btn-calm mt-3 min-h-12 px-5" disabled={!ready || busy !== ""} onClick={() => run("test")}>{busy === "test" ? "Sending…" : "Send a test to me first"}</button>
          {!confirm ? (
            <button className="btn btn-primary btn-calm mt-3 min-h-12 w-full px-6" disabled={!ready || busy !== "" || !n} onClick={() => setConfirm(true)}>
              Send to {n ?? "…"} {n === 1 ? "person" : "people"}
            </button>
          ) : (
            <div className="mt-3 rounded-sm border border-blood p-4" role="alert">
              <p className="font-semibold">Send this to {n} {n === 1 ? "person" : "people"} ({AUDIENCES.find((a) => a.id === audience)?.label})?</p>
              <p className="muted mt-1 text-sm">Emails cannot be taken back once they are sent.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-primary btn-calm min-h-12 px-6" disabled={busy !== ""} onClick={() => run("send")}>{busy === "send" ? "Sending… please wait" : "Yes, send now"}</button>
                <button className="btn btn-quiet btn-calm min-h-12 px-5" disabled={busy !== ""} onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
          {msg && <p role="status" className={`mt-3 rounded-sm border p-3 text-sm ${msg.ok ? "border-line-strong" : "border-danger"}`}>{msg.text}</p>}
        </section>
      </div>
    </div>
  );
}
