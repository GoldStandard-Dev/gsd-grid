import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../../src/components/Screen";
import { getUserOrgId } from "../../../src/lib/auth";
import { formatWorkOrderNumber } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";

type WorkOrderStatus = "Open" | "Scheduled" | "In Progress" | "On Hold" | "Closed";
type ReviewStatus = "draft" | "submitted_for_review" | "in_review" | "priced";

type WorkOrderListItem = {
  id: string;
  workOrderNumber: number | null;
  title: string;
  clientName: string;
  status: WorkOrderStatus;
  dueDate?: string;
  updatedAt?: string;
  assignedUserId?: string;
  assignedDisplayName?: string;
  templateName?: string;
  reviewStatus?: ReviewStatus;
};

const STATUS_FILTERS: Array<"All" | WorkOrderStatus | "Needs Review" | "Priced"> = [
  "All",
  "Open",
  "Scheduled",
  "In Progress",
  "On Hold",
  "Closed",
  "Needs Review",
  "Priced",
];

const REVIEW_ROLES = [
  "owner",
  "general_manager",
  "operations_manager",
  "project_manager",
  "estimator",
  "accounting_manager",
  "office_admin",
] as const;

const PAGE_BG = "#f7f5ef";
const CARD_BG = "#ffffff";
const CARD_WHITE = "#FFFFFF";
const BORDER = "#e6dcc6";
const BORDER_STRONG = "rgba(212,175,55,0.22)";
const GOLD = "#c9a227";
const GOLD_BRIGHT = "#D4AF37";
const GOLD_SOFT = "#FFF4D6";
const TEXT = "#1a1a1a";
const MUTED = "#6b6b6b";
const MUTED_2 = "#6B6B6B";
const HERO_BG = "#111111";

function canCreateOrReview(role: string) {
  return REVIEW_ROLES.includes(role as (typeof REVIEW_ROLES)[number]);
}

function safeJsonParse<T>(value?: string | null): T | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  if (!(text.startsWith("{") || text.startsWith("["))) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function parseMeta(description?: string | null) {
  return safeJsonParse<any>(description) ?? {};
}

function formatDueDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );
}

function QuickAction({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        primary ? styles.quickActionPrimary : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.quickActionText, primary ? styles.quickActionTextPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

function statusChipStyle(label: string) {
  if (label === "Priced") return styles.statusClosed;
  if (label === "Needs Review") return styles.statusScheduled;

  switch (label) {
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
  const [templateFilter, setTemplateFilter] = useState("All Templates");
  const [orgId, setOrgId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("viewer");

  useEffect(() => {
    void loadWorkOrders();
  }, []);

  async function resolveOrgId() {
    const { data: auth, error } = await supabase.auth.getUser();

    if (error) throw new Error(error.message);

    const userId = auth.user?.id;
    if (!userId) throw new Error("No authenticated user found.");
    setCurrentUserId(userId);

    const resolved = await getUserOrgId(userId);
    if (!resolved) throw new Error("Could not determine the active organization.");

    setOrgId(resolved);
    return { orgId: resolved, userId };
  }

  async function loadWorkOrders() {
    setLoading(true);

    try {
      const resolved = await resolveOrgId();
      const activeOrgId = orgId || resolved.orgId;
      const userId = resolved.userId;

      const memberRes = await supabase
        .from("org_members")
        .select("role")
        .eq("org_id", activeOrgId)
        .eq("user_id", userId)
        .maybeSingle();

      if (memberRes.error) throw new Error(memberRes.error.message);

      const role = String(memberRes.data?.role ?? "viewer");
      setCurrentUserRole(role);

      const response = await supabase
        .from("work_orders")
        .select("id, work_order_number, title, client_name, status, due_date, updated_at, description")
        .eq("org_id", activeOrgId)
        .order("work_order_number", { ascending: false })
        .limit(200);

      if (response.error) throw new Error(response.error.message);

      const mapped: WorkOrderListItem[] = (response.data ?? []).map((row: any) => {
        const meta = parseMeta(row.description);
        return {
          id: row.id,
          workOrderNumber: row.work_order_number ?? null,
          title: row.title ?? "Work Order",
          clientName: row.client_name ?? "—",
          status: (row.status ?? "Open") as WorkOrderStatus,
          dueDate: row.due_date ?? undefined,
          updatedAt: row.updated_at ?? undefined,
          assignedUserId: meta.assignedTo?.userId ?? undefined,
          assignedDisplayName: meta.assignedTo?.displayName ?? undefined,
          templateName: meta.selectedTemplateLabel ?? meta.selectedTemplateName ?? "General",
          reviewStatus: meta.reviewWorkflow?.status ?? "draft",
        };
      });

      const visibleItems = canCreateOrReview(role)
        ? mapped
        : mapped.filter((item) => item.assignedUserId === userId);

      setItems(visibleItems);
    } catch (error: any) {
      console.warn("Load work orders failed", error?.message ?? error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items
      .filter((item) => {
        if (status === "All") return true;
        if (status === "Needs Review") {
          return item.reviewStatus === "submitted_for_review" || item.reviewStatus === "in_review";
        }
        if (status === "Priced") {
          return item.reviewStatus === "priced";
        }
        return item.status === status;
      })
      .filter((item) => {
        if (templateFilter !== "All Templates" && (item.templateName ?? "General") !== templateFilter) {
          return false;
        }

        if (!normalizedQuery) return true;

        return (
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.clientName.toLowerCase().includes(normalizedQuery) ||
          String(item.workOrderNumber ?? "").includes(normalizedQuery) ||
          item.assignedDisplayName?.toLowerCase().includes(normalizedQuery) ||
          item.templateName?.toLowerCase().includes(normalizedQuery) ||
          item.id.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [items, query, status, templateFilter]);

  const totalCount = items.length;
  const openCount = useMemo(
    () => items.filter((item) => ["Open", "Scheduled", "In Progress", "On Hold"].includes(item.status)).length,
    [items]
  );
  const needsReviewCount = useMemo(
    () => items.filter((item) => item.reviewStatus === "submitted_for_review" || item.reviewStatus === "in_review").length,
    [items]
  );
  const closedCount = useMemo(() => items.filter((item) => item.status === "Closed").length, [items]);

  const templateFilters = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => item.templateName || "General"))).sort((a, b) => a.localeCompare(b));
    return ["All Templates", ...values];
  }, [items]);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.pagePad} showsVerticalScrollIndicator={false}>
        <View style={styles.pageInner}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Workflow</Text>
              <Text style={styles.heroTitle}>Field-ready work order pipeline</Text>
              <Text style={styles.heroSubtitle}>
                {canCreateOrReview(currentUserRole)
                  ? "Create, assign, review, and price jobs in the same black-and-gold workflow used across the dashboard."
                  : "View your assigned work orders, complete the template, and send finished jobs in for review."}
              </Text>

              <View style={styles.headerActions}>
                <QuickAction label="Refresh" onPress={() => void loadWorkOrders()} />
                {canCreateOrReview(currentUserRole) ? (
                  <QuickAction label="New Work Order" primary onPress={() => router.push("/workorders/new")} />
                ) : null}
              </View>

              <View style={styles.heroPills}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{totalCount} total</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{needsReviewCount} needing review</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroPanel}>
              <Text style={styles.heroPanelLabel}>Current view</Text>
              <Text style={styles.heroPanelValue}>
                {canCreateOrReview(currentUserRole) ? "Manager / owner workflow" : "Assigned technician view"}
              </Text>
              <Text style={styles.heroPanelText}>
                {canCreateOrReview(currentUserRole)
                  ? "You can create, assign, review, and price work orders."
                  : "You only see work orders assigned to your account."}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard label="Total Work Orders" value={String(totalCount)} subtitle="All visible records" />
            <StatCard label="Open Pipeline" value={String(openCount)} subtitle="Open, scheduled, active, on hold" />
            <StatCard label="Needs Review" value={String(needsReviewCount)} subtitle="Submitted or under review" />
            <StatCard label="Closed" value={String(closedCount)} subtitle="Completed work orders" />
          </View>

          <View style={styles.controlsCard}>
            <View style={styles.controlsTop}>
              <View style={styles.controlsCopy}>
                <Text style={styles.cardEyebrow}>Filters</Text>
                <Text style={styles.cardTitle}>Search and narrow results</Text>
                <Text style={styles.cardSubtitle}>Find by work order, client, template, assignee, or stage.</Text>
              </View>

              <Text style={styles.cardMeta}>{loading ? "Loading..." : `${filtered.length} shown`}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={MUTED_2} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search title, client, template, or assignee..."
                placeholderTextColor={MUTED}
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
                    <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{value}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.templateFilterBlock}>
              <Text style={styles.templateFilterLabel}>Template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {templateFilters.map((value) => {
                  const active = value === templateFilter;

                  return (
                    <Pressable
                      key={value}
                      onPress={() => setTemplateFilter(value)}
                      style={({ pressed }) => [
                        styles.filterPill,
                        active ? styles.filterPillActive : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          <View style={styles.tableCard}>
            <View style={styles.tableHeaderTop}>
              <View>
                <Text style={styles.cardEyebrow}>Records</Text>
                <Text style={styles.cardTitle}>Recent work orders</Text>
                <Text style={styles.cardSubtitle}>Assignment-aware workflow list</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>Loading work orders...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>No work orders found.</Text>
                <Text style={styles.emptySub}>
                  {canCreateOrReview(currentUserRole)
                    ? "Create a work order and build the template before assigning it to a technician."
                    : "You do not have any assigned work orders yet."}
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.table}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.th, styles.colId]}>Work Order</Text>
                    <Text style={[styles.th, styles.colTitle]}>Title</Text>
                    <Text style={[styles.th, styles.colClient]}>Client</Text>
                    <Text style={[styles.th, styles.colTemplate]}>Template</Text>
                    <Text style={[styles.th, styles.colAssigned]}>Assigned</Text>
                    <Text style={[styles.th, styles.colStatus]}>Stage</Text>
                    <Text style={[styles.th, styles.colDue]}>Due</Text>
                  </View>

                  {filtered.map((item, index) => {
                    const stageLabel =
                      item.reviewStatus === "priced"
                        ? "Priced"
                        : item.reviewStatus === "in_review"
                        ? "In Review"
                        : item.reviewStatus === "submitted_for_review"
                        ? "Needs Review"
                        : item.status;

                    return (
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

                        <Text style={[styles.td, styles.colTemplate]} numberOfLines={1}>
                          {item.templateName || "General"}
                        </Text>

                        <Text style={[styles.td, styles.colAssigned]} numberOfLines={1}>
                          {item.assignedDisplayName || "Unassigned"}
                        </Text>

                        <View style={[styles.statusChip, styles.colStatus, statusChipStyle(stageLabel)]}>
                          <Text style={styles.statusText}>{stageLabel}</Text>
                        </View>

                        <Text style={[styles.td, styles.colDue]}>{formatDueDate(item.dueDate)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pagePad: {
    flexGrow: 1,
    backgroundColor: PAGE_BG,
    padding: 24,
  },

  pageInner: {
    width: "100%",
    maxWidth: 1400,
    alignSelf: "center",
    gap: 16,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },

  headerCopy: {
    flex: 1,
    minWidth: 280,
    gap: 4,
  },

  pageTitle: {
    color: TEXT,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },

  pageSub: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },

  headerActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 18,
  },

  quickAction: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionPrimary: {
    backgroundColor: GOLD_BRIGHT,
    borderColor: GOLD,
    shadowColor: "#D4AF37",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  quickActionText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "900",
  },

  quickActionTextPrimary: {
    color: TEXT,
  },

  hero: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER_STRONG,
    backgroundColor: HERO_BG,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },

  heroCopy: {
    flex: 1,
    minWidth: 280,
  },

  heroEyebrow: {
    color: GOLD_BRIGHT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 10,
  },

  heroTitle: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },

  heroSubtitle: {
    marginTop: 10,
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    maxWidth: 760,
  },

  heroPills: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },

  heroPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  heroPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  heroPanel: {
    width: 320,
    minWidth: 260,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    justifyContent: "center",
  },

  heroPanelLabel: {
    color: GOLD_BRIGHT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 8,
  },

  heroPanelValue: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
  },

  heroPanelText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },

  statCard: {
    minWidth: 220,
    flex: 1,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  statLabel: {
    color: "#A3A3A3",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  statValue: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },

  statSubtitle: {
    marginTop: 6,
    color: "#A3A3A3",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "700",
  },

  controlsCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  controlsTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  controlsCopy: {
    flex: 1,
    minWidth: 240,
  },

  cardEyebrow: {
    color: GOLD,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  cardTitle: {
    marginTop: 6,
    color: TEXT,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "900",
  },

  cardSubtitle: {
    marginTop: 4,
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },

  cardMeta: {
    color: MUTED_2,
    fontSize: 13,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: "#EDE8DA",
  },

  searchWrap: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#D4AF37",
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  search: {
    flex: 1,
    color: TEXT,
    fontWeight: "700",
    fontSize: 14,
  },

  pillRow: {
    gap: 8,
  },

  templateFilterBlock: {
    gap: 8,
  },

  templateFilterLabel: {
    color: MUTED_2,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  filterPill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_WHITE,
    justifyContent: "center",
  },

  filterPillActive: {
    backgroundColor: GOLD_SOFT,
    borderColor: GOLD,
  },

  filterPillText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 12.5,
  },

  filterPillTextActive: {
    color: "#8a6a12",
  },

  tableCard: {
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  tableHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  emptyWrap: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },

  empty: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },

  emptySub: {
    color: "#A3A3A3",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 520,
  },

  table: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    backgroundColor: "#111111",
    minWidth: 980,
  },

  tableHead: {
    minHeight: 48,
    backgroundColor: "#1C1C1C",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,175,55,0.22)",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  th: {
    color: "#A3A3A3",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  tr: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.22)",
    backgroundColor: "#111111",
  },

  trStriped: {
    backgroundColor: "#1C1C1C",
  },

  trPressed: {
    opacity: 0.92,
  },

  td: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  colId: {
    width: 120,
  },

  colTitle: {
    flex: 1.35,
  },

  colClient: {
    flex: 1.1,
  },

  colTemplate: {
    width: 125,
  },

  colAssigned: {
    width: 150,
  },

  colStatus: {
    width: 128,
  },

  colDue: {
    width: 110,
    textAlign: "right",
  },

  statusChip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  statusOpen: {
    backgroundColor: "#fff4d6",
    borderColor: "#ecd189",
  },

  statusScheduled: {
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
  },

  statusInProgress: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
  },

  statusOnHold: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
  },

  statusClosed: {
    backgroundColor: "#ede9fe",
    borderColor: "#ddd6fe",
  },

  statusText: {
    color: TEXT,
    fontWeight: "900",
    fontSize: 11.5,
  },

  pressed: {
    opacity: 0.92,
  },
});