import { eventConfig, isPlaceholder } from "@/config/event";

/** wa.me link, or null while the WhatsApp number is still a placeholder. */
export function whatsappLink(text?: string): string | null {
  const w = eventConfig.organiser.whatsapp;
  if (isPlaceholder(w)) return null;
  const digits = w.replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
}
