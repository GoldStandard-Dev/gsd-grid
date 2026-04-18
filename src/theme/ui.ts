// src/theme/ui.ts
import { StyleSheet } from "react-native";
import { theme } from "./theme";

export const ui = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },

  container: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
  },

  authContainer: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },

  appContent: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },

  authSplit: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.lg,
    justifyContent: "space-between",
  },

  authFormPane: {
    flex: 1.5,
    minWidth: 320,
  },

  authBrandPane: {
    flex: 1,
    minWidth: 280,
    backgroundColor: theme.colors.surface2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 32,
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },

  cardTight: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    ...theme.shadow.card,
  },

  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    ...theme.shadow.card,
  },

  heroDark: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    padding: theme.spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    flexWrap: "wrap",
    ...theme.shadow.card,
  },

  heroDarkPanel: {
    minWidth: 260,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    justifyContent: "center",
  },

  heroDarkTitle: {
    color: theme.colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },

  heroDarkSubtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    marginTop: 10,
  },

  heroDarkPanelValue: {
    color: theme.colors.ink,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },

  heroDarkPanelText: {
    marginTop: 10,
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },

  h1: {
    color: theme.colors.ink,
    ...theme.typography.h1,
  },

  h2: {
    color: theme.colors.ink,
    ...theme.typography.h2,
  },

  sub: {
    color: theme.colors.muted,
    marginTop: 6,
    ...theme.typography.body,
  },

  label: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.1,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "500",
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },

  inputSoft: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 16,
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "500",
  },

  inputDisabled: {
    opacity: 0.7,
    backgroundColor: theme.colors.mutedSurface,
  },

  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },

  section: {
    marginTop: theme.spacing.md,
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },

  muted: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },

  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },

  alertError: {
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  alertErrorText: {
    color: theme.colors.danger,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },

  alertSuccess: {
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  alertSuccessText: {
    color: theme.colors.success,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },

  bannerError: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerErrorText: {
    color: "#991b1b",
    fontWeight: "800",
  },

  bannerSuccess: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
  },

  primaryBtn: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primaryHover,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 18,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  primaryBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900" as const,
  },

  primaryBtnDisabled: {
    opacity: 0.7,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },

  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  pillActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primaryLight,
  },

  pillText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  pillTextActive: {
    color: theme.colors.primaryHover,
  },

  secondaryBtn: {
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  secondaryBtnText: {
    color: theme.colors.primaryHover,
    fontSize: 14,
    fontWeight: "700",
  },

  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    alignItems: "center",
  },

  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
  },
});
