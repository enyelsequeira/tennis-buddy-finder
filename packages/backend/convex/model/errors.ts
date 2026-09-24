import { ConvexError } from "convex/values";

/** Throw a client-facing error with a stable string code. */
export function fail(code: string): never {
  throw new ConvexError(code);
}
