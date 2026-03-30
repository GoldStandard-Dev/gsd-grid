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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";

const PAGE_BG = "#FFFFFF";
const CARD = "#111111";
const CARD_SOFT = "#1C1C1C";
const BORDER = "rgba(212,175,55,0.22)";
const GOLD = "#D4AF37";
const TEXT_ON_DARK = "#FFFFFF";
const MUTED_ON_DARK = "#A3A3A3";
const TEXT = "#111111";
const MUTED = "#6B6B6B";

type WoRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  client?: { name: string } | null;
};

type ClockEntry = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  hours: number | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  canceled: "Canceled",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "#1D4ED8", text: "#DBEAFE" },
  scheduled: { bg: "#6D28D9", text: "#EDE9FE" },
  in_progress: { bg: "#D97706", text: "#FEF3C7" },
  blocked: { bg: "#DC2626", text: "#FEE2E2" },
  completed: { bg: "#166534", text: "#DCFCE7" },
  canceled: { bg: "#374151", text: "#F3F4F6" },
};

export default function EmployeeDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Team Member");
  const [workOrders, setWorkOrders] = useState<WoRow[]>([]);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [isClockedIn, setIsClockedIn] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (!uid) return;
    setUserId(uid);

    const oid = await getUserOrgId(uid);
    if (!oid) return;
    setOrgId(oid);

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", uid)
      .maybeSingle();

    if (profile) {
      const name = profile.first_name
        ? `${profile.first_name}${profile.last_name ? " " + profile.last_name[0] + "." : ""}`
        : profile.full_name || "Team Member";
      setDisplayName(name);
    }

    // Get employee record
    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("org_id", oid)
      .eq("user_id", uid)
      .maybeSingle();
    setEmployeeId(emp?.id ?? null);

    // Assigned work orders (active)
    const { data: wos } = await supabase
      .from("work_orders")
      .select("id, title, status, created_at, client:client_id(name)")
      .eq("org_id", oid)
      .eq("assigned_to_user_id", uid)
      .not("status", "in", '("completed","canceled")')
      .order("created_at", { ascending: false })
      .limit(10);
    setWorkOrders((wos as WoRow[]) ?? []);

    // Hours — today and this week
    if (emp?.id) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const { data: entries } = await supabase
        .from("time_entries")
        .select("id, clock_in, clock_out, hours")
        .eq("employee_id", emp.id)
        .gte("clock_in", weekStart.toISOString());

      const all: ClockEntry[] = (entries ?? []) as ClockEntry[];
      const todayEntries = all.filter(
        (e) => new Date(e.clock_in) >= todayStart
      );

      const sumHours = (arr: ClockEntry[]) =>
        arr.reduce((s, e) => {
          if (e.hours) return s + e.hours;
          if (e.clock_out) {
            return (
              s +
              (new Date(e.clock_out).getTime() -
                new Date(e.clock_in).getTime()) /
                3600000
            );
          }
          return s;
        }, 0);

      setTodayHours(Math.round(sumHours(todayEntries) * 10) / 10);
      setWeekHours(Math.round(sumHours(all) * 10) / 10);

      // Check if currently clocked in
      const { data: openEntry } = await supabase
        .from("time_entries")
        .select("id")
        .eq("employee_id", emp.id)
        .is("clock_out", null)
        .maybeSingle();
      setIsClockedIn(!!openEntry);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Employee Portal</Text>
          <Text style={styles.heroTitle}>Good morning,{"\n"}{displayName}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace("/(auth)/sign-in");
          }}
        >
          <Ionicons name="log-out-outline" size={20} color={MUTED} />
        </Pressable>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>{todayHours}h</Text>
        </View>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>{weekHours}h</Text>
        </View>
        <View style={[styles.statCard, { flex: 1 }]}>
          <Text style={styles.statLabel}>Open Jobs</Text>
          <Text style={styles.statValue}>{workOrders.length}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        <Pressable
          style={({ pressed }) => [
            styles.quickBtn,
            isClockedIn ? styles.quickBtnDanger : styles.quickBtnGold,
            pressed && { opacity: 0.88 },
          ]}
          onPress={() => router.push("/(employee-portal)/timeclock")}
        >
          <Ionicons
            name={isClockedIn ? "stop-circle-outline" : "play-circle-outline"}
            size={20}
            color={isClockedIn ? "#FFFFFF" : "#111111"}
          />
          <Text style={[styles.quickBtnText, isClockedIn && { color: "#FFFFFF" }]}>
            {isClockedIn ? "Clock Out" : "Clock In"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.quickBtn, styles.quickBtnOutline, pressed && { opacity: 0.88 }]}
          onPress={() => router.push("/(employee-portal)/timeoff")}
        >
          <Ionicons name="calendar-outline" size={20} color={GOLD} />
          <Text style={[styles.quickBtnText, { color: GOLD }]}>Time Off</Text>
        </Pressable>
      </View>

      {/* Assigned Work Orders */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Assigned Jobs</Text>
        {workOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={32} color={MUTED} />
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
                <View style={styles.woCardInner}>
                  <View style={styles.woMeta}>
                    <Text style={styles.woTitle}>{wo.title}</Text>
                    {wo.client?.name ? (
                      <Text style={styles.woClient}>{wo.client.name}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusChipText, { color: sc.text }]}>
                      {STATUS_LABELS[wo.status] ?? wo.status}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED_ON_DARK} style={styles.woArrow} />
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

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  eyebrow: { fontSize: 11, fontWeight: "900", color: GOLD, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  heroTitle: { fontSize: 28, fontWeight: "900", color: TEXT, lineHeight: 34 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#EDE8DA", alignItems: "center", justifyContent: "center" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: "center",
  },
  statLabel: { fontSize: 11, fontWeight: "700", color: MUTED_ON_DARK, textTransform: "uppercase", letterSpacing: 0.8 },
  statValue: { fontSize: 26, fontWeight: "900", color: GOLD, marginTop: 4 },

  quickRow: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1, minHeight: 48, borderRadius: 14, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: "transparent",
  },
  quickBtnGold: { backgroundColor: GOLD, borderColor: "#B8962E", shadowColor: GOLD, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  quickBtnDanger: { backgroundColor: "#DC2626", borderColor: "#B91C1C" },
  quickBtnOutline: { backgroundColor: "transparent", borderColor: GOLD },
  quickBtnText: { fontSize: 14, fontWeight: "900", color: TEXT },

  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: TEXT, textTransform: "uppercase", letterSpacing: 0.8 },

  emptyCard: {
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    padding: 32, alignItems: "center", gap: 10,
  },
  emptyText: { fontSize: 14, fontWeight: "700", color: MUTED_ON_DARK },

  woCard: {
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    padding: 16,
  },
  woCardInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  woMeta: { flex: 1 },
  woTitle: { fontSize: 14, fontWeight: "900", color: TEXT_ON_DARK },
  woClient: { fontSize: 12, fontWeight: "700", color: MUTED_ON_DARK, marginTop: 2 },
  woArrow: { marginTop: 4 },
  statusChip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  statusChipText: { fontSize: 11, fontWeight: "900" },
});
