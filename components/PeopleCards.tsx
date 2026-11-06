"use client";
// One card for every other person on the order. Each person gets their own ticket, emailed to them,
// so each card asks for the same four things as the buyer: name, email, phone and Instagram.
export interface PersonDraft { name: string; email: string; phone: string; instagram: string }
export type PersonErrors = Partial<Record<keyof PersonDraft, string>>;
export const emptyPerson = (): PersonDraft => ({ name: "", email: "", phone: "", instagram: "" });

export function PeopleCards({ values, onChange, errors, disabled }: {
  values: PersonDraft[]; onChange: (v: PersonDraft[]) => void; errors: PersonErrors[]; disabled?: boolean;
}) {
  const done = values.filter((v) => v.name.trim() && v.email.trim() && v.phone.trim() && v.instagram.trim()).length;
  const set = (i: number, k: keyof PersonDraft, val: string) => onChange(values.map((p, j) => (j === i ? { ...p, [k]: val } : p)));

  return (
    <section aria-labelledby="h-people" className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <h2 id="h-people" className="label">The other {values.length === 1 ? "person" : "people"}</h2>
        <p className="tnum muted text-sm" aria-live="polite">{done} of {values.length} filled in</p>
      </div>
      <p className="muted mt-2 text-sm">Everyone gets their own ticket with their own QR code, emailed to them. We also use these details to find anyone at the door.</p>

      <div className="mt-4 flex flex-col gap-4">
        {values.map((p, i) => {
          const e = errors[i] ?? {};
          const id = `p${i}`;
          return (
            <fieldset key={i} className="card-plain p-5" disabled={disabled}>
              <legend className="px-1 text-base font-semibold">Person {i + 2}</legend>
              <div className="mt-1 grid gap-4 sm:grid-cols-2">
                <Field id={`${id}-n`} label="Full name" err={e.name} value={p.name} onChange={(v) => set(i, "name", v)} autoComplete="off" placeholder="As on their ID" />
                <Field id={`${id}-e`} label="Email" err={e.email} type="email" value={p.email} onChange={(v) => set(i, "email", v)} autoComplete="off" autoCapitalize="none" placeholder="name@example.com" />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${id}-p`} className="text-sm font-medium">Phone number</label>
                  <div className="flex gap-2">
                    <span className="field flex !w-16 shrink-0 items-center justify-center text-muted">+91</span>
                    <input id={`${id}-p`} className="field min-w-0 flex-1" type="tel" inputMode="numeric" autoComplete="off" placeholder="10-digit mobile"
                      value={p.phone} onChange={(ev) => set(i, "phone", ev.target.value)} aria-invalid={!!e.phone} aria-describedby={e.phone ? `${id}-p-e` : undefined} />
                  </div>
                  {e.phone && <p id={`${id}-p-e`} className="field-error">{e.phone}</p>}
                </div>
                <Field id={`${id}-i`} label="Instagram handle" err={e.instagram} value={p.instagram} onChange={(v) => set(i, "instagram", v)} autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="@theirhandle" />
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

function Field({ id, label, err, onChange, ...p }: { id: string; label: string; err?: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} className="field" aria-invalid={!!err} aria-describedby={err ? `${id}-e` : undefined} onChange={(ev) => onChange(ev.target.value)} {...p} />
      {err && <p id={`${id}-e`} className="field-error">{err}</p>}
    </div>
  );
}
