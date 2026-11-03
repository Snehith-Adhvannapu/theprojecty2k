// WhatsApp messages sent to buyers when a payment can't be confirmed. Admins edit these presets in Payments.
// Client-safe: no database import. Placeholders: [name] [first name] [reason] [amount] [link] [order].
export const WA_KINDS = ["fix", "reject", "refund"] as const;
export type WaKind = (typeof WA_KINDS)[number];
export type WaTemplates = Record<WaKind, string>;

export const WA_LABEL: Record<WaKind, string> = {
  fix: "Ask to fix & resubmit",
  reject: "Reject, no money received",
  refund: "Reject & refund (money received)",
};

export const WA_DEFAULTS: WaTemplates = {
  fix: "Hi [name], this is Project Y2K. We couldn't confirm your payment of [amount]: [reason]. Your pass is still held for 2 hours. Please send the correct UTR and a clear screenshot here: [link]",
  reject: "Hi [name], this is Project Y2K. We couldn't confirm your payment of [amount] ([reason]), so your order has been closed. If you did pay, reply with your UTR and a screenshot and we'll look again.",
  refund: "Hi [name], this is Project Y2K. We're refunding your payment of [amount] in full. Please reply with your UPI ID or a screenshot of your UPI QR code and we'll send it right away.",
};

export const WA_PLACEHOLDERS = ["name", "first name", "reason", "amount", "link", "order"] as const;

export interface WaVars { name: string; amount: string; reason: string; link: string; order: string }

export function fillWa(t: string, v: WaVars) {
  const vals: Record<string, string> = { name: v.name, "first name": v.name.trim().split(/\s+/)[0] ?? v.name, reason: v.reason, amount: v.amount, link: v.link, order: v.order };
  return t.replace(/\[\s*([a-z ]+?)\s*\]/gi, (m, k: string) => vals[k.toLowerCase().replace(/\s+/g, " ")] ?? m);
}
