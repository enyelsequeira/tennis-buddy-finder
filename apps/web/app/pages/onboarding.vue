<script setup lang="ts">
import { api } from "@tennis-buddy-finder/backend/convex/_generated/api";
import type { ProfileInput } from "@tennis-buddy-finder/backend/convex/model/profileSchema";

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
// Keyed by user so another account in the same tab never sees this draft.
const draftKey = me.value ? `onboarding-draft:${me.value.user._id}` : undefined;

const { mutate: createProfile, isPending } = useConvexMutation(api.profiles.create);

async function onSubmit(input: ProfileInput) {
  try {
    await createProfile(input);
    if (draftKey) sessionStorage.removeItem(draftKey);
    await refresh();
    toast.add({ title: t("onboarding.success"), icon: "i-lucide-check" });
    await navigateTo(localePath("/find"));
  } catch (error) {
    if (convexErrorCode(error) === "PROFILE_EXISTS") {
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
      :draft-key="draftKey"
      :submit-label="t('onboarding.submit')"
      :pending="isPending"
      :disabled="!ready"
      @submit="onSubmit"
    />
  </div>
</template>
