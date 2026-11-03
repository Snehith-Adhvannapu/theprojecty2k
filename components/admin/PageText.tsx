"use client";
// Edit the landing page wording. Saving updates the live page within a few seconds.
import { useEffect, useState } from "react";
import { api } from "./api";

interface About { heading: string; lead: string; paras: string[]; closer: string; note: string }
interface Form { heading: string; lead: string; paras: string; closer: string; note: string }

const toForm = (a: About): Form => ({ ...a, paras: a.paras.join("\n\n") });
const fromForm = (f: Form): About => ({
  heading: f.heading, lead: f.lead, closer: f.closer, note: f.note,
  paras: f.paras.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
});

export function PageText() {
  const [f, setF] = useState<Form | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => { api<About>("/api/admin/site").then((a) => setF(toForm(a))).catch((e) => { setState("error"); setMsg(e instanceof Error ? e.message : "Failed to load"); }); }, []);

  async function run(body: unknown, done: string) {
    setState("loading"); setMsg("");
    try {
      const a = await api<About>("/api/admin/site", body);
      setF(toForm(a)); setState("ok"); setMsg(done);
    } catch (e) { setState("error"); setMsg(e instanceof Error ? e.message : "Failed"); }
  }

  if (!f) return state === "error" ? <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{msg}</p> : <div className="skeleton h-64" aria-busy="true" />;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setState("idle"); };
  const busy = state === "loading";

  return (
    <section className="flex flex-wrap gap-6">
      <form className="card-plain flex min-w-[320px] flex-[2_1_420px] flex-col gap-4 p-5" onSubmit={(e) => { e.preventDefault(); run(fromForm(f), "Saved. The landing page updates in a few seconds."); }}>
        <h2 className="text-lg">Landing page text</h2>
        <p className="muted text-sm">The words under the poster. Leave the opening line or closing line empty to hide it.</p>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="pt-h">Heading</label><input id="pt-h" className="field" value={f.heading} onChange={set("heading")} maxLength={120} /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="pt-l">Opening line</label><input id="pt-l" className="field" value={f.lead} onChange={set("lead")} maxLength={200} /></div>
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="pt-p">Description</label>
          <textarea id="pt-p" className="field min-h-56" value={f.paras} onChange={set("paras")} />
          <span className="muted text-[13px]">Leave a blank line between paragraphs.</span>
        </div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="pt-c">Closing line</label><input id="pt-c" className="field" value={f.closer} onChange={set("closer")} maxLength={160} /></div>
        <div className="flex flex-col gap-1"><label className="label" htmlFor="pt-n">Small note under the Get passes button</label><input id="pt-n" className="field" value={f.note} onChange={set("note")} maxLength={200} /></div>
        {msg && <p role={state === "error" ? "alert" : "status"} className={`rounded-sm border p-3 text-sm ${state === "error" ? "border-danger" : "border-line-strong"}`}>{msg}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary btn-calm min-h-12 flex-1 px-6 sm:flex-none" disabled={busy} aria-busy={busy}>{busy && <span className="spinner" aria-hidden="true" />}{busy ? "Saving…" : state === "ok" ? "Saved ✓" : "Save changes"}</button>
          <a className="btn btn-quiet btn-calm min-h-12 px-5" href="/" target="_blank" rel="noopener noreferrer">View page</a>
          <button type="button" className="btn btn-quiet btn-calm min-h-12 px-5" disabled={busy} onClick={() => { if (window.confirm("Put the original wording back?")) run({ reset: true }, "Original wording restored."); }}>Restore original</button>
        </div>
      </form>
    </section>
  );
}
