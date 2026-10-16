import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { createNotification } from "./model/notifications";
import { DAY } from "./model/time";

const HOUR = DAY / 24;
const SEED_PREFIX = "seed:";

// `slotHour` is UTC; each player gets one slot at that hour on every day in DAY_OFFSETS.
const PLAYERS = [
  {
    slug: "ines",
    name: "Inês Carvalho",
    ntrp: 6,
    birthDate: "1994-03-12",
    yearsPlaying: 14,
    slotHour: 17,
  },
  {
    slug: "tiago",
    name: "Tiago Mendes",
    ntrp: 5.5,
    birthDate: "1988-11-02",
    yearsPlaying: 20,
    slotHour: 9,
  },
  {
    slug: "marta",
    name: "Marta Lopes",
    ntrp: 3.5,
    birthDate: "1999-07-25",
    yearsPlaying: 4,
    slotHour: 18,
  },
];
const DAY_OFFSETS = [1, 2, 4];

/**
 * Dev-only sample data: three players in Figueira da Foz with open slots over
 * the next days, plus one pending request from the first of them on every real
 * user's next open slot. Idempotent per player; run with
 * `npx convex run devSeed:demoPlayers`.
 */
export const demoPlayers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const midnight = Math.floor(now / DAY) * DAY;
    const users = await ctx.db.query("users").take(200);

    const seeded = [];
    for (const player of PLAYERS) {
      const authId = `${SEED_PREFIX}${player.slug}`;
      const existing = users.find((user) => user.authId === authId);
      if (existing) {
        seeded.push(existing._id);
        continue;
      }
      const userId = await ctx.db.insert("users", {
        authId,
        email: `${player.slug}@seed.invalid`,
        name: player.name,
        role: "user",
        emailNotifications: false,
      });
      await ctx.db.insert("profiles", {
        userId,
        displayName: player.name,
        birthDate: player.birthDate,
        ntrp: player.ntrp,
        yearsPlaying: player.yearsPlaying,
        formats: "both",
        district: "Coimbra",
        municipality: "Figueira da Foz",
        languages: ["pt", "en"],
      });
      for (const offset of DAY_OFFSETS) {
        const startAt = midnight + offset * DAY + player.slotHour * HOUR;
        await ctx.db.insert("availabilitySlots", {
          userId,
          startAt,
          endAt: startAt + 1.5 * HOUR,
          district: "Coimbra",
          municipality: "Figueira da Foz",
          status: "open",
        });
      }
      seeded.push(userId);
    }

    const requester = seeded[0]!;
    for (const user of users) {
      if (user.authId.startsWith(SEED_PREFIX)) continue;
      const slots = await ctx.db
        .query("availabilitySlots")
        .withIndex("by_userId_and_startAt", (q) => q.eq("userId", user._id).gt("startAt", now))
        .take(20);
      const slot = slots.find((candidate) => candidate.status === "open");
      if (!slot) continue;
      const latest = await ctx.db
        .query("matchRequests")
        .withIndex("by_slotId_and_fromUserId", (q) =>
          q.eq("slotId", slot._id).eq("fromUserId", requester),
        )
        .order("desc")
        .first();
      if (latest?.status === "pending") continue;
      const requestId = await ctx.db.insert("matchRequests", {
        slotId: slot._id,
        fromUserId: requester,
        toUserId: user._id,
        message: "Olá! Tens este horário livre? Jogo de fundo do campo.",
        status: "pending",
      });
      await createNotification(ctx, { userId: user._id, type: "request_received", requestId });
    }
    return null;
  },
});
