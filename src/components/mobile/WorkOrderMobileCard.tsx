import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatWorkOrderNumber } from "../../lib/format";
import { theme } from "../../theme/theme";
import { formatMobileDate } from "../../features/workorders/helpers";
import type { WorkOrder } from "../../features/workorders/types";

type WorkOrderMobileCardProps = {
  workOrder: WorkOrder;
  context: "admin" | "team" | "client";
  onPress?: () => void;
};

function statusTone(status: string) {
  const normalized = status.toLowerCase();

  if (normalized.includes("progress")) return styles.badgeInfo;
  if (normalized.includes("hold")) return styles.badgeWarning;
  if (normalized.includes("closed") || normalized.includes("complete")) return styles.badgeSuccess;
  return styles.badgeNeutral;
}

function priorityTone(priority: WorkOrder["priority"]) {
  if (priority === "urgent") return styles.priorityDanger;
  if (priority === "high") return styles.priorityWarning;
  if (priority === "low") return styles.priorityMuted;
  return styles.priorityNormal;
}

export default function WorkOrderMobileCard({
  workOrder,
  context,
  onPress,
}: WorkOrderMobileCardProps) {
  const dateLabel = workOrder.dueDate || workOrder.scheduledDate;
  const secondaryLine =
    context === "client"
      ? workOrder.clientVisibleStatus || workOrder.status
      : workOrder.assignedTo?.name || "Unassigned";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <View style={styles.topRow}>
        <Text style={styles.number}>{formatWorkOrderNumber(workOrder.number)}</Text>
        <View style={[styles.badge, statusTone(workOrder.status)]}>
          <Text style={styles.badgeText}>{workOrder.status}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {workOrder.title}
      </Text>

      <Text style={styles.client} numberOfLines={1}>
        {workOrder.clientName}
      </Text>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={15} color={theme.colors.muted} />
          <Text style={styles.metaText}>{formatMobileDate(dateLabel)}</Text>
        </View>

        <View style={styles.metaItem}>
          <Ionicons
            name={context === "client" ? "trail-sign-outline" : "person-outline"}
            size={15}
            color={theme.colors.muted}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {secondaryLine}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={[styles.priority, priorityTone(workOrder.priority)]}>
          <Text style={styles.priorityText}>{workOrder.priority}</Text>
        </View>

        {workOrder.isOverdue ? (
          <View style={styles.overdue}>
            <Ionicons name="alert-circle-outline" size={14} color={theme.colors.danger} />
            <Text style={styles.overdueText}>Overdue</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 16,
    gap: 10,
    ...theme.shadow.card,
  },
  cardPressed: {
    transform: [{ translateY: 1 }],
    borderColor: theme.colors.primary,
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  number: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeNeutral: {
    backgroundColor: theme.colors.mutedSurface,
    borderColor: theme.colors.border,
  },
  badgeInfo: {
    backgroundColor: theme.colors.infoBg,
    borderColor: theme.colors.infoBorder,
  },
  badgeWarning: {
    backgroundColor: theme.colors.warningBg,
    borderColor: theme.colors.warningBorder,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.successBg,
    borderColor: theme.colors.successBorder,
  },
  badgeText: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: "900",
  },
  title: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  client: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    alignItems: "center",
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  metaText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  priority: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  priorityNormal: {
    backgroundColor: theme.colors.primarySoft,
  },
  priorityDanger: {
    backgroundColor: theme.colors.dangerBg,
  },
  priorityWarning: {
    backgroundColor: theme.colors.warningBg,
  },
  priorityMuted: {
    backgroundColor: theme.colors.mutedSurface,
  },
  priorityText: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  overdue: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  overdueText: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },
});
