// src/theme/theme.ts
// "Soft Light Luxury" design system
// White cards · warm canvas · gold accents · dark only for key KPIs
export const theme = {
  colors: {
    // ── Canvas & cards ───────────────────────────────────────
    bg: "#f7f5ef",          // warm off-white page canvas
    bgSoft: "#f7f5ef",      // same — used interchangeably
    card: "#ffffff",        // primary card background
    cardAlt: "#fdfaf3",     // subtle gold-tint card variant
    surface: "#1f1f1f",     // dark card — KPI highlights ONLY
    surfaceSoft: "#2a2a2a", // nested dark surface
    surfaceLight: "#ffffff",// light surface (modals, popovers)

    // ── Borders ──────────────────────────────────────────────
    border: "#e6dcc6",        // soft gold border (cards, inputs)
    borderLight: "#e6dcc6",   // alias
    borderDark: "rgba(212,175,55,0.18)", // border on dark cards

    // ── Text ─────────────────────────────────────────────────
    ink: "#1a1a1a",           // primary text on light bg
    inkOnDark: "#ffffff",     // primary text on dark card
    muted: "#6b6b6b",         // secondary text on light bg
    mutedOnDark: "#a3a3a3",   // secondary text on dark card
    mutedSoft: "#9b8c70",

    // ── Gold ─────────────────────────────────────────────────
    gold: "#c9a227",          // primary gold (buttons, accents)
    goldDark: "#a8841a",      // pressed / darker gold
    goldLight: "#dfc04a",
    goldSoft: "#e8d9a8",      // active nav, light badges
    gold2: "#f5e7b3",         // very light gold tint

    // ── Sidebar ──────────────────────────────────────────────
    sidebar: "#ffffff",
    sidebar2: "#fdfaf3",
    sidebarBorder: "#e6dcc6",

    // ── Semantic ─────────────────────────────────────────────
    danger: "#b42318",
    dangerSoft: "#fee4e2",
    success: "#166534",
    successSoft: "#dcfce7",
    info: "#1d4ed8",
    infoSoft: "#dbeafe",
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },

  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 30,
  },

  // Soft shadow for light cards
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    // Stronger shadow for dark KPI cards
    dark: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    },
    gold: {
      shadowColor: "#c9a227",
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
  },

  typography: {
    h1: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
    h2: { fontSize: 18, fontWeight: "600" as const, letterSpacing: -0.2 },
    body: { fontSize: 15, fontWeight: "400" as const },
    small: { fontSize: 13, fontWeight: "400" as const },
    label: { fontSize: 13, fontWeight: "500" as const },
  },
} as const;

export type Theme = typeof theme;
