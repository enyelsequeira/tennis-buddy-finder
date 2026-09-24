<script setup lang="ts">
import { Stack, Text, Title } from "@mantine-vue/core";
import { notifications } from "@mantine-vue/notifications";
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { ProfileInput } from "@tennis-buddy-finder/backend/convex/model/profileSchema";
import { ConvexError } from "convex/values";
import { Icon } from "#components";

definePageMeta({ layout: "auth", middleware: "auth", authWide: true });

const { t } = useI18n();
const localePath = useLocalePath();
const ready = useConvexAuthReady();
const { me, refresh } = await useCurrentUser();

// Already onboarded: nothing to do here.
if (me.value?.profile) {
  await navigateTo(localePath("/find"));
}

useSeoMeta({ title: () => t("onboarding.seoTitle") });

const displayName = computed(() => me.value?.user.name ?? "");

const { mutate: createProfile, isPending } = useConvexMutation(api.profiles.create);

function errorCode(error: unknown) {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : "generic";
}

async function onSubmit(input: ProfileInput) {
  try {
    await createProfile(input);
    await refresh();
    notifications.show({
      message: t("onboarding.success"),
      icon: h(Icon, { name: "lucide:check", size: 18 }),
      color: "surround",
    });
    await navigateTo(localePath("/find"));
  } catch (error) {
    if (errorCode(error) === "PROFILE_EXISTS") {
      notifications.show({
        message: t("onboarding.errors.profileExists"),
        icon: h(Icon, { name: "lucide:info", size: 18 }),
      });
      await navigateTo(localePath("/find"));
      return;
    }
    notifications.show({ message: t("onboarding.errors.generic"), color: "red" });
  }
}
</script>

<template>
  <Stack :gap="24">
    <Stack :gap="4">
      <Title :order="1" :fz="{ base: 22, sm: 26 }" lts="-0.015em">
        {{ t("onboarding.title") }}
      </Title>
      <Text size="sm" c="dimmed" maw="65ch">{{ t("onboarding.subtitle") }}</Text>
    </Stack>

    <ProfileForm
      :initial="{ displayName }"
      :submit-label="t('onboarding.submit')"
      :pending="isPending"
      :disabled="!ready"
      @submit="onSubmit"
    />
  </Stack>
</template>
