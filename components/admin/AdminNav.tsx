"use client";
// The admin menu. Desktop: a left sidebar that collapses to an icon rail. Phone: a top bar with a menu button that opens the
// same list as a drawer. Work that is waiting on a person (payments to verify, refunds to send) shows a red number on the
// item and a pill in the page header, so it is never more than one tap away.
import { useEffect } from "react";
import { Logo } from "@/components/Logo";

export interface NavItem { id: string; label: string; icon: string }
export interface NavGroup { title: string; items: NavItem[] }

// 24px stroke icons, one path string each.
const ICONS: Record<string, string> = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  undo: "M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
  ticket: "M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V6H3zM14 6v12",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
  chat: "M4 5h16v11H9l-5 4z",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 3 6",
  text: "M5 6h14M5 12h14M5 18h9",
  tool: "M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2zM14 6l3-2",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  panel: "M4 5h16v14H4zM9 5v14",
  out: "M10 5H5v14h5M15 8l4 4-4 4M19 12H9",
  play: "M8 5v14l11-7z",
};

export function Icon({ n, className = "size-5" }: { n: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[n] ?? ""} />
    </svg>
  );
}

const Count = ({ n, dot }: { n: number; dot?: boolean }) => dot
  ? <span aria-hidden="true" className="absolute right-2 top-2 size-2.5 rounded-full bg-crimson" />
  : <span aria-hidden="true" className="tnum ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-crimson px-1.5 text-[12px] font-semibold leading-none text-fg">{n > 99 ? "99+" : n}</span>;

function NavList({ groups, tab, badge, collapsed, pick }: { groups: NavGroup[]; tab: string; badge: Record<string, number>; collapsed: boolean; pick: (id: string) => void }) {
  return (
    <nav data-tour="nav" aria-label="Admin sections" className="flex-1 overflow-y-auto px-2 py-3">
      {groups.map((g, gi) => (
        <div key={g.title} className={gi > 0 ? "mt-4" : ""}>
          {collapsed ? (gi > 0 && <div className="mx-3 mb-2 h-px bg-line" />) : <p className="label px-3 pb-1.5">{g.title}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const n = badge[it.id] ?? 0;
              const on = tab === it.id;
              return (
                <li key={it.id}>
                  <button data-tour={`tab-${it.id}`} onClick={() => pick(it.id)} aria-current={on ? "page" : undefined} title={collapsed ? it.label : undefined}
                    aria-label={n > 0 ? `${it.label}, ${n} ${it.id === "Payments" ? "to verify" : "need action"}` : undefined}
                    className={`relative flex min-h-11 w-full items-center gap-3 rounded-sm border-l-2 px-3 text-left text-[15px] lg:min-h-10 transition-colors ${collapsed ? "justify-center" : ""} ${on ? "border-crimson bg-[var(--selected)] text-fg" : "muted border-transparent hover:bg-[var(--selected)] hover:text-fg"}`}>
                    <Icon n={it.icon} />
                    {!collapsed && <span className="truncate">{it.label}</span>}
                    {n > 0 && <Count n={n} dot={collapsed} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Footer({ name, collapsed, onTour }: { name: string; collapsed: boolean; onTour: () => void }) {
  const row = `flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-[15px] hover:bg-[var(--selected)] lg:min-h-9 ${collapsed ? "justify-center" : ""}`;
  return (
    <div className="border-t border-line px-2 py-2">
      <div data-tour="hdr-links">
        {!collapsed && <p className="muted truncate px-3 pb-1 pt-1 text-[13px]">{name}</p>}
        <button className={row} onClick={onTour} title={collapsed ? "Tour" : undefined}><Icon n="play" className="size-5 text-crimson" />{!collapsed && "Take the tour"}</button>
        <a href="/scan" className={row} title={collapsed ? "Scanner" : undefined}><Icon n="scan" />{!collapsed && "Scanner"}</a>
        <button className={`${row} muted`} title={collapsed ? "Sign out" : undefined}
          onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}><Icon n="out" />{!collapsed && "Sign out"}</button>
      </div>
    </div>
  );
}

export function AdminNav({ groups, tab, setTab, badge, name, collapsed, setCollapsed, open, setOpen, onTour }: {
  groups: NavGroup[]; tab: string; setTab: (id: string) => void; badge: Record<string, number>; name: string;
  collapsed: boolean; setCollapsed: (v: boolean) => void; open: boolean; setOpen: (v: boolean) => void; onTour: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, setOpen]);

  return (
    <>
      <aside aria-label="Admin menu" className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg lg:flex ${collapsed ? "w-[68px]" : "w-[248px]"}`} style={{ transition: "width 0.25s var(--ease-out)" }}>
        <div className={`flex h-14 shrink-0 items-center border-b border-line ${collapsed ? "justify-center" : "justify-between pl-4 pr-2"}`}>
          {!collapsed && <span className="flex items-center gap-3"><Logo size={36} /><span className="label">Admin</span></span>}
          <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand menu" : "Collapse menu"}
            className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-[var(--selected)]"><Icon n="panel" /></button>
        </div>
        <NavList groups={groups} tab={tab} badge={badge} collapsed={collapsed} pick={setTab} />
        <Footer name={name} collapsed={collapsed} onTour={onTour} />
      </aside>

      {open && (
        <div className="lg:hidden">
          <button aria-label="Close menu" className="fixed inset-0 z-30 bg-bg/80" onClick={() => setOpen(false)} />
          <aside aria-label="Admin menu" className="drawer-in fixed inset-y-0 left-0 z-40 flex w-[min(300px,86vw)] flex-col border-r border-line-strong bg-bg">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="flex items-center gap-3"><Logo size={36} /><span className="label">Admin</span></span>
              <button aria-label="Close menu" className="inline-flex size-11 items-center justify-center rounded-sm hover:bg-[var(--selected)]" onClick={() => setOpen(false)}><Icon n="close" /></button>
            </div>
            <NavList groups={groups} tab={tab} badge={badge} collapsed={false} pick={(id) => { setTab(id); setOpen(false); }} />
            <Footer name={name} collapsed={false} onTour={() => { setOpen(false); onTour(); }} />
          </aside>
        </div>
      )}
    </>
  );
}
