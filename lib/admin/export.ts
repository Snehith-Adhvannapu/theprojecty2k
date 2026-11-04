// Attendee list + check-in report as XLSX or CSV. Admin only (full phone numbers inside).
import ExcelJS from "exceljs";
import { allGuests, checkinHistory } from "@/lib/admin";
import { formatFullIST } from "@/lib/time";
import { listContacts, type StatusFilter } from "@/lib/admin/contacts";
import { refundLedger } from "@/lib/payments/manual";

export interface ExportOpts { status?: StatusFilter; unique?: boolean }
type Kind = "attendees" | "checkins" | "contacts" | "refunds";

// Spreadsheet formula injection: a name like "=HYPERLINK(...)" must stay text.
const safe = (v: string | null | undefined) => (v && /^[=+\-@\t\r]/.test(v) ? `'${v}` : (v ?? ""));

type Cell = string | number;
interface Table { name: string; header: string[]; rows: Cell[][] }

export async function buildTables(kind: Kind, opts: ExportOpts = {}): Promise<Table[]> {
  if (kind === "refunds") {
    const l = await refundLedger();
    const row = (r: (typeof l.owed)[number], state: string): Cell[] => [
      safe(r.name), r.phone, state, r.amountPaise / 100, safe(r.reason), formatFullIST(r.at), r.method ?? "", safe(r.reference), safe(r.note), safe(r.by), r.orderId,
    ];
    return [{
      name: "Refunds",
      header: ["Name", "Phone", "Status", "Amount (Rs)", "Reason", "Date (IST)", "Refunded via", "Reference", "Note", "Refunded by", "Order ID"],
      rows: [...l.owed.map((r) => row(r, "Owed")), ...l.done.map((r) => row(r, "Refunded"))],
    }];
  }
  if (kind === "contacts") {
    const c = await listContacts({ status: opts.status, unique: opts.unique });
    return [{
      name: "Contacts",
      header: ["Name", "Phone", "Email", "Instagram", "Guest Instagram handles", "Status", "Pass", "Tickets", "Amount (Rs)", "Entered at (IST)", "WhatsApp link", "Order ID"],
      rows: c.map((r) => [safe(r.name), r.phone, safe(r.email), safe(r.instagram), safe(r.guests.map((g) => `@${g}`).join(" ")), r.statusLabel, safe(r.pass), r.qty, r.amountPaise / 100, formatFullIST(r.at), `https://wa.me/${r.phone.replace(/\D/g, "")}`, r.orderId]),
    }];
  }
  if (kind === "attendees") {
    const g = await allGuests();
    return [{
      name: "Attendees",
      header: ["Short code", "Name", "Phone", "Email", "Instagram", "Pass", "Admits", "Status", "Source", "Bought at (IST)", "Checked in at (IST)", "Checked in by", "Ticket ID"],
      rows: g.map((r) => [
        r.shortCode, safe(r.name), r.phone, safe(r.email), safe(r.instagram), safe(r.passName), r.admits, r.status, r.source,
        formatFullIST(r.createdAt), r.usedAt ? formatFullIST(r.usedAt) : "", safe(r.usedBy), r.id,
      ]),
    }];
  }
  const h = await checkinHistory(5000);
  return [{
    name: "Check-ins",
    header: ["Time (IST)", "Outcome", "Method", "Mode", "Short code", "Name", "Staff"],
    rows: h.map((r) => [formatFullIST(r.at), r.outcome, r.method, r.mode, r.shortCode ?? "", safe(r.name), safe(r.staff)]),
  }];
}

const csvCell = (c: Cell) => {
  const s = String(c);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function toCsv(kind: Kind, opts: ExportOpts = {}): Promise<string> {
  const [t] = await buildTables(kind, opts);
  return "﻿" + [t.header, ...t.rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function toXlsx(kind: Kind, opts: ExportOpts = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const t of await buildTables(kind, opts)) {
    const ws = wb.addWorksheet(t.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(t.header).font = { bold: true };
    t.rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c, i) => {
      const max = Math.max(t.header[i].length, ...t.rows.slice(0, 200).map((r) => String(r[i]).length));
      c.width = Math.min(40, max + 2);
    });
    // phone / codes as text so Excel never turns them into numbers
    t.header.forEach((h, i) => {
      if (/phone|code|id/i.test(h)) ws.getColumn(i + 1).numFmt = "@";
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.header.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
