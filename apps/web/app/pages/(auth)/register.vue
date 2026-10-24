<script setup lang="ts">
import type { AuthFormField, ButtonProps, FormSubmitEvent } from "@nuxt/ui";
import { authClient } from "~/utils/auth-client";
import type { AuthErrorKey } from "~/utils/authErrors";

definePageMeta({ layout: "auth", middleware: "guest" });

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();
const toast = useToast();

useSeoMeta({
  title: () => t("auth.register.seoTitle"),
  description: () => t("auth.register.seoDescription"),
});

const PROVIDERS = [
  { id: "google", icon: "i-simple-icons-google" },
  { id: "facebook", icon: "i-simple-icons-facebook" },
] as const;
type Provider = (typeof PROVIDERS)[number]["id"];

const submitting = ref(false);
const socialPending = ref<Provider | null>(null);
const errorKey = ref<AuthErrorKey | null>(null);
const busy = computed(() => submitting.value || socialPending.value !== null);

const schema = computed(() => createRegisterSchema(t));

const fields = computed<AuthFormField[]>(() => [
  {
    name: "name",
    type: "text",
    label: t("auth.fields.name"),
    placeholder: t("auth.fields.namePlaceholder"),
    defaultValue: "",
    autocomplete: "name",
    size: "lg",
    required: true,
  },
  {
    name: "email",
    type: "email",
    label: t("auth.fields.email"),
    placeholder: t("auth.fields.emailPlaceholder"),
    defaultValue: "",
    autocomplete: "email",
    inputmode: "email",
    size: "lg",
    required: true,
  },
  {
    name: "password",
    type: "password",
    label: t("auth.fields.password"),
    placeholder: t("auth.fields.newPasswordPlaceholder"),
    defaultValue: "",
    autocomplete: "new-password",
    size: "lg",
    required: true,
  },
]);

const providers = computed<ButtonProps[]>(() =>
  PROVIDERS.map((provider) => ({
    label: t(`auth.providers.${provider.id}`),
    icon: provider.icon,
    color: "neutral",
    variant: "outline",
    size: "lg",
    loading: socialPending.value === provider.id,
    disabled: busy.value,
    onClick: () => signInWith(provider.id),
  })),
);

const submit = computed<ButtonProps>(() => ({
  label: t("auth.register.submit"),
  size: "lg",
  disabled: socialPending.value !== null,
}));

const postAuthPath = computed(() =>
  resolvePostAuthPath({ redirect: route.query.redirect, fallback: localePath("/find") }),
);

async function onSubmit(event: FormSubmitEvent<RegisterSchema>) {
  errorKey.value = null;
  submitting.value = true;
  try {
    const { error } = await authClient.signUp.email(event.data);
    if (error) {
      errorKey.value = authErrorKey(error);
      return;
    }
    await navigateTo(postAuthPath.value);
  } catch {
    errorKey.value = authErrorKey(null);
  } finally {
    submitting.value = false;
  }
}

async function signInWith(provider: Provider) {
  errorKey.value = null;
  socialPending.value = provider;
  try {
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: postAuthPath.value,
    });
    if (error) {
      toast.add({ title: t(authErrorKey(error)), color: "error" });
    }
  } catch {
    toast.add({ title: t(authErrorKey(null)), color: "error" });
  } finally {
    socialPending.value = null;
  }
}
</script>

<template>
  <UAuthForm
    :schema="schema"
    :fields="fields"
    :providers="providers"
    :separator="t('auth.divider')"
    :submit="submit"
    :loading="submitting"
    :description="t('auth.register.subtitle')"
    @submit="onSubmit"
  >
    <template #title>
      <h1>{{ t("auth.register.title") }}</h1>
    </template>

    <template #validation>
      <UAlert
        v-if="errorKey"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :description="t(errorKey)"
      />
    </template>

    <template #footer>
      {{ t("auth.register.haveAccount") }}
      <ULink :to="localePath('/login')" class="font-medium text-primary hover:underline">
        {{ t("auth.register.signIn") }}
      </ULink>
    </template>
  </UAuthForm>
</template>
