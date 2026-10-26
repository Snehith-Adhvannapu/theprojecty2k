// One tiny interface over two drivers:
//  - DATABASE_URL set      -> node-postgres pool (Neon, Supabase, local Postgres, anything)
//  - DATABASE_URL empty    -> PGlite, real Postgres in-process, stored in .data/pglite
//  - DATABASE_URL=memory:  -> PGlite in memory (tests)
// Everything else in the app writes plain parameterised SQL against `Q`.
import fs from "node:fs";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Q {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
}
export interface Db extends Q {
  transaction<T>(fn: (q: Q) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function makePglite(dir: string | undefined): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dir) fs.mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  return {
    async query<T extends Row>(text: string, params?: unknown[]) {
      return (await pg.query<T>(text, params as unknown[])).rows;
    },
    transaction(fn) {
      return pg.transaction((tx) =>
        fn({ query: async (t, p) => (await tx.query(t, p as unknown[])).rows as never }),
      );
    },
    close: () => pg.close(),
  };
}

async function makePg(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    async query<T extends Row>(text: string, params?: unknown[]) {
      return (await pool.query(text, params as unknown[])).rows as T[];
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn({
          query: async (t, p) => (await client.query(t, p as unknown[])).rows as never,
        });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

export async function applyMigrations(db: Db, dir = path.join(process.cwd(), "drizzle")) {
  await db.query(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const files = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const done = await db.query("SELECT 1 FROM _migrations WHERE name = $1", [f]);
    if (done.length) continue;
    const statements = fs
      .readFileSync(/*turbopackIgnore: true*/ path.join(dir, f), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    await db.transaction(async (q) => {
      for (const s of statements) await q.query(s);
      await q.query("INSERT INTO _migrations (name) VALUES ($1)", [f]);
    });
  }
}

export async function openDb(url = process.env.DATABASE_URL ?? ""): Promise<Db> {
  const db = url.startsWith("memory:")
    ? await makePglite(undefined)
    : url
      ? await makePg(url)
      : await makePglite(path.join(process.cwd(), ".data", "pglite"));
  await applyMigrations(db);
  return db;
}

// Lazy singleton, safe across Next dev HMR. Never touches the DB at import time.
const g = globalThis as unknown as { __y2kDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  return (g.__y2kDb ??= openDb());
}

/** Test helper: swap in a specific database (e.g. a fresh in-memory one). */
export function setDb(db: Db) {
  g.__y2kDb = Promise.resolve(db);
}

export async function query<T extends Row = Row>(text: string, params?: unknown[]) {
  return (await getDb()).query<T>(text, params);
}
export async function transaction<T>(fn: (q: Q) => Promise<T>) {
  return (await getDb()).transaction(fn);
}
