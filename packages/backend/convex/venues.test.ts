import { describe, expect, it } from "vitest";

import { api, internal } from "./_generated/api";
import { createUser, setup } from "./test.helpers";

describe("venues", () => {
  it("seed is idempotent and list returns active venues for my municipality", async () => {
    const t = setup();
    const first = await t.mutation(internal.venues.seedFigueira, {});
    const second = await t.mutation(internal.venues.seedFigueira, {});
    expect(first).toBeGreaterThan(0);
    expect(second).toBe(0);

    const u = await createUser(t);
    const venues = await u.as.query(api.venues.list, {});
    expect(venues.length).toBe(first);
    expect(venues.every((v) => v.municipality === "Figueira da Foz")).toBe(true);
  });

  it("hides inactive venues", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("venues", {
        name: "Closed Club",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        isActive: false,
      });
    });
    const u = await createUser(t);
    const venues = await u.as.query(api.venues.list, {});
    expect(venues.find((v) => v.name === "Closed Club")).toBeUndefined();
  });
});
