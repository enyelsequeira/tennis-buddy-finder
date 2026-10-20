import { ConvexError } from "convex/values";

/** Every code `fail` can throw; the web app maps these to messages. */
export const ERROR_CODES = [
  "BLOCKED",
  "CANNOT_BLOCK_SELF",
  "CANNOT_REQUEST_OWN_SLOT",
  "FORBIDDEN",
  "INVALID_AVATAR",
  "INVALID_BIO",
  "INVALID_BIRTH_DATE",
  "INVALID_DISPLAY_NAME",
  "INVALID_LANGUAGES",
  "INVALID_LIMIT",
  "INVALID_MESSAGE",
  "INVALID_NOTE",
  "INVALID_NTRP",
  "INVALID_RANGE",
  "INVALID_VENUE",
  "INVALID_YEARS_PLAYING",
  "NOT_FOUND",
  "PROFILE_EXISTS",
  "PROFILE_REQUIRED",
  "REQUEST_EXISTS",
  "REQUEST_NOT_PENDING",
  "SLOT_IN_PAST",
  "SLOT_INVALID_RANGE",
  "SLOT_NOT_ON_GRID",
  "SLOT_NOT_OPEN",
  "SLOT_OVERLAP",
  "SLOT_TOO_LONG",
  "UNAUTHENTICATED",
  "UNDERAGE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Throw a client-facing error with a stable string code. */
export function fail(code: ErrorCode): never {
  throw new ConvexError(code);
}
