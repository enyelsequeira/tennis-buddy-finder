/**
 * Option lists for the profile form and profile display. The values match the
 * backend enums in `packages/backend/convex/model/profileSchema.ts`; the
 * labels live under `onboarding.*Options` in the locale files.
 */

export const PROFILE_BIO_MAX = 500;
export const PROFILE_LANGUAGES = ["pt", "en", "es", "fr", "de", "it"] as const;
export const PROFILE_FORMATS = ["singles", "doubles", "both"] as const;
export const PROFILE_GENDERS = ["male", "female", "other", "unspecified"] as const;
export const PROFILE_HANDS = ["right", "left"] as const;

export type ProfileLanguage = (typeof PROFILE_LANGUAGES)[number];

export const isProfileLanguage = (code: string): code is ProfileLanguage =>
  (PROFILE_LANGUAGES as readonly string[]).includes(code);

/** `3.5` -> `ntrp35`: locale keys cannot contain dots. */
export type NtrpKey = `ntrp${number}`;
export const ntrpKey = (value: number): NtrpKey => `ntrp${Math.round(value * 10)}`;
