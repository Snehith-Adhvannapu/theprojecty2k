"use client";
// Edit every piece of landing page wording. Saving updates the live page within a few seconds.
// In headings and paragraphs, *words between stars* get the accent style.
import { useEffect, useState } from "react";
import { api } from "./api";

interface Landing {
  about: { heading: string; lead: string; paras: string[]; closer: string; note: string };
  trust: string[];
  how: { eyebrow: string; heading: string; steps: { title: string; text: string }[] };
  last: { eyebrow: string; heading: string; lead: string; paras: string[] };
  details: { label: string; value: string }[];
  passes: { eyebrow: string; heading: string; intro: string; steps: string[] };
  who: { eyebrow: string; heading: string; paras: string[] };
  faq: { q: string; a: string }[];
}

const join = (p: string[]) => p.join("\n\n");
const split = (t: string) => t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

function Field({ id, label, value, onChange, rows, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="label" htmlFor={id}>{label}</label>
      {rows ? <textarea id={id} className="field" style={{ minHeight: rows * 28 }} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} />}
      {hint && <span className="muted text-[13px]">{hint}</span>}
    </div>
  );
}

function Section({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="card-plain group">
      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 text-base font-semibold">{title}<span aria-hidden="true" className="text-crimson">+</span></summary>
      <div className="flex flex-col gap-4 border-t border-line p-5">{children}</div>
    </details>
  );
}

export function PageText() {
  const [d, setD] = useState<Landing | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");
  // Paragraph lists are edited as one textarea each; keep the raw text so typing blank lines feels natural.
  const [raw, setRaw] = useState({ about: "", last: "", who: "" });

  const load = (l: Landing) => { setD(l); setRaw({ about: join(l.about.paras), last: join(l.last.paras), who: join(l.who.paras) }); };
  useEffect(() => { api<Landing>("/api/admin/site").then(load).catch((e) => { setState("error"); setMsg(e instanceof Error ? e.message : "Failed to load"); }); }, []);

  async function run(body: unknown, done: string) {
    setState("loading"); setMsg("");
    try { load(await api<Landing>("/api/admin/site", body)); setState("ok"); setMsg(done); }
    catch (e) { setState("error"); setMsg(e instanceof Error ? e.message : "Failed"); }
  }

  if (!d) return state === "error" ? <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{msg}</p> : <div className="skeleton h-64" aria-busy="true" />;
  const touch = (n: Landing) => { setD(n); setState("idle"); };
  const busy = state === "loading";
  const payload = (): Landing => ({ ...d, about: { ...d.about, paras: split(raw.about) }, last: { ...d.last, paras: split(raw.last) }, who: { ...d.who, paras: split(raw.who) } });
  const rawSet = (k: "about" | "last" | "who") => (v: string) => { setRaw({ ...raw, [k]: v }); setState("idle"); };

  return (
    <form data-tour="pt-form" className="flex max-w-[860px] flex-col gap-3" onSubmit={(e) => { e.preventDefault(); run(payload(), "Saved. The landing page updates in a few seconds."); }}>
      <h2 className="text-lg">Landing page text</h2>
      <p className="muted text-sm">Every section of the landing page. Put <strong className="text-fg">*stars*</strong> around words to show them in the red accent style. Leave a blank line between paragraphs.</p>

      <Section title="Top of the page (under the poster)" open>
        <Field id="a-h" label="Heading" value={d.about.heading} onChange={(v) => touch({ ...d, about: { ...d.about, heading: v } })} />
        <Field id="a-l" label="Opening line" value={d.about.lead} onChange={(v) => touch({ ...d, about: { ...d.about, lead: v } })} hint="Leave empty to hide." />
        <Field id="a-p" label="Description" rows={9} value={raw.about} onChange={rawSet("about")} />
        <Field id="a-c" label="Closing line" value={d.about.closer} onChange={(v) => touch({ ...d, about: { ...d.about, closer: v } })} hint="Leave empty to hide." />
        <Field id="a-n" label="Small note under the Get passes button" value={d.about.note} onChange={(v) => touch({ ...d, about: { ...d.about, note: v } })} />
      </Section>

      <Section title="Three trust points (strip under the ticker)">
        {d.trust.map((t, i) => <Field key={i} id={`t-${i}`} label={`Point ${i + 1}`} value={t} onChange={(v) => touch({ ...d, trust: d.trust.map((x, j) => (j === i ? v : x)) })} />)}
      </Section>

      <Section title="How to get your ticket (4 steps)">
        <Field id="h-e" label="Small label" value={d.how.eyebrow} onChange={(v) => touch({ ...d, how: { ...d.how, eyebrow: v } })} />
        <Field id="h-h" label="Heading" value={d.how.heading} onChange={(v) => touch({ ...d, how: { ...d.how, heading: v } })} />
        {d.how.steps.map((s, i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-line pt-4">
            <Field id={`hs-t-${i}`} label={`Step ${i + 1} title`} value={s.title} onChange={(v) => touch({ ...d, how: { ...d.how, steps: d.how.steps.map((x, j) => (j === i ? { ...x, title: v } : x)) } })} />
            <Field id={`hs-x-${i}`} label={`Step ${i + 1} text`} rows={3} value={s.text} onChange={(v) => touch({ ...d, how: { ...d.how, steps: d.how.steps.map((x, j) => (j === i ? { ...x, text: v } : x)) } })} />
          </div>
        ))}
      </Section>

      <Section title="The last one (Y2K 1.0)">
        <Field id="l-e" label="Small label" value={d.last.eyebrow} onChange={(v) => touch({ ...d, last: { ...d.last, eyebrow: v } })} />
        <Field id="l-h" label="Heading" value={d.last.heading} onChange={(v) => touch({ ...d, last: { ...d.last, heading: v } })} />
        <Field id="l-l" label="Opening line" value={d.last.lead} onChange={(v) => touch({ ...d, last: { ...d.last, lead: v } })} />
        <Field id="l-p" label="Description" rows={8} value={raw.last} onChange={rawSet("last")} />
      </Section>

      <Section title="Event details (date, doors, music, venue, age, dress)">
        {d.details.map((x, i) => (
          <div key={i} className="flex flex-wrap gap-3">
            <div className="min-w-[120px] flex-1"><Field id={`d-l-${i}`} label="Label" value={x.label} onChange={(v) => touch({ ...d, details: d.details.map((y, j) => (j === i ? { ...y, label: v } : y)) })} /></div>
            <div className="min-w-[220px] flex-[3]"><Field id={`d-v-${i}`} label="Value" value={x.value} onChange={(v) => touch({ ...d, details: d.details.map((y, j) => (j === i ? { ...y, value: v } : y)) })} /></div>
          </div>
        ))}
      </Section>

      <Section title="Passes section">
        <Field id="p-e" label="Small label" value={d.passes.eyebrow} onChange={(v) => touch({ ...d, passes: { ...d.passes, eyebrow: v } })} />
        <Field id="p-h" label="Heading" value={d.passes.heading} onChange={(v) => touch({ ...d, passes: { ...d.passes, heading: v } })} />
        <Field id="p-i" label="Intro" rows={3} value={d.passes.intro} onChange={(v) => touch({ ...d, passes: { ...d.passes, intro: v } })} />
        {d.passes.steps.map((t, i) => <Field key={i} id={`ps-${i}`} label={`Line under the passes ${i + 1}`} value={t} onChange={(v) => touch({ ...d, passes: { ...d.passes, steps: d.passes.steps.map((x, j) => (j === i ? v : x)) } })} />)}
        <p className="muted text-[13px]">Pass names, descriptions, prices and quantities are edited in the Passes tab.</p>
      </Section>

      <Section title="Who's behind it">
        <Field id="w-e" label="Small label" value={d.who.eyebrow} onChange={(v) => touch({ ...d, who: { ...d.who, eyebrow: v } })} />
        <Field id="w-h" label="Heading" value={d.who.heading} onChange={(v) => touch({ ...d, who: { ...d.who, heading: v } })} />
        <Field id="w-p" label="Text" rows={6} value={raw.who} onChange={rawSet("who")} />
      </Section>

      <Section title={`FAQ (${d.faq.length} questions)`}>
        {d.faq.map((f, i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
            <Field id={`f-q-${i}`} label={`Question ${i + 1}`} value={f.q} onChange={(v) => touch({ ...d, faq: d.faq.map((x, j) => (j === i ? { ...x, q: v } : x)) })} />
            <Field id={`f-a-${i}`} label="Answer" rows={4} value={f.a} onChange={(v) => touch({ ...d, faq: d.faq.map((x, j) => (j === i ? { ...x, a: v } : x)) })} />
            <button type="button" className="btn btn-quiet btn-calm min-h-11 self-start px-4 text-sm" onClick={() => touch({ ...d, faq: d.faq.filter((_, j) => j !== i) })}>Remove this question</button>
          </div>
        ))}
        <button type="button" className="btn btn-quiet btn-calm min-h-11 self-start px-4 text-sm" disabled={d.faq.length >= 20} onClick={() => touch({ ...d, faq: [...d.faq, { q: "", a: "" }] })}>Add a question</button>
      </Section>

      {msg && <p role={state === "error" ? "alert" : "status"} className={`rounded-sm border p-3 text-sm ${state === "error" ? "border-danger" : "border-line-strong"}`}>{msg}</p>}
      <div className="sticky bottom-0 -mx-5 flex flex-wrap gap-3 border-t border-line bg-bg px-5 py-3 md:mx-0 md:px-0">
        <button type="submit" className="btn btn-primary btn-calm min-h-12 flex-1 px-6 sm:flex-none" disabled={busy} aria-busy={busy}>{busy && <span className="spinner" aria-hidden="true" />}{busy ? "Saving…" : state === "ok" ? "Saved ✓" : "Save all changes"}</button>
        <a className="btn btn-quiet btn-calm min-h-12 px-5" href="/" target="_blank" rel="noopener noreferrer">View page</a>
        <button type="button" className="btn btn-quiet btn-calm min-h-12 px-5" disabled={busy} onClick={() => { if (window.confirm("Put ALL the original wording back?")) run({ reset: true }, "Original wording restored."); }}>Restore original</button>
      </div>
    </form>
  );
}
