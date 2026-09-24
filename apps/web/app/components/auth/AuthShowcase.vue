<script setup lang="ts">
import { Stack, Text, Title } from "@mantine-vue/core";

/**
 * Left half of the auth layout on desktop: a flat vector scene of a hard
 * court seen from the baseline, with a racket resting on the surface. Drawn
 * inline so it uses the Hard Court palette through Mantine CSS variables
 * (`--mantine-color-court-*`, `--mantine-color-surround-*`,
 * `--mantine-color-slate-*`) and needs no image asset.
 * Decorative: the SVG is hidden from assistive tech; the headline carries
 * the message. The layout decides at which breakpoint the panel shows;
 * `class`/`style` fall through to the root `aside`.
 */
const { t } = useI18n();

const STRING_STEP = 14;
/** String positions across the hoop, centred on the racket axis. */
const stringOffsets = Array.from({ length: 15 }, (_, i) => (i - 7) * STRING_STEP);
/** Grip wrap lines along the handle. */
const gripOffsets = Array.from({ length: 11 }, (_, i) => 262 + i * 14);
</script>

<template>
  <Stack
    component="aside"
    justify="space-between"
    :gap="40"
    pos="relative"
    bg="surround.7"
    c="white"
    :p="{ base: 40, lg: 56 }"
    style="overflow: hidden"
    :aria-label="t('auth.showcase.ariaLabel')"
  >
    <svg
      :class="$style.scene"
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="auth-racket-strings">
          <path d="M-50 82 Q0 68 50 82 A80 105 0 1 0 -50 82 Z" />
        </clipPath>
        <filter id="auth-racket-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <!-- Surround -->
      <rect width="800" height="1000" fill="var(--mantine-color-surround-7)" />

      <!-- Court surface in perspective: near baseline wide, far baseline narrow -->
      <polygon points="-80,960 880,960 530,330 270,330" fill="var(--mantine-color-court-6)" />

      <g fill="none" stroke="white" stroke-width="3" stroke-opacity="0.75" stroke-linecap="round">
        <!-- doubles sidelines and baselines -->
        <polygon points="-80,960 880,960 530,330 270,330" />
        <!-- singles sidelines -->
        <line x1="40" y1="960" x2="302" y2="330" />
        <line x1="760" y1="960" x2="498" y2="330" />
        <!-- near service line and centre service line -->
        <line x1="117" y1="775" x2="683" y2="775" />
        <line x1="400" y1="775" x2="400" y2="560" />
        <!-- far service line and centre service line -->
        <line x1="258" y1="436" x2="542" y2="436" />
        <line x1="400" y1="436" x2="400" y2="560" />
        <!-- centre marks -->
        <line x1="400" y1="960" x2="400" y2="944" />
        <line x1="400" y1="330" x2="400" y2="342" />
      </g>

      <!-- Net: mesh band, top tape and the line on the ground -->
      <rect x="120" y="516" width="560" height="44" fill="white" fill-opacity="0.14" />
      <g stroke="white" stroke-opacity="0.22" stroke-width="1">
        <line
          v-for="x in 27"
          :key="`net-v-${x}`"
          :x1="120 + x * 20"
          y1="516"
          :x2="120 + x * 20"
          y2="560"
        />
        <line x1="120" y1="531" x2="680" y2="531" />
        <line x1="120" y1="546" x2="680" y2="546" />
      </g>
      <line
        x1="120"
        y1="516"
        x2="680"
        y2="516"
        stroke="white"
        stroke-width="4"
        stroke-opacity="0.9"
      />
      <line
        x1="120"
        y1="560"
        x2="680"
        y2="560"
        stroke="white"
        stroke-width="3"
        stroke-opacity="0.6"
      />
      <rect x="114" y="504" width="8" height="60" rx="2" fill="var(--mantine-color-slate-8)" />
      <rect x="678" y="504" width="8" height="60" rx="2" fill="var(--mantine-color-slate-8)" />

      <!--
        Racket resting on the near court. Drawn upright around (0,0) = hoop
        centre, then scaled, laid onto the ground plane (vertical squash) and
        rotated. Hoop is an ellipse rx 80 / ry 105 open at the bottom, where
        two throat arms leave the rim and merge into the shaft; the yoke bar
        closes the string bed above the throat.
      -->
      <g transform="translate(470 700) scale(1 0.88) rotate(-30) scale(0.72)">
        <!-- shadow on the surface -->
        <g
          transform="translate(14 18)"
          fill="var(--mantine-color-court-9)"
          opacity="0.4"
          filter="url(#auth-racket-shadow)"
        >
          <ellipse cx="0" cy="0" rx="86" ry="111" />
          <polygon points="-40,90 -16,182 16,182 40,90" />
          <rect x="-16" y="178" width="32" height="250" rx="8" />
        </g>

        <!-- string bed, clipped to the hoop above the yoke -->
        <g
          clip-path="url(#auth-racket-strings)"
          stroke="white"
          stroke-opacity="0.55"
          stroke-width="1.6"
        >
          <line v-for="x in stringOffsets" :key="`s-v-${x}`" :x1="x" y1="-112" :x2="x" y2="92" />
          <line v-for="y in stringOffsets" :key="`s-h-${y}`" x1="-84" :y1="y" x2="84" :y2="y" />
        </g>

        <g
          fill="none"
          stroke="var(--mantine-color-slate-8)"
          stroke-width="10"
          stroke-linecap="round"
        >
          <!-- hoop, open between the throat arms -->
          <path d="M37.5 92.7 A80 105 0 1 0 -37.5 92.7" />
          <!-- yoke -->
          <path d="M-50 82 Q0 68 50 82" stroke-width="9" />
          <!-- throat arms -->
          <path d="M37.5 92.7 Q32 140 11 182 M-37.5 92.7 Q-32 140 -11 182" />
        </g>

        <!-- shaft and grip -->
        <rect x="-11" y="178" width="22" height="76" rx="4" fill="var(--mantine-color-slate-8)" />
        <rect x="-14" y="250" width="28" height="168" rx="6" fill="var(--mantine-color-slate-7)" />
        <g stroke="var(--mantine-color-slate-5)" stroke-width="2" stroke-linecap="round">
          <line v-for="y in gripOffsets" :key="`g-${y}`" x1="-12" :y1="y" x2="12" :y2="y + 7" />
        </g>
        <rect x="-16" y="412" width="32" height="16" rx="5" fill="var(--mantine-color-slate-9)" />
      </g>
    </svg>

    <Stack gap="md" pos="relative" maw="26rem">
      <Title :order="2" :fz="{ base: 30, lg: 36 }" lh="1.1" lts="-0.015em" c="white">
        {{ t("auth.showcase.title") }}
      </Title>
      <Text :fz="15" lh="1.625" c="surround.1" maw="65ch">
        {{ t("auth.showcase.description") }}
      </Text>
    </Stack>

    <Text size="sm" c="court.1" pos="relative">{{ t("app.location") }}</Text>
  </Stack>
</template>

<style module>
/* The scene fills the panel behind the copy; overflow/positioning is not a style prop. */
.scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
