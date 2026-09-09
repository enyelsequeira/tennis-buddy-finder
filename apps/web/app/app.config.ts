const displayTitle = "font-display tracking-[-0.015em]";

export default defineAppConfig({
  ui: {
    colors: {
      primary: "court",
      secondary: "surround",
      success: "surround",
      warning: "ball",
      error: "red",
      info: "court",
      neutral: "slate",
    },
    card: {
      slots: {
        root: "rounded-2xl",
      },
    },
    pageHero: {
      slots: {
        title: displayTitle,
      },
    },
    pageSection: {
      slots: {
        title: displayTitle,
      },
    },
    pageCTA: {
      slots: {
        root: "rounded-2xl",
        title: displayTitle,
      },
    },
  },
});
