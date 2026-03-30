import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";

const PAGE_BG   = "#f7f5ef";
const CARD      = "#ffffff";
const CARD_ALT  = "#fdfaf3";
const DARK_CARD = "#1f1f1f";
const BORDER    = "#e6dcc6";
const BORDER_LIGHT = "#e6dcc6";
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

type WorkOrder = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  scope_notes: string | null;
  client?: { name: string; phone?: string | null; email?: string | null } | null;
  assignee?: { display_name?: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New", scheduled: "Scheduled", in_progress: "In Progress",
  blocked: "Blocked", completed: "Completed", canceled: "Canceled",
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "#1D4ED8", text: "#DBEAFE" },
  scheduled: { bg: "#6D28D9", text: "#EDE9FE" },
  in_progress: { bg: "#D97706", text: "#FEF3C7" },
  blocked: { bg: "#DC2626", text: "#FEE2E2" },
  completed: { bg: "#166534", text: "#DCFCE7" },
  canceled: { bg: "#374151", text: "#F3F4F6" },
};

const EDITABLE_STATUSES = ["in_progress", "blocked", "completed"];

export default function EmployeeWorkorders() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const detailId = params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [detail, setDetail] = useState<WorkOrder | null>(null);

  useEffect(() => { void load(); }, [detailId]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;
    setUserId(uid);

    const oid = await getUserOrgId(uid);
    if (!oid) return;
    setOrgId(oid);

    if (detailId) {
      const { data } = await supabase
        .from("work_orders")
        .select("id, title, description, status, created_at, scope_notes, client:client_id(name, phone, email)")
        .eq("id", detailId)
        .maybeSingle();
      setDetail(data as WorkOrder ?? null);
    } else {
      const { data } = await supabase
        .from("work_orders")
        .select("id, title, description, status, created_at, client:client_id(name)")
        .eq("org_id", oid)
        .eq("assigned_to_user_id", uid)
        .order("created_at", { ascending: false });
      setWorkOrders((data as WorkOrder[]) ?? []);
    }

    setLoading(false);
    setRefreshing(false);
  }, [detailId]);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  async function updateStatus(woId: string, newStatus: string) {
    setSaving(true);
    const { error } = await supabase
      .from("work_orders")
      .update({ status: newStatus })
      .eq("id", woId);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    void load();
  }

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator size="large" color={GOLD} /></View>;
  }

  // Detail View
  if (detailId && detail) {
    const sc = STATUS_COLORS[detail.status] ?? STATUS_COLORS.new;
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
            <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusChipText, { color: sc.text }]}>
                {STATUS_LABELS[detail.status] ?? detail.status}
              </Text>
            </View>
          </View>

          {detail.client?.name ? (
            <View style={styles.clientRow}>
              <Ionicons name="person-outline" size={14} color={GOLD} />
              <Text style={styles.clientName}>{detail.client.name}</Text>
            </View>
          ) : null}

          {detail.description ? (
            <Text style={styles.description}>{detail.description}</Text>
          ) : null}

          {detail.scope_notes ? (
            <View style={styles.scopeBox}>
              <Text style={styles.scopeLabel}>Scope Notes</Text>
              <Text style={styles.scopeText}>{detail.scope_notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Update Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update Status</Text>
          <View style={styles.statusGrid}>
            {EDITABLE_STATUSES.map((s) => {
              const sc2 = STATUS_COLORS[s];
              const isActive = detail.status === s;
              return (
                <Pressable
                  key={s}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    isActive && { backgroundColor: sc2.bg, borderColor: sc2.bg },
                    pressed && { opacity: 0.8 },
                    saving && { opacity: 0.5 },
                  ]}
                  onPress={() => updateStatus(detail.id, s)}
                  disabled={saving || isActive}
                >
                  <Text style={[styles.statusBtnText, isActive && { color: sc2.text }]}>
                    {STATUS_LABELS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
          <Text style={styles.emptyText}>No active jobs assigned</Text>
        </View>
      ) : (
        workOrders.map((wo) => {
          const sc = STATUS_COLORS[wo.status] ?? STATUS_COLORS.new;
          return (
            <Pressable
              key={wo.id}
              style={({ pressed }) => [styles.woCard, pressed && { opacity: 0.88 }]}
              onPress={() => router.push(`/(employee-portal)/workorders?id=${wo.id}`)}
            >
              <View style={styles.woRow}>
                <View style={styles.woLeft}>
                  <Text style={styles.woTitle}>{wo.title}</Text>
                  {wo.client?.name ? <Text style={styles.woClient}>{wo.client.name}</Text> : null}
                </View>
                <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusChipText, { color: sc.text }]}>
                    {STATUS_LABELS[wo.status] ?? wo.status}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED_ON_DARK} />
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

  emptyCard: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 32, alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  emptyText: { fontSize: 14, fontWeight: "700", color: MUTED },

  woCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  woRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  woLeft: { flex: 1, gap: 2 },
  woTitle: { fontSize: 14, fontWeight: "900", color: TEXT },
  woClient: { fontSize: 12, fontWeight: "700", color: MUTED },

  statusChip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontWeight: "900" },

  detailCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900", color: TEXT },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  clientName: { fontSize: 13, fontWeight: "700", color: MUTED },
  description: { fontSize: 14, fontWeight: "600", color: MUTED, lineHeight: 20 },
  scopeBox: { backgroundColor: CARD_ALT, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12, gap: 4 },
  scopeLabel: { fontSize: 11, fontWeight: "900", color: GOLD, textTransform: "uppercase", letterSpacing: 0.8 },
  scopeText: { fontSize: 13, fontWeight: "600", color: TEXT, lineHeight: 20 },

  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: TEXT, textTransform: "uppercase", letterSpacing: 0.8 },

  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBtn: { flex: 1, minWidth: 100, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center", backgroundColor: CARD },
  statusBtnText: { fontSize: 13, fontWeight: "900", color: TEXT },
});
