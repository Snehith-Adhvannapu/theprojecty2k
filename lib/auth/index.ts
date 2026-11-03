// Staff auth: individual accounts, credentials only. scrypt password hashes, random
// session tokens (only their sha256 is stored), httpOnly SameSite=Lax cookie.
// Role checks happen on the server in every /api/admin and /api/staff route.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { query } from "@/lib/db";

export const SESSION_COOKIE = "y2k_session";
const SESSION_HOURS = 14;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export type Role = "superadmin" | "admin" | "volunteer";
/** Admin powers: the visible admins and the hidden superadmin. */
export const isAdminRole = (r: string) => r === "admin" || r === "superadmin";
export interface Staff {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const got = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, got);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function login(email: string, password: string): Promise<{ token: string; staff: Staff }> {
  const [u] = await query(
    "SELECT *, locked_until > now() AS locked FROM staff_users WHERE email = $1",
    [email.trim().toLowerCase()],
  );
  const bad = new AppError("BAD_LOGIN", "Wrong email or password.", 401);
  if (!u || !u.active) {
    verifyPassword(password, "scrypt$00$00"); // keep timing similar
    throw bad;
  }
  if (u.locked) throw new AppError("LOCKED", "Too many attempts. Try again in a few minutes.", 429);
  if (!verifyPassword(password, u.password_hash)) {
    await query(
      `UPDATE staff_users SET
         locked_until = CASE WHEN failed_count + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END,
         failed_count = CASE WHEN failed_count + 1 >= $2 THEN 0 ELSE failed_count + 1 END
       WHERE id = $1`,
      [u.id, MAX_FAILS, LOCK_MINUTES],
    );
    throw bad;
  }
  await query("UPDATE staff_users SET failed_count = 0, locked_until = NULL WHERE id = $1", [u.id]);
  const token = crypto.randomBytes(32).toString("base64url");
  await query(
    "INSERT INTO sessions (id, staff_id, expires_at) VALUES ($1,$2, now() + make_interval(hours => $3))",
    [sha(token), u.id, SESSION_HOURS],
  );
  return { token, staff: { id: u.id, email: u.email, name: u.name, role: u.role } };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function logout() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) await query("DELETE FROM sessions WHERE id = $1", [sha(t)]);
  jar.delete(SESSION_COOKIE);
}

export async function getStaff(): Promise<Staff | null> {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const [u] = await query(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN staff_users u ON u.id = s.staff_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.active = true`,
    [sha(t)],
  );
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role } : null;
}

/** Admin satisfies volunteer. Throws 401/403 AppError. */
export async function requireRole(role: Role): Promise<Staff> {
  const s = await getStaff();
  if (!s) throw new AppError("UNAUTHENTICATED", "Please sign in.", 401);
  if (role === "admin" && !isAdminRole(s.role)) throw new AppError("FORBIDDEN", "Not allowed.", 403);
  if (role === "superadmin" && s.role !== "superadmin") throw new AppError("FORBIDDEN", "Not allowed.", 403);
  return s;
}

export async function audit(actorId: string | null, action: string, target: string | null, meta: Record<string, unknown> = {}) {
  await query("INSERT INTO audit_logs (actor_id, action, target, meta) VALUES ($1,$2,$3,$4)", [
    actorId, action, target, JSON.stringify(meta),
  ]);
}
