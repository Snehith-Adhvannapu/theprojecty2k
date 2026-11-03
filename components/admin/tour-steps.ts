// The guided tour: one step per thing worth pointing at, in the order an admin needs them on event day.
// `target` is a data-tour="..." name on a real element. `click` steps move on when the admin taps the highlighted tab.
// `tab` is the tab that must be open while the step shows. Steps whose target isn't on screen (e.g. no payments waiting yet)
// show centred with the `fallback` text instead.
export interface TourStep {
  id?: string;
  tab?: string;
  target?: string;
  title: string;
  text: string;
  click?: boolean;
  fallback?: string;
  superOnly?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  { id: "welcome", tab: "Overview", title: "Welcome to the Y2K control room", text: "This tour walks through every screen you will use on event day, in the order you will need them. You will tap a few tabs as we go. Nothing in the tour changes any data. Press Esc, or Exit tour, any time." },
  { tab: "Overview", target: "nav", title: "The tabs", text: "Every job has its own tab. On a phone, swipe sideways to see them all. We will visit them one by one." },
  { tab: "Overview", target: "hdr-links", title: "Scanner, Tour and Sign out", text: "Scanner opens the door scanner, and admins can scan too. Tour restarts this guide whenever you want it. Always Sign out before you hand your phone to someone else." },
  { tab: "Overview", target: "ov-counts", title: "Your live numbers", text: "Tickets sold, how many are still available, how many people have checked in, and how many buyers are in the middle of paying. These update by themselves every few seconds." },
  { tab: "Overview", target: "ov-money", title: "The money", text: "Collected is what approved payments add up to. Compare it with your bank statement. Still to refund is money you owe back to buyers who will not get a ticket." },
  { tab: "Overview", target: "ov-attention", title: "Needs attention", text: "When something needs you, a red bar appears here: payments waiting to be checked, refunds to send, or emails that failed. Press Review to jump straight to it.", fallback: "When something needs you, a red bar appears here: payments to verify, refunds to send, or failed emails. Nothing needs you right now." },

  { id: "payments", tab: "Overview", target: "tab-Payments", click: true, title: "Payments: your busiest tab", text: "Every buyer pays by UPI and then sends a UTR and a screenshot. They all land here for you to check. Tap Payments to open it." },
  { tab: "Payments", target: "pay-head", title: "To verify", text: "The number in brackets is how many payments are waiting. A new one appears within seconds, and you also get an email alert. Refresh forces an update." },
  { tab: "Payments", target: "pay-card", title: "One payment", text: "Each card shows the amount, the buyer, the UTR (a 12-digit UPI reference) and their screenshot. Tap the screenshot to see it full size. Now open your bank app and look for that exact UTR and amount.", fallback: "Each waiting payment appears as a card with the amount, the buyer, the UTR (12-digit UPI reference) and their screenshot. Open your bank app and look for that exact UTR and amount." },
  { tab: "Payments", target: "pay-approve", title: "Approve", text: "Press Approve only when your bank shows the exact amount with that UTR. It issues the ticket and emails the PDF straight away. You will be asked to confirm first.", fallback: "Approve issues the ticket and emails the PDF. Only use it when your bank shows the exact amount with that UTR." },
  { tab: "Payments", target: "pay-reject", title: "Reject", text: "Reject opens three choices: ask the buyer to fix and resubmit, reject because no money arrived, or reject and refund because the money did arrive. You can edit the WhatsApp message that goes with it, and save your wording as the default for everyone.", fallback: "Reject opens three choices: ask the buyer to fix and resubmit, reject (no money arrived), or reject and refund (the money did arrive). You can edit the WhatsApp message and save your wording as the default." },
  { tab: "Payments", target: "pay-contact", title: "Not sure? Ask the buyer", text: "Call or WhatsApp the buyer to confirm before you decide. These buttons do not change the order.", fallback: "Call buyer and WhatsApp to confirm let you check with the buyer before deciding. They do not change the order." },
  { tab: "Payments", target: "pay-reviewed", title: "Reviewed payments", text: "Everything you already decided. If you rejected someone by mistake, use Change to approved. If their money did arrive, use Money received? Refund. Screenshot reopens their proof, and Send on WhatsApp shares the ticket.", fallback: "Payments you have already decided appear here. If you rejected someone by mistake you can Change to approved, or add them to the refund list." },

  { id: "contacts", tab: "Payments", target: "tab-Contacts", click: true, title: "Contacts: everyone who started an order", text: "Paid or not. This is where you chase people and send updates. Tap Contacts." },
  { tab: "Contacts", target: "ct-template", title: "Your message template", text: "Write one WhatsApp message. Words in [square brackets], like [name] and [pass], are filled in with each person's own details. It is saved on this phone." },
  { tab: "Contacts", target: "ct-filters", title: "Filters", text: "Show everyone, only paid, in review, not paid yet, or rejected and refund cases. Not paid yet shows people whose 20-minute hold ran out, so use it to chase them or ignore them." },
  { tab: "Contacts", target: "ct-export", title: "Export", text: "Download the list as Excel or CSV, with names, phone numbers and emails. The export follows the filter above and is logged. Each row below also has a one-tap WhatsApp button." },

  { id: "refunds", tab: "Contacts", target: "tab-Refunds", click: true, title: "Refunds", text: "Keeps count of money to give back. Tap Refunds." },
  { tab: "Refunds", target: "rf-stats", title: "Owed and paid back", text: "To refund someone: tap Ask for UPI ID / QR to message them, send the money from your UPI app, then press Mark as refunded and note how you sent it. That keeps these totals true and emails the buyer." },

  { id: "pagetext", tab: "Refunds", target: "tab-Page text", click: true, title: "Page text", text: "Change any wording on the public landing page without touching code. Tap Page text." },
  { tab: "Page text", target: "pt-form", title: "Edit and save", text: "Open a section, change the words, then press Save all changes. The website updates within a few seconds. Put *stars* around words to show them in red. Restore original puts back the first version." },

  { id: "guests", tab: "Page text", target: "tab-Guests", click: true, title: "Guests: everyone holding a ticket", text: "The place to look someone up. Tap Guests." },
  { tab: "Guests", target: "gs-search", title: "Find a guest", text: "Search by name, phone number, short code or Instagram handle. The short code is the code printed under the QR on their ticket." },
  { tab: "Guests", target: "gs-actions", title: "Fix, undo, resend", text: "Edit details fixes a wrong name or number, which is what the door staff will see. Undo check-in reverses a scan made by mistake. Resend email sends the ticket again. All of it is recorded in Activity.", fallback: "Once tickets are sold, each guest has Edit details (fix a wrong name or number), Undo check-in (reverse a mistaken scan) and Resend email (send the ticket again)." },

  { id: "passes", tab: "Guests", target: "tab-Passes", click: true, title: "Passes: what you sell", text: "Prices, how many exist, and whether they are on sale. Tap Passes." },
  { tab: "Passes", target: "ps-sales", title: "Pause all sales", text: "An emergency stop. Use it if you spot a wrong price or something goes wrong with payments. Nobody can start a new order while it is paused. People who already ordered can still pay and get their tickets." },
  { tab: "Passes", target: "ps-row", title: "Edit a pass", text: "Change the price, the total number to sell, how many people one ticket admits, and the optional sales open and close times (India time). Tick On sale to show it on the website. Always press Save.", fallback: "Each pass row lets you change its price, total quantity, how many people it admits, its sales window and whether it is on sale. Press Save to apply." },

  { id: "volunteers", tab: "Passes", target: "tab-Volunteers", click: true, title: "Volunteers: your door team", text: "Volunteers can only use the scanner and look guests up. Tap Volunteers." },
  { tab: "Volunteers", target: "vo-add", title: "Add door staff", text: "Enter a name, email and password, then press Create account. The password is shown only once, so copy the login details and send them privately. Only tick Make admin for people you fully trust." },

  { id: "checkins", tab: "Volunteers", target: "tab-Check-ins", click: true, title: "Check-ins", text: "A live list of the latest scans at the door, including refused ones. Tap Check-ins." },
  { tab: "Check-ins", target: "ci-list", title: "Reading the list", text: "Lines in red were refused: duplicate means that ticket was already used, invalid means no such ticket, revoked means it was cancelled. Use it to settle arguments at the door.", fallback: "Scans appear here as they happen. Lines in red were refused: duplicate (already used), invalid (no such ticket) or revoked (cancelled)." },

  { id: "activity", tab: "Check-ins", target: "tab-Activity", click: true, title: "Activity", text: "A permanent log of who did what: approvals, rejections, exports, edits. Tap Activity." },
  { tab: "Activity", target: "ac-list", title: "Who did what", text: "Every action by every admin, newest first, with the time. If something looks wrong, check here first.", fallback: "Every action by every admin appears here, newest first, with the time." },

  { id: "tools", tab: "Activity", target: "tab-Tools", click: true, title: "Tools", text: "Exports, the printed backup list, free tickets and email fixes. Tap Tools." },
  { tab: "Tools", target: "tl-emails", title: "Emails", text: "Tickets are emailed automatically. If any email fails, it shows here. Press Send failed emails again to retry. If it keeps failing, check the address in Guests, Edit details." },
  { tab: "Tools", target: "tl-export", title: "Export and print the guest list", text: "Download the attendee list, or print it. Print it before the doors open. If the internet or the phones fail, the paper list is your backup at the door." },
  { tab: "Tools", target: "tl-comp", title: "Free (comp) tickets", text: "For a guest, a friend or someone who paid you another way. Pick the pass, enter their details and a reason. It uses one seat from that pass and is logged in Activity." },

  { id: "analytics", tab: "Tools", target: "tab-Analytics", click: true, superOnly: true, title: "Analytics (only you see this)", text: "Who visits the site and how many go on to buy. Tap Analytics." },
  { tab: "Analytics", target: "an-ranges", superOnly: true, title: "Visits and sales", text: "Pick 24 hours, 7 days, 30 days or 90 days. See page views, visitors, where they came from, and the path from visit to ticket." },

  { id: "finish", tab: "Tools", target: "tab-Guide", click: true, title: "Your event-day plan", text: "That is every screen. The Guide tab has a checklist for the weeks before, the day before, the doors opening and the night after, plus answers to common problems. Tap Guide." },
];

export const tourSteps = (isSuper: boolean) => TOUR_STEPS.filter((s) => !s.superOnly || isSuper);
