import * as z from "zod";

/** Longest chat message, in characters after trimming. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Client-side mirror of the body check in `../messages.ts` `send`. The Nuxt
 * composer imports this so validation matches on both sides; the backend
 * still enforces its own check and is the source of truth.
 */
export const messageBodySchema = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH);
