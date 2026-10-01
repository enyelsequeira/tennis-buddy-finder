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
    // Login / register (pages/(auth)/*). Left-aligned inside the auth layout
    // column instead of the centred default, with the display title.
    authForm: {
      slots: {
        header: "text-left",
        title: `${displayTitle} font-bold text-[22px] md:text-[26px]`,
        description: "text-sm",
        body: "gap-y-5",
        providers: "space-y-2",
        form: "space-y-4",
        footer: "text-left mt-0",
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
