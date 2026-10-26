import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Terms & conditions" };

export default function Terms() {
  return (
    <PolicyPage title="Terms & conditions" intro="Please read these before buying. By paying you agree to them.">
      <ol>
        <li><strong>Organiser.</strong> {e.name} is organised by {e.organiser.name}, {e.organiser.address}. Ticketing is powered by {e.khelo.name}.</li>
        <li><strong>Entry.</strong> A valid ticket and government photo ID are required. Each ticket admits the number of people stated on it, once.</li>
        <li><strong>Right of admission.</strong> The organiser may refuse or remove anyone who breaches the rules, behaves unsafely, or cannot show valid ID, without refund.</li>
        <li><strong>Tickets.</strong> Tickets are issued only after payment is verified. Duplicated, altered, or resold-for-profit tickets may be cancelled without refund. Each QR code works once; whoever&apos;s code is scanned first is admitted.</li>
        <li><strong>Prices and payment.</strong> All prices are in Indian Rupees (INR). Payments are processed by Razorpay. Any fee is shown before you pay.</li>
        <li><strong>Age and conduct.</strong> {e.ageLimit}. Attendees follow venue rules and the law.</li>
        <li><strong>Prohibited items.</strong> {e.rules.join("; ")}</li>
        <li><strong>Photography.</strong> By attending, you consent to being photographed or filmed for event promotion, unless you tell the crew at the door.</li>
        <li><strong>Changes.</strong> The organiser may change timings, lineup, or venue where necessary and will announce changes through Instagram, WhatsApp or email.</li>
        <li><strong>Refunds and cancellation.</strong> See the <a href="/refunds">Refund &amp; cancellation policy</a>, which forms part of these terms.</li>
        <li><strong>Liability.</strong> Attendees participate at their own risk. The organiser is not liable for loss of personal belongings, to the extent permitted by law.</li>
        <li><strong>Governing law.</strong> These terms are governed by the laws of India. Disputes are subject to the courts at {e.policy.governingCity}.</li>
        <li><strong>Contact.</strong> {e.organiser.email}, WhatsApp {e.organiser.whatsapp}.</li>
      </ol>
    </PolicyPage>
  );
}
