import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "./Screen";
import { theme } from "../theme/theme";

type PortalStat = {
  label: string;
  value: string;
  meta: string;
};

type PortalSection = {
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function MobilePortalPage({
  eyebrow,
  title,
  subtitle,
  stats,
  sections,
  primaryAction,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  stats?: PortalStat[];
  sections: PortalSection[];
  primaryAction?: string;
}) {
  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {stats?.length ? (
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statMeta}>{stat.meta}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionList}>
          {sections.map((section) => (
            <View key={section.title} style={styles.sectionCard}>
              <View style={styles.iconTile}>
                <Ionicons name={section.icon} size={20} color={theme.colors.primaryHover} />
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {primaryAction ? (
          <View style={styles.stickyAction}>
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
              <Text style={styles.primaryButtonText}>{primaryAction}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 18,
    paddingBottom: 18,
  },
  header: {
    gap: 6,
  },
  eyebrow: {
    color: theme.colors.primaryHover,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.ink,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: 150,
    minHeight: 116,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
  },
  statLabel: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    marginTop: 10,
    color: theme.colors.ink,
    fontSize: 26,
    fontWeight: "900",
  },
  statMeta: {
    marginTop: 5,
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  sectionList: {
    gap: 12,
  },
  sectionCard: {
    minHeight: 94,
    flexDirection: "row",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 16,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCopy: {
    flex: 1,
    gap: 5,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  stickyAction: {
    paddingTop: 4,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    backgroundColor: theme.colors.primaryHover,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
});
