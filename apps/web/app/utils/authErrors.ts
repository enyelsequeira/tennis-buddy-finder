/**
 * Maps Better Auth error codes (`authClient.$ERROR_CODES`) to `auth.errors.*`
 * translation keys. Unknown codes and network failures fall back to `generic`.
 * "User not found" style codes deliberately collapse into `invalidCredentials`
 * so the login form never reveals whether an email is registered.
 */
const AUTH_ERROR_KEYS = {
  INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
  USER_NOT_FOUND: "invalidCredentials",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "invalidCredentials",
  EMAIL_NOT_VERIFIED: "emailNotVerified",
  USER_ALREADY_EXISTS: "userAlreadyExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "userAlreadyExists",
  INVALID_EMAIL: "invalidEmail",
  INVALID_PASSWORD: "invalidPassword",
  PASSWORD_TOO_SHORT: "passwordTooShort",
  PASSWORD_TOO_LONG: "passwordTooLong",
  PROVIDER_NOT_FOUND: "providerUnavailable",
  SOCIAL_ACCOUNT_ALREADY_LINKED: "accountAlreadyLinked",
  LINKED_ACCOUNT_ALREADY_EXISTS: "accountAlreadyLinked",
} as const;

type AuthErrorName = (typeof AUTH_ERROR_KEYS)[keyof typeof AUTH_ERROR_KEYS] | "generic";
export type AuthErrorKey = `auth.errors.${AuthErrorName}`;

/** Shape of `error` in the `{ data, error }` result of every `authClient` call. */
export type AuthClientError = { code?: string; message?: string } | null | undefined;

function isKnownCode(code: string): code is keyof typeof AUTH_ERROR_KEYS {
  return code in AUTH_ERROR_KEYS;
}

export function authErrorKey(error: AuthClientError): AuthErrorKey {
  const code = error?.code;
  const name = code && isKnownCode(code) ? AUTH_ERROR_KEYS[code] : "generic";
  return `auth.errors.${name}`;
}

/**
 * Where to send the user after a successful sign in / sign up. Honours
 * `?redirect=/some/path` only when it is a same-origin path (`/x`, not `//x`).
 */
export function resolvePostAuthPath(options: { redirect: unknown; fallback: string }) {
  const { redirect, fallback } = options;
  if (typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return fallback;
}
