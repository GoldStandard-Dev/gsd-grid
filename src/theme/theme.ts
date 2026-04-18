// src/theme/theme.ts
export const theme = {
  colors: {
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    primaryActive: "#1E40AF",
    primaryLight: "#DBEAFE",
    primarySoft: "#EFF6FF",

    bg: "#F8FAFC",
    surface: "#FFFFFF",
    surface2: "#EFF6FF",
    mutedSurface: "#F1F5F9",
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",

    ink: "#0F172A",
    ink2: "#1E293B",
    muted: "#475569",
    mutedSoft: "#64748B",

    // Legacy aliases kept so existing screens inherit the new SaaS-blue system.
    gold: "#2563EB",
    gold2: "#EFF6FF",
    goldDark: "#1D4ED8",
    goldLight: "#60A5FA",

    sidebar: "#FFFFFF",
    sidebar2: "#EFF6FF",
    sidebarBorder: "#E2E8F0",

    danger: "#EF4444",
    dangerBg: "#FEF2F2",
    dangerBorder: "#FECACA",

    success: "#10B981",
    successBg: "#ECFDF5",
    successBorder: "#A7F3D0",

    warning: "#F59E0B",
    warningBg: "#FFFBEB",
    warningBorder: "#FDE68A",

    info: "#6366F1",
    infoBg: "#EEF2FF",
    infoBorder: "#C7D2FE"
  },
  radius: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 20
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
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1
    }
  },
  typography: {
    h1: { fontSize: 30, fontWeight: "900" as const, letterSpacing: 0.1 },
    h2: { fontSize: 22, fontWeight: "800" as const, letterSpacing: 0.1 },
    body: { fontSize: 14, fontWeight: "500" as const },
    small: { fontSize: 13, fontWeight: "500" as const }
  }
} as const;

export type Theme = typeof theme;
