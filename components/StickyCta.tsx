"use client";
// Phones only: a bar pinned to the bottom of the screen so "Get passes" is always one tap away, with the real
// lowest price and seats left. It steps aside once the passes section is on screen.
import { useEffect, useState } from "react";
import { paise } from "@/lib/normalize";

interface Pass { pricePaise: number; available: number; onSale: boolean }

export function StickyCta() {
  const [hide, setHide] = useState(false);
  const [info, setInfo] = useState<{ from: number; left: number } | null>(null);

  useEffect(() => {
    const target = document.getElementById("passes");
    if (!target) return;
    const io = new IntersectionObserver(([en]) => setHide(en.isIntersecting), { threshold: 0.12 });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/event").then((r) => r.json()).then((j) => {
      const live = ((j.data?.passes ?? []) as Pass[]).filter((p) => p.onSale && p.available > 0);
      if (live.length) setInfo({ from: Math.min(...live.map((p) => p.pricePaise)), left: live.reduce((n, p) => n + p.available, 0) });
    }).catch(() => { /* the button works without the numbers */ });
  }, []);

  return (
    <div aria-hidden={hide} className={`sticky-cta fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden ${hide ? "sticky-cta-off" : ""}`}>
      <div className="mx-auto flex max-w-[520px] items-center justify-between gap-3">
        <p className="min-w-0 text-[13px] leading-tight">
          {info ? (
            <>
              <span className="block text-muted">From</span>
              <span className="tnum text-[19px] font-semibold">{paise(info.from)}</span>
              {info.left <= 60 && <span className="ml-2 text-crimson">{info.left} left</span>}
            </>
          ) : <span className="text-muted">Limited passes</span>}
        </p>
        <a href="#passes" tabIndex={hide ? -1 : 0} className="btn btn-primary min-h-12 shrink-0 px-6">Get passes <span className="arrow" aria-hidden="true">→</span></a>
      </div>
    </div>
  );
}
