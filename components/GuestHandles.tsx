"use client";
// One Instagram handle for every other person on the order. Buying 15 passes should not mean typing 14 handles
// into 14 boxes: paste them all at once and the boxes fill themselves, then fix any one by hand.
import { useState } from "react";
import { parseHandles } from "@/lib/normalize";

export function GuestHandles({ values, onChange, bad, disabled }: {
  values: string[]; onChange: (v: string[]) => void; bad: boolean[]; disabled?: boolean;
}) {
  const [paste, setPaste] = useState("");
  const [note, setNote] = useState("");
  const done = values.filter((v) => v.trim()).length;

  function fill() {
    const found = parseHandles(paste);
    if (!found.length) { setNote("We could not find any handles in that. Try @name, one per line."); return; }
    const next = values.map((v, i) => found[i] ?? v);
    onChange(next);
    setPaste("");
    setNote(found.length > values.length
      ? `Added ${values.length} handles. ${found.length - values.length} extra ${found.length - values.length === 1 ? "was" : "were"} ignored.`
      : `Added ${found.length} ${found.length === 1 ? "handle" : "handles"}.`);
  }

  return (
    <section aria-labelledby="h-guests" className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <h2 id="h-guests" className="label">Your guests</h2>
        <p className="tnum text-sm" aria-live="polite"><span className={done === values.length ? "text-fg" : "muted"}>{done} of {values.length} added</span></p>
      </div>
      <div className="mt-2 h-1 rounded-sm bg-line" aria-hidden="true"><div className="h-full rounded-sm bg-crimson transition-[width] duration-300" style={{ width: `${values.length ? (done / values.length) * 100 : 0}%` }} /></div>
      <p className="muted mt-3 text-sm">Add everyone&apos;s Instagram, so we can check the guest list. With or without the @, and a profile link works too.</p>

      {values.length > 2 && (
        <div className="card-plain mt-4 flex flex-col gap-2 p-4">
          <label htmlFor="g-paste" className="text-sm font-medium">Paste all handles at once</label>
          <textarea id="g-paste" className="field min-h-[88px]" value={paste} onChange={(e) => { setPaste(e.target.value); setNote(""); }} disabled={disabled}
            placeholder={"@friend1\n@friend2\n@friend3"} autoCapitalize="none" autoCorrect="off" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-quiet btn-calm min-h-11 px-5 text-sm" onClick={fill} disabled={disabled || !paste.trim()}>Fill the list</button>
            {note && <p role="status" className="muted text-sm">{note}</p>}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <label htmlFor={`g-${i}`} className="text-sm font-medium">Guest {i + 2}</label>
            <input id={`g-${i}`} className="field" value={v} disabled={disabled} autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="@theirhandle"
              aria-invalid={bad[i] || undefined} aria-describedby={bad[i] ? `g-${i}-e` : undefined}
              onChange={(ev) => onChange(values.map((x, j) => (j === i ? ev.target.value : x)))} />
            {bad[i] && <p id={`g-${i}-e`} className="field-error">{v.trim() ? "That doesn't look like a handle" : "Add their handle"}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
