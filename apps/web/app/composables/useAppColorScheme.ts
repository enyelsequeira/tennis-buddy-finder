import type { MantineColorScheme } from "@mantine-vue/core";

export function useAppColorScheme() {
  const scheme = useCookie<MantineColorScheme>("mantine-color-scheme", {
    default: () => "auto",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  function setScheme(value: MantineColorScheme) {
    scheme.value = value;
  }

  return { scheme, setScheme };
}
