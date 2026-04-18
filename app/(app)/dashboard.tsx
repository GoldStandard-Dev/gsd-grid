import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
  SoftAccentCard,
  SummaryCard,
  SummaryStrip,
} from "../../src/components/AppPage";
import EmptyState from "../../src/components/EmptyState";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";
import { theme } from "../../src/theme/theme";

type ActivityRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
};

type ActivityFilter = "All" | "Work Orders" | "Invoices" | "Pricing" | "Team";

type InvoiceRow = {
  total: number | string | null;
  balance_due: number | string | null;
  status: string | null;
  issue_date: string | null;
  created_at: string | null;
};

type RevenuePoint = {
  key: string;
  label: string;
  revenue: number;
};

type DashStats = {
  revenue: number;
  totalWOs: number;
  pendingWOs: number;
  completedWOs: number;
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function normalizeDetails(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeActivityRow(row: any): ActivityRow {
  return {
    id: String(row.id ?? ""),
    actor_user_id: row.actor_user_id ?? null,
    actor_name: row.actor_name ?? null,
    action: String(row.action ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    details: normalizeDetails(row.details),
  };
}

async function fetchActivityRows(orgId: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, actor_user_id, actor_name, action, created_at, entity_type, entity_id, details")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[dashboard activity] query failed", error.message);
    return [];
  }

  return (data ?? []).map(normalizeActivityRow);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function activityTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return timeAgo(iso);

  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (sameDay) return `${timeAgo(iso)} - Today at ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function sentenceCase(value: string) {
  const clean = value.trim();
  if (!clean) return "updated the workspace";
  return clean.charAt(0).toLowerCase() + clean.slice(1);
}

function getActivityCategory(item: ActivityRow) {
  const haystack = `${item.entity_type ?? ""} ${item.action}`.toLowerCase();
  if (haystack.includes("work_order") || haystack.includes("work order")) return "Work Order";
  if (haystack.includes("invoice")) return "Invoice";
  if (haystack.includes("pricing")) return "Pricing";
  if (haystack.includes("client")) return "Client";
  if (haystack.includes("team") || haystack.includes("invite") || haystack.includes("member")) return "Team";
  return titleCase(item.entity_type ?? "Operations");
}

function detailString(details: Record<string, unknown> | null | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function detailNumber(details: Record<string, unknown> | null | undefined, key: string) {
  const value = details?.[key];
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : 0;
}

function detailCurrency(details: Record<string, unknown> | null | undefined, key: string) {
  return money(detailNumber(details, key));
}

function parseLineItemChangeContext(action: string) {
  const detailText = action.split(" - ")[1]?.trim();
  if (!detailText?.includes("line item")) return null;

  const parts = detailText
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) return null;

  return `${parts.join(", ")} on this work order.`;
}

function getActivityContext(item: ActivityRow) {
  const action = item.action.toLowerCase();
  const details = item.details ?? {};
  const workOrderNumber = detailString(details, "work_order_number");
  const invoiceNumber = detailString(details, "invoice_number");

  if (action === "line_items_bulk_added") {
    const parts = [
      detailNumber(details, "measured_count") ? `${detailNumber(details, "measured_count")} measured` : "",
      detailNumber(details, "labor_count") ? `${detailNumber(details, "labor_count")} labor` : "",
      detailNumber(details, "material_count") ? `${detailNumber(details, "material_count")} material` : "",
    ].filter(Boolean);

    return parts.length ? `${parts.join(" - ")}.` : `Line items were added to ${workOrderNumber || "this work order"}.`;
  }

  if (action === "line_item_updated") {
    const field = detailString(details, "field_changed");
    const rowLabel = detailString(details, "row_label");
    const oldValue = detailString(details, "old_value");
    const newValue = detailString(details, "new_value");

    if (field && oldValue && newValue) {
      return `${titleCase(field)} changed from ${oldValue} to ${newValue}.`;
    }

    if (rowLabel) {
      return `${rowLabel} was updated.`;
    }
  }

  if (action === "line_items_updated") {
    const parts = [
      detailNumber(details, "added_count") ? `${detailNumber(details, "added_count")} added` : "",
      detailNumber(details, "updated_count") ? `${detailNumber(details, "updated_count")} updated` : "",
      detailNumber(details, "removed_count") ? `${detailNumber(details, "removed_count")} removed` : "",
    ].filter(Boolean);

    return parts.join(" - ") || `Line items changed on ${workOrderNumber || "this work order"}.`;
  }

  if (action === "stage_changed") {
    const oldValue = detailString(details, "old_value");
    const newValue = detailString(details, "new_value");
    if (oldValue && newValue) return `Moved from ${oldValue} to ${newValue}.`;
  }

  if (action === "pricing_imported") {
    const count = detailNumber(details, "count");
    const adjustmentTotal = detailNumber(details, "adjustment_total");
    return [
      count ? `${count} pricing rows` : "",
      adjustmentTotal ? `${money(adjustmentTotal)} in add-ons` : "",
    ].filter(Boolean).join(" - ") || `Pricing was imported into ${workOrderNumber || "this work order"}.`;
  }

  if (action === "created" && item.entity_type === "invoice") {
    return `Total: ${detailCurrency(details, "total")} - Balance due: ${detailCurrency(details, "balance_due")}.`;
  }

  if (action === "deleted" && item.entity_type === "invoice") {
    return `Invoice ${invoiceNumber || "record"} was removed from the billing queue.`;
  }

  const lineItemContext = parseLineItemChangeContext(item.action);
  if (lineItemContext) return lineItemContext;

  if (action.includes("created work order")) {
    const parts: string[] = [];
    const woTitle = detailString(details, "title");
    const client = detailString(details, "client_name");
    const template = detailString(details, "template_name");
    if (woTitle) parts.push(woTitle);
    if (client) parts.push(`Client: ${client}`);
    if (template) parts.push(`Template: ${template}`);
    return parts.length ? parts.join(" · ") : "A new work order entered the active pipeline.";
  }
  if (action.includes("submitted") && action.includes("review")) {
    return "Status changed from Draft to Submitted for Review.";
  }
  if (action.includes("completed pricing")) {
    return "Pricing moved to complete and is ready for invoice review.";
  }
  if (action.includes("added client")) {
    return "A client record was added and is ready for work orders.";
  }
  if (action.includes("deleted invoice")) {
    return "An invoice record was removed from the billing queue.";
  }
  if (action.includes("invoice")) {
    return "Billing activity was recorded for this workspace.";
  }

  return `${getActivityCategory(item)} activity recorded.`;
}

function getActivityRoute(item: ActivityRow) {
  if (!item.entity_id) return null;
  if (item.action.toLowerCase().includes("deleted")) return null;

  switch (item.entity_type) {
    case "work_order":
      return `/workorders/${item.entity_id}`;
    case "invoice":
      return `/invoices/${item.entity_id}`;
    case "client":
      return "/clients";
    default:
      return null;
  }
}

function getActorRoute(item: ActivityRow, currentUserId: string | null) {
  if (!item.actor_user_id) return null;
  if (item.actor_user_id === currentUserId) return "/profile";
  return "/workforce";
}

type SummaryChip = {
  label: string;
  tone: "add" | "remove" | "change";
};

function buildSummaryChips(details: Record<string, unknown> | null): SummaryChip[] {
  if (!details) return [];
  const summary = details.summary as Record<string, unknown> | undefined;
  if (!summary) return [];
  const chips: SummaryChip[] = [];
  const added = Number(summary.added ?? 0);
  const removed = Number(summary.removed ?? 0);
  const changed = Number(summary.changed ?? 0);
  if (added > 0) chips.push({ label: `+${added} added`, tone: "add" });
  if (removed > 0) chips.push({ label: `−${removed} removed`, tone: "remove" });
  if (changed > 0) chips.push({ label: `${changed} changed`, tone: "change" });
  return chips;
}

function buildChangeLines(details: Record<string, unknown> | null): { lines: string[]; more: number } {
  if (!details) return { lines: [], more: 0 };
  const changes = details.line_item_changes as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(changes) || changes.length === 0) return { lines: [], more: 0 };

  const lines: string[] = [];
  for (const change of changes.slice(0, 2)) {
    const type = String(change.type ?? "");
    const num = change.inventory_number ? `#${change.inventory_number}` : "";
    if (type === "added") {
      const rowType = String(change.row_type ?? "item");
      lines.push(`Line item ${num} added (${rowType})`);
    } else if (type === "removed") {
      lines.push(`Line item ${num} removed`);
    } else if (type === "changed") {
      const fields = change.fields as Record<string, { from: string; to: string }> | undefined;
      if (fields) {
        const firstField = Object.keys(fields)[0];
        if (firstField) {
          const f = fields[firstField];
          lines.push(`Line item ${num} ${firstField}: ${f.from} → ${f.to}`);
        }
      }
    }
  }
  const more = Math.max(0, changes.length - 2);
  return { lines, more };
}

function getActivityHeadline(item: ActivityRow): string {
  const action = item.action.toLowerCase();
  const details = item.details ?? {};

  if (action === "line_items_bulk_added") {
    const total =
      detailNumber(details, "added_count") ||
      detailNumber(details, "measured_count") +
        detailNumber(details, "labor_count") +
        detailNumber(details, "material_count");
    const label = total > 0 ? `${total} line item${total !== 1 ? "s" : ""}` : "line items";
    return `Added ${label}`;
  }

  if (action === "line_item_updated") return "Updated a line item";
  if (action === "line_items_updated") return "Updated line items";
  if (action === "stage_changed") return "Stage changed";
  if (action === "pricing_imported") return "Pricing imported";
  if (action === "created" && item.entity_type === "invoice") return "Invoice created";
  if (action === "deleted" && item.entity_type === "invoice") return "Invoice deleted";

  // Natural-language action strings (e.g. "created work order WO-0003") stay as-is
  if (item.action.includes(" ")) return sentenceCase(item.action);

  // Final fallback: convert snake_case / kebab-case to Title Case
  return titleCase(item.action);
}

function describeActivity(item: ActivityRow, currentUserId: string | null) {
  const actor = item.actor_name?.trim() || (item.actor_user_id ? "Unknown actor" : "System");
  const normalizedAction = item.action.toLowerCase();
  const isDeleted = normalizedAction.includes("deleted") || normalizedAction === "deleted";
  const { lines: changeLines, more: moreChanges } = buildChangeLines(item.details);

  return {
    actor,
    actorRoute: getActorRoute(item, currentUserId),
    category: getActivityCategory(item),
    context: getActivityContext(item),
    headline: getActivityHeadline(item),
    statusLabel: isDeleted ? "Removed" : "Open",
    route: getActivityRoute(item),
    timeLabel: activityTimeLabel(item.created_at),
    summaryChips: buildSummaryChips(item.details),
    changeLines,
    moreChanges,
  };
}

const ACTIVITY_FILTERS: ActivityFilter[] = ["All", "Work Orders", "Invoices", "Pricing", "Team"];

function getRecognizedRevenue(invoice: InvoiceRow) {
  const total = Number(invoice.total ?? 0);
  const balanceDue = Number(invoice.balance_due ?? 0);
  const status = String(invoice.status ?? "").toLowerCase();

  if (status === "paid") return Math.max(total, 0);
  if (status === "partial") return Math.max(total - balanceDue, 0);
  return 0;
}

function buildRevenueSeries(invoices: InvoiceRow[]): RevenuePoint[] {
  const now = new Date();
  const buckets: RevenuePoint[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;

    buckets.push({
      key,
      label: bucketDate.toLocaleDateString([], { month: "short" }),
      revenue: 0,
    });
  }

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const invoice of invoices) {
    const dateValue = invoice.issue_date || invoice.created_at;
    if (!dateValue) continue;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketMap.get(key);
    if (!bucket) continue;

    bucket.revenue += getRecognizedRevenue(invoice);
  }

  return buckets.map((bucket) => ({
    ...bucket,
    revenue: Number(bucket.revenue.toFixed(2)),
  }));
}

const PENDING_STATUSES = ["new", "scheduled", "in_progress", "blocked"];

export default function Dashboard() {
  const router = useRouter();

  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [stats, setStats] = useState<DashStats>({
    revenue: 0,
    totalWOs: 0,
    pendingWOs: 0,
    completedWOs: 0,
  });
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("All");
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (!uid) return;

        setCurrentUserId(uid);

        const orgId = await getUserOrgId(uid);
        if (!orgId) return;

        const [activityRows, woRes, invoiceRes] = await Promise.all([
          fetchActivityRows(orgId),
          supabase
            .from("work_orders")
            .select("status")
            .eq("org_id", orgId),
          supabase
            .from("invoices")
            .select("total, balance_due, status, issue_date, created_at")
            .eq("org_id", orgId)
            .neq("status", "void"),
        ]);

        if (cancelled) return;

        const wos = woRes.data ?? [];
        const invoices = (invoiceRes.data ?? []) as InvoiceRow[];
        const recognizedRevenue = invoices.reduce(
          (sum, invoice) => sum + getRecognizedRevenue(invoice),
          0
        );

        setStats({
          totalWOs: wos.length,
          pendingWOs: wos.filter((w: { status: string | null }) =>
            PENDING_STATUSES.includes(String(w.status ?? ""))
          ).length,
          completedWOs: wos.filter((w: { status: string | null }) => w.status === "completed").length,
          revenue: Number(recognizedRevenue.toFixed(2)),
        });

        setRevenueData(buildRevenueSeries(invoices));
        setActivity(activityRows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const summary = [
    {
      label: "Revenue",
      value: money(stats.revenue),
      meta: "Collected from paid and partial invoices",
      trend: {
        value: stats.revenue > 0 ? "Live invoice data" : "No activity yet",
        tone: "neutral" as const,
      },
    },
    {
      label: "Work Orders",
      value: String(stats.totalWOs),
      meta: "Total pipeline",
      trend: { value: `${stats.totalWOs} total`, tone: "neutral" as const },
    },
    {
      label: "Pending",
      value: String(stats.pendingWOs),
      meta: "Needs review or follow-up",
      trend: {
        value: stats.pendingWOs > 0 ? "In progress" : "Waiting on first submission",
        tone: stats.pendingWOs > 0 ? ("neutral" as const) : ("negative" as const),
      },
    },
    {
      label: "Completed",
      value: String(stats.completedWOs),
      meta: "Closed and ready to bill",
      trend: {
        value: stats.completedWOs > 0 ? "Ready to bill" : "Ready to grow",
        tone: "positive" as const,
      },
    },
  ];

  const filteredActivity = useMemo(() => {
    if (activityFilter === "All") return activity;
    return activity.filter((item) => {
      const category = getActivityCategory(item);
      if (activityFilter === "Work Orders") return category === "Work Order";
      if (activityFilter === "Invoices") return category === "Invoice";
      if (activityFilter === "Pricing") return category === "Pricing";
      return category === "Team";
    });
  }, [activity, activityFilter]);

  const unclearedActivity = useMemo(
    () => filteredActivity.filter((item) => !clearedIds.has(item.id)),
    [filteredActivity, clearedIds],
  );

  const visibleActivity = useMemo(
    () =>
      (showAllActivity ? unclearedActivity : unclearedActivity.slice(0, 10)).map((item) => ({
        item,
        display: describeActivity(item, currentUserId),
      })),
    [unclearedActivity, showAllActivity, currentUserId],
  );

  const hiddenCount = unclearedActivity.length - visibleActivity.length;

  const maxRevenue = Math.max(...revenueData.map((point) => point.revenue), 0);

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow=""
          title="Dashboard"
          subtitle="Track revenue, work orders, and team activity from one consistent workspace."
          actions={[
            {
              label: loading ? "Refreshing..." : "Refresh",
              onPress: () => {
                setLoading(true);
                setRefreshKey((k) => k + 1);
              },
            },
            {
              label: "New Work Order",
              primary: true,
              onPress: () => router.push("/workorders/new"),
            },
          ]}
        />

        <SummaryStrip>
          {summary.map((item) => (
            <SummaryCard
              key={item.label}
              label={item.label}
              value={item.value}
              meta={item.meta}
              trend={item.trend}
            />
          ))}
        </SummaryStrip>

        <View style={styles.grid}>
          <View style={styles.primaryColumn}>
            <ContentCard
              title="Operations Activity"
              subtitle="A descriptive timeline of who changed what, where it happened, and why it matters."
              meta={hiddenCount > 0 ? `+${hiddenCount} more` : undefined}
            >
              {loading ? (
                <Text style={styles.feedMeta}>Loading activity...</Text>
              ) : activity.length === 0 ? (
                <EmptyState
                  icon="pulse-outline"
                  title="No activity yet"
                  body="Create your first work order to start seeing team actions, billing updates, and workflow changes here."
                  actionLabel="New Work Order"
                  onAction={() => router.push("/workorders/new")}
                />
              ) : (
                <View style={styles.feedStack}>
                  <View style={styles.feedFilterRow}>
                    {ACTIVITY_FILTERS.map((filter) => {
                      const active = activityFilter === filter;
                      return (
                        <Pressable
                          key={filter}
                          onPress={() => setActivityFilter(filter)}
                          style={({ pressed }) => [
                            styles.feedFilterPill,
                            active ? styles.feedFilterPillActive : null,
                            pressed ? styles.feedRowPressed : null,
                          ]}
                        >
                          <Text style={[styles.feedFilterText, active ? styles.feedFilterTextActive : null]}>
                            {filter}
                          </Text>
                        </Pressable>
                      );
                    })}

                    <View style={styles.feedFilterSpacer} />

                    {unclearedActivity.length > 0 && (
                      <Pressable
                        onPress={() => {
                          setClearedIds((prev) => {
                            const next = new Set(prev);
                            unclearedActivity.forEach((item) => next.add(item.id));
                            return next;
                          });
                          setShowAllActivity(false);
                        }}
                        style={({ pressed }) => [
                          styles.feedFilterPill,
                          styles.feedFilterPillClear,
                          pressed ? styles.feedRowPressed : null,
                        ]}
                      >
                        <Text style={styles.feedFilterTextClear}>Clear</Text>
                      </Pressable>
                    )}
                  </View>

                  {visibleActivity.length === 0 ? (
                    <View style={styles.feedEmptyFilter}>
                      <Text style={styles.feedContext}>No {activityFilter.toLowerCase()} activity yet.</Text>
                    </View>
                  ) : (
                    visibleActivity.map(({ item, display }, index) => (
                      <View
                        key={item.id}
                        style={[
                          styles.feedRow,
                          index === visibleActivity.length - 1 ? styles.feedRowLast : null,
                        ]}
                      >
                        <View style={styles.feedDotWrap}>
                          <View style={styles.feedDot} />
                        </View>

                        <View style={styles.feedBody}>
                          <View style={styles.feedTopLine}>
                            <Text style={styles.feedBadge}>{display.category}</Text>
                            <Text style={styles.feedMeta}>{display.timeLabel}</Text>
                          </View>

                          <View style={styles.feedSentenceRow}>
                            <Pressable
                              disabled={!display.actorRoute}
                              onPress={() => {
                                if (display.actorRoute) router.push(display.actorRoute as any);
                              }}
                              style={({ pressed }) => [
                                styles.feedActorLink,
                                pressed && display.actorRoute ? styles.feedActorLinkPressed : null,
                              ]}
                            >
                              <Text style={styles.feedActor}>{display.actor}</Text>
                            </Pressable>

                            <Text style={styles.feedText}>{display.headline}</Text>
                          </View>

                          <Text style={styles.feedContext}>{display.context}</Text>

                          {/* Summary chips from details.summary */}
                          {display.summaryChips.length > 0 && (
                            <View style={styles.feedChipsRow}>
                              {display.summaryChips.map((chip) => (
                                <View
                                  key={chip.label}
                                  style={[styles.feedChip, chip.tone === "add" ? styles.feedChipAdd : chip.tone === "remove" ? styles.feedChipRemove : styles.feedChipChange]}
                                >
                                  <Text style={[styles.feedChipText, chip.tone === "add" ? styles.feedChipTextAdd : chip.tone === "remove" ? styles.feedChipTextRemove : styles.feedChipTextChange]}>
                                    {chip.label}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          {/* First 2 line item changes */}
                          {display.changeLines.length > 0 && (
                            <View style={styles.feedChangeLinesWrap}>
                              {display.changeLines.map((line, i) => (
                                <Text key={i} style={styles.feedChangeLine}>
                                  {line}
                                </Text>
                              ))}
                              {display.moreChanges > 0 && (
                                <Text style={styles.feedChangeLineMore}>
                                  +{display.moreChanges} more change{display.moreChanges > 1 ? "s" : ""}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>

                        <Pressable
                          disabled={!display.route}
                          onPress={() => {
                            if (display.route) router.push(display.route as any);
                          }}
                          style={({ pressed }) => [
                            styles.feedOpenAction,
                            pressed && display.route ? styles.feedRowPressed : null,
                          ]}
                        >
                          <Text style={[styles.feedOpenText, !display.route ? styles.feedClosedText : null]}>
                            {display.statusLabel}
                          </Text>
                        </Pressable>
                      </View>
                    ))
                  )}

                  <View style={styles.feedFooterRow}>
                    {unclearedActivity.length > 10 && (
                      <Pressable
                        style={[styles.feedFooterAction, styles.feedFooterActionPrimary]}
                        onPress={() => setShowAllActivity((v) => !v)}
                      >
                        <Text style={styles.feedFooterTextPrimary}>
                          {showAllActivity
                            ? "Show less"
                            : `Show all ${unclearedActivity.length}`}
                        </Text>
                      </Pressable>
                    )}
                    {clearedIds.size > 0 && (
                      <Pressable
                        style={styles.feedFooterAction}
                        onPress={() => setClearedIds(new Set())}
                      >
                        <Text style={styles.feedFooterText}>
                          Restore {clearedIds.size} cleared
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={styles.feedFooterAction}
                      onPress={() => router.push("/workorders")}
                    >
                      <Text style={styles.feedFooterText}>View work orders</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </ContentCard>

            <ContentCard
              title="Revenue trend"
              subtitle="Linked to live invoice records so the chart reflects real collected revenue."
            >
              <View style={styles.chartPlaceholder}>
                <View style={styles.chartBars}>
                  {revenueData.map((point, index) => {
                    const barHeight =
                      maxRevenue > 0
                        ? Math.max(20, Math.round((point.revenue / maxRevenue) * 110))
                        : 20;

                    return (
                      <Pressable
                        key={point.key}
                        style={[
                          styles.barWrap,
                          index === revenueData.length - 1 ? styles.barWrapFeatured : null,
                        ]}
                        onPress={() => router.push("/invoices")}
                      >
                        <View style={[styles.bar, { height: barHeight }]} />
                        <Text style={styles.barLabel}>{point.label}</Text>
                        <Text style={styles.barValue}>{money(point.revenue)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.chartMeta}>
                  {stats.revenue > 0
                    ? `${money(stats.revenue)} total collected from paid and partial invoices.`
                    : "No revenue recorded yet. The first paid invoice will start the trend graph."}
                </Text>
              </View>
            </ContentCard>
          </View>

          <View style={styles.secondaryColumn}>
            <SoftAccentCard
              title="Notifications"
              body="Alerts stay compact here so the main dashboard can stay focused on operations."
            >
              <View style={styles.noticeStack}>
                <Text style={styles.noticeText}>
                  No notifications right now. New approvals and overdue alerts will appear here.
                </Text>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => router.push("/workorders")}
                >
                  <Text style={styles.secondaryBtnText}>View work orders</Text>
                </Pressable>
              </View>
            </SoftAccentCard>

            <ContentCard
              title="Status snapshot"
              subtitle="A compact read on the current pipeline."
            >
              <View style={styles.statusStack}>
                {[
                  ["Pending", String(stats.pendingWOs)],
                  ["Completed", String(stats.completedWOs)],
                  ["Total", String(stats.totalWOs)],
                ].map(([label, value], index, array) => (
                  <View
                    key={label}
                    style={[
                      styles.statusRow,
                      index === array.length - 1 ? styles.statusRowLast : null,
                    ]}
                  >
                    <Text style={styles.statusLabel}>{label}</Text>
                    <Text style={styles.statusValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </ContentCard>
          </View>
        </View>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    alignItems: "flex-start",
  },
  primaryColumn: {
    flex: 1.8,
    minWidth: 320,
    gap: 20,
  },
  secondaryColumn: {
    flex: 1,
    minWidth: 280,
    gap: 20,
  },

  feedStack: {
    gap: 0,
  },
  feedFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 10,
  },
  feedFilterPill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  feedFilterPillActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  feedFilterText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  feedFilterTextActive: {
    color: theme.colors.goldDark,
  },
  feedEmptyFilter: {
    minHeight: 72,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  feedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    borderRadius: 12,
  },
  feedRowLast: {
    borderBottomWidth: 0,
  },
  feedRowPressed: {
    backgroundColor: "#EFF6FF",
  },
  feedDotWrap: {
    width: 18,
    alignItems: "center",
    paddingTop: 5,
  },
  feedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.gold,
    marginTop: 5,
    flexShrink: 0,
  },
  feedBody: {
    flex: 1,
    gap: 5,
  },
  feedTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  feedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    color: theme.colors.goldDark,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  feedText: {
    flexShrink: 1,
    fontSize: 13.5,
    fontWeight: "500",
    color: theme.colors.ink,
    lineHeight: 19,
  },
  feedSentenceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 4,
  },
  feedActorLink: {
    borderRadius: 6,
  },
  feedActorLinkPressed: {
    backgroundColor: "#EFF6FF",
  },
  feedActor: {
    fontWeight: "800",
    color: theme.colors.goldDark,
    fontSize: 13.5,
    lineHeight: 19,
  },
  feedMeta: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "500",
  },
  feedContext: {
    fontSize: 12.5,
    color: theme.colors.muted,
    fontWeight: "600",
    lineHeight: 18,
  },
  feedOpenText: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
  },
  feedOpenAction: {
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 6,
    marginTop: 18,
  },
  feedClosedText: {
    color: theme.colors.muted,
  },
  feedFooterAction: {
    marginTop: 10,
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  feedFooterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  feedFooterText: {
    color: theme.colors.goldDark,
    fontSize: 12.5,
    fontWeight: "900",
  },
  feedFooterActionPrimary: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.gold2,
  },
  feedFooterTextPrimary: {
    color: theme.colors.goldDark,
    fontSize: 12.5,
    fontWeight: "900",
  },
  feedFilterSpacer: {
    flex: 1,
  },
  feedFilterPillClear: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  feedFilterTextClear: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
  },

  feedChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },
  feedChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  feedChipAdd: {
    backgroundColor: "#DCFCE7",
  },
  feedChipRemove: {
    backgroundColor: "#FEE2E2",
  },
  feedChipChange: {
    backgroundColor: "#FEF9C3",
  },
  feedChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  feedChipTextAdd: {
    color: "#166534",
  },
  feedChipTextRemove: {
    color: "#991B1B",
  },
  feedChipTextChange: {
    color: "#854D0E",
  },
  feedChangeLinesWrap: {
    marginTop: 3,
    gap: 2,
  },
  feedChangeLine: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "600",
    fontStyle: "italic",
  },
  feedChangeLineMore: {
    fontSize: 11,
    color: theme.colors.mutedSoft,
    fontWeight: "700",
  },

  chartPlaceholder: {
    gap: 14,
  },
  chartBars: {
    minHeight: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  barWrap: {
    flex: 1,
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  barWrapFeatured: {
    backgroundColor: "#EDE9FE",
  },
  bar: {
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    width: "100%",
    maxWidth: 28,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 10.5,
    fontWeight: "800",
    color: theme.colors.muted,
    textTransform: "uppercase",
  },
  barValue: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  chartMeta: {
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "500",
  },

  noticeStack: {
    marginTop: 8,
    gap: 12,
  },
  noticeText: {
    color: theme.colors.ink,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "500",
  },
  secondaryBtn: {
    minHeight: 40,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: theme.colors.goldDark,
    fontSize: 13,
    fontWeight: "800",
  },

  statusStack: {
    gap: 0,
  },
  statusRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statusRowLast: {
    borderBottomWidth: 0,
  },
  statusLabel: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "600",
  },
  statusValue: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },
});
