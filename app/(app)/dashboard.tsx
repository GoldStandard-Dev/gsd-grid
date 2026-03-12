import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";
import { formatDateTime, formatInvoiceNumber, formatWorkOrderNumber } from "../../src/lib/format";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

type ActivityDetails = {
  title?: string;
  client_name?: string | null;
  clientName?: string | null;
  name?: string | null;
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

type DashboardCounts = {
  openWorkOrders: number;
  unpaidInvoices: number;
  clients: number;
};

function StatCard({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  onPress?: () => void;
}) {
  const inner = (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed ? { opacity: 0.96 } : null]}>
      {inner}
    </Pressable>
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
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <Text style={[styles.quickActionText, primary ? styles.quickActionTextPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

function formatActionLabel(action: string) {
  const normalized = (action ?? "").trim().toLowerCase();

  if (
    normalized.includes("update") ||
    normalized.includes("edit") ||
    normalized.includes("modified")
  ) {
    return "Updated";
  }

  if (
    normalized.includes("create") ||
    normalized.includes("added") ||
    normalized.includes("insert")
  ) {
    return "Created";
  }

  if (normalized.includes("delete") || normalized.includes("removed")) {
    return "Deleted";
  }

  if (normalized.includes("convert")) {
    return "Converted";
  }

  if (normalized.includes("close")) {
    return "Closed";
  }

  if (normalized.includes("open")) {
    return "Opened";
  }

  if (!normalized) return "Updated";

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatEntityLabel(entityType: string) {
  const normalized = (entityType ?? "").replaceAll("_", " ").trim();
  if (!normalized) return "Record";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getActivitySubject(item: ActivityRow) {
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
    const client =
      item.details?.client_name?.trim() ||
      item.details?.clientName?.trim();

    if (invoiceLabel !== "—" && client) return `Invoice ${invoiceLabel} • ${client}`;
    if (invoiceLabel !== "—") return `Invoice ${invoiceLabel}`;
    if (client) return `Invoice • ${client}`;
    return "Invoice";
  }

  if (item.entity_type === "client") {
    const client =
      item.details?.client_name?.trim() ||
      item.details?.clientName?.trim() ||
      item.details?.name?.trim();

    if (client) return `Client • ${client}`;
    return "Client";
  }

  return formatEntityLabel(item.entity_type);
}

function buildActivityTitle(item: ActivityRow) {
  return `${formatActionLabel(item.action)} • ${getActivitySubject(item)}`;
}

function buildActivityMeta(item: ActivityRow) {
  const actor = item.actor_name?.trim() || "Unknown user";
  const time = formatDateTime(item.created_at);

  let changes = "";

  if (item.details?.changed_fields?.length) {
    changes = `Edited: ${item.details.changed_fields.join(", ")}`;
  } else {
    const action = (item.action ?? "").toLowerCase();
    if (action.includes("create")) changes = "New record";
    if (action.includes("delete")) changes = "Record removed";
  }

  return [actor, time, changes].filter(Boolean).join(" • ");
}

function getActivityBadge(item: ActivityRow) {
  if (item.entity_type === "work_order") return "work order";
  if (item.entity_type === "invoice") return "invoice";
  if (item.entity_type === "client") return "client";
  return item.entity_type.replaceAll("_", " ");
}

function getActivityDotStyle(item: ActivityRow) {
  if (item.entity_type === "invoice") return styles.dotInvoice;
  if (item.entity_type === "client") return styles.dotClient;
  return styles.dotWorkOrder;
}

export default function Dashboard() {
  const router = useRouter();

  const [items, setItems] = useState<ActivityRow[]>([]);
  const [orgName, setOrgName] = useState<string>("");
  const [counts, setCounts] = useState<DashboardCounts>({
    openWorkOrders: 0,
    unpaidInvoices: 0,
    clients: 0,
  });

  const stats = useMemo(() => {
    return [
      { label: "Open Work Orders", value: String(counts.openWorkOrders), hint: "Jobs needing attention" },
      { label: "Invoices (Unpaid)", value: String(counts.unpaidInvoices), hint: "Pending collections" },
      { label: "Clients", value: String(counts.clients), hint: "Saved customer records" },
    ];
  }, [counts]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const orgId = await getUserOrgId(userId);
      if (!orgId) return;

      const orgRes = await supabase.from("organizations").select("name").eq("id", orgId).single();
      setOrgName(orgRes.data?.name ?? "");

      const activityRes = await supabase
        .from("activity_log")
        .select("id, created_at, actor_name, action, entity_type, entity_id, details")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(25);

      setItems((activityRes.data as ActivityRow[]) ?? []);

      const workOrdersRes = await supabase
        .from("work_orders")
        .select("id, status")
        .eq("org_id", orgId)
        .neq("status", "Closed");

      const invoicesRes = await supabase
        .from("invoices")
        .select("id, status")
        .eq("org_id", orgId)
        .neq("status", "paid")
        .neq("status", "Paid");

      const clientsRes = await supabase.from("clients").select("id").eq("org_id", orgId);

      setCounts({
        openWorkOrders: workOrdersRes.data?.length ?? 0,
        unpaidInvoices: invoicesRes.data?.length ?? 0,
        clients: clientsRes.data?.length ?? 0,
      });
    })();
  }, []);

  function openActivity(item: ActivityRow) {
    if (item.entity_type === "work_order") {
      router.push(`/workorders/${encodeURIComponent(item.entity_id)}`);
      return;
    }

    if (item.entity_type === "invoice") {
      router.push(`/invoices/${encodeURIComponent(item.entity_id)}`);
      return;
    }

    if (item.entity_type === "client") {
      router.push("/clients");
    }
  }

  return (
    <Screen padded={false}>
      <View style={[ui.container, styles.pagePad]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={ui.h1}>Dashboard</Text>
            <Text style={ui.sub}>Organization: {orgName || "—"}</Text>
          </View>

          <View style={styles.headerActions}>
            <QuickAction label="New Work Order" primary onPress={() => router.push("/workorders/new?new=1")} />
            <QuickAction label="View Work Orders" onPress={() => router.push("/workorders")} />
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((s, idx) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              hint={s.hint}
              onPress={
                idx === 0
                  ? () => router.push("/workorders")
                  : idx === 1
                    ? () => router.push("/invoices")
                    : () => router.push("/clients")
              }
            />
          ))}
        </View>

        <View style={styles.lowerGrid}>
          <View style={[ui.card, styles.activityCard]}>
            <View style={styles.activityTop}>
              <Text style={ui.h2}>Recent activity</Text>
              <Text style={styles.activityHint}>Last 25 updates</Text>
            </View>

            <View style={ui.divider} />

            <FlatList
              data={items}
              keyExtractor={(x) => x.id}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => openActivity(item)}
                  style={({ pressed }) => [
                    styles.activityRow,
                    index % 2 === 0 ? styles.activityRowStriped : null,
                    pressed ? styles.activityRowPressed : null,
                  ]}
                >
                  <View style={styles.activityLeft}>
                    <View style={[styles.dot, getActivityDotStyle(item)]} />
                    <View style={styles.activityTextWrap}>
                      <Text style={styles.activityTitle} numberOfLines={2}>
                        {buildActivityTitle(item)}
                      </Text>
                      <Text style={styles.activityMeta} numberOfLines={2}>
                        {buildActivityMeta(item)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.badge}>{getActivityBadge(item)}</Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              ListEmptyComponent={<Text style={styles.empty}>No activity yet.</Text>}
              contentContainerStyle={items.length === 0 ? { paddingVertical: 14 } : { paddingVertical: 4 }}
            />
          </View>

          <View style={styles.sideStack}>
            <View style={[ui.card, styles.infoCard]}>
              <Text style={styles.sideTitle}>Quick actions</Text>
              <Text style={styles.sideSub}>Move faster through daily operations.</Text>

              <View style={styles.sideActionList}>
                <QuickAction label="Create Invoice" onPress={() => router.push("/invoices")} />
                <QuickAction label="Open Team" onPress={() => router.push("/team")} />
                <QuickAction label="Settings" onPress={() => router.push("/settings")} />
              </View>
            </View>

            <View style={[ui.card, styles.infoCard]}>
              <Text style={styles.sideTitle}>Overview</Text>
              <Text style={styles.overviewLine}>Keep work orders updated and convert completed jobs into invoices.</Text>
              <Text style={styles.overviewLine}>Recent activity now shows who changed what and when for saved records.</Text>
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pagePad: { padding: 22 },

  header: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },

  headerActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },

  statCard: {
    flexGrow: 1,
    minWidth: 240,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },

  statLabel: { color: theme.colors.muted, fontWeight: "800", fontSize: 12, letterSpacing: 0.2 },
  statValue: { color: theme.colors.gold, fontWeight: "900", fontSize: 24, marginTop: 8 },
  statHint: { color: theme.colors.muted, fontWeight: "700", fontSize: 12, marginTop: 6 },

  lowerGrid: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  activityCard: {
    padding: 0,
    flexGrow: 1,
    flexBasis: 720,
    minWidth: 320,
    overflow: "hidden",
  },

  activityTop: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  activityHint: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },

  activityRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  activityRowStriped: {
    backgroundColor: "#fcfcfc",
  },

  activityRowPressed: {
    backgroundColor: "#f8f1e0",
  },

  activityLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  dotWorkOrder: {
    backgroundColor: theme.colors.gold,
  },

  dotInvoice: {
    backgroundColor: "#3B82F6",
  },

  dotClient: {
    backgroundColor: "#10B981",
  },

  activityTextWrap: { flex: 1 },
  activityTitle: { color: theme.colors.ink, fontWeight: "900" },
  activityMeta: { marginTop: 4, color: theme.colors.muted, fontWeight: "700", fontSize: 12 },

  badge: {
    backgroundColor: "#faf7ef",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    color: theme.colors.ink2,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "capitalize",
  },

  sep: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
  },

  empty: {
    color: theme.colors.muted,
    fontWeight: "700",
    paddingHorizontal: theme.spacing.lg,
  },

  sideStack: {
    width: 320,
    gap: 14,
    flexGrow: 1,
  },

  infoCard: {
    padding: 16,
  },

  sideTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  sideSub: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
  },

  sideActionList: {
    marginTop: 14,
    gap: 8,
  },

  overviewLine: {
    marginTop: 10,
    color: theme.colors.ink2,
    fontWeight: "700",
    lineHeight: 20,
  },

  quickAction: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  quickActionPrimary: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },

  quickActionText: {
    fontWeight: "900",
    color: theme.colors.ink,
  },

  quickActionTextPrimary: {
    color: "#111",
  },
});