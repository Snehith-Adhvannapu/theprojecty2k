// One-page PDF ticket. The QR holds the token only, never personal data.
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { eventConfig as e } from "@/config/event";

export interface PdfTicket { token: string; shortCode: string; admits: number; passName: string; holderName: string }

// Tokens from design/tokens.css (print-safe: light card on white).
const INK = rgb(0.04, 0.04, 0.04);
const MUTED = rgb(0.42, 0.42, 0.45);
const RED = rgb(0.69, 0.09, 0.12);

export async function ticketPdf(t: PdfTicket): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 640]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const { width } = page.getSize();

  page.drawRectangle({ x: 0, y: 560, width, height: 80, color: INK });
  page.drawText("PROJECT Y2K", { x: 28, y: 592, size: 26, font: bold, color: rgb(0.95, 0.94, 0.92) });
  page.drawText(e.dateLabel.toUpperCase(), { x: 28, y: 570, size: 10, font: reg, color: rgb(0.8, 0.8, 0.82) });

  page.drawText(`ADMITS ${t.admits}`, { x: 28, y: 515, size: 34, font: bold, color: INK });
  page.drawText(t.passName, { x: 28, y: 490, size: 13, font: reg, color: MUTED });
  page.drawText(t.holderName, { x: 28, y: 465, size: 18, font: bold, color: INK });
  page.drawText(`${e.venue.name}  ·  Doors ${e.doorsOpen}`, { x: 28, y: 445, size: 10, font: reg, color: MUTED });

  const png = await doc.embedPng(await QRCode.toBuffer(t.token, { width: 600, margin: 1 }));
  page.drawImage(png, { x: 60, y: 130, width: 300, height: 300 });

  page.drawText("SHORT CODE", { x: 28, y: 100, size: 9, font: reg, color: MUTED });
  page.drawText(t.shortCode, { x: 28, y: 68, size: 28, font: bold, color: RED });
  page.drawText("Carry a valid government photo ID. This QR works once.", { x: 28, y: 40, size: 9, font: reg, color: MUTED });
  page.drawText(`Ticketing powered by ${e.khelo.name}`, { x: 28, y: 24, size: 8, font: reg, color: MUTED });
  return doc.save();
}
