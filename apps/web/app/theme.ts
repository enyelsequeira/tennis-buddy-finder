import type { MantineColorsTuple, MantineThemeOverride } from "@mantine-vue/core";

const court: MantineColorsTuple = [
  "#eff5fb",
  "#dce9f6",
  "#b4cdea",
  "#7faad9",
  "#4f8ac7",
  "#2f6fb3",
  "#25598f",
  "#1f4a75",
  "#1b3d5f",
  "#16314d",
];

const surround: MantineColorsTuple = [
  "#eef7f2",
  "#d6ecdf",
  "#aedac2",
  "#7cc09d",
  "#4e9e78",
  "#2e7d5b",
  "#246549",
  "#1e523c",
  "#1a4232",
  "#16372a",
];

const ball: MantineColorsTuple = [
  "#fafee6",
  "#f6fbd3",
  "#edf8a3",
  "#e4f56b",
  "#ddf43c",
  "#d9f21b",
  "#b8cf0d",
  "#8e9f0c",
  "#6b7a0a",
  "#55600f",
];

const slate: MantineColorsTuple = [
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#cbd5e1",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#334155",
  "#1e293b",
  "#0f172a",
];

export const theme = {
  colors: { court, surround, ball, slate },
  primaryColor: "court",
  primaryShade: { light: 5, dark: 4 },
  defaultRadius: "md",
  fontFamily: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
  headings: {
    fontFamily: '"Bricolage Grotesque", "Instrument Sans", ui-sans-serif, system-ui, sans-serif',
    fontWeight: "700",
  },
  radius: { xs: "0.25rem", sm: "0.375rem", md: "0.5rem", lg: "0.75rem", xl: "1rem" },
  cursorType: "pointer",
} satisfies MantineThemeOverride;
