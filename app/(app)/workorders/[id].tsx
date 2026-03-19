import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import Screen from "../../../src/components/Screen";
import GoldButton from "../../../src/components/GoldButton";
import { supabase } from "../../../src/lib/supabase";
import {
  cleanDecimalInput,
  formatCurrencyDisplay,
  formatPercentDisplay,
  formatWorkOrderNumber,
} from "../../../src/lib/format";

type WorkOrder = {
  id: string;
  org_id: string;
  title: string;
  client_name: string | null;
  description: string | null;
  status: string;
  priority: string;
  scheduled_date: string | null;
  due_date: string | null;
  created_at: string;
  work_order_number?: number | null;
};

type Profile = {
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  website: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  default_tax_rate: number | null;
};

type OrgSettings = {
  company_name?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  brand_logo_url?: string | null;
  brand_primary_color?: string | null;
  brand_secondary_color?: string | null;
  brand_accent_color?: string | null;
};

type RowType = "measured" | "labor" | "material";

type RowMeta = {
  notes?: string;
  rowType?: RowType;
  fields?: Record<string, string>;
};

type GridRow = {
  id?: string;
  inventory_number: number;
  sort_order: number;
  row_type: RowType;
  qty: string;
  width_whole: string;
  width_frac: string;
  length_whole: string;
  length_frac: string;
  color: string;
  amount: string;
  extra: Record<string, string>;
};

type InvoiceVisibility = {
  showNotes: boolean;
  showMeasurement: boolean;
  showInstallation: boolean;
  showDeposit: boolean;
  showSignature: boolean;
};

type GridVisibility = {
  showQty: boolean;
  showAmount: boolean;
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

type CustomHeader = {
  id: string;
  label: string;
  enabled: boolean;
  options?: string[];
};

type AssignmentMeta = {
  userId?: string;
  displayName?: string;
  role?: string;
};

type WorkOrderMeta = {
  notes?: string;
  installation?: number;
  deposit?: number;
  tax_rate_override?: number;
  customHeaders?: CustomHeader[];
  selectedTemplateName?: string;
  invoiceVisibility?: Partial<InvoiceVisibility>;
  gridVisibility?: Partial<GridVisibility>;
  reviewWorkflow?: Partial<ReviewWorkflow>;
  assignedTo?: AssignmentMeta;
  createdBy?: AssignmentMeta;
};

type FractionField = "width_frac" | "length_frac";

type FractionPickerState = {
  visible: boolean;
  rowIndex: number;
  field: FractionField | null;
  anchorX: number;
  anchorY: number;
  anchorWidth: number;
};

type RowTypePickerState = {
  visible: boolean;
  rowIndex: number;
};

type HeaderOptionPickerState = {
  visible: boolean;
  rowIndex: number;
  headerId: string | null;
  title: string;
  options: string[];
  anchorX: number;
  anchorY: number;
  anchorWidth: number;
};

const PALETTE = {
  ink: "#111111",
  inkSoft: "#1B1B1B",
  gold: "#D4AF37",
  goldDark: "#B8962E",
  goldSoft: "#F5E6B8",
  bg: "#FAF7F0",
  card: "#FFFFFF",
  cardSoft: "#FFFDF8",
  border: "#E8DFC7",
  borderSoft: "#F1E7D2",
  muted: "#6B6B6B",
  mutedSoft: "#8B7A60",
  blue: "#1976D2",
  green: "#2E7D32",
  red: "#C14343",
};

const FRACTION_OPTIONS = [
  "",
  "1/16",
  "1/8",
  "3/16",
  "1/4",
  "5/16",
  "3/8",
  "7/16",
  "1/2",
  "9/16",
  "5/8",
  "11/16",
  "3/4",
  "13/16",
  "7/8",
  "15/16",
] as const;

type FractionValue = (typeof FRACTION_OPTIONS)[number];

const ROW_TYPE_OPTIONS: { value: RowType; label: string }[] = [
  { value: "measured", label: "Measured" },
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
];

const DEFAULT_INVOICE_VISIBILITY: InvoiceVisibility = {
  showNotes: true,
  showMeasurement: true,
  showInstallation: true,
  showDeposit: true,
  showSignature: true,
};

const DEFAULT_GRID_VISIBILITY: GridVisibility = {
  showQty: true,
  showAmount: true,
};

const DEFAULT_REVIEW_WORKFLOW: ReviewWorkflow = {
  status: "draft",
  note: "",
};

const FINANCIAL_ROLES = [
  "owner",
  "general_manager",
  "operations_manager",
  "project_manager",
  "estimator",
  "accounting_manager",
  "office_admin",
] as const;

const DELETE_ROLES = ["owner", "general_manager", "operations_manager"] as const;
const FIELD_EDIT_ROLES = [
  "owner",
  "general_manager",
  "operations_manager",
  "project_manager",
  "field_supervisor",
  "technician",
] as const;

function hasRole(role: string, allowed: readonly string[]) {
  return allowed.includes(role);
}

const DEFAULT_TEMPLATE_HEADERS: Record<string, CustomHeader[]> = {
  General: [
    { id: "mount", label: "MOUNT", enabled: true, options: ["Inside", "Outside", "Surface", "Recessed"] },
    { id: "val", label: "VAL", enabled: true, options: ["Standard", "Left", "Right", "Center"] },
    { id: "opening", label: "OPENING", enabled: true, options: ["Single", "Double", "Triple", "Custom"] },
    { id: "prod", label: "PROD.", enabled: true, options: ["Standard", "Premium", "Custom", "Owner Supplied"] },
  ],
  Windows: [
    { id: "mount", label: "MOUNT", enabled: true, options: ["Inside", "Outside", "Flush Fin", "Block Frame"] },
    { id: "val", label: "STYLE", enabled: true, options: ["Single Hung", "Double Hung", "Slider", "Picture"] },
    { id: "opening", label: "OPENING", enabled: true, options: ["XO", "OX", "XOX", "Fixed"] },
    { id: "prod", label: "SERIES", enabled: true, options: ["Builder", "Premium", "Impact", "Custom"] },
  ],
  Doors: [
    { id: "mount", label: "SWING", enabled: true, options: ["In Swing", "Out Swing", "Left Hand", "Right Hand"] },
    { id: "val", label: "HINGE", enabled: true, options: ["Left", "Right", "Center", "Pivot"] },
    { id: "opening", label: "OPENING", enabled: true, options: ["Single", "French", "Slider", "Patio"] },
    { id: "prod", label: "MODEL", enabled: true, options: ["Fiberglass", "Steel", "Wood", "Custom"] },
  ],
  Flooring: [
    { id: "mount", label: "INSTALL", enabled: true, options: ["Glue", "Float", "Nail", "Tile"] },
    { id: "val", label: "GRADE", enabled: true, options: ["Builder", "Premium", "Commercial", "Waterproof"] },
    { id: "opening", label: "AREA", enabled: true, options: ["Kitchen", "Bath", "Living", "Whole Home"] },
    { id: "prod", label: "SKU", enabled: true, options: ["Stock", "Special Order", "Owner Supplied", "Custom"] },
  ],
  Painting: [
    { id: "mount", label: "COAT", enabled: true, options: ["Prime", "1 Coat", "2 Coat", "Touch Up"] },
    { id: "val", label: "SHEEN", enabled: true, options: ["Flat", "Eggshell", "Satin", "Semi-Gloss"] },
    { id: "opening", label: "ROOM", enabled: true, options: ["Kitchen", "Bath", "Bedroom", "Exterior"] },
    { id: "prod", label: "SKU", enabled: true, options: ["Owner Supplied", "Standard", "Premium", "Custom Match"] },
  ],
  Plumbing: [
    { id: "mount", label: "TYPE", enabled: true, options: ["Repair", "Replace", "Rough-In", "Fixture"] },
    { id: "val", label: "SIZE", enabled: true, options: ['1/2"', '3/4"', '1"', "Custom"] },
    { id: "opening", label: "LOCATION", enabled: true, options: ["Kitchen", "Bath", "Laundry", "Exterior"] },
    { id: "prod", label: "MODEL", enabled: true, options: ["Standard", "Moen", "Delta", "Custom"] },
  ],
  Electrical: [
    { id: "mount", label: "AMP", enabled: true, options: ["15A", "20A", "30A", "50A"] },
    { id: "val", label: "VOLT", enabled: true, options: ["120V", "208V", "240V", "277V"] },
    { id: "opening", label: "LOCATION", enabled: true, options: ["Kitchen", "Bath", "Garage", "Panel"] },
    { id: "prod", label: "MODEL", enabled: true, options: ["Standard", "GFCI", "AFCI", "Smart"] },
  ],
  Labor: [
    { id: "crew", label: "CREW", enabled: true, options: ["Crew 1", "Crew 2", "Subcontractor", "Owner"] },
    { id: "hours", label: "HOURS", enabled: true, options: ["1", "2", "4", "8"] },
    { id: "scope", label: "SCOPE", enabled: true, options: ["Install", "Repair", "Demo", "Finish"] },
    { id: "phase", label: "PHASE", enabled: true, options: ["Rough", "Trim", "Punch", "Final"] },
  ],
  Materials: [
    { id: "sku", label: "SKU", enabled: true, options: ["Stock", "Special Order", "Owner Supplied", "Custom"] },
    { id: "vendor", label: "VENDOR", enabled: true, options: ["Lowe's", "Home Depot", "Supply House", "Other"] },
    { id: "category", label: "CATEGORY", enabled: true, options: ["Window", "Door", "Trim", "Hardware"] },
    { id: "location", label: "LOCATION", enabled: true, options: ["Warehouse", "Truck", "Job Site", "Pickup"] },
  ],
};

function cloneHeaders(headers: CustomHeader[]) {
  return headers.map((header) => ({
    ...header,
    options: [...(header.options ?? [])],
  }));
}

function n(v: string) {
  const t = (v ?? "").toString().trim();
  if (!t) return 0;
  const x = Number(t);
  return Number.isFinite(x) ? x : 0;
}

function money(v: number) {
  return `$${v.toFixed(2)}`;
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJsonParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!(t.startsWith("{") || t.startsWith("["))) return null;

  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

function parseRowMeta(description: string | null | undefined) {
  const j = safeJsonParse<RowMeta>(description);
  if (j) {
    return {
      notes: j.notes ?? "",
      rowType: j.rowType ?? "measured",
      fields: j.fields ?? {},
    };
  }

  return {
    notes: (description ?? "").trim(),
    rowType: "measured" as RowType,
    fields: {},
  };
}

function buildRowDescription(meta: RowMeta) {
  const payload: RowMeta = {
    notes: (meta.notes ?? "").trim() || undefined,
    rowType: meta.rowType ?? "measured",
    fields: meta.fields && Object.keys(meta.fields).length ? meta.fields : undefined,
  };

  return JSON.stringify(payload);
}

function parseWorkOrderMeta(description: string | null | undefined): WorkOrderMeta {
  const j = safeJsonParse<WorkOrderMeta>(description);
  if (j) return j;
  return { notes: (description ?? "").trim() || "" };
}

function buildWorkOrderDescription(meta: WorkOrderMeta) {
  const payload: WorkOrderMeta = {
    notes: (meta.notes ?? "").trim() || undefined,
    installation: Number.isFinite(meta.installation as number) ? meta.installation : undefined,
    deposit: Number.isFinite(meta.deposit as number) ? meta.deposit : undefined,
    tax_rate_override: Number.isFinite(meta.tax_rate_override as number) ? meta.tax_rate_override : undefined,
    customHeaders: meta.customHeaders?.length ? meta.customHeaders : undefined,
    selectedTemplateName: meta.selectedTemplateName?.trim() || undefined,
    invoiceVisibility:
      meta.invoiceVisibility && Object.keys(meta.invoiceVisibility).length ? meta.invoiceVisibility : undefined,
    gridVisibility: meta.gridVisibility && Object.keys(meta.gridVisibility).length ? meta.gridVisibility : undefined,
    reviewWorkflow: meta.reviewWorkflow && Object.keys(meta.reviewWorkflow).length ? meta.reviewWorkflow : undefined,
    assignedTo: meta.assignedTo?.userId ? meta.assignedTo : undefined,
    createdBy: meta.createdBy?.userId ? meta.createdBy : undefined,
  };

  return JSON.stringify(payload);
}

function onlyWholeNumber(raw: string) {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

function fractionToDecimal(frac: string) {
  switch (frac) {
    case "1/16":
      return 0.0625;
    case "1/8":
      return 0.125;
    case "3/16":
      return 0.1875;
    case "1/4":
      return 0.25;
    case "5/16":
      return 0.3125;
    case "3/8":
      return 0.375;
    case "7/16":
      return 0.4375;
    case "1/2":
      return 0.5;
    case "9/16":
      return 0.5625;
    case "5/8":
      return 0.625;
    case "11/16":
      return 0.6875;
    case "3/4":
      return 0.75;
    case "13/16":
      return 0.8125;
    case "7/8":
      return 0.875;
    case "15/16":
      return 0.9375;
    default:
      return 0;
  }
}

function measurementToSortableValue(row: GridRow) {
  if (row.row_type !== "measured") return 0;
  const width = n(row.width_whole) + fractionToDecimal(row.width_frac);
  const length = n(row.length_whole) + fractionToDecimal(row.length_frac);
  return width * 10000 + length;
}

function formatMeasurementParts(whole: string, frac: string) {
  const w = (whole ?? "").trim();
  const f = (frac ?? "").trim();
  if (!w && !f) return "";
  if (w && f) return `${w} ${f}`;
  return w || f;
}

function formatMeasurement(row: GridRow) {
  if (row.row_type !== "measured") return "";
  const left = formatMeasurementParts(row.width_whole, row.width_frac);
  const right = formatMeasurementParts(row.length_whole, row.length_frac);
  if (!left && !right) return "";
  if (left && right) return `${left} x ${right}`;
  return left || right;
}

function parseMeasurement(raw: string | null | undefined) {
  const text = (raw ?? "").trim();

  if (!text) {
    return {
      width_whole: "",
      width_frac: "",
      length_whole: "",
      length_frac: "",
    };
  }

  const normalized = text.replace(/×/g, "x").replace(/\s+/g, " ").trim();
  const parts = normalized.split(/\s*x\s*/i);

  const parseSide = (side: string | undefined) => {
    const clean = (side ?? "").trim();
    if (!clean) return { whole: "", frac: "" as FractionValue };

    const fractionMatch = clean.match(
      /(1\/16|1\/8|3\/16|1\/4|5\/16|3\/8|7\/16|1\/2|9\/16|5\/8|11\/16|3\/4|13\/16|7\/8|15\/16)/
    );
    const frac = (fractionMatch?.[1] ?? "") as FractionValue;
    const wholeMatch = clean.match(/\d+/);
    const whole = wholeMatch?.[0] ?? "";

    return { whole, frac };
  };

  const left = parseSide(parts[0]);
  const right = parseSide(parts[1]);

  return {
    width_whole: left.whole,
    width_frac: left.frac,
    length_whole: right.whole,
    length_frac: right.frac,
  };
}

function downloadWebFile(filename: string, content: string, mimeType: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function csvEscape(value: string | number | null | undefined) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowTypeLabel(value: RowType) {
  return ROW_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Measured";
}

function reviewStatusLabel(value: ReviewStatus) {
  switch (value) {
    case "submitted_for_review":
      return "Submitted for Review";
    case "in_review":
      return "In Review";
    case "priced":
      return "Pricing Complete";
    default:
      return "Draft";
  }
}

function rowLineTotal(row: GridRow) {
  if (row.row_type === "measured") {
    return n(row.qty || "1") * n(row.amount || "1");
  }
  return n(row.amount || "0");
}

export default function WorkOrderDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);

  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("viewer");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const [woMeta, setWoMeta] = useState<WorkOrderMeta>({
    notes: "",
    installation: 0,
    deposit: 0,
    gridVisibility: DEFAULT_GRID_VISIBILITY,
    reviewWorkflow: DEFAULT_REVIEW_WORKFLOW,
  });

  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>(cloneHeaders(DEFAULT_TEMPLATE_HEADERS.General));
  const [selectedTemplateName, setSelectedTemplateName] = useState("General");

  const [sortKey, setSortKey] = useState<
    "sort_order" | "inventory_number" | "row_type" | "qty" | "measurement" | "color" | "amount" | string
  >("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fractionPicker, setFractionPicker] = useState<FractionPickerState>({
    visible: false,
    rowIndex: -1,
    field: null,
    anchorX: 0,
    anchorY: 0,
    anchorWidth: 0,
  });
  const [rowTypePicker, setRowTypePicker] = useState<RowTypePickerState>({
    visible: false,
    rowIndex: -1,
  });
  const [headerOptionPicker, setHeaderOptionPicker] = useState<HeaderOptionPickerState>({
    visible: false,
    rowIndex: -1,
    headerId: null,
    title: "",
    options: [],
    anchorX: 0,
    anchorY: 0,
    anchorWidth: 0,
  });
  const [lastCombinedRows, setLastCombinedRows] = useState<GridRow[] | null>(null);

  const fractionAnchorRefs = useRef<Record<string, View | null>>({});
  const headerOptionAnchorRefs = useRef<Record<string, View | null>>({});

  const invoiceVisibility = useMemo<InvoiceVisibility>(
    () => ({ ...DEFAULT_INVOICE_VISIBILITY, ...(woMeta.invoiceVisibility ?? {}) }),
    [woMeta.invoiceVisibility]
  );

  const gridVisibility = useMemo<GridVisibility>(
    () => ({ ...DEFAULT_GRID_VISIBILITY, ...(woMeta.gridVisibility ?? {}) }),
    [woMeta.gridVisibility]
  );

  const reviewWorkflow = useMemo<ReviewWorkflow>(
    () => ({ ...DEFAULT_REVIEW_WORKFLOW, ...(woMeta.reviewWorkflow ?? {}) }),
    [woMeta.reviewWorkflow]
  );

  const visibleCustomHeaders = useMemo(() => customHeaders.filter((header) => header.enabled), [customHeaders]);

  const taxRate = useMemo(() => {
    const override = woMeta.tax_rate_override;
    if (typeof override === "number" && Number.isFinite(override)) return override;
    return profile?.default_tax_rate ?? 0;
  }, [profile?.default_tax_rate, woMeta.tax_rate_override]);

  const actorName = useMemo(() => {
    return profile?.full_name?.trim() || profile?.company_name?.trim() || "Team Member";
  }, [profile?.company_name, profile?.full_name]);

  const assignedToUserId = woMeta.assignedTo?.userId ?? "";
  const assignedToLabel = woMeta.assignedTo?.displayName?.trim() || "Unassigned";
  const assignedToMe = !!currentUserId && assignedToUserId === currentUserId;
  const canViewFinancials = hasRole(currentUserRole, FINANCIAL_ROLES);
  const canDeleteWorkOrder = hasRole(currentUserRole, DELETE_ROLES);
  const canManageReview = canViewFinancials;
  const canEditFieldRows =
    (assignedToMe && reviewWorkflow.status === "draft") ||
    (hasRole(currentUserRole, FIELD_EDIT_ROLES) && canManageReview);
  const canEditFinancials = canViewFinancials && reviewWorkflow.status !== "submitted_for_review";
  const canConvertToInvoice = canViewFinancials && reviewWorkflow.status === "priced";
  const effectiveShowAmount = canViewFinancials ? gridVisibility.showAmount : false;

  useEffect(() => {
    void loadAll();
  }, [id]);

  function renumberRows(nextRows: GridRow[]) {
    return nextRows.map((row, index) => ({
      ...row,
      inventory_number: index + 1,
      sort_order: index,
    }));
  }

  function blankRow(sort: number, rowType: RowType = "measured"): GridRow {
    const extra: Record<string, string> = {};
    customHeaders.forEach((header) => {
      extra[header.id] = "";
    });

    return {
      inventory_number: sort + 1,
      sort_order: sort,
      row_type: rowType,
      qty: rowType === "measured" ? "1" : "",
      width_whole: "",
      width_frac: "",
      length_whole: "",
      length_frac: "",
      color: "",
      amount: "",
      extra,
    };
  }

  function ensureRowExtras(nextRows: GridRow[], headers: CustomHeader[]) {
    return nextRows.map((row, index) => {
      const nextExtra = { ...(row.extra ?? {}) };

      headers.forEach((header) => {
        if (typeof nextExtra[header.id] !== "string") nextExtra[header.id] = "";
      });

      Object.keys(nextExtra).forEach((key) => {
        if (!headers.some((header) => header.id === key)) delete nextExtra[key];
      });

      return {
        ...row,
        inventory_number: row.inventory_number || index + 1,
        sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
        row_type: row.row_type ?? "measured",
        qty: row.row_type === "measured" ? row.qty || "1" : "",
        extra: nextExtra,
      };
    });
  }

  async function loadAll() {
    if (!id) return;

    try {
      const woRes = await supabase
        .from("work_orders")
        .select(
          "id, org_id, title, client_name, description, status, priority, scheduled_date, due_date, created_at, work_order_number"
        )
        .eq("id", id)
        .maybeSingle();

      if (woRes.error) throw new Error(woRes.error.message);

      const woRow = (woRes.data as WorkOrder) ?? null;
      setWo(woRow);

      let loadedHeaders = cloneHeaders(DEFAULT_TEMPLATE_HEADERS.General);
      let loadedTemplateName = "General";
      let loadedGridVisibility: GridVisibility = DEFAULT_GRID_VISIBILITY;
      let loadedReviewWorkflow: ReviewWorkflow = DEFAULT_REVIEW_WORKFLOW;

      if (woRow?.description) {
        const meta = parseWorkOrderMeta(woRow.description);
        setWoMeta({
          notes: meta.notes ?? "",
          installation: typeof meta.installation === "number" ? meta.installation : 0,
          deposit: typeof meta.deposit === "number" ? meta.deposit : 0,
          tax_rate_override: typeof meta.tax_rate_override === "number" ? meta.tax_rate_override : undefined,
          customHeaders: meta.customHeaders ?? undefined,
          selectedTemplateName: meta.selectedTemplateName ?? undefined,
          invoiceVisibility: meta.invoiceVisibility ?? undefined,
          gridVisibility: meta.gridVisibility ?? DEFAULT_GRID_VISIBILITY,
          reviewWorkflow: meta.reviewWorkflow ?? DEFAULT_REVIEW_WORKFLOW,
          assignedTo: meta.assignedTo ?? undefined,
          createdBy: meta.createdBy ?? undefined,
        });

        if (meta.selectedTemplateName?.trim()) {
          loadedTemplateName = meta.selectedTemplateName.trim();
        }

        if (meta.customHeaders?.length) {
          loadedHeaders = cloneHeaders(meta.customHeaders);
        } else if (DEFAULT_TEMPLATE_HEADERS[loadedTemplateName]) {
          loadedHeaders = cloneHeaders(DEFAULT_TEMPLATE_HEADERS[loadedTemplateName]);
        }

        loadedGridVisibility = { ...DEFAULT_GRID_VISIBILITY, ...(meta.gridVisibility ?? {}) };
        loadedReviewWorkflow = { ...DEFAULT_REVIEW_WORKFLOW, ...(meta.reviewWorkflow ?? {}) };
      } else {
        setWoMeta({
          notes: "",
          installation: 0,
          deposit: 0,
          gridVisibility: DEFAULT_GRID_VISIBILITY,
          reviewWorkflow: DEFAULT_REVIEW_WORKFLOW,
          assignedTo: undefined,
          createdBy: undefined,
        });
      }

      setSelectedTemplateName(loadedTemplateName);
      setCustomHeaders(loadedHeaders);

      const itemsRes = await supabase
        .from("work_order_items")
        .select("id, sort_order, qty, unit, item, description, unit_price")
        .eq("work_order_id", id)
        .order("sort_order", { ascending: true })
        .limit(500);

      if (itemsRes.error) throw new Error(itemsRes.error.message);

      const grid: GridRow[] = (itemsRes.data ?? []).map((r: any, index: number) => {
        const meta = parseRowMeta(r.description);
        const measurement = parseMeasurement(r.unit);
        const fields = { ...(meta.fields ?? {}) };

        loadedHeaders.forEach((header) => {
          if (typeof fields[header.id] !== "string") fields[header.id] = "";
        });

        return {
          id: r.id,
          inventory_number: index + 1,
          sort_order: r.sort_order ?? index,
          row_type: meta.rowType ?? "measured",
          qty: (meta.rowType ?? "measured") === "measured" ? r.qty?.toString?.() ?? "1" : "",
          width_whole: measurement.width_whole,
          width_frac: measurement.width_frac,
          length_whole: measurement.length_whole,
          length_frac: measurement.length_frac,
          color: r.item ?? "",
          amount: r.unit_price?.toString?.() ?? "",
          extra: fields,
        };
      });

      setRows(grid.length ? renumberRows(ensureRowExtras(grid, loadedHeaders)) : [blankRow(0)]);
      setLastCombinedRows(null);

      setWoMeta((prev) => ({
        ...prev,
        gridVisibility: loadedGridVisibility,
        reviewWorkflow: loadedReviewWorkflow,
      }));

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      setCurrentUserId(userId ?? "");

      if (userId) {
        const pRes = await supabase
          .from("profiles")
          .select("full_name, company_name, phone, website, address1, address2, city, state, zip, default_tax_rate")
          .eq("user_id", userId)
          .maybeSingle();

        if (!pRes.error) setProfile((pRes.data as Profile) ?? null);

        if (woRow?.org_id) {
          const memberRes = await supabase
            .from("org_members")
            .select("role")
            .eq("org_id", woRow.org_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (!memberRes.error) {
            setCurrentUserRole(String(memberRes.data?.role ?? "viewer"));
          }
        }
      }

      if (woRow?.org_id) {
        const orgRes = await supabase
          .from("organization_settings")
          .select(
            "company_name, phone, website, email, address1, address2, city, state, zip, brand_logo_url, brand_primary_color, brand_secondary_color, brand_accent_color"
          )
          .eq("org_id", woRow.org_id)
          .maybeSingle();

        if (!orgRes.error) setOrgSettings((orgRes.data as OrgSettings) ?? null);
      }
    } catch (error: any) {
      Alert.alert("Load failed", error?.message ?? "Failed to load work order.");
    }
  }

  function setCellByIndex(idx: number, key: keyof GridRow, value: string | number | undefined) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }

  function setExtraCellByIndex(idx: number, headerId: string, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        extra: {
          ...(next[idx].extra ?? {}),
          [headerId]: value,
        },
      };
      return next;
    });
  }

  function setRowTypeByIndex(idx: number, value: RowType) {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        row_type: value,
        qty: value === "measured" ? next[idx].qty || "1" : "",
        width_whole: value === "measured" ? next[idx].width_whole : "",
        width_frac: value === "measured" ? next[idx].width_frac : "",
        length_whole: value === "measured" ? next[idx].length_whole : "",
        length_frac: value === "measured" ? next[idx].length_frac : "",
      };
      return next;
    });
  }

  function openFractionPicker(rowIndex: number, field: FractionField) {
    const refKey = `${rowIndex}-${field}`;
    const ref = fractionAnchorRefs.current[refKey];

    if (!ref || Platform.OS !== "web") {
      setFractionPicker({
        visible: true,
        rowIndex,
        field,
        anchorX: 0,
        anchorY: 0,
        anchorWidth: 120,
      });
      return;
    }

    try {
      ref.measureInWindow((x, y, width, height) => {
        setFractionPicker({
          visible: true,
          rowIndex,
          field,
          anchorX: x,
          anchorY: y + height + 4,
          anchorWidth: width,
        });
      });
    } catch {
      setFractionPicker({
        visible: true,
        rowIndex,
        field,
        anchorX: 0,
        anchorY: 0,
        anchorWidth: 120,
      });
    }
  }

  function closeFractionPicker() {
    setFractionPicker({
      visible: false,
      rowIndex: -1,
      field: null,
      anchorX: 0,
      anchorY: 0,
      anchorWidth: 0,
    });
  }

  function selectFraction(value: FractionValue) {
    if (fractionPicker.field && fractionPicker.rowIndex >= 0) {
      setCellByIndex(fractionPicker.rowIndex, fractionPicker.field, value);
    }
    closeFractionPicker();
  }

  function openHeaderOptionPicker(rowIndex: number, header: CustomHeader) {
    const normalizedOptions = Array.from(
      new Set(["", header.label.trim(), ...(header.options ?? [])].map((option) => option.trim()))
    ).filter((option, index) => option !== "" || index === 0);

    const refKey = `${rowIndex}-${header.id}`;
    const ref = headerOptionAnchorRefs.current[refKey];

    if (!ref || Platform.OS !== "web") {
      setHeaderOptionPicker({
        visible: true,
        rowIndex,
        headerId: header.id,
        title: header.label,
        options: normalizedOptions,
        anchorX: 0,
        anchorY: 0,
        anchorWidth: 140,
      });
      return;
    }

    try {
      ref.measureInWindow((x, y, width, height) => {
        setHeaderOptionPicker({
          visible: true,
          rowIndex,
          headerId: header.id,
          title: header.label,
          options: normalizedOptions,
          anchorX: x,
          anchorY: y + height + 4,
          anchorWidth: width,
        });
      });
    } catch {
      setHeaderOptionPicker({
        visible: true,
        rowIndex,
        headerId: header.id,
        title: header.label,
        options: normalizedOptions,
        anchorX: 0,
        anchorY: 0,
        anchorWidth: 140,
      });
    }
  }

  function closeHeaderOptionPicker() {
    setHeaderOptionPicker({
      visible: false,
      rowIndex: -1,
      headerId: null,
      title: "",
      options: [],
      anchorX: 0,
      anchorY: 0,
      anchorWidth: 0,
    });
  }

  function selectHeaderOption(value: string) {
    if (headerOptionPicker.rowIndex >= 0 && headerOptionPicker.headerId) {
      setExtraCellByIndex(headerOptionPicker.rowIndex, headerOptionPicker.headerId, value);
    }
    closeHeaderOptionPicker();
  }

  function addRow(rowType: RowType = "measured") {
    setRows((prev) => renumberRows([...prev, blankRow(prev.length, rowType)]));
    setLastCombinedRows(null);
  }

  function duplicateRow(idx: number) {
    setRows((prev) => {
      const src = prev[idx];
      const copy: GridRow = {
        ...src,
        id: undefined,
        inventory_number: prev.length + 1,
        sort_order: prev.length,
        qty: src.row_type === "measured" ? src.qty : "",
        extra: { ...(src.extra ?? {}) },
      };
      return renumberRows([...prev, copy]);
    });
    setLastCombinedRows(null);
  }

  function deleteRow(idx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? renumberRows(next) : [blankRow(0)];
    });
    setLastCombinedRows(null);
  }

  async function confirmDeleteWorkOrder() {
    if (!wo || deleting) return;

    try {
      setDeleting(true);

      const res = await supabase.rpc("delete_work_order_with_activity", {
        p_work_order_id: wo.id,
      });

      if (res.error) throw new Error(res.error.message);

      setShowDeleteConfirm(false);
      Alert.alert("Deleted", "Work order deleted.");
      router.replace("/workorders");
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Failed to delete work order.");
    } finally {
      setDeleting(false);
    }
  }

  function applyTemplate(name: string) {
    const templateHeaders = DEFAULT_TEMPLATE_HEADERS[name];
    if (!templateHeaders) return;

    const nextHeaders = cloneHeaders(templateHeaders);
    setSelectedTemplateName(name);
    setCustomHeaders(nextHeaders);
    setRows((prev) => ensureRowExtras(prev, nextHeaders));
    setWoMeta((prev) => ({
      ...prev,
      selectedTemplateName: name,
      customHeaders: nextHeaders,
    }));
    setShowTemplateMenu(false);
  }

  function combineDuplicateMeasurements() {
    const sourceRows = rows.map((row) => ({
      ...row,
      extra: { ...(row.extra ?? {}) },
    }));

    const map = new Map<string, GridRow>();

    for (const row of sourceRows) {
      const customParts = visibleCustomHeaders.map((header) => (row.extra?.[header.id] ?? "").trim().toLowerCase());

      const key = [
        row.row_type,
        row.row_type === "measured" ? (row.width_whole ?? "").trim().toLowerCase() : "",
        row.row_type === "measured" ? (row.width_frac ?? "").trim().toLowerCase() : "",
        row.row_type === "measured" ? (row.length_whole ?? "").trim().toLowerCase() : "",
        row.row_type === "measured" ? (row.length_frac ?? "").trim().toLowerCase() : "",
        (row.color ?? "").trim().toLowerCase(),
        (row.amount ?? "").trim().toLowerCase(),
        ...customParts,
      ].join("|");

      if (!key.replaceAll("|", "")) continue;

      const existing = map.get(key);
      if (existing) {
        if (row.row_type === "measured") {
          existing.qty = String(n(existing.qty) + n(row.qty));
        }
      } else {
        map.set(key, {
          ...row,
          id: undefined,
          extra: { ...(row.extra ?? {}) },
        });
      }
    }

    const merged = renumberRows(Array.from(map.values()));
    setLastCombinedRows(sourceRows);
    setRows(merged.length ? merged : [blankRow(0)]);
  }

  function undoCombineDuplicates() {
    if (!lastCombinedRows?.length) return;
    setRows(renumberRows(lastCombinedRows.map((row) => ({ ...row, extra: { ...(row.extra ?? {}) } }))));
    setLastCombinedRows(null);
  }

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(k);
    setSortDir("asc");
  }

  function setInvoiceVisibility(key: keyof InvoiceVisibility, value: boolean) {
    setWoMeta((prev) => ({
      ...prev,
      invoiceVisibility: {
        ...(prev.invoiceVisibility ?? {}),
        [key]: value,
      },
    }));
  }

  function setGridVisibility(key: keyof GridVisibility, value: boolean) {
    setWoMeta((prev) => ({
      ...prev,
      gridVisibility: {
        ...(prev.gridVisibility ?? {}),
        [key]: value,
      },
    }));
  }

  function setReviewWorkflow(next: Partial<ReviewWorkflow>) {
    setWoMeta((prev) => ({
      ...prev,
      reviewWorkflow: {
        ...(prev.reviewWorkflow ?? {}),
        ...next,
      },
    }));
  }

  function submitForReview() {
    if (!assignedToMe && !canManageReview) {
      Alert.alert("Access denied", "Only the assigned technician can submit this work order for review.");
      return;
    }

    const now = new Date().toISOString();
    setReviewWorkflow({
      status: "submitted_for_review",
      submittedAt: now,
      submittedBy: actorName,
      reviewStartedAt: undefined,
      reviewStartedBy: undefined,
      completedAt: undefined,
      completedBy: undefined,
    });
  }

  function startPricingReview() {
    if (!canManageReview) {
      Alert.alert("Access denied", "Only managers can start pricing review.");
      return;
    }

    const now = new Date().toISOString();
    setReviewWorkflow({
      status: "in_review",
      reviewStartedAt: now,
      reviewStartedBy: actorName,
      completedAt: undefined,
      completedBy: undefined,
    });
  }

  function markPricingComplete() {
    if (!canManageReview) {
      Alert.alert("Access denied", "Only managers can complete pricing.");
      return;
    }

    const now = new Date().toISOString();
    setReviewWorkflow({
      status: "priced",
      completedAt: now,
      completedBy: actorName,
    });
  }

  function returnToDraft() {
    if (!canManageReview) {
      Alert.alert("Access denied", "Only managers can return this work order to draft.");
      return;
    }

    setReviewWorkflow({
      status: "draft",
      submittedAt: undefined,
      submittedBy: undefined,
      reviewStartedAt: undefined,
      reviewStartedBy: undefined,
      completedAt: undefined,
      completedBy: undefined,
    });
  }

  const viewRows = useMemo(() => {
    if (sortKey === "sort_order") return rows;

    const dir = sortDir === "asc" ? 1 : -1;

    const toCmp = (row: GridRow) => {
      if (sortKey === "measurement") return measurementToSortableValue(row);
      if (sortKey === "qty") return row.row_type === "measured" ? n(String(row.qty ?? "")) : -1;
      if (sortKey === "amount" || sortKey === "inventory_number") {
        return n(String((row as any)[sortKey] ?? ""));
      }
      if (sortKey === "row_type") return row.row_type;
      if (sortKey === "color") return String(row.color ?? "").toLowerCase();
      return String(row.extra?.[sortKey] ?? "").toLowerCase();
    };

    const withIdx = rows.map((row, idx) => ({ row, idx }));
    withIdx.sort((a, b) => {
      const av = toCmp(a.row);
      const bv = toCmp(b.row);

      if (typeof av === "number" && typeof bv === "number") {
        if (av === bv) return a.idx - b.idx;
        return (av < bv ? -1 : 1) * dir;
      }

      if (av === bv) return a.idx - b.idx;
      return (av < bv ? -1 : 1) * dir;
    });

    return withIdx.map((x) => x.row);
  }, [rows, sortKey, sortDir]);

  const subtotal = useMemo(() => viewRows.reduce((sum, row) => sum + rowLineTotal(row), 0), [viewRows]);
  const tax = useMemo(() => subtotal * (Number(taxRate) / 100), [subtotal, taxRate]);
  const installation = useMemo(() => Number(woMeta.installation ?? 0) || 0, [woMeta.installation]);
  const total = useMemo(() => subtotal + tax + installation, [subtotal, tax, installation]);
  const deposit = useMemo(() => Number(woMeta.deposit ?? 0) || 0, [woMeta.deposit]);
  const balanceDue = useMemo(() => Math.max(0, total - deposit), [total, deposit]);

  async function saveAll() {
    if (!id) return;
    if (!canEditFieldRows && !canManageReview) {
      Alert.alert("Read only", "You do not have permission to edit this work order.");
      return;
    }

    setSaving(true);

    try {
      if (wo) {
        const workOrderUpdateRes = await supabase
          .from("work_orders")
          .update({
            description: buildWorkOrderDescription({
              notes: woMeta.notes ?? "",
              installation,
              deposit,
              tax_rate_override:
                typeof woMeta.tax_rate_override === "number" ? woMeta.tax_rate_override : undefined,
              customHeaders,
              selectedTemplateName,
              invoiceVisibility: woMeta.invoiceVisibility,
              gridVisibility: woMeta.gridVisibility,
              reviewWorkflow: woMeta.reviewWorkflow,
              assignedTo: woMeta.assignedTo,
              createdBy: woMeta.createdBy,
            }),
          })
          .eq("id", wo.id);

        if (workOrderUpdateRes.error) throw new Error(workOrderUpdateRes.error.message);
      }

      const normalizedRows = renumberRows(
        rows.map((row, i) => ({
          ...row,
          sort_order: i,
          qty: row.row_type === "measured" ? (row.qty?.trim() ? row.qty : "1") : "",
          amount: row.amount?.trim() ? row.amount : "",
        }))
      );

      const currentDb = await supabase.from("work_order_items").select("id").eq("work_order_id", id);

      if (currentDb.error) throw new Error(currentDb.error.message);

      const dbIds = (currentDb.data ?? []).map((x: any) => x.id as string);
      const existingRows = normalizedRows.filter((row) => row.id);
      const newRows = normalizedRows.filter((row) => !row.id);
      const existingIds = existingRows.map((row) => row.id as string);
      const toDelete = dbIds.filter((dbId) => !existingIds.includes(dbId));

      if (toDelete.length) {
        const deleteRes = await supabase.from("work_order_items").delete().in("id", toDelete);
        if (deleteRes.error) throw new Error(deleteRes.error.message);
      }

      if (existingRows.length) {
        const updatePayload = existingRows.map((row) => ({
          id: row.id,
          work_order_id: id,
          sort_order: normalizedRows.findIndex((r) => r.inventory_number === row.inventory_number),
          qty: row.row_type === "measured" ? n(row.qty || "1") : 1,
          unit: formatMeasurement(row).trim() || null,
          item: row.color.trim() || null,
          description: buildRowDescription({
            rowType: row.row_type,
            fields: row.extra,
          }),
          unit_price: n(row.amount || "0"),
          taxable: true,
        }));

        const updateRes = await supabase.from("work_order_items").upsert(updatePayload, { onConflict: "id" });

        if (updateRes.error) throw new Error(updateRes.error.message);
      }

      if (newRows.length) {
        const insertPayload = newRows.map((row) => ({
          work_order_id: id,
          sort_order: row.sort_order,
          qty: row.row_type === "measured" ? n(row.qty || "1") : 1,
          unit: formatMeasurement(row).trim() || null,
          item: row.color.trim() || null,
          description: buildRowDescription({
            rowType: row.row_type,
            fields: row.extra,
          }),
          unit_price: n(row.amount || "0"),
          taxable: true,
        }));

        const insertRes = await supabase.from("work_order_items").insert(insertPayload);
        if (insertRes.error) throw new Error(insertRes.error.message);
      }

      const refreshedRes = await supabase
        .from("work_order_items")
        .select("id, sort_order, qty, unit, item, description, unit_price")
        .eq("work_order_id", id)
        .order("sort_order", { ascending: true });

      if (refreshedRes.error) throw new Error(refreshedRes.error.message);

      const refreshed: GridRow[] = (refreshedRes.data ?? []).map((row: any, index: number) => {
        const meta = parseRowMeta(row.description);
        const measurement = parseMeasurement(row.unit);
        const fields = { ...(meta.fields ?? {}) };

        customHeaders.forEach((header) => {
          if (typeof fields[header.id] !== "string") fields[header.id] = "";
        });

        return {
          id: row.id,
          inventory_number: index + 1,
          sort_order: row.sort_order ?? index,
          row_type: meta.rowType ?? "measured",
          qty: (meta.rowType ?? "measured") === "measured" ? row.qty?.toString?.() ?? "1" : "",
          width_whole: measurement.width_whole,
          width_frac: measurement.width_frac,
          length_whole: measurement.length_whole,
          length_frac: measurement.length_frac,
          color: row.item ?? "",
          amount: row.unit_price?.toString?.() ?? "",
          extra: fields,
        };
      });

      setRows(refreshed.length ? renumberRows(ensureRowExtras(refreshed, customHeaders)) : [blankRow(0)]);
      setLastCombinedRows(null);
      Alert.alert("Saved", "Work order updated.");
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save work order.");
    } finally {
      setSaving(false);
    }
  }

  async function convertToInvoice() {
    if (!wo) return;
    if (!canConvertToInvoice) {
      Alert.alert("Pricing incomplete", "Submit pricing through review and mark it complete before converting.");
      return;
    }

    setConverting(true);

    try {
      const invRes = await supabase
        .from("invoices")
        .insert({
          org_id: wo.org_id,
          work_order_id: wo.id,
          status: "draft",
          client_name: wo.client_name ?? null,
          bill_to: wo.client_name ?? null,
          issue_date: new Date().toISOString().slice(0, 10),
          subtotal,
          tax,
          total,
          deposit,
          balance_due: balanceDue,
        })
        .select("id")
        .single();

      if (invRes.error || !invRes.data?.id) {
        throw new Error(invRes.error?.message ?? "Failed to create invoice.");
      }

      const invoiceId = invRes.data.id;

      const itemPayload = rows.map((row, i) => ({
        invoice_id: invoiceId,
        sort_order: i,
        qty: row.row_type === "measured" ? n(row.qty || "1") : 1,
        unit: formatMeasurement(row).trim() || null,
        item: row.color.trim() || null,
        description: buildRowDescription({
          rowType: row.row_type,
          fields: row.extra,
        }),
        unit_price: n(row.amount || "0"),
        taxable: true,
      }));

      if (itemPayload.length) {
        const copyRes = await supabase.from("invoice_items").insert(itemPayload);
        if (copyRes.error) throw new Error(copyRes.error.message);
      }

      Alert.alert("Success", "Invoice created successfully.");
    } catch (error: any) {
      Alert.alert("Convert failed", error?.message ?? "Failed to convert to invoice.");
    } finally {
      setConverting(false);
    }
  }

  function buildPdfHtml() {
    const bizName = orgSettings?.company_name || profile?.company_name || "GSD Grid";
    const bizPhone = orgSettings?.phone || profile?.phone || "";
    const bizWeb = orgSettings?.website || profile?.website || "";
    const brandPrimary = orgSettings?.brand_primary_color || "#111111";
    const brandSecondary = orgSettings?.brand_secondary_color || "#FFFCF6";
    const brandAccent = orgSettings?.brand_accent_color || "#D4AF37";

    const addr = [
      orgSettings?.address1 || profile?.address1,
      orgSettings?.address2 || profile?.address2,
      [orgSettings?.city || profile?.city, orgSettings?.state || profile?.state, orgSettings?.zip || profile?.zip]
        .filter(Boolean)
        .join(", "),
    ]
      .filter(Boolean)
      .join("<br/>");

    const title = wo?.title ?? "Work Order";
    const client = wo?.client_name ?? "—";
    const workOrderLabel = formatWorkOrderNumber(wo?.work_order_number);

    const visibleColumns = [
      { key: "inventory_number", label: "INV #", width: "64px", align: "center" as const },
      { key: "row_type", label: "TYPE", width: "100px", align: "left" as const },
      ...(gridVisibility.showQty
        ? [{ key: "qty", label: "QTY", width: "52px", align: "center" as const }]
        : []),
      ...(invoiceVisibility.showMeasurement
        ? [{ key: "measurement", label: "MEASUREMENT", width: "140px", align: "left" as const }]
        : []),
      { key: "color", label: "ITEM / SKU", width: "190px", align: "left" as const },
      ...visibleCustomHeaders.map((header) => ({
        key: header.id,
        label: header.label,
        width: "110px",
        align: "left" as const,
      })),
      ...(effectiveShowAmount
        ? [{ key: "amount", label: "AMOUNT", width: "110px", align: "right" as const }]
        : []),
    ];

    const headerHtml = visibleColumns
      .map((col) => {
        const alignStyle =
          col.align === "center" ? "text-align:center;" : col.align === "right" ? "text-align:right;" : "";
        return `<th style="width:${col.width};${alignStyle}">${escapeHtml(col.label)}</th>`;
      })
      .join("");

    const rowsHtml = rows
      .map((row) => {
        const line = rowLineTotal(row);
        const measurementText = row.row_type === "measured" ? formatMeasurement(row) : "—";
        const qtyText = row.row_type === "measured" ? row.qty || "1" : "—";

        const cells: Record<string, string> = {
          inventory_number: `<td style="text-align:center;">${escapeHtml(String(row.inventory_number))}</td>`,
          row_type: `<td>${escapeHtml(rowTypeLabel(row.row_type))}</td>`,
          qty: `<td style="text-align:center;">${escapeHtml(qtyText)}</td>`,
          measurement: `<td>${escapeHtml(measurementText)}</td>`,
          color: `<td>${escapeHtml(row.color)}</td>`,
          amount: `<td style="text-align:right;">${money(line)}</td>`,
        };

        visibleCustomHeaders.forEach((header) => {
          cells[header.id] = `<td>${escapeHtml(row.extra?.[header.id] ?? "")}</td>`;
        });

        return `<tr>${visibleColumns.map((col) => cells[col.key]).join("")}</tr>`;
      })
      .join("");

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color:${brandPrimary}; padding:24px; background:${brandSecondary}; }
    .top { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; }
    .brand { font-weight:800; font-size:18px; color:${brandPrimary}; }
    .muted { color:#6d5a3e; font-size:12px; line-height:1.5; }
    .card { border:1px solid #e6d7b8; border-radius:12px; padding:16px; margin-top:14px; background:#fffdf8; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th, td { border:1px solid #e6d7b8; padding:8px 8px; font-size:12px; vertical-align:top; }
    th { text-align:left; background:${brandAccent}; font-weight:800; }
    .totals { width:340px; margin-left:auto; }
    .totals td { border:none; padding:5px 0; }
    .totals .lbl { color:#6d5a3e; }
    .totals .val { text-align:right; font-weight:800; }
    .sig { display:flex; gap:14px; margin-top:16px; }
    .sig .line { flex:1; border-bottom:1px solid #999; height:22px; }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="brand">${escapeHtml(bizName)}</div>
      <div class="muted">
        ${addr ? addr + "<br/>" : ""}
        ${bizPhone ? escapeHtml(bizPhone) + "<br/>" : ""}
        ${bizWeb ? escapeHtml(bizWeb) : ""}
      </div>
    </div>
    <div style="text-align:right;">
      <div class="brand">WORK ORDER ${workOrderLabel ? escapeHtml(workOrderLabel) : ""}</div>
      <div class="muted">Date: ${new Date().toISOString().slice(0, 10)}</div>
    </div>
  </div>

  <div class="card">
    <div style="font-weight:900; font-size:14px;">${escapeHtml(title)}</div>
    <div class="muted">Client: ${escapeHtml(client)}</div>
    <div class="muted" style="margin-top:6px;">Pricing Workflow: ${escapeHtml(reviewStatusLabel(reviewWorkflow.status))}</div>
    ${invoiceVisibility.showNotes && woMeta.notes ? `<div class="muted" style="margin-top:8px;">${escapeHtml(woMeta.notes)}</div>` : ""}
  </div>

  <div class="card">
    <table>
      <thead>
        <tr>${headerHtml}</tr>
      </thead>
      <tbody>
        ${rowsHtml || `<tr><td colspan="${visibleColumns.length}" class="muted">No items.</td></tr>`}
      </tbody>
    </table>

    <table class="totals">
      <tr><td class="lbl">Sub Total</td><td class="val">${money(subtotal)}</td></tr>
      <tr><td class="lbl">Tax (${Number(taxRate).toFixed(2)}%)</td><td class="val">${money(tax)}</td></tr>
      ${invoiceVisibility.showInstallation ? `<tr><td class="lbl">Installation</td><td class="val">${money(installation)}</td></tr>` : ""}
      <tr><td class="lbl" style="font-weight:900;">Total</td><td class="val" style="font-weight:900;">${money(total)}</td></tr>
      ${invoiceVisibility.showDeposit ? `<tr><td class="lbl">Deposit</td><td class="val">${money(deposit)}</td></tr>` : ""}
      <tr><td class="lbl" style="font-weight:900;">Balance Due</td><td class="val" style="font-weight:900;">${money(balanceDue)}</td></tr>
    </table>

    ${
      invoiceVisibility.showSignature
        ? `
    <div class="sig">
      <div style="flex:2;">
        <div class="muted" style="margin-bottom:6px;">Customer Signature</div>
        <div class="line"></div>
      </div>
      <div style="flex:1;">
        <div class="muted" style="margin-bottom:6px;">Date</div>
        <div class="line"></div>
      </div>
    </div>`
        : ""
    }
  </div>
</body>
</html>
`;
  }

  function buildCsv() {
    const headers = [
      "Work Order",
      "Title",
      "Client",
      "Inventory #",
      "Type",
      ...(gridVisibility.showQty ? ["Qty"] : []),
      "Measurement",
      "Item / SKU",
      ...visibleCustomHeaders.map((header) => header.label),
      ...(effectiveShowAmount ? ["Amount"] : []),
      "Line Total",
      "Pricing Workflow",
    ];

    const lines = viewRows.map((row) => {
      const lineTotal = rowLineTotal(row);
      return [
        formatWorkOrderNumber(wo?.work_order_number),
        wo?.title ?? "",
        wo?.client_name ?? "",
        row.inventory_number,
        rowTypeLabel(row.row_type),
        ...(gridVisibility.showQty ? [row.row_type === "measured" ? row.qty || "1" : ""] : []),
        row.row_type === "measured" ? formatMeasurement(row) : "",
        row.color,
        ...visibleCustomHeaders.map((header) => row.extra?.[header.id] ?? ""),
        ...(effectiveShowAmount ? [row.amount] : []),
        lineTotal.toFixed(2),
        reviewStatusLabel(reviewWorkflow.status),
      ]
        .map(csvEscape)
        .join(",");
    });

    return [headers.map(csvEscape).join(","), ...lines].join("\n");
  }

  async function exportPdf() {
    try {
      const html = buildPdfHtml();

      if (Platform.OS === "web") {
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
        return;
      }

      await Print.printAsync({ html });
    } catch (error: any) {
      Alert.alert("PDF failed", error?.message ?? "Failed to export PDF.");
    }
  }

  function exportWord() {
    try {
      if (Platform.OS !== "web") {
        Alert.alert("Not available", "Word export is currently available on web.");
        return;
      }

      const html = buildPdfHtml();
      const filename = `${
        formatWorkOrderNumber(wo?.work_order_number).replace(/[^a-zA-Z0-9-]/g, "_") || "work-order"
      }.doc`;
      downloadWebFile(filename, html, "application/msword");
      setShowExportMenu(false);
    } catch (error: any) {
      Alert.alert("Word export failed", error?.message ?? "Failed to export Word document.");
    }
  }

  function exportExcel() {
    try {
      if (Platform.OS !== "web") {
        Alert.alert("Not available", "Excel export is currently available on web.");
        return;
      }

      const csv = buildCsv();
      const filename = `${
        formatWorkOrderNumber(wo?.work_order_number).replace(/[^a-zA-Z0-9-]/g, "_") || "work-order"
      }.csv`;
      downloadWebFile(filename, csv, "text/csv;charset=utf-8;");
      setShowExportMenu(false);
    } catch (error: any) {
      Alert.alert("Excel export failed", error?.message ?? "Failed to export Excel file.");
    }
  }

  const headerSortBadge = (k: typeof sortKey) => {
    if (sortKey !== k) return null;
    return <Text style={styles.sortBadge}>{sortDir === "asc" ? "↑" : "↓"}</Text>;
  };

  const FractionSelect = ({
    value,
    onPress,
    anchorKey,
  }: {
    value: string;
    onPress: () => void;
    anchorKey: string;
  }) => (
    <View
      ref={(node) => {
        fractionAnchorRefs.current[anchorKey] = node;
      }}
      collapsable={false}
    >
      <Pressable onPress={onPress} style={styles.fractionDropdownField}>
        <Text style={styles.fractionDropdownText}>{value || ""}</Text>
        <Ionicons name="chevron-down" size={14} color={PALETTE.inkSoft} />
      </Pressable>
    </View>
  );

  const VisibilityToggle = ({
    label,
    value,
    onPress,
  }: {
    label: string;
    value: boolean;
    onPress: () => void;
  }) => (
    <Pressable onPress={onPress} style={[styles.visibilityChip, value ? styles.visibilityChipOn : null]}>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={14} color={value ? "#111" : PALETTE.ink} />
      <Text style={[styles.visibilityChipText, value ? styles.visibilityChipTextOn : null]}>{label}</Text>
    </Pressable>
  );

  const renderStaticHeader = (
    key: "inventory_number" | "row_type" | "qty" | "measurement" | "color" | "amount",
    label: string,
    flex: number,
    align?: "center" | "flex-end" | "flex-start"
  ) => (
    <Pressable onPress={() => toggleSort(key)} style={[styles.thPress, { flex }, align ? { alignItems: align } : null]}>
      <Text style={styles.thText} numberOfLines={1}>
        {label}
      </Text>
      {headerSortBadge(key)}
    </Pressable>
  );

  const fractionMenuLeft = fractionPicker.anchorX ? Math.max(12, fractionPicker.anchorX) : undefined;
  const fractionMenuTop = fractionPicker.anchorY ? Math.max(80, fractionPicker.anchorY) : undefined;
  const headerOptionMenuLeft = headerOptionPicker.anchorX ? Math.max(12, headerOptionPicker.anchorX) : undefined;
  const headerOptionMenuTop = headerOptionPicker.anchorY ? Math.max(80, headerOptionPicker.anchorY) : undefined;

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={PALETTE.ink} />
            <Text style={styles.backText}>Work Orders</Text>
          </Pressable>

          <View style={styles.topActions}>
            {canManageReview ? (
              <Pressable onPress={() => setShowExportMenu(true)} style={styles.secondaryBtn}>
                <Ionicons name="document-text-outline" size={16} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Export</Text>
              </Pressable>
            ) : null}

            {canManageReview ? (
              <Pressable
                onPress={convertToInvoice}
                style={[styles.secondaryBtn, (!canConvertToInvoice || converting) ? styles.disabledBtn : null]}
                disabled={converting || !canConvertToInvoice}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>{converting ? "Converting..." : "Convert to Invoice"}</Text>
              </Pressable>
            ) : null}

            {canDeleteWorkOrder ? (
              <Pressable
                onPress={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                style={[styles.deletePrimaryBtn, deleting ? styles.disabledBtn : null]}
              >
                <Ionicons name="trash-outline" size={15} color="#fff" />
                <Text style={styles.deletePrimaryBtnText}>{deleting ? "Deleting..." : "Delete"}</Text>
              </Pressable>
            ) : null}

            {canEditFieldRows || canManageReview ? (
              <GoldButton
                label={saving ? "Saving..." : "Save"}
                onPress={saveAll}
                disabled={saving}
                style={{ minWidth: 140 }}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.headerCard}>
          <View style={styles.workOrderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>
                {formatWorkOrderNumber(wo?.work_order_number) !== "—"
                  ? `${formatWorkOrderNumber(wo?.work_order_number)} • `
                  : ""}
                {wo?.title ?? "Work Order"}
              </Text>
              <Text style={styles.sub}>
                {wo?.client_name ? `Client: ${wo.client_name}` : "Client: —"} • Template:{" "}
                {woMeta.selectedTemplateName || "General"} • Assigned: {assignedToLabel}
              </Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Work order notes</Text>
              <TextInput
                value={woMeta.notes ?? ""}
                onChangeText={(v) => setWoMeta((p) => ({ ...p, notes: v }))}
                placeholder="Add job notes, special instructions..."
                placeholderTextColor={PALETTE.muted}
                style={styles.metaInput}
                multiline
              />
            </View>

            {canViewFinancials ? (
              <View style={styles.metaColSmall}>
                <Text style={styles.metaLabel}>Tax %</Text>
                <TextInput
                  value={formatPercentDisplay(
                    String(typeof woMeta.tax_rate_override === "number" ? woMeta.tax_rate_override : taxRate)
                  )}
                  onChangeText={(v) => {
                    const x = formatPercentDisplay(v);
                    setWoMeta((p) => ({ ...p, tax_rate_override: x.trim() ? Number(x) : undefined }));
                  }}
                  placeholder="0"
                  placeholderTextColor={PALETTE.muted}
                  style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                  keyboardType="numeric"
                  editable={canEditFinancials}
                />

                <Text style={[styles.metaLabel, { marginTop: 10 }]}>Installation</Text>
                <TextInput
                  value={formatCurrencyDisplay(String(woMeta.installation ?? 0))}
                  onChangeText={(v) =>
                    setWoMeta((p) => ({ ...p, installation: Number(cleanDecimalInput(v) || "0") }))
                  }
                  placeholder="0.00"
                  placeholderTextColor={PALETTE.muted}
                  style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                  keyboardType="numeric"
                  editable={canEditFinancials}
                />

                <Text style={[styles.metaLabel, { marginTop: 10 }]}>Deposit</Text>
                <TextInput
                  value={formatCurrencyDisplay(String(woMeta.deposit ?? 0))}
                  onChangeText={(v) =>
                    setWoMeta((p) => ({ ...p, deposit: Number(cleanDecimalInput(v) || "0") }))
                  }
                  placeholder="0.00"
                  placeholderTextColor={PALETTE.muted}
                  style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                  keyboardType="numeric"
                  editable={canEditFinancials}
                />
              </View>
            ) : (
              <View style={styles.metaColSmall}>
                <Text style={styles.metaLabel}>Workflow</Text>
                <View style={styles.infoChip}>
                  <Ionicons name="construct-outline" size={14} color={PALETTE.goldDark} />
                  <Text style={styles.infoChipText}>
                    {assignedToMe
                      ? reviewWorkflow.status === "submitted_for_review"
                        ? "Submitted for manager review"
                        : "Complete the template, then submit for review"
                      : "Field-only access"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Pricing review</Text>
              <Text style={styles.sectionSub}>
                Submit the work order for pricing review, complete amounts, then convert to invoice
              </Text>
            </View>

            <View
              style={[
                styles.reviewStatusPill,
                reviewWorkflow.status === "priced"
                  ? styles.reviewStatusPillGreen
                  : reviewWorkflow.status === "in_review"
                    ? styles.reviewStatusPillBlue
                    : reviewWorkflow.status === "submitted_for_review"
                      ? styles.reviewStatusPillGold
                      : null,
              ]}
            >
              <Text
                style={[
                  styles.reviewStatusText,
                  reviewWorkflow.status === "priced"
                    ? styles.reviewStatusTextGreen
                    : reviewWorkflow.status === "in_review"
                      ? styles.reviewStatusTextBlue
                      : reviewWorkflow.status === "submitted_for_review"
                        ? styles.reviewStatusTextGold
                        : null,
                ]}
              >
                {reviewStatusLabel(reviewWorkflow.status)}
              </Text>
            </View>
          </View>

          <View style={styles.reviewActions}>
            {(assignedToMe || canManageReview) && reviewWorkflow.status === "draft" ? (
              <Pressable onPress={submitForReview} style={styles.secondaryBtnSmall}>
                <Ionicons name="send-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Submit for Review</Text>
              </Pressable>
            ) : null}

            {canManageReview && reviewWorkflow.status === "submitted_for_review" ? (
              <Pressable onPress={startPricingReview} style={styles.secondaryBtnSmall}>
                <Ionicons name="create-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Start Review</Text>
              </Pressable>
            ) : null}

            {canManageReview &&
            (reviewWorkflow.status === "in_review" || reviewWorkflow.status === "submitted_for_review") ? (
              <Pressable onPress={markPricingComplete} style={styles.secondaryBtnSmall}>
                <Ionicons name="checkmark-done-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Mark Complete</Text>
              </Pressable>
            ) : null}

            {canManageReview ? (
              <Pressable onPress={returnToDraft} style={styles.secondaryBtnSmall}>
                <Ionicons name="refresh-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Return to Draft</Text>
              </Pressable>
            ) : null}
          </View>

          {canManageReview ? (
            <>
              <Text style={styles.metaLabel}>Review note</Text>
              <TextInput
                value={reviewWorkflow.note ?? ""}
                onChangeText={(v) => setReviewWorkflow({ note: v })}
                placeholder="Add pricing note, review instructions, approval notes..."
                placeholderTextColor={PALETTE.muted}
                style={styles.reviewNoteInput}
                multiline
              />
            </>
          ) : null}

          <View style={styles.reviewMetaGrid}>
            <Text style={styles.reviewMetaText}>
              Submitted:{" "}
              {reviewWorkflow.submittedAt
                ? `${new Date(reviewWorkflow.submittedAt).toLocaleString()} • ${reviewWorkflow.submittedBy ?? "—"}`
                : "—"}
            </Text>
            <Text style={styles.reviewMetaText}>
              In Review:{" "}
              {reviewWorkflow.reviewStartedAt
                ? `${new Date(reviewWorkflow.reviewStartedAt).toLocaleString()} • ${reviewWorkflow.reviewStartedBy ?? "—"}`
                : "—"}
            </Text>
            <Text style={styles.reviewMetaText}>
              Completed:{" "}
              {reviewWorkflow.completedAt
                ? `${new Date(reviewWorkflow.completedAt).toLocaleString()} • ${reviewWorkflow.completedBy ?? "—"}`
                : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.gridCard}>
          <View style={styles.gridToolbar}>
            <View style={styles.gridToolbarLeft}>
              <Text style={styles.sectionTitle}>Grid</Text>
              <Text style={styles.sectionSub}>
                Measured lines, labor, materials, templates, dynamic headers, review-ready pricing
              </Text>
            </View>

            <View style={styles.gridToolbarRight}>
              <View style={styles.templateDropdownWrap}>
                <Text style={styles.inlineLabel}>Header template</Text>
                <Pressable onPress={() => setShowTemplateMenu(true)} style={styles.templateDropdownField}>
                  <Text style={styles.templateDropdownFieldText}>{selectedTemplateName}</Text>
                  <Ionicons name="chevron-down" size={15} color={PALETTE.inkSoft} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => setGridVisibility("showQty", !gridVisibility.showQty)}
                style={styles.secondaryBtnSmall}
              >
                <Ionicons
                  name={gridVisibility.showQty ? "eye-off-outline" : "eye-outline"}
                  size={15}
                  color={PALETTE.ink}
                />
                <Text style={styles.secondaryText}>{gridVisibility.showQty ? "Hide Qty" : "Show Qty"}</Text>
              </Pressable>

              {canViewFinancials ? (
                <Pressable
                  onPress={() => setGridVisibility("showAmount", !gridVisibility.showAmount)}
                  style={styles.secondaryBtnSmall}
                >
                  <Ionicons
                    name={gridVisibility.showAmount ? "eye-off-outline" : "eye-outline"}
                    size={15}
                    color={PALETTE.ink}
                  />
                  <Text style={styles.secondaryText}>
                    {gridVisibility.showAmount ? "Hide Amount" : "Show Amount"}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable onPress={combineDuplicateMeasurements} style={styles.secondaryBtnSmall}>
                <Ionicons name="git-merge-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Combine</Text>
              </Pressable>

              <Pressable
                onPress={undoCombineDuplicates}
                style={[styles.secondaryBtnSmall, !lastCombinedRows?.length ? styles.disabledBtn : null]}
                disabled={!lastCombinedRows?.length}
              >
                <Ionicons name="return-up-back-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Uncombine</Text>
              </Pressable>

              <Pressable onPress={() => (canEditFieldRows ? addRow("measured") : null)} style={styles.addRowBtn}>
                <Ionicons name="add" size={16} color="#111" />
                <Text style={styles.addRowText}>Measured</Text>
              </Pressable>

              <Pressable onPress={() => (canEditFieldRows ? addRow("labor") : null)} style={styles.secondaryBtnSmall}>
                <Ionicons name="hammer-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Labor</Text>
              </Pressable>

              <Pressable
                onPress={() => (canEditFieldRows ? addRow("material") : null)}
                style={styles.secondaryBtnSmall}
              >
                <Ionicons name="cube-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Material</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.tableWrap}>
            <View style={styles.thead}>
              {renderStaticHeader("inventory_number", "INV #", 0.72, "center")}
              {renderStaticHeader("row_type", "TYPE", 1.05)}
              {gridVisibility.showQty ? renderStaticHeader("qty", "QTY", 0.65, "center") : null}
              {renderStaticHeader("measurement", "MEASUREMENT", 2.9)}
              {renderStaticHeader("color", "ITEM / SKU", 2.05)}

              {visibleCustomHeaders.map((header) => (
                <Pressable key={header.id} onPress={() => toggleSort(header.id)} style={[styles.thPress, { flex: 0.95 }]}>
                  <Text style={styles.thText} numberOfLines={1}>
                    {header.label}
                  </Text>
                  {headerSortBadge(header.id)}
                </Pressable>
              ))}

              {effectiveShowAmount ? renderStaticHeader("amount", "AMOUNT", 0.95, "flex-end") : null}

              <View style={[styles.thPress, { width: 88, alignItems: "flex-end" }]}>
                <Text style={styles.thText} numberOfLines={1}>
                  ACTIONS
                </Text>
              </View>
            </View>

            <ScrollView style={styles.rowsScroll}>
              {viewRows.map((row, idx) => {
                const line = rowLineTotal(row);
                const isStriped = idx % 2 === 0;

                return (
                  <Pressable
                    key={row.id ?? `new-${idx}`}
                    style={({ pressed }) => [styles.tr, isStriped ? styles.trStriped : null, pressed ? styles.trPressed : null]}
                  >
                    <View style={styles.inventoryCell}>
                      <Text style={styles.inventoryText}>{row.inventory_number}</Text>
                    </View>

                    <Pressable onPress={() => setRowTypePicker({ visible: true, rowIndex: idx })} style={styles.rowTypeCell}>
                      <Text style={styles.rowTypeCellText}>{rowTypeLabel(row.row_type)}</Text>
                      <Ionicons name="chevron-down" size={12} color={PALETTE.inkSoft} />
                    </Pressable>

                    {gridVisibility.showQty ? (
                      row.row_type === "measured" ? (
                        <TextInput
                          value={row.qty}
                          onChangeText={(v) => setCellByIndex(idx, "qty", onlyWholeNumber(v))}
                          style={[styles.tdInput, styles.qtyCell]}
                          placeholder="1"
                          placeholderTextColor={PALETTE.muted}
                          keyboardType="numeric"
                        />
                      ) : (
                        <View style={[styles.tdInput, styles.qtyCell, styles.qtyHiddenCell]}>
                          <Text style={styles.qtyHiddenText}>—</Text>
                        </View>
                      )
                    ) : null}

                    <View style={styles.measureCell}>
                      {row.row_type === "measured" ? (
                        <View style={styles.measureShell}>
                          <View style={styles.measureSide}>
                            <Text style={styles.measureMiniLabel}>W</Text>
                            <TextInput
                              value={row.width_whole}
                              onChangeText={(v) => setCellByIndex(idx, "width_whole", onlyWholeNumber(v))}
                              style={[styles.measureInput, styles.measureWhole]}
                              placeholder="0"
                              placeholderTextColor={PALETTE.muted}
                              keyboardType="numeric"
                            />
                            <FractionSelect
                              value={row.width_frac}
                              onPress={() => openFractionPicker(idx, "width_frac")}
                              anchorKey={`${idx}-width_frac`}
                            />
                          </View>

                          <View style={styles.measureMidDivider}>
                            <Text style={styles.measureX}>×</Text>
                          </View>

                          <View style={styles.measureSide}>
                            <Text style={styles.measureMiniLabel}>L</Text>
                            <TextInput
                              value={row.length_whole}
                              onChangeText={(v) => setCellByIndex(idx, "length_whole", onlyWholeNumber(v))}
                              style={[styles.measureInput, styles.measureWhole]}
                              placeholder="0"
                              placeholderTextColor={PALETTE.muted}
                              keyboardType="numeric"
                            />
                            <FractionSelect
                              value={row.length_frac}
                              onPress={() => openFractionPicker(idx, "length_frac")}
                              anchorKey={`${idx}-length_frac`}
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.noMeasurementBox}>
                          <Ionicons
                            name={row.row_type === "labor" ? "hammer-outline" : "cube-outline"}
                            size={14}
                            color={PALETTE.mutedSoft}
                          />
                          <Text style={styles.noMeasurementText}>No measurement required</Text>
                        </View>
                      )}
                    </View>

                    <TextInput
                      value={row.color}
                      onChangeText={(v) => setCellByIndex(idx, "color", v)}
                      style={[styles.tdInput, { flex: 2.05 }]}
                      placeholder={
                        row.row_type === "labor"
                          ? "Labor item / service"
                          : row.row_type === "material"
                            ? "Material / item / SKU"
                            : "Color / SKU"
                      }
                      placeholderTextColor={PALETTE.muted}
                    />

                    {visibleCustomHeaders.map((header) => {
                      const hasOptions = (header.options ?? []).length > 0;
                      const currentValue = row.extra?.[header.id] ?? "";

                      if (hasOptions) {
                        return (
                          <View
                            key={`${row.id ?? idx}-${header.id}`}
                            ref={(node) => {
                              headerOptionAnchorRefs.current[`${idx}-${header.id}`] = node;
                            }}
                            collapsable={false}
                            style={{ flex: 0.95 }}
                          >
                            <Pressable
                              onPress={() => openHeaderOptionPicker(idx, header)}
                              style={styles.customSelectCell}
                            >
                              <Text
                                style={[styles.customSelectCellText, !currentValue ? styles.customSelectPlaceholder : null]}
                                numberOfLines={1}
                              >
                                {currentValue || header.label}
                              </Text>
                              <Ionicons name="chevron-down" size={12} color={PALETTE.inkSoft} />
                            </Pressable>
                          </View>
                        );
                      }

                      return (
                        <TextInput
                          key={`${row.id ?? idx}-${header.id}`}
                          value={currentValue}
                          onChangeText={(v) => setExtraCellByIndex(idx, header.id, v)}
                          style={[styles.tdInput, { flex: 0.95 }]}
                          placeholder={header.label}
                          placeholderTextColor={PALETTE.muted}
                        />
                      );
                    })}

                    {effectiveShowAmount ? (
                      <View style={[styles.amountWrap, { flex: 0.95 }]}>
                        <TextInput
                          value={row.amount}
                          onChangeText={(v) => setCellByIndex(idx, "amount", formatCurrencyDisplay(v))}
                          style={[styles.tdInput, styles.amountInput, !canEditFinancials ? styles.readOnlyAmountInput : null]}
                          placeholder={row.row_type === "measured" ? "Unit amount" : "Amount"}
                          placeholderTextColor={PALETTE.muted}
                          keyboardType="numeric"
                          editable={canEditFinancials}
                        />
                        <Text style={styles.lineTotal}>{money(line)}</Text>
                      </View>
                    ) : null}

                    <View style={styles.actionsCell}>
                      <Pressable
                        onPress={() => (canEditFieldRows ? duplicateRow(idx) : null)}
                        style={({ pressed }) => [styles.smallBtn, pressed ? { opacity: 0.85 } : null]}
                      >
                        <Ionicons name="copy-outline" size={15} color={PALETTE.ink} />
                      </Pressable>
                      <Pressable
                        onPress={() => (canEditFieldRows ? deleteRow(idx) : null)}
                        style={({ pressed }) => [styles.smallBtnDanger, pressed ? { opacity: 0.85 } : null]}
                      >
                        <Ionicons name="trash-outline" size={15} color="#fff" />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.gridBottomRow}>
              <View style={{ flex: 1 }} />
              {canViewFinancials ? (
                <View style={styles.totalsBox}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>Sub Total</Text>
                    <Text style={styles.totalVal}>{money(subtotal)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>Tax ({Number(taxRate).toFixed(2)}%)</Text>
                    <Text style={styles.totalVal}>{money(tax)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>Installation</Text>
                    <Text style={styles.totalVal}>{money(installation)}</Text>
                  </View>
                  <View style={[styles.totalRow, { marginTop: 6 }]}>
                    <Text style={[styles.totalLbl, styles.totalStrong]}>Total</Text>
                    <Text style={[styles.totalVal, styles.totalStrongValue]}>{money(total)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>Deposit</Text>
                    <Text style={styles.totalVal}>{money(deposit)}</Text>
                  </View>
                  <View style={[styles.totalRow, { marginTop: 6 }]}>
                    <Text style={[styles.totalLbl, styles.totalStrong]}>Balance Due</Text>
                    <Text style={[styles.totalVal, styles.totalStrongValue]}>{money(balanceDue)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.totalsBox}>
                  <Text style={styles.totalLbl}>Pricing is hidden until manager review.</Text>
                </View>
              )}
            </View>

            {invoiceVisibility.showSignature ? (
              <View style={styles.signatureRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.sigLabel}>Customer Signature</Text>
                  <View style={styles.sigLine} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sigLabel}>Date</Text>
                  <View style={styles.sigLine} />
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.visibilityCard}>
          <Text style={styles.sectionTitle}>Invoice visibility</Text>
          <Text style={styles.sectionSub}>Choose what appears on exports and invoice-style output</Text>

          <View style={styles.visibilityGrid}>
            <VisibilityToggle
              label="Notes"
              value={invoiceVisibility.showNotes}
              onPress={() => setInvoiceVisibility("showNotes", !invoiceVisibility.showNotes)}
            />
            <VisibilityToggle
              label="Measurement"
              value={invoiceVisibility.showMeasurement}
              onPress={() => setInvoiceVisibility("showMeasurement", !invoiceVisibility.showMeasurement)}
            />
            <VisibilityToggle
              label="Installation"
              value={invoiceVisibility.showInstallation}
              onPress={() => setInvoiceVisibility("showInstallation", !invoiceVisibility.showInstallation)}
            />
            <VisibilityToggle
              label="Deposit"
              value={invoiceVisibility.showDeposit}
              onPress={() => setInvoiceVisibility("showDeposit", !invoiceVisibility.showDeposit)}
            />
            <VisibilityToggle
              label="Signature"
              value={invoiceVisibility.showSignature}
              onPress={() => setInvoiceVisibility("showSignature", !invoiceVisibility.showSignature)}
            />
          </View>
        </View>

        <Modal visible={showTemplateMenu} transparent animationType="fade" onRequestClose={() => setShowTemplateMenu(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowTemplateMenu(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Select header template</Text>

              <View style={styles.exportList}>
                {Object.keys(DEFAULT_TEMPLATE_HEADERS).map((name) => {
                  const active = name === selectedTemplateName;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => applyTemplate(name)}
                      style={[styles.templateOption, active ? styles.templateOptionActive : null]}
                    >
                      <Text style={[styles.templateOptionText, active ? styles.templateOptionTextActive : null]}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={() => setShowTemplateMenu(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={rowTypePicker.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setRowTypePicker({ visible: false, rowIndex: -1 })}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setRowTypePicker({ visible: false, rowIndex: -1 })}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Select line type</Text>

              <View style={styles.exportList}>
                {ROW_TYPE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (rowTypePicker.rowIndex >= 0) {
                        setRowTypeByIndex(rowTypePicker.rowIndex, option.value);
                      }
                      setRowTypePicker({ visible: false, rowIndex: -1 });
                    }}
                    style={styles.exportOption}
                  >
                    <Ionicons
                      name={
                        option.value === "measured"
                          ? "resize-outline"
                          : option.value === "labor"
                            ? "hammer-outline"
                            : "cube-outline"
                      }
                      size={16}
                      color={PALETTE.ink}
                    />
                    <Text style={styles.exportOptionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={() => setRowTypePicker({ visible: false, rowIndex: -1 })} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={fractionPicker.visible} transparent animationType="fade" onRequestClose={closeFractionPicker}>
          <Pressable style={styles.dropdownBackdrop} onPress={closeFractionPicker}>
            <View
              style={[
                styles.fractionDropdownMenu,
                fractionMenuLeft !== undefined
                  ? {
                      left: fractionMenuLeft,
                      top: fractionMenuTop,
                      minWidth: Math.max(120, fractionPicker.anchorWidth || 120),
                    }
                  : styles.fractionDropdownMenuCentered,
              ]}
            >
              <ScrollView style={styles.fractionDropdownScroll} nestedScrollEnabled>
                {FRACTION_OPTIONS.map((option) => {
                  const currentValue =
                    fractionPicker.rowIndex >= 0 && fractionPicker.field
                      ? (rows[fractionPicker.rowIndex]?.[fractionPicker.field] as string)
                      : "";

                  const selected = currentValue === option;

                  return (
                    <Pressable
                      key={option || "none"}
                      onPress={() => selectFraction(option)}
                      style={[styles.fractionDropdownOption, selected ? styles.fractionDropdownOptionSelected : null]}
                    >
                      <Text
                        style={[
                          styles.fractionDropdownOptionText,
                          selected ? styles.fractionDropdownOptionTextSelected : null,
                        ]}
                      >
                        {option || " "}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={headerOptionPicker.visible}
          transparent
          animationType="fade"
          onRequestClose={closeHeaderOptionPicker}
        >
          <Pressable style={styles.dropdownBackdrop} onPress={closeHeaderOptionPicker}>
            <View
              style={[
                styles.headerOptionDropdownMenu,
                headerOptionMenuLeft !== undefined
                  ? {
                      left: headerOptionMenuLeft,
                      top: headerOptionMenuTop,
                      minWidth: Math.max(150, headerOptionPicker.anchorWidth || 150),
                    }
                  : styles.headerOptionDropdownMenuCentered,
              ]}
            >
              <View style={styles.headerOptionDropdownHeader}>
                <Text style={styles.headerOptionDropdownTitle}>{headerOptionPicker.title || "Select option"}</Text>
              </View>

              <ScrollView style={styles.fractionDropdownScroll} nestedScrollEnabled>
                <Pressable onPress={() => selectHeaderOption("")} style={styles.headerOptionDropdownAction}>
                  <Ionicons name="close-circle-outline" size={15} color={PALETTE.ink} />
                  <Text style={styles.headerOptionDropdownActionText}>Clear</Text>
                </Pressable>

                {headerOptionPicker.options
                  .filter((option, index) => !(index === 0 && option === ""))
                  .map((option) => {
                    const currentValue =
                      headerOptionPicker.rowIndex >= 0 && headerOptionPicker.headerId
                        ? rows[headerOptionPicker.rowIndex]?.extra?.[headerOptionPicker.headerId] ?? ""
                        : "";
                    const selected = currentValue === option;

                    return (
                      <Pressable
                        key={`${headerOptionPicker.headerId}-${option}`}
                        onPress={() => selectHeaderOption(option)}
                        style={[
                          styles.headerOptionDropdownOption,
                          selected ? styles.headerOptionDropdownOptionSelected : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.headerOptionDropdownOptionText,
                            selected ? styles.headerOptionDropdownOptionTextSelected : null,
                          ]}
                          numberOfLines={1}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDeleteConfirm(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Delete work order</Text>
              <Text style={styles.modalBodyText}>
                This will permanently delete {formatWorkOrderNumber(wo?.work_order_number)}.
              </Text>

              <View style={styles.confirmRow}>
                <Pressable onPress={() => setShowDeleteConfirm(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={confirmDeleteWorkOrder}
                  style={[styles.modalDeleteBtn, deleting ? styles.disabledBtn : null]}
                  disabled={deleting}
                >
                  <Text style={styles.modalDeleteText}>{deleting ? "Deleting..." : "Delete"}</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={showExportMenu} transparent animationType="fade" onRequestClose={() => setShowExportMenu(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowExportMenu(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Export work order</Text>

              <View style={styles.exportList}>
                <Pressable
                  onPress={async () => {
                    setShowExportMenu(false);
                    await exportPdf();
                  }}
                  style={styles.exportOption}
                >
                  <Ionicons name="document-text-outline" size={16} color={PALETTE.ink} />
                  <Text style={styles.exportOptionText}>PDF</Text>
                </Pressable>

                <Pressable onPress={exportWord} style={styles.exportOption}>
                  <Ionicons name="document-outline" size={16} color={PALETTE.ink} />
                  <Text style={styles.exportOptionText}>Word Document</Text>
                </Pressable>

                <Pressable onPress={exportExcel} style={styles.exportOption}>
                  <Ionicons name="grid-outline" size={16} color={PALETTE.ink} />
                  <Text style={styles.exportOptionText}>Excel / CSV</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setShowExportMenu(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  topActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
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
  },

  backText: {
    fontWeight: "900",
    color: PALETTE.ink,
  },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
  },

  secondaryBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
  },

  secondaryText: {
    fontWeight: "900",
    color: PALETTE.ink,
    fontSize: 13,
  },

  deletePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C14343",
    backgroundColor: "#C14343",
  },

  deletePrimaryBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  disabledBtn: {
    opacity: 0.6,
  },

  h1: {
    fontSize: 30,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  sub: {
    marginTop: 4,
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 14,
  },

  headerCard: {
    marginBottom: 12,
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 18,
  },

  reviewCard: {
    marginBottom: 12,
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 18,
  },

  reviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  reviewStatusPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewStatusPillGold: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },

  reviewStatusPillBlue: {
    backgroundColor: "#E8F2FF",
    borderColor: "#9DC7FF",
  },

  reviewStatusPillGreen: {
    backgroundColor: "#EAF7EC",
    borderColor: "#A9D8AF",
  },

  reviewStatusText: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 12.5,
  },

  reviewStatusTextGold: {
    color: PALETTE.goldDark,
  },

  reviewStatusTextBlue: {
    color: PALETTE.blue,
  },

  reviewStatusTextGreen: {
    color: PALETTE.green,
  },

  reviewActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  reviewNoteInput: {
    minHeight: 80,
    marginTop: 6,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 18,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: PALETTE.ink,
    fontWeight: "800",
  },

  reviewMetaGrid: {
    marginTop: 12,
    gap: 6,
  },

  reviewMetaText: {
    color: PALETTE.mutedSoft,
    fontWeight: "700",
    fontSize: 12,
  },

  gridCard: {
    padding: 0,
    overflow: "hidden",
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },

  visibilityCard: {
    marginTop: 12,
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 18,
  },

  gridToolbar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    backgroundColor: "#FBF6EA",
  },

  gridToolbarLeft: {
    minWidth: 180,
    justifyContent: "center",
  },

  gridToolbarRight: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    flexWrap: "wrap",
    flex: 1,
    justifyContent: "flex-end",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  sectionSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.muted,
  },

  templateDropdownWrap: {
    minWidth: 210,
    maxWidth: 260,
  },

  inlineLabel: {
    fontSize: 11.5,
    fontWeight: "900",
    color: PALETTE.mutedSoft,
    marginBottom: 6,
  },

  templateDropdownField: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
  },

  templateDropdownFieldText: {
    flex: 1,
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 13,
  },

  addRowBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.goldDark,
    backgroundColor: PALETTE.gold,
  },

  addRowText: {
    fontWeight: "900",
    color: "#111",
  },

  tableWrap: {
    padding: 12,
  },

  rowsScroll: {
    maxHeight: 420,
  },

  thead: {
    flexDirection: "row",
    backgroundColor: "#FBF6EA",
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },

  thPress: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    minWidth: 0,
  },

  thText: {
    fontWeight: "900",
    color: PALETTE.mutedSoft,
    fontSize: 11.5,
  },

  sortBadge: {
    fontWeight: "900",
    color: PALETTE.mutedSoft,
    fontSize: 11.5,
  },

  tr: {
    flexDirection: "row",
    alignItems: "stretch",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: PALETTE.border,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderSoft,
    backgroundColor: PALETTE.card,
  },

  trStriped: {
    backgroundColor: PALETTE.cardSoft,
  },

  trPressed: {
    opacity: 0.97,
  },

  inventoryCell: {
    flex: 0.72,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    backgroundColor: "#FFF8E5",
    minWidth: 0,
  },

  inventoryText: {
    fontWeight: "900",
    color: PALETTE.goldDark,
    fontSize: 12.5,
  },

  rowTypeCell: {
    flex: 1.05,
    minWidth: 0,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#FFFDF8",
  },

  rowTypeCellText: {
    fontWeight: "800",
    color: PALETTE.ink,
    fontSize: 12,
  },

  tdInput: {
    height: 50,
    paddingHorizontal: 8,
    fontWeight: "800",
    color: PALETTE.ink,
    minWidth: 0,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
  },

  qtyCell: {
    flex: 0.65,
    textAlign: "center",
  },

  qtyHiddenCell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F2E6",
  },

  qtyHiddenText: {
    color: PALETTE.mutedSoft,
    fontWeight: "900",
  },

  measureCell: {
    flex: 2.9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    minWidth: 0,
    justifyContent: "center",
  },

  measureShell: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: "#FFFDF8",
  },

  noMeasurementBox: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: "#FFFDF8",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  noMeasurementText: {
    color: PALETTE.mutedSoft,
    fontWeight: "800",
    fontSize: 12,
  },

  measureSide: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  measureMiniLabel: {
    width: 14,
    fontSize: 10.5,
    fontWeight: "900",
    color: PALETTE.mutedSoft,
    textAlign: "center",
  },

  measureMidDivider: {
    width: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  measureInput: {
    height: 32,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 4,
    backgroundColor: "#FFF7F7",
    color: PALETTE.ink,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  measureWhole: {
    width: 44,
    flexShrink: 0,
  },

  measureX: {
    fontWeight: "900",
    color: PALETTE.goldDark,
    fontSize: 12,
    textAlign: "center",
  },

  fractionDropdownField: {
    minWidth: 82,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#BCBCBC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },

  fractionDropdownText: {
    flex: 1,
    fontWeight: "800",
    color: PALETTE.ink,
    fontSize: 11.5,
  },

  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },

  fractionDropdownMenu: {
    position: "absolute",
    maxHeight: 330,
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "#999999",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 12,
  },

  fractionDropdownMenuCentered: {
    left: 20,
    right: 20,
    top: 120,
  },

  fractionDropdownScroll: {
    maxHeight: 330,
  },

  fractionDropdownOption: {
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E6DADA",
    backgroundColor: "#FFF4F4",
  },

  fractionDropdownOptionSelected: {
    backgroundColor: "#1976D2",
  },

  fractionDropdownOptionText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 13,
  },

  fractionDropdownOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  headerOptionDropdownMenu: {
    position: "absolute",
    maxHeight: 340,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 12,
    overflow: "hidden",
  },

  headerOptionDropdownMenuCentered: {
    left: 20,
    right: 20,
    top: 120,
  },

  headerOptionDropdownHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
  },

  headerOptionDropdownTitle: {
    color: PALETTE.ink,
    fontWeight: "900",
    fontSize: 13,
  },

  headerOptionDropdownAction: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderSoft,
    backgroundColor: PALETTE.cardSoft,
  },

  headerOptionDropdownActionText: {
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 13,
  },

  headerOptionDropdownOption: {
    minHeight: 38,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.borderSoft,
    backgroundColor: PALETTE.card,
  },

  headerOptionDropdownOptionSelected: {
    backgroundColor: PALETTE.goldSoft,
  },

  headerOptionDropdownOptionText: {
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 13,
  },

  headerOptionDropdownOptionTextSelected: {
    color: PALETTE.goldDark,
    fontWeight: "900",
  },

  customSelectCell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minWidth: 0,
    height: 50,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    backgroundColor: "#FFFDF8",
  },

  customSelectCellText: {
    flex: 1,
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  customSelectPlaceholder: {
    color: PALETTE.muted,
  },

  amountWrap: {
    flexDirection: "column",
    justifyContent: "center",
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    minWidth: 0,
  },

  amountInput: {
    borderRightWidth: 0,
    paddingHorizontal: 0,
    height: 24,
    textAlign: "right",
    fontWeight: "900",
  },

  readOnlyInput: {
    backgroundColor: "#F4F1E8",
    color: PALETTE.mutedSoft,
  },

  readOnlyAmountInput: {
    opacity: 0.7,
  },

  lineTotal: {
    marginTop: 2,
    textAlign: "right",
    fontWeight: "900",
    color: PALETTE.inkSoft,
    fontSize: 12,
  },

  actionsCell: {
    width: 88,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  smallBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },

  smallBtnDanger: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C14343",
    backgroundColor: "#C14343",
    alignItems: "center",
    justifyContent: "center",
  },

  gridBottomRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },

  visibilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },

  visibilityChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  visibilityChipOn: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },

  visibilityChipText: {
    fontWeight: "800",
    color: PALETTE.ink,
    fontSize: 12.5,
  },

  visibilityChipTextOn: {
    color: PALETTE.goldDark,
  },

  totalsBox: {
    width: 320,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 18,
    backgroundColor: "#FFFDF8",
    padding: 12,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  totalLbl: {
    color: PALETTE.mutedSoft,
    fontWeight: "800",
  },

  totalVal: {
    color: PALETTE.ink,
    fontWeight: "900",
  },

  totalStrong: {
    fontWeight: "900",
    color: PALETTE.ink,
  },

  totalStrongValue: {
    fontWeight: "900",
    color: PALETTE.goldDark,
    fontSize: 16,
  },

  signatureRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    paddingBottom: 4,
  },

  sigLabel: {
    color: PALETTE.muted,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
  },

  sigLine: {
    height: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#9AA3AE",
  },

  workOrderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  metaGrid: {
    marginTop: 14,
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },

  metaCol: {
    flexGrow: 1,
    flexBasis: 520,
    minWidth: 280,
  },

  metaColSmall: {
    width: 260,
    minWidth: 240,
  },

  metaLabel: {
    color: PALETTE.mutedSoft,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 6,
  },

  metaInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 18,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: PALETTE.ink,
    fontWeight: "800",
  },

  metaInputSingle: {
    height: 44,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 18,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 12,
    color: PALETTE.ink,
    fontWeight: "900",
  },

  infoChip: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  infoChipText: {
    flex: 1,
    color: PALETTE.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.3)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 16,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 12,
  },

  modalBodyText: {
    color: PALETTE.inkSoft,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 14,
  },

  modalCloseBtn: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    fontWeight: "900",
    color: PALETTE.ink,
  },

  confirmRow: {
    flexDirection: "row",
    gap: 10,
  },

  modalCancelBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },

  modalCancelText: {
    fontWeight: "900",
    color: PALETTE.ink,
  },

  modalDeleteBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C14343",
    backgroundColor: "#C14343",
    alignItems: "center",
    justifyContent: "center",
  },

  modalDeleteText: {
    fontWeight: "900",
    color: "#fff",
  },

  exportList: {
    gap: 8,
  },

  exportOption: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  exportOptionText: {
    fontWeight: "800",
    color: PALETTE.ink,
  },

  templateOption: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  templateOptionActive: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },

  templateOptionText: {
    fontWeight: "800",
    color: PALETTE.ink,
  },

  templateOptionTextActive: {
    color: PALETTE.goldDark,
    fontWeight: "900",
  },
});