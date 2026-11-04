// "Email update": one message from the organiser to a chosen group, in the Project Y2K look.
// The admin writes plain text. [name], [sold], [left] and [date] are filled in per person at send time.
import { eventConfig } from "@/config/event";
import { appUrl } from "@/lib/app-url";
import { query } from "@/lib/db";
import { audit } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { shell } from "@/lib/email/shell";

export type Audience = "holders" | "registered" | "not_bought";
export const MAX_RECIPIENTS = 2000;

export interface Recipient { email: string; name: string }
export interface Facts { sold: number; left: number }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Everyone in the group, once each (by lowercased email). */
export async function recipients(a: Audience): Promise<Recipient[]> {
  const holders = `SELECT lower(buyer_email) AS email, buyer_name AS name FROM orders WHERE status = 'paid' AND buyer_email IS NOT NULL
    UNION ALL SELECT lower(holder_email), holder_name FROM tickets WHERE status <> 'revoked' AND holder_email IS NOT NULL`;
  const everyone = `SELECT lower(buyer_email) AS email, buyer_name AS name FROM orders WHERE buyer_email IS NOT NULL
    UNION ALL SELECT lower(holder_email), holder_name FROM tickets WHERE holder_email IS NOT NULL`;
  const rows = await query(
    a === "holders" ? holders
    : a === "registered" ? everyone
    : `SELECT email, name FROM (${everyone}) e WHERE email NOT IN (SELECT email FROM (${holders}) h)`,
  );
  const seen = new Map<string, Recipient>();
  for (const r of rows as { email: string | null; name: string | null }[]) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.set(email, { email, name: (r.name ?? "").trim() });
  }
  return [...seen.values()];
}

export async function facts(): Promise<Facts> {
  const { summary } = await import("@/lib/admin");
  const s = await summary();
  const c = s.counts as unknown as { sold: number; left: number };
  return { sold: c.sold, left: c.left };
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? "";

/** Fills the [placeholders]. A missing name reads "there" ("Hi there"). */
export function fill(text: string, who: { name: string }, f: Facts): string {
  return text
    .replace(/\[name\]/gi, firstName(who.name) || "there")
    .replace(/\[sold\]/gi, String(f.sold))
    .replace(/\[left\]/gi, String(f.left))
    .replace(/\[date\]/gi, eventConfig.dateLabel);
}

/** Plain text in, safe email HTML out: paragraphs, line breaks, **bold**, and links. Nothing the admin types can inject markup. */
export function bodyToHtml(text: string): string {
  const para = (p: string) => {
    let h = esc(p.trim());
    h = h.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#f1eeea;border-bottom:1px solid #e3302f;text-decoration:none">$1</a>');
    return `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${h.replace(/\n/g, "<br>")}</p>`;
  };
  return text.split(/\n{2,}/).filter((p) => p.trim()).map(para).join("");
}

export interface Draft { subject: string; body: string; button: boolean }

export function render(d: Draft, who: { name: string }, f: Facts): { subject: string; html: string; text: string } {
  const subject = fill(d.subject, who, f).replace(/[\r\n]+/g, " ").trim();
  const body = fill(d.body, who, f);
  const button = d.button
    ? `<p style="margin:8px 0 22px"><a href="${appUrl()}/#passes" style="display:inline-block;background:#e3302f;color:#fff;text-decoration:none;padding:14px 22px;font-weight:700;letter-spacing:1px">GET YOUR PASS</a></p>`
    : "";
  const inner = `<p style="margin:0 0 18px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#e3302f">${esc(eventConfig.dateLabel)} · ${esc(eventConfig.venue.name)}</p>
${bodyToHtml(body)}${button}
<p style="margin:22px 0 0;font-size:13px;color:#8e8e93">You are getting this because you registered for ${esc(eventConfig.name)}. Reply to this email if you would rather not hear from us.</p>`;
  return { subject, html: shell(subject, inner), text: `${body}\n\n${appUrl()}` };
}

/** Sends the draft to everyone in the group, 4 at a time. One bad address never stops the rest. */
export async function sendBroadcast(staffId: string, a: Audience, d: Draft) {
  const to = await recipients(a);
  if (!to.length) throw new AppError("NO_RECIPIENTS", "Nobody is in that group yet.", 400);
  if (to.length > MAX_RECIPIENTS) throw new AppError("TOO_MANY", `That is more than ${MAX_RECIPIENTS} people. Ask your developer.`, 400);
  const f = await facts();
  let sent = 0, failed = 0, i = 0;
  const worker = async () => {
    while (i < to.length) {
      const who = to[i++];
      try { const m = render(d, who, f); await (await import("@/lib/email")).sendMail({ to: who.email, ...m }); sent++; } catch { failed++; }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await audit(staffId, "email_update_sent", null, { audience: a, subject: d.subject.slice(0, 120), sent, failed });
  return { sent, failed };
}

export async function sendTest(staffId: string, email: string, name: string, d: Draft) {
  const f = await facts();
  const m = render(d, { name }, f);
  await (await import("@/lib/email")).sendMail({ to: email, ...m, subject: `[Test] ${m.subject}` });
  await audit(staffId, "email_update_test", null, { subject: d.subject.slice(0, 120) });
}
