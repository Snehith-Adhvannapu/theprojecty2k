import { beforeEach, describe, expect, it } from "vitest";
import { defaultAbout, getAbout, resetAbout, saveAbout } from "@/lib/site-content";
import { setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

describe("editable landing text", () => {
  it("defaults, saves, validates and resets", async () => {
    expect(await getAbout()).toEqual(defaultAbout());
    const next = { heading: "New heading", lead: "", paras: ["One.", "Two."], closer: "Bye", note: "A note" };
    expect(await saveAbout(ctx.staffId, next)).toEqual(next);
    expect(await getAbout()).toEqual(next);
    await expect(saveAbout(ctx.staffId, { ...next, heading: "" })).rejects.toThrow();
    await expect(saveAbout(ctx.staffId, { ...next, paras: Array(9).fill("x") })).rejects.toThrow();
    expect(await getAbout()).toEqual(next); // a rejected save changes nothing
    await resetAbout(ctx.staffId);
    expect(await getAbout()).toEqual(defaultAbout());
  });
});
