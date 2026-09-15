import * as z from "zod";

import { ageOn, MIN_AGE, parseIsoDate } from "./time";

/** NTRP ratings offered in the UI: 1.0 to 7.0 in 0.5 steps. */
export const NTRP_VALUES: readonly number[] = Array.from({ length: 13 }, (_, i) => 1 + i * 0.5);

const LANGUAGE_CODE = /^[a-z]{2}$/;

/**
 * Client-side mirror of `validateProfileInput` in `../profiles.ts`. The Nuxt
 * onboarding form imports this so validation matches on both sides; the
 * backend still enforces its own checks and is the source of truth.
 */
export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(40),
  bio: z.string().max(500).optional(),
  birthDate: z
    .string()
    .refine((value) => parseIsoDate(value) !== null, { message: "INVALID_BIRTH_DATE" })
    .refine((value) => !parseIsoDate(value) || ageOn(value, Date.now()) >= MIN_AGE, {
      message: "UNDERAGE",
    }),
  gender: z.enum(["male", "female", "other", "unspecified"]).optional(),
  ntrp: z
    .number()
    .min(1)
    .max(7)
    .refine((value) => (value * 2) % 1 === 0, { message: "INVALID_NTRP" }),
  yearsPlaying: z.number().int().min(0).max(90),
  formats: z.enum(["singles", "doubles", "both"]),
  handedness: z.enum(["right", "left"]).optional(),
  languages: z.array(z.string().regex(LANGUAGE_CODE)).min(1),
});

export type ProfileInput = z.output<typeof profileInputSchema>;
