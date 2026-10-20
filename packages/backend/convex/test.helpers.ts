import { convexTest } from "convex-test";
import { vi } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DAY, HOUR } from "./model/time";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

export { DAY, HOUR };
/** 2026-09-08T12:00:00.000Z, a Tuesday. */
export const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);
/** 2026-09-09T10:00Z */
export const tomorrow10 = NOW + DAY - 2 * HOUR;
export const week = { from: NOW, to: NOW + 7 * DAY };
export const page = { numItems: 50, cursor: null };

export type T = ReturnType<typeof convexTest>;

export function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  return convexTest(schema, modules);
}

let userCounter = 0;

type CreateUserOverrides = {
  authId?: string;
  role?: "user" | "admin";
  /** `false` skips creating a profile (simulates a user mid-onboarding). */
  profile?: false;
  ntrp?: number;
  formats?: "singles" | "doubles" | "both";
  municipality?: string;
  bannedAt?: number;
};

export async function createUser(t: T, overrides: CreateUserOverrides = {}) {
  const n = ++userCounter;
  const authId = overrides.authId ?? `auth_${n}`;
  const userId = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      authId,
      email: `user${n}@test.pt`,
      name: `User ${n}`,
      role: overrides.role ?? "user",
      emailNotifications: true,
      ...(overrides.bannedAt !== undefined ? { bannedAt: overrides.bannedAt } : {}),
    }),
  );
  if (overrides.profile !== false) {
    await t.run(async (ctx) =>
      ctx.db.insert("profiles", {
        userId,
        displayName: `User ${n}`,
        birthDate: "1990-01-01",
        ntrp: overrides.ntrp ?? 3.5,
        yearsPlaying: 5,
        formats: overrides.formats ?? "both",
        district: "Coimbra",
        municipality: overrides.municipality ?? "Figueira da Foz",
        languages: ["pt"],
      }),
    );
  }
  return { userId, authId, as: t.withIdentity({ subject: authId }) };
}

export type TestUser = Awaited<ReturnType<typeof createUser>>;

export function createSlot(user: TestUser, startAt = tomorrow10) {
  return user.as.mutation(api.availability.create, { startAt, endAt: startAt + HOUR });
}

export function ban(t: T, userId: Id<"users">) {
  return t.run(async (ctx) => ctx.db.patch("users", userId, { bannedAt: NOW }));
}

/** Owner posts a slot, asker requests it, owner accepts: returns the conversation. */
export async function match(owner: TestUser, asker: TestUser, startAt = tomorrow10) {
  const slotId = await createSlot(owner, startAt);
  const requestId = await asker.as.mutation(api.matchRequests.send, { slotId });
  const conversationId = await owner.as.mutation(api.matchRequests.accept, { requestId });
  return { slotId, requestId, conversationId };
}
