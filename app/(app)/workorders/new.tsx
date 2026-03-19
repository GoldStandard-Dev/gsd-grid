import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import Screen from "../../../src/components/Screen";
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

type HeaderLabels = Record<
  "qty" | "measurement" | "color" | "mount" | "val" | "opening" | "prod" | "amount" | "actions",
  string
>;

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

type ReviewStatus = "draft" | "submitted_for_review" | "in_review" | "priced";

type ReviewWorkflow = {
  status: ReviewStatus;
  submittedAt?: string;
  submittedBy?: string;
  reviewStartedAt?: string;
  reviewStartedBy?: string;
  completedAt?: string;
  completedBy?: string;
  note?: string;
};

type AssignmentMeta = {
  userId?: string;
  displayName?: string;
  role?: string;
};

type TemplateHeader = {
  id: string;
  label: string;
  enabled: boolean;
  options?: string[];
};

type TemplateDefinition = {
  name: string;
  headers: TemplateHeader[];
  previewRows: Array<{ measurement: string; color: string; fields: Record<string, string> }>;
};

type SavedTemplate = {
  id: string;
  name: string;
  sourceName: string;
  headers: TemplateHeader[];
  createdAt: string;
};

type WorkOrderMeta = {
  notes?: string;
  installation?: number;
  deposit?: number;
  tax_rate_override?: number;
  headers?: Partial<HeaderLabels>;
  invoiceVisibility?: Partial<InvoiceVisibility>;
  selectedTemplateName?: string;
  selectedTemplateLabel?: string;
  customHeaders?: TemplateHeader[];
  gridVisibility?: {
    showQty?: boolean;
    showAmount?: boolean;
  };
  reviewWorkflow?: Partial<ReviewWorkflow>;
  assignedTo?: AssignmentMeta;
  createdBy?: AssignmentMeta;
};

type TeamMemberOption = {
  user_id: string;
  role: string;
  status: string;
  display_name?: string | null;
  email?: string | null;
};

const PALETTE = {
  ink: "#111111",
  gold: "#c9a227",
  goldBright: "#d4af37",
  goldDark: "#8a6a12",
  goldSoft: "#f5e6b8",
  bg: "#f7f3ea",
  card: "#ffffff",
  cardSoft: "#fffdf8",
  border: "#e4d6b2",
  borderStrong: "#dcc89a",
  muted: "#6f6a63",
  mutedSoft: "#7b746b",
  red: "#b54343",
  hero: "#111111",
};

const STATUS_OPTIONS: WorkOrderStatus[] = ["Open", "Scheduled", "In Progress", "On Hold", "Closed"];
const PRIORITY_OPTIONS: WorkOrderPriority[] = ["Low", "Normal", "High", "Urgent"];

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: "General",
    headers: [
      { id: "mount", label: "MOUNT", enabled: true, options: ["Inside", "Outside", "Surface", "Recessed"] },
      { id: "val", label: "VAL", enabled: true, options: ["Standard", "Left", "Right", "Center"] },
      { id: "opening", label: "OPENING", enabled: true, options: ["Single", "Double", "Triple", "Custom"] },
      { id: "prod", label: "PROD.", enabled: true, options: ["Standard", "Premium", "Custom", "Owner Supplied"] },
    ],
    previewRows: [
      { measurement: '36" x 48"', color: "White", fields: { mount: "Inside", val: "Standard", opening: "Single", prod: "Premium" } },
      { measurement: '72" x 60"', color: "Bronze", fields: { mount: "Outside", val: "Left", opening: "Double", prod: "Custom" } },
    ],
  },
  {
    name: "Windows",
    headers: [
      { id: "mount", label: "MOUNT", enabled: true, options: ["Inside", "Outside", "Flush Fin", "Block Frame"] },
      { id: "val", label: "STYLE", enabled: true, options: ["Single Hung", "Double Hung", "Slider", "Picture"] },
      { id: "opening", label: "OPENING", enabled: true, options: ["XO", "OX", "XOX", "Fixed"] },
      { id: "prod", label: "SERIES", enabled: true, options: ["Builder", "Premium", "Impact", "Custom"] },
    ],
    previewRows: [
      { measurement: '35 1/2" x 59 1/2"', color: "White / Low-E", fields: { mount: "Block Frame", val: "Single Hung", opening: "XO", prod: "Builder" } },
      { measurement: '71" x 47 1/2"', color: "Black Exterior", fields: { mount: "Flush Fin", val: "Slider", opening: "XOX", prod: "Impact" } },
    ],
  },
  {
    name: "Doors",
    headers: [
      { id: "mount", label: "SWING", enabled: true, options: ["In Swing", "Out Swing", "Left Hand", "Right Hand"] },
      { id: "val", label: "HINGE", enabled: true, options: ["Left", "Right", "Center", "Pivot"] },
      { id: "opening", label: "OPENING", enabled: true, options: ["Single", "French", "Slider", "Patio"] },
      { id: "prod", label: "MODEL", enabled: true, options: ["Fiberglass", "Steel", "Wood", "Custom"] },
    ],
    previewRows: [
      { measurement: '36" x 80"', color: "Black", fields: { mount: "In Swing", val: "Left", opening: "Single", prod: "Fiberglass" } },
      { measurement: '72" x 80"', color: "White", fields: { mount: "Out Swing", val: "Right", opening: "French", prod: "Steel" } },
    ],
  },
  {
    name: "Flooring",
    headers: [
      { id: "mount", label: "INSTALL", enabled: true, options: ["Glue", "Float", "Nail", "Tile"] },
      { id: "val", label: "GRADE", enabled: true, options: ["Builder", "Premium", "Commercial", "Waterproof"] },
      { id: "opening", label: "AREA", enabled: true, options: ["Kitchen", "Bath", "Living", "Whole Home"] },
      { id: "prod", label: "SKU", enabled: true, options: ["Stock", "Special Order", "Owner Supplied", "Custom"] },
    ],
    previewRows: [
      { measurement: "240 sq ft", color: "Oak", fields: { mount: "Float", val: "Premium", opening: "Living", prod: "Stock" } },
      { measurement: "80 sq ft", color: "Gray Tile", fields: { mount: "Tile", val: "Commercial", opening: "Bath", prod: "Special Order" } },
    ],
  },
  {
    name: "Painting",
    headers: [
      { id: "mount", label: "COAT", enabled: true, options: ["Prime", "1 Coat", "2 Coat", "Touch Up"] },
      { id: "val", label: "SHEEN", enabled: true, options: ["Flat", "Eggshell", "Satin", "Semi-Gloss"] },
      { id: "opening", label: "ROOM", enabled: true, options: ["Kitchen", "Bath", "Bedroom", "Exterior"] },
      { id: "prod", label: "SKU", enabled: true, options: ["Owner Supplied", "Standard", "Premium", "Custom Match"] },
    ],
    previewRows: [
      { measurement: "12 x 14 room", color: "SW Alabaster", fields: { mount: "2 Coat", val: "Eggshell", opening: "Bedroom", prod: "Premium" } },
      { measurement: "Exterior trim", color: "SW Pure White", fields: { mount: "Prime", val: "Semi-Gloss", opening: "Exterior", prod: "Custom Match" } },
    ],
  },
  {
    name: "Plumbing",
    headers: [
      { id: "mount", label: "TYPE", enabled: true, options: ["Repair", "Replace", "Rough-In", "Fixture"] },
      { id: "val", label: "SIZE", enabled: true, options: ['1/2"', '3/4"', '1"', "Custom"] },
      { id: "opening", label: "LOCATION", enabled: true, options: ["Kitchen", "Bath", "Laundry", "Exterior"] },
      { id: "prod", label: "MODEL", enabled: true, options: ["Standard", "Moen", "Delta", "Custom"] },
    ],
    previewRows: [
      { measurement: "1 line", color: "Brushed Nickel", fields: { mount: "Replace", val: '1/2"', opening: "Kitchen", prod: "Delta" } },
      { measurement: "2 valves", color: "Chrome", fields: { mount: "Repair", val: '3/4"', opening: "Laundry", prod: "Standard" } },
    ],
  },
  {
    name: "Electrical",
    headers: [
      { id: "mount", label: "AMP", enabled: true, options: ["15A", "20A", "30A", "50A"] },
      { id: "val", label: "VOLT", enabled: true, options: ["120V", "208V", "240V", "277V"] },
      { id: "opening", label: "LOCATION", enabled: true, options: ["Kitchen", "Bath", "Garage", "Panel"] },
      { id: "prod", label: "MODEL", enabled: true, options: ["Standard", "GFCI", "AFCI", "Smart"] },
    ],
    previewRows: [
      { measurement: "3 devices", color: "White", fields: { mount: "20A", val: "120V", opening: "Kitchen", prod: "GFCI" } },
      { measurement: "1 circuit", color: "Black", fields: { mount: "30A", val: "240V", opening: "Garage", prod: "Smart" } },
    ],
  },
];

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

const TEMPLATE_STORAGE_KEY = "gsd:grid:workorder:saved-templates";

function normalizeOptionList(input: string) {
  const values = input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function formatOptionsInput(options?: string[]) {
  return (options ?? []).join(", ");
}

function cloneHeaders(headers: TemplateHeader[]) {
  return headers.map((header) => ({ ...header, options: [...(header.options ?? [])] }));
}

function makeHeaderId() {
  return `hdr_${Math.random().toString(36).slice(2, 10)}`;
}

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

function createSavedTemplatePayload(name: string, sourceName: string, headers: TemplateHeader[]): SavedTemplate {
  return {
    id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    sourceName: sourceName.trim() || "Custom",
    headers: cloneHeaders(headers).map((header, index) => ({
      ...header,
      label: header.label.trim() || `HEADER ${index + 1}`,
      enabled: header.enabled !== false,
      options: Array.from(
        new Set(
          [header.label.trim() || `HEADER ${index + 1}`, ...(header.options ?? [])]
            .map((value) => value.trim())
            .filter(Boolean)
        )
      ),
    })),
    createdAt: new Date().toISOString(),
  };
}

function mapWorkOrderStatusForDb(status: WorkOrderStatus) {
  switch (status) {
    case "Open":
      return "Open";
    case "Scheduled":
      return "Scheduled";
    case "In Progress":
      return "In Progress";
    case "On Hold":
      return "On Hold";
    case "Closed":
      return "Closed";
    default:
      return status;
  }
}

async function insertWorkOrderViaRest(payload: Record<string, any>) {
  const supabaseUrl = (Constants.expoConfig?.extra as any)?.SUPABASE_URL as string | undefined;
  const supabaseAnonKey = (Constants.expoConfig?.extra as any)?.SUPABASE_ANON_KEY as string | undefined;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase config is missing for REST fallback.");
  }

  const { data: sessionRes, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);

  const accessToken = sessionRes.session?.access_token;
  if (!accessToken) throw new Error("No authenticated session found for REST fallback.");

  const response = await fetch(`${supabaseUrl}/rest/v1/work_orders`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify([payload]),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(bodyText || `REST insert failed with status ${response.status}.`);
  }
}

function buildWorkOrderDescription(meta: WorkOrderMeta) {
  const payload: WorkOrderMeta = {
    notes: (meta.notes ?? "").trim() || undefined,
    installation: typeof meta.installation === "number" ? meta.installation : 0,
    deposit: typeof meta.deposit === "number" ? meta.deposit : 0,
    tax_rate_override: typeof meta.tax_rate_override === "number" ? meta.tax_rate_override : undefined,
    headers: meta.headers ?? DEFAULT_HEADERS,
    invoiceVisibility: meta.invoiceVisibility ?? DEFAULT_INVOICE_VISIBILITY,
    selectedTemplateName: meta.selectedTemplateName?.trim() || "General",
    selectedTemplateLabel: meta.selectedTemplateLabel?.trim() || undefined,
    customHeaders: meta.customHeaders?.length ? meta.customHeaders : undefined,
    gridVisibility: meta.gridVisibility ?? { showQty: true, showAmount: false },
    reviewWorkflow: meta.reviewWorkflow ?? { status: "draft" },
    assignedTo: meta.assignedTo?.userId ? meta.assignedTo : undefined,
    createdBy: meta.createdBy?.userId ? meta.createdBy : undefined,
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
  const [loadingSavedTemplates, setLoadingSavedTemplates] = useState(false);
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
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [assignedUserId, setAssignedUserId] = useState("");

  const [selectedTemplateName, setSelectedTemplateName] = useState("General");
  const [customHeaders, setCustomHeaders] = useState<TemplateHeader[]>(cloneHeaders(TEMPLATE_DEFINITIONS[0].headers));
  const [openHeaderMenuId, setOpenHeaderMenuId] = useState<string | null>(null);
  const [newHeaderOptionInputs, setNewHeaderOptionInputs] = useState<Record<string, string>>({});

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState("");

  useEffect(() => {
    void loadClients();
    void loadTeamMembers();
    void loadSavedTemplates();
  }, []);

  const selectedTemplate = useMemo(
    () => TEMPLATE_DEFINITIONS.find((template) => template.name === selectedTemplateName) ?? TEMPLATE_DEFINITIONS[0],
    [selectedTemplateName]
  );

  const selectedSavedTemplate = useMemo(
    () => savedTemplates.find((template) => template.id === selectedSavedTemplateId) ?? null,
    [savedTemplates, selectedSavedTemplateId]
  );

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

  const selectedAssignee = useMemo(
    () => teamMembers.find((member) => member.user_id === assignedUserId) ?? null,
    [assignedUserId, teamMembers]
  );

  const visibleHeaders = useMemo(() => customHeaders.filter((header) => header.enabled), [customHeaders]);

  const previewRows = useMemo(() => {
    return selectedTemplate.previewRows.map((row, index) => {
      const nextFields: Record<string, string> = {};
      customHeaders.forEach((header) => {
        const defaultValue = row.fields?.[header.id] ?? header.options?.[0] ?? "";
        nextFields[header.id] = defaultValue;
      });

      return {
        id: `${selectedTemplate.name}-${index}`,
        measurement: row.measurement,
        color: row.color,
        fields: nextFields,
      };
    });
  }, [customHeaders, selectedTemplate]);

  async function resolveOrgId() {
    if (orgId) return orgId;

    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const userId = auth.user?.id;
    if (!userId) throw new Error("No authenticated user found.");

    const resolved = await getUserOrgId(userId);
    if (!resolved) throw new Error("Could not determine the active organization.");

    setOrgId(resolved);
    return resolved;
  }

  async function fetchNextWorkOrderNumber(activeOrgId: string) {
    const { data, error } = await supabase
      .from("work_orders")
      .select("work_order_number")
      .eq("org_id", activeOrgId)
      .order("work_order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const lastNumber = Number(data?.work_order_number ?? 0);
    return lastNumber + 1;
  }

  async function loadClients() {
    setLoadingClients(true);
    try {
      const activeOrgId = await resolveOrgId();
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

  async function loadTeamMembers() {
    try {
      const activeOrgId = await resolveOrgId();
      const res = await supabase
        .from("org_members")
        .select("user_id, role, status, display_name, email")
        .eq("org_id", activeOrgId)
        .order("created_at", { ascending: true });

      if (res.error) throw new Error(res.error.message);

      const mapped: TeamMemberOption[] = (res.data ?? [])
        .map((row: any) => ({
          user_id: row.user_id,
          role: String(row.role ?? "viewer"),
          status: String(row.status ?? "active"),
          display_name: row.display_name ?? "",
          email: row.email ?? "",
        }))
        .filter((row: TeamMemberOption) => row.user_id && row.status.toLowerCase() === "active");

      setTeamMembers(mapped);
    } catch (error: any) {
      console.warn("Failed to load team members", error?.message ?? error);
      setTeamMembers([]);
    }
  }

  async function loadSavedTemplates() {
    setLoadingSavedTemplates(true);
    try {
      const raw = await AsyncStorage.getItem(TEMPLATE_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedTemplate[]) : [];
      const normalized = Array.isArray(parsed)
        ? parsed.map((template) => ({
            ...template,
            headers: cloneHeaders(template.headers ?? []),
          }))
        : [];
      setSavedTemplates(normalized);
    } catch (error) {
      console.warn("Failed to load saved templates", error);
      setSavedTemplates([]);
    } finally {
      setLoadingSavedTemplates(false);
    }
  }

  async function persistSavedTemplates(nextTemplates: SavedTemplate[]) {
    setSavedTemplates(nextTemplates);
    await AsyncStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
  }

  function chooseClient(client: ClientRow) {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientQuery(client.name);
  }

  function applyTemplate(name: string) {
    const nextTemplate = TEMPLATE_DEFINITIONS.find((template) => template.name === name) ?? TEMPLATE_DEFINITIONS[0];
    setSelectedTemplateName(nextTemplate.name);
    setCustomHeaders(cloneHeaders(nextTemplate.headers));
    setOpenHeaderMenuId(null);
    setNewHeaderOptionInputs({});
  }

  function addCustomHeader() {
    setCustomHeaders((prev) => [
      ...prev,
      {
        id: makeHeaderId(),
        label: `HEADER ${prev.length + 1}`,
        enabled: true,
        options: ["Option 1", "Option 2", "Option 3"],
      },
    ]);
  }

  function removeCustomHeader(headerId: string) {
    const nextHeaders = customHeaders.filter((header) => header.id !== headerId);
    if (!nextHeaders.length) {
      Alert.alert("At least one header", "Keep at least one custom header on the template.");
      return;
    }
    if (!nextHeaders.some((header) => header.enabled)) {
      nextHeaders[0].enabled = true;
    }
    setCustomHeaders(nextHeaders);
    setOpenHeaderMenuId((prev) => (prev === headerId ? null : prev));
    setNewHeaderOptionInputs((prev) => {
      const next = { ...prev };
      delete next[headerId];
      return next;
    });
  }

  function toggleHeaderEnabled(headerId: string) {
    const nextHeaders = customHeaders.map((header) =>
      header.id === headerId ? { ...header, enabled: !header.enabled } : header
    );

    if (!nextHeaders.some((header) => header.enabled)) {
      Alert.alert("At least one visible header", "Keep at least one header visible in the template preview.");
      return;
    }

    setCustomHeaders(nextHeaders);
  }

  function renameHeader(headerId: string, label: string) {
    setCustomHeaders((prev) => prev.map((header) => (header.id === headerId ? { ...header, label } : header)));
  }

  function setHeaderFromOption(headerId: string, label: string) {
    renameHeader(headerId, label);
    setOpenHeaderMenuId(null);
  }

  function moveHeader(headerId: string, direction: -1 | 1) {
    const index = customHeaders.findIndex((header) => header.id === headerId);
    if (index === -1) return;

    const target = index + direction;
    if (target < 0 || target >= customHeaders.length) return;

    const next = [...customHeaders];
    const [picked] = next.splice(index, 1);
    next.splice(target, 0, picked);
    setCustomHeaders(next);
  }

  function updateHeaderOptions(headerId: string, input: string) {
    const normalizedOptions = normalizeOptionList(input);
    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId
          ? {
              ...header,
              options: Array.from(new Set([header.label.trim() || "Header", ...normalizedOptions])),
            }
          : header
      )
    );
  }

  function addOptionToHeader(headerId: string) {
    const raw = (newHeaderOptionInputs[headerId] ?? "").trim();
    if (!raw) return;

    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId
          ? {
              ...header,
              options: Array.from(new Set([...(header.options ?? []), raw])),
            }
          : header
      )
    );

    setNewHeaderOptionInputs((prev) => ({
      ...prev,
      [headerId]: "",
    }));
  }

  function removeHeaderOption(headerId: string, option: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => {
        if (header.id !== headerId) return header;

        const nextOptions = (header.options ?? []).filter((value) => value !== option);
        return {
          ...header,
          options: nextOptions,
        };
      })
    );
  }

  async function saveCurrentTemplate() {
    const trimmedName = templateSaveName.trim();
    if (!trimmedName) {
      Alert.alert("Template name required", "Enter a name before saving the custom template.");
      return;
    }

    const payload = createSavedTemplatePayload(trimmedName, selectedTemplateName, customHeaders);
    const nextTemplates = [
      payload,
      ...savedTemplates.filter((template) => template.name.toLowerCase() !== trimmedName.toLowerCase()),
    ];

    try {
      await persistSavedTemplates(nextTemplates);
      setSelectedSavedTemplateId(payload.id);
      Alert.alert("Template saved", `${payload.name} is ready to load anytime.`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Could not save the custom template.");
    }
  }

  function loadSavedTemplate(templateId: string) {
    const match = savedTemplates.find((template) => template.id === templateId);
    if (!match) return;

    setSelectedSavedTemplateId(match.id);
    setTemplateSaveName(match.name);
    setSelectedTemplateName(match.sourceName || "Custom");
    setCustomHeaders(cloneHeaders(match.headers));
    setOpenHeaderMenuId(null);
    setNewHeaderOptionInputs({});
  }

  async function deleteSavedTemplate(templateId: string) {
    const match = savedTemplates.find((template) => template.id === templateId);
    if (!match) return;

    try {
      const nextTemplates = savedTemplates.filter((template) => template.id !== templateId);
      await persistSavedTemplates(nextTemplates);
      if (selectedSavedTemplateId === templateId) {
        setSelectedSavedTemplateId("");
      }
      Alert.alert("Template deleted", `${match.name} was removed.`);
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Could not delete the saved template.");
    }
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
      const activeOrgId = await resolveOrgId();

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);

      const actorId = auth.user?.id;
      if (!actorId) throw new Error("No authenticated user found.");

      const nextWorkOrderNumber = await fetchNextWorkOrderNumber(activeOrgId);

      const normalizedHeaders = customHeaders.map((header, index) => ({
        ...header,
        label: header.label.trim() || `HEADER ${index + 1}`,
      }));

      const description = buildWorkOrderDescription({
        notes: notes.trim(),
        installation: 0,
        deposit: 0,
        headers: DEFAULT_HEADERS,
        invoiceVisibility: DEFAULT_INVOICE_VISIBILITY,
        selectedTemplateName,
        selectedTemplateLabel: selectedSavedTemplate?.name?.trim() || selectedTemplateName,
        customHeaders: normalizedHeaders,
        gridVisibility: { showQty: true, showAmount: false },
        reviewWorkflow: { status: "draft" },
        assignedTo: selectedAssignee
          ? {
              userId: selectedAssignee.user_id,
              displayName: selectedAssignee.display_name || selectedAssignee.email || "Assigned Tech",
              role: selectedAssignee.role,
            }
          : undefined,
        createdBy: {
          userId: actorId,
          displayName:
            teamMembers.find((member) => member.user_id === actorId)?.display_name ||
            auth.user?.user_metadata?.full_name ||
            auth.user?.email ||
            "Owner",
          role: "owner",
        },
      });

      const insertPayload = {
        org_id: activeOrgId,
        client_id: selectedClientId || null,
        title: trimmedTitle,
        description,
        status: mapWorkOrderStatusForDb(status),
        priority,
        scheduled_date: scheduledDate || null,
        due_date: dueDate || null,
        client_name: trimmedClient || null,
        assigned_to_user_id: assignedUserId || null,
        created_by_user_id: actorId,
        work_order_number: nextWorkOrderNumber,
      };

      const insertRes = await supabase.from("work_orders").insert(insertPayload);

      if (insertRes.error) {
        const errorMessage = String(insertRes.error.message || "");
        const shouldTryRestFallback =
          insertRes.error.code === "PGRST100" ||
          errorMessage.toLowerCase().includes("full join") ||
          errorMessage.toLowerCase().includes("merge-joinable") ||
          errorMessage.toLowerCase().includes("hash-joinable");

        if (shouldTryRestFallback) {
          console.warn("Primary insert hit PostgREST join error. Retrying with REST fallback.");
          await insertWorkOrderViaRest(insertPayload);
        } else {
          throw new Error(insertRes.error.message);
        }
      }

      Alert.alert("Success", `Work order #${nextWorkOrderNumber} created.`);
      router.replace("/workorders");
    } catch (error: any) {
      console.log("CREATE WORK ORDER ERROR:", error);
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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h1}>New Work Order</Text>
                <Text style={styles.sub}>
                  Create the work order, customize the header template, preview it, then assign it to the tech.
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
                  <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
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
                            {[client.phone, client.email, formatClientAddress(client)].filter(Boolean).join(" • ") ||
                              "Saved client"}
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

            <View style={styles.doubleRow}>
              <View style={styles.flexCol}>
                <Text style={styles.label}>Template</Text>
                <View style={styles.pillRow}>
                  {TEMPLATE_DEFINITIONS.map((template) => (
                    <Pill
                      key={template.name}
                      label={template.name}
                      active={selectedTemplateName === template.name}
                      onPress={() => applyTemplate(template.name)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.flexCol}>
                <Text style={styles.label}>Assign Technician</Text>
                <View style={styles.assignCard}>
                  {teamMembers.length === 0 ? (
                    <Text style={styles.helper}>No active team members found yet.</Text>
                  ) : (
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {teamMembers.map((member, index) => {
                        const isActive = assignedUserId === member.user_id;
                        const displayName = member.display_name || member.email || "Team Member";

                        return (
                          <Pressable
                            key={member.user_id}
                            onPress={() => setAssignedUserId(member.user_id)}
                            style={[
                              styles.clientRow,
                              index !== 0 ? styles.clientRowBorder : null,
                              isActive ? styles.clientRowActive : null,
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.clientName}>{displayName}</Text>
                              <Text style={styles.clientMeta}>
                                {[member.role.replaceAll("_", " "), member.email].filter(Boolean).join(" • ")}
                              </Text>
                            </View>
                            {isActive ? <Ionicons name="checkmark-circle" size={18} color={PALETTE.goldDark} /> : null}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.savedTemplatesCard}>
              <View style={styles.savedTemplatesTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateBuilderTitle}>Custom Template Library</Text>
                  <Text style={styles.templateBuilderSub}>
                    Save your current layout, load a saved template, or remove ones you no longer use.
                  </Text>
                </View>
              </View>

              <View style={styles.doubleRow}>
                <View style={styles.savedColumnLeft}>
                  <Text style={styles.headerFieldLabel}>Save current template as</Text>
                  <TextInput
                    value={templateSaveName}
                    onChangeText={setTemplateSaveName}
                    placeholder="Kitchen retrofit template"
                    placeholderTextColor={PALETTE.muted}
                    style={styles.input}
                  />
                </View>

                <View style={styles.savedColumnRight}>
                  <Text style={styles.headerFieldLabel}>Saved templates</Text>
                  <View style={styles.savedTemplatesPicker}>
                    {loadingSavedTemplates ? (
                      <Text style={styles.helper}>Loading saved templates...</Text>
                    ) : savedTemplates.length === 0 ? (
                      <Text style={styles.helper}>No saved templates yet.</Text>
                    ) : (
                      <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {savedTemplates.map((template, index) => {
                          const isActive = selectedSavedTemplateId === template.id;

                          return (
                            <Pressable
                              key={template.id}
                              onPress={() => loadSavedTemplate(template.id)}
                              style={[
                                styles.clientRow,
                                index !== 0 ? styles.clientRowBorder : null,
                                isActive ? styles.clientRowActive : null,
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.clientName}>{template.name}</Text>
                                <Text style={styles.clientMeta}>
                                  {[template.sourceName || "Custom", `${template.headers.length} headers`].join(" • ")}
                                </Text>
                              </View>

                              <Pressable onPress={() => deleteSavedTemplate(template.id)} style={styles.savedDeleteBtn}>
                                <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                              </Pressable>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.savedTemplateActions}>
                <Pressable onPress={saveCurrentTemplate} style={styles.fullGoldBtn}>
                  <Ionicons name="save-outline" size={15} color="#111111" />
                  <Text style={styles.miniGoldBtnText}>Save Template</Text>
                </Pressable>

                {selectedSavedTemplate ? (
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>Loaded: {selectedSavedTemplate.name}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.templateBuilderCard}>
              <View style={styles.templateBuilderTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.templateBuilderTitle}>Header Template Builder</Text>
                  <Text style={styles.templateBuilderSub}>
                    Pick header labels from dropdown options, rename them, reorder them, and preview what the tech will
                    see.
                  </Text>
                </View>

                <View style={styles.templateBuilderActions}>
                  <Pressable onPress={() => applyTemplate(selectedTemplateName)} style={styles.secondaryBtn}>
                    <Ionicons name="refresh-outline" size={15} color={PALETTE.ink} />
                    <Text style={styles.secondaryBtnText}>Reset</Text>
                  </Pressable>

                  <Pressable onPress={addCustomHeader} style={styles.miniGoldBtn}>
                    <Ionicons name="add" size={15} color="#111111" />
                    <Text style={styles.miniGoldBtnText}>Header</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.headerGrid}>
                {customHeaders.map((header, index) => {
                  const optionPool = Array.from(new Set([header.label, ...(header.options ?? [])].filter(Boolean)));
                  const headerOptionInput = newHeaderOptionInputs[header.id] ?? "";

                  return (
                    <View key={header.id} style={styles.headerCard}>
                      <View style={styles.headerCardTop}>
                        <Text style={styles.headerCardIndex}>{index + 1}</Text>
                        <Pressable
                          onPress={() => toggleHeaderEnabled(header.id)}
                          style={[styles.togglePill, header.enabled ? styles.togglePillOn : null]}
                        >
                          <Text style={[styles.togglePillText, header.enabled ? styles.togglePillTextOn : null]}>
                            {header.enabled ? "Visible" : "Hidden"}
                          </Text>
                        </Pressable>
                      </View>

                      <Text style={styles.headerFieldLabel}>Header label</Text>
                      <TextInput
                        value={header.label}
                        onChangeText={(value) => renameHeader(header.id, value)}
                        placeholder="Header"
                        placeholderTextColor={PALETTE.muted}
                        style={styles.input}
                      />

                      <Text style={styles.headerFieldLabel}>Dropdown options</Text>
                      <Pressable
                        onPress={() => setOpenHeaderMenuId((prev) => (prev === header.id ? null : header.id))}
                        style={styles.dropdownField}
                      >
                        <Text style={styles.dropdownFieldText} numberOfLines={1}>
                          {optionPool[0] || "Add options"}
                        </Text>
                        <Ionicons
                          name={openHeaderMenuId === header.id ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={PALETTE.ink}
                        />
                      </Pressable>

                      {openHeaderMenuId === header.id ? (
                        <View style={styles.dropdownMenu}>
                          <View style={styles.dropdownAddWrap}>
                            <TextInput
                              value={headerOptionInput}
                              onChangeText={(value) =>
                                setNewHeaderOptionInputs((prev) => ({
                                  ...prev,
                                  [header.id]: value,
                                }))
                              }
                              placeholder="Add new option"
                              placeholderTextColor={PALETTE.muted}
                              style={styles.dropdownAddInput}
                              onSubmitEditing={() => addOptionToHeader(header.id)}
                            />
                            <Pressable onPress={() => addOptionToHeader(header.id)} style={styles.dropdownAddBtn}>
                              <Ionicons name="add" size={14} color="#111111" />
                              <Text style={styles.dropdownAddBtnText}>Add</Text>
                            </Pressable>
                          </View>

                          <View style={styles.dropdownDivider} />

                          {optionPool.length === 0 ? (
                            <View style={styles.dropdownEmptyState}>
                              <Text style={styles.dropdownEmptyText}>No options yet.</Text>
                            </View>
                          ) : (
                            optionPool.map((option, optionIndex) => (
                              <View
                                key={`${header.id}-${option}`}
                                style={[styles.dropdownOptionRow, optionIndex === 0 ? styles.dropdownOptionFirst : null]}
                              >
                                <Pressable
                                  onPress={() => setHeaderFromOption(header.id, option)}
                                  style={styles.dropdownOptionMain}
                                >
                                  <Text style={styles.dropdownOptionText}>{option}</Text>
                                </Pressable>

                                {(header.options ?? []).includes(option) ? (
                                  <Pressable
                                    onPress={() => removeHeaderOption(header.id, option)}
                                    style={styles.dropdownOptionDeleteBtn}
                                  >
                                    <Ionicons name="close" size={14} color="#FFFFFF" />
                                  </Pressable>
                                ) : null}
                              </View>
                            ))
                          )}
                        </View>
                      ) : null}

                      <Text style={styles.headerFieldLabel}>Custom dropdown menu options</Text>
                      <TextInput
                        value={formatOptionsInput(header.options)}
                        onChangeText={(value) => updateHeaderOptions(header.id, value)}
                        placeholder="Inside, Outside, Surface, Custom"
                        placeholderTextColor={PALETTE.muted}
                        style={[styles.input, styles.optionsInput]}
                        multiline
                      />

                      <View style={styles.headerActions}>
                        <Pressable onPress={() => moveHeader(header.id, -1)} style={styles.iconBtn}>
                          <Ionicons name="arrow-back" size={14} color={PALETTE.ink} />
                        </Pressable>
                        <Pressable onPress={() => moveHeader(header.id, 1)} style={styles.iconBtn}>
                          <Ionicons name="arrow-forward" size={14} color={PALETTE.ink} />
                        </Pressable>
                        <Pressable onPress={() => removeCustomHeader(header.id)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle}>Template Preview</Text>
                  <Text style={styles.previewSub}>This is the layout the technician starts with after assignment.</Text>
                </View>
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>{selectedTemplateName}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.previewTable}>
                  <View style={styles.previewHeadRow}>
                    <Text style={[styles.previewHeadCell, { width: 58 }]}>INV #</Text>
                    <Text style={[styles.previewHeadCell, { width: 92 }]}>QTY</Text>
                    <Text style={[styles.previewHeadCell, { width: 160 }]}>MEASUREMENT</Text>
                    <Text style={[styles.previewHeadCell, { width: 160 }]}>ITEM / COLOR</Text>
                    {visibleHeaders.map((header) => (
                      <Text key={header.id} style={[styles.previewHeadCell, { width: 130 }]} numberOfLines={1}>
                        {header.label.trim() || "HEADER"}
                      </Text>
                    ))}
                  </View>

                  {previewRows.map((row, index) => (
                    <View key={row.id} style={[styles.previewBodyRow, index % 2 === 0 ? styles.previewStriped : null]}>
                      <Text style={[styles.previewBodyCell, { width: 58 }]}>{index + 1}</Text>
                      <Text style={[styles.previewBodyCell, { width: 92 }]}>1</Text>
                      <Text style={[styles.previewBodyCell, { width: 160 }]}>{row.measurement}</Text>
                      <Text style={[styles.previewBodyCell, { width: 160 }]}>{row.color}</Text>
                      {visibleHeaders.map((header) => (
                        <Text key={`${row.id}-${header.id}`} style={[styles.previewBodyCell, { width: 130 }]} numberOfLines={1}>
                          {row.fields[header.id] || "—"}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
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

              <Pressable
                onPress={() => {
                  void createWorkOrder();
                }}
                disabled={saving}
                style={[
                  {
                    minWidth: 190,
                    minHeight: 48,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: saving ? "#c9c9c9" : PALETTE.gold,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text
                  style={{
                    color: PALETTE.ink,
                    fontWeight: "900",
                    fontSize: 14,
                  }}
                >
                  {saving ? "Creating..." : "Create Work Order"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    paddingBottom: 42,
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
    gap: 18,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    color: PALETTE.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  helper: {
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  flexCol: {
    flex: 1,
    gap: 6,
    minWidth: 280,
  },
  doubleRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
  },
  pillActive: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },
  pillText: {
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  pillTextActive: {
    color: PALETTE.ink,
  },
  pressed: {
    opacity: 0.82,
  },
  dateRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dateInput: {
    flex: 1,
  },
  todayBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  todayBtnText: {
    color: PALETTE.goldDark,
    fontWeight: "900",
  },
  clientPicker: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    padding: 8,
  },
  clientRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
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
    fontSize: 14,
  },
  clientMeta: {
    marginTop: 2,
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  assignCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    padding: 8,
    minHeight: 64,
  },
  savedTemplatesCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    padding: 16,
    gap: 14,
  },
  savedTemplatesTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  savedColumnLeft: {
    flex: 1.15,
    gap: 6,
    minWidth: 280,
  },
  savedColumnRight: {
    flex: 1,
    gap: 6,
    minWidth: 280,
  },
  savedTemplatesPicker: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    padding: 8,
    minHeight: 64,
  },
  savedDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PALETTE.red,
    alignItems: "center",
    justifyContent: "center",
  },
  savedTemplateActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  fullGoldBtn: {
    minHeight: 44,
    width: "100%",
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PALETTE.goldBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  templateBuilderCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    padding: 16,
    gap: 14,
  },
  templateBuilderTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  templateBuilderTitle: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 18,
  },
  templateBuilderSub: {
    marginTop: 4,
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  templateBuilderActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  headerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "stretch",
  },
  headerCard: {
    flexGrow: 1,
    flexShrink: 1,
    width: "23.9%",
    minWidth: 255,
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    padding: 14,
    gap: 10,
  },
  headerCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerCardIndex: {
    color: PALETTE.goldDark,
    fontWeight: "900",
    fontSize: 15,
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
  },
  togglePillOn: {
    borderColor: PALETTE.gold,
    backgroundColor: PALETTE.goldSoft,
  },
  togglePillText: {
    color: PALETTE.muted,
    fontWeight: "900",
    fontSize: 11,
  },
  togglePillTextOn: {
    color: PALETTE.ink,
  },
  headerFieldLabel: {
    color: PALETTE.mutedSoft,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  dropdownField: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownFieldText: {
    flex: 1,
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  dropdownMenu: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    overflow: "hidden",
  },
  dropdownAddWrap: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#fffaf0",
  },
  dropdownAddInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 12,
    color: PALETTE.ink,
    fontWeight: "700",
  },
  dropdownAddBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: PALETTE.goldBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dropdownAddBtnText: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 12,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: PALETTE.border,
  },
  dropdownEmptyState: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownEmptyText: {
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  dropdownOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    backgroundColor: PALETTE.card,
  },
  dropdownOptionFirst: {
    borderTopWidth: 0,
  },
  dropdownOptionMain: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownOptionText: {
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  dropdownOptionDeleteBtn: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: PALETTE.red,
    alignItems: "center",
    justifyContent: "center",
  },
  optionsInput: {
    minHeight: 58,
    textAlignVertical: "top",
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: "auto",
    paddingTop: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: PALETTE.red,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    padding: 16,
    gap: 12,
  },
  previewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  previewTitle: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 18,
  },
  previewSub: {
    marginTop: 4,
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: PALETTE.goldSoft,
    borderWidth: 1,
    borderColor: PALETTE.gold,
  },
  previewBadgeText: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 12,
  },
  previewTable: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
  },
  previewHeadRow: {
    flexDirection: "row",
    backgroundColor: "#F3E6BD",
  },
  previewHeadCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 12,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
  },
  previewBodyRow: {
    flexDirection: "row",
  },
  previewStriped: {
    backgroundColor: "#FFFCF3",
  },
  previewBodyCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: PALETTE.ink,
    fontWeight: "700",
    fontSize: 12,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderRightColor: PALETTE.border,
    borderTopColor: PALETTE.border,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: {
    color: PALETTE.ink,
    fontWeight: "900",
  },
  miniGoldBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: PALETTE.goldBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  miniGoldBtnText: {
    color: PALETTE.ink,
    fontWeight: "900",
  },
});