import { z } from "zod";

/** +91 E.164 for Indian mobiles. Returns null when it cannot be a valid mobile. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d]/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  else if (d.length === 13 && d.startsWith("091")) d = d.slice(3);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export const last4 = (e164: string) => e164.slice(-4);

export function maskPhone(e164: string) {
  return `+91 ••••• ••${e164.slice(-3)}`;
}

/** Strips @, URLs, trailing slashes/queries. Returns null for empty, undefined-safe. */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let h = raw.trim();
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^instagram\.com\//i, "");
  h = h.split(/[/?#]/)[0].replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export const paise = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
    .format(n / 100)
    .replace(/\.00$/, "");

export const phoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit mobile number" });
    return p ?? "";
  });

export const emailSchema = z
  .string()
  .trim()
  .max(120)
  .email("Enter a valid email address")
  .transform(normalizeEmail);

export const instagramSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const h = normalizeInstagram(v);
    if (!h) ctx.addIssue({ code: "custom", message: "That doesn't look like an Instagram handle" });
    return h;
  });

/** Instagram handle that must be given (checkout). Stripped of @ and URLs like the optional one. */
export const requiredInstagramSchema = z
  .string({ message: "Instagram handle is required" })
  .trim()
  .min(1, "Instagram handle is required")
  .max(120)
  .transform((v, ctx) => {
    const h = normalizeInstagram(v);
    if (!h) { ctx.addIssue({ code: "custom", message: "That doesn't look like an Instagram handle" }); return z.NEVER; }
    return h;
  });
