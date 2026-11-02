// One-page PDF ticket in the site's chrome-noir theme. The QR holds the token only, never personal data.
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { eventConfig as e } from "@/config/event";

export interface PdfTicket { token: string; shortCode: string; admits: number; passName: string; holderName: string }

// design/tokens.css, as RGB.
const BG = rgb(0.02, 0.02, 0.02);
const SURFACE = rgb(0.048, 0.048, 0.048);
const LINE = rgb(0.133, 0.133, 0.133);
const FG = rgb(0.945, 0.933, 0.918);
const MUTED = rgb(0.557, 0.557, 0.576);
const CHROME = rgb(0.796, 0.808, 0.824);
const BLOOD = rgb(0.69, 0.09, 0.12);
const CRIMSON = rgb(0.89, 0.19, 0.18);

const font = (f: string) => fs.readFileSync(path.join(process.cwd(), "assets", "fonts", f));

/** Draws text with letter spacing (pdf-lib has none). Returns the width used. */
function spaced(page: PDFPage, t: string, x: number, y: number, f: PDFFont, size: number, color: ReturnType<typeof rgb>, track = 0) {
  let cx = x;
  for (const ch of t) { page.drawText(ch, { x: cx, y, size, font: f, color }); cx += f.widthOfTextAtSize(ch, size) + track; }
  return cx - x - track;
}

export async function ticketPdf(t: PdfTicket): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [bebas, body, strong] = await Promise.all([
    doc.embedFont(font("BebasNeue.ttf"), { subset: true }),
    doc.embedFont(font("Manrope-500.woff"), { subset: true }),
    doc.embedFont(font("Manrope-800.woff"), { subset: true }),
  ]);
  const W = 420, H = 700, M = 28;
  const page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: BG });
  page.drawRectangle({ x: 0, y: H - 4, width: W, height: 4, color: BLOOD });

  // Masthead: the Project Y2K26 logo
  const logo = await doc.embedPng(fs.readFileSync(path.join(process.cwd(), "public", "images", "y2k26-logo.png")));
  const lw = 150, lh = (lw * logo.height) / logo.width;
  page.drawImage(logo, { x: M - 6, y: H - 20 - lh, width: lw, height: lh });
  spaced(page, "ENTRY PASS", W - M - 70, H - 44, strong, 8, MUTED, 3);
  page.drawText(e.tagline, { x: W - M - body.widthOfTextAtSize(e.tagline, 10), y: H - 62, size: 10, font: body, color: MUTED });
  page.drawLine({ start: { x: M, y: H - 152 }, end: { x: W - M, y: H - 152 }, thickness: 0.75, color: LINE });

  // Admits + holder
  spaced(page, "ADMITS", M, H - 180, strong, 8, CRIMSON, 3);
  page.drawText(String(t.admits), { x: M, y: H - 232, size: 58, font: bebas, color: FG });
  page.drawText(t.passName, { x: M + 70, y: H - 210, size: 13, font: strong, color: FG });
  page.drawText(t.holderName, { x: M + 70, y: H - 228, size: 11, font: body, color: MUTED });

  // Detail strip
  const stripY = H - 296;
  page.drawRectangle({ x: M, y: stripY, width: W - 2 * M, height: 44, color: SURFACE, borderColor: LINE, borderWidth: 0.75 });
  const cols: [string, string][] = [["DATE", e.dateLabel], ["DOORS", e.doorsOpen], ["VENUE", e.venue.name]];
  const colW = (W - 2 * M) / 3;
  cols.forEach(([k, v], i) => {
    const x = M + i * colW + 10;
    spaced(page, k, x, stripY + 29, strong, 6.5, MUTED, 2);
    let s = v; while (body.widthOfTextAtSize(s, 9.5) > colW - 16 && s.length > 4) s = s.slice(0, -2);
    page.drawText(s === v ? s : s + "…", { x, y: stripY + 13, size: 9.5, font: strong, color: FG });
  });
  // Venue column links to Google Maps (the QR itself stays token-only).
  {
    const x0 = M + 2 * colW;
    const link = doc.context.register(doc.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [x0, stripY, W - M, stripY + 44], Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(e.venue.mapUrl) },
    }));
    page.node.addAnnot(link);
    spaced(page, "TAP FOR MAP", x0 + 10, stripY + 4, strong, 5.5, rgb(0.89, 0.19, 0.18), 1.5);
  }

  // QR on a light panel so any scanner reads it
  const PANEL = 232;
  const px = (W - PANEL) / 2, py = stripY - 24 - PANEL;
  page.drawRectangle({ x: px, y: py, width: PANEL, height: PANEL, color: FG });
  const qr = await doc.embedPng(await QRCode.toBuffer(t.token, { width: 600, margin: 0, errorCorrectionLevel: "M", color: { dark: "#050505", light: "#00000000" } }));
  page.drawImage(qr, { x: px + 16, y: py + 16, width: PANEL - 32, height: PANEL - 32 });

  // Short code
  const codeY = py - 52;
  spaced(page, "SHORT CODE", M, codeY + 34, strong, 7.5, MUTED, 3);
  spaced(page, t.shortCode, M, codeY, bebas, 40, CRIMSON, 4);
  const note = "Show this code if the QR won't scan.";
  page.drawText(note, { x: W - M - body.widthOfTextAtSize(note, 8.5), y: codeY + 4, size: 8.5, font: body, color: MUTED });

  // Footer
  page.drawLine({ start: { x: M, y: 62 }, end: { x: W - M, y: 62 }, thickness: 0.75, color: LINE });
  page.drawText("Carry a valid government photo ID. This QR works once. Tickets are non-transferable.", { x: M, y: 44, size: 8.5, font: body, color: MUTED });
  return doc.save();
}
