import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Screen from "../../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
  SummaryCard,
  SummaryStrip,
} from "../../../src/components/AppPage";
import EmptyState from "../../../src/components/EmptyState";
import { getUserOrgId } from "../../../src/lib/auth";
import { logActivity } from "../../../src/lib/activity";
import { formatInvoiceNumber } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";
import { theme } from "../../../src/theme/theme";

type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "unpaid" | "overdue" | "void";

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
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function statusChipStyle(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return styles.statusPaid;
    case "unpaid":
    case "sent":
    case "partial":
      return styles.statusUnpaid;
    case "overdue":
      return styles.statusOverdue;
    case "void":
      return styles.statusVoid;
    case "draft":
    default:
      return styles.statusDraft;
  }
}

function statusTextStyle(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return styles.statusTextPaid;
    case "overdue":
      return styles.statusTextOverdue;
    case "unpaid":
    case "sent":
    case "partial":
      return styles.statusTextUnpaid;
    default:
      return null;
  }
}

export default function InvoicesPage() {
  const router = useRouter();

  const [orgId, setOrgId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [deletingId, setDeletingId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");

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
    setUserId(userId);
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
        clientName: row.client_name ?? "-",
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

  async function deleteInvoice(item: InvoiceListItem) {
    if (deletingId) return;

    // First click: enter confirm state (button turns red with "Confirm?" text)
    if (confirmDeleteId !== item.id) {
      setConfirmDeleteId(item.id);
      // Auto-cancel confirm state after 3s if user doesn't follow through
      setTimeout(() => setConfirmDeleteId((prev) => (prev === item.id ? "" : prev)), 3000);
      return;
    }

    // Second click: actually delete
    setConfirmDeleteId("");
    setDeletingId(item.id);

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const rpcRes = await supabase.rpc("delete_invoice_with_activity", {
        p_invoice_id: item.id,
      });

      if (rpcRes.error) {
        // Fallback: manual delete if RPC unavailable
        await supabase.from("invoice_payments").delete().eq("invoice_id", item.id);
        await supabase.from("invoice_items").delete().eq("invoice_id", item.id);
        const { error } = await supabase.from("invoices").delete().eq("id", item.id).eq("org_id", activeOrgId);
        if (error) throw new Error(error.message);
      }

      setItems((prev) => prev.filter((x) => x.id !== item.id));

      void logActivity(supabase, {
        org_id: activeOrgId,
        actor_user_id: userId || null,
        actor_name: null,
        action: "deleted",
        entity_type: "invoice",
        entity_id: item.id,
        title: "Deleted invoice",
        description: `deleted ${formatInvoiceNumber(item.invoiceNumber)}`,
        details: {
          invoice_id: item.id,
          invoice_number: formatInvoiceNumber(item.invoiceNumber),
          client_name: item.clientName,
          total: item.total,
          balance_due: item.balanceDue,
        },
      });
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Failed to delete invoice.");
    } finally {
      setDeletingId("");
    }
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
    () =>
      items.filter((item) => ["unpaid", "overdue", "sent", "partial"].includes(item.status)).length,
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
      <AppPage>
        <PageHeader
          eyebrow="Invoices"
          title="Billing"
          subtitle="Track outstanding balances, recent invoices, and revenue without visual clutter."
          actions={[
            { label: "Refresh", onPress: () => void loadInvoices() },
            { label: "Create Invoice", primary: true, onPress: () => router.push("/invoices/new") },
          ]}
        />

        <SummaryStrip>
          <SummaryCard label="Outstanding" value={String(unpaidCount)} meta="Unpaid or overdue" accent="violet" />
          <SummaryCard label="Paid" value={String(paidCount)} meta="Completed payments" accent="lavender" />
          <SummaryCard label="Revenue" value={money(revenue)} meta="Total invoiced" accent="purple" />
        </SummaryStrip>

        <ContentCard title="Invoice table" subtitle="Keep just the essential billing columns visible by default." meta={loading ? "Loading..." : `${filtered.length} shown`}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={theme.colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search invoices"
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Loading invoices...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title="No invoices yet"
              body="Create your first invoice to start tracking outstanding balances and payment activity."
              actionLabel="Create Invoice"
              onAction={() => router.push("/invoices/new")}
            />
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, styles.colInvoice]}>Invoice #</Text>
                <Text style={[styles.th, styles.colClient]}>Client</Text>
                <Text style={[styles.th, styles.colStatus]}>Status</Text>
                <Text style={[styles.th, styles.colMoney]}>Total</Text>
                <Text style={[styles.th, styles.colMoney]}>Balance Due</Text>
                <Text style={[styles.th, styles.colDate]}>Issue Date</Text>
                <Text style={[styles.th, styles.colActions]}>Actions</Text>
              </View>

              {filtered.map((item, index) => (
                <View key={item.id} style={[styles.tr, index % 2 === 1 ? styles.trStriped : null]}>
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
                    <View style={[styles.statusChip, styles.colStatus, statusChipStyle(item.status)]}>
                      <Text style={[styles.statusText, statusTextStyle(item.status)]}>{item.status}</Text>
                    </View>
                    <Text style={[styles.td, styles.colMoney]}>{money(item.total)}</Text>
                    <Text style={[styles.td, styles.colMoney, item.balanceDue > 0 ? styles.balanceDuePositive : null]}>
                      {item.balanceDue > 0 ? money(item.balanceDue) : "—"}
                    </Text>
                    <Text style={[styles.td, styles.colDate]}>{formatIssueDate(item.issueDate)}</Text>
                  </Pressable>

                  <View style={styles.actionCell}>
                    <Pressable
                      onPress={() => router.push(`/invoices/${item.id}`)}
                      style={({ pressed }) => [styles.openBtn, pressed ? styles.pressed : null]}
                    >
                      <Ionicons name="open-outline" size={13} color={theme.colors.ink} />
                      <Text style={styles.openBtnText}>Open</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void deleteInvoice(item)}
                      disabled={deletingId === item.id}
                      style={({ pressed }) => [
                        styles.deleteBtn,
                        confirmDeleteId === item.id ? styles.deleteBtnConfirm : null,
                        deletingId === item.id ? styles.disabledBtn : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      {deletingId === item.id ? (
                        <Text style={styles.deleteBtnText}>...</Text>
                      ) : confirmDeleteId === item.id ? (
                        <Text style={styles.deleteBtnText}>Sure?</Text>
                      ) : (
                        <Ionicons name="trash-outline" size={13} color="#B91C1C" />
                      )}
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ContentCard>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    height: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "500",
  },
  table: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  th: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  trStriped: {
    backgroundColor: "#F8FAFC",
  },
  trPressed: {
    backgroundColor: theme.colors.surface2,
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
    fontWeight: "600",
    color: theme.colors.ink,
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
    width: 120,
    textAlign: "right",
  },
  actionCell: {
    width: 120,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
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
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.muted,
    textTransform: "capitalize",
  },
  statusTextPaid: {
    color: "#166534",
  },
  statusTextUnpaid: {
    color: "#92400E",
  },
  statusTextOverdue: {
    color: "#B91C1C",
  },
  statusDraft: {
    backgroundColor: "#F9FAFB",
    borderColor: theme.colors.border,
  },
  statusPaid: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusUnpaid: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  statusOverdue: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusVoid: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  balanceDuePositive: {
    color: "#B91C1C",
    fontWeight: "800",
  },
  openBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  openBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },
  deleteBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  deleteBtnConfirm: {
    backgroundColor: "#C14343",
    borderColor: "#C14343",
  },
  deleteBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  emptyWrap: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  empty: {
    color: theme.colors.ink,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.92,
  },
});
