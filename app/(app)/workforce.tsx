import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Screen from "../../src/components/Screen";
import { getUserOrgId } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";

type OrgMemberRow = {
  id: string;
  status?: string | null;
};

type InviteRow = {
  id: string;
  status?: string | null;
};

type ActivityRow = {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    status?: string | null;
    changed_fields?: string[];
  } | null;
};

type HrModule = {
  key: string;
  title: string;
  description: string;
  metric: string;
  status: "Ready" | "Review" | "Attention";
  icon: keyof typeof Ionicons.glyphMap;
  actionLabel: string;
  onPress: () => void;
};

const PAGE_BG = "#FFFFFF";
const CARD_BG = "#fffdf8";
const BORDER = "#e4d6b2";
const BORDER_SOFT = "#dcc89a";
const GOLD = "#c9a227";
const GOLD_BRIGHT = "#d4af37";
const TEXT = "#111111";
const MUTED = "#6f6a63";
const MUTED_2 = "#7b746b";
const DARK_CARD = "#111111";
const DARK_BORDER = "rgba(212, 175, 55, 0.35)";

const PALETTE = {
  bg: PAGE_BG,
  card: CARD_BG,
  cardSoft: CARD_BG,
  ink: theme.colors.ink,
  muted: theme.colors.muted,
  gold: GOLD_BRIGHT,
  goldDark: GOLD,
  goldSoft: "#FFF4D6",
  border: BORDER,
  green: "#166534",
  greenSoft: "#DCFCE7",
  red: "#B42318",
  redSoft: "#FEE4E2",
  blue: "#1D4ED8",
  blueSoft: "#DBEAFE",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusTone(status: HrModule["status"]) {
  if (status === "Ready") {
    return {
      bg: PALETTE.greenSoft,
      border: "#B7E4C7",
      text: PALETTE.green,
    };
  }

  if (status === "Attention") {
    return {
      bg: PALETTE.redSoft,
      border: "#FBCBC7",
      text: PALETTE.red,
    };
  }

  return {
    bg: PALETTE.goldSoft,
    border: "#ECD189",
    text: PALETTE.goldDark,
  };
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed ? styles.pressed : null]}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={18} color={PALETTE.goldDark} />
      </View>
      <Text style={styles.quickActionText}>{label}</Text>
    </Pressable>
  );
}

function HrModuleCard({ item }: { item: HrModule }) {
  const tone = statusTone(item.status);

  return (
    <Pressable onPress={item.onPress} style={({ pressed }) => [styles.moduleCard, pressed ? styles.pressed : null]}>
      <View style={styles.moduleTop}>
        <View style={styles.moduleIconWrap}>
          <Ionicons name={item.icon} size={18} color={PALETTE.goldDark} />
        </View>

        <View style={[styles.moduleStatus, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.moduleStatusText, { color: tone.text }]}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.moduleTitle}>{item.title}</Text>
      <Text style={styles.moduleDescription}>{item.description}</Text>

      <View style={styles.moduleBottom}>
        <Text style={styles.moduleMetric}>{item.metric}</Text>
        <View style={styles.moduleLinkRow}>
          <Text style={styles.moduleLinkText}>{item.actionLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color={PALETTE.ink} />
        </View>
      </View>
    </Pressable>
  );
}

function AlertRow({
  icon,
  title,
  sub,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  tone?: "default" | "warning" | "danger" | "good";
}) {
  const toneStyle =
    tone === "danger"
      ? styles.alertDanger
      : tone === "warning"
        ? styles.alertWarning
        : tone === "good"
          ? styles.alertGood
          : null;

  return (
    <View style={[styles.alertRow, toneStyle]}>
      <View style={styles.alertIconWrap}>
        <Ionicons name={icon} size={17} color={PALETTE.goldDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertSub}>{sub}</Text>
      </View>
    </View>
  );
}

function ActivityItem({
  item,
  onPress,
}: {
  item: ActivityRow;
  onPress: () => void;
}) {
  const actor = item.actor_name?.trim() || "Someone";
  const target = item.details?.name?.trim() || item.details?.email?.trim() || "employee record";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.activityItem, pressed ? styles.pressed : null]}>
      <View style={styles.activityDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {actor} {item.action} {target}
        </Text>
        <Text style={styles.activityMeta} numberOfLines={2}>
          {formatDateTime(item.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function WorkforcePage() {
  return (
    <Screen padded={false}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#111111",
          padding: 24,
        }}
      >
        <Ionicons name="construct-outline" size={48} color="#d4af37" />

        <Text
          style={{
            marginTop: 16,
            fontSize: 24,
            fontWeight: "900",
            color: "#ffffff",
          }}
        >
          Under Maintenance
        </Text>

        <Text
          style={{
            marginTop: 8,
            fontSize: 14,
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
            maxWidth: 320,
          }}
        >
          This page is currently being updated. Please check back soon.
        </Text>
      </View>
    </Screen>
  );
}


const styles = StyleSheet.create({
  page: {
    padding: 22,
    gap: 14,
    backgroundColor: PALETTE.bg,
  },

  heroCard: {
    backgroundColor: DARK_CARD,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    padding: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  heroCopy: {
    flex: 1,
    minWidth: 320,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: PALETTE.goldDark,
  },

  pageTitle: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  pageSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.76)",
    maxWidth: 760,
    fontWeight: "700",
  },

  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },

  primaryBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.goldDark,
    backgroundColor: PALETTE.gold,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  primaryBtnText: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "900",
  },

  secondaryBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  secondaryBtnText: {
    color: PALETTE.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  heroPanel: {
    width: 300,
    minHeight: 180,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECD189",
    backgroundColor: "#FFF8E8",
    padding: 18,
    gap: 10,
    justifyContent: "center",
  },

  heroPanelLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: PALETTE.goldDark,
  },

  heroPanelValue: {
    fontSize: 26,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  heroPanelText: {
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  errorBanner: {
    backgroundColor: PALETTE.redSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FBCBC7",
    padding: 14,
  },

  errorBannerText: {
    color: PALETTE.red,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 16,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8B7A60",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  statHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  quickAction: {
    flexGrow: 1,
    minWidth: 190,
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: PALETTE.goldSoft,
    borderWidth: 1,
    borderColor: "#ECD189",
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionText: {
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  mainGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "flex-start",
  },

  leftColumn: {
    flex: 1,
    minWidth: 320,
    gap: 14,
  },

  rightColumn: {
    width: 360,
    gap: 14,
  },

  panel: {
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 18,
    gap: 14,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  moduleCard: {
    flexGrow: 1,
    width: 250,
    backgroundColor: PALETTE.cardSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 16,
  },

  moduleTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  moduleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: PALETTE.goldSoft,
    borderWidth: 1,
    borderColor: "#ECD189",
    alignItems: "center",
    justifyContent: "center",
  },

  moduleStatus: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  moduleStatusText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  moduleTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  moduleDescription: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  moduleBottom: {
    marginTop: 14,
    gap: 10,
  },

  moduleMetric: {
    fontSize: 12,
    color: "#8B7A60",
    fontWeight: "800",
  },

  moduleLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  moduleLinkText: {
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  alertList: {
    gap: 10,
  },

  alertRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: PALETTE.cardSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },

  alertWarning: {
    backgroundColor: "#FFF8E8",
    borderColor: "#ECD189",
  },

  alertDanger: {
    backgroundColor: PALETTE.redSoft,
    borderColor: "#FBCBC7",
  },

  alertGood: {
    backgroundColor: PALETTE.greenSoft,
    borderColor: "#B7E4C7",
  },

  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: PALETTE.goldSoft,
    borderWidth: 1,
    borderColor: "#ECD189",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  alertTitle: {
    fontSize: 13,
    lineHeight: 19,
    color: PALETTE.ink,
    fontWeight: "900",
  },

  alertSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  workflowList: {
    gap: 12,
  },

  workflowRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  workflowIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PALETTE.goldSoft,
    borderWidth: 1,
    borderColor: "#ECD189",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  workflowIndexText: {
    fontSize: 12,
    fontWeight: "900",
    color: PALETTE.goldDark,
  },

  workflowText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.ink,
    fontWeight: "700",
  },

  activityList: {
    gap: 10,
  },

  activityItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: PALETTE.cardSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 14,
  },

  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.gold,
    marginTop: 6,
  },

  activityTitle: {
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.ink,
    fontWeight: "800",
  },

  activityMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  emptyWrap: {
    paddingVertical: 8,
  },

  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.88,
  },
});