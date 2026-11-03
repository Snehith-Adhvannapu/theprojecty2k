import { describe, expect, it } from "vitest";
import { fillWa, WA_DEFAULTS, WA_KINDS } from "@/lib/wa-fill";
import { getWaTemplates, saveWaTemplates, waTemplatesSchema } from "@/lib/wa-templates";

describe("rejection WhatsApp presets", () => {
  it("fills placeholders in any case and leaves unknown ones alone", () => {
    const v = { name: "Asha Rao", amount: "₹1,499", reason: "UTR mismatch", link: "https://x/order/1", order: "AB12CD34" };
    expect(fillWa("Hi [First Name], [amount] [reason] [link] [order] [nope]", v)).toBe("Hi Asha, ₹1,499 UTR mismatch https://x/order/1 AB12CD34 [nope]");
    for (const k of WA_KINDS) expect(fillWa(WA_DEFAULTS[k], v)).not.toMatch(/\[[a-z ]+\]/i);
  });
  it("saved presets override the defaults, and bad input is refused", async () => {
    const mine = { fix: "Hello [name], fix it: [link]", reject: "Closed, [name]", refund: "Refund coming, [name]" };
    expect(waTemplatesSchema.safeParse({ ...mine, fix: "" }).success).toBe(false);
    await saveWaTemplates(null as never, mine);
    expect(await getWaTemplates()).toEqual(mine);
  });
});
