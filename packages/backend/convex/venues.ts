import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import { getCurrentProfile } from "./model/auth";
import { LAUNCH_DISTRICT, LAUNCH_MUNICIPALITY } from "./model/validators";
import schema from "./schema";

/**
 * Placeholder seed list. Replace names/addresses with the real courts before
 * launch (spec open item 3). Idempotent by name.
 */
const FIGUEIRA_VENUES = [
  { name: "Clube de Ténis da Figueira da Foz", surface: "clay" as const },
  { name: "Complexo Desportivo Municipal", surface: "hard" as const },
];

export const list = query({
  args: {},
  returns: v.array(schema.doc("venues")),
  handler: async (ctx) => {
    const { profile } = await getCurrentProfile(ctx);
    const venues = await ctx.db
      .query("venues")
      .withIndex("by_municipality", (q) => q.eq("municipality", profile.municipality))
      .take(100);
    // Array filter over an already-fetched, bounded list (not a db query filter).
    return venues.filter((venue) => venue.isActive);
  },
});

export const seedFigueira = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("venues")
      .withIndex("by_municipality", (q) => q.eq("municipality", LAUNCH_MUNICIPALITY))
      .take(100);
    const names = new Set(existing.map((venue) => venue.name));
    let inserted = 0;
    for (const venue of FIGUEIRA_VENUES) {
      if (names.has(venue.name)) continue;
      await ctx.db.insert("venues", {
        ...venue,
        district: LAUNCH_DISTRICT,
        municipality: LAUNCH_MUNICIPALITY,
        isActive: true,
      });
      inserted += 1;
    }
    return inserted;
  },
});
