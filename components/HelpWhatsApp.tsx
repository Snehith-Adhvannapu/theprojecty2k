// "Having trouble?" for buyers: one tap opens WhatsApp to the organiser with the kind of trouble and the order reference filled in.
import { eventConfig as e } from "@/config/event";
import { paise } from "@/lib/normalize";

const ISSUES = [
  "I can't find my UTR number",
  "My payment failed or money was deducted",
  "The QR or my UPI app isn't working",
  "I paid but my hold ran out",
  "Something else",
];

export function HelpWhatsApp({ orderId, amountPaise }: { orderId: string; amountPaise: number }) {
  const ref = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const number = e.organiser.whatsapp.replace(/\D/g, "");
  const link = (issue: string) =>
    `https://wa.me/${number}?text=${encodeURIComponent(`Hi Project Y2K, I need help with my order ${ref} (${paise(amountPaise)}). Problem: ${issue}.`)}`;
  return (
    <section className="card-plain mt-4 p-5" aria-label="Help">
      <p className="text-base font-semibold">Having trouble?</p>
      <p className="muted mt-1 text-sm">Tell us what went wrong. It opens WhatsApp with your order reference filled in, and a real person replies.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {ISSUES.map((x) => (
          <li key={x}><a className="btn btn-quiet btn-calm min-h-11 w-full px-3 text-center text-[13px]" href={link(x)} target="_blank" rel="noopener noreferrer">{x}</a></li>
        ))}
      </ul>
    </section>
  );
}
