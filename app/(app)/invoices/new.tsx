import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Screen from "../../../src/components/Screen";
import { AppPage, ContentCard, PageHeader, SummaryCard, SummaryStrip } from "../../../src/components/AppPage";
import { getUserOrgId } from "../../../src/lib/auth";
import { logActivity } from "../../../src/lib/activity";
import { cleanDecimalInput, formatCurrencyDisplay, formatInvoiceNumber } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";
import { theme } from "../../../src/theme/theme";

type ClientOption = {
  id: string;
  name: string;
  email?: string | null;
};

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function NewInvoicePage() {
  const router = useRouter();

  const [orgId, setOrgId] = useState("");
  const [userId, setUserId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDaysIso(14));
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("");
  const [deposit, setDeposit] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<number | null>(null);

  useEffect(() => {
    void loadBasics();
  }, []);

  const subtotalValue = Number(cleanDecimalInput(subtotal) || "0");
  const taxValue = Number(cleanDecimalInput(tax) || "0");
  const depositValue = Number(cleanDecimalInput(deposit) || "0");
  const total = useMemo(() => subtotalValue + taxValue, [subtotalValue, taxValue]);
  const balanceDue = useMemo(() => Math.max(total - depositValue, 0), [depositValue, total]);

  async function resolveOrgId() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const resolvedUserId = auth.user?.id;
    if (!resolvedUserId) throw new Error("No authenticated user found.");

    const resolvedOrgId = await getUserOrgId(resolvedUserId);
    if (!resolvedOrgId) throw new Error("Could not determine the active organization.");

    setOrgId(resolvedOrgId);
    setUserId(resolvedUserId);
    return { resolvedOrgId, resolvedUserId };
  }

  async function fetchNextInvoiceNumber(activeOrgId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("org_id", activeOrgId)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return Number(data?.invoice_number ?? 0) + 1;
  }

  async function loadBasics() {
    try {
      const { resolvedOrgId } = await resolveOrgId();

      const [nextNumber, clientRes] = await Promise.all([
        fetchNextInvoiceNumber(resolvedOrgId),
        supabase
          .from("clients")
          .select("id, name, email")
          .eq("org_id", resolvedOrgId)
          .order("name", { ascending: true })
          .limit(100),
      ]);

      if (clientRes.error) throw new Error(clientRes.error.message);

      setNextInvoiceNumber(nextNumber);
      setClients((clientRes.data ?? []).map((client: any) => ({
        id: client.id,
        name: client.name ?? "Unnamed Client",
        email: client.email ?? null,
      })));
    } catch (error: any) {
      Alert.alert("Load failed", error?.message ?? "Failed to load invoice setup.");
    }
  }

  function selectClient(client: ClientOption) {
    setSelectedClientId(client.id);
    setClientName(client.name);
  }

  async function createInvoice() {
    if (saving) return;

    const activeOrgId = orgId || (await resolveOrgId()).resolvedOrgId;
    const invoiceClientName = clientName.trim();
    if (!invoiceClientName) {
      Alert.alert("Missing client", "Enter a client name before creating the invoice.");
      return;
    }

    try {
      setSaving(true);
      const invoiceNumber = nextInvoiceNumber ?? (await fetchNextInvoiceNumber(activeOrgId));
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          org_id: activeOrgId,
          client_id: selectedClientId || null,
          invoice_number: invoiceNumber,
          client_name: invoiceClientName,
          bill_to: invoiceClientName,
          status: balanceDue > 0 ? "unpaid" : "draft",
          issue_date: issueDate || null,
          due_date: dueDate || null,
          subtotal: subtotalValue,
          tax: taxValue,
          total,
          deposit: depositValue,
          balance_due: balanceDue,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (error || !data?.id) throw new Error(error?.message ?? "Failed to create invoice.");

      void logActivity(supabase, {
        org_id: activeOrgId,
        actor_user_id: userId || null,
        actor_name: null,
        action: "created",
        entity_type: "invoice",
        entity_id: data.id,
        title: "Created invoice",
        description: `created ${formatInvoiceNumber(invoiceNumber)} for ${invoiceClientName}`,
        details: {
          invoice_id: data.id,
          invoice_number: formatInvoiceNumber(invoiceNumber),
          client_id: selectedClientId || null,
          client_name: invoiceClientName,
          total,
          balance_due: balanceDue,
        },
      });

      router.replace(`/invoices/${data.id}?created=1`);
    } catch (error: any) {
      Alert.alert("Create failed", error?.message ?? "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Billing"
          title="Create Invoice"
          subtitle="Start with a clean invoice shell, then add line items from work orders or manual entries."
          actions={[
            { label: "Cancel", onPress: () => router.push("/invoices") },
            { label: saving ? "Creating..." : "Create Invoice", primary: true, onPress: () => void createInvoice() },
          ]}
        />

        <SummaryStrip>
          <SummaryCard label="Invoice #" value={formatInvoiceNumber(nextInvoiceNumber)} meta="Next available" />
          <SummaryCard label="Total" value={money(total)} meta="Subtotal plus tax" accent="violet" />
          <SummaryCard label="Balance Due" value={money(balanceDue)} meta="After deposit" accent="lavender" />
        </SummaryStrip>

        <ContentCard title="Invoice details" subtitle="Only the essentials are required to get the invoice created.">
          <View style={styles.formStack}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Client</Text>
              <TextInput
                value={clientName}
                onChangeText={(value) => {
                  setClientName(value);
                  setSelectedClientId("");
                }}
                placeholder="Client name"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            {clients.length ? (
              <View style={styles.clientChips}>
                {clients.slice(0, 8).map((client) => (
                  <Pressable
                    key={client.id}
                    onPress={() => selectClient(client)}
                    style={[
                      styles.chip,
                      selectedClientId === client.id ? styles.chipActive : null,
                    ]}
                  >
                    <Text style={[styles.chipText, selectedClientId === client.id ? styles.chipTextActive : null]}>
                      {client.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.twoCol}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Issue Date</Text>
                <TextInput value={issueDate} onChangeText={setIssueDate} style={styles.input} />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Due Date</Text>
                <TextInput value={dueDate} onChangeText={setDueDate} style={styles.input} />
              </View>
            </View>

            <View style={styles.threeCol}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Subtotal</Text>
                <TextInput
                  value={subtotal}
                  onChangeText={(value) => setSubtotal(formatCurrencyDisplay(value))}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Tax</Text>
                <TextInput
                  value={tax}
                  onChangeText={(value) => setTax(formatCurrencyDisplay(value))}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Deposit</Text>
                <TextInput
                  value={deposit}
                  onChangeText={(value) => setDeposit(formatCurrencyDisplay(value))}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Payment terms, internal notes, or client-facing message..."
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, styles.notesInput]}
                multiline
              />
            </View>
          </View>
        </ContentCard>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formStack: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
    flex: 1,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  twoCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  threeCol: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  clientChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  chipActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  chipText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
  },
  chipTextActive: {
    color: theme.colors.goldDark,
  },
});
