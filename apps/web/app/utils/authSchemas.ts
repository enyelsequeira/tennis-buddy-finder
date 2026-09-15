import * as z from "zod";

/**
 * Zod schemas for the auth forms. Messages come from `auth.validation.*`, so
 * the schema is built from the page's `t` (rebuild it when the locale changes:
 * `computed(() => createLoginSchema(t))`).
 */
type Translate = ReturnType<typeof useI18n>["t"];

export function createLoginSchema(t: Translate) {
  return z.object({
    email: z.email(t("auth.validation.emailInvalid")),
    password: z.string().min(1, t("auth.validation.passwordRequired")),
  });
}

export function createRegisterSchema(t: Translate) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, t("auth.validation.nameMin"))
      .max(60, t("auth.validation.nameMax")),
    email: z.email(t("auth.validation.emailInvalid")),
    password: z
      .string()
      .min(8, t("auth.validation.passwordMin"))
      .max(128, t("auth.validation.passwordMax")),
  });
}

export type LoginSchema = z.output<ReturnType<typeof createLoginSchema>>;
export type RegisterSchema = z.output<ReturnType<typeof createRegisterSchema>>;
