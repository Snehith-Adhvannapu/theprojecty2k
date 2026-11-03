"use client";
// A small "?" that explains something in plain words. Works with a mouse (hover), a keyboard (focus) and a phone (tap).
// Closes on Escape, on tapping elsewhere, and when focus leaves. The popover stays inside the screen edges.
import { useEffect, useId, useRef, useState } from "react";

export function Tip({ text, label = "What is this?", className = "" }: { text: string; label?: string; className?: string }) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    if (!open) return;
    const close = (ev: Event) => { if (!root.current?.contains(ev.target as Node)) setOpen(false); };
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  // Keep the popover 8px inside the viewport on narrow screens.
  useEffect(() => {
    if (!open || !pop.current) return;
    const r = pop.current.getBoundingClientRect();
    const w = document.documentElement.clientWidth;
    const base = r.left - shift;
    setShift(base < 8 ? 8 - base : base + r.width > w - 8 ? w - 8 - (base + r.width) : 0);
  }, [open, shift]);

  return (
    <span ref={root} className={`relative inline-flex align-middle ${className}`}
      onPointerEnter={(ev) => { if (ev.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={(ev) => { if (ev.pointerType === "mouse") setOpen(false); }}
      onBlur={(ev) => { if (!root.current?.contains(ev.relatedTarget as Node)) setOpen(false); }}>
      <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setOpen((o) => !o); }}
        className="-m-3 inline-flex size-11 items-center justify-center">
        <span aria-hidden="true" className="muted inline-flex size-5 items-center justify-center rounded-full border border-line-strong text-[12px] font-semibold leading-none">?</span>
      </button>
      {open && (
        <span ref={pop} id={id} role="tooltip" style={{ transform: `translateX(${shift}px)` }}
          className="absolute left-0 top-full z-40 mt-2 block w-[min(18rem,calc(100vw-2rem))] rounded-sm border border-line-strong bg-bg p-3 text-left text-[13px] font-normal normal-case leading-snug tracking-normal text-fg">
          {text}
        </span>
      )}
    </span>
  );
}

/** A label followed by its tip, on one line. */
export function WithTip({ children, tip, label }: { children: React.ReactNode; tip: string; label?: string }) {
  return <span className="inline-flex items-center gap-1.5">{children}<Tip text={tip} label={label} /></span>;
}
