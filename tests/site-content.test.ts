import { beforeEach, describe, expect, it } from "vitest";
import { getLanding, landingDefaults, resetLanding, saveLanding } from "@/lib/site-content";
import { setupDb } from "./helpers";

let ctx: Awaited<ReturnType<typeof setupDb>>;
beforeEach(async () => { ctx = await setupDb(); });

describe("editable landing text (every section)", () => {
  it("defaults, saves, validates and resets", async () => {
    expect(await getLanding()).toEqual(landingDefaults());
    const next = landingDefaults();
    next.about.heading = "New heading";
    next.how.steps[0].title = "Step one edited";
    next.last.paras = ["Edited *last* paragraph."];
    next.details[3].value = "A new venue";
    next.faq = [{ q: "Only question?", a: "Only answer." }];
    expect(await saveLanding(ctx.staffId, next)).toEqual(next);
    expect(await getLanding()).toEqual(next);
    await expect(saveLanding(ctx.staffId, { ...next, about: { ...next.about, heading: "" } })).rejects.toThrow();
    await expect(saveLanding(ctx.staffId, { ...next, trust: ["only one"] })).rejects.toThrow();
    expect(await getLanding()).toEqual(next); // a rejected save changes nothing
    await resetLanding(ctx.staffId);
    expect(await getLanding()).toEqual(landingDefaults());
  });
});
