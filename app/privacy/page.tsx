import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <PolicyPage title="Privacy policy" intro="What we collect, why, and who sees it.">
      <ul>
        <li><strong>What we collect:</strong> your name, phone number, email address, Instagram handle (optional), order and payment status, and entry check-in records.</li>
        <li><strong>Why:</strong> to sell you a ticket, deliver it, verify entry, contact you about the event, and handle refunds and support.</li>
        <li><strong>Payments:</strong> made by UPI from your own app. We never see your UPI PIN or bank login. We store the UTR and the payment screenshot you upload, only to verify your payment.</li>
        <li><strong>Who sees it:</strong> the organisers and authorised entry staff (who see only what they need to admit you). Our service providers (hosting, database, email, payments) process data on our behalf. We do not sell your data.</li>
        <li><strong>QR codes:</strong> your ticket QR contains a random code only, no personal information.</li>
        <li><strong>Marketing:</strong> we may message you about future events. Email {e.organiser.email} to opt out.</li>
        <li><strong>Retention:</strong> we keep ticket and order records for {e.policy.dataRetention} for support, accounting, and legal reasons, then delete or anonymise them.</li>
        <li><strong>Your rights:</strong> you can ask to see, correct, or delete your data by emailing {e.organiser.email}.</li>
        <li><strong>Security:</strong> access is role-restricted, data is encrypted in transit, and entry-staff access is limited and logged.</li>
        <li><strong>Contact:</strong> {e.organiser.name}, {e.organiser.email}.</li>
      </ul>
    </PolicyPage>
  );
}
