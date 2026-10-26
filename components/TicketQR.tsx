"use client";
// The QR is drawn in the browser from the token, so the ticket renders with zero signal
// once the page has been opened (no image request).
import { useEffect, useState } from "react";

export function TicketQR({ token, size = 228 }: { token: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then(async (QR) => {
      const s = await QR.toString(token, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#0000" } });
      if (live) setSvg(s.replace(/#000000/g, "currentColor"));
    });
    return () => { live = false; };
  }, [token]);

  return (
    <div className="pop rounded-sm bg-fg p-3.5 text-bg" style={{ width: size + 28, height: size + 28 }}>
      {svg ? (
        <div role="img" aria-label="Ticket QR code" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", `<svg width="${size}" height="${size}" `) }} />
      ) : (
        <div className="skeleton" style={{ width: size, height: size }} aria-busy="true" />
      )}
    </div>
  );
}
