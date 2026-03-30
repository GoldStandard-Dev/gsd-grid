import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

const PAGE_BG = "#FFFFFF";
const CARD = "#111111";
const CARD_SOFT = "#1C1C1C";
const BORDER = "rgba(212,175,55,0.22)";
const GOLD = "#D4AF37";
const TEXT_ON_DARK = "#FFFFFF";
const MUTED_ON_DARK = "#A3A3A3";
const TEXT = "#111111";
const MUTED = "#6B6B6B";

type Invoice = {
  id: string;
  number: string | null;
  status: string;
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  notes: string | null;
  due_date: string | null;
  created_at: string;
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  amount_cents: number;
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#374151", text: "#F3F4F6" },
  sent: { bg: "#1D4ED8", text: "#DBEAFE" },
  paid: { bg: "#166534", text: "#DCFCE7" },
  void: { bg: "#374151", text: "#F3F4F6" },
};

function formatMoney(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ClientInvoices() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const detailId = params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([]);

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
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, number, status, subtotal_cents, tax_cents, total_cents, notes, due_date, created_at")
        .eq("id", detailId)
        .eq("client_id", portal.client_id)
        .maybeSingle();
      setDetail(inv as Invoice ?? null);

      if (inv) {
        const { data: items } = await supabase
          .from("invoice_items")
          .select("id, description, quantity, unit_price_cents, amount_cents")
          .eq("invoice_id", inv.id)
          .order("sort_order");
        setLineItems((items as InvoiceItem[]) ?? []);
      }
    } else {
      // Show sent, paid — hide draft and void
      const { data } = await supabase
        .from("invoices")
        .select("id, number, status, subtotal_cents, tax_cents, total_cents, notes, due_date, created_at")
        .eq("client_id", portal.client_id)
        .in("status", ["sent", "paid"])
        .order("created_at", { ascending: false });
      setInvoices((data as Invoice[]) ?? []);
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
    const sc = STATUS_COLORS[detail.status] ?? STATUS_COLORS.sent;
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
          <Ionicons name="arrow-back" size={20} color={TEXT} />
          <Text style={styles.backText}>Invoices</Text>
        </Pressable>

        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{detail.number ? `Invoice #${detail.number}` : "Invoice"}</Text>
            <View style={[styles.chip, { backgroundColor: sc.bg }]}>
              <Text style={[styles.chipText, { color: sc.text }]}>
                {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
              </Text>
            </View>
          </View>
          {detail.due_date ? <Text style={styles.dueDate}>Due: {detail.due_date}</Text> : null}
        </View>

        {lineItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            {lineItems.map((item) => (
              <View key={item.id} style={styles.lineItemRow}>
                <View style={styles.lineItemLeft}>
                  <Text style={styles.lineDesc}>{item.description}</Text>
                  <Text style={styles.lineQty}>Qty: {item.quantity}</Text>
                </View>
                <Text style={styles.lineAmount}>{formatMoney(item.amount_cents)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatMoney(detail.subtotal_cents)}</Text>
          </View>
          {detail.tax_cents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>{formatMoney(detail.tax_cents)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>Total</Text>
            <Text style={styles.totalValueFinal}>{formatMoney(detail.total_cents)}</Text>
          </View>
        </View>

        {detail.status === "sent" && (
          <View style={styles.payNote}>
            <Ionicons name="information-circle-outline" size={16} color={MUTED} />
            <Text style={styles.payNoteText}>
              To pay this invoice, please contact your service provider.
            </Text>
          </View>
        )}
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
      <Text style={styles.pageTitle}>Invoices</Text>

      {invoices.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={32} color={MUTED} />
          <Text style={styles.emptyText}>No invoices yet</Text>
        </View>
      ) : (
        invoices.map((inv) => {
          const sc = STATUS_COLORS[inv.status] ?? STATUS_COLORS.sent;
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
  rowTitle: { fontSize: 14, fontWeight: "900", color: TEXT_ON_DARK },
  invLeft: { flex: 1, gap: 2 },
  invAmount: { fontSize: 13, fontWeight: "700", color: GOLD },
  chip: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: "900" },

  detailCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 20, gap: 8 },
  detailHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  detailTitle: { flex: 1, fontSize: 20, fontWeight: "900", color: TEXT_ON_DARK },
  dueDate: { fontSize: 13, fontWeight: "700", color: MUTED_ON_DARK },

  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "900", color: TEXT, textTransform: "uppercase", letterSpacing: 0.8 },

  lineItemRow: { backgroundColor: CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  lineItemLeft: { flex: 1, gap: 2 },
  lineDesc: { fontSize: 13, fontWeight: "700", color: TEXT_ON_DARK },
  lineQty: { fontSize: 12, fontWeight: "600", color: MUTED_ON_DARK },
  lineAmount: { fontSize: 14, fontWeight: "900", color: GOLD },

  totalsCard: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 10 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, marginTop: 2 },
  totalLabel: { fontSize: 13, fontWeight: "700", color: MUTED_ON_DARK },
  totalValue: { fontSize: 13, fontWeight: "700", color: TEXT_ON_DARK },
  totalLabelFinal: { fontSize: 15, fontWeight: "900", color: TEXT_ON_DARK },
  totalValueFinal: { fontSize: 18, fontWeight: "900", color: GOLD },

  payNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFDF8", borderRadius: 12, borderWidth: 1, borderColor: "#EDE8DA", padding: 14 },
  payNoteText: { flex: 1, fontSize: 13, fontWeight: "600", color: MUTED, lineHeight: 20 },
});
