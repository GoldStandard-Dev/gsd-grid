import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import { getUserOrgId } from "../../src/lib/auth";
import { formatInvoiceNumber } from "../../src/lib/format";
import { supabase } from "../../src/lib/supabase";

type InvoiceStatus = "draft" | "paid" | "unpaid" | "overdue";

type InvoiceListItem = {
  id: string;
  invoiceNumber: number | null;
  clientName: string;
  status: InvoiceStatus;
  total: number;
  balanceDue: number;
  issueDate?: string;
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatIssueDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function statusChipStyle(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return styles.statusPaid;
    case "unpaid":
      return styles.statusUnpaid;
    case "overdue":
      return styles.statusOverdue;
    case "draft":
    default:
      return styles.statusDraft;
  }
}

export default function InvoicesPage() {
  const router = useRouter();

  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function resolveOrgId() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const userId = auth.user?.id;
    if (!userId) throw new Error("No authenticated user found.");

    const resolved = await getUserOrgId(userId);
    if (!resolved) throw new Error("Could not determine the active organization.");

    setOrgId(resolved);
    return resolved;
  }

  async function loadInvoices() {
    setLoading(true);

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const res = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, status, total, balance_due, issue_date")
        .eq("org_id", activeOrgId)
        .order("invoice_number", { ascending: false })
        .limit(200);

      if (res.error) throw new Error(res.error.message);

      const mapped: InvoiceListItem[] = (res.data ?? []).map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_number ?? null,
        clientName: row.client_name ?? "—",
        status: (row.status ?? "draft") as InvoiceStatus,
        total: Number(row.total ?? 0),
        balanceDue: Number(row.balance_due ?? 0),
        issueDate: row.issue_date ?? undefined,
      }));

      setItems(mapped);
    } catch (error: any) {
      Alert.alert("Load failed", error?.message ?? "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }

  async function performInvoiceDelete(item: InvoiceListItem) {
    const activeOrgId = orgId || (await resolveOrgId());

    const rpcRes = await supabase.rpc("delete_invoice_with_activity", {
      p_invoice_id: item.id,
    });

    if (!rpcRes.error) {
      return;
    }

    const cleanupTables = ["invoice_line_items", "invoice_items"];

    for (const tableName of cleanupTables) {
      const cleanupRes = await supabase.from(tableName).delete().eq("invoice_id", item.id);

      if (
        cleanupRes.error &&
        !cleanupRes.error.message.toLowerCase().includes("relation") &&
        !cleanupRes.error.message.toLowerCase().includes("does not exist")
      ) {
        throw new Error(cleanupRes.error.message);
      }
    }

    const deleteRes = await supabase
      .from("invoices")
      .delete()
      .eq("id", item.id)
      .eq("org_id", activeOrgId);

    if (deleteRes.error) {
      throw new Error(deleteRes.error.message || rpcRes.error.message);
    }
  }

  async function confirmDeleteInvoice(item: InvoiceListItem) {
    if (deletingId) return;

    try {
      setDeletingId(item.id);
      await performInvoiceDelete(item);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      Alert.alert("Deleted", "Invoice deleted.");
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Failed to delete invoice.");
    } finally {
      setDeletingId("");
    }
  }

  function deleteInvoice(item: InvoiceListItem) {
    if (deletingId) return;

    Alert.alert("Delete invoice", `Delete ${formatInvoiceNumber(item.invoiceNumber)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void confirmDeleteInvoice(item);
        },
      },
    ]);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      if (!q) return true;

      return (
        item.clientName.toLowerCase().includes(q) ||
        String(item.invoiceNumber ?? "").includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const unpaidCount = useMemo(
    () => items.filter((item) => item.status === "unpaid" || item.status === "overdue").length,
    [items]
  );

  const paidCount = useMemo(
    () => items.filter((item) => item.status === "paid").length,
    [items]
  );

  const revenue = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [items]
  );

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Invoices</Text>
            <Text style={styles.heroSub}>Track unpaid invoices, revenue, and draft billing.</Text>
          </View>

          <Pressable
            onPress={() => router.push("/invoices/new")}
            style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryBtnText}>Create Invoice</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Unpaid" value={String(unpaidCount)} />
          <StatCard label="Paid" value={String(paidCount)} />
          <StatCard label="Revenue" value={money(revenue)} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#8B7A60" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search invoices."
            placeholderTextColor="#8B7A60"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.tableCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Recent invoices</Text>
            </View>

            <Text style={styles.cardMeta}>{loading ? "Loading..." : `${filtered.length} shown`}</Text>
          </View>

          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Loading invoices...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No invoices found.</Text>
            </View>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colInvoice]}>Invoice #</Text>
                <Text style={[styles.th, styles.colClient]}>Client</Text>
                <Text style={[styles.th, styles.colMoney]}>Total</Text>
                <Text style={[styles.th, styles.colMoney]}>Balance</Text>
                <Text style={[styles.th, styles.colStatus]}>Status</Text>
                <Text style={[styles.th, styles.colDate]}>Issue Date</Text>
                <Text style={[styles.th, styles.colActions]}>Actions</Text>
              </View>

              {filtered.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.tr, index % 2 === 1 ? styles.trStriped : null]}
                >
                  <Pressable
                    onPress={() => router.push(`/invoices/${item.id}`)}
                    style={({ pressed }) => [styles.rowMain, pressed ? styles.trPressed : null]}
                  >
                    <Text style={[styles.td, styles.colInvoice]}>
                      {formatInvoiceNumber(item.invoiceNumber)}
                    </Text>

                    <Text style={[styles.td, styles.colClient]} numberOfLines={1}>
                      {item.clientName}
                    </Text>

                    <Text style={[styles.td, styles.colMoney]}>{money(item.total)}</Text>

                    <Text style={[styles.td, styles.colMoney]}>{money(item.balanceDue)}</Text>

                    <View style={[styles.statusChip, styles.colStatus, statusChipStyle(item.status)]}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>

                    <Text style={[styles.td, styles.colDate]}>{formatIssueDate(item.issueDate)}</Text>
                  </Pressable>

                  <View style={styles.actionCell}>
                    <Pressable
                      onPress={() => deleteInvoice(item)}
                      disabled={deletingId === item.id}
                      style={({ pressed }) => [
                        styles.deleteBtn,
                        deletingId === item.id ? styles.disabledBtn : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.deleteBtnText}>
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAF7F0",
    padding: 22,
    gap: 14,
  },

  heroCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#111111",
  },

  heroSub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#6B6B6B",
  },

  primaryBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B8962E",
    backgroundColor: "#D4AF37",
    justifyContent: "center",
    alignItems: "center",
  },

  primaryBtnText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 14,
  },

  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    flexGrow: 1,
    minWidth: 180,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 18,
    padding: 16,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8B7A60",
  },

  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "900",
    color: "#B8962E",
  },

  searchWrap: {
    height: 48,
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  searchInput: {
    flex: 1,
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },

  tableCard: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 22,
  },

  cardHeader: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111111",
  },

  cardMeta: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B6B6B",
  },

  table: {
    borderTopWidth: 1,
    borderTopColor: "#E8DFC7",
  },

  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FBF6EA",
    borderBottomWidth: 1,
    borderBottomColor: "#E8DFC7",
  },

  th: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8B7A60",
  },

  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F1E7D2",
    backgroundColor: "#FFFFFF",
  },

  trStriped: {
    backgroundColor: "#FFFDF8",
  },

  trPressed: {
    backgroundColor: "#F8F1E0",
  },

  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  td: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#111111",
  },

  colInvoice: {
    width: 130,
  },

  colClient: {
    flex: 1,
    minWidth: 180,
  },

  colMoney: {
    width: 110,
  },

  colStatus: {
    width: 110,
  },

  colDate: {
    width: 120,
  },

  colActions: {
    width: 110,
    textAlign: "right",
  },

  actionCell: {
    width: 110,
    paddingRight: 16,
    alignItems: "flex-end",
  },

  statusChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  statusText: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#111111",
    textTransform: "capitalize",
  },

  statusDraft: {
    backgroundColor: "rgba(110,98,74,0.10)",
    borderColor: "rgba(110,98,74,0.20)",
  },

  statusPaid: {
    backgroundColor: "rgba(212,175,55,0.14)",
    borderColor: "rgba(212,175,55,0.30)",
  },

  statusUnpaid: {
    backgroundColor: "rgba(184,150,46,0.14)",
    borderColor: "rgba(184,150,46,0.28)",
  },

  statusOverdue: {
    backgroundColor: "rgba(193,67,67,0.10)",
    borderColor: "rgba(193,67,67,0.20)",
  },

  deleteBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#C14343",
    borderWidth: 1,
    borderColor: "#C14343",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  deleteBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 12,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  emptyWrap: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  empty: {
    color: "#111111",
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.92,
  },
});