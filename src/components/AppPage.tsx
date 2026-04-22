import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { theme } from "../theme/theme";

type Action = {
  label: string;
  onPress?: () => void;
  primary?: boolean;
};

export function AppPage({
  children,
  scroll = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  if (!scroll) {
    return (
      <View style={[styles.page, style]}>
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.inner, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: Action[];
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>

      {actions?.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.actionBtn,
                action.primary ? styles.actionBtnPrimary : null,
                pressed ? (action.primary ? styles.actionBtnPrimaryPressed : styles.actionBtnPressed) : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text
                style={[
                  styles.actionText,
                  action.primary ? styles.actionTextPrimary : null,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SummaryStrip({ children }: { children: ReactNode }) {
  return <View style={styles.summaryStrip}>{children}</View>;
}

export function SummaryCard({
  label,
  value,
  meta,
  accent = "purple",
  trend,
  onPress,
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: "purple" | "indigo" | "teal" | "violet" | "plum" | "lavender";
  trend?: { value: string; tone?: "positive" | "negative" | "neutral" };
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.summaryCard,
        styles.summaryCardActive,
        pressed ? styles.summaryCardPressed : null,
      ]}
    >
      <View style={[styles.summaryAccent, accentMap[accent]]} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
      {trend ? (
        <Text
          style={[
            styles.summaryTrend,
            trend.tone === "positive"
              ? styles.summaryTrendPositive
              : trend.tone === "negative"
                ? styles.summaryTrendNegative
                : styles.summaryTrendNeutral,
          ]}
        >
          {trend.value}
        </Text>
      ) : null}
      {meta ? <Text style={styles.summaryMeta}>{meta}</Text> : null}
    </Pressable>
  );
}

export function ContentCard({
  title,
  subtitle,
  meta,
  children,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.contentCard}>
      <View style={styles.contentHeader}>
        <View style={styles.contentHeaderCopy}>
          <Text style={styles.contentTitle}>{title}</Text>
          {subtitle ? <Text style={styles.contentSubtitle}>{subtitle}</Text> : null}
        </View>
        {meta ? <Text style={styles.contentMeta}>{meta}</Text> : null}
      </View>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

export function SoftAccentCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.softCard}>
      <Text style={styles.softTitle}>{title}</Text>
      {body ? <Text style={styles.softBody}>{body}</Text> : null}
      {children}
    </View>
  );
}

const accentMap = StyleSheet.create({
  purple: { backgroundColor: theme.colors.primary },
  indigo: { backgroundColor: theme.colors.info },
  teal: { backgroundColor: "#0F766E" },
  violet: { backgroundColor: "#3B82F6" },
  plum: { backgroundColor: "#0F172A" },
  lavender: { backgroundColor: "#60A5FA" },
});

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  inner: {
    width: "100%",
    maxWidth: 1360,
    alignSelf: "center",
    padding: 24,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  headerCopy: {
    flex: 1,
    minWidth: 280,
  },
  eyebrow: {
    color: theme.colors.goldDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
    color: theme.colors.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 6,
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    maxWidth: 760,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  actionBtn: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  actionBtnPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primaryLight,
  },
  actionBtnPrimaryPressed: {
    backgroundColor: theme.colors.primaryHover,
    borderColor: theme.colors.primaryHover,
  },
  actionText: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
  },
  actionTextPrimary: {
    color: "#FFFFFF",
  },
  summaryStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: 220,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 18,
    minHeight: 144,
  },
  summaryCardActive: {
    borderColor: theme.colors.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  summaryCardPressed: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primaryLight,
  },
  summaryAccent: {
    width: 36,
    height: 4,
    borderRadius: 999,
    marginBottom: 14,
  },
  summaryLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  summaryValue: {
    marginTop: 10,
    color: theme.colors.ink,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: "900",
  },
  summaryMeta: {
    marginTop: 6,
    color: theme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "500",
  },
  summaryTrend: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "800",
  },
  summaryTrendPositive: {
    color: "#15803D",
  },
  summaryTrendNegative: {
    color: "#B42318",
  },
  summaryTrendNeutral: {
    color: theme.colors.primaryHover,
  },
  contentCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  contentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  contentHeaderCopy: {
    flex: 1,
    minWidth: 240,
  },
  contentTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  contentSubtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  contentMeta: {
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  softCard: {
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  softTitle: {
    color: theme.colors.primaryHover,
    fontSize: 14,
    fontWeight: "900",
  },
  softBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.9,
  },
});
