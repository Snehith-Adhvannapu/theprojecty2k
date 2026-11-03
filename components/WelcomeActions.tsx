"use client";
// After a ticket is confirmed: put the night in their calendar and bring friends. Both are single taps.
import Link from "next/link";
import { eventConfig as e } from "@/config/event";
import { LIVE_URL } from "@/lib/app-url";

const IST_NOON = "20261115T063000Z"; // 12:00 IST
const IST_FIVE = "20261115T113000Z"; // 17:00 IST

function calendarHref() {
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Project Y2K//The Matrix//EN", "BEGIN:VEVENT",
    "UID:the-matrix-2026-11-15@projecty2k.com", "DTSTAMP:20261103T000000Z",
    `DTSTART:${IST_NOON}`, `DTEND:${IST_FIVE}`,
    `SUMMARY:${e.name}: The Matrix`,
    `LOCATION:${e.venue.name}\\, ${e.venue.address}`,
    `DESCRIPTION:Doors ${e.doorsOpen}. Carry a valid government photo ID. Show your ticket QR at the door.`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function WelcomeActions() {
  const share = `https://wa.me/?text=${encodeURIComponent(`I'm going to ${e.name}: The Matrix, Hyderabad's first theatre rave. ${e.dateLabel} at ${e.venue.name}. Get your pass: ${LIVE_URL}`)}`;
  return (
    <section aria-label="Before the night" className="welcome-rise card-plain p-5" style={{ "--i": 3 } as React.CSSProperties}>
      <p className="eyebrow">Before the night</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <a href={calendarHref()} download="project-y2k-the-matrix.ics" className="btn btn-quiet btn-calm min-h-12">Add to calendar</a>
        <a href={share} target="_blank" rel="noopener noreferrer" className="btn btn-quiet btn-calm min-h-12">Tell your friends</a>
      </div>
      <p className="muted mt-4 text-sm">Going with a group? Everyone needs their own pass.{" "}
        <Link href="/#passes" className="border-b border-blood text-fg">Get passes for friends</Link>
      </p>
    </section>
  );
}
