import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Refund & cancellation" };

export default function Refunds() {
  return (
    <PolicyPage title="Refund & cancellation policy" intro={`${e.name} · ${e.dateLabel}`}>
      <ul>
        <li><strong>{e.policy.refundPolicy}.</strong></li>
        <li><strong>If we cancel the event:</strong> every ticket is refunded in full to the original payment method.</li>
        <li><strong>If we reschedule:</strong> your ticket stays valid for the new date. If you can&apos;t attend the new date, you can request a refund within {e.policy.refundDays} days of the announcement.</li>
        <li><strong>If you were charged twice or charged without receiving a ticket:</strong> you&apos;ll get a ticket or a full refund of the extra or unfulfilled charge.</li>
        <li><strong>Timeline:</strong> approved refunds are initiated within [X] business days and typically reach your account in 5 to 7 business days, depending on your bank.</li>
        <li><strong>To request a refund:</strong> WhatsApp {e.organiser.whatsapp} or email {e.organiser.email} with your name, phone number and order ID.</li>
        <li><strong>Fees:</strong> [STATE WHETHER ANY CONVENIENCE FEE IS REFUNDED].</li>
        <li>Refunded tickets are cancelled and stop working at entry.</li>
      </ul>
      <h2>Delivery</h2>
      <p>Tickets are digital and delivered instantly on screen after payment is confirmed, and by email. No physical shipping.</p>
    </PolicyPage>
  );
}
