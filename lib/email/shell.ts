// The shared Project Y2K email frame (dark card, logo, footer). Kept apart from the sender so it loads without the PDF code.
import { eventConfig } from "@/config/event";
import { appUrl } from "@/lib/app-url";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function shell(title: string, inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#f1eeea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#0c0c0c;border:1px solid #222">
<tr><td style="padding:24px 24px 8px"><img src="${appUrl()}/images/y2k26-logo.png" width="150" alt="${esc(eventConfig.name)}" style="display:block;border:0;height:auto"></td></tr>
<tr><td style="padding:0 24px 8px;font-size:26px;font-weight:700">${esc(title)}</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:16px;line-height:1.5">${inner}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #222;font-size:12px;color:#8e8e93">
Questions? ${esc(eventConfig.organiser.email)} · WhatsApp ${esc(eventConfig.organiser.whatsapp)}</td></tr>
</table></td></tr></table></body></html>`;
}
