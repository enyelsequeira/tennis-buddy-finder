<script setup lang="ts">
import { Button, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine-vue/core";
import { NuxtLinkLocale } from "#components";

const { t } = useI18n();
</script>

<template>
  <Container component="section" size="72rem" :py="{ base: 64, xs: 80, md: 96 }">
    <SimpleGrid :cols="{ base: 1, md: 2 }" :spacing="{ base: 32, md: 48 }">
      <Stack gap="xl" justify="center">
        <Title
          :order="1"
          :fz="{ base: 36, xs: 48, md: 56 }"
          :lh="1.05"
          maw="18ch"
          textWrap="balance"
        >
          {{ t("hero.title") }}
        </Title>
        <Text size="lg" c="dimmed" maw="65ch">{{ t("hero.description") }}</Text>
        <Group gap="sm">
          <Button :component="NuxtLinkLocale" to="/register" size="xl">
            {{ t("hero.primary") }}
          </Button>
          <Button
            :component="NuxtLinkLocale"
            to="/#how-it-works"
            size="xl"
            variant="subtle"
            color="gray"
          >
            {{ t("hero.secondary") }}
          </Button>
        </Group>
      </Stack>

      <LandingDemo />
    </SimpleGrid>
  </Container>
</template>
