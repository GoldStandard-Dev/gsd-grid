import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../../src/components/Screen";
import { getUserOrgId } from "../../../src/lib/auth";
import { formatWorkOrderNumber } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";
import { theme } from "../../../src/theme/theme";

type WorkOrderStatus = "Open" | "Scheduled" | "In Progress" | "On Hold" | "Closed";

type WorkOrderListItem = {
  id: string;
  workOrderNumber: number | null;
  title: string;
  clientName: string;
  status: WorkOrderStatus;
  dueDate?: string;
  updatedAt?: string;
};

const STATUS_FILTERS: Array<"All" | WorkOrderStatus> = [
  "All",
  "Open",
  "Scheduled",
  "In Progress",
  "On Hold",
  "Closed",
];

function formatDueDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function statusChipStyle(status: WorkOrderStatus) {
  switch (status) {
    case "Open":
      return styles.statusOpen;
    case "Scheduled":
      return styles.statusScheduled;
    case "In Progress":
      return styles.statusInProgress;
    case "On Hold":
      return styles.statusOnHold;
    case "Closed":
      return styles.statusClosed;
    default:
      return styles.statusOpen;
  }
}

export default function WorkOrdersIndex() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [items, setItems] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    void loadWorkOrders();
  }, []);

  async function resolveOrgId() {
    const { data: auth, error } = await supabase.auth.getUser();

    if (error) throw new Error(error.message);

    const userId = auth.user?.id;
    if (!userId) throw new Error("No authenticated user found.");

    const resolved = await getUserOrgId(userId);
    if (!resolved) throw new Error("Could not determine the active organization.");

    setOrgId(resolved);
    return resolved;
  }

  async function loadWorkOrders() {
    setLoading(true);

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const response = await supabase
        .from("work_orders")
        .select("id, work_order_number, title, client_name, status, due_date, updated_at")
        .eq("org_id", activeOrgId)
        .order("work_order_number", { ascending: false })
        .limit(200);

      if (response.error) throw new Error(response.error.message);

      const mapped: WorkOrderListItem[] = (response.data ?? []).map((row: any) => ({
        id: row.id,
        workOrderNumber: row.work_order_number ?? null,
        title: row.title ?? "Work Order",
        clientName: row.client_name ?? "—",
        status: (row.status ?? "Open") as WorkOrderStatus,
        dueDate: row.due_date ?? undefined,
        updatedAt: row.updated_at ?? undefined,
      }));

      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items
      .filter((item) => (status === "All" ? true : item.status === status))
      .filter((item) => {
        if (!normalizedQuery) return true;

        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.clientName.toLowerCase().includes(normalizedQuery) ||
          String(item.workOrderNumber ?? "").includes(normalizedQuery) ||
          item.id.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [items, query, status]);

  const totalCount = items.length;

  const openCount = useMemo(
    () =>
      items.filter((item) =>
        ["Open", "Scheduled", "In Progress", "On Hold"].includes(item.status)
      ).length,
    [items]
  );

  const scheduledCount = useMemo(
    () => items.filter((item) => item.status === "Scheduled").length,
    [items]
  );

  const closedCount = useMemo(
    () => items.filter((item) => item.status === "Closed").length,
    [items]
  );

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Work Orders</Text>
            <Text style={styles.heroSub}>
              Manage jobs, track status, and open each work order to edit the full grid.
            </Text>
          </View>

          <Pressable
            onPress={() => router.push("/workorders/new")}
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null]}
          >
            <Ionicons name="add" size={16} color="#111111" />
            <Text style={styles.primaryBtnText}>New Work Order</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Total" value={String(totalCount)} />
          <StatCard label="Open" value={String(openCount)} />
          <StatCard label="Scheduled" value={String(scheduledCount)} />
          <StatCard label="Closed" value={String(closedCount)} />
        </View>

        <View style={styles.controlsCard}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={theme.colors.mutedSoft} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search title, client, or work order ID..."
              placeholderTextColor={theme.colors.muted}
              style={styles.search}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {STATUS_FILTERS.map((value) => {
              const active = value === status;

              return (
                <Pressable
                  key={value}
                  onPress={() => setStatus(value)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    active ? styles.filterPillActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.tableCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Recent work orders</Text>
              <Text style={styles.cardSubtitle}>Simple spreadsheet-style job list</Text>
            </View>

            <Text style={styles.cardMeta}>{loading ? "Loading..." : `${filtered.length} shown`}</Text>
          </View>

          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Loading work orders...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No work orders yet.</Text>
              <Text style={styles.emptySub}>
                Create your first work order to start using the system.
              </Text>
            </View>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colId]}>Work Order</Text>
                <Text style={[styles.th, styles.colTitle]}>Title</Text>
                <Text style={[styles.th, styles.colClient]}>Client</Text>
                <Text style={[styles.th, styles.colStatus]}>Status</Text>
                <Text style={[styles.th, styles.colDue]}>Due</Text>
              </View>

              {filtered.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/workorders/${encodeURIComponent(item.id)}`)}
                  style={({ pressed }) => [
                    styles.tr,
                    index % 2 === 0 ? styles.trStriped : null,
                    pressed ? styles.trPressed : null,
                  ]}
                >
                  <Text style={[styles.td, styles.colId]} numberOfLines={1}>
                    {formatWorkOrderNumber(item.workOrderNumber)}
                  </Text>

                  <Text style={[styles.td, styles.colTitle]} numberOfLines={1}>
                    {item.title}
                  </Text>

                  <Text style={[styles.td, styles.colClient]} numberOfLines={1}>
                    {item.clientName}
                  </Text>

                  <View style={[styles.statusChip, styles.colStatus, statusChipStyle(item.status)]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>

                  <Text style={[styles.td, styles.colDue]}>{formatDueDate(item.dueDate)}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAF7F0",
    padding: 22,
    gap: 14,
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111111",
  },

  heroSub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#6B6B6B",
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B8962E",
    backgroundColor: "#D4AF37",
    justifyContent: "center",
  },

  primaryBtnText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 14,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 18,
    padding: 16,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8B7A60",
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: "#B8962E",
  },

  controlsCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },

  searchWrap: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  search: {
    flex: 1,
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },

  pillRow: {
    gap: 8,
    paddingHorizontal: 2,
  },

  filterPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E8DFC7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  filterPillActive: {
    backgroundColor: "#F5E6B8",
    borderColor: "#D4AF37",
  },

  filterPillText: {
    color: "#111111",
    fontWeight: "800",
    fontSize: 12.5,
  },

  filterPillTextActive: {
    color: "#B8962E",
  },

  tableCard: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 22,
  },

  cardHeader: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111111",
  },

  cardSubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6B6B",
  },

  cardMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6B6B",
  },

  table: {
    borderTopWidth: 1,
    borderTopColor: "#E8DFC7",
  },

  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FBF6EA",
    borderBottomWidth: 1,
    borderBottomColor: "#E8DFC7",
  },

  th: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8B7A60",
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1E7D2",
    backgroundColor: "#FFFFFF",
  },

  trStriped: {
    backgroundColor: "#FFFDF8",
  },

  trPressed: {
    backgroundColor: "#F8F1E0",
  },

  td: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#111111",
  },

  colId: {
    width: 140,
  },

  colTitle: {
    flex: 1,
  },

  colClient: {
    width: 220,
  },

  colStatus: {
    width: 160,
  },

  colDue: {
    width: 140,
  },

  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  statusText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111111",
  },

  statusOpen: {
    backgroundColor: "rgba(212,175,55,0.14)",
    borderColor: "rgba(212,175,55,0.30)",
  },

  statusScheduled: {
    backgroundColor: "rgba(241,211,122,0.18)",
    borderColor: "rgba(212,175,55,0.28)",
  },

  statusInProgress: {
    backgroundColor: "rgba(184,150,46,0.14)",
    borderColor: "rgba(184,150,46,0.28)",
  },

  statusOnHold: {
    backgroundColor: "rgba(110,98,74,0.10)",
    borderColor: "rgba(110,98,74,0.20)",
  },

  statusClosed: {
    backgroundColor: "rgba(17,17,17,0.06)",
    borderColor: "rgba(17,17,17,0.12)",
  },

  emptyWrap: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  empty: {
    color: "#111111",
    fontWeight: "800",
  },

  emptySub: {
    marginTop: 6,
    color: "#6B6B6B",
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.92,
  },
});