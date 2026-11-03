// The public site address used in emails and links. Never falls back to localhost on a real deployment:
// APP_URL wins, then the live domain on Vercel/production, then localhost for local development only.
export const LIVE_URL = "https://www.projecty2k.com";

export function appUrl(): string {
  const set = process.env.APP_URL?.trim();
  if (set && !/localhost|127\.0\.0\.1/.test(set)) return set.replace(/\/$/, "");
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return LIVE_URL;
  return (set || "http://localhost:3000").replace(/\/$/, "");
}
