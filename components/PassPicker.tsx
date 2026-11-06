"use client";
// The landing page's only client island. Passes and live availability come from one
// edge-cached endpoint, so the page itself stays static (no DB on render).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { paise } from "@/lib/normalize";
import { Tip } from "@/components/Tip";

interface Pass {
  id: string; name: string; description: string; pricePaise: number; feePaise: number;
  admits: number; available: number; onSale: boolean;
}

export function PassPicker() {
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [error, setError] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  // Choosing a pass brings the Continue button into view, so nobody has to hunt for the next step.
  const choose = (id: string) => {
    setPicked(id);
    requestAnimationFrame(() => bar.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/event");
      const json = await res.json();
      if (!json.ok) throw new Error();
      setPasses(json.data.passes);
      setError(false);
      setPicked((cur) => cur ?? json.data.passes.find((p: Pass) => p.available > 0 && p.onSale)?.id ?? null);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !passes) {
    return (
      <div role="alert" className="card-plain mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
        <p>We couldn&apos;t load the passes. Check your connection and try again.</p>
        <button className="btn btn-quiet min-h-11" onClick={load}>Try again</button>
      </div>
    );
  }

  if (!passes) {
    return (
      <div className="mt-10 flex flex-wrap gap-4" aria-busy="true" aria-label="Loading passes">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-64 min-w-[280px] flex-1" />)}
      </div>
    );
  }

  if (passes.length === 0) {
    return <p className="card-plain muted mt-10 p-6">Passes go on sale soon. Follow us for the announcement.</p>;
  }

  const sel = passes.find((p) => p.id === picked);

  return (
    <>
      <div className="mt-10 flex flex-wrap gap-4">
        {passes.map((p) => {
          const soldOut = p.available <= 0;
          const disabled = soldOut || !p.onSale;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              aria-pressed={picked === p.id}
              onClick={() => choose(p.id)}
              className={`pass card-plain flex min-w-[280px] flex-1 basis-[280px] flex-col gap-3 p-7 text-left ${disabled ? "opacity-60" : ""}`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[28px] leading-[1.1]">{p.name}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-crimson">
                  {soldOut ? "Sold out" : !p.onSale ? "Not on sale" : p.available <= 20 ? `${p.available} left` : ""}
                </span>
              </span>
              <span className="label">Admits {p.admits}</span>
              <span className="muted">{p.description}</span>
              <span className="price mt-2 text-[56px]">{paise(p.pricePaise)}</span>
              {p.feePaise > 0 && <span className="muted -mt-2 text-sm">+ {paise(p.feePaise)} fee, shown again at checkout</span>}
              <span className="btn mt-2 pointer-events-none self-start">{picked === p.id ? "Selected" : disabled ? "Unavailable" : "Select"}</span>
            </button>
          );
        })}
      </div>

      <div ref={bar} className="card-plain mt-6 flex scroll-mb-24 flex-wrap items-center justify-between gap-4 px-6 py-5" aria-live="polite">
        <p>
          {sel ? (
            <>
              Selected: <strong className="font-semibold">{sel.name}</strong> · Admits {sel.admits} · {paise(sel.pricePaise)}{" "}<Tip text="Admits shows how many people one ticket lets in. A couple pass is for 2 people, and each gets their own QR code. You choose how many tickets on the next page." />
            </>
          ) : (
            "Pick a pass to continue."
          )}
        </p>
        {sel ? (
          <Link href={`/checkout?pass=${sel.id}`} className="btn btn-primary">
            Continue to checkout <span className="arrow" aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="btn btn-primary" aria-disabled="true">Continue to checkout</span>
        )}
      </div>
    </>
  );
}
