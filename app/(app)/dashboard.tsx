import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, G } from "react-native-svg";
import Screen from "../../src/components/Screen";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";
import { formatDateTime, formatInvoiceNumber, formatWorkOrderNumber } from "../../src/lib/format";

type ActivityDetails = {
  title?: string;
  client_name?: string | null;
  clientName?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  priority?: string | null;
  work_order_number?: number | null;
  invoice_number?: number | null;
  total?: number | null;
  balance_due?: number | null;
  changed_fields?: string[];
};

type ActivityRow = {
  id: string;
  created_at: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: ActivityDetails | null;
};

type NotificationRow = {
  id: string;
  org_id?: string | null;
  user_id?: string | null;
  title?: string | null;
  message?: string | null;
  type?: string | null;
  read?: boolean | null;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
};

type DashboardCounts = {
  openWorkOrders: number;
  unpaidInvoices: number;
  clients: number;
};

type WorkOrderStatusCounts = {
  draft: number;
  inProgress: number;
  submitted: number;
  approved: number;
  completed: number;
};

type DashboardStat = {
  key: string;
  label: string;
  value: string;
  numericValue: number;
  actionLabel: string;
  onPress: () => void;
  color: string;
  trackColor: string;
};

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DoughnutChart({
  value,
  total,
  color,
  trackColor,
  size = 94,
  strokeWidth = 12,
}: {
  value: number;
  total: number;
  color: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
}) {
  const normalizedTotal = Math.max(total, 1);
  const progress = Math.max(0, Math.min(value / normalizedTotal, 1));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <View style={styles.doughnutWrap}>
      <View style={[styles.doughnutShadowRing, { width: size, height: size, borderRadius: size / 2 }]} />

      <Svg width={size} height={size} style={styles.doughnutSvg}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="transparent" />
          <Circle
            cx={size / 2}
            cy={size / 2 + 3}
            r={radius}
            stroke="rgba(0,0,0,0.16)"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={Math.max(2, strokeWidth * 0.22)}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset + circumference * 0.015}
          />
        </G>
      </Svg>

      <View
        style={[
          styles.doughnutInner,
          {
            width: size - strokeWidth * 2.2,
            height: size - strokeWidth * 2.2,
            borderRadius: (size - strokeWidth * 2.2) / 2,
          },
        ]}
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  numericValue,
  total,
  actionLabel,
  onPress,
  color,
  trackColor,
}: {
  label: string;
  value: string;
  numericValue: number;
  total: number;
  actionLabel?: string;
  onPress?: () => void;
  color: string;
  trackColor: string;
}) {
  const inner = (
    <View style={styles.statCard}>
      <View style={styles.statTopRow}>
        <View style={styles.statCopy}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>

        <DoughnutChart value={numericValue} total={total} color={color} trackColor={trackColor} />
      </View>

      {actionLabel ? (
        <View style={styles.statFooter}>
          <Text style={styles.statFooterText}>{actionLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statCardPressable, pressed ? styles.pressed : null]}>
      {inner}
    </Pressable>
  );
}

function QuickAction({
  label,
  onPress,
  primary,
  destructive,
}: {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        primary ? styles.quickActionPrimary : null,
        destructive ? styles.quickActionDestructive : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text
        style={[
          styles.quickActionText,
          primary ? styles.quickActionTextPrimary : null,
          destructive ? styles.quickActionTextDestructive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ActionCard({
  title,
  subtitle,
  onPress,
  primary,
}: {
  title: string;
  subtitle: string;
  onPress?: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionCard, primary ? styles.actionCardPrimary : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.actionCardTitle, primary ? styles.actionCardTitlePrimary : null]}>{title}</Text>
      <Text style={[styles.actionCardSubtitle, primary ? styles.actionCardSubtitlePrimary : null]}>{subtitle}</Text>
    </Pressable>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "default" | "warning" | "good";
}) {
  return (
    <View
      style={[
        styles.insightCard,
        tone === "warning" ? styles.insightCardWarning : null,
        tone === "good" ? styles.insightCardGood : null,
      ]}
    >
      <Text style={styles.insightLabel}>{title}</Text>
      <Text style={styles.insightValue}>{value}</Text>
      <Text style={styles.insightSub}>{subtitle}</Text>
    </View>
  );
}

function normalizeAction(action: string) {
  const value = (action ?? "").trim().toLowerCase();

  if (!value) return "updated";
  if (value.includes("create") || value.includes("added") || value.includes("insert")) return "created";
  if (value.includes("delete") || value.includes("remove")) return "deleted";
  if (value.includes("convert")) return "converted";
  if (value.includes("invite")) return "invited";
  if (value.includes("accept")) return "accepted";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("update") || value.includes("edit") || value.includes("modify")) return "updated";

  return value;
}

function formatEntityLabel(entityType: string) {
  const normalized = (entityType ?? "").replaceAll("_", " ").trim();
  if (!normalized) return "Record";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getSectionLabel(entityType: string) {
  if (entityType === "work_order") return "Work Orders";
  if (entityType === "invoice") return "Invoices";
  if (entityType === "client") return "Clients";
  if (entityType === "org_invite" || entityType === "org_member") return "Team";
  return formatEntityLabel(entityType);
}

function buildActivitySubject(item: ActivityRow) {
  if (item.entity_type === "work_order") {
    const workOrderLabel = formatWorkOrderNumber(item.details?.work_order_number);
    const title = item.details?.title?.trim();

    if (workOrderLabel !== "—" && title) return `Work Order ${workOrderLabel} • ${title}`;
    if (workOrderLabel !== "—") return `Work Order ${workOrderLabel}`;
    if (title) return `Work Order • ${title}`;
    return "Work Order";
  }

  if (item.entity_type === "invoice") {
    const invoiceLabel = formatInvoiceNumber(item.details?.invoice_number);
    const client = item.details?.client_name?.trim() || item.details?.clientName?.trim();

    if (invoiceLabel !== "—" && client) return `Invoice ${invoiceLabel} • ${client}`;
    if (invoiceLabel !== "—") return `Invoice ${invoiceLabel}`;
    if (client) return `Invoice • ${client}`;
    return "Invoice";
  }

  if (item.entity_type === "client") {
    const client = item.details?.client_name?.trim() || item.details?.clientName?.trim() || item.details?.name?.trim();

    if (client) return `Client • ${client}`;
    return "Client";
  }

  if (item.entity_type === "org_invite") {
    const email = item.details?.email?.trim() || item.details?.name?.trim();
    const role = item.details?.role?.trim();

    if (email && role) return `Invite • ${email} • ${role}`;
    if (email) return `Invite • ${email}`;
    return "Invite";
  }

  if (item.entity_type === "org_member") {
    const name = item.details?.name?.trim() || item.details?.email?.trim();
    const role = item.details?.role?.trim();

    if (name && role) return `Team Member • ${name} • ${role}`;
    if (name) return `Team Member • ${name}`;
    return "Team Member";
  }

  return formatEntityLabel(item.entity_type);
}

function buildActivityTitle(item: ActivityRow) {
  const actor = item.actor_name?.trim() || "Someone";
  const action = normalizeAction(item.action);
  const subject = buildActivitySubject(item);
  return `${actor} ${action} ${subject}`;
}

function buildActivityWhere(item: ActivityRow) {
  return `Where: ${getSectionLabel(item.entity_type)}`;
}

function buildActivityMeta(item: ActivityRow) {
  const time = formatDateTime(item.created_at);
  const action = normalizeAction(item.action);

  if (item.details?.changed_fields?.length) {
    return `${time} • Updated: ${item.details.changed_fields.join(", ")}`;
  }

  if (action === "created") return `${time} • New record`;
  if (action === "deleted") return `${time} • Record removed`;
  if (action === "invited") return item.details?.status ? `${time} • Status: ${item.details.status}` : `${time} • Invite sent`;
  if (action === "accepted") return `${time} • Invite accepted`;
  if (action === "cancelled") return `${time} • Invite cancelled`;

  return time;
}

function getActivityBadge(item: ActivityRow) {
  if (item.entity_type === "work_order") return "work order";
  if (item.entity_type === "invoice") return "invoice";
  if (item.entity_type === "client") return "client";
  if (item.entity_type === "org_invite") return "invite";
  if (item.entity_type === "org_member") return "team";
  return item.entity_type.replaceAll("_", " ");
}

function getActivityDotStyle(item: ActivityRow) {
  if (item.entity_type === "invoice") return styles.dotInvoice;
  if (item.entity_type === "client") return styles.dotClient;
  if (item.entity_type === "org_invite") return styles.dotInvite;
  if (item.entity_type === "org_member") return styles.dotTeam;
  return styles.dotWorkOrder;
}

function getPipelineCounts(workOrders: Array<{ status?: string | null }>) {
  return workOrders.reduce<WorkOrderStatusCounts>(
    (acc, item) => {
      const status = (item.status ?? "").trim().toLowerCase();

      if (status === "draft") acc.draft += 1;
      else if (status === "submitted" || status === "submitted for review" || status === "review") acc.submitted += 1;
      else if (status === "approved") acc.approved += 1;
      else if (status === "completed" || status === "complete") acc.completed += 1;
      else if (status === "closed") return acc;
      else acc.inProgress += 1;

      return acc;
    },
    {
      draft: 0,
      inProgress: 0,
      submitted: 0,
      approved: 0,
      completed: 0,
    }
  );
}

function PipelineBar({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const widthPercent = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 10 : 0) : 0;

  return (
    <View style={styles.pipelineRow}>
      <View style={styles.pipelineTop}>
        <Text style={styles.pipelineLabel}>{label}</Text>
        <Text style={styles.pipelineValue}>{value}</Text>
      </View>

      <View style={styles.pipelineTrack}>
        <View style={[styles.pipelineFill, { width: `${widthPercent}%` }]} />
      </View>
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();

  const [items, setItems] = useState<ActivityRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [counts, setCounts] = useState<DashboardCounts>({
    openWorkOrders: 0,
    unpaidInvoices: 0,
    clients: 0,
  });
  const [pipeline, setPipeline] = useState<WorkOrderStatusCounts>({
    draft: 0,
    inProgress: 0,
    submitted: 0,
    approved: 0,
    completed: 0,
  });
  const [revenue, setRevenue] = useState(0);
  const [collectedRevenue, setCollectedRevenue] = useState(0);

  const statTotal = useMemo(
    () => Math.max(counts.openWorkOrders + counts.unpaidInvoices + counts.clients, 1),
    [counts]
  );

  const stats = useMemo<DashboardStat[]>(
    () => [
      {
        key: "openWorkOrders",
        label: "Open Work Orders",
        value: String(counts.openWorkOrders),
        numericValue: counts.openWorkOrders,
        actionLabel: "Open jobs",
        onPress: () => router.push("/workorders"),
        color: "#d4af37",
        trackColor: "#f3e9c6",
      },
      {
        key: "unpaidInvoices",
        label: "Invoices (Unpaid)",
        value: String(counts.unpaidInvoices),
        numericValue: counts.unpaidInvoices,
        actionLabel: "Review invoices",
        onPress: () => router.push("/invoices"),
        color: "#3b82f6",
        trackColor: "#dceafe",
      },
      {
        key: "clients",
        label: "Clients",
        value: String(counts.clients),
        numericValue: counts.clients,
        actionLabel: "View clients",
        onPress: () => router.push("/clients"),
        color: "#10b981",
        trackColor: "#d9f9ee",
      },
    ],
    [counts, router]
  );

  const visibleItems = useMemo(() => items.slice(0, 10), [items]);
  const visibleNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);
  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const attentionCards = useMemo(
    () => [
      {
        title: "Needs pricing",
        value: String(pipeline.draft),
        subtitle: pipeline.draft === 1 ? "1 job still in draft" : `${pipeline.draft} jobs still in draft`,
        tone: pipeline.draft > 0 ? ("warning" as const) : ("default" as const),
      },
      {
        title: "Waiting review",
        value: String(pipeline.submitted),
        subtitle: pipeline.submitted === 1 ? "1 submitted work order" : `${pipeline.submitted} submitted work orders`,
        tone: pipeline.submitted > 0 ? ("warning" as const) : ("default" as const),
      },
      {
        title: "Ready to bill",
        value: String(pipeline.completed),
        subtitle: pipeline.completed === 1 ? "1 completed job" : `${pipeline.completed} completed jobs`,
        tone: pipeline.completed > 0 ? ("good" as const) : ("default" as const),
      },
    ],
    [pipeline]
  );

  const pipelineRows = useMemo(
    () => [
      { key: "draft", label: "Draft", value: pipeline.draft },
      { key: "inProgress", label: "In Progress", value: pipeline.inProgress },
      { key: "submitted", label: "Submitted", value: pipeline.submitted },
      { key: "approved", label: "Approved", value: pipeline.approved },
      { key: "completed", label: "Completed", value: pipeline.completed },
    ],
    [pipeline]
  );

  const pipelineMax = useMemo(() => Math.max(...pipelineRows.map((item) => item.value), 1), [pipelineRows]);

  const loadDashboard = useCallback(async () => {
    setNotificationError("");

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    const orgId = await getUserOrgId(userId);
    if (!orgId) return;

    const [orgRes, activityRes, workOrdersRes, invoicesRes, clientsRes, allInvoicesRes] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", orgId).single(),
      supabase
        .from("activity_log")
        .select("id, created_at, actor_name, action, entity_type, entity_id, details")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("work_orders").select("id, status").eq("org_id", orgId),
      supabase.from("invoices").select("id, status").eq("org_id", orgId).neq("status", "paid").neq("status", "Paid"),
      supabase.from("clients").select("id").eq("org_id", orgId),
      supabase.from("invoices").select("id, status, total, balance_due").eq("org_id", orgId),
    ]);

    const allWorkOrders = (workOrdersRes.data ?? []) as Array<{ id: string; status?: string | null }>;
    const openWorkOrders = allWorkOrders.filter((item) => {
      const status = (item.status ?? "").trim().toLowerCase();
      return status !== "closed" && status !== "completed" && status !== "complete";
    });

    const allInvoices = (allInvoicesRes.data ?? []) as Array<{
      id: string;
      status?: string | null;
      total?: number | null;
      balance_due?: number | null;
    }>;

    const grossRevenue = allInvoices.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
    const paidRevenue = allInvoices.reduce((sum, item) => {
      const status = (item.status ?? "").trim().toLowerCase();
      return status === "paid" ? sum + Number(item.total ?? 0) : sum;
    }, 0);

    setOrgName(orgRes.data?.name ?? "");
    setItems((activityRes.data as ActivityRow[]) ?? []);
    setCounts({
      openWorkOrders: openWorkOrders.length,
      unpaidInvoices: invoicesRes.data?.length ?? 0,
      clients: clientsRes.data?.length ?? 0,
    });
    setRevenue(grossRevenue);
    setCollectedRevenue(paidRevenue);
    setPipeline(getPipelineCounts(allWorkOrders));

    const notificationsRes = await supabase
      .from("notifications")
      .select("id, org_id, user_id, title, message, type, read, created_at, entity_type, entity_id")
      .eq("org_id", orgId)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (notificationsRes.error) {
      setNotifications([]);
      setNotificationError("Add a notifications table to use dashboard notifications.");
    } else {
      setNotifications((notificationsRes.data as NotificationRow[]) ?? []);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }

  function clearActivityFeed() {
    setItems([]);
  }

  async function markNotificationAsRead(notificationId: string) {
    setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));

    const res = await supabase.from("notifications").update({ read: true }).eq("id", notificationId);

    if (res.error) {
      setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: false } : item)));
    }
  }

  async function markAllNotificationsAsRead() {
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (!unreadIds.length) return;

    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));

    const res = await supabase.from("notifications").update({ read: true }).in("id", unreadIds);

    if (res.error) {
      await loadDashboard();
    }
  }

  function openNotification(item: NotificationRow) {
    if (item.entity_type === "work_order" && item.entity_id) {
      router.push(`/workorders/${encodeURIComponent(item.entity_id)}`);
      return;
    }

    if (item.entity_type === "invoice") {
      router.push("/invoices");
      return;
    }

    if (item.entity_type === "client") {
      router.push("/clients");
      return;
    }

    if (item.entity_type === "org_invite" || item.entity_type === "org_member") {
      router.push("/team");
      return;
    }
  }

  function openActivity(item: ActivityRow) {
    if (item.entity_type === "work_order") {
      router.push(`/workorders/${encodeURIComponent(item.entity_id)}`);
      return;
    }

    if (item.entity_type === "invoice") {
      router.push("/invoices");
      return;
    }

    if (item.entity_type === "client") {
      router.push("/clients");
      return;
    }

    if (item.entity_type === "org_invite" || item.entity_type === "org_member") {
      router.push("/team");
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.pagePad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <View style={styles.pageInner}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.pageTitle}>Overview</Text>
            </View>

            <View style={styles.headerActions}>
              <QuickAction label="Refresh" onPress={handleRefresh} />
              <QuickAction label="New Work Order" primary onPress={() => router.push("/workorders/new?new=1")} />
              <QuickAction label="View Work Orders" onPress={() => router.push("/workorders")} />
            </View>
          </View>

          <View style={styles.revenueHero}>
            <View style={styles.revenueCopy}>
              <Text style={styles.revenueEyebrow}>Revenue</Text>
              <Text style={styles.revenueValue}>{money(revenue)}</Text>
            </View>

            <View style={styles.revenueStatsCol}>
              <View style={styles.revenueMiniCard}>
                <Text style={styles.revenueMiniLabel}>Collected</Text>
                <Text style={styles.revenueMiniValue}>{money(collectedRevenue)}</Text>
              </View>
              <View style={styles.revenueMiniCard}>
                <Text style={styles.revenueMiniLabel}>Outstanding</Text>
                <Text style={styles.revenueMiniValue}>{money(Math.max(revenue - collectedRevenue, 0))}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <StatCard
                key={stat.key}
                label={stat.label}
                value={stat.value}
                numericValue={stat.numericValue}
                total={statTotal}
                actionLabel={stat.actionLabel}
                onPress={stat.onPress}
                color={stat.color}
                trackColor={stat.trackColor}
              />
            ))}
          </View>

          <View style={styles.insightRow}>
            {attentionCards.map((card) => (
              <InsightCard key={card.title} title={card.title} value={card.value} subtitle={card.subtitle} tone={card.tone} />
            ))}
          </View>

          <View style={styles.middleGrid}>
            <View style={styles.pipelineCard}>
              <Text style={styles.sectionTitle}>Work order pipeline</Text>

              <View style={styles.pipelineList}>
                {pipelineRows.map((row) => (
                  <PipelineBar key={row.key} label={row.label} value={row.value} maxValue={pipelineMax} />
                ))}
              </View>
            </View>

            <View style={styles.quickPanel}>
              <Text style={styles.sectionTitle}>Quick actions</Text>

              <View style={styles.actionGrid}>
                <ActionCard title="New Work Order" subtitle="Create and assign a new job" primary onPress={() => router.push("/workorders/new?new=1")} />
                <ActionCard title="Create Invoice" subtitle="Open invoices and collections" onPress={() => router.push("/invoices")} />
                <ActionCard title="Add Client" subtitle="Manage customer records" onPress={() => router.push("/clients")} />
                <ActionCard title="Open Workforce" subtitle="HR and employee operations" onPress={() => router.push("/workforce")} />
              </View>
            </View>
          </View>

          <View style={styles.lowerGrid}>
            <View style={styles.activityCard}>
              <View style={styles.activityTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Recent activity</Text>
                </View>

                <View style={styles.activityHeaderActions}>
                  <View style={styles.lastCountPill}>
                    <Text style={styles.lastCountPillText}>
                      {visibleItems.length} of {items.length} items
                    </Text>
                  </View>
                  <QuickAction label="Clear" destructive onPress={clearActivityFeed} />
                </View>
              </View>

              <View style={styles.divider} />

              <FlatList
                data={visibleItems}
                keyExtractor={(x) => x.id}
                scrollEnabled={false}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => openActivity(item)}
                    style={({ pressed }) => [styles.activityRow, index % 2 === 0 ? styles.activityRowStriped : null, pressed ? styles.activityRowPressed : null]}
                  >
                    <View style={styles.activityLeft}>
                      <View style={styles.activityIconWrap}>
                        <View style={[styles.dot, getActivityDotStyle(item)]} />
                      </View>

                      <View style={styles.activityTextWrap}>
                        <View style={styles.activityTitleRow}>
                          <Text style={styles.activityTitle} numberOfLines={2}>
                            {buildActivityTitle(item)}
                          </Text>
                          <Text style={styles.badge}>{getActivityBadge(item)}</Text>
                        </View>

                        <Text style={styles.activityWhere} numberOfLines={1}>
                          {buildActivityWhere(item)}
                        </Text>

                        <Text style={styles.activityMeta} numberOfLines={2}>
                          {buildActivityMeta(item)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No activity yet</Text>
                    <Text style={styles.empty}>Once work orders, invoices, clients, or team updates happen, they will show here.</Text>
                  </View>
                }
                contentContainerStyle={visibleItems.length === 0 ? { paddingVertical: 18 } : { paddingVertical: 4 }}
              />
            </View>

            <View style={styles.sideStack}>
              <View style={styles.infoCard}>
                <View style={styles.notificationsTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sideTitle}>Notifications</Text>
                  </View>

                  {unreadNotifications > 0 ? <QuickAction label="Mark all read" onPress={markAllNotificationsAsRead} /> : null}
                </View>

                {notificationError ? <Text style={styles.notificationSetupText}>{notificationError}</Text> : null}

                {visibleNotifications.length === 0 ? (
                  <View style={styles.notificationEmptyWrap}>
                    <Text style={styles.notificationEmptyTitle}>No notifications</Text>
                    <Text style={styles.notificationEmptyText}>New alerts will show here once your notifications table is active.</Text>
                  </View>
                ) : (
                  <View style={styles.notificationList}>
                    {visibleNotifications.map((item, index) => (
                      <Pressable
                        key={item.id}
                        onPress={() => openNotification(item)}
                        style={({ pressed }) => [styles.notificationRow, index !== visibleNotifications.length - 1 ? styles.notificationRowBorder : null, pressed ? styles.activityRowPressed : null]}
                      >
                        <View style={styles.notificationCopy}>
                          <View style={styles.notificationTitleRow}>
                            {!item.read ? <View style={styles.notificationUnreadDot} /> : null}
                            <Text style={styles.notificationTitle} numberOfLines={1}>
                              {item.title?.trim() || item.message?.trim() || "Notification"}
                            </Text>
                          </View>
                          {item.message?.trim() ? (
                            <Text style={styles.notificationMessage} numberOfLines={2}>
                              {item.message}
                            </Text>
                          ) : null}
                          <Text style={styles.notificationMeta}>{formatDateTime(item.created_at)}</Text>
                        </View>

                        {!item.read ? (
                          <Pressable onPress={() => markNotificationAsRead(item.id)} style={styles.markReadBtn}>
                            <Text style={styles.markReadBtnText}>Mark as read</Text>
                          </Pressable>
                        ) : (
                          <View style={styles.readPill}>
                            <Text style={styles.readPillText}>Read</Text>
                          </View>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const CARD_BG   = "#ffffff";
const PAGE_BG   = "#f7f5ef";
const CARD_ALT  = "#fdfaf3";
const DARK_CARD = "#1f1f1f";
const BORDER    = "#e6dcc6";
const BORDER_SOFT = "rgba(201,162,39,0.20)";
const GOLD      = "#c9a227";
const GOLD_BRIGHT = "#c9a227";
const GOLD_SOFT = "#e8d9a8";
const TEXT      = "#1a1a1a";
const MUTED     = "#6b6b6b";
const MUTED_2   = "#6b6b6b";
const MUTED_ON_DARK = "#a3a3a3";
const DANGER    = "#b42318";
const DANGER_BG = "#fee4e2";
const DANGER_BORDER = "#fca5a5";

const styles = StyleSheet.create({
  pagePad: {
    padding: 24,
    backgroundColor: PAGE_BG,
    minHeight: "100%",
  },

  pageInner: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },

  pressed: {
    opacity: 0.92,
  },

  header: {
    marginBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  headerCopy: {
    flex: 1,
    minWidth: 280,
  },

  pageTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: TEXT,
    lineHeight: 44,
  },

  headerActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  revenueHero: {
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: DARK_CARD,
    padding: 24,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    flexWrap: "wrap",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },

  revenueCopy: {
    flex: 1,
    minWidth: 260,
    justifyContent: "center",
  },

  revenueEyebrow: {
    color: GOLD_BRIGHT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  revenueValue: {
    color: "#FFFFFF",
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
  },

  revenueStatsCol: {
    width: 260,
    maxWidth: "100%",
    gap: 12,
  },

  revenueMiniCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(201,162,39,0.25)",
    backgroundColor: "rgba(255,255,255,0.07)",
    padding: 16,
  },

  revenueMiniLabel: {
    color: GOLD_SOFT,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  revenueMiniValue: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 14,
  },

  statCardPressable: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 260,
  },

  statCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    minHeight: 176,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  statTopRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },

  statCopy: {
    flex: 1,
    paddingRight: 8,
  },

  statLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  statValue: {
    color: TEXT,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    marginBottom: 8,
  },

  statFooter: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  statFooterText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
  },

  doughnutWrap: {
    width: 94,
    height: 94,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  doughnutShadowRing: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.04)",
    transform: [{ scale: 0.88 }],
  },

  doughnutSvg: {
    position: "absolute",
  },

  doughnutInner: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },

  insightRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 14,
  },

  insightCard: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 220,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  insightCardWarning: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },

  insightCardGood: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },

  insightLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },

  insightValue: {
    color: TEXT,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
  },

  insightSub: {
    marginTop: 8,
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },

  middleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 14,
  },

  pipelineCard: {
    flex: 1.2,
    minWidth: 320,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  quickPanel: {
    flex: 1,
    minWidth: 320,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  pipelineList: {
    marginTop: 18,
    gap: 14,
  },

  pipelineRow: {
    gap: 8,
  },

  pipelineTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  pipelineLabel: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "500",
  },

  pipelineValue: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
  },

  pipelineTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: BORDER,
    overflow: "hidden",
  },

  pipelineFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: GOLD_BRIGHT,
  },

  actionGrid: {
    marginTop: 18,
    gap: 12,
  },

  actionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_ALT,
    padding: 16,
  },

  actionCardPrimary: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },

  actionCardTitle: {
    color: TEXT,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },

  actionCardTitlePrimary: {
    color: "#1a1a1a",
  },

  actionCardSubtitle: {
    marginTop: 6,
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "400",
  },

  actionCardSubtitlePrimary: {
    color: "rgba(26,26,26,0.70)",
  },

  lowerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  activityCard: {
    flex: 1.2,
    minWidth: 360,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  activityTop: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  activityHeaderActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  lastCountPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_ALT,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  lastCountPillText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "500",
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: 16,
    marginBottom: 10,
  },

  sep: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 2,
  },

  activityRow: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },

  activityRowStriped: {
    backgroundColor: CARD_ALT,
  },

  activityRowPressed: {
    opacity: 0.9,
  },

  activityLeft: {
    flexDirection: "row",
    gap: 12,
  },

  activityIconWrap: {
    width: 22,
    alignItems: "center",
    paddingTop: 6,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  dotWorkOrder: {
    backgroundColor: GOLD_BRIGHT,
  },

  dotInvoice: {
    backgroundColor: "#3b82f6",
  },

  dotClient: {
    backgroundColor: "#10b981",
  },

  dotInvite: {
    backgroundColor: "#8b5cf6",
  },

  dotTeam: {
    backgroundColor: "#f97316",
  },

  activityTextWrap: {
    flex: 1,
    gap: 6,
  },

  activityTitleRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  activityTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },

  badge: {
    color: GOLD,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  activityWhere: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "400",
  },

  activityMeta: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 12,
  },

  emptyTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  empty: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 420,
  },

  sideStack: {
    flex: 0.9,
    minWidth: 320,
    gap: 14,
  },

  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  sideTitle: {
    color: TEXT,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  quickAction: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_ALT,
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionPrimary: {
    backgroundColor: GOLD_BRIGHT,
    borderColor: GOLD_BRIGHT,
  },

  quickActionDestructive: {
    backgroundColor: DANGER_BG,
    borderColor: DANGER_BORDER,
  },

  quickActionText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "900",
  },

  quickActionTextPrimary: {
    color: "#111111",
  },

  quickActionTextDestructive: {
    color: DANGER,
  },

  notificationsTop: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },

  notificationSetupText: {
    color: DANGER,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800",
    marginBottom: 10,
  },

  notificationEmptyWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_ALT,
    padding: 16,
  },

  notificationEmptyTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },

  notificationEmptyText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },

  notificationList: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    backgroundColor: CARD_BG,
  },

  notificationRow: {
    padding: 14,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
  },

  notificationRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  notificationCopy: {
    flex: 1,
  },

  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: GOLD_BRIGHT,
  },

  notificationTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 14,
    fontWeight: "600",
  },

  notificationMessage: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
  },

  notificationMeta: {
    marginTop: 6,
    color: MUTED,
    fontSize: 11,
    fontWeight: "400",
  },

  markReadBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: CARD_ALT,
  },

  markReadBtnText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: "600",
  },

  readPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: CARD_ALT,
    borderWidth: 1,
    borderColor: BORDER,
  },

  readPillText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
  },
});