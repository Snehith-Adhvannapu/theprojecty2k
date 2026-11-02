import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { login, hashPassword, verifyPassword } from "@/lib/auth";
import { createVolunteer, resetStaffPassword, setStaffActive } from "@/lib/admin";
import { checkIn, lookupGuests } from "@/lib/checkin";
import { tokenForTicket, ticketsForOrder } from "@/lib/tickets";
import { makePass, paidOrder, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
let admin: string;
beforeEach(async () => {
  ctx = await setupDb();
  const [a] = await query("INSERT INTO staff_users (email, name, role, password_hash) VALUES ('a@test','Admin','admin',$1) RETURNING id", [hashPassword("Admin-pass-123")]);
  admin = a.id;
});

describe("staff accounts", () => {
  it("creates a volunteer who can sign in; duplicate emails are refused", async () => {
    await createVolunteer(admin, { email: " Vol1@Test.com ", name: "Vol One", password: "Volunteer-1-pass", role: "volunteer" });
    const { staff } = await login("vol1@test.com", "Volunteer-1-pass");
    expect(staff.role).toBe("volunteer");
    await expect(createVolunteer(admin, { email: "VOL1@test.com", name: "Dup", password: "Volunteer-2-pass", role: "volunteer" })).rejects.toMatchObject({ code: "EXISTS" });
  });

  it("wrong password gives the same error as an unknown email, and 5 failures lock the account", async () => {
    await createVolunteer(admin, { email: "v2@test.com", name: "V2", password: "Right-password-1", role: "volunteer" });
    await expect(login("nobody@test.com", "x")).rejects.toMatchObject({ code: "BAD_LOGIN" });
    for (let i = 0; i < 5; i++) await expect(login("v2@test.com", "wrong")).rejects.toMatchObject({ code: "BAD_LOGIN" });
    await expect(login("v2@test.com", "Right-password-1")).rejects.toMatchObject({ code: "LOCKED" });
  });

  it("revoking access ends sessions at once and blocks sign-in; restoring works", async () => {
    const id = await createVolunteer(admin, { email: "v3@test.com", name: "V3", password: "Right-password-1", role: "volunteer" });
    await login("v3@test.com", "Right-password-1");
    expect((await query("SELECT 1 FROM sessions WHERE staff_id = $1", [id])).length).toBe(1);
    await setStaffActive(admin, id, false);
    expect((await query("SELECT 1 FROM sessions WHERE staff_id = $1", [id])).length).toBe(0);
    await expect(login("v3@test.com", "Right-password-1")).rejects.toMatchObject({ code: "BAD_LOGIN" });
    await setStaffActive(admin, id, true);
    await expect(login("v3@test.com", "Right-password-1")).resolves.toBeTruthy();
  });

  it("an admin cannot revoke themselves, and the last active admin cannot be revoked", async () => {
    await expect(setStaffActive(admin, admin, false)).rejects.toMatchObject({ code: "SELF" });
    const second = await createVolunteer(admin, { email: "a2@test.com", name: "A2", password: "Admin2-password-1", role: "admin" });
    await setStaffActive(admin, second, false); // the actor is still an active admin
    await setStaffActive(admin, second, true);
    await query("UPDATE staff_users SET active = false WHERE id = $1", [admin]);
    await expect(setStaffActive(admin, second, false)).rejects.toMatchObject({ code: "LAST_ADMIN" });
  });

  it("password reset: new works, old doesn't, sessions and lockout cleared", async () => {
    const id = await createVolunteer(admin, { email: "v4@test.com", name: "V4", password: "Old-password-123", role: "volunteer" });
    await login("v4@test.com", "Old-password-123");
    for (let i = 0; i < 5; i++) await login("v4@test.com", "bad").catch(() => {});
    await resetStaffPassword(admin, id, "New-password-456");
    expect((await query("SELECT 1 FROM sessions WHERE staff_id = $1", [id])).length).toBe(0);
    await expect(login("v4@test.com", "Old-password-123")).rejects.toMatchObject({ code: "BAD_LOGIN" });
    await expect(login("v4@test.com", "New-password-456")).resolves.toBeTruthy();
    await expect(resetStaffPassword(admin, "00000000-0000-0000-0000-000000000000", "New-password-456")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("password hashes verify only the right password", () => {
    const h = hashPassword("abc12345678");
    expect(verifyPassword("abc12345678", h)).toBe(true);
    expect(verifyPassword("abc12345679", h)).toBe(false);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("door", () => {
  async function ticket(name = "Asha Rao") {
    const pass = await makePass(ctx.eventId, 10);
    const { order } = await paidOrder(pass, 1);
    await query("UPDATE tickets SET holder_name = $2 WHERE order_id = $1", [order.id, name]);
    const [t] = await ticketsForOrder({ query }, order.id);
    return { t, token: tokenForTicket(t.id) };
  }

  it("scan outcomes: admitted, duplicate (names who), revoked, unknown", async () => {
    const { t, token } = await ticket();
    expect((await checkIn({ token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("admitted");
    const d = await checkIn({ token, staffId: ctx.staffId, method: "qr" });
    expect(d.outcome).toBe("duplicate");
    expect(d.ticket?.usedBy).toBe("Vol");
    expect(d.ticket?.usedAt).toBeTruthy();
    const t2 = await ticket("Second Guest");
    await query("UPDATE tickets SET status = 'revoked' WHERE id = $1", [t2.t.id]);
    expect((await checkIn({ token: t2.token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("revoked");
    expect((await checkIn({ token: "x".repeat(43), staffId: ctx.staffId, method: "qr" })).outcome).toBe("invalid");
    expect(t.shortCode).toBeTruthy();
  });

  it("scanner input hygiene: empty, huge and hostile strings never admit anyone", async () => {
    for (const token of ["", "   ", "a".repeat(5000), "' OR 1=1 --", "%", "../../etc/passwd"]) {
      expect((await checkIn({ token, staffId: ctx.staffId, method: "qr" })).outcome).toBe("invalid");
    }
    expect((await checkIn({ staffId: ctx.staffId, method: "manual" })).outcome).toBe("invalid");
  });

  it("lookup: name any case, last 4 digits, short code; % and _ are literal; no full phone numbers", async () => {
    const { t } = await ticket("Asha Rao");
    await ticket("Ravi Kumar");
    expect((await lookupGuests("asha")).map((g) => g.name)).toEqual(["Asha Rao"]);
    expect((await lookupGuests("RAO"))[0]?.name).toBe("Asha Rao");
    expect((await lookupGuests(t.shortCode)).some((g) => g.id === t.id)).toBe(true);
    expect((await lookupGuests("%%")).length).toBe(0);
    expect((await lookupGuests("__")).length).toBe(0);
    expect((await lookupGuests("a")).length).toBe(0);
    const rows = await lookupGuests("asha");
    expect(rows[0].phoneLast4).toMatch(/^\d{4}$/);
    expect(Object.keys(rows[0])).not.toContain("phone");
  });

  it("a ticket admits once across QR and manual short-code scans in parallel", async () => {
    const { t, token } = await ticket();
    const rs = await Promise.all([
      checkIn({ token, staffId: ctx.staffId, method: "qr" }),
      checkIn({ shortCode: t.shortCode, staffId: ctx.staffId, method: "manual" }),
      checkIn({ token, staffId: ctx.staffId, method: "qr" }),
    ]);
    expect(rs.filter((r) => r.outcome === "admitted")).toHaveLength(1);
    expect(rs.filter((r) => r.outcome === "duplicate")).toHaveLength(2);
  });
});
