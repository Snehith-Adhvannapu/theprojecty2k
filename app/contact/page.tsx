import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { eventConfig as e } from "@/config/event";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  const o = e.organiser;
  return (
    <PolicyPage title="Contact" intro="Real people reply here.">
      <address className="not-italic leading-relaxed">
        <strong>{o.name}</strong><br />
        {o.address}<br />
        WhatsApp: {o.whatsapp} (replies within [X hours])<br />
        Email: {o.email}<br />
        Instagram: {o.instagram}<br />
        Support hours: {o.supportHours}<br />
        Event-day helpline: {o.eventDayHelpline}
      </address>
    </PolicyPage>
  );
}
