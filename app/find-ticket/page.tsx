import type { Metadata } from "next";
import { CalmShell } from "@/components/CalmShell";
import { MyOrders } from "@/components/MyOrders";
import { FindTicketForm } from "@/components/FindTicketForm";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Find my ticket" };

export default function FindTicketPage() {
  return (
    <CalmShell back={{ href: "/", label: "Home" }}>
      <h1 className="mt-7 text-[28px] leading-[1.15]">My tickets</h1>
      <p className="muted mt-2">Your orders and tickets in one place.</p>
      <MyOrders />
      <section className="card mt-6 p-5" aria-label="Email me my ticket">
        <p className="label">Not on this phone?</p>
        <p className="muted mt-2 text-sm">Enter the email or mobile number you bought with. For your safety we send the ticket to the email on the order. We never show it on screen.</p>
        <FindTicketForm />
      </section>
      <p className="muted mt-6 text-sm">
        Check spam first. Still stuck? WhatsApp {e.organiser.whatsapp}, or we can look you up at the door with your name, phone number and a valid photo ID.
      </p>
    </CalmShell>
  );
}
