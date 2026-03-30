import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

type Request = {
  id: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = { pto: "PTO", sick: "Sick Leave", unpaid: "Unpaid" };
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#92400E", text: "#FEF3C7" },
  approved: { bg: "#166534", text: "#DCFCE7" },
  denied: { bg: "#7F1D1D", text: "#FEE2E2" },
};

export default function TimeoffScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [form, setForm] = useState({ type: "pto", start_date: "", end_date: "", notes: "" });

  useEffect(() => { void load(); }, []);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    const oid = await getUserOrgId(uid);
    if (!oid) return;
    setOrgId(oid);

    const { data: emp } = await supabase
      .from("employees").select("id").eq("org_id", oid).eq("user_id", uid).maybeSingle();

    if (emp?.id) {
      setEmployeeId(emp.id);
      const { data } = await supabase
        .from("time_off_requests")
        .select("id, type, start_date, end_date, status, notes, created_at")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false });
      setRequests((data as Request[]) ?? []);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); void load(); }, [load]);

  async function submit() {
    if (!employeeId || !orgId) return;
    if (!form.start_date || !form.end_date) {
      Alert.alert("Missing dates", "Please enter both start and end dates (YYYY-MM-DD).");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("time_off_requests").insert({
      org_id: orgId,
      employee_id: employeeId,
      type: form.type,
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowModal(false);
    setForm({ type: "pto", start_date: "", end_date: "", notes: "" });
    void load();
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}><ActivityIndicator size="large" color={GOLD} /></View>
    );
  }

  return (
    <>
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

        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Time Off</Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.88 }]}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="add" size={18} color="#111" />
            <Text style={styles.addBtnText}>Request</Text>
          </Pressable>
        </View>

        {requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={32} color={MUTED} />
            <Text style={styles.emptyText}>No time-off requests yet</Text>
          </View>
        ) : (
          requests.map((r) => {
            const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
            return (
              <View key={r.id} style={styles.reqCard}>
                <View style={styles.reqHeader}>
                  <Text style={styles.reqType}>{TYPE_LABELS[r.type] ?? r.type}</Text>
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusChipText, { color: sc.text }]}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reqDates}>{r.start_date} → {r.end_date}</Text>
                {r.notes ? <Text style={styles.reqNotes}>{r.notes}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Request Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Time Off</Text>
              <Pressable onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MUTED} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {(["pto", "sick", "unpaid"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeChip, form.type === t && styles.typeChipActive]}
                  onPress={() => setForm({ ...form, type: t })}
                >
                  <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={form.start_date}
              onChangeText={(v) => setForm({ ...form, start_date: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={MUTED}
            />

            <Text style={styles.fieldLabel}>End Date</Text>
            <TextInput
              style={styles.input}
              value={form.end_date}
              onChangeText={(v) => setForm({ ...form, end_date: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={MUTED}
            />

            <Text style={styles.fieldLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 72 }]}
              value={form.notes}
              onChangeText={(v) => setForm({ ...form, notes: v })}
              placeholder="Reason or details"
              placeholderTextColor={MUTED}
              multiline
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.88 }, saving && { opacity: 0.5 }]}
              onPress={submit}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#111" /> : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: PAGE_BG, alignItems: "center", justifyContent: "center" },
  page: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: 20, paddingBottom: 48, gap: 14 },

  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: "700", color: TEXT },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 26, fontWeight: "900", color: TEXT },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: GOLD, borderRadius: 12, borderWidth: 1, borderColor: GOLD_DARK, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontWeight: "900", color: "#1a1a1a" },

  emptyCard: { backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 32, alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  emptyText: { fontSize: 14, fontWeight: "700", color: MUTED },

  reqCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  reqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reqType: { fontSize: 14, fontWeight: "900", color: TEXT },
  reqDates: { fontSize: 13, fontWeight: "700", color: MUTED },
  reqNotes: { fontSize: 13, fontWeight: "600", color: MUTED, fontStyle: "italic" },
  statusChip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontWeight: "900" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 10 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: TEXT },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: CARD_ALT, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },

  fieldLabel: { fontSize: 12, fontWeight: "900", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: BORDER_LIGHT, alignItems: "center" },
  typeChipActive: { backgroundColor: GOLD_SOFT, borderColor: GOLD },
  typeChipText: { fontSize: 12, fontWeight: "900", color: MUTED },
  typeChipTextActive: { color: "#1a1a1a" },

  input: { backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER_LIGHT, padding: 12, fontSize: 14, fontWeight: "600", color: TEXT },
  submitBtn: { backgroundColor: GOLD, borderRadius: 14, borderWidth: 1, borderColor: GOLD_DARK, minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: GOLD, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  submitBtnText: { fontSize: 15, fontWeight: "900", color: "#1a1a1a" },
});
