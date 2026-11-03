"use client";
import Link from "next/link";
import { Tip } from "@/components/Tip";
import { rememberOrder } from "@/lib/myOrders";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { eventConfig as e } from "@/config/event";
import { normalizeEmail, normalizeInstagram, normalizePhone, paise } from "@/lib/normalize";

interface Pass {
  id: string; name: string; description: string; pricePaise: number; feePaise: number;
  admits: number; available: number; onSale: boolean;
}
type Phase = "idle" | "starting" | "error";
type Fields = { name: string; phone: string; email: string; instagram: string };

const STORE = "y2k:checkout";
async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  return json.data;
}

export function CheckoutForm() {
  const router = useRouter();
  const passId = useSearchParams().get("pass");
  const [pass, setPass] = useState<Pass | null | undefined>(undefined); // undefined = loading, null = not found
  const [qty, setQty] = useState(1);
  const [f, setF] = useState<Fields>({ name: "", phone: "", email: "", instagram: "" });
  const [accepted, setAccepted] = useState(false);
  const [errs, setErrs] = useState<Partial<Record<keyof Fields | "accepted", string>>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const attempt = useRef({ key: crypto.randomUUID(), sig: "" });
  const maxPer = e.limits.maxPassesPerOrder;

  // Restore draft so a refresh loses nothing.
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(STORE) ?? "null");
      if (d) setF((cur) => ({ ...cur, ...d.f }));
    } catch { /* storage unavailable: fine */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify({ f })); } catch { /* ignore */ }
  }, [f]);

  useEffect(() => {
    fetch("/api/event").then((r) => r.json()).then((j) => {
      const p = (j.data?.passes as Pass[] | undefined)?.find((x) => x.id === passId);
      setPass(p ?? null);
    }).catch(() => setPass(null));
  }, [passId]);

  const limit = pass ? Math.max(1, Math.min(maxPer, pass.available)) : 1;
  const money = useMemo(() => {
    if (!pass) return { sub: 0, fee: 0, total: 0 };
    return { sub: pass.pricePaise * qty, fee: pass.feePaise * qty, total: (pass.pricePaise + pass.feePaise) * qty };
  }, [pass, qty]);

  const busy = phase === "starting";
  const set = (k: keyof Fields) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setF((cur) => ({ ...cur, [k]: ev.target.value }));
    if (errs[k]) setErrs((x) => ({ ...x, [k]: undefined }));
  };

  function validate() {
    const x: typeof errs = {};
    if (f.name.trim().length < 2) x.name = "Enter your full name";
    if (!normalizePhone(f.phone)) x.phone = "Enter a valid 10-digit mobile number";
    if (!/^\S+@\S+\.\S+$/.test(normalizeEmail(f.email))) x.email = "Enter a valid email address";
    if (!f.instagram.trim()) x.instagram = "Enter your Instagram handle";
    else if (!normalizeInstagram(f.instagram)) x.instagram = "That doesn't look like an Instagram handle";
    if (!accepted) x.accepted = "Please accept the terms to continue";
    setErrs(x);
    return Object.keys(x).length === 0;
  }

  async function pay() {
    if (busy || !pass) return;
    setMessage("");
    if (!validate()) {
      setPhase("error");
      setMessage("Please fix the highlighted fields.");
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }
    setPhase("starting");
    try {
      // Same details + same tap = same idempotency key (double-tap safe). Any change = a new order.
      const sig = JSON.stringify([pass.id, qty, f, accepted]);
      if (attempt.current.sig !== sig) attempt.current = { key: crypto.randomUUID(), sig };
      const order = await post("/api/orders", {
        passTypeId: pass.id, qty, name: f.name, phone: f.phone, email: f.email,
        instagram: f.instagram, idempotencyKey: attempt.current.key, accepted: true,
      });
      rememberOrder(order.id);
      router.push(`/order/${order.id}`);
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  if (pass === undefined) {
    return <div className="mt-8 space-y-4" aria-busy="true"><div className="skeleton h-24" /><div className="skeleton h-64" /></div>;
  }
  if (pass === null) {
    return (
      <div className="card-plain mt-8 p-6" role="alert">
        <p className="font-semibold">That pass isn&apos;t available.</p>
        <p className="muted mt-2">It may have sold out or been removed. Pick again from the passes.</p>
        <Link href="/#passes" className="btn btn-quiet btn-calm mt-4">See passes</Link>
      </div>
    );
  }

  const label = phase === "starting" ? "Reserving your pass…" : phase === "error" ? `Try again · Continue ${paise(money.total)}` : `Continue to payment · ${paise(money.total)}`;

  return (
    <div className="slide-up">
      <h1 className="mt-7 text-[28px] leading-[1.15]">Checkout</h1>
      <p className="muted mt-2">{e.name} · {e.dateLabel} · {e.venue.name}</p>

      <section aria-labelledby="h-pass" className="mt-7">
        <h2 id="h-pass" className="label">Your pass</h2>
        <div className="card mt-3 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{pass.name}</p>
              <p className="muted mt-1 text-sm">Admits {pass.admits} · {paise(pass.pricePaise)} each{" "}<Tip text={pass.admits > 1 ? `One ticket lets ${pass.admits} people in. You get one QR code, and it is scanned once at the door for everyone on it.` : "One ticket lets one person in. Buying 2 gives you 2 separate tickets."} /></p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Quantity">
              <button type="button" className="btn btn-quiet btn-calm size-11 min-h-11 p-0 text-xl" aria-label="Fewer passes" disabled={qty <= 1 || busy} onClick={() => setQty(qty - 1)}>−</button>
              <span aria-live="polite" className="tnum min-w-9 text-center text-lg font-semibold">{qty}</span>
              <button type="button" className="btn btn-quiet btn-calm size-11 min-h-11 p-0 text-xl" aria-label="More passes" disabled={qty >= limit || busy} onClick={() => setQty(qty + 1)}>+</button>
            </div>
          </div>
          {pass.available <= 10 && <p className="mt-3 text-sm text-crimson">Only {pass.available} left</p>}
        </div>
      </section>

      <form noValidate onSubmit={(ev) => { ev.preventDefault(); pay(); }}>
        <section aria-labelledby="h-details" className="mt-8">
          <h2 id="h-details" className="label">Your details</h2>
          <p className="muted mt-2 text-sm">One set of details covers the whole order. Your ticket and receipt go to this email.</p>
          <div className="mt-4 flex flex-col gap-4">
            <Input id="f-name" label="Full name" tip="Write your name exactly as on your photo ID. It is printed on your ticket and checked at the door." err={errs.name} value={f.name} onChange={set("name")} disabled={busy} autoComplete="name" placeholder="As on your ID" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-phone" className="flex items-center gap-1.5 text-sm font-medium">Phone number<Tip text="A 10-digit Indian mobile number. We may WhatsApp you about your order, and staff use it to find you at the door if you lose your ticket." /></label>
              <div className="flex gap-2">
                <span className="field flex !w-16 shrink-0 items-center justify-center text-muted">+91</span>
                <input id="f-phone" className="field min-w-0 flex-1" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile"
                  value={f.phone} onChange={set("phone")} disabled={busy} aria-invalid={!!errs.phone} aria-describedby="phone-help" />
              </div>
              <p id="phone-help" className={errs.phone ? "field-error" : "muted text-[13px]"}>{errs.phone ?? "Used for event updates and to find you at the door."}</p>
            </div>
            <Input id="f-email" label="Email" tip="Your ticket is emailed here as a PDF once your payment is verified. Check the spelling, and look in spam if it doesn't arrive." type="email" err={errs.email} value={f.email} onChange={set("email")} disabled={busy} autoComplete="email" placeholder="you@example.com" />
            <Input id="f-ig" label="Instagram handle" tip="Your Instagram username, with or without the @. A link to your profile also works." err={errs.instagram} value={f.instagram} onChange={set("instagram")} disabled={busy} autoComplete="off" autoCapitalize="none" placeholder="@yourhandle" />
          </div>
        </section>

        <section aria-labelledby="h-sum" className="mt-8">
          <h2 id="h-sum" className="label flex items-center gap-1.5">Order summary<Tip text="Nothing is charged on this page. Next you will pay by UPI in your own app, then send us the proof." /></h2>
          <div className="card tnum mt-3 flex flex-col gap-3 p-5">
            <div className="flex justify-between gap-4"><span>{pass.name} × {qty}</span><span>{paise(money.sub)}</span></div>
            {pass.feePaise > 0 && <div className="muted flex justify-between gap-4"><span className="inline-flex items-center gap-1.5">Processing fee<Tip text="A small extra charge per pass. It is already included in the total below, so the price you see is the price you pay." /></span><span>{paise(money.fee)}</span></div>}
            <div className="h-px bg-line" />
            <div className="flex items-baseline justify-between gap-4"><span className="font-semibold">Total (INR)</span><span className="text-2xl font-semibold">{paise(money.total)}</span></div>
          </div>
        </section>

        <div className="mt-6">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--blood)]" checked={accepted} disabled={busy}
              onChange={(ev) => { setAccepted(ev.target.checked); setErrs((x) => ({ ...x, accepted: undefined })); }} aria-invalid={!!errs.accepted} />
            <span>
              I agree to the <Link href="/terms" target="_blank" className="border-b border-blood">Terms</Link> and <Link href="/privacy" target="_blank" className="border-b border-blood">Privacy Policy</Link>, including that tickets are non-refundable.
            </span>
          </label>
          {errs.accepted && <p className="field-error mt-1" role="alert">{errs.accepted}</p>}
        </div>

        {message && (
          <p role="alert" className="mt-4 rounded-sm border border-danger p-3 text-sm">{message}</p>
        )}

        <button type="submit" className="btn btn-primary btn-calm btn-block mt-4" disabled={busy} aria-busy={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {label}
        </button>
        <p className="muted mt-3 text-center text-[13px]">Next: pay by UPI, then upload your payment proof. All prices in INR.</p>
      </form>

      <div className="muted mt-7 border-t border-line pt-5 text-sm">
        <p><span className="text-fg">What happens next.</span> You pay by UPI and send us the UTR and a screenshot. We verify it by hand, then email your ticket as a PDF. Need help? WhatsApp {e.organiser.whatsapp}.</p>
      </div>
    </div>
  );
}

function Input({ id, label, err, tip, ...p }: { id: string; label: string; err?: string; tip?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">{label}{tip && <Tip text={tip} />}</label>
      <input id={id} className="field" aria-invalid={!!err} aria-describedby={err ? `${id}-e` : undefined} {...p} />
      {err && <p id={`${id}-e`} className="field-error">{err}</p>}
    </div>
  );
}
