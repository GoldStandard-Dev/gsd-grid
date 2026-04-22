import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../../../src/components/Screen";
import WorkOrderMobileCard from "../../../src/components/mobile/WorkOrderMobileCard";
import {
  isNeedsReviewStatus,
  isToday,
  useWorkOrders,
} from "../../../src/features/workorders";
import type { WorkOrder } from "../../../src/features/workorders";
import { theme } from "../../../src/theme/theme";

const filters = ["All", "Today", "Overdue", "Submitted"] as const;
type Filter = (typeof filters)[number];

function matchesFilter(workOrder: WorkOrder, filter: Filter) {
  if (filter === "Today") return isToday(workOrder.dueDate ?? workOrder.scheduledDate);
  if (filter === "Overdue") return workOrder.isOverdue;
  if (filter === "Submitted") return isNeedsReviewStatus(workOrder.reviewStatus);
  return true;
}

export default function TeamJobsMobile() {
  const router = useRouter();
  const { items, loading, error, refresh } = useWorkOrders("team");
  const [filter, setFilter] = useState<Filter>("All");

  const stats = useMemo(
    () => [
      {
        label: "Today",
        value: items.filter((item) => isToday(item.dueDate ?? item.scheduledDate)).length,
        meta: "Due now",
      },
      {
        label: "Overdue",
        value: items.filter((item) => item.isOverdue).length,
        meta: "Needs action",
      },
      {
        label: "Assigned",
        value: items.length,
        meta: "Your queue",
      },
    ],
    [items]
  );

  const shownItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items]
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Team field app</Text>
        <Text style={styles.title}>My jobs</Text>
        <Text style={styles.subtitle}>
          Assigned work only, with the next job and urgent work easy to find.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <Pressable
            key={stat.label}
            onPress={() => setFilter(stat.label === "Assigned" ? "All" : (stat.label as Filter))}
            style={styles.statCard}
          >
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statMeta}>{stat.meta}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.controls}>
        <View>
          <Text style={styles.sectionTitle}>Job queue</Text>
          <Text style={styles.sectionSubtitle}>{shownItems.length} shown</Text>
        </View>

        <View style={styles.filterRow}>
          {filters.map((option) => (
            <Pressable
              key={option}
              onPress={() => setFilter(option)}
              style={[styles.chip, filter === option ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, filter === option ? styles.chipTextActive : null]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.refreshButton} onPress={refresh}>
          <Ionicons name="refresh-outline" size={17} color={theme.colors.primary} />
          <Text style={styles.refreshButtonText}>Refresh jobs</Text>
        </Pressable>
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Assigned jobs</Text>
            <Text style={styles.sectionSubtitle}>Open a job for scope, dates, notes, and status.</Text>
          </View>
          <Text style={styles.count}>{shownItems.length} shown</Text>
        </View>

        {loading ? <Text style={styles.stateText}>Loading assigned jobs...</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && shownItems.length === 0 ? (
          <Text style={styles.stateText}>No assigned jobs match this view.</Text>
        ) : null}

        <View style={styles.cards}>
          {shownItems.map((workOrder) => (
            <WorkOrderMobileCard
              key={workOrder.id}
              workOrder={workOrder}
              context="team"
              onPress={() => router.push(`/workorders/${encodeURIComponent(workOrder.id)}`)}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
    marginBottom: 18,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.ink,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    padding: 14,
    ...theme.shadow.card,
  },
  statValue: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 3,
  },
  statMeta: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  controls: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
    padding: 14,
    ...theme.shadow.card,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: theme.colors.bg,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
  },
  refreshButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  listCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 14,
    padding: 14,
    ...theme.shadow.card,
  },
  listHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  count: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  cards: {
    gap: 10,
  },
  stateText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
});
