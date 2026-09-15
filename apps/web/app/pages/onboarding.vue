<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { ProfileInput } from "@tennis-buddy-finder/backend/convex/model/profileSchema";
import { ConvexError } from "convex/values";

definePageMeta({ layout: "auth", middleware: "auth", authWide: true });

const { t } = useI18n();
const localePath = useLocalePath();
const toast = useToast();
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
    toast.add({ title: t("onboarding.success"), icon: "i-lucide-check" });
    await navigateTo(localePath("/find"));
  } catch (error) {
    if (errorCode(error) === "PROFILE_EXISTS") {
      toast.add({ title: t("onboarding.errors.profileExists"), icon: "i-lucide-info" });
      await navigateTo(localePath("/find"));
      return;
    }
    toast.add({ title: t("onboarding.errors.generic"), color: "error" });
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1
        class="font-display font-bold tracking-[-0.015em] text-[22px] md:text-[26px] text-highlighted"
      >
        {{ t("onboarding.title") }}
      </h1>
      <p class="mt-1 text-sm text-muted max-w-prose">{{ t("onboarding.subtitle") }}</p>
    </div>

    <ProfileForm
      :initial="{ displayName }"
      :submit-label="t('onboarding.submit')"
      :pending="isPending"
      :disabled="!ready"
      @submit="onSubmit"
    />
  </div>
</template>
