// npm run seed. Safe to re-run: only fills what is missing.
// Pass quantities are provisional. Edit everything in /admin.
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
    // Quantities are provisional: set the real numbers in /admin > Passes before sales open.
    const DESC = "The Matrix: Hyderabad's first theatre rave.";
    const passes: [string, string, number, number, number][] = [
      ["Early Bird Pass", DESC, 139900, 100, 1],
      ["General Pass", DESC, 159900, 100, 1],
      ["Couple Pass", DESC + " One QR, admits 2.", 279900, 50, 2],
      ["Backstage Pass", DESC, 249900, 50, 1],
    ];
    for (const [i, [name, desc, price, qty, admits]] of passes.entries()) {
      await db.query(
        "INSERT INTO pass_types (event_id, name, description, price_paise, total_qty, admits, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [e.id, name, desc, price, qty, admits, i],
      );
    }
    console.log("seeded event + 4 passes (check quantities in /admin)");
  }

  const staff: [string, string, string, string | undefined][] = [
    ["admin@y2k.local", "Admin One", "admin", process.env.SEED_ADMIN_PASSWORD || "Y2K-Admin-2026!"],
    ["admin2@y2k.local", "Admin Two", "admin", process.env.SEED_ADMIN_PASSWORD || "Y2K-Admin-2026!"],
    ["volunteer@y2k.local", "Volunteer One", "volunteer", process.env.SEED_VOLUNTEER_PASSWORD || "Y2K-Volunteer-2026!"],
  ];
  for (const [email, name, role, pw] of staff) {
    const exists = (await db.query("SELECT 1 FROM staff_users WHERE email = $1", [email])).length > 0;
    const password = pw || crypto.randomBytes(9).toString("base64url");
    if (exists) {
      // SEED_RESET=1 forces the known dev passwords back onto existing accounts. Never use on production.
      if (process.env.SEED_RESET === "1") await db.query("UPDATE staff_users SET password_hash=$1, active=true WHERE email=$2", [hashPassword(password), email]);
      continue;
    }
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
