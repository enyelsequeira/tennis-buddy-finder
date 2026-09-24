<script setup lang="ts">
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine-vue/core";
import type { PlayFormat, SlotStatus } from "~/types/slots";

/**
 * Translation playground. Shows every kind of translated output on one page
 * so a locale switch can be checked at a glance: static copy, dates from
 * useLisbonTime, plurals, status labels and the shared slot components.
 */

definePageMeta({
  layout: "landing",
});

const { t, locale, locales } = useI18n();
const time = useLisbonTime();
const { now, startOfDay, addDays, atTime, formatLongDay, formatShortDay, formatWeekday } = time;

useSeoMeta({
  title: () => t("playground.title"),
  description: () => t("playground.description"),
});

const firstDayMs = useState("landing-demo-first-day", () => startOfDay(now()));

const slots = computed(() => buildDemoSlots({ firstDayMs: firstDayMs.value, time }));
const sampleSlot = computed(() => slots.value[2]!);

const week = computed(() =>
  Array.from({ length: 7 }, (_, offset) => addDays(firstDayMs.value, offset)),
);

const sampleRange = computed(() => ({
  startAt: atTime({ dayMs: firstDayMs.value, hour: 18 }),
  endAt: atTime({ dayMs: firstDayMs.value, hour: 19, minute: 30 }),
}));

const COUNTS = [0, 1, 2, 7];
const REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
const SLOT_STATUSES: SlotStatus[] = ["open", "matched"];
const FORMATS: PlayFormat[] = ["singles", "doubles", "both"];

const requested = ref(false);
</script>

<template>
  <Container size="72rem" :py="{ base: 40, xs: 56 }">
    <Stack gap="xl">
      <Stack :gap="8">
        <Title :order="1" :fz="{ base: 30, xs: 36 }" lts="-0.015em">
          {{ t("playground.title") }}
        </Title>
        <Text c="dimmed" maw="65ch">{{ t("playground.description") }}</Text>
      </Stack>

      <SimpleGrid :cols="{ base: 1, sm: 2 }" spacing="md">
        <Card withBorder radius="lg" :p="{ base: 'md', xs: 'lg' }">
          <Card.Section withBorder inheritPadding py="md">
            <Title :order="2" ff="text" fw="600" fz="md">{{ t("playground.locale") }}</Title>
          </Card.Section>
          <dl :class="$style.facts">
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.current") }}</Text>
            <Text component="dd" size="sm" fw="600" m="0">{{ locale }}</Text>
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.available") }}</Text>
            <Text component="dd" size="sm" m="0">
              {{ locales.map((entry) => `${entry.code} (${entry.language})`).join(", ") }}
            </Text>
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.switch") }}</Text>
            <Text component="dd" size="sm" m="0"><LocaleSwitcher /></Text>
          </dl>
        </Card>

        <Card withBorder radius="lg" :p="{ base: 'md', xs: 'lg' }">
          <Card.Section withBorder inheritPadding py="md">
            <Title :order="2" ff="text" fw="600" fz="md">{{ t("playground.dates") }}</Title>
          </Card.Section>
          <dl :class="$style.facts">
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.longDay") }}</Text>
            <Text component="dd" size="sm" m="0">{{ formatLongDay(firstDayMs) }}</Text>
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.shortDay") }}</Text>
            <Text component="dd" size="sm" m="0">{{ formatShortDay(firstDayMs) }}</Text>
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.weekdays") }}</Text>
            <Text component="dd" size="sm" m="0">{{ week.map(formatWeekday).join(" · ") }}</Text>
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.range") }}</Text>
            <Text component="dd" size="sm" ff="heading" fw="700" m="0">
              {{ time.formatRange(sampleRange) }}
            </Text>
            <Text component="dt" size="sm" c="dimmed">{{ t("playground.duration") }}</Text>
            <Text component="dd" size="sm" m="0">{{ time.formatDuration(sampleRange) }}</Text>
          </dl>
        </Card>

        <Card withBorder radius="lg" :p="{ base: 'md', xs: 'lg' }">
          <Card.Section withBorder inheritPadding py="md">
            <Title :order="2" ff="text" fw="600" fz="md">{{ t("playground.plurals") }}</Title>
          </Card.Section>
          <Table fz="sm" :verticalSpacing="6" horizontalSpacing="0" tabularNums>
            <Table.Thead>
              <Table.Tr>
                <Table.Th c="dimmed" fw="500">n</Table.Th>
                <Table.Th c="dimmed" fw="500">slot.openCount</Table.Th>
                <Table.Th c="dimmed" fw="500">slot.count</Table.Th>
                <Table.Th c="dimmed" fw="500">player.playingYears</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr v-for="n in COUNTS" :key="n">
                <Table.Td>{{ n }}</Table.Td>
                <Table.Td>{{ t("slot.openCount", n) }}</Table.Td>
                <Table.Td>{{ t("slot.count", n) }}</Table.Td>
                <Table.Td>{{ t("player.playingYears", n) }}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        <Card withBorder radius="lg" :p="{ base: 'md', xs: 'lg' }">
          <Card.Section withBorder inheritPadding py="md">
            <Title :order="2" ff="text" fw="600" fz="md">{{ t("playground.statuses") }}</Title>
          </Card.Section>
          <Stack gap="md" pt="md">
            <Group :gap="8">
              <RequestStatusBadge
                v-for="status in REQUEST_STATUSES"
                :key="status"
                :status="status"
              />
            </Group>
            <Group gap="md">
              <Group v-for="status in SLOT_STATUSES" :key="status" :gap="8" wrap="nowrap">
                <SlotStatusDot :status="status" />
                <Text size="sm">{{ t(`slot.status.${status}`) }}</Text>
              </Group>
            </Group>
            <Group :gap="8">
              <Badge
                v-for="format in FORMATS"
                :key="format"
                color="gray"
                variant="light"
                tt="none"
                fw="500"
              >
                {{ t(`player.formats.${format}`) }}
              </Badge>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>

      <Stack gap="sm">
        <Title :order="2" ff="text" fw="600" fz="md">{{ t("playground.components") }}</Title>
        <SimpleGrid :cols="{ base: 1, sm: 2 }" spacing="md">
          <SlotCard :slot="sampleSlot" :requested="requested" @ask="requested = true" />
          <Paper withBorder radius="xl" :p="14">
            <Stack :gap="8">
              <SlotRow v-bind="sampleSlot" />
              <SlotRow v-bind="sampleRange" status="matched" venue="Parque das Abadias" />
              <Group v-if="requested">
                <Button variant="default" size="sm" @click="requested = false">
                  {{ t("playground.reset") }}
                </Button>
              </Group>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Stack>
  </Container>
</template>

<style module>
/* Label / value pairs: a two-column grid template is not expressible with props. */
.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: var(--mantine-spacing-lg);
  row-gap: rem(8px);
  margin: 0;
  padding-top: var(--mantine-spacing-md);
}
</style>
