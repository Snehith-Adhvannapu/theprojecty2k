"use client";
// The admin handbook: an event-day plan with tick-off lists, what every tab is for, and fixes for the problems that
// actually happen. "Show me" starts the guided tour at that part. Tick marks are remembered on this device only.
import { useEffect, useState } from "react";
import { Tip } from "@/components/Tip";

interface Plan { id: string; when: string; items: string[] }

const PLAN: Plan[] = [
  { id: "before", when: "Before ticket sales open", items: [
    "Passes tab: check each pass's name, price, total quantity and who it admits (1 = single, 2 = couple).",
    "Passes tab: set Sales open and Sales close times if a pass should start or stop by itself.",
    "Page text tab: read every section of the landing page once and fix any wording.",
    "Volunteers tab: create a login for each door volunteer and send it to them privately.",
    "Make a small real test: buy one pass, pay by UPI, send the proof, approve it, and check the ticket email arrives.",
  ] },
  { id: "selling", when: "While tickets are on sale (every day)", items: [
    "Payments tab: clear the To verify list. Approve only when the bank shows the exact amount with that UTR.",
    "Overview tab: glance at the red Needs attention bar for refunds and failed emails.",
    "Refunds tab: send any money owed, then press Mark as refunded so the totals stay right.",
    "Contacts tab: filter Not paid yet, and message people who might still want to pay.",
    "Tools tab: press Send failed emails again if any emails failed.",
  ] },
  { id: "dayBefore", when: "The day before the event", items: [
    "Payments tab: nothing left in To verify.",
    "Refunds tab: nothing left in To refund.",
    "Tools tab: download the attendee list, and print the guest list as a paper backup for the door.",
    "Volunteers tab: ask every volunteer to sign in on their phone and open the scanner once, so the camera permission is already allowed.",
    "Check every phone is charged, and that your team has the WhatsApp number to reach you.",
  ] },
  { id: "doors", when: "Event day, before doors open", items: [
    "Open the scanner (Scanner, in the menu) and scan one test ticket to be sure everything works.",
    "Give each volunteer the rules: green = let in and check the name on their photo ID; red = do not admit; amber = no signal, wait; blue = admitted while offline.",
    "Keep the printed guest list at the door.",
    "Overview tab: note the sold count so you can compare with the number checked in.",
  ] },
  { id: "door", when: "At the door", items: [
    "QR won't scan? Tap Find guest by name or code, search, check their ID, and tap ADMIT once.",
    "Scanned the wrong ticket? Guests tab, find them, Undo check-in. They can then be scanned again.",
    "Name on the ticket is spelled wrong? Guests tab, Edit details.",
    "Someone lost their ticket? Guests tab, find them, Resend email. Or look them up with Find guest.",
    "Check-ins tab shows every scan, including refused ones, if there is an argument.",
  ] },
  { id: "after", when: "After the event", items: [
    "Refunds tab: clear anything still owed.",
    "Tools tab: download the check-ins and attendee exports for your records.",
    "Activity tab: skim it for anything unexpected.",
    "Page text tab: update the landing page with a thank-you and the next date.",
  ] },
];

interface Ref { id: string; name: string; what: string; how: string[] }
const REFS: Ref[] = [
  { id: "payments", name: "Payments", what: "Where every buyer's UTR and screenshot arrives for you to check.", how: [
    "Open your bank statement and find the exact UTR and amount shown on the card.",
    "It matches: press Approve. The ticket is created and the PDF is emailed.",
    "It does not match: press Reject…, pick a reason, choose what happens, and send the WhatsApp message.",
    "Rejected by mistake? In Reviewed, press Change to approved.",
    "Your edited WhatsApp wording can be saved as the default for every payment and every admin.",
  ] },
  { id: "contacts", name: "Contacts", what: "Everyone who started an order, paid or not.", how: [
    "Write your message once. [name], [pass], [amount] and the other bracketed words are filled in for each person.",
    "Tap WhatsApp on any row to open the chat with the message ready. Call and Copy are next to it.",
    "Export to Excel or CSV for your own records. Exports are logged.",
  ] },
  { id: "refunds", name: "Refunds", what: "Money you owe back, and a record of what you already returned.", how: [
    "A buyer lands here when you choose Reject & refund, or when passes sold out after they paid.",
    "Tap Ask for UPI ID / QR, send the money from your UPI app, then press Mark as refunded with how you sent it.",
    "The buyer gets an email, and the totals at the top stay correct.",
  ] },
  { id: "pagetext", name: "Page text", what: "Every word on the public landing page, editable without code.", how: [
    "Open a section, edit, then Save all changes. The site updates within seconds.",
    "Put *stars* around words to show them in red.",
    "Restore original puts back the first wording.",
  ] },
  { id: "guests", name: "Guests", what: "Everyone holding a ticket.", how: [
    "Search by name, phone, short code or Instagram.",
    "Edit details fixes a wrong name, number or email. Resend email sends the ticket again.",
    "Undo check-in reverses a scan made by mistake. Approved tickets cannot be cancelled, by design.",
  ] },
  { id: "passes", name: "Passes", what: "What you sell: price, quantity, who it admits, and when it is on sale.", how: [
    "Change the numbers and press Save on that pass.",
    "Total qty is how many exist in total. The line under it shows sold, held and left.",
    "Pause all sales stops new orders instantly. People who already ordered can still pay.",
    "On sale off hides a pass. Tickets already sold stay valid.",
  ] },
  { id: "volunteers", name: "Volunteers", what: "Staff logins. Volunteers can only scan and look guests up.", how: [
    "Create account shows the password once. Copy it and send it privately.",
    "New password signs that person out everywhere. Revoke access removes them straight away.",
    "Make admin gives full access, including phone numbers and payments, so use it sparingly.",
  ] },
  { id: "checkins", name: "Check-ins and Activity", what: "A live record of every scan, and a log of every admin action.", how: [
    "Check-ins: red lines were refused. Duplicate = already used. Invalid = no such ticket. Revoked = cancelled.",
    "Activity: who approved, rejected, edited, exported or changed a pass, and when.",
  ] },
  { id: "tools", name: "Tools", what: "Exports, the printed backup list, free tickets and email retries.", how: [
    "Print guest list before the doors open as your offline backup.",
    "Issue comp ticket for a free guest. It needs a reason and uses one seat.",
    "Send failed emails again retries emails that did not go out.",
  ] },
];

const FIXES: [string, string][] = [
  ["Where are the payments I need to check?", "Look for the red to-verify button at the top of any screen, or the red number next to Payments in the menu. Tap either one. On a phone, open the menu with the button at the top left."],
  ["The menu is in my way", "On a computer, press Collapse menu at the bottom of the menu to shrink it to icons. Press it again to expand. On a phone the menu closes by itself after you pick something."],
  ["A buyer says they paid but I see nothing", "Check Contacts. If they are Not paid yet, their order exists but they never sent the UTR. WhatsApp them the order link, or ask for the UTR and screenshot. If their hold ran out, they can still submit while passes remain, and the system tells them if passes sold out."],
  ["Two people sent the same UTR", "A UTR can only be used once. The second one is refused automatically. If the first buyer is genuine, ask the second for the correct UTR."],
  ["Passes sold out but someone paid", "They appear in Refunds as needing a refund, and they are emailed. Send the money back and mark it refunded."],
  ["The amount paid is wrong", "Do not approve. Reject and refund if the money arrived, or ask them to fix and resubmit if they want to pay the difference."],
  ["The QR won't scan", "Use Find guest by name or code on the scanner. Check their photo ID, then tap ADMIT once."],
  ["The screen turned amber: No connection", "Nobody is admitted yet. It retries by itself. If the signal does not come back, use the printed guest list and check names against ID."],
  ["I scanned the wrong person", "Guests tab, find them, Undo check-in."],
  ["I rejected someone by mistake", "Payments tab, Reviewed, Change to approved. If their money did arrive and you decided not to admit them, use Money received? Refund."],
  ["I need to stop sales right now", "Passes tab, Pause all sales. Resume when you are ready."],
  ["I want more tickets", "Passes tab, raise Total qty and press Save. Or add a new pass at the bottom."],
  ["Someone's email bounced", "Guests tab, Edit details, correct the email, Save, then Resend email."],
];

const KEY = "y2k_guide_checks";

export function Guide({ start }: { start: (id?: string) => void }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(KEY) ?? "{}")); } catch { /* private mode */ } }, []);
  const flip = (k: string) => setDone((d) => {
    const n = { ...d, [k]: !d[k] };
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ }
    return n;
  });
  const reset = () => { setDone({}); try { localStorage.removeItem(KEY); } catch { /* private mode */ } };
  const total = PLAN.reduce((a, p) => a + p.items.length, 0);
  const ticked = Object.values(done).filter(Boolean).length;

  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <section className="card relative overflow-hidden p-6">
        <h2 className="text-xl">Take the guided tour</h2>
        <p className="muted mt-2 text-[15px]">A 5-minute walk through every screen, including the new menu and the red to-verify button. It highlights each button, tells you what it is, and asks you to tap the menu items as you go. You can press Skip tour at any step. Nothing in it changes any data.</p>
        <button className="btn btn-primary btn-calm mt-4 min-h-12 px-7" onClick={() => start()}>Start the tour</button>
      </section>

      <section aria-labelledby="plan-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="plan-h" className="flex items-center gap-1.5 text-xl">Event-day plan<Tip text="A checklist from now until after the event. Tick items off as you go. Ticks are saved on this phone only, so each admin keeps their own." /></h2>
          <p className="muted tnum text-sm">{ticked} of {total} done{ticked > 0 && <> · <button className="inline-flex min-h-11 items-center border-b border-blood text-fg" onClick={reset}>Clear ticks</button></>}</p>
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {PLAN.map((p) => {
            const n = p.items.filter((_, j) => done[`${p.id}-${j}`]).length;
            return (
              <details key={p.id} className="card-plain group" open={p.id === "before"}>
                <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 text-base font-semibold">
                  <span>{p.when}</span>
                  <span className="muted tnum shrink-0 text-[13px] font-normal">{n}/{p.items.length}</span>
                </summary>
                <ul className="flex flex-col border-t border-line px-3 py-2">
                  {p.items.map((t, j) => {
                    const k = `${p.id}-${j}`;
                    return (
                      <li key={k}>
                        <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-sm px-2 py-2.5 text-[15px] leading-snug">
                          <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--blood)]" checked={!!done[k]} onChange={() => flip(k)} />
                          <span className={done[k] ? "muted line-through" : ""}>{t}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ref-h">
        <h2 id="ref-h" className="text-xl">What each tab does</h2>
        <div className="mt-3 flex flex-col gap-3">
          {REFS.map((r) => (
            <details key={r.id} className="card-plain">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 text-base font-semibold">{r.name}<span aria-hidden="true" className="text-crimson">+</span></summary>
              <div className="border-t border-line p-5">
                <p className="text-[15px]">{r.what}</p>
                <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-snug marker:text-muted">{r.how.map((h) => <li key={h}>{h}</li>)}</ol>
                <button className="btn btn-quiet btn-calm mt-4 min-h-11 px-4 text-sm" onClick={() => start(r.id)}>Show me on screen</button>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="fix-h">
        <h2 id="fix-h" className="text-xl">When something goes wrong</h2>
        <div className="mt-3 flex flex-col gap-3">
          {FIXES.map(([q, a]) => (
            <details key={q} className="card-plain">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 px-5 py-2 text-base font-semibold"><span>{q}</span><span aria-hidden="true" className="text-crimson">+</span></summary>
              <p className="border-t border-line p-5 text-[15px] leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
