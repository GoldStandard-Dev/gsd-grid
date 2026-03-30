// src/theme/theme.ts
// Premium design system: white background, black cards, gold accents
export const theme = {
  colors: {
    // Page / backgrounds
    bg: "#FFFFFF",          // white canvas
    bgSoft: "#FFFFFF",      // page background (white)
    surface: "#111111",     // black card (primary card background)
    surfaceSoft: "#1C1C1C", // slightly lighter black for nested rows
    surfaceLight: "#FFFDF8",// light card variant (modals, forms)

    // Borders
    border: "rgba(212,175,55,0.22)",   // faint gold border on dark cards
    borderLight: "#EDE8DA",             // light border for white cards/inputs

    // Text
    ink: "#111111",         // dark text on white backgrounds
    inkOnDark: "#FFFFFF",   // white text on black cards
    muted: "#6B6B6B",       // secondary text on white
    mutedOnDark: "#A3A3A3", // secondary text on black cards
    mutedSoft: "#8B7A60",

    // Gold
    gold: "#D4AF37",        // primary gold (buttons, accents)
    goldDark: "#B8962E",    // pressed/hover gold
    goldLight: "#E7C55A",
    goldSoft: "#FFF4D6",    // gold tint (light badge backgrounds)
    gold2: "#F5E7B3",

    // Sidebar (dark panel — unchanged)
    sidebar: "#111111",
    sidebar2: "#1A1A1A",
    sidebarBorder: "rgba(212,175,55,0.18)",

    // Semantic
    danger: "#B42318",
    dangerSoft: "#FEE4E2",
    success: "#166534",
    successSoft: "#DCFCE7",
    info: "#1D4ED8",
    infoSoft: "#DBEAFE",
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 30,
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    gold: {
      shadowColor: "#D4AF37",
      shadowOpacity: 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },
  typography: {
    h1: { fontSize: 26, fontWeight: "900" as const, letterSpacing: 0.2 },
    h2: { fontSize: 16, fontWeight: "900" as const, letterSpacing: 0.2 },
    body: { fontSize: 15, fontWeight: "600" as const },
    small: { fontSize: 13, fontWeight: "600" as const },
  },
} as const;

export type Theme = typeof theme;
