<script setup lang="ts">
import {
  Alert,
  Anchor,
  Button,
  Divider,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine-vue/core";
import { useForm, zodResolver } from "@mantine-vue/form";
import { notifications } from "@mantine-vue/notifications";
import { NuxtLinkLocale } from "#components";
import { authClient } from "~/utils/auth-client";
import type { AuthErrorKey } from "~/utils/authErrors";

definePageMeta({ layout: "auth", middleware: "guest" });

const { t } = useI18n();
const route = useRoute();
const localePath = useLocalePath();

useSeoMeta({
  title: () => t("auth.login.seoTitle"),
  description: () => t("auth.login.seoDescription"),
});

const providers = [
  { id: "google", icon: "simple-icons:google" },
  { id: "facebook", icon: "simple-icons:facebook" },
] as const;
type Provider = (typeof providers)[number]["id"];

const schema = createLoginSchema(t);
const form = useForm<LoginSchema>({
  initialValues: { email: "", password: "" },
  validate: zodResolver(schema),
  transformValues: (values) => schema.parse(values),
});

const submitting = ref(false);
const socialPending = ref<Provider | null>(null);
const errorKey = ref<AuthErrorKey | null>(null);
const busy = computed(() => submitting.value || socialPending.value !== null);

const postAuthPath = computed(() =>
  resolvePostAuthPath({ redirect: route.query.redirect, fallback: localePath("/find") }),
);

const onSubmit = form.onSubmit(async (values) => {
  errorKey.value = null;
  submitting.value = true;
  try {
    const { error } = await authClient.signIn.email(values);
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
});

async function signInWith(provider: Provider) {
  errorKey.value = null;
  socialPending.value = provider;
  try {
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: postAuthPath.value,
    });
    if (error) {
      notifications.show({ message: t(authErrorKey(error)), color: "red" });
    }
  } catch {
    notifications.show({ message: t(authErrorKey(null)), color: "red" });
  } finally {
    socialPending.value = null;
  }
}
</script>

<template>
  <Stack :gap="24">
    <Stack gap="lg">
      <Stack :gap="4">
        <Title :order="1" :fz="{ base: 22, sm: 26 }" lts="-0.015em">
          {{ t("auth.login.title") }}
        </Title>
        <Text size="sm" c="dimmed">{{ t("auth.login.subtitle") }}</Text>
      </Stack>

      <Stack :gap="8">
        <Button
          v-for="provider in providers"
          :key="provider.id"
          variant="default"
          size="lg"
          fullWidth
          :loading="socialPending === provider.id"
          :disabled="busy"
          @click="signInWith(provider.id)"
        >
          <template #leftSection><Icon :name="provider.icon" size="18" /></template>
          {{ t(`auth.providers.${provider.id}`) }}
        </Button>
      </Stack>

      <Divider :label="t('auth.divider')" />

      <Alert v-if="errorKey" color="red" variant="light">
        <template #icon><Icon name="lucide:circle-alert" size="20" /></template>
        {{ t(errorKey) }}
      </Alert>

      <form novalidate @submit="onSubmit">
        <Stack gap="md">
          <TextInput
            :label="t('auth.fields.email')"
            type="email"
            autocomplete="email"
            inputmode="email"
            size="lg"
            withAsterisk
            :placeholder="t('auth.fields.emailPlaceholder')"
            v-bind="form.getInputProps('email')"
          />

          <PasswordInput
            :label="t('auth.fields.password')"
            autocomplete="current-password"
            size="lg"
            withAsterisk
            :placeholder="t('auth.fields.passwordPlaceholder')"
            v-bind="form.getInputProps('password')"
          />

          <Button
            type="submit"
            size="lg"
            fullWidth
            :loading="submitting"
            :disabled="socialPending !== null"
          >
            {{ t("auth.login.submit") }}
          </Button>
        </Stack>
      </form>
    </Stack>

    <Text size="sm" c="dimmed">
      {{ t("auth.login.noAccount") }}
      <Anchor :component="NuxtLinkLocale" to="/register" fw="500">
        {{ t("auth.login.createOne") }}
      </Anchor>
    </Text>
  </Stack>
</template>
