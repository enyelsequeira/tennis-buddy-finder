<script setup lang="ts">
import { Button, Container, Group, Paper, Stack, Text, Title } from "@mantine-vue/core";
import { NuxtLinkLocale } from "#components";

const { t } = useI18n();
</script>

<template>
  <Container size="72rem" :pb="{ base: 64, xs: 80, md: 96 }">
    <Paper radius="xl" bg="court.6" c="white" :p="{ base: 'xl', sm: 48 }">
      <Stack gap="lg" align="center">
        <Title :order="2" :fz="{ base: 24, xs: 30, md: 36 }" ta="center" textWrap="balance">
          {{ t("cta.title") }}
        </Title>
        <Text :fz="{ base: 'md', xs: 'lg' }" c="court.0" ta="center" maw="65ch">
          {{ t("cta.description") }}
        </Text>
        <Group gap="sm" justify="center">
          <Button :component="NuxtLinkLocale" to="/register" size="xl" variant="white">
            {{ t("nav.createAccount") }}
          </Button>
          <Button
            :component="NuxtLinkLocale"
            to="/login"
            size="xl"
            variant="outline"
            color="court.0"
          >
            {{ t("nav.signIn") }}
          </Button>
        </Group>
      </Stack>
    </Paper>
  </Container>
</template>
