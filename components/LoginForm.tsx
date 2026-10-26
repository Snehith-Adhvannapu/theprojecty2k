"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [msg, setMsg] = useState("");

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await r.json();
      if (!j.ok) { setState("error"); setMsg(j.error?.message ?? "Couldn't sign in."); return; }
      setState("ok");
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.replace(safe ?? (j.data.role === "admin" ? "/admin" : "/scan"));
      router.refresh();
    } catch {
      setState("error");
      setMsg("No connection. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" type="email" className="field" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input id="password" type="password" className="field" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {msg && <p role="alert" className="rounded-sm border border-danger p-3 text-sm">{msg}</p>}
      <button className="btn btn-primary btn-calm btn-block" disabled={state === "loading" || state === "ok" || !email || !password}>
        {(state === "loading" || state === "ok") && <span className="spinner" aria-hidden="true" />}
        {state === "ok" ? "Signed in" : state === "loading" ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
