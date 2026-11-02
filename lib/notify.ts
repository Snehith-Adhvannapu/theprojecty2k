// Emails the organiser the moment a buyer submits a payment. The link opens that payment in /admin.
// Best effort, never blocks or fails the buyer. No phone numbers, no tokens, never the full UTR.
//   ADMIN_NOTIFY_EMAIL   who gets it (defaults to the organiser email)
import { eventConfig } from "@/config/event";
import { query } from "@/lib/db";
import { sendAdminAlert } from "@/lib/email";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function notifyNewPayment(orderId: string): Promise<void> {
  try {
    const [o] = await query("SELECT buyer_name, amount_paise, utr FROM orders WHERE id = $1", [orderId]);
    if (!o) return;
    const first = String(o.buyer_name).trim().split(/\s+/)[0];
    const rupees = (o.amount_paise / 100).toLocaleString("en-IN");
    const [{ n }] = await query("SELECT count(*)::int AS n FROM orders WHERE status = 'awaiting_review'");
    await sendAdminAlert(process.env.ADMIN_NOTIFY_EMAIL || eventConfig.organiser.email, {
      subject: `Y2K: payment to verify (Rs ${rupees})`,
      lines: [`${first} paid Rs ${rupees}.`, `UTR ending ${String(o.utr ?? "").slice(-4)}.`, `${n} payment${n === 1 ? "" : "s"} waiting for review.`],
      link: `${appUrl()}/admin?tab=payments&order=${orderId}`,
    });
  } catch { /* best effort */ }
}
