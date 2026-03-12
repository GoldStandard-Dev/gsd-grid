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
    color: theme.colors.mutedSoft,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 0.2,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
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
});