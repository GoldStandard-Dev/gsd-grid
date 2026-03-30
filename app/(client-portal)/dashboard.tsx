import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

const PAGE_BG   = "#f7f5ef";
const CARD      = "#ffffff";
const CARD_ALT  = "#fdfaf3";
const DARK_CARD = "#1f1f1f";
const BORDER    = "#e6dcc6";
const GOLD      = "#c9a227";
const GOLD_SOFT = "#e8d9a8";
const GOLD_DARK = "#a8841a";
const TEXT      = "#1a1a1a";
const MUTED     = "#6b6b6b";
const MUTED_ON_DARK = "#a3a3a3";
const DANGER    = "#b42318";
const DANGER_BG = "#fee4e2";
const SUCCESS   = "#166534";
const SUCCESS_BG = "#dcfce7";

type PortalAccess = {
  id: string;
  client_id: string;
  org_id: string;
};

type WorkOrder = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

type Invoice = {
  id: string;
  number: string | null;
  status: string;
  total_cents: number;
  created_at: string;
};

const WO_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "#1D4ED8", text: "#DBEAFE" },
  scheduled: { bg: "#6D28D9", text: "#EDE9FE" },
  in_progress: { bg: "#D97706", text: "#FEF3C7" },
  blocked: { bg: "#DC2626", text: "#FEE2E2" },
  completed: { bg: "#166534", text: "#DCFCE7" },
  canceled: { bg: "#374151", text: "#F3F4F6" },
};
const WO_LABELS: Record<string, string> = { new: "New", scheduled: "Scheduled", in_progress: "In Progress", blocked: "Blocked", completed: "Completed", canceled: "Canceled" };

const INV_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#374151", text: "#F3F4F6" },
  sent: { bg: "#1D4ED8", text: "#DBEAFE" },
  paid: { bg: "#166534", text: "#DCFCE7" },
  void: { bg: "#374151", text: "#F3F4F6" },
};

function formatMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClientPortalDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portal, setPortal] = useState<PortalAccess | null>(null);
  const [clientName, setClientName] = useState("Client");
  const [openJobs, setOpenJobs] = useState<WorkOrder[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);

  useEffect(() => { void load(); }, []);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: portalRow } = await supabase
      .from("client_portal_access")
      .select("id, client_id, org_id")
      .eq("email", user.email ?? "")
      .eq("status", "active")
      .maybeSingle();

    if (!portalRow) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setPortal(portalRow as PortalAccess);

    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", portalRow.client_id)
      .maybeSingle();
    setClientName(client?.name ?? "Client");

    // Open work orders
    const { data: wos } = await supabase
      .from("work_orders")
      .select("id, title, status, created_at")
      .eq("client_id", portalRow.client_id)
      .not("status", "in", '("completed","canceled")')
      .order("created_at", { ascending: false })
      .limit(5);
    setOpenJobs((wos as WorkOrder[]) ?? []);

    // Unpaid invoices
    const { data: invs } = await supabase
      .from("invoices")
      .select("id, number, status, total_cents, created_at")
      .eq("client_id", portalRow.client_id)
      .in("status", ["sent"])
      .order("created_at", { ascending: false })
      .limit(5);
    setUnpaidInvoices((invs as Invoice[]) ?? []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + i.total_cents, 0);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Client Portal</Text>
          <Text style={styles.heroTitle}>Welcome,{"\n"}{clientName}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
          onPress={async () => { await supabase.auth.signOut(); router.replace("/(auth)/sign-in"); }}
        >
          <Ionicons name="log-out-outline" size={20} color={MUTED} />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Open Jobs</Text>
          <Text style={styles.statValue}>{openJobs.length}</Text>
        </View>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Balance Due</Text>
          <Text style={styles.statValue}>{formatMoney(unpaidTotal)}</Text>
        </View>
      </View>

      {/* Open Jobs */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Open Jobs</Text>
          <Pressable onPress={() => router.push("/(client-portal)/workorders")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {openJobs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={28} color={MUTED} />
            <Text style={styles.emptyText}>No open jobs</Text>
          </View>
        ) : (
          openJobs.map((wo) => {
            const sc = WO_STATUS_COLORS[wo.status] ?? WO_STATUS_COLORS.new;
            return (
              <Pressable
                key={wo.id}
                style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push(`/(client-portal)/workorders?id=${wo.id}`)}
              >
                <Text style={styles.rowTitle}>{wo.title}</Text>
                <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.chipText, { color: sc.text }]}>{WO_LABELS[wo.status] ?? wo.status}</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Unpaid Invoices */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Invoices Due</Text>
          <Pressable onPress={() => router.push("/(client-portal)/invoices")}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {unpaidInvoices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={28} color={MUTED} />
            <Text style={styles.emptyText}>No outstanding invoices</Text>
          </View>
        ) : (
          unpaidInvoices.map((inv) => {
            const sc = INV_STATUS_COLORS[inv.status] ?? INV_STATUS_COLORS.sent;
            return (
              <Pressable
                key={inv.id}
                style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.88 }]}
                onPress={() => router.push(`/(client-portal)/invoices?id=${inv.id}`)}
              >
                <View style={styles.invLeft}>
                  <Text style={styles.rowTitle}>{inv.number ? `Invoice #${inv.number}` : "Invoice"}</Text>
                  <Text style={styles.invAmount}>{formatMoney(inv.total_cents)}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.chipText, { color: sc.text }]}>
                    {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: PAGE_BG, alignItems: "center", justifyContent: "center" },
  page: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: 20, paddingBottom: 48, gap: 16 },

  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  eyebrow: { fontSize: 11, fontWeight: "900", color: GOLD, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  heroTitle: { fontSize: 28, fontWeight: "900", color: TEXT, lineHeight: 34 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { backgroundColor: DARK_CARD, borderRadius: 18, borderWidth: 1, borderColor: "rgba(201,162,39,0.20)", padding: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  statLabel: { fontSize: 11, fontWeight: "700", color: MUTED_ON_DARK, textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 22, fontWeight: "900", color: "#ffffff", marginTop: 4 },

  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: TEXT, textTransform: "uppercase", letterSpacing: 0.8 },
  seeAll: { fontSize: 12, fontWeight: "700", color: GOLD },

  emptyCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 24, alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  emptyText: { fontSize: 13, fontWeight: "700", color: MUTED },

  rowCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "900", color: TEXT },
  invLeft: { flex: 1, gap: 2 },
  invAmount: { fontSize: 13, fontWeight: "700", color: GOLD },
  chip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: "900" },
});
