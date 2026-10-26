"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { eventConfig as e } from "@/config/event";
import { normalizeEmail, normalizeInstagram, normalizePhone, paise } from "@/lib/normalize";

interface Pass {
  id: string; name: string; description: string; pricePaise: number; feePaise: number;
  admits: number; available: number; onSale: boolean;
}
type Phase = "idle" | "starting" | "paying" | "error";
type Fields = { name: string; phone: string; email: string; instagram: string };

const STORE = "y2k:checkout";
declare global {
  interface Window {
    Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(ev: string, cb: () => void): void };
  }
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js"; // only loaded here, only when paying
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

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
  const [fake, setFake] = useState<{ orderId: string } | null>(null);
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

  const busy = phase === "starting" || phase === "paying";
  const set = (k: keyof Fields) => (ev: React.ChangeEvent<HTMLInputElement>) => {
    setF((cur) => ({ ...cur, [k]: ev.target.value }));
    if (errs[k]) setErrs((x) => ({ ...x, [k]: undefined }));
  };

  function validate() {
    const x: typeof errs = {};
    if (f.name.trim().length < 2) x.name = "Enter your full name";
    if (!normalizePhone(f.phone)) x.phone = "Enter a valid 10-digit mobile number";
    if (!/^\S+@\S+\.\S+$/.test(normalizeEmail(f.email))) x.email = "Enter a valid email address";
    if (f.instagram.trim() && !normalizeInstagram(f.instagram)) x.instagram = "That doesn't look like an Instagram handle";
    if (!accepted) x.accepted = "Please accept the terms and refund policy to continue";
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
        instagram: f.instagram || undefined, idempotencyKey: attempt.current.key, accepted: true,
      });
      const init = await post("/api/payments/initiate", { orderId: order.id });
      if (init.provider === "fake") {
        setFake({ orderId: order.id });
        setPhase("paying");
        return;
      }
      await loadRazorpay();
      const rz = new window.Razorpay!({
        key: init.keyId, amount: init.amountPaise, currency: "INR", name: e.name,
        description: `${pass.name} × ${qty}`, order_id: init.providerOrderId,
        prefill: { name: f.name, email: normalizeEmail(f.email), contact: normalizePhone(f.phone) ?? "" },
        theme: { color: "#b0161f" },
        // The handler never confirms anything: it only moves to the page that polls the server.
        handler: () => router.push(`/order/${order.id}`),
        modal: { ondismiss: () => setPhase("idle") },
      });
      rz.on("payment.failed", () => {
        setPhase("error");
        setMessage("The payment didn't go through. You haven't been charged for a ticket. Try again or use another method.");
      });
      setPhase("paying");
      rz.open();
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function fakePay(outcome: "success" | "fail") {
    if (!fake) return;
    setPhase("starting");
    try {
      await post("/api/payments/fake", { orderId: fake.orderId, outcome });
      if (outcome === "success") return router.push(`/order/${fake.orderId}`);
      setFake(null);
      setPhase("error");
      setMessage("Test payment failed (as chosen). Try again.");
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Test payment failed.");
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

  const label = phase === "starting" ? "Starting payment…" : phase === "paying" ? "Waiting for payment…" : phase === "error" ? `Try again · Pay ${paise(money.total)}` : `Pay ${paise(money.total)}`;

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
              <p className="muted mt-1 text-sm">Admits {pass.admits} · {paise(pass.pricePaise)} each</p>
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
            <Input id="f-name" label="Full name" err={errs.name} value={f.name} onChange={set("name")} disabled={busy} autoComplete="name" placeholder="As on your ID" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-phone" className="text-sm font-medium">Phone number</label>
              <div className="flex gap-2">
                <span className="field flex w-auto items-center text-muted">+91</span>
                <input id="f-phone" className="field min-w-0 flex-1" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile"
                  value={f.phone} onChange={set("phone")} disabled={busy} aria-invalid={!!errs.phone} aria-describedby="phone-help" />
              </div>
              <p id="phone-help" className={errs.phone ? "field-error" : "muted text-[13px]"}>{errs.phone ?? "Used for event updates and to find you at the door."}</p>
            </div>
            <Input id="f-email" label="Email" type="email" err={errs.email} value={f.email} onChange={set("email")} disabled={busy} autoComplete="email" placeholder="you@example.com" />
            <Input id="f-ig" label="Instagram handle (optional)" err={errs.instagram} value={f.instagram} onChange={set("instagram")} disabled={busy} autoComplete="off" autoCapitalize="none" placeholder="@yourhandle" />
          </div>
        </section>

        <section aria-labelledby="h-sum" className="mt-8">
          <h2 id="h-sum" className="label">Order summary</h2>
          <div className="card tnum mt-3 flex flex-col gap-3 p-5">
            <div className="flex justify-between gap-4"><span>{pass.name} × {qty}</span><span>{paise(money.sub)}</span></div>
            {pass.feePaise > 0 && <div className="muted flex justify-between gap-4"><span>Processing fee</span><span>{paise(money.fee)}</span></div>}
            <div className="h-px bg-line" />
            <div className="flex items-baseline justify-between gap-4"><span className="font-semibold">Total (INR)</span><span className="text-2xl font-semibold">{paise(money.total)}</span></div>
          </div>
        </section>

        <div className="mt-6">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--blood)]" checked={accepted} disabled={busy}
              onChange={(ev) => { setAccepted(ev.target.checked); setErrs((x) => ({ ...x, accepted: undefined })); }} aria-invalid={!!errs.accepted} />
            <span>
              I agree to the <Link href="/terms" target="_blank" className="border-b border-blood">Terms</Link>,{" "}
              <Link href="/refunds" target="_blank" className="border-b border-blood">Refund &amp; cancellation policy</Link> and{" "}
              <Link href="/privacy" target="_blank" className="border-b border-blood">Privacy policy</Link>.
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
        <p className="muted mt-3 text-center text-[13px]">Secured by Razorpay. We never see your card or UPI PIN. All prices in INR.</p>
      </form>

      {fake && (
        <div role="dialog" aria-modal="true" aria-label="Test payment" className="fixed inset-0 z-40 flex items-end justify-center bg-bg/80 p-4 sm:items-center">
          <div className="card slide-up w-full max-w-[420px] p-6">
            <p className="label text-crimson">Test mode</p>
            <p className="mt-2 text-xl font-semibold">Pay {paise(money.total)}</p>
            <p className="muted mt-2 text-sm">No real money moves. This stands in for the Razorpay window until your keys are added.</p>
            <div className="mt-5 flex flex-col gap-3">
              <button className="btn btn-primary btn-calm btn-block" disabled={busy} onClick={() => fakePay("success")}>
                {busy && <span className="spinner" aria-hidden="true" />}Simulate successful payment
              </button>
              <button className="btn btn-quiet btn-calm btn-block" disabled={busy} onClick={() => fakePay("fail")}>Simulate failed payment</button>
              <button className="btn btn-quiet btn-calm btn-block" disabled={busy} onClick={() => { setFake(null); setPhase("idle"); }}>Close without paying</button>
            </div>
          </div>
        </div>
      )}

      <div className="muted mt-7 border-t border-line pt-5 text-sm">
        <p><span className="text-fg">What happens next.</span> Pay, and your ticket appears on the next screen once payment is confirmed. A copy is emailed. Paid but nothing showed up? WhatsApp {e.organiser.whatsapp}.</p>
      </div>
    </div>
  );
}

function Input({ id, label, err, ...p }: { id: string; label: string; err?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input id={id} className="field" aria-invalid={!!err} aria-describedby={err ? `${id}-e` : undefined} {...p} />
      {err && <p id={`${id}-e`} className="field-error">{err}</p>}
    </div>
  );
}
