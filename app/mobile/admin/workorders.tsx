import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../../src/components/Screen";
import WorkOrderMobileCard from "../../../src/components/mobile/WorkOrderMobileCard";
import {
  isNeedsReviewStatus,
  isToday,
  useWorkOrders,
} from "../../../src/features/workorders";
import type { WorkOrder } from "../../../src/features/workorders";
import { theme } from "../../../src/theme/theme";

const filters = ["All", "Active", "Needs Review", "Overdue"] as const;
type Filter = (typeof filters)[number];

function matchesFilter(workOrder: WorkOrder, filter: Filter) {
  if (filter === "Needs Review") return isNeedsReviewStatus(workOrder.reviewStatus);
  if (filter === "Overdue") return workOrder.isOverdue;
  if (filter === "Active") {
    return !["closed", "complete", "completed"].includes(workOrder.status.toLowerCase());
  }

  return true;
}

export default function AdminWorkordersMobile() {
  const router = useRouter();
  const { items, loading, error, refresh } = useWorkOrders("admin");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const stats = useMemo(() => {
    const active = items.filter((item) => matchesFilter(item, "Active")).length;
    const review = items.filter((item) => isNeedsReviewStatus(item.reviewStatus)).length;
    const today = items.filter((item) => isToday(item.dueDate ?? item.scheduledDate)).length;

    return [
      { label: "Active", value: active, meta: "Open work" },
      { label: "Review", value: review, meta: "Submitted" },
      { label: "Today", value: today, meta: "Scheduled" },
      { label: "Overdue", value: items.filter((item) => item.isOverdue).length, meta: "Needs action" },
    ];
  }, [items]);

  const shownItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const searchMatch =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.clientName.toLowerCase().includes(normalizedQuery) ||
        String(item.number ?? "").includes(normalizedQuery);

      return searchMatch && matchesFilter(item, filter);
    });
  }, [filter, items, query]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Admin mobile</Text>
        <Text style={styles.title}>Work orders</Text>
        <Text style={styles.subtitle}>
          Fast review, assignment, and status checks from the field.
        </Text>
      </View>

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <Pressable
            key={stat.label}
            onPress={() => {
              if (stat.label === "Review") setFilter("Needs Review");
              else if (stat.label === "Overdue" || stat.label === "Active") setFilter(stat.label);
              else setFilter("All");
            }}
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
          <Text style={styles.sectionTitle}>Work order controls</Text>
          <Text style={styles.sectionSubtitle}>{shownItems.length} shown</Text>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={theme.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search work orders"
            placeholderTextColor={theme.colors.mutedSoft}
            style={styles.searchInput}
          />
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

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={refresh}>
            <Ionicons name="refresh-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/workorders/new")}>
            <Ionicons name="add-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>New</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.listCard}>
        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Work orders</Text>
            <Text style={styles.sectionSubtitle}>Tap any work order to open its full workspace.</Text>
          </View>
          <Text style={styles.count}>{shownItems.length} shown</Text>
        </View>

        {loading ? <Text style={styles.stateText}>Loading work orders...</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error && shownItems.length === 0 ? (
          <Text style={styles.stateText}>No work orders match this view.</Text>
        ) : null}

        <View style={styles.cards}>
          {shownItems.map((workOrder) => (
            <WorkOrderMobileCard
              key={workOrder.id}
              workOrder={workOrder}
              context="admin"
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
    flexBasis: "47%",
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
  searchRow: {
    alignItems: "center",
    backgroundColor: theme.colors.bg,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 42,
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
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.sm,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
  },
  secondaryButtonText: {
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
