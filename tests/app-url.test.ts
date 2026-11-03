import { afterEach, describe, expect, it, vi } from "vitest";
import { appUrl, LIVE_URL } from "@/lib/app-url";

afterEach(() => vi.unstubAllEnvs());

describe("appUrl (links in emails)", () => {
  it("never produces localhost on a real deployment", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_URL", "");
    expect(appUrl()).toBe(LIVE_URL);
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(appUrl()).toBe(LIVE_URL);
  });
  it("uses APP_URL when it is a real address, without a trailing slash", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("APP_URL", "https://example.com/");
    expect(appUrl()).toBe("https://example.com");
  });
  it("falls back to localhost only in local development", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "");
    expect(appUrl()).toBe("http://localhost:3000");
  });
});
