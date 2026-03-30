import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

const PAGE_BG = "#F7F4ED";
const CARD = "#111111";
const CARD_SOFT = "#1C1C1C";
const BORDER = "rgba(212,175,55,0.22)";
const GOLD = "#D4AF37";
const TEXT_ON_DARK = "#FFFFFF";
const MUTED_ON_DARK = "#A3A3A3";
const TEXT = "#111111";
const MUTED = "#6B6B6B";

type WorkOrder = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  scope_notes: string | null;
};

const WO_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "#1D4ED8", text: "#DBEAFE" },
  scheduled: { bg: "#6D28D9", text: "#EDE9FE" },
  in_progress: { bg: "#D97706", text: "#FEF3C7" },
  blocked: { bg: "#DC2626", text: "#FEE2E2" },
  completed: { bg: "#166534", text: "#DCFCE7" },
  canceled: { bg: "#374151", text: "#F3F4F6" },
};
const WO_LABELS: Record<string, string> = {
  new: "New", scheduled: "Scheduled", in_progress: "In Progress",
  blocked: "Blocked", completed: "Completed", canceled: "Canceled",
};

export default function ClientWorkorders() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const detailId = params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [detail, setDetail] = useState<WorkOrder | null>(null);

  useEffect(() => { void load(); }, [detailId]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: portal } = await supabase
      .from("client_portal_access")
      .select("client_id")
      .eq("email", user.email ?? "")
      .eq("status", "active")
      .maybeSingle();

    if (!portal) { setLoading(false); setRefreshing(false); return; }
    setClientId(portal.client_id);

    if (detailId) {
      const { data } = await supabase
        .from("work_orders")
        .select("id, title, description, status, created_at, scope_notes")
        .eq("id", detailId)
        .eq("client_id", portal.client_id)
        .maybeSingle();
      setDetail(data as WorkOrder ?? null);
    } else {
      const { data } = await supabase
        .from("work_orders")
        .select("id, title, description, status, created_at")
        .eq("client_id", portal.client_id)
        .order("created_at", { ascending: false });
      setWorkOrders((data as WorkOrder[]) ?? []);
    }

    setLoading(false);
    setRefreshing(false);
  }, [detailId]);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  // Detail View
  if (detailId && detail) {
    const sc = WO_STATUS_COLORS[detail.status] ?? WO_STATUS_COLORS.new;
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
          <Text style={styles.backText}>My Jobs</Text>
        </Pressable>

        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{detail.title}</Text>
            <View style={[styles.chip, { backgroundColor: sc.bg }]}>
              <Text style={[styles.chipText, { color: sc.text }]}>{WO_LABELS[detail.status] ?? detail.status}</Text>
            </View>
          </View>
          {detail.description ? <Text style={styles.detailDesc}>{detail.description}</Text> : null}
          {detail.scope_notes ? (
            <View style={styles.scopeBox}>
              <Text style={styles.scopeLabel}>Project Notes</Text>
              <Text style={styles.scopeText}>{detail.scope_notes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  // List View
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      showsVerticalScrollIndicator={false}
    >
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
        <Ionicons name="arrow-back" size={20} color={TEXT} />
        <Text style={styles.backText}>Dashboard</Text>
      </Pressable>
      <Text style={styles.pageTitle}>My Jobs</Text>

      {workOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="briefcase-outline" size={32} color={MUTED} />
          <Text style={styles.emptyText}>No jobs on record</Text>
        </View>
      ) : (
        workOrders.map((wo) => {
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: PAGE_BG, alignItems: "center", justifyContent: "center" },
  page: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: "700", color: TEXT },
  pageTitle: { fontSize: 26, fontWeight: "900", color: TEXT },

  emptyCard: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14, fontWeight: "700", color: MUTED_ON_DARK },

  rowCard: { backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "900", color: TEXT_ON_DARK },
  chip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: "900" },

  detailCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 12 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900", color: TEXT_ON_DARK },
  detailDesc: { fontSize: 14, fontWeight: "600", color: MUTED_ON_DARK, lineHeight: 20 },
  scopeBox: { backgroundColor: CARD_SOFT, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12, gap: 4 },
  scopeLabel: { fontSize: 11, fontWeight: "900", color: GOLD, textTransform: "uppercase", letterSpacing: 0.8 },
  scopeText: { fontSize: 13, fontWeight: "600", color: TEXT_ON_DARK, lineHeight: 20 },
});
