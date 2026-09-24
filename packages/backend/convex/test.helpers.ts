import { convexTest } from "convex-test";
import { vi } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

/** Unused until the availability tests build slot windows around `NOW`. */
export const HOUR = 60 * 60 * 1000;
/** Unused until the availability tests build slot windows around `NOW`. */
export const DAY = 24 * HOUR;
/** 2026-09-08T12:00:00.000Z, a Tuesday. */
export const NOW = Date.UTC(2026, 8, 8, 12, 0, 0);

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
