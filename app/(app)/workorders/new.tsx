// app/(app)/workorders/new.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Screen from "../../../src/components/Screen";
import GoldButton from "../../../src/components/GoldButton";
import { getUserOrgId } from "../../../src/lib/auth";
import { supabase } from "../../../src/lib/supabase";

type ClientRow = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
};

type WorkOrderStatus = "Open" | "Scheduled" | "In Progress" | "On Hold" | "Closed";
type WorkOrderPriority = "Low" | "Normal" | "High" | "Urgent";

type HeaderKey =
  | "qty"
  | "measurement"
  | "color"
  | "mount"
  | "val"
  | "opening"
  | "prod"
  | "amount"
  | "actions";
type HeaderLabels = Record<HeaderKey, string>;

type InvoiceVisibility = {
  showNotes: boolean;
  showMeasurement: boolean;
  showMount: boolean;
  showVal: boolean;
  showOpening: boolean;
  showProd: boolean;
  showInstallation: boolean;
  showDeposit: boolean;
  showSignature: boolean;
};

type WorkOrderMeta = {
  notes?: string;
  installation?: number;
  deposit?: number;
  tax_rate_override?: number;
  headers?: Partial<HeaderLabels>;
  invoiceVisibility?: Partial<InvoiceVisibility>;
};

const PALETTE = {
  ink: "#111111",
  gold: "#D4AF37",
  goldDark: "#B8962E",
  goldSoft: "#F5E6B8",
  bg: "#FAF7F0",
  card: "#FFFFFF",
  cardSoft: "#FFFDF8",
  border: "#E8DFC7",
  muted: "#6B6B6B",
  mutedSoft: "#8B7A60",
};

const STATUS_OPTIONS: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "On Hold", "Closed"];
const PRIORITY_OPTIONS: WorkOrderPriority[] = ["Low", "Normal", "High", "Urgent"];

const DEFAULT_HEADERS: HeaderLabels = {
  qty: "QTY",
  measurement: "MEASUREMENT",
  color: "COLOR NAME/NUMBER",
  mount: "MOUNT",
  val: "VAL",
  opening: "OPENING",
  prod: "PROD.",
  amount: "AMOUNT",
  actions: "ACTIONS",
};

const DEFAULT_INVOICE_VISIBILITY: InvoiceVisibility = {
  showNotes: true,
  showMeasurement: true,
  showMount: true,
  showVal: true,
  showOpening: true,
  showProd: true,
  showInstallation: true,
  showDeposit: true,
  showSignature: true,
};

function getTodayDateIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoToMDY(value: string) {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}-${parts[2]}-${parts[0]}`;
}

function formatTypedDateToIso(value: string) {
  const cleaned = (value ?? "").replace(/[^\d]/g, "").slice(0, 8);

  if (cleaned.length < 8) return value;

  const month = cleaned.slice(0, 2);
  const day = cleaned.slice(2, 4);
  const year = cleaned.slice(4, 8);

  return `${year}-${month}-${day}`;
}

function formatClientAddress(client: ClientRow) {
  const line1 = [client.address1, client.address2].filter(Boolean).join(", ");
  const line2 = [client.city, client.state, client.zip].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" • ");
}

function buildWorkOrderDescription(meta: WorkOrderMeta) {
  const payload: WorkOrderMeta = {
    notes: (meta.notes ?? "").trim() || undefined,
    installation: typeof meta.installation === "number" ? meta.installation : 0,
    deposit: typeof meta.deposit === "number" ? meta.deposit : 0,
    tax_rate_override: typeof meta.tax_rate_override === "number" ? meta.tax_rate_override : undefined,
    headers: meta.headers ?? DEFAULT_HEADERS,
    invoiceVisibility: meta.invoiceVisibility ?? DEFAULT_INVOICE_VISIBILITY,
  };

  return JSON.stringify(payload);
}

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active ? styles.pillActive : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.flexCol}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.dateRow}>
        <TextInput
          value={formatIsoToMDY(value)}
          onChangeText={(v) => onChange(formatTypedDateToIso(v))}
          placeholder="MM-DD-YYYY"
          placeholderTextColor={PALETTE.muted}
          style={[styles.input, styles.dateInput]}
        />

        <Pressable onPress={() => onChange(getTodayDateIso())} style={styles.todayBtn}>
          <Ionicons name="calendar-outline" size={16} color={PALETTE.goldDark} />
          <Text style={styles.todayBtnText}>Today</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function NewWorkOrderPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [orgId, setOrgId] = useState("");

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<WorkOrderStatus>("Open");
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal");
  const [scheduledDate, setScheduledDate] = useState(getTodayDateIso());
  const [dueDate, setDueDate] = useState(getTodayDateIso());
  const [notes, setNotes] = useState("");

  const [clientQuery, setClientQuery] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    void loadClients();
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

  async function loadClients() {
    setLoadingClients(true);

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const res = await supabase
        .from("clients")
        .select("id, name, phone, email, address1, address2, city, state, zip")
        .eq("org_id", activeOrgId)
        .order("name", { ascending: true })
        .limit(200);

      if (res.error) throw new Error(res.error.message);

      const mapped: ClientRow[] = (res.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        address1: r.address1 ?? "",
        address2: r.address2 ?? "",
        city: r.city ?? "",
        state: r.state ?? "",
        zip: r.zip ?? "",
      }));

      setClients(mapped);
    } catch (error: any) {
      Alert.alert("Client load failed", error?.message ?? "Failed to load clients.");
    } finally {
      setLoadingClients(false);
    }
  }

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);

    return clients
      .filter((client) => {
        const addressText = formatClientAddress(client).toLowerCase();
        return (
          client.name.toLowerCase().includes(q) ||
          (client.phone ?? "").toLowerCase().includes(q) ||
          (client.email ?? "").toLowerCase().includes(q) ||
          addressText.includes(q)
        );
      })
      .slice(0, 8);
  }, [clients, clientQuery]);

  function chooseClient(client: ClientRow) {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientQuery(client.name);
  }

  async function createWorkOrder() {
    if (saving) return;

    const trimmedTitle = title.trim();
    const trimmedClient = clientName.trim();

    if (!trimmedTitle) {
      Alert.alert("Missing title", "Please enter a work order title.");
      return;
    }

    setSaving(true);

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const description = buildWorkOrderDescription({
        notes: notes.trim(),
        installation: 0,
        deposit: 0,
        headers: DEFAULT_HEADERS,
        invoiceVisibility: DEFAULT_INVOICE_VISIBILITY,
      });

      const insertRes = await supabase
        .from("work_orders")
        .insert({
           org_id: activeOrgId,
           title: trimmedTitle,
           client_name: trimmedClient || null,
           description,
           status,
          priority,
          scheduled_date: scheduledDate.trim() || null,
          due_date: dueDate.trim() || null
         })
        .select("id, work_order_number")
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const workOrderId = insertRes.data?.id;
      if (!workOrderId) throw new Error("Work order was created but no ID was returned.");

      const itemInsertRes = await supabase.from("work_order_items").insert({
        work_order_id: workOrderId,
        sort_order: 0,
        qty: 1,
        unit: null,
        item: null,
        description: JSON.stringify({}),
        unit_price: 1,
        taxable: true,
      });

      if (itemInsertRes.error) throw new Error(itemInsertRes.error.message);

      router.replace(`/workorders/${encodeURIComponent(workOrderId)}`);
    } catch (error: any) {
      Alert.alert("Create failed", error?.message ?? "Failed to create work order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={PALETTE.ink} />
            <Text style={styles.backText}>Work Orders</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>New Work Order</Text>
              <Text style={styles.sub}>
                Create the work order here, then fill out the full job grid on the next page.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Kitchen window replacement"
              placeholderTextColor={PALETTE.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Client</Text>
            <TextInput
              value={clientQuery}
              onChangeText={(v) => {
                setClientQuery(v);
                setClientName(v);
                setSelectedClientId("");
              }}
              placeholder="Search existing clients or type a new client name"
              placeholderTextColor={PALETTE.muted}
              style={styles.input}
            />

            <View style={styles.clientPicker}>
              {loadingClients ? (
                <Text style={styles.helper}>Loading clients...</Text>
              ) : filteredClients.length === 0 ? (
                <Text style={styles.helper}>No matching clients.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  {filteredClients.map((client, index) => (
                    <Pressable
                      key={client.id}
                      onPress={() => chooseClient(client)}
                      style={[
                        styles.clientRow,
                        index !== 0 ? styles.clientRowBorder : null,
                        selectedClientId === client.id ? styles.clientRowActive : null,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.clientName}>{client.name}</Text>
                        <Text style={styles.clientMeta}>
                          {[client.phone, client.email, formatClientAddress(client)].filter(Boolean).join(" • ") || "Saved client"}
                        </Text>
                      </View>
                      {selectedClientId === client.id ? (
                        <Ionicons name="checkmark-circle" size={18} color={PALETTE.goldDark} />
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>

          <View style={styles.doubleRow}>
            <View style={styles.flexCol}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.pillRow}>
                {STATUS_OPTIONS.map((option) => (
                  <Pill key={option} label={option} active={status === option} onPress={() => setStatus(option)} />
                ))}
              </View>
            </View>

            <View style={styles.flexCol}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.pillRow}>
                {PRIORITY_OPTIONS.map((option) => (
                  <Pill key={option} label={option} active={priority === option} onPress={() => setPriority(option)} />
                ))}
              </View>
            </View>
          </View>

          <View style={styles.doubleRow}>
            <DateField label="Scheduled Date" value={scheduledDate} onChange={setScheduledDate} />
            <DateField label="Due Date" value={dueDate} onChange={setDueDate} />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Special instructions, scope notes, install notes..."
              placeholderTextColor={PALETTE.muted}
              style={[styles.input, styles.textArea]}
              multiline
            />
          </View>

          <View style={styles.actions}>
            <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </Pressable>

            <GoldButton
              label={saving ? "Creating..." : "Create Work Order"}
              onPress={createWorkOrder}
              disabled={saving}
              style={{ minWidth: 190 }}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PALETTE.bg,
    padding: 22,
  },

  topRow: {
    marginBottom: 12,
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignSelf: "flex-start",
  },

  backText: {
    fontWeight: "900",
    color: PALETTE.ink,
  },

  card: {
    gap: 16,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  header: {
    marginBottom: 2,
  },

  h1: {
    fontSize: 30,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  sub: {
    marginTop: 6,
    color: PALETTE.muted,
    fontSize: 14,
    fontWeight: "700",
  },

  section: {
    gap: 6,
  },

  label: {
    color: PALETTE.mutedSoft,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.2,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: PALETTE.ink,
    fontWeight: "700",
    fontSize: 15,
  },

  textArea: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  clientPicker: {
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: PALETTE.cardSoft,
  },

  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },

  clientRowBorder: {
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
  },

  clientRowActive: {
    backgroundColor: PALETTE.goldSoft,
  },

  clientName: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 13,
  },

  clientMeta: {
    marginTop: 4,
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  helper: {
    color: PALETTE.muted,
    fontWeight: "700",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  doubleRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },

  flexCol: {
    flex: 1,
    minWidth: 280,
    gap: 6,
  },

  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  pill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    justifyContent: "center",
  },

  pillActive: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },

  pillText: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 12.5,
  },

  pillTextActive: {
    color: PALETTE.goldDark,
  },

  dateRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  dateInput: {
    flex: 1,
  },

  todayBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: PALETTE.goldSoft,
    borderWidth: 1,
    borderColor: PALETTE.gold,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },

  todayBtnText: {
    fontWeight: "900",
    color: PALETTE.goldDark,
  },

  actions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },

  secondaryBtn: {
    backgroundColor: PALETTE.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryBtnText: {
    fontWeight: "900",
    color: PALETTE.ink,
  },

  pressed: {
    opacity: 0.92,
  },
});