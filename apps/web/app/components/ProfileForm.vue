<script setup lang="ts">
import {
  Box,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine-vue/core";
import { useForm, type FormErrors } from "@mantine-vue/form";
import {
  NTRP_VALUES,
  profileInputSchema,
  type ProfileInput,
} from "@tennis-buddy-finder/backend/convex/model/profileSchema";
import type * as z from "zod";

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
    value: ntrpValue(value),
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

/**
 * What the inputs hold, as opposed to what the schema accepts: radio values
 * are strings, a cleared `Select` yields `null` and an emptied `NumberInput`
 * yields `""`. `toInput` converts back before every parse.
 */
interface ProfileFormValues {
  displayName: string;
  birthDate: string;
  gender: ProfileInput["gender"] | null;
  ntrp: string;
  yearsPlaying: number | string;
  formats: ProfileInput["formats"] | null;
  handedness: ProfileInput["handedness"] | null;
  languages: string[];
  bio: string;
}

/** `3.5` -> `"3.5"`: the radio value of an NTRP rating. */
function ntrpValue(value: number) {
  return value.toFixed(1);
}

function toInput(values: ProfileFormValues) {
  return {
    ...values,
    gender: values.gender ?? undefined,
    handedness: values.handedness ?? undefined,
    formats: values.formats ?? undefined,
    ntrp: values.ntrp === "" ? undefined : Number(values.ntrp),
    yearsPlaying: values.yearsPlaying === "" ? undefined : values.yearsPlaying,
  };
}

/**
 * Translated validation messages. The shared zod schema reports either plain
 * zod text or a backend code (`UNDERAGE`, `INVALID_BIRTH_DATE`, `INVALID_NTRP`),
 * so `validate` below maps every issue to a translated field error. Going
 * through `validate` (instead of translating on submit) keeps the messages
 * translated on blur validation too, not only on submit.
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

function translateIssue(issue: z.core.$ZodIssue) {
  // Collapse `languages.0` to `languages` so the field picks the error up.
  const name = String(issue.path[0] ?? "");
  if (!isValidationField(name)) return { field: name, message: issue.message };
  const key = name === "birthDate" && issue.message === "UNDERAGE" ? "underage" : name;
  return { field: name, message: t(`onboarding.validation.${key}`) };
}

function validate(values: ProfileFormValues): FormErrors {
  const result = profileInputSchema.safeParse(toInput(values));
  if (result.success) return {};
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const { field, message } = translateIssue(issue);
    errors[field] ??= message;
  }
  return errors;
}

const form = useForm<ProfileFormValues>({
  initialValues: {
    displayName: props.initial?.displayName ?? "",
    birthDate: props.initial?.birthDate ?? "",
    gender: props.initial?.gender ?? null,
    ntrp: props.initial?.ntrp === undefined ? "" : ntrpValue(props.initial.ntrp),
    yearsPlaying: props.initial?.yearsPlaying ?? 0,
    formats: props.initial?.formats ?? null,
    handedness: props.initial?.handedness ?? null,
    languages: [...(props.initial?.languages ?? ["pt"])],
    bio: props.initial?.bio ?? "",
  },
  validate,
  validateInputOnBlur: true,
});

const bioLength = computed(() => form.values.value.bio.length);
const bioDescription = computed(
  () =>
    `${t("onboarding.optional")} · ${t("onboarding.fields.bioCounter", { count: bioLength.value })}`,
);

const handleSubmit = form.onSubmit((values) => {
  const result = profileInputSchema.safeParse(toInput(values));
  if (!result.success) return;
  emit("submit", { ...result.data, bio: result.data.bio?.trim() || undefined });
});
</script>

<template>
  <form novalidate @submit="handleSubmit">
    <Stack gap="xl">
      <Stack gap="md">
        <Title :order="2" :fz="15">{{ t("onboarding.sections.aboutYou") }}</Title>

        <TextInput
          :label="t('onboarding.fields.displayName')"
          :placeholder="t('onboarding.fields.displayNamePlaceholder')"
          autocomplete="nickname"
          :maxlength="40"
          size="lg"
          with-asterisk
          v-bind="form.getInputProps('displayName')"
        />

        <TextInput
          v-if="!hideBirthDate"
          :label="t('onboarding.fields.birthDate')"
          type="date"
          autocomplete="bday"
          size="lg"
          with-asterisk
          v-bind="form.getInputProps('birthDate')"
        />

        <Select
          :label="t('onboarding.fields.gender')"
          :description="t('onboarding.optional')"
          :data="genderItems"
          clearable
          size="lg"
          v-bind="form.getInputProps('gender')"
        />
      </Stack>

      <Stack gap="md">
        <Title :order="2" :fz="15">{{ t("onboarding.sections.yourTennis") }}</Title>

        <Radio.Group
          :label="t('onboarding.fields.ntrp')"
          :description="t('onboarding.fields.ntrpHelp')"
          with-asterisk
          v-bind="form.getInputProps('ntrp')"
        >
          <Stack gap="xs" mt="xs">
            <Radio.Card
              v-for="item in ntrpItems"
              :key="item.value"
              :value="item.value"
              radius="lg"
              p="md"
            >
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <Radio.Indicator :mt="2" />
                <div>
                  <Text ff="heading" fw="700" fz="md" lh="1.3">{{ item.label }}</Text>
                  <Text size="sm" c="dimmed" maw="65ch">{{ item.description }}</Text>
                </div>
              </Group>
            </Radio.Card>
          </Stack>
        </Radio.Group>

        <NumberInput
          :label="t('onboarding.fields.yearsPlaying')"
          :min="0"
          :max="90"
          :allow-decimal="false"
          :allow-negative="false"
          size="lg"
          with-asterisk
          v-bind="form.getInputProps('yearsPlaying')"
        />

        <Radio.Group
          :label="t('onboarding.fields.formats')"
          with-asterisk
          v-bind="form.getInputProps('formats')"
        >
          <Group gap="md" mt="xs">
            <Radio
              v-for="item in formatItems"
              :key="item.value"
              :value="item.value"
              :label="item.label"
            />
          </Group>
        </Radio.Group>

        <Select
          :label="t('onboarding.fields.handedness')"
          :description="t('onboarding.optional')"
          :data="handednessItems"
          clearable
          size="lg"
          v-bind="form.getInputProps('handedness')"
        />
      </Stack>

      <Stack gap="md">
        <Title :order="2" :fz="15">{{ t("onboarding.sections.languages") }}</Title>

        <Checkbox.Group
          :label="t('onboarding.fields.languages')"
          with-asterisk
          v-bind="form.getInputProps('languages')"
        >
          <Group gap="md" mt="xs">
            <Checkbox
              v-for="item in languageItems"
              :key="item.value"
              :value="item.value"
              :label="item.label"
            />
          </Group>
        </Checkbox.Group>
      </Stack>

      <Stack gap="md">
        <Title :order="2" :fz="15">{{ t("onboarding.sections.bio") }}</Title>

        <Textarea
          :label="t('onboarding.fields.bio')"
          :description="bioDescription"
          :placeholder="t('onboarding.fields.bioPlaceholder')"
          :maxlength="PROFILE_BIO_MAX"
          autosize
          :min-rows="3"
          :max-rows="8"
          size="lg"
          v-bind="form.getInputProps('bio')"
        />
      </Stack>

      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Box component="span" c="dimmed" :mt="2" display="inline-flex" style="flex-shrink: 0">
          <Icon name="lucide:map-pin" size="16" />
        </Box>
        <div>
          <Text size="sm" fw="500">{{ t("onboarding.location") }}</Text>
          <Text size="sm" c="dimmed">{{ t("onboarding.locationHelp") }}</Text>
        </div>
      </Group>

      <Button type="submit" size="lg" full-width :loading="pending" :disabled="disabled">
        {{ submitLabel }}
      </Button>
    </Stack>
  </form>
</template>
