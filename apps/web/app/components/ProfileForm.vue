<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import {
  NTRP_VALUES,
  profileInputSchema,
  type ProfileInput,
} from "@tennis-buddy-finder/backend/convex/model/profileSchema";

/**
 * The profile form shared by onboarding (create) and settings (edit). It owns
 * the fields, option lists and translated validation; the parent owns the
 * mutation. With `hideBirthDate` the birth date field is not rendered but the
 * value from `initial` stays in the state so the shared schema still passes.
 */
const props = defineProps<{
  initial?: Partial<ProfileInput>;
  submitLabel: string;
  pending?: boolean;
  disabled?: boolean;
  hideBirthDate?: boolean;
}>();

const emit = defineEmits<{ submit: [input: ProfileInput] }>();

const { t } = useI18n();

const ntrpItems = computed(() =>
  NTRP_VALUES.map((value) => ({
    value,
    label: value.toFixed(1),
    description: t(`onboarding.ntrpLevels.${ntrpKey(value)}`),
  })),
);
const formatItems = computed(() =>
  PROFILE_FORMATS.map((value) => ({ value, label: t(`onboarding.formatOptions.${value}`) })),
);
const genderItems = computed(() =>
  PROFILE_GENDERS.map((value) => ({ value, label: t(`onboarding.genderOptions.${value}`) })),
);
const handednessItems = computed(() =>
  PROFILE_HANDS.map((value) => ({ value, label: t(`onboarding.handednessOptions.${value}`) })),
);
// `value` is widened to string to match `ProfileInput.languages: string[]`.
const languageItems = computed(() =>
  PROFILE_LANGUAGES.map((code) => ({
    value: String(code),
    label: t(`onboarding.languageOptions.${code}`),
  })),
);

const state = reactive<Partial<ProfileInput>>({
  displayName: props.initial?.displayName ?? "",
  birthDate: props.initial?.birthDate ?? "",
  gender: props.initial?.gender,
  ntrp: props.initial?.ntrp,
  yearsPlaying: props.initial?.yearsPlaying ?? 0,
  formats: props.initial?.formats,
  handedness: props.initial?.handedness,
  languages: [...(props.initial?.languages ?? ["pt"])],
  bio: props.initial?.bio ?? "",
});

const bioLength = computed(() => state.bio?.length ?? 0);

/**
 * Translated validation messages. The shared zod schema reports either plain
 * zod text or a backend code (`UNDERAGE`, `INVALID_BIRTH_DATE`, `INVALID_NTRP`),
 * so `schema` below wraps it as a Standard Schema that rewrites every issue's
 * message by field. Wrapping (instead of `@error`) keeps the messages
 * translated on blur and input validation too, not only on submit.
 */
const VALIDATION_FIELDS = [
  "displayName",
  "birthDate",
  "ntrp",
  "yearsPlaying",
  "formats",
  "languages",
  "bio",
] as const;
type ValidationField = (typeof VALIDATION_FIELDS)[number];

const isValidationField = (name: string): name is ValidationField =>
  (VALIDATION_FIELDS as readonly string[]).includes(name);

type StandardValidate = (typeof profileInputSchema)["~standard"]["validate"];
type StandardIssue = NonNullable<Awaited<ReturnType<StandardValidate>>["issues"]>[number];

function fieldName(issue: StandardIssue) {
  const head = issue.path?.[0];
  if (head === undefined) return "";
  return String(typeof head === "object" ? head.key : head);
}

function translateIssue(issue: StandardIssue): StandardIssue {
  const name = fieldName(issue);
  if (!isValidationField(name)) return issue;
  const key = name === "birthDate" && issue.message === "UNDERAGE" ? "underage" : name;
  // Collapse `languages.0` to `languages` so the field picks the error up.
  return { message: t(`onboarding.validation.${key}`), path: [name] };
}

const schema = computed(() => ({
  "~standard": {
    ...profileInputSchema["~standard"],
    validate: async (value: unknown) => {
      const result = await profileInputSchema["~standard"].validate(value);
      return result.issues ? { issues: result.issues.map(translateIssue) } : result;
    },
  },
}));

function onSubmit(event: FormSubmitEvent<ProfileInput>) {
  emit("submit", { ...event.data, bio: event.data.bio?.trim() || undefined });
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-8" @submit="onSubmit">
    <section class="space-y-4">
      <h2 class="font-display font-bold text-[15px] text-highlighted">
        {{ t("onboarding.sections.aboutYou") }}
      </h2>

      <UFormField name="displayName" :label="t('onboarding.fields.displayName')" required>
        <UInput
          v-model="state.displayName"
          autocomplete="nickname"
          size="lg"
          class="w-full"
          :maxlength="40"
          :placeholder="t('onboarding.fields.displayNamePlaceholder')"
        />
      </UFormField>

      <UFormField
        v-if="!hideBirthDate"
        name="birthDate"
        :label="t('onboarding.fields.birthDate')"
        required
      >
        <UInput
          v-model="state.birthDate"
          type="date"
          autocomplete="bday"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="gender"
        :label="t('onboarding.fields.gender')"
        :hint="t('onboarding.optional')"
      >
        <USelect
          v-model="state.gender"
          :items="genderItems"
          value-key="value"
          size="lg"
          class="w-full"
        />
      </UFormField>
    </section>

    <section class="space-y-4">
      <h2 class="font-display font-bold text-[15px] text-highlighted">
        {{ t("onboarding.sections.yourTennis") }}
      </h2>

      <UFormField
        name="ntrp"
        :label="t('onboarding.fields.ntrp')"
        :description="t('onboarding.fields.ntrpHelp')"
        required
      >
        <URadioGroup
          v-model="state.ntrp"
          variant="card"
          :items="ntrpItems"
          value-key="value"
          :ui="{
            fieldset: 'gap-2',
            label: 'font-display font-bold text-base',
            description: 'max-w-prose',
          }"
        />
      </UFormField>

      <UFormField name="yearsPlaying" :label="t('onboarding.fields.yearsPlaying')" required>
        <UInputNumber v-model="state.yearsPlaying" :min="0" :max="90" size="lg" class="w-full" />
      </UFormField>

      <UFormField name="formats" :label="t('onboarding.fields.formats')" required>
        <URadioGroup
          v-model="state.formats"
          orientation="horizontal"
          :items="formatItems"
          value-key="value"
        />
      </UFormField>

      <UFormField
        name="handedness"
        :label="t('onboarding.fields.handedness')"
        :hint="t('onboarding.optional')"
      >
        <USelect
          v-model="state.handedness"
          :items="handednessItems"
          value-key="value"
          size="lg"
          class="w-full"
        />
      </UFormField>
    </section>

    <section class="space-y-4">
      <h2 class="font-display font-bold text-[15px] text-highlighted">
        {{ t("onboarding.sections.languages") }}
      </h2>

      <UFormField name="languages" :label="t('onboarding.fields.languages')" required>
        <UCheckboxGroup
          v-model="state.languages"
          orientation="horizontal"
          :items="languageItems"
          value-key="value"
        />
      </UFormField>
    </section>

    <section class="space-y-4">
      <h2 class="font-display font-bold text-[15px] text-highlighted">
        {{ t("onboarding.sections.bio") }}
      </h2>

      <UFormField
        name="bio"
        :label="t('onboarding.fields.bio')"
        :hint="t('onboarding.optional')"
        :help="t('onboarding.fields.bioCounter', { count: bioLength })"
      >
        <UTextarea
          v-model="state.bio"
          :maxlength="PROFILE_BIO_MAX"
          :rows="3"
          :maxrows="8"
          autoresize
          size="lg"
          class="w-full"
          :placeholder="t('onboarding.fields.bioPlaceholder')"
        />
      </UFormField>
    </section>

    <div class="flex items-start gap-2">
      <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0 text-muted" />
      <p class="text-sm">
        <span class="font-medium text-highlighted">{{ t("onboarding.location") }}</span>
        <span class="block text-muted">{{ t("onboarding.locationHelp") }}</span>
      </p>
    </div>

    <UButton
      type="submit"
      :label="submitLabel"
      size="lg"
      block
      :loading="pending"
      :disabled="disabled"
    />
  </UForm>
</template>
