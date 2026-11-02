"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { savedOrders } from "@/lib/myOrders";
import { paise } from "@/lib/normalize";

interface Row { id: string; status: string; amountPaise: number; tickets: { token: string; shortCode: string; passName: string }[] }
const LABEL: Record<string, string> = {
  paid: "Ticket ready", awaiting_review: "Being verified", pending: "Payment needed",
  rejected: "Not confirmed", expired: "Expired", needs_refund: "Refund pending", refunded: "Refunded",
};

/** Orders made on this browser, with live status and a direct link to the ticket. */
export function MyOrders() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    const ids = savedOrders();
    if (!ids.length) { setRows([]); return; }
    Promise.all(ids.map(async (id) => {
      try {
        const r = await fetch(`/api/orders/${id}/status`, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        return j?.ok ? ({ id, ...j.data } as Row) : null;
      } catch { return null; }
    })).then((x) => setRows(x.filter((r): r is Row => !!r)));
  }, []);

  if (!rows?.length) return null;
  return (
    <section className="card mt-6 p-5" aria-label="Orders on this device">
      <p className="label">On this device</p>
      <ul className="mt-3 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="py-3 first:pt-0 last:pb-0">
            <Link href={`/order/${r.id}`} className="flex min-h-11 items-center justify-between gap-3">
              <span>
                <span className="block font-medium">{r.tickets[0]?.passName ?? "Order"} · {paise(r.amountPaise)}</span>
                <span className="muted block text-sm">{LABEL[r.status] ?? r.status}{r.tickets[0] ? ` · ${r.tickets.map((t) => t.shortCode).join(", ")}` : ""}</span>
              </span>
              <span className="border-b border-blood text-sm">{r.status === "paid" ? "View ticket" : "Open"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
