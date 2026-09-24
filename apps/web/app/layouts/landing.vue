<script setup lang="ts">
import { ref } from "vue";
import { AppShell, Burger, Group, UnstyledButton, App } from "@mantine-vue/core";

const opened = ref(false);
</script>

<template>
  <AppShell
    :header="{ height: 60 }"
    :navbar="{ width: 300, breakpoint: 'sm', collapsed: { desktop: true, mobile: !opened } }"
    padding="md"
  >
    <AppShell.Header>
      <Group h="100%" px="md">
        <Burger :opened="opened" @click="opened = !opened" hidden-from="sm" size="sm" />
        <Group justify="space-between" style="flex: 1">
          Header
          <Group ml="xl" :gap="0" visible-from="sm">
            <UnstyledButton class="mobile-navbar-control">Home</UnstyledButton>
            <UnstyledButton class="mobile-navbar-control">Blog</UnstyledButton>
            <UnstyledButton class="mobile-navbar-control">Contacts</UnstyledButton>
            <UnstyledButton class="mobile-navbar-control">Support</UnstyledButton>
          </Group>
        </Group>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar py="md" :px="4">
      <UnstyledButton class="mobile-navbar-control">Home</UnstyledButton>
      <UnstyledButton class="mobile-navbar-control">Blog</UnstyledButton>
      <UnstyledButton class="mobile-navbar-control">Contacts</UnstyledButton>
      <UnstyledButton class="mobile-navbar-control">Support</UnstyledButton>
    </AppShell.Navbar>
    <AppShell.Main>Navbar is only visible on mobile.</AppShell.Main>
  </AppShell>
</template>
