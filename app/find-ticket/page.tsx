import type { Metadata } from "next";
import { CalmShell } from "@/components/CalmShell";
import { FindTicketForm } from "@/components/FindTicketForm";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Find my ticket" };

export default function FindTicketPage() {
  return (
    <CalmShell back={{ href: "/", label: "Home" }}>
      <h1 className="mt-7 text-[28px] leading-[1.15]">Find my ticket</h1>
      <p className="muted mt-2">Lost the link or the email didn&apos;t arrive? Enter the email or mobile number you bought with and we&apos;ll email your ticket link to the address on the order.</p>
      <FindTicketForm />
      <p className="muted mt-8 border-t border-line pt-5 text-sm">
        Check your spam folder first. Still stuck? WhatsApp {e.organiser.whatsapp}, or we can look you up at the door with your name, phone number and a valid photo ID.
      </p>
    </CalmShell>
  );
}
