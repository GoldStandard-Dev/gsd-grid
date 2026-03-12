// src/theme/theme.ts
export const theme = {
  colors: {
    bg: "#F7F4ED",
    surface: "#FFFCF6",
    surface2: "#FBF6EA",
    border: "#E8DFC7",

    ink: "#111111",
    ink2: "#1B1B1B",
    muted: "#6B6B6B",
    mutedSoft: "#8B7A60",

    gold: "#D4AF37",
    gold2: "#F5E7B3",
    goldDark: "#B8962E",
    goldLight: "#E7C55A",

    sidebar: "#FFFCF6",
    sidebar2: "#FBF6EA",
    sidebarBorder: "#E8DFC7",

    danger: "#B42318"
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 30
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2
    }
  },
  typography: {
    h1: { fontSize: 26, fontWeight: "900" as const, letterSpacing: 0.2 },
    h2: { fontSize: 16, fontWeight: "900" as const, letterSpacing: 0.2 },
    body: { fontSize: 15, fontWeight: "600" as const },
    small: { fontSize: 13, fontWeight: "600" as const }
  }
} as const;

export type Theme = typeof theme;
