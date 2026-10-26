"use client";
/** Admin fetch helper: JSON in/out, throws a readable Error, bounces to login on 401. */
export async function api<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401) { window.location.href = "/login?next=/admin"; throw new Error("Signed out"); }
  const j = await res.json().catch(() => null);
  if (!j?.ok) throw new Error(j?.error?.message ?? "Request failed");
  return j.data as T;
}
