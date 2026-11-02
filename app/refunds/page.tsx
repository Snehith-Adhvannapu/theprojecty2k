import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Refund & cancellation" };

export default function Refunds() {
  return (
    <PolicyPage title="Refund & cancellation policy" intro={`${e.name} · ${e.dateLabel}`}>
      <ul>
        <li><strong>{e.policy.refundPolicy}.</strong> {e.policy.transferable}. {e.policy.reentry}.</li>
        <li><strong>If we cancel the event:</strong> every ticket is refunded in full to the account you paid from.</li>
        <li><strong>If we reschedule:</strong> your ticket stays valid for the new date.</li>
        <li><strong>If you were charged twice, or charged without receiving a ticket:</strong> you&apos;ll get a ticket or a full refund of the extra or unfulfilled charge.</li>
        <li><strong>To raise a payment problem:</strong> WhatsApp {e.organiser.whatsapp} or email {e.organiser.email} with your name, phone number, UTR and payment screenshot.</li>
        <li>Refunded tickets are cancelled and stop working at entry.</li>
      </ul>
      <h2>Delivery</h2>
      <p>Tickets are digital. After you pay by UPI and submit the UTR and screenshot, we verify the payment against our bank account and then email your ticket as a PDF. It also appears on your order page. This is not instant, so please allow some time. No physical shipping.</p>
    </PolicyPage>
  );
}
