// npm run seed. Safe to re-run: only fills what is missing.
// Seed data is placeholder-only (names say so, prices are ₹1). Edit everything in /admin.
import { loadEnvConfig } from "@next/env";
import crypto from "node:crypto";

loadEnvConfig(process.cwd());

async function main() {
  const { getDb } = await import("../lib/db");
  const { hashPassword } = await import("../lib/auth");
  const db = await getDb();

  const ev = await db.query("SELECT id FROM events LIMIT 1");
  if (!ev.length) {
    const [e] = await db.query(
      "INSERT INTO events (name, starts_at, max_per_order) VALUES ('Project Y2K', '2026-11-15T00:00:00+05:30', 4) RETURNING id",
    );
    const passes: [string, string, number, number, number][] = [
      ["General Entry [EDIT IN ADMIN]", "[PASS DESCRIPTION]", 100, 100, 1],
      ["Couple Pass [EDIT IN ADMIN]", "[PASS DESCRIPTION] One QR, admits 2.", 100, 50, 2],
      ["VIP [EDIT IN ADMIN]", "[PASS DESCRIPTION]", 100, 20, 1],
    ];
    for (const [i, [name, desc, price, qty, admits]] of passes.entries()) {
      await db.query(
        "INSERT INTO pass_types (event_id, name, description, price_paise, total_qty, admits, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [e.id, name, desc, price, qty, admits, i],
      );
    }
    console.log("seeded event + 3 placeholder passes");
  }

  const staff: [string, string, string, string | undefined][] = [
    ["admin@y2k.local", "Admin One", "admin", process.env.SEED_ADMIN_PASSWORD],
    ["admin2@y2k.local", "Admin Two", "admin", process.env.SEED_ADMIN_PASSWORD],
    ["volunteer@y2k.local", "Volunteer One", "volunteer", process.env.SEED_VOLUNTEER_PASSWORD],
  ];
  for (const [email, name, role, pw] of staff) {
    if ((await db.query("SELECT 1 FROM staff_users WHERE email = $1", [email])).length) continue;
    const password = pw || crypto.randomBytes(9).toString("base64url");
    await db.query("INSERT INTO staff_users (email, name, role, password_hash) VALUES ($1,$2,$3,$4)", [
      email, name, role, hashPassword(password),
    ]);
    console.log(`created ${role}: ${email}  password: ${password}   (change/revoke in /admin; shown once)`);
  }
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
