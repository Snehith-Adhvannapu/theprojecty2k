// Tells the organiser a payment is waiting for review, the moment the buyer submits it.
// Best effort, optional channels, never blocks or fails the buyer. No full phone numbers, no tokens.
//   ADMIN_NOTIFY_EMAIL            email via Resend (defaults to the organiser email)
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID   instant Telegram message (free)
//   CALLMEBOT_PHONE + CALLMEBOT_APIKEY      WhatsApp via CallMeBot (free, unofficial, one number)
import { eventConfig } from "@/config/event";
import { query } from "@/lib/db";
import { sendAdminAlert } from "@/lib/email";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const timeout = () => AbortSignal.timeout(4000);

async function viaTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }), signal: timeout(),
  });
}

async function viaCallMeBot(text: string) {
  const phone = process.env.CALLMEBOT_PHONE, key = process.env.CALLMEBOT_APIKEY;
  if (!phone || !key) return;
  const u = new URL("https://api.callmebot.com/whatsapp.php");
  u.search = new URLSearchParams({ phone: phone.replace(/\D/g, ""), text, apikey: key }).toString();
  await fetch(u, { signal: timeout() });
}

export async function notifyAdmins(subject: string, text: string): Promise<void> {
  await Promise.allSettled([
    sendAdminAlert(process.env.ADMIN_NOTIFY_EMAIL || eventConfig.organiser.email, subject, text),
    viaTelegram(`${subject}\n${text}`),
    viaCallMeBot(`${subject}\n${text}`),
  ]);
}

export async function notifyNewPayment(orderId: string): Promise<void> {
  const [o] = await query("SELECT buyer_name, amount_paise, utr FROM orders WHERE id = $1", [orderId]);
  if (!o) return;
  const first = String(o.buyer_name).trim().split(/\s+/)[0];
  const rupees = (o.amount_paise / 100).toLocaleString("en-IN");
  const [{ n }] = await query("SELECT count(*)::int AS n FROM orders WHERE status = 'awaiting_review'");
  await notifyAdmins(
    `Y2K: payment to verify (Rs ${rupees})`,
    `${first} paid Rs ${rupees}, UTR ending ${String(o.utr ?? "").slice(-4)}. ${n} waiting for review.\nApprove or reject: ${appUrl()}/admin`,
  );
}
