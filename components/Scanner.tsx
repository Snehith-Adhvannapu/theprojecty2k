"use client";
// Door scanner. Four fixed, unmistakable states: green admit, red reject, amber no
// connection (never red or green, and nobody is admitted), blue is reserved for offline
// local mode. The server decides every scan; the browser only displays the verdict.
import { useCallback, useEffect, useRef, useState } from "react";
import { formatTimeIST } from "@/lib/time";

type Verdict =
  | { kind: "admit"; name: string; pass: string; admits: number }
  | { kind: "reject"; title: string; reason: string; detail?: string; name?: string }
  | { kind: "amber" };

interface Guest { id: string; name: string; passName: string; admits: number; shortCode: string; status: string; phoneLast4: string; usedAt: string | null }
interface ScanResp {
  outcome: "admitted" | "duplicate" | "invalid" | "revoked";
  reason?: string;
  ticket?: { name: string; passName: string; admits: number; usedAt?: string; usedBy?: string };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toVerdict(r: ScanResp): Verdict {
  const t = r.ticket;
  if (r.outcome === "admitted" && t) return { kind: "admit", name: t.name, pass: t.passName, admits: t.admits };
  if (r.outcome === "duplicate") {
    return { kind: "reject", title: "DO NOT ADMIT", reason: "ALREADY USED", name: t?.name,
      detail: t?.usedAt ? `at ${formatTimeIST(t.usedAt)}${t.usedBy ? ` by ${t.usedBy}` : ""}` : undefined };
  }
  if (r.outcome === "revoked") return { kind: "reject", title: "DO NOT ADMIT", reason: "REFUNDED OR CANCELLED", name: t?.name };
  return { kind: "reject", title: "DO NOT ADMIT", reason: r.reason === "bad_code" ? "CODE NOT RECOGNISED" : "NOT A VALID TICKET",
    detail: r.reason === "bad_code" ? "Check the code and try again." : undefined };
}

export function Scanner({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop(): void; destroy(): void; hasFlash(): Promise<boolean>; toggleFlash(): Promise<void>; isFlashOn(): boolean } | null>(null);
  const wakeRef = useRef<{ release(): Promise<void> } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const busyRef = useRef(false);
  const cancelRef = useRef(false);
  const lastRef = useRef({ token: "", at: 0 });
  const dismissRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [started, setStarted] = useState(false);
  const [camError, setCamError] = useState("");
  const [online, setOnline] = useState(true);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [stats, setStats] = useState<{ checkedIn: number; expected: number } | null>(null);
  const [mode, setMode] = useState<"camera" | "lookup">("camera");
  const [flash, setFlash] = useState<"none" | "off" | "on">("none");

  const beep = useCallback((kind: "admit" | "reject" | "amber") => {
    try {
      const ctx = audioRef.current;
      if (ctx) {
        const seq = kind === "admit" ? [[880, 0.12]] : kind === "reject" ? [[220, 0.18], [180, 0.28]] : [[520, 0.1], [520, 0.1]];
        let t = ctx.currentTime;
        for (const [f, d] of seq) {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = f; o.type = kind === "admit" ? "sine" : "square";
          g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
          o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d); t += d + 0.04;
        }
      }
      navigator.vibrate?.(kind === "admit" ? 80 : kind === "reject" ? [200, 80, 200] : [60, 60, 60]);
    } catch { /* sound is a bonus, never a dependency */ }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const r = await fetch("/api/staff/stats", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setStats(j.data); setOnline(true); }
    } catch { setOnline(false); }
  }, []);

  const show = useCallback((v: Verdict) => {
    clearTimeout(dismissRef.current);
    setVerdict(v);
    beep(v.kind === "admit" ? "admit" : v.kind === "reject" ? "reject" : "amber");
    if (v.kind === "admit") dismissRef.current = setTimeout(() => setVerdict(null), 3000);
    if (v.kind === "reject") dismissRef.current = setTimeout(() => setVerdict(null), 8000);
  }, [beep]);

  const dismiss = useCallback(() => {
    clearTimeout(dismissRef.current);
    cancelRef.current = true;
    busyRef.current = false;
    setVerdict(null);
  }, []);

  /** Sends one scan. On any network/server failure: amber, never admitted, auto-retry with the same event id. */
  const submit = useCallback(async (body: { token?: string; shortCode?: string }, method: "qr" | "manual") => {
    if (busyRef.current) return;
    busyRef.current = true;
    cancelRef.current = false;
    const clientEventId = crypto.randomUUID();
    let attempts = 0;
    while (!cancelRef.current) {
      try {
        const res = await fetch("/api/scan", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, method, clientEventId }),
        });
        if (res.status === 401) { window.location.href = "/login?next=/scan"; return; }
        const j = await res.json();
        if (res.status >= 500) throw new Error("server");
        setOnline(true);
        if (!j.ok) { show({ kind: "reject", title: "DO NOT ADMIT", reason: "NOT A VALID TICKET", detail: j.error?.message }); }
        else { show(toVerdict(j.data)); if (j.data.outcome === "admitted") refreshStats(); }
        busyRef.current = false;
        return;
      } catch {
        setOnline(false);
        if (attempts++ === 0) show({ kind: "amber" });
        await wait(2000);
      }
    }
    busyRef.current = false;
  }, [show, refreshStats]);

  // Camera: library loaded only on this route, and only when the volunteer taps start.
  const start = useCallback(async () => {
    setCamError("");
    try {
      audioRef.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      await audioRef.current.resume();
    } catch { /* no audio: fine */ }
    setStarted(true);
  }, []);

  useEffect(() => {
    if (!started || mode !== "camera" || !videoRef.current) return;
    let dead = false;
    (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (dead || !videoRef.current) return;
        const s = new QrScanner(
          videoRef.current,
          (res) => {
            const token = res.data.trim();
            const now = Date.now();
            if (busyRef.current || !token) return;
            if (token === lastRef.current.token && now - lastRef.current.at < 4000) return;
            lastRef.current = { token, at: now };
            submit({ token }, "qr");
          },
          { preferredCamera: "environment", maxScansPerSecond: 8, returnDetailedScanResult: true, highlightScanRegion: false, highlightCodeOutline: false },
        );
        scannerRef.current = s;
        await s.start();
        if (!dead) setFlash((await s.hasFlash().catch(() => false)) ? "off" : "none");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setCamError(/denied|permission|NotAllowed/i.test(msg)
          ? "Camera access is blocked. Allow the camera for this site in your browser settings, then reload."
          : "Couldn't start the camera. Use “Find guest” below, or reload and try again.");
        setStarted(false);
      }
    })();
    return () => { dead = true; scannerRef.current?.destroy(); scannerRef.current = null; setFlash("none"); };
  }, [started, mode, submit]);

  useEffect(() => {
    refreshStats();
    const t = setInterval(refreshStats, 15_000);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { clearInterval(t); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [refreshStats]);

  // Keep the screen awake while the camera is on; the browser drops the lock when the tab is hidden, so re-take it.
  useEffect(() => {
    if (!started) return;
    let dead = false;
    const take = async () => {
      try {
        const nav = navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
        const lock = await nav.wakeLock?.request("screen");
        if (lock) { if (dead) lock.release().catch(() => {}); else wakeRef.current = lock; }
      } catch { /* not supported or denied: the phone may dim, nothing breaks */ }
    };
    take();
    const vis = () => { if (document.visibilityState === "visible") take(); };
    document.addEventListener("visibilitychange", vis);
    return () => { dead = true; document.removeEventListener("visibilitychange", vis); wakeRef.current?.release().catch(() => {}); wakeRef.current = null; };
  }, [started]);

  async function toggleTorch() {
    try { await scannerRef.current?.toggleFlash(); setFlash(scannerRef.current?.isFlashOn() ? "on" : "off"); } catch { /* ignore */ }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div className="calm flex h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-1 text-[13px]">
        <span className="inline-flex items-center gap-2" role="status">
          <span className="size-2 rounded-full" style={{ background: online ? "var(--state-online-dot)" : "var(--state-offline-bg)" }} aria-hidden="true" />
          {online ? "Online" : "No connection"}
        </span>
        <span className="muted flex items-center gap-3">
          <span className="max-w-[28vw] truncate">{name}</span>
          {isAdmin && <a href="/admin" className="inline-flex min-h-11 items-center border-b border-blood text-fg">Admin</a>}
          <button onClick={signOut} className="inline-flex min-h-11 items-center text-fg underline-offset-4 hover:underline">Sign out</button>
        </span>
      </header>

      {mode === "camera" ? (
        <>
          <div className="relative m-3.5 flex-1 overflow-hidden border border-line bg-card">
            <video ref={videoRef} playsInline muted className={`size-full object-cover ${started ? "" : "hidden"}`} />
            {["top-3 left-3 border-t-[3px] border-l-[3px]", "top-3 right-3 border-t-[3px] border-r-[3px]", "bottom-3 left-3 border-b-[3px] border-l-[3px]", "bottom-3 right-3 border-b-[3px] border-r-[3px]"].map((c) => (
              <span key={c} className={`pointer-events-none absolute size-7 border-crimson ${c}`} aria-hidden="true" />
            ))}
            {started && flash !== "none" && (
              <button onClick={toggleTorch} aria-pressed={flash === "on"} className="btn btn-calm absolute right-3 bottom-3 min-h-12 px-4 text-sm" style={{ background: "var(--bg)" }}>
                {flash === "on" ? "Torch off" : "Torch on"}
              </button>
            )}
            {!started && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="muted">{camError || "Point the camera at the guest's QR code."}</p>
                <button className="btn btn-primary btn-calm min-h-14 px-8" onClick={start}>{camError ? "Try again" : "Start camera"}</button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 px-3.5 pb-4">
            <button className="btn btn-calm min-h-[52px] text-[15px]" onClick={() => setMode("lookup")}>Find guest by name or code</button>
            <p className="muted text-center text-[13px] tnum" aria-live="polite">
              {stats ? `Checked in ${stats.checkedIn} of ${stats.expected}` : "Loading count…"}
            </p>
          </div>
        </>
      ) : (
        <Lookup onBack={() => setMode("camera")} onAdmit={(g) => submit({ shortCode: g.shortCode }, "manual")} />
      )}

      {verdict && <StateScreen v={verdict} onDismiss={dismiss} />}
    </div>
  );
}

function Lookup({ onBack, onAdmit }: { onBack: () => void; onAdmit: (g: Guest) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Guest[] | null>(null);
  const [err, setErr] = useState("");
  const [sure, setSure] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) { setRows(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/staff/lookup?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const j = await r.json();
        if (j.ok) { setRows(j.data); setErr(""); } else setErr(j.error?.message ?? "Search failed");
      } catch { setErr("No connection. Check signal and try again."); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-1 text-[13px]">
        <span className="font-semibold">Find guest</span>
        <button onClick={onBack} className="muted inline-flex min-h-11 items-center">← Camera</button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5">
        <label htmlFor="s-q" className="muted text-[13px]">Name, phone last 4, or short code</label>
        <input id="s-q" className="field" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Y2K-XXXXXX" autoCapitalize="none" autoComplete="off" />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        {rows?.length === 0 && <p className="muted text-sm">No guest found. Check the spelling, or try the last 4 digits of their phone.</p>}
        {rows?.map((g) => {
          const valid = g.status === "valid";
          return (
            <div key={g.id} className={`card-plain flex flex-col gap-1.5 p-3.5 ${valid ? "" : "opacity-80"}`}>
              <p className="text-base font-semibold">{g.name}</p>
              <p className="muted text-[13px] tnum">{g.shortCode} · {g.passName} · Admits {g.admits} · …{g.phoneLast4}</p>
              {valid ? (
                sure === g.id ? (
                <div className="mt-1.5 flex gap-2">
                  <button className="btn btn-primary btn-calm min-h-[52px] flex-[2] text-[15px]" onClick={() => { setSure(""); onAdmit(g); }}>Yes, admit {g.admits > 1 ? `${g.admits} people` : "1 person"}</button>
                  <button className="btn btn-quiet btn-calm min-h-[52px] flex-1 text-[15px]" onClick={() => setSure("")}>Cancel</button>
                </div>
              ) : (
                <button className="btn btn-primary btn-calm mt-1.5 min-h-[52px] text-[15px]" onClick={() => setSure(g.id)}>ADMIT</button>
              )
              ) : (
                <p className="text-[13px] text-crimson">{g.status === "used" ? `Already used${g.usedAt ? ` at ${formatTimeIST(g.usedAt)}` : ""}` : "Cancelled / refunded: do not admit"}</p>
              )}
            </div>
          );
        })}
        <p className="muted text-[13px]">Match the name to their photo ID before admitting. Manual admits are logged with your name.</p>
      </div>
    </div>
  );
}

function Icon({ kind }: { kind: "check" | "cross" | "alert" }) {
  return (
    <svg className="glyph size-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "check" && <path d="M4.5 12.5l5 5L19.5 7" />}
      {kind === "cross" && <path d="M6 6l12 12M18 6L6 18" />}
      {kind === "alert" && <><path d="M12 5v9" /><path d="M12 19h.01" strokeWidth="3.4" /></>}
    </svg>
  );
}

function StateScreen({ v, onDismiss }: { v: Verdict; onDismiss: () => void }) {
  if (v.kind === "admit") {
    return (
      <button className="state state-admit" onClick={onDismiss} aria-live="assertive">
        <Icon kind="check" />
        <p className="big text-7xl">ADMIT</p>
        <p className="mt-2 text-[28px] font-extrabold leading-tight">{v.name}</p>
        <p className="text-[15px]">{v.pass}</p>
        <p className="big mt-3 text-[56px]">ADMITS {v.admits}</p>
        <p className="mt-4 text-[15px] font-semibold">Check the name on their photo ID</p>
        <p className="mt-1 text-[13px]">Back to camera in 3 sec · tap to skip</p>
      </button>
    );
  }
  if (v.kind === "reject") {
    return (
      <button className="state state-reject" onClick={onDismiss} aria-live="assertive">
        <Icon kind="cross" />
        <p className="big text-[64px]">{v.title}</p>
        <p className="mt-2 text-xl font-extrabold tracking-[0.08em]">{v.reason}</p>
        {v.detail && <p className="text-base">{v.detail}</p>}
        {v.name && <p className="mt-3 text-lg font-semibold">{v.name}</p>}
        <p className="mt-4 text-[13px]">Check their ID. Call the lead if unsure. Tap to continue.</p>
      </button>
    );
  }
  return (
    <div className="state state-offline" role="alert" aria-live="assertive">
      <Icon kind="alert" />
      <p className="big text-[60px]">NO CONNECTION</p>
      <p className="mt-2 text-lg font-extrabold">NOT ADMITTED YET</p>
      <p className="text-[15px]">Retrying… this is not a bad ticket.</p>
      <button onClick={onDismiss} className="btn btn-calm mt-4 min-h-[52px] px-6 text-[15px]" style={{ background: "var(--state-offline-fg)", color: "var(--state-offline-bg)", borderColor: "var(--state-offline-fg)" }}>
        Cancel and keep waiting
      </button>
    </div>
  );
}
