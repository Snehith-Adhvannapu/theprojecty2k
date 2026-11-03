"use client";
// Manual UPI payment step: pay, then submit the UTR and a screenshot. Nothing here confirms a
// payment; an admin does, after checking the bank statement.
import { useEffect, useRef, useState } from "react";
import { eventConfig as e } from "@/config/event";
import { paise } from "@/lib/normalize";
import { HelpWhatsApp } from "./HelpWhatsApp";
import { Tip } from "@/components/Tip";

const MAX_SIDE = 1100;
const MAX_BYTES = 1_400_000;

/** Shrinks a phone screenshot to a few hundred KB in the browser. Falls back to the raw file if it's already small. */
async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= MAX_BYTES) return blob;
    }
  } catch { /* fall through to the raw file */ }
  if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= MAX_BYTES) return file;
  throw new Error("Couldn't read that image. Take a normal screenshot (JPG or PNG) and try again.");
}

function UpiQR({ link }: { link: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then(async (QR) => {
      const s = await QR.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#0000" } });
      if (live) setSvg(s.replace(/#000000/g, "currentColor"));
    });
    return () => { live = false; };
  }, [link]);
  return (
    <div className="rounded-sm bg-fg p-3.5 text-bg" style={{ width: 200, height: 200 }}>
      {svg ? <div role="img" aria-label="UPI payment QR code" style={{ width: 172, height: 172 }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="172" height="172" ') }} />
        : <div className="skeleton" style={{ width: 172, height: 172 }} aria-busy="true" />}
    </div>
  );
}

type Phase = "idle" | "loading" | "error" | "done";

export function PaymentProof({ orderId, amountPaise, expiresAt, note, onSubmitted }: {
  orderId: string; amountPaise: number; expiresAt: string; note: string | null; onSubmitted: () => void;
}) {
  const { upiId, payeeName } = e.payment;
  const amount = (amountPaise / 100).toFixed(2);
  const ref = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Y2K ${ref}`)}`;

  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const packed = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setLeft(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  async function copy() {
    try { await navigator.clipboard.writeText(upiId); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* user can select the text */ }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (phase === "loading") return;
    setErr("");
    if (!/^\d{12}$/.test(utr.trim())) { setPhase("error"); setErr("Enter the 12-digit UTR / UPI reference number from your payment."); return; }
    if (!file) { setPhase("error"); setErr("Attach your payment screenshot."); return; }
    setPhase("loading");
    try {
      const blob = await (packed.current ?? compress(file));
      const form = new FormData();
      form.set("utr", utr.trim());
      form.set("proof", blob, "proof.jpg");
      const res = await fetch(`/api/orders/${orderId}/proof`, { method: "POST", body: form });
      const j = await res.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error?.message ?? "Upload failed. Check your connection and try again.");
      setPhase("done");
      onSubmitted();
    } catch (er) {
      setPhase("error");
      setErr(er instanceof Error ? er.message : "Upload failed. Please try again.");
    }
  }

  const busy = phase === "loading" || phase === "done";
  return (
    <div className="slide-up mt-6">
      <h1 className="text-[26px] leading-tight">Pay {paise(amountPaise)} by UPI</h1>
      <p className="muted mt-2 text-sm">Your pass is held for <span className="tnum text-fg">{left}</span>. Pay the exact amount, then send us the proof below.{" "}<Tip text={`We reserve your pass for ${e.limits.holdMinutes} minutes so nobody else takes it while you pay. If the time runs out, the pass goes back on sale. Already paid late? You can still send proof if passes are left, or tap Having trouble? at the bottom.`} /></p>

      {note && (
        <div role="alert" className="mt-4 rounded-sm border border-blood bg-[var(--selected)] p-4">
          <p className="font-semibold text-crimson">We couldn&apos;t confirm your payment yet</p>
          <p className="mt-1 text-[15px]">{note}.</p>
          <p className="muted mt-2 text-sm">Already paid? Send the correct 12-digit UTR and a clear screenshot below. Your pass is held while you fix it.</p>
        </div>
      )}

      <section className="card mt-5 p-5" aria-label="Payment details">
        <p className="label">Step 1 · Pay</p>
        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <UpiQR link={link} />
          <div className="w-full min-w-0 flex-1">
            <p className="muted text-[13px]">Pay to</p>
            <p className="text-lg font-semibold">{payeeName}</p>
            {e.payment.accountNote && <p className="muted text-[13px]">Your UPI app may show the account name as &ldquo;{e.payment.accountNote}&rdquo;. That is our collection account.</p>}
            <div className="mt-2 flex items-center gap-2">
              <code className="field flex !min-h-11 min-w-0 flex-1 items-center overflow-x-auto text-[15px]">{upiId}</code>
              <button type="button" className="btn btn-quiet btn-calm min-h-11 shrink-0 px-4 text-sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="tnum mt-3 text-2xl font-semibold">{paise(amountPaise)}</p>
            <p className="muted text-[13px]">Pay exactly this amount. Reference: {ref}{" "}<Tip text="Your order reference. Add it as the payment note if your UPI app allows. It helps us find your payment. It is not the UTR." /></p>
            <a href={link} className="btn btn-primary btn-calm btn-block mt-4 sm:hidden">Open my UPI app</a>
          </div>
        </div>
        <p className="muted mt-4 text-[13px]">On a phone, tap &ldquo;Open my UPI app&rdquo;. On a computer, scan the QR with any UPI app.</p>
        <details className="mt-4 border-t border-line pt-3">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm">QR not working? Use our merchant QR</summary>
          <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/merchant-qr.png" alt="Merchant UPI QR code" width={200} height={200} className="rounded-sm bg-white" />
            <p className="muted text-[13px]">Scan this in any UPI app, then <strong className="text-fg">type the amount yourself: {paise(amountPaise)}</strong>. Add the reference {ref} as the note if the app allows it. Your payment is matched by the UTR you enter below.</p>
          </div>
        </details>
      </section>

      <form onSubmit={submit} noValidate className="card mt-4 p-5" aria-label="Payment proof">
        <p className="label">Step 2 · Send proof</p>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="utr" className="flex items-center gap-1.5 text-sm font-medium">UTR / UPI reference number<Tip text="A 12-digit number your UPI app shows after you pay. Open the payment in your app and look for UTR, UPI Ref No. or Transaction ID. It is not your phone number or the order reference." /></label>
            <input id="utr" className="field tnum" inputMode="numeric" autoComplete="off" maxLength={12} placeholder="12 digits" value={utr}
              onChange={(ev) => { setUtr(ev.target.value.replace(/\D/g, "")); setErr(""); }} disabled={busy} aria-invalid={phase === "error" && !/^\d{12}$/.test(utr)} />
            <p className="muted text-[13px]">Find it in your UPI app under the payment details (it may be called UTR, UPI Ref No. or Transaction ID).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium" id="shot-l">Payment screenshot<Tip text="A screenshot of the payment success screen in your UPI app. It should clearly show the amount, the date and the UTR." /></span>
            <input ref={input} type="file" accept="image/*" className="sr-only" aria-labelledby="shot-l" tabIndex={-1}
              onChange={(ev) => { const f = ev.target.files?.[0] ?? null; setFile(f); setErr(""); packed.current = f ? compress(f) : null; packed.current?.catch(() => {}); }} disabled={busy} />
            <button type="button" className="btn btn-quiet btn-calm min-h-12 justify-center" onClick={() => input.current?.click()} disabled={busy} aria-describedby="shot-l">
              {file ? "Change screenshot" : "Choose screenshot"}
            </button>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your payment screenshot" className="mt-1 max-h-64 w-full rounded-sm border border-line object-contain" />
            )}
          </div>
        </div>
        {err && <p role="alert" className="mt-4 rounded-sm border border-danger p-3 text-sm">{err}</p>}
        <button type="submit" className="btn btn-primary btn-calm btn-block mt-4" disabled={busy} aria-busy={phase === "loading"}>
          {phase === "loading" && <span className="spinner" aria-hidden="true" />}
          {phase === "loading" ? "Uploading…" : phase === "done" ? "Submitted" : phase === "error" ? "Try again · Submit proof" : "Submit proof"}
        </button>
        <p className="muted mt-3 text-center text-[13px]">We check every payment by hand against our bank account. Your ticket is emailed as a PDF once it&apos;s confirmed.</p>
      </form>
      <HelpWhatsApp orderId={orderId} amountPaise={amountPaise} />
    </div>
  );
}
