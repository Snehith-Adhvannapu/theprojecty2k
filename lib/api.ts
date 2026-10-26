// Routes stay thin: validate with Zod, call a lib function, return { ok, data | error }.
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/errors";

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json({ ok: true, data }, init);

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/** Wraps a handler so no stack trace ever reaches a client. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError) return fail(e.code, e.message, e.status);
    if (e instanceof ZodError) return fail("VALIDATION", e.issues[0]?.message ?? "Invalid input", 400);
    console.error("[api] unhandled", e instanceof Error ? e.message : "unknown error"); // message only
    return fail("SERVER_ERROR", "Something went wrong. Please try again.", 500);
  }
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("BAD_JSON", "Invalid request.", 400);
  }
  return schema.parse(raw);
}
