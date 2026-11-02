import { beforeEach, describe, expect, it } from "vitest";
import { query } from "@/lib/db";
import { hashPassword, isAdminRole, verifyPassword } from "@/lib/auth";
import { listVolunteers, resetStaffPassword, setStaffActive } from "@/lib/admin";
import { activityLog, listContacts } from "@/lib/admin/contacts";
import { toCsv } from "@/lib/admin/export";
import { fillTemplate } from "@/components/admin/Contacts";
import { makePass, order, setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

async function superadmin() {
  const [r] = await query("INSERT INTO staff_users (email, name, role, password_hash) VALUES ('boss@example.com','Boss','superadmin',$1) RETURNING id", [hashPassword("x-pass-12345")]);
  return r.id as string;
}

describe("superadmin", () => {
  it("counts as an admin, is hidden from the staff list, and cannot be reset or revoked by an admin", async () => {
    const sid = await superadmin();
    expect(isAdminRole("superadmin") && isAdminRole("admin") && !isAdminRole("volunteer")).toBe(true);
    expect((await listVolunteers()).some((u) => u.id === sid)).toBe(false);
    await expect(setStaffActive(ctx.staffId, sid, false)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(resetStaffPassword(ctx.staffId, sid, "another-pass-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const [{ password_hash }] = await query("SELECT password_hash FROM staff_users WHERE id = $1", [sid]);
    expect(verifyPassword("x-pass-12345", password_hash)).toBe(true);
  });

  it("hides the superadmin's actions from admins in the activity log", async () => {
    const sid = await superadmin();
    await query("INSERT INTO audit_logs (actor_id, action) VALUES ($1, 'export')", [sid]);
    await query("INSERT INTO audit_logs (actor_id, action) VALUES ($1, 'pass_updated')", [ctx.staffId]);
    const forAdmin = await activityLog("admin");
    expect(forAdmin.some((a) => a.action === "pass_updated")).toBe(true);
    expect(forAdmin.some((a) => a.action === "export")).toBe(false);
    expect((await activityLog("superadmin")).some((a) => a.action === "export")).toBe(true);
  });
});

describe("contacts list and export", () => {
  it("lists everyone who entered details, filters by status, and de-duplicates by phone", async () => {
    const pass = await makePass(ctx.eventId, 10);
    const a = await order(pass, 1, "+919111111111");
    await order(pass, 2, "+919111111111"); // same person, second attempt
    await order(pass, 1, "+919222222222");
    expect((await listContacts({ unique: false })).length).toBe(3);
    expect((await listContacts({ unique: true })).length).toBe(2);
    expect((await listContacts({ status: "unpaid", unique: true })).length).toBe(2);
    expect((await listContacts({ status: "paid" })).length).toBe(0);
    expect((await listContacts({ q: "9222" }))[0].phone).toBe("+919222222222");
    expect(a.id).toBeTruthy();
  });

  it("exports CSV with phone, email and a wa.me link, and neutralises spreadsheet formulas", async () => {
    const pass = await makePass(ctx.eventId, 10);
    const o = await order(pass, 1, "+919333333333");
    await query("UPDATE orders SET buyer_name = '=HYPERLINK(\"x\")' WHERE id = $1", [o.id]);
    const csv = await toCsv("contacts", { unique: true });
    expect(csv).toContain("+919333333333");
    expect(csv).toContain("https://wa.me/919333333333");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/,=HYPERLINK/);
  });
});

describe("whatsapp message placeholders", () => {
  it("replaces [name] and friends with the entered details, any case, and leaves unknown ones alone", () => {
    const c = { orderId: "abcdef12-0000", name: "Asha Rao", phone: "+919000000001", email: "a@b.co", instagram: null, status: "paid", statusLabel: "Paid", pass: "Early Bird Pass", qty: 2, amountPaise: 299800, at: "2026-11-03T00:00:00Z" };
    expect(fillTemplate("Hi [name]! [First Name], your [pass] x[tickets] ([amount]) [unknown]", c)).toBe("Hi Asha Rao! Asha, your Early Bird Pass x2 (₹2,998) [unknown]");
  });
});
