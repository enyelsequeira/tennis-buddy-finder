<script setup lang="ts">
import {
  Badge,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine-vue/core";

/**
 * The four steps are a real sequence, so they are numbered.
 * Each vignette reuses the same slot chip components as the app.
 */

const { t } = useI18n();
const { now, startOfDay, addDays, atTime, formatShortDay } = useLisbonTime();

const firstDayMs = useState("landing-demo-first-day", () => startOfDay(now()));
const dayMs = computed(() => addDays(firstDayMs.value, 1));
const matchedDayMs = computed(() => addDays(firstDayMs.value, 4));

const calendarSlots = computed(() => [
  {
    startAt: atTime({ dayMs: dayMs.value, hour: 18 }),
    endAt: atTime({ dayMs: dayMs.value, hour: 19, minute: 30 }),
    venue: DEMO_VENUES.clube,
  },
  {
    startAt: atTime({ dayMs: dayMs.value, hour: 20 }),
    endAt: atTime({ dayMs: dayMs.value, hour: 21, minute: 30 }),
  },
]);

const matchedSlot = computed(() => ({
  startAt: atTime({ dayMs: matchedDayMs.value, hour: 19 }),
  endAt: atTime({ dayMs: matchedDayMs.value, hour: 20 }),
  venue: DEMO_VENUES.clube,
}));

const filters = computed(() => [
  { label: t("steps.filters.evening"), active: true },
  { label: t("steps.filters.ntrp"), active: true },
  { label: t("steps.filters.singles"), active: false },
  { label: t("steps.filters.venue"), active: false },
]);

const STEP_KEYS = ["add", "find", "ask", "chat"] as const;

/** Rows inside a vignette sit on a hairline, like the calendar day sheet in the app. */
const ROW_DIVIDER = "border-top: 1px solid var(--mantine-color-default-border)";
</script>

<template>
  <Container
    id="how-it-works"
    component="section"
    size="72rem"
    :py="{ base: 64, xs: 80, md: 96 }"
    style="scroll-margin-top: 4rem"
  >
    <Stack gap="md" align="center">
      <Title :order="2" :fz="{ base: 30, xs: 36, md: 48 }" ta="center" textWrap="balance">
        {{ t("steps.title") }}
      </Title>
      <Text :fz="{ base: 'md', xs: 'lg' }" c="dimmed" ta="center" maw="65ch">
        {{ t("steps.description") }}
      </Text>
    </Stack>

    <SimpleGrid
      component="ol"
      :cols="{ base: 1, sm: 2 }"
      :spacing="{ base: 'md', xs: 'lg' }"
      :mt="{ base: 40, md: 48 }"
      p="0"
      m="0"
      style="list-style: none"
    >
      <Paper
        v-for="(key, index) in STEP_KEYS"
        :key="key"
        component="li"
        withBorder
        radius="xl"
        :p="{ base: 'lg', sm: 'xl' }"
      >
        <Stack gap="lg">
          <Paper withBorder radius="lg" p="md" bg="var(--mantine-color-body)">
            <!-- 160px minimum including the Paper's own padding. -->
            <Stack :gap="8" justify="center" :mih="128">
              <!-- 1: the calendar day sheet -->
              <template v-if="key === 'add'">
                <Group justify="space-between" align="baseline" gap="sm">
                  <Text ff="heading" fw="700" size="sm">{{ formatShortDay(dayMs) }}</Text>
                  <Text size="xs" c="dimmed">{{ t("slot.count", calendarSlots.length) }}</Text>
                </Group>
                <SlotRow
                  v-for="slot in calendarSlots"
                  :key="slot.startAt"
                  v-bind="slot"
                  status="open"
                  :style="ROW_DIVIDER"
                >
                  <template #trailing>
                    <Icon
                      name="lucide:x"
                      size="16"
                      style="color: var(--mantine-color-dimmed)"
                      aria-hidden="true"
                    />
                  </template>
                </SlotRow>
              </template>

              <!-- 2: filters and a day count -->
              <template v-else-if="key === 'find'">
                <Group :gap="6">
                  <Badge
                    v-for="filter in filters"
                    :key="filter.label"
                    :variant="filter.active ? 'light' : 'outline'"
                    :color="filter.active ? 'court' : 'gray'"
                    size="md"
                    tt="none"
                    fw="500"
                  >
                    {{ filter.label }}
                  </Badge>
                </Group>
                <Group justify="space-between" align="baseline" gap="sm" :mt="8">
                  <Text ff="heading" fw="700" size="sm">{{ formatShortDay(dayMs) }}</Text>
                  <Text size="xs" c="dimmed">{{ t("slot.openCount", 3) }}</Text>
                </Group>
                <PlayerIdentity :player="DEMO_PLAYERS.ana" :venue="DEMO_VENUES.clube" />
              </template>

              <!-- 3: a request waiting for an answer -->
              <template v-else-if="key === 'ask'">
                <Group justify="space-between" gap="sm" wrap="nowrap">
                  <PlayerIdentity :player="DEMO_PLAYERS.rui" />
                  <RequestStatusBadge status="pending" />
                </Group>
                <SlotRow v-bind="calendarSlots[0]!" status="open" :style="ROW_DIVIDER" />
                <Text size="sm">{{ t("steps.requestNote") }}</Text>
              </template>

              <!-- 4: chat with the matched slot pinned -->
              <template v-else>
                <Paper withBorder radius="md" px="sm" :mih="40">
                  <SlotRow v-bind="matchedSlot" status="matched" />
                </Paper>
                <Stack :gap="8" :mt="4">
                  <MessageBubble time="18:42">{{ t("steps.chatTheirs") }}</MessageBubble>
                  <MessageBubble mine time="18:50">{{ t("steps.chatMine") }}</MessageBubble>
                </Stack>
              </template>
            </Stack>
          </Paper>

          <Group gap="md" align="flex-start" wrap="nowrap">
            <Text
              ff="heading"
              fw="700"
              :fz="24"
              :lh="1"
              c="court"
              flex="0 0 auto"
              style="font-variant-numeric: tabular-nums"
              aria-hidden="true"
            >
              {{ index + 1 }}
            </Text>
            <Stack :gap="4">
              <Title :order="3" ff="text" fw="600" fz="md">
                <VisuallyHidden>{{ t("steps.stepLabel", { n: index + 1 }) }} </VisuallyHidden
                >{{ t(`steps.items.${key}.title`) }}
              </Title>
              <Text :fz="15" c="dimmed" maw="65ch">
                {{ t(`steps.items.${key}.description`) }}
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Paper>
    </SimpleGrid>
  </Container>
</template>
