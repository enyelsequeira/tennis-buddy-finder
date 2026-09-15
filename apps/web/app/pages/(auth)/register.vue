<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
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

// Brand marks are not in lucide. simple-icons is the sole permitted exception
// to the lucide-only rule, and only for these two provider buttons.
const providers = [
  { id: "google", icon: "i-simple-icons-google" },
  { id: "facebook", icon: "i-simple-icons-facebook" },
] as const;
type Provider = (typeof providers)[number]["id"];

const schema = createRegisterSchema(t);
const state = reactive({ name: "", email: "", password: "" });

const submitting = ref(false);
const socialPending = ref<Provider | null>(null);
const errorKey = ref<AuthErrorKey | null>(null);
const busy = computed(() => submitting.value || socialPending.value !== null);

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
  <div class="space-y-6">
    <div class="space-y-5">
      <div>
        <h1
          class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
        >
          {{ t("auth.register.title") }}
        </h1>
        <p class="mt-1 text-sm text-muted">{{ t("auth.register.subtitle") }}</p>
      </div>

      <div class="space-y-2">
        <UButton
          v-for="provider in providers"
          :key="provider.id"
          :label="t(`auth.providers.${provider.id}`)"
          :icon="provider.icon"
          color="neutral"
          variant="outline"
          size="lg"
          block
          :loading="socialPending === provider.id"
          :disabled="busy"
          @click="signInWith(provider.id)"
        />
      </div>

      <USeparator :label="t('auth.divider')" />

      <UAlert
        v-if="errorKey"
        color="error"
        variant="soft"
        icon="i-lucide-circle-alert"
        :description="t(errorKey)"
      />

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField name="name" :label="t('auth.fields.name')" required>
          <UInput
            v-model="state.name"
            type="text"
            autocomplete="name"
            size="lg"
            class="w-full"
            :placeholder="t('auth.fields.namePlaceholder')"
          />
        </UFormField>

        <UFormField name="email" :label="t('auth.fields.email')" required>
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            inputmode="email"
            size="lg"
            class="w-full"
            :placeholder="t('auth.fields.emailPlaceholder')"
          />
        </UFormField>

        <UFormField name="password" :label="t('auth.fields.password')" required>
          <UInput
            v-model="state.password"
            type="password"
            autocomplete="new-password"
            size="lg"
            class="w-full"
            :placeholder="t('auth.fields.newPasswordPlaceholder')"
          />
        </UFormField>

        <UButton
          type="submit"
          :label="t('auth.register.submit')"
          size="lg"
          block
          :loading="submitting"
          :disabled="socialPending !== null"
        />
      </UForm>
    </div>

    <p class="text-sm text-muted">
      {{ t("auth.register.haveAccount") }}
      <ULink to="/login" class="font-medium text-primary hover:underline">
        {{ t("auth.register.signIn") }}
      </ULink>
    </p>
  </div>
</template>
