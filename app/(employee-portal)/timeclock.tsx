import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type TimeEntry = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  hours: number | null;
  notes: string | null;
  work_order?: { title: string } | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function calcHours(entry: TimeEntry) {
  if (entry.hours) return entry.hours.toFixed(1) + "h";
  if (!entry.clock_out) {
    const diff = (Date.now() - new Date(entry.clock_in).getTime()) / 3600000;
    return diff.toFixed(1) + "h (active)";
  }
  const diff =
    (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000;
  return diff.toFixed(1) + "h";
}

export default function TimeclockScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clockNote, setClockNote] = useState("");
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    void load();
  }, []);

  // Live elapsed timer
  useEffect(() => {
    if (!openEntry) { setElapsed(""); return; }
    const tick = () => {
      const diff = (Date.now() - new Date(openEntry.clock_in).getTime()) / 1000;
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = Math.floor(diff % 60);
      setElapsed(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openEntry]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return;

    const oid = await getUserOrgId(uid);
    if (!oid) return;
    setOrgId(oid);

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("org_id", oid)
      .eq("user_id", uid)
      .maybeSingle();

    if (!emp?.id) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setEmployeeId(emp.id);

    // Open entry
    const { data: open } = await supabase
      .from("time_entries")
      .select("id, clock_in, clock_out, hours, notes, work_order:work_order_id(title)")
      .eq("employee_id", emp.id)
      .is("clock_out", null)
      .maybeSingle();
    setOpenEntry((open as TimeEntry) ?? null);

    // Recent entries
    const { data: recent } = await supabase
      .from("time_entries")
      .select("id, clock_in, clock_out, hours, notes, work_order:work_order_id(title)")
      .eq("employee_id", emp.id)
      .not("clock_out", "is", null)
      .order("clock_in", { ascending: false })
      .limit(20);
    setEntries((recent as TimeEntry[]) ?? []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  async function clockIn() {
    if (!employeeId || !orgId) return;
    setSaving(true);
    const { error } = await supabase.from("time_entries").insert({
      org_id: orgId,
      employee_id: employeeId,
      clock_in: new Date().toISOString(),
      notes: clockNote.trim() || null,
    });
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setClockNote("");
    void load();
  }

  async function clockOut() {
    if (!openEntry) return;
    setSaving(true);
    const clockOutTime = new Date().toISOString();
    const hours =
      (new Date(clockOutTime).getTime() - new Date(openEntry.clock_in).getTime()) / 3600000;
    const { error } = await supabase
      .from("time_entries")
      .update({ clock_out: clockOutTime, hours: Math.round(hours * 100) / 100 })
      .eq("id", openEntry.id);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    void load();
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="arrow-back" size={20} color={TEXT} />
        <Text style={styles.backText}>Dashboard</Text>
      </Pressable>

      <Text style={styles.pageTitle}>Time Clock</Text>

      {/* Clock Status Card */}
      <View style={styles.clockCard}>
        {openEntry ? (
          <>
            <View style={styles.clockedInBadge}>
              <View style={styles.clockedInDot} />
              <Text style={styles.clockedInLabel}>Clocked In</Text>
            </View>
            <Text style={styles.elapsed}>{elapsed}</Text>
            <Text style={styles.clockedSince}>
              Since {formatTime(openEntry.clock_in)} · {formatDate(openEntry.clock_in)}
            </Text>
            {openEntry.notes ? (
              <Text style={styles.clockNote}>{openEntry.notes}</Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.clockBtn, styles.clockBtnOut, pressed && { opacity: 0.88 }, saving && { opacity: 0.5 }]}
              onPress={clockOut}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="stop-circle-outline" size={20} color="#fff" />
                  <Text style={[styles.clockBtnText, { color: "#fff" }]}>Clock Out</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.clockedOutBadge}>
              <Text style={styles.clockedOutLabel}>Not Clocked In</Text>
            </View>
            <Text style={styles.clockPrompt}>Add a note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              value={clockNote}
              onChangeText={setClockNote}
              placeholder="e.g. Job 1234 — installation"
              placeholderTextColor={MUTED_ON_DARK}
              multiline
            />
            <Pressable
              style={({ pressed }) => [styles.clockBtn, styles.clockBtnIn, pressed && { opacity: 0.88 }, saving && { opacity: 0.5 }]}
              onPress={clockIn}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#111" /> : (
                <>
                  <Ionicons name="play-circle-outline" size={20} color="#111" />
                  <Text style={styles.clockBtnText}>Clock In</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* Recent Entries */}
      {entries.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Time Entries</Text>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <View style={styles.entryLeft}>
                <Text style={styles.entryDate}>{formatDate(entry.clock_in)}</Text>
                <Text style={styles.entryTime}>
                  {formatTime(entry.clock_in)}
                  {entry.clock_out ? ` → ${formatTime(entry.clock_out)}` : ""}
                </Text>
                {entry.work_order?.title ? (
                  <Text style={styles.entryJob}>{entry.work_order.title}</Text>
                ) : null}
              </View>
              <Text style={styles.entryHours}>{calcHours(entry)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: PAGE_BG, alignItems: "center", justifyContent: "center" },
  page: { flex: 1, backgroundColor: PAGE_BG },
  content: { padding: 20, paddingBottom: 48, gap: 16 },

  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: "700", color: TEXT },
  pageTitle: { fontSize: 26, fontWeight: "900", color: TEXT },

  clockCard: {
    backgroundColor: CARD, borderRadius: 22, borderWidth: 1, borderColor: BORDER,
    padding: 24, gap: 12, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },

  clockedInBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: SUCCESS_BG, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6 },
  clockedInDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: SUCCESS },
  clockedInLabel: { fontSize: 12, fontWeight: "900", color: SUCCESS, textTransform: "uppercase", letterSpacing: 0.8 },

  elapsed: { fontSize: 48, fontWeight: "900", color: GOLD, letterSpacing: 1 },
  clockedSince: { fontSize: 13, fontWeight: "700", color: MUTED },
  clockNote: { fontSize: 13, fontWeight: "700", color: MUTED, fontStyle: "italic" },

  clockedOutBadge: { backgroundColor: CARD_ALT, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: BORDER },
  clockedOutLabel: { fontSize: 12, fontWeight: "900", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 },
  clockPrompt: { fontSize: 13, fontWeight: "700", color: MUTED, alignSelf: "flex-start" },

  noteInput: {
    width: "100%", minHeight: 60, backgroundColor: CARD, borderRadius: 12, borderWidth: 1,
    borderColor: BORDER, padding: 12, color: TEXT, fontSize: 14, fontWeight: "600",
  },

  clockBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, minHeight: 52, width: "100%", borderRadius: 16, borderWidth: 1,
  },
  clockBtnIn: { backgroundColor: GOLD, borderColor: GOLD_DARK, shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  clockBtnOut: { backgroundColor: "#DC2626", borderColor: "#B91C1C" },
  clockBtnText: { fontSize: 15, fontWeight: "900", color: "#1a1a1a" },

  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: TEXT, textTransform: "uppercase", letterSpacing: 0.8 },

  entryRow: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  entryLeft: { flex: 1, gap: 2 },
  entryDate: { fontSize: 12, fontWeight: "900", color: GOLD },
  entryTime: { fontSize: 13, fontWeight: "700", color: TEXT },
  entryJob: { fontSize: 12, fontWeight: "600", color: MUTED },
  entryHours: { fontSize: 15, fontWeight: "900", color: GOLD },
});
