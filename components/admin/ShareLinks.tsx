"use client";
// Short links for the Instagram bio, stories and chats. Each one tags the visit, so Analytics shows which one sold.
import { useState } from "react";

const BASE = "https://www.projecty2k.com";
const LINKS = [
  { path: "/ig", name: "Instagram bio", note: "Put this one in your profile link." },
  { path: "/story", name: "Instagram story", note: "For link stickers in stories." },
  { path: "/wa", name: "WhatsApp", note: "For broadcast messages and groups." },
  { path: "/yt", name: "YouTube", note: "For video descriptions." },
];

export function ShareLinks() {
  const [copied, setCopied] = useState("");
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(""), 2000); }
    catch { window.prompt("Copy this link", url); }
  }
  return (
    <div data-tour="tl-links" className="card-plain basis-full p-5">
      <h2 className="text-lg">Short links to share</h2>
      <p className="muted mt-2 text-sm">Use a different link for each place you post. When someone visits, Analytics shows where they came from and how many went on to buy.</p>
      <ul className="mt-3 divide-y divide-line">
        {LINKS.map((l) => (
          <li key={l.path} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block font-semibold">{l.name}</span>
              <span className="muted block text-sm">{l.note}</span>
              <span className="tnum mt-1 block break-all text-[15px]">{BASE.replace("https://", "")}{l.path}</span>
            </span>
            <button className="btn btn-quiet btn-calm min-h-11 px-5 text-sm" onClick={() => copy(BASE + l.path)}>{copied === BASE + l.path ? "Copied" : "Copy link"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
