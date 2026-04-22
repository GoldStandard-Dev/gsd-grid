
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
  SummaryCard,
  SummaryStrip,
} from "../../../src/components/AppPage";
import EmptyState from "../../../src/components/EmptyState";
import { getUserOrgId } from "../../../src/lib/auth";
import { logActivity } from "../../../src/lib/activity";
import { formatWorkOrderNumber } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";
import { theme } from "../../../src/theme/theme";

type WorkOrderStatus = "Open" | "Scheduled" | "In Progress" | "On Hold" | "Closed";
type ReviewStatus = "draft" | "submitted_for_review" | "in_review" | "priced";
type Priority = "urgent" | "high" | "normal" | "low";
type SavedView = "all" | "my_jobs" | "needs_review" | "priced" | "closed" | "archived";
type SortKey = "number" | "due" | "updated" | "priority";
type ViewMode = "table" | "card";

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
  priority: Priority;
  archivedAt?: string;
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

const SAVED_VIEWS: { key: SavedView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "my_jobs", label: "My Jobs" },
  { key: "needs_review", label: "Needs Review" },
  { key: "priced", label: "Ready to Price" },
  { key: "closed", label: "Closed" },
  { key: "archived", label: "Archived" },
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

const DELETE_ROLES = ["owner", "general_manager", "operations_manager"] as const;

function canCreateOrReview(role: string) {
  return REVIEW_ROLES.includes(role as (typeof REVIEW_ROLES)[number]);
}

function canDeleteWorkOrders(role: string) {
  return DELETE_ROLES.includes(role as (typeof DELETE_ROLES)[number]);
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

function parsePriority(row: any, meta: any): Priority {
  const fromRow = String(row.priority ?? "").toLowerCase();
  const fromMeta = String(meta?.priority ?? "").toLowerCase();
  const value = fromRow || fromMeta;
  if (value === "urgent" || value === "high" || value === "low") return value;
  return "normal";
}

function formatDueDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function isWorkOrderOverdue(item: WorkOrderListItem) {
  if (!item.dueDate || item.archivedAt) return false;

  const normalizedStatus = String(item.status ?? "").toLowerCase();
  if (["closed", "completed", "canceled", "cancelled"].includes(normalizedStatus)) return false;

  const due = new Date(item.dueDate);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function formatRelativeTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function priorityWeight(priority: Priority) {
  if (priority === "urgent") return 4;
  if (priority === "high") return 3;
  if (priority === "normal") return 2;
  return 1;
}

function statusChipStyle(label: string) {
  if (label === "Archived") return styles.statusArchived;
  if (label === "Priced") return styles.statusClosed;
  if (label === "Needs Review" || label === "In Review") return styles.statusReview;

  switch (label) {
    case "Open":
      return styles.statusOpen;
    case "Scheduled":
      return styles.statusReview;
    case "In Progress":
      return styles.statusProgress;
    case "On Hold":
      return styles.statusHold;
    case "Closed":
      return styles.statusClosed;
    default:
      return styles.statusOpen;
  }
}

function priorityBadgeStyle(priority: Priority) {
  switch (priority) {
    case "urgent":
      return styles.priorityUrgent;
    case "high":
      return styles.priorityHigh;
    case "low":
      return styles.priorityLow;
    default:
      return styles.priorityNormal;
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
  const [savedView, setSavedView] = useState<SavedView>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [deletingId, setDeletingId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");

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
        .select("id, work_order_number, title, client_name, status, due_date, updated_at, description, priority")
        .eq("org_id", activeOrgId)
        .order("work_order_number", { ascending: false })
        .limit(300);

      if (response.error) throw new Error(response.error.message);

      const mapped: WorkOrderListItem[] = (response.data ?? []).map((row: any) => {
        const meta = parseMeta(row.description);
        return {
          id: row.id,
          workOrderNumber: row.work_order_number ?? null,
          title: row.title ?? "Work Order",
          clientName: row.client_name ?? "-",
          status: (row.status ?? "Open") as WorkOrderStatus,
          dueDate: row.due_date ?? undefined,
          updatedAt: row.updated_at ?? undefined,
          assignedUserId: meta.assignedTo?.userId ?? undefined,
          assignedDisplayName: meta.assignedTo?.displayName ?? undefined,
          templateName: meta.selectedTemplateLabel ?? meta.selectedTemplateName ?? "General",
          reviewStatus: meta.reviewWorkflow?.status ?? "draft",
          priority: parsePriority(row, meta),
          archivedAt: meta.archivedAt ?? undefined,
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

  const activeItems = useMemo(
    () => items.filter((item) => !item.archivedAt),
    [items]
  );
  const alertReviewCount = useMemo(
    () => activeItems.filter((item) => item.reviewStatus === "submitted_for_review").length,
    [activeItems]
  );
  const alertOverdueCount = useMemo(() => {
    return activeItems.filter((item) => isWorkOrderOverdue(item)).length;
  }, [activeItems]);
  const alertUnassignedCount = useMemo(
    () => activeItems.filter((item) => !item.assignedUserId).length,
    [activeItems]
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let result = (savedView === "archived" ? items.filter((item) => item.archivedAt) : activeItems).filter((item) => {
      if (savedView === "my_jobs") return item.assignedUserId === currentUserId;
      if (savedView === "needs_review") {
        return item.reviewStatus === "submitted_for_review" || item.reviewStatus === "in_review";
      }
      if (savedView === "priced") return item.reviewStatus === "priced";
      if (savedView === "closed") return item.status === "Closed";
      if (savedView === "archived") return !!item.archivedAt;
      return true;
    });

    result = result.filter((item) => {
      if (status === "All") return true;
      if (status === "Needs Review") {
        return item.reviewStatus === "submitted_for_review" || item.reviewStatus === "in_review";
      }
      if (status === "Priced") {
        return item.reviewStatus === "priced";
      }
      return item.status === status;
    });

    result = result.filter((item) => {
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

    return [...result].sort((a, b) => {
      if (sortKey === "number") return (b.workOrderNumber ?? 0) - (a.workOrderNumber ?? 0);
      if (sortKey === "due") return String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? ""));
      if (sortKey === "priority") return priorityWeight(b.priority) - priorityWeight(a.priority);
      return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
    });
  }, [items, activeItems, query, status, templateFilter, savedView, sortKey, currentUserId]);

  const totalCount = activeItems.length;
  const openCount = useMemo(
    () => activeItems.filter((item) => ["Open", "Scheduled", "In Progress", "On Hold"].includes(item.status)).length,
    [activeItems]
  );
  const needsReviewCount = useMemo(
    () => activeItems.filter((item) => item.reviewStatus === "submitted_for_review" || item.reviewStatus === "in_review").length,
    [activeItems]
  );
  const pricedCount = useMemo(
    () => activeItems.filter((item) => item.reviewStatus === "priced").length,
    [activeItems]
  );
  const savedViewCounts = useMemo<Record<SavedView, number>>(() => ({
    all: activeItems.length,
    my_jobs: activeItems.filter((item) => item.assignedUserId === currentUserId).length,
    needs_review: activeItems.filter((item) => item.reviewStatus === "submitted_for_review" || item.reviewStatus === "in_review").length,
    priced: activeItems.filter((item) => item.reviewStatus === "priced").length,
    closed: activeItems.filter((item) => item.status === "Closed").length,
    archived: items.filter((item) => item.archivedAt).length,
  }), [activeItems, currentUserId, items]);

  const templateFilters = useMemo(() => {
    const source = savedView === "archived" ? items.filter((item) => item.archivedAt) : activeItems;
    const values = Array.from(new Set(source.map((item) => item.templateName || "General"))).sort((a, b) => a.localeCompare(b));
    return ["All Templates", ...values];
  }, [activeItems, items, savedView]);

  const pageActions = [
    { label: "Refresh", onPress: () => void loadWorkOrders() },
    ...(canCreateOrReview(currentUserRole)
      ? [{ label: "New Work Order", primary: true as const, onPress: () => router.push("/workorders/new") }]
      : []),
  ];
  const canDeleteRows = canDeleteWorkOrders(currentUserRole);

  const showEmpty = !loading && filtered.length === 0;

  async function deleteWorkOrderManually(item: WorkOrderListItem, activeOrgId: string) {
    const invoiceRes = await supabase
      .from("invoices")
      .update({ work_order_id: null })
      .eq("work_order_id", item.id)
      .eq("org_id", activeOrgId);

    if (invoiceRes.error) throw new Error(invoiceRes.error.message);

    const itemRes = await supabase
      .from("work_order_items")
      .delete()
      .eq("work_order_id", item.id)
      .eq("org_id", activeOrgId);

    if (itemRes.error) throw new Error(itemRes.error.message);

    const workOrderRes = await supabase
      .from("work_orders")
      .delete()
      .eq("id", item.id)
      .eq("org_id", activeOrgId);

    if (workOrderRes.error) throw new Error(workOrderRes.error.message);
  }

  async function deleteWorkOrder(item: WorkOrderListItem) {
    if (deletingId) return;

    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      setTimeout(() => setConfirmDeleteId((prev) => (prev === item.id ? "" : prev)), 3000);
      return;
    }

    setConfirmDeleteId("");
    setDeletingId(item.id);

    try {
      const resolved = orgId ? { orgId, userId: currentUserId } : await resolveOrgId();
      const activeOrgId = resolved.orgId;
      const activeUserId = currentUserId || resolved.userId;
      let usedManualDelete = false;
      const res = await supabase.rpc("delete_work_order_with_activity", {
        p_work_order_id: item.id,
      });

      if (res.error) {
        await deleteWorkOrderManually(item, activeOrgId);
        usedManualDelete = true;
      }

      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (usedManualDelete) {
        void logActivity(supabase, {
          org_id: activeOrgId,
          actor_user_id: activeUserId || null,
          actor_name: null,
          action: "deleted",
          entity_type: "work_order",
          entity_id: item.id,
          title: "Deleted work order",
          description: `deleted ${formatWorkOrderNumber(item.workOrderNumber)}`,
          details: {
            work_order_id: item.id,
            work_order_number: formatWorkOrderNumber(item.workOrderNumber),
            title: item.title,
            client_name: item.clientName,
          },
        });
      }
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Failed to delete work order.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Work Orders"
          title="Pipeline"
          subtitle={
            canCreateOrReview(currentUserRole)
              ? "Saved views, advanced search, sorting, and filtering controls to manage your work orders with ease."
              : "Track your assigned work orders in a cleaner workspace with quicker review context."
          }
          actions={pageActions}
        />

        {alertReviewCount > 0 || alertOverdueCount > 0 || alertUnassignedCount > 0 ? (
          <View style={styles.alertsStrip}>
            {alertReviewCount > 0 ? (
              <View style={[styles.alertChip, styles.alertChipBlue]}>
                <Text style={styles.alertChipText}>{alertReviewCount} waiting for review</Text>
              </View>
            ) : null}
            {alertOverdueCount > 0 ? (
              <View style={[styles.alertChip, styles.alertChipRed]}>
                <Text style={styles.alertChipText}>{alertOverdueCount} overdue</Text>
              </View>
            ) : null}
            {alertUnassignedCount > 0 ? (
              <View style={[styles.alertChip, styles.alertChipAmber]}>
                <Text style={styles.alertChipText}>{alertUnassignedCount} unassigned</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <SummaryStrip>
          <SummaryCard label="Open" value={String(openCount)} meta="Active pipeline" accent="indigo" trend={{ value: alertOverdueCount ? `${alertOverdueCount} overdue` : "On track", tone: alertOverdueCount ? "negative" : "positive" }} />
          <SummaryCard label="Needs Review" value={String(needsReviewCount)} meta="Submitted or in review" accent="violet" trend={{ value: alertReviewCount ? `${alertReviewCount} awaiting action` : "No review backlog", tone: alertReviewCount ? "negative" : "positive" }} />
          <SummaryCard label="Ready to Price" value={String(pricedCount)} meta="Approved for pricing" accent="lavender" trend={{ value: pricedCount ? `${pricedCount} ready now` : "Nothing queued", tone: "neutral" }} />
          <SummaryCard label="Total" value={String(totalCount)} meta="Visible records" accent="purple" trend={{ value: `${filtered.length} in current view`, tone: "neutral" }} />
        </SummaryStrip>

        <ContentCard title="Pipeline controls" subtitle="Saved views, search, and focused filters.">
          <View style={styles.primaryViewsBlock}>
            <Text style={styles.filterGroupLabel}>Saved Views</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.primaryViewsRow}>
              {SAVED_VIEWS.map((view) => {
                const active = savedView === view.key;
                const count = savedViewCounts[view.key] ?? 0;
                return (
                  <Pressable
                    key={view.key}
                    onPress={() => setSavedView(view.key)}
                    style={({ pressed }) => [styles.primaryViewPill, active ? styles.primaryViewPillActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.primaryViewText, active ? styles.primaryViewTextActive : null]}>{view.label} ({count})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.searchControlRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={theme.colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search title, client, template, or assignee"
                placeholderTextColor={theme.colors.muted}
                style={styles.search}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.viewModeRow}>
              {([
                ["table", "list-outline"],
                ["card", "grid-outline"],
              ] as const).map(([mode, icon]) => {
                const active = viewMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setViewMode(mode)}
                    style={({ pressed }) => [styles.viewModeBtn, active ? styles.viewModeBtnActive : null, pressed ? styles.pressed : null]}
                  >
                    <Ionicons name={icon} size={16} color={active ? theme.colors.goldDark : theme.colors.muted} />
                  </Pressable>
                );
              })}
            </View>

            {canCreateOrReview(currentUserRole) ? (
              <Pressable onPress={() => router.push("/workorders/new")} style={({ pressed }) => [styles.controlCta, pressed ? styles.controlCtaPressed : null]}>
                <Text style={styles.controlCtaText}>+ New Work Order</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterGroups}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {STATUS_FILTERS.map((value) => {
                  const active = value === status;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setStatus(value)}
                      style={({ pressed }) => [styles.filterPill, active ? styles.filterPillActive : null, pressed ? styles.pressed : null]}
                    >
                      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {templateFilters.map((value) => {
                  const active = value === templateFilter;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setTemplateFilter(value)}
                      style={({ pressed }) => [styles.filterPill, active ? styles.filterPillActive : null, pressed ? styles.pressed : null]}
                    >
                      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>{value}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupLabel}>Sort</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {([
                  ["updated", "Updated"],
                  ["number", "WO #"],
                  ["priority", "Priority"],
                  ["due", "Due Date"],
                ] as const).map(([key, label]) => {
                  const active = sortKey === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setSortKey(key)}
                      style={({ pressed }) => [styles.filterPill, active ? styles.sortPillActive : null, pressed ? styles.pressed : null]}
                    >
                      <Text style={[styles.filterPillText, active ? styles.sortPillActiveText : null]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </ContentCard>

        <ContentCard
          title={viewMode === "table" ? "Work order table" : "Work order cards"}
          subtitle="Closer to the reference workspace: denser records plus clearer operational signals."
          meta={loading ? "Loading..." : `${filtered.length} shown`}
        >
          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Loading work orders...</Text>
            </View>
          ) : showEmpty ? (
            <EmptyState
              icon="clipboard-outline"
              title={canCreateOrReview(currentUserRole) ? "No work orders yet" : "No assigned work orders"}
              body={
                canCreateOrReview(currentUserRole)
                  ? "Create your first work order to start tracking jobs, reviews, and pricing in one place."
                  : "Once a manager assigns you work, those jobs will appear here automatically."
              }
              actionLabel={canCreateOrReview(currentUserRole) ? "New Work Order" : undefined}
              onAction={canCreateOrReview(currentUserRole) ? () => router.push("/workorders/new") : undefined}
            />
          ) : viewMode === "card" ? (
            <View style={styles.cardGrid}>
              {filtered.map((item) => {
                const isOverdue = isWorkOrderOverdue(item);
                const stageLabel =
                  item.archivedAt
                    ? "Archived"
                    : item.reviewStatus === "priced"
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
                    style={({ pressed }) => [styles.woCard, pressed ? styles.woCardPressed : null]}
                  >
                    <View style={styles.woCardHeader}>
                      <Text style={styles.woCardNumber}>{formatWorkOrderNumber(item.workOrderNumber)}</Text>
                      <View style={{ flex: 1 }} />
                      {isOverdue ? (
                        <View style={styles.overdueBubble}>
                          <Text style={styles.overdueBubbleText}>Overdue</Text>
                        </View>
                      ) : null}
                      <View style={[styles.priorityBadge, priorityBadgeStyle(item.priority)]}>
                        <Text style={styles.priorityBadgeText}>{item.priority.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.woCardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.woCardMeta}>{item.clientName}</Text>
                    <View style={styles.woCardMetaRow}>
                      <View style={[styles.statusChip, statusChipStyle(stageLabel)]}>
                        <Text style={styles.statusText}>{stageLabel}</Text>
                      </View>
                      <Text style={styles.woCardMetaMuted}>Due {formatDueDate(item.dueDate)}</Text>
                    </View>
                    <Text style={styles.woCardMetaMuted}>Assigned to {item.assignedDisplayName || "Unassigned"}</Text>
                    {canDeleteRows ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          void deleteWorkOrder(item);
                        }}
                        disabled={deletingId === item.id}
                        style={({ pressed }) => [
                          styles.deleteBtn,
                          confirmDeleteId === item.id ? styles.deleteBtnConfirm : null,
                          deletingId === item.id ? styles.disabledBtn : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        {deletingId === item.id ? (
                          <Text style={styles.deleteBtnText}>...</Text>
                        ) : confirmDeleteId === item.id ? (
                          <Text style={styles.deleteBtnText}>Sure?</Text>
                        ) : (
                          <Ionicons name="trash-outline" size={13} color="#B91C1C" />
                        )}
                      </Pressable>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.table}>
                <View style={styles.tableHead}>
                  <View style={styles.tableHeadMain}>
                    <Text style={[styles.th, styles.colId]}>WO #</Text>
                    <Text style={[styles.th, styles.colTitle]}>Title</Text>
                    <Text style={[styles.th, styles.colClient]}>Client</Text>
                    <Text style={[styles.th, styles.colAssigned]}>Assigned</Text>
                    <Text style={[styles.th, styles.colPriority]}>Priority</Text>
                    <Text style={[styles.th, styles.colStatus]}>Stage</Text>
                    <Text style={[styles.th, styles.colDue]}>Due</Text>
                    <Text style={[styles.th, styles.colUpdated]}>Updated</Text>
                  </View>
                  <View style={styles.tableHeadActions}>
                    <Text style={styles.th}>Actions</Text>
                  </View>
                </View>

                {filtered.map((item, index) => {
                  const isOverdue = isWorkOrderOverdue(item);
                  const stageLabel =
                    item.archivedAt
                      ? "Archived"
                      : item.reviewStatus === "priced"
                        ? "Priced"
                        : item.reviewStatus === "in_review"
                          ? "In Review"
                          : item.reviewStatus === "submitted_for_review"
                            ? "Needs Review"
                            : item.status;

                  return (
                    <View key={item.id} style={[styles.tr, index % 2 === 1 ? styles.trStriped : null]}>
                      <Pressable
                        onPress={() => router.push(`/workorders/${encodeURIComponent(item.id)}`)}
                        style={({ pressed }) => [styles.rowMain, pressed ? styles.trPressed : null]}
                      >
                        <Text style={[styles.td, styles.colId]} numberOfLines={1}>{formatWorkOrderNumber(item.workOrderNumber)}</Text>
                        <Text style={[styles.td, styles.colTitle]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.td, styles.colClient]} numberOfLines={1}>{item.clientName}</Text>
                        <Text style={[styles.td, styles.colAssigned]} numberOfLines={1}>{item.assignedDisplayName || "Unassigned"}</Text>
                        <View style={[styles.priorityBadge, styles.colPriority, priorityBadgeStyle(item.priority)]}>
                          <Text style={styles.priorityBadgeText}>{item.priority.toUpperCase()}</Text>
                        </View>
                        <View style={[styles.statusChip, styles.colStatus, statusChipStyle(stageLabel)]}>
                          <Text style={styles.statusText}>{stageLabel}</Text>
                        </View>
                        <View style={[styles.colDue, styles.dueCell]}>
                          <Text style={[styles.td, isOverdue ? styles.dueTextOverdue : null]}>{formatDueDate(item.dueDate)}</Text>
                          {isOverdue ? (
                            <View style={styles.overdueBubble}>
                              <Text style={styles.overdueBubbleText}>Overdue</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.td, styles.colUpdated]}>{formatRelativeTime(item.updatedAt)}</Text>
                      </Pressable>

                      <View style={styles.actionCell}>
                        <Pressable
                          onPress={() => router.push(`/workorders/${encodeURIComponent(item.id)}`)}
                          style={({ pressed }) => [styles.openBtn, pressed ? styles.pressed : null]}
                        >
                          <Ionicons name="open-outline" size={13} color={theme.colors.ink} />
                          <Text style={styles.openBtnText}>Open</Text>
                        </Pressable>
                        {canDeleteRows ? (
                          <Pressable
                            onPress={() => void deleteWorkOrder(item)}
                            disabled={deletingId === item.id}
                            style={({ pressed }) => [
                              styles.deleteBtn,
                              confirmDeleteId === item.id ? styles.deleteBtnConfirm : null,
                              deletingId === item.id ? styles.disabledBtn : null,
                              pressed ? styles.pressed : null,
                            ]}
                          >
                            {deletingId === item.id ? (
                              <Text style={styles.deleteBtnText}>...</Text>
                            ) : confirmDeleteId === item.id ? (
                              <Text style={styles.deleteBtnText}>Sure?</Text>
                            ) : (
                              <Ionicons name="trash-outline" size={13} color="#B91C1C" />
                            )}
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
          )}
        </ContentCard>

      </AppPage>
    </Screen>
  );
}
const styles = StyleSheet.create({
  alertsStrip: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  alertChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertChipAmber: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
  },
  alertChipRed: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  alertChipBlue: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  alertChipText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryViewsBlock: {
    gap: 8,
  },
  primaryViewsRow: {
    gap: 10,
    paddingBottom: 2,
  },
  primaryViewPill: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  primaryViewPillActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  primaryViewText: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 13,
  },
  primaryViewTextActive: {
    color: "#FFFFFF",
  },
  searchControlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
  },
  searchWrap: {
    flex: 1,
    minWidth: 260,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  pillRow: {
    gap: 8,
  },
  filterGroups: {
    gap: 12,
  },
  filterGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  filterGroupLabel: {
    minWidth: 72,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  filterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  filterPillText: {
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 12.5,
  },
  filterPillTextActive: {
    color: theme.colors.primaryHover,
  },
  sortPillActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  sortPillActiveText: {
    color: theme.colors.primaryHover,
  },
  viewModeRow: {
    flexDirection: "row",
    gap: 6,
  },
  viewModeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  viewModeBtnActive: {
    backgroundColor: theme.colors.surface2,
    borderColor: "#BFDBFE",
  },
  controlCta: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  controlCtaPressed: {
    backgroundColor: theme.colors.goldDark,
  },
  controlCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeadMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
    gap: 8,
  },
  tableHeadActions: {
    width: 150,
    paddingRight: 14,
    paddingVertical: 12,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  th: {
    color: theme.colors.muted,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  trStriped: {
    backgroundColor: "#F8FAFC",
  },
  trPressed: {
    backgroundColor: theme.colors.surface2,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 12,
    gap: 8,
  },
  td: {
    color: theme.colors.ink,
    fontWeight: "600",
    fontSize: 13.5,
  },
  colId: { width: 98 },
  colTitle: { flex: 1.2, minWidth: 100 },
  colClient: { flex: 1, minWidth: 115 },
  colAssigned: { width: 116 },
  colPriority: { width: 72, alignItems: "center", justifyContent: "center" },
  colStatus: { width: 112 },
  colDue: { width: 112 },
  colUpdated: { width: 78 },
  colActions: { width: 150 },
  dueCell: {
    gap: 4,
    justifyContent: "center",
  },
  dueTextOverdue: {
    color: "#B42318",
    fontWeight: "900",
  },
  overdueBubble: {
    alignSelf: "flex-start",
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  overdueBubbleText: {
    color: "#B42318",
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  actionCell: {
    width: 150,
    paddingRight: 14,
    paddingLeft: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  openBtn: {
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },
  deleteBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  deleteBtnConfirm: {
    backgroundColor: "#C14343",
    borderColor: "#C14343",
  },
  deleteBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  statusChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  statusOpen: { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
  statusReview: { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" },
  statusProgress: { backgroundColor: "#DCFCE7", borderColor: "#BBF7D0" },
  statusHold: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statusClosed: { backgroundColor: "#EDE9FE", borderColor: "#BFDBFE" },
  statusArchived: { backgroundColor: "#F1F5F9", borderColor: theme.colors.borderStrong },
  statusText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 11.5,
  },
  priorityBadge: {
    minHeight: 24,
    minWidth: 54,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  priorityBadgeText: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  priorityUrgent: { backgroundColor: "#FEE2E2", borderColor: "#FECACA" },
  priorityHigh: { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
  priorityNormal: { backgroundColor: "#F3F4F6", borderColor: theme.colors.border },
  priorityLow: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  woCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  woCardPressed: {
    borderColor: "#DBEAFE",
    backgroundColor: "#F8FAFC",
  },
  woCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  woCardNumber: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  woCardTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  woCardMeta: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "600",
  },
  woCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  woCardMetaMuted: {
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "500",
  },
  emptyWrap: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 18,
  },
  pressed: {
    opacity: 0.92,
  },
});
