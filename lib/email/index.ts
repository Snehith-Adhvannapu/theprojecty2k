// Email via Resend. With no EMAIL_API_KEY the message is written to .data/emails/ as an
// HTML file (the console never sees ticket tokens). The ticket page is always the source
// of truth, so a failed email never loses a ticket: rows stay in email_outbox and retry.
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { eventConfig } from "@/config/event";
import { query } from "@/lib/db";
import { ticketsForOrder } from "@/lib/tickets";

const MAX_ATTEMPTS = 5;
const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string }[];
}

async function deliver(mail: Mail) {
  const key = process.env.EMAIL_API_KEY;
  if (!key) {
    const dir = path.join(process.cwd(), ".data", "emails");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${mail.to.replace(/[^a-z0-9]/gi, "_")}.html`);
    fs.writeFileSync(file, mail.html);
    console.log(`[email:dev] "${mail.subject}" -> ${mail.to.replace(/(.).*(@.*)/, "$1***$2")} saved to ${path.relative(process.cwd(), file)}`);
    return;
  }
  const from = process.env.EMAIL_FROM || "Project Y2K <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, attachments: mail.attachments }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`email provider ${res.status}`);
}

function shell(title: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#f1eeea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#0c0c0c;border:1px solid #222">
<tr><td style="padding:24px 24px 8px;font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#e3302f">${esc(eventConfig.name)}</td></tr>
<tr><td style="padding:0 24px 8px;font-size:26px;font-weight:700">${esc(title)}</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:16px;line-height:1.5">${inner}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #222;font-size:12px;color:#8e8e93">
Ticketing powered by <a href="${eventConfig.khelo.url}" style="color:#cbced2">${eventConfig.khelo.name}</a>.
Questions? ${esc(eventConfig.organiser.email)} · WhatsApp ${esc(eventConfig.organiser.whatsapp)}</td></tr>
</table></td></tr></table></body></html>`;
}

async function ticketMail(orderId: string, to: string): Promise<Mail> {
  const tickets = await ticketsForOrder({ query }, orderId);
  const attachments = await Promise.all(
    tickets.map(async (t) => ({
      filename: `${t.shortCode}.png`,
      content: (await QRCode.toBuffer(t.token, { width: 480, margin: 2 })).toString("base64"),
    })),
  );
  const blocks = tickets
    .map(
      (t) => `<div style="border:1px solid #222;padding:16px;margin:0 0 12px">
<div style="font-size:13px;color:#8e8e93">${esc(t.passName)} · ADMITS ${t.admits}</div>
<div style="font-size:28px;font-weight:700;letter-spacing:2px;margin:6px 0">${esc(t.shortCode)}</div>
<a href="${appUrl()}/t/${t.token}" style="display:inline-block;background:#e3302f;color:#fff;text-decoration:none;padding:12px 18px;font-weight:700">Open ticket</a></div>`,
    )
    .join("");
  const inner = `<p>You're in. Your QR code is attached and also on the ticket page. If your phone has no signal at the door, show the short code below.</p>
${blocks}
<p style="font-size:14px;color:#cbced2">${esc(eventConfig.dateLabel)} · Doors ${esc(eventConfig.doorsOpen)}<br>${esc(eventConfig.venue.name)}, ${esc(eventConfig.venue.address)}<br>Carry a valid government photo ID.</p>`;
  const text = `Your ${eventConfig.name} ticket${tickets.length > 1 ? "s" : ""}:\n` +
    tickets.map((t) => `${t.shortCode} (${t.passName}, admits ${t.admits}) ${appUrl()}/t/${t.token}`).join("\n");
  return { to, subject: `Your ${eventConfig.name} ticket`, html: shell("Your ticket", inner), text, attachments };
}

function refundMail(to: string): Mail {
  const inner = `<p>We received your payment, but the pass sold out before it could be confirmed. You will get a full refund to your original payment method. Nothing more is needed from you.</p>
<p>Questions? WhatsApp ${esc(eventConfig.organiser.whatsapp)} or email ${esc(eventConfig.organiser.email)}.</p>`;
  return { to, subject: `${eventConfig.name}: refund on its way`, html: shell("Your payment will be refunded", inner), text: "Your payment was received after the pass sold out. A full refund will be issued." };
}

/** Sends pending rows (all, or one order's). Never throws: failures are recorded and retried later. */
export async function flushOutbox(orderId?: string): Promise<void> {
  const rows = await query(
    `SELECT id, order_id, to_email, kind, attempts FROM email_outbox
      WHERE status = 'pending' AND attempts < $1 AND ($2::uuid IS NULL OR order_id = $2::uuid)
      ORDER BY created_at LIMIT 20`,
    [MAX_ATTEMPTS, orderId ?? null],
  );
  for (const r of rows) {
    try {
      const mail = r.kind === "needs_refund" ? refundMail(r.to_email) : await ticketMail(r.order_id, r.to_email);
      await deliver(mail);
      await query("UPDATE email_outbox SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1", [r.id]);
    } catch (e) {
      const failed = r.attempts + 1 >= MAX_ATTEMPTS;
      await query(
        "UPDATE email_outbox SET attempts = attempts + 1, last_error = $2, status = $3 WHERE id = $1",
        [r.id, e instanceof Error ? e.message.slice(0, 200) : "error", failed ? "failed" : "pending"],
      );
    }
  }
}

/** "Find my ticket": always behaves the same to the caller; at most 3 per address per hour. */
export async function sendFindMyTicket(email: string | null, phone: string | null): Promise<void> {
  const rows = await query(
    `SELECT DISTINCT o.id, o.buyer_email FROM orders o
      WHERE o.status = 'paid' AND (($1::text IS NOT NULL AND o.buyer_email = $1) OR ($2::text IS NOT NULL AND o.buyer_phone = $2))`,
    [email, phone],
  );
  const byEmail = new Map<string, string[]>();
  for (const r of rows) byEmail.set(r.buyer_email, [...(byEmail.get(r.buyer_email) ?? []), r.id]);
  for (const [to, orderIds] of byEmail) {
    const [{ n }] = await query(
      "SELECT count(*)::int AS n FROM email_outbox WHERE to_email = $1 AND kind = 'find' AND created_at > now() - interval '1 hour'",
      [to],
    );
    if (n >= 3) continue;
    await query("INSERT INTO email_outbox (to_email, kind, status) VALUES ($1,'find','sent')", [to]);
    try {
      const mails = await Promise.all(orderIds.map((id) => ticketMail(id, to)));
      await deliver({ ...mails[0], subject: `Your ${eventConfig.name} ticket link`,
        html: mails.map((m) => m.html).join("<hr>"), text: mails.map((m) => m.text).join("\n"),
        attachments: mails.flatMap((m) => m.attachments ?? []) });
    } catch {
      /* swallowed on purpose: response must not reveal whether anything matched */
    }
  }
}
