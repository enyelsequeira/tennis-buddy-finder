import { ConvexError } from "convex/values";

/** The string code a Convex function failed with (`fail("CODE")` in the backend), else "generic". */
export function convexErrorCode(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : "generic";
}

/** Looks the error's code up in a code-to-i18n-key table; unknown codes give "generic". */
export function convexErrorKey<Key extends string>(error: unknown, keys: Record<string, Key>) {
  const code = convexErrorCode(error);
  return Object.hasOwn(keys, code) ? keys[code]! : "generic";
}
