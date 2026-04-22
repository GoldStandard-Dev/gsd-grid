import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import Screen from "../../../src/components/Screen";
import GoldButton from "../../../src/components/GoldButton";
import { supabase } from "../../../src/lib/supabase";
import { logActivity } from "../../../src/lib/activity";
import { theme } from "../../../src/theme/theme";
import {
  cleanDecimalInput,
  formatCurrencyDisplay,
  formatInvoiceNumber,
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

type LinkedInvoice = {
  id: string;
  invoice_number: number | null;
  status: string | null;
  total: number | null;
  balance_due: number | null;
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

type PricingLineOption = {
  enabled: boolean;
  label: string;
  showQuantity: boolean;
  showMeasurement: boolean;
  amountEditable: boolean;
  pricingBehavior: "unit" | "fixed";
};

type PricingLineOptions = Record<RowType, PricingLineOption>;

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
  showLabor: boolean;
  showMaterial: boolean;
  showDeposit: boolean;
  showSignature: boolean;
};

type GridVisibility = {
  showType: boolean;
  showQty: boolean;
  showMeasurement: boolean;
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

type HeaderColumnRole = "primary" | "measurement" | "descriptor" | "attribute" | "system";
type HeaderDisplayStyle = "dropdown" | "pills" | "segmented" | "text" | "measurement";
type HeaderMeasurementUnit = "inches" | "feet" | "sqft";
type HeaderMeasurementFormat = "width_height" | "single_value";

type CustomHeader = {
  id: string;
  label: string;
  enabled: boolean;
  fieldType?: "text" | "dropdown" | "number" | "date" | "notes" | "measurement";
  columnRole?: HeaderColumnRole;
  optionSource?: string;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  helpText?: string;
  widthSize?: "small" | "medium" | "large" | "full";
  displayStyle?: HeaderDisplayStyle;
  allowManualEntry?: boolean;
  multiSelect?: boolean;
  measurementUnit?: HeaderMeasurementUnit;
  measurementFractions?: boolean;
  measurementFormat?: HeaderMeasurementFormat;
  conditionalLogic?: { showIfFieldId: string; showIfValue: string } | null;
};

type AssignmentMeta = {
  userId?: string;
  displayName?: string;
  role?: string;
};

type WorkOrderMeta = {
  notes?: string;
  installation?: number;
  labor?: number;
  material?: number;
  deposit?: number;
  tax_rate_override?: number;
  customHeaders?: CustomHeader[];
  selectedTemplateName?: string;
  invoiceVisibility?: Partial<InvoiceVisibility>;
  gridVisibility?: Partial<GridVisibility>;
  reviewWorkflow?: Partial<ReviewWorkflow>;
  pricingLineOptions?: Partial<Record<RowType, Partial<PricingLineOption>>>;
  assignedTo?: AssignmentMeta;
  createdBy?: AssignmentMeta;
  archivedAt?: string;
  archivedBy?: string;
};

type ImportableCollection = {
  id: string;
  name: string;
  pricing_mode: string;
  industry_type: string;
};

type ImportPreviewRow = {
  rowIndex: number;
  inventoryNum: number;
  currentAmount: string;
  newAmountRaw: number;
  newAmountDisplay: string;
  source: string;
  selected: boolean;
};

type FractionField = "width_frac" | "length_frac";

type FractionPickerState = {
  visible: boolean;
  rowIndex: number;
  field: FractionField | null;
  anchorX: number;
  anchorY: number;
  anchorYTop: number;
  anchorWidth: number;
};

type RowTypePickerState = {
  visible: boolean;
  rowIndex: number;
  anchorX: number;
  anchorY: number;
  anchorYTop: number;
  anchorWidth: number;
};

type HeaderOptionPickerState = {
  visible: boolean;
  rowIndex: number;
  headerId: string | null;
  title: string;
  options: string[];
  anchorX: number;
  anchorY: number;
  anchorYTop: number;
  anchorWidth: number;
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

const DEFAULT_PRICING_LINE_OPTIONS: PricingLineOptions = {
  measured: {
    enabled: true,
    label: "Measured",
    showQuantity: true,
    showMeasurement: true,
    amountEditable: true,
    pricingBehavior: "unit",
  },
  labor: {
    enabled: true,
    label: "Labor",
    showQuantity: false,
    showMeasurement: false,
    amountEditable: true,
    pricingBehavior: "fixed",
  },
  material: {
    enabled: true,
    label: "Material",
    showQuantity: false,
    showMeasurement: false,
    amountEditable: true,
    pricingBehavior: "fixed",
  },
};

const DEFAULT_INVOICE_VISIBILITY: InvoiceVisibility = {
  showNotes: true,
  showMeasurement: true,
  showInstallation: true,
  showLabor: true,
  showMaterial: true,
  showDeposit: true,
  showSignature: true,
};

const DEFAULT_GRID_VISIBILITY: GridVisibility = {
  showType: true,
  showQty: true,
  showMeasurement: true,
  showAmount: true,
};

const DEFAULT_REVIEW_WORKFLOW: ReviewWorkflow = {
  status: "draft",
  note: "",
};

const GRID_SYSTEM_FIELDS: CustomHeader[] = [
  {
    id: "measurement",
    label: "MEASUREMENT",
    enabled: true,
    fieldType: "measurement",
    columnRole: "measurement",
    placeholder: "Width x Height",
    widthSize: "large",
    displayStyle: "measurement",
    measurementUnit: "inches",
    measurementFractions: true,
    measurementFormat: "width_height",
  },
  {
    id: "color",
    label: "ITEM / COLOR",
    enabled: true,
    fieldType: "dropdown",
    columnRole: "descriptor",
    options: ["White", "Bronze", "Black", "Custom"],
    placeholder: "Select item or color",
    widthSize: "large",
    displayStyle: "dropdown",
    allowManualEntry: true,
  },
];

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

// Shared column widths: single source of truth for header and every row.
const COLS = {
  inv:     72,   // inventory #
  type:   112,   // row type
  qty:     68,   // qty
  measure: 316,  // measurement (W x L inputs)
  item:   220,   // item / SKU
  custom: 118,   // each custom header column
  amount: 112,   // amount
  actions: 90,   // duplicate / delete
} as const;

const ROW_HEIGHT = 52;
const DROPDOWN_SCREEN_GUTTER = 12;
const FRACTION_DROPDOWN_MAX_HEIGHT = 330;
const HEADER_OPTION_DROPDOWN_MAX_HEIGHT = 340;
const ALIGNMENT_OPTION_ORDER = ["Standard", "Left", "Center", "Right"];

function isAlignmentOptionMenu(options: string[]) {
  const optionSet = new Set(options.filter(Boolean));
  return ALIGNMENT_OPTION_ORDER.every((option) => optionSet.has(option));
}

function orderedHeaderOptions(options: string[]) {
  const cleanOptions = options.filter((option, index) => !(index === 0 && option === ""));
  if (!isAlignmentOptionMenu(cleanOptions)) return cleanOptions;

  const rankedOptions = new Set(ALIGNMENT_OPTION_ORDER);
  return [
    ...ALIGNMENT_OPTION_ORDER.filter((option) => cleanOptions.includes(option)),
    ...cleanOptions.filter((option) => !rankedOptions.has(option)),
  ];
}

function isSystemGridHeader(header: CustomHeader) {
  return header.id === "measurement" || header.id === "color";
}

function normalizeHeader(header: CustomHeader, index = 0): CustomHeader {
  const fieldType = header.fieldType ?? (header.options?.length ? "dropdown" : "text");
  const columnRole =
    header.columnRole ??
    (header.id === "measurement"
      ? "measurement"
      : header.id === "color"
        ? "descriptor"
        : index === 0
          ? "primary"
          : "attribute");
  const displayStyle =
    header.displayStyle ??
    (fieldType === "measurement" ? "measurement" : fieldType === "dropdown" ? "dropdown" : "text");

  return {
    ...header,
    enabled: header.enabled !== false,
    fieldType,
    columnRole,
    displayStyle,
    options: [...(header.options ?? [])],
    measurementUnit: header.measurementUnit ?? "inches",
    measurementFractions: header.measurementFractions ?? true,
    measurementFormat: header.measurementFormat ?? "width_height",
    conditionalLogic: header.conditionalLogic ?? null,
  };
}

function cloneHeaders(headers: CustomHeader[]) {
  const nextHeaders = headers.map((header, index) => normalizeHeader(header, index));
  const existingIds = new Set(nextHeaders.map((header) => header.id));
  const missingSystemFields = GRID_SYSTEM_FIELDS.filter((header) => !existingIds.has(header.id));
  return [
    ...missingSystemFields.map((header, index) => normalizeHeader(header, index)),
    ...nextHeaders,
  ];
}

function gridColumnWidth(header: CustomHeader) {
  if (header.columnRole === "measurement" || header.fieldType === "measurement") return COLS.measure;
  if (header.columnRole === "descriptor" || header.columnRole === "primary" || header.id === "color") return COLS.item;

  switch (header.widthSize) {
    case "small":
      return 104;
    case "large":
      return 176;
    case "full":
      return 220;
    default:
      return COLS.custom;
  }
}

function getGridHeaderValue(row: GridRow, headerId: string) {
  if (headerId === "measurement") return formatMeasurement(row);
  if (headerId === "color") return row.color ?? "";
  return row.extra?.[headerId] ?? "";
}

function dropdownAnchorStyle(
  anchorX: number,
  anchorY: number,
  anchorYTop: number,
  anchorWidth: number,
  viewportWidth: number,
  viewportHeight: number,
  minWidth: number,
  maxHeight: number
) {
  if (!anchorX && !anchorY) return null;

  const width = Math.max(minWidth, anchorWidth || minWidth);
  const left = Math.min(
    Math.max(DROPDOWN_SCREEN_GUTTER, anchorX),
    Math.max(DROPDOWN_SCREEN_GUTTER, viewportWidth - width - DROPDOWN_SCREEN_GUTTER)
  );
  const opensUp = anchorY + maxHeight > viewportHeight - DROPDOWN_SCREEN_GUTTER;

  if (opensUp) {
    return {
      left,
      bottom: Math.max(DROPDOWN_SCREEN_GUTTER, viewportHeight - anchorYTop + 4),
      minWidth: width,
      maxHeight,
    };
  }

  return {
    left,
    top: Math.max(DROPDOWN_SCREEN_GUTTER, anchorY),
    minWidth: width,
    maxHeight,
  };
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
    labor: Number.isFinite(meta.labor as number) ? meta.labor : undefined,
    material: Number.isFinite(meta.material as number) ? meta.material : undefined,
    deposit: Number.isFinite(meta.deposit as number) ? meta.deposit : undefined,
    tax_rate_override: Number.isFinite(meta.tax_rate_override as number) ? meta.tax_rate_override : undefined,
    customHeaders: meta.customHeaders?.length ? meta.customHeaders : undefined,
    selectedTemplateName: meta.selectedTemplateName?.trim() || undefined,
    invoiceVisibility:
      meta.invoiceVisibility && Object.keys(meta.invoiceVisibility).length ? meta.invoiceVisibility : undefined,
    gridVisibility: meta.gridVisibility && Object.keys(meta.gridVisibility).length ? meta.gridVisibility : undefined,
    reviewWorkflow: meta.reviewWorkflow && Object.keys(meta.reviewWorkflow).length ? meta.reviewWorkflow : undefined,
    pricingLineOptions:
      meta.pricingLineOptions && Object.keys(meta.pricingLineOptions).length ? meta.pricingLineOptions : undefined,
    assignedTo: meta.assignedTo?.userId ? meta.assignedTo : undefined,
    createdBy: meta.createdBy?.userId ? meta.createdBy : undefined,
    archivedAt: meta.archivedAt || undefined,
    archivedBy: meta.archivedBy || undefined,
  };

  return JSON.stringify(payload);
}

function normalizePricingLineOptions(
  options: WorkOrderMeta["pricingLineOptions"] | undefined
): PricingLineOptions {
  return ROW_TYPE_OPTIONS.reduce((acc, option) => {
    const saved = options?.[option.value];
    const label = saved?.label?.trim() || DEFAULT_PRICING_LINE_OPTIONS[option.value].label;
    acc[option.value] = {
      enabled:
        option.value === "measured"
          ? true
          : typeof saved?.enabled === "boolean"
            ? saved.enabled
            : DEFAULT_PRICING_LINE_OPTIONS[option.value].enabled,
      label,
      showQuantity:
        typeof saved?.showQuantity === "boolean"
          ? saved.showQuantity
          : DEFAULT_PRICING_LINE_OPTIONS[option.value].showQuantity,
      showMeasurement:
        typeof saved?.showMeasurement === "boolean"
          ? saved.showMeasurement
          : DEFAULT_PRICING_LINE_OPTIONS[option.value].showMeasurement,
      amountEditable:
        typeof saved?.amountEditable === "boolean"
          ? saved.amountEditable
          : DEFAULT_PRICING_LINE_OPTIONS[option.value].amountEditable,
      pricingBehavior:
        saved?.pricingBehavior === "unit" || saved?.pricingBehavior === "fixed"
          ? saved.pricingBehavior
          : DEFAULT_PRICING_LINE_OPTIONS[option.value].pricingBehavior,
    };
    return acc;
  }, {} as PricingLineOptions);
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

function parseMeasurementDecimal(whole: string, frac: string): number {
  const w = Number(whole || "0");
  const parts = (frac || "").split("/");
  const f = parts.length === 2 && Number(parts[1]) !== 0
    ? Number(parts[0]) / Number(parts[1])
    : 0;
  return w + f;
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

  const normalized = text.replace(/\u00d7/g, "x").replace(/\s+/g, " ").trim();
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

function rowTypeLabel(value: RowType, options: PricingLineOptions = DEFAULT_PRICING_LINE_OPTIONS) {
  return options[value]?.label || ROW_TYPE_OPTIONS.find((option) => option.value === value)?.label || "Measured";
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

function rowLineTotal(row: GridRow, pricingLineOptions: PricingLineOptions = DEFAULT_PRICING_LINE_OPTIONS) {
  const lineOption = pricingLineOptions[row.row_type] ?? DEFAULT_PRICING_LINE_OPTIONS[row.row_type];
  if (lineOption.pricingBehavior === "unit") {
    return n(row.qty || "1") * n(row.amount || "0");
  }
  return n(row.amount || "0");
}

type LineItemSnapshot = {
  sort_order?: number | null;
  qty?: number | string | null;
  unit?: string | null;
  item?: string | null;
  description?: string | null;
  unit_price?: number | string | null;
};

function normalizedLineItemDescription(raw: string | null | undefined) {
  const meta = parseRowMeta(raw);
  const fields = Object.fromEntries(
    Object.entries(meta.fields ?? {})
      .map(([key, value]) => [key, String(value ?? "").trim()] as const)
      .filter(([, value]) => value.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  );

  return JSON.stringify({
    rowType: meta.rowType ?? "measured",
    notes: (meta.notes ?? "").trim(),
    fields,
  });
}

function lineItemSnapshotKey(item: LineItemSnapshot) {
  return JSON.stringify({
    sort_order: Number(item.sort_order ?? 0),
    qty: Number(item.qty ?? 0),
    unit: (item.unit ?? "").trim(),
    item: (item.item ?? "").trim(),
    description: normalizedLineItemDescription(item.description),
    unit_price: Number(item.unit_price ?? 0),
  });
}

function hasLineItemDetails(item: LineItemSnapshot) {
  const meta = parseRowMeta(item.description);
  const hasMetaValue = (meta.notes ?? "").trim().length > 0 ||
    Object.values(meta.fields ?? {}).some((value) => String(value ?? "").trim().length > 0);

  return (
    (item.unit ?? "").trim().length > 0 ||
    (item.item ?? "").trim().length > 0 ||
    hasMetaValue ||
    Number(item.unit_price ?? 0) !== 0 ||
    Number(item.qty ?? 1) !== 1
  );
}

function hasGridRowDetails(row: GridRow) {
  return (
    row.row_type !== "measured" ||
    formatMeasurement(row).trim().length > 0 ||
    row.color.trim().length > 0 ||
    row.amount.trim().length > 0 ||
    Object.values(row.extra ?? {}).some((value) => String(value ?? "").trim().length > 0) ||
    n(row.qty || "1") !== 1
  );
}

function lineItemSnapshotLabel(item: LineItemSnapshot) {
  const meta = parseRowMeta(item.description);
  const fieldValue = Object.values(meta.fields ?? {}).find((value) => String(value ?? "").trim().length > 0);
  const directValue = (item.item ?? "").trim() || String(fieldValue ?? "").trim() || (item.unit ?? "").trim();
  if (directValue) return directValue;
  const number = Number(item.sort_order ?? 0) + 1;
  return `line item ${number}`;
}

function gridRowActivityLabel(row: GridRow) {
  return row.color.trim() || Object.values(row.extra ?? {}).find((value) => String(value ?? "").trim().length > 0)?.trim() || formatMeasurement(row).trim() || `line item ${row.inventory_number}`;
}

function formatLineItemValue(value: unknown, currency = false) {
  const text = String(value ?? "").trim();
  if (!text) return "-";
  if (currency) return money(Number(value ?? 0));
  return text;
}

function describeLineItemFieldChanges(before: LineItemSnapshot, after: LineItemSnapshot, headers: CustomHeader[]) {
  const changes: Record<string, { from: string; to: string }> = {};
  const beforeMeta = parseRowMeta(before.description);
  const afterMeta = parseRowMeta(after.description);

  const addChange = (label: string, from: string, to: string) => {
    if (from !== to) changes[label] = { from, to };
  };

  addChange("quantity", formatLineItemValue(before.qty), formatLineItemValue(after.qty));
  addChange("measurement", formatLineItemValue(before.unit), formatLineItemValue(after.unit));
  addChange("item", formatLineItemValue(before.item), formatLineItemValue(after.item));
  addChange("price", formatLineItemValue(before.unit_price, true), formatLineItemValue(after.unit_price, true));

  const fieldIds = Array.from(new Set([...Object.keys(beforeMeta.fields ?? {}), ...Object.keys(afterMeta.fields ?? {})]));
  fieldIds.forEach((fieldId) => {
    const label = headers.find((header) => header.id === fieldId)?.label || fieldId;
    addChange(label, formatLineItemValue(beforeMeta.fields?.[fieldId]), formatLineItemValue(afterMeta.fields?.[fieldId]));
  });

  return changes;
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function workOrderActivityLabel(wo: WorkOrder) {
  const formatted = formatWorkOrderNumber(wo.work_order_number);
  return formatted === "-" ? wo.id : formatted;
}

function countGridRowsByType(rows: GridRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.row_type] += 1;
      return acc;
    },
    { measured: 0, labor: 0, material: 0 } as Record<RowType, number>
  );
}

// Memoized grid row.
type GridRowProps = {
  row: GridRow;
  idx: number;
  isStriped: boolean;
  pricingLineOptions: PricingLineOptions;
  visibleCustomHeaders: CustomHeader[];
  showType: boolean;
  showQty: boolean;
  effectiveShowAmount: boolean;
  canEditFieldRows: boolean;
  canEditFinancials: boolean;
  onSetCell: (idx: number, key: keyof GridRow, value: string | number | undefined) => void;
  onSetExtra: (idx: number, headerId: string, value: string) => void;
  onOpenFractionPicker: (rowIdx: number, field: FractionField) => void;
  onOpenHeaderOptionPicker: (rowIdx: number, header: CustomHeader) => void;
  onOpenRowTypePicker: (rowIdx: number) => void;
  onDuplicate: (idx: number) => void;
  onDelete: (idx: number) => void;
  fractionAnchorRefs: React.MutableRefObject<Record<string, View | null>>;
  headerOptionAnchorRefs: React.MutableRefObject<Record<string, View | null>>;
  rowTypeAnchorRefs: React.MutableRefObject<Record<string, View | null>>;
};

const MemoGridRow = memo(function GridRowInner({
  row, idx, isStriped,
  pricingLineOptions,
  visibleCustomHeaders, showType, showQty, effectiveShowAmount,
  canEditFieldRows, canEditFinancials,
  onSetCell, onSetExtra,
  onOpenFractionPicker, onOpenHeaderOptionPicker, onOpenRowTypePicker,
  onDuplicate, onDelete,
  fractionAnchorRefs, headerOptionAnchorRefs, rowTypeAnchorRefs,
}: GridRowProps) {
  const lineOption = pricingLineOptions[row.row_type] ?? DEFAULT_PRICING_LINE_OPTIONS[row.row_type];
  const canEditRowAmount = canEditFinancials && lineOption.amountEditable;
  const line = rowLineTotal(row, pricingLineOptions);

  // Applies conditional logic — only show headers whose condition is met for this row's values
  const rowVisibleHeaders = visibleCustomHeaders.filter((header) => {
    if (!header.conditionalLogic?.showIfFieldId) return true;
    const { showIfFieldId, showIfValue } = header.conditionalLogic;
    const controlValue = getGridHeaderValue(row, showIfFieldId).trim().toLowerCase();
    const triggerValue = (showIfValue ?? "").trim().toLowerCase();
    return triggerValue === "" || controlValue === triggerValue;
  });

  const setHeaderValue = (header: CustomHeader, value: string) => {
    if (header.id === "color") {
      onSetCell(idx, "color", value);
      return;
    }
    onSetExtra(idx, header.id, value);
  };

  const renderMeasurementCell = (header: CustomHeader) => {
    const width = gridColumnWidth(header);
    const fractionsEnabled = header.measurementFractions !== false;

    return (
      <View key={header.id} style={[styles.tdCell, styles.measurementFieldCell, { width }]}>
        {lineOption.showMeasurement ? (
          <View style={styles.measureShell}>
            <Text style={styles.measureMiniLabel}>W</Text>
            <TextInput
              value={row.width_whole}
              onChangeText={(v) => onSetCell(idx, "width_whole", onlyWholeNumber(v))}
              style={[styles.measureInput, styles.measureWhole]}
              placeholder="0"
              placeholderTextColor={theme.colors.muted}
              keyboardType="numeric"
              editable={canEditFieldRows}
            />
            {fractionsEnabled ? (
              <View
                ref={(node) => { fractionAnchorRefs.current[`${idx}-width_frac`] = node; }}
                collapsable={false}
              >
                <Pressable
                  disabled={!canEditFieldRows}
                  onPress={() => onOpenFractionPicker(idx, "width_frac")}
                  style={[styles.fractionDropdownField, !canEditFieldRows ? styles.readOnlyInput : null]}
                >
                  <Text style={styles.fractionDropdownText}>{row.width_frac || ""}</Text>
                  <Ionicons name="chevron-down" size={13} color={theme.colors.ink} />
                </Pressable>
              </View>
            ) : null}
            <Text style={styles.measureX}>x</Text>
            <Text style={styles.measureMiniLabel}>H</Text>
            <TextInput
              value={row.length_whole}
              onChangeText={(v) => onSetCell(idx, "length_whole", onlyWholeNumber(v))}
              style={[styles.measureInput, styles.measureWhole]}
              placeholder="0"
              placeholderTextColor={theme.colors.muted}
              keyboardType="numeric"
              editable={canEditFieldRows}
            />
            {fractionsEnabled ? (
              <View
                ref={(node) => { fractionAnchorRefs.current[`${idx}-length_frac`] = node; }}
                collapsable={false}
              >
                <Pressable
                  disabled={!canEditFieldRows}
                  onPress={() => onOpenFractionPicker(idx, "length_frac")}
                  style={[styles.fractionDropdownField, !canEditFieldRows ? styles.readOnlyInput : null]}
                >
                  <Text style={styles.fractionDropdownText}>{row.length_frac || ""}</Text>
                  <Ionicons name="chevron-down" size={13} color={theme.colors.ink} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.noMeasurementBox}>
            <Ionicons
              name={row.row_type === "labor" ? "hammer-outline" : "cube-outline"}
              size={14}
              color={theme.colors.mutedSoft}
            />
            <Text style={styles.noMeasurementText}>
              {rowTypeLabel(row.row_type, pricingLineOptions)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderHeaderField = (header: CustomHeader) => {
    if (header.fieldType === "measurement" || header.columnRole === "measurement") {
      return renderMeasurementCell(header);
    }

    const width = gridColumnWidth(header);
    const hasOptions = (header.options ?? []).length > 0;
    const currentValue = getGridHeaderValue(row, header.id);
    const placeholder = header.placeholder?.trim() || header.label;
    const displayStyle = header.displayStyle ?? (hasOptions ? "dropdown" : "text");

    if (hasOptions && (displayStyle === "pills" || displayStyle === "segmented")) {
      return (
        <View key={header.id} style={[styles.tdCell, styles.fieldChoiceCell, { width }]}>
          <View style={displayStyle === "segmented" ? styles.fieldSegmentedWrap : styles.fieldPillWrap}>
            {(header.options ?? []).slice(0, 4).map((option) => {
              const active = currentValue === option;
              return (
                <Pressable
                  key={option}
                  disabled={!canEditFieldRows}
                  onPress={() => setHeaderValue(header, active ? "" : option)}
                  style={[
                    displayStyle === "segmented" ? styles.fieldSegment : styles.fieldPill,
                    active ? styles.fieldChoiceActive : null,
                    !canEditFieldRows ? styles.disabledBtn : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.fieldChoiceText,
                      active ? styles.fieldChoiceTextActive : null,
                    ]}
                    numberOfLines={1}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {header.allowManualEntry ? (
            <TextInput
              value={currentValue}
              onChangeText={(value) => setHeaderValue(header, value)}
              style={styles.fieldInlineInput}
              placeholder="Custom"
              placeholderTextColor={theme.colors.muted}
              editable={canEditFieldRows}
            />
          ) : null}
        </View>
      );
    }

    if (hasOptions && displayStyle !== "text") {
      return (
        <View
          key={header.id}
          ref={(node) => { headerOptionAnchorRefs.current[`${idx}-${header.id}`] = node; }}
          collapsable={false}
          style={{ width }}
        >
          <View style={[styles.tdCell, styles.customHybridCell, { width }]}>
            {header.allowManualEntry ? (
              <TextInput
                value={currentValue}
                onChangeText={(value) => setHeaderValue(header, value)}
                style={styles.customHybridInput}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.muted}
                editable={canEditFieldRows}
              />
            ) : (
              <Pressable
                disabled={!canEditFieldRows}
                onPress={() => onOpenHeaderOptionPicker(idx, header)}
                style={styles.customHybridPress}
              >
                <Text
                  style={[styles.customSelectCellText, !currentValue ? styles.customSelectPlaceholder : null]}
                  numberOfLines={1}
                >
                  {currentValue || placeholder}
                </Text>
              </Pressable>
            )}
            <Pressable
              disabled={!canEditFieldRows}
              onPress={() => onOpenHeaderOptionPicker(idx, header)}
              style={[styles.customHybridButton, !canEditFieldRows ? styles.disabledBtn : null]}
            >
              <Ionicons name="chevron-down" size={12} color={theme.colors.ink} />
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <TextInput
        key={header.id}
        value={currentValue}
        onChangeText={(value) => setHeaderValue(header, value)}
        style={[styles.tdCell, styles.tdInput, { width }]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        keyboardType={header.fieldType === "number" ? "numeric" : "default"}
        multiline={header.fieldType === "notes"}
        editable={canEditFieldRows}
      />
    );
  };

  return (
    <View style={[styles.tr, isStriped ? styles.trStriped : null]}>

      {/* INV # */}
      <View style={[styles.tdCell, { width: COLS.inv }, styles.tdCenter, styles.tdGold]}>
        <Text style={styles.inventoryText}>{row.inventory_number}</Text>
      </View>

      {/* TYPE */}
      {showType ? (
        <View
          ref={(node) => { rowTypeAnchorRefs.current[String(idx)] = node; }}
          collapsable={false}
          style={{ width: COLS.type }}
        >
          <Pressable
            onPress={() => onOpenRowTypePicker(idx)}
            style={[styles.tdCell, { width: COLS.type }, styles.tdCenter, styles.tdLight]}
          >
            <Text style={styles.rowTypeCellText}>{rowTypeLabel(row.row_type, pricingLineOptions)}</Text>
            <Ionicons name="chevron-down" size={12} color={theme.colors.ink} />
          </Pressable>
        </View>
      ) : null}

      {/* QTY */}
      {showQty ? (
        lineOption.showQuantity ? (
          <TextInput
            value={row.qty}
            onChangeText={(v) => onSetCell(idx, "qty", onlyWholeNumber(v))}
            style={[styles.tdCell, styles.tdInput, { width: COLS.qty, textAlign: "center" }]}
            placeholder="1"
            placeholderTextColor={theme.colors.muted}
            keyboardType="numeric"
            editable={canEditFieldRows}
          />
        ) : (
          <View style={[styles.tdCell, { width: COLS.qty }, styles.tdCenter, styles.tdDimmed]}>
            <Text style={styles.qtyHiddenText}>-</Text>
          </View>
        )
      ) : null}

      {/* Builder-driven fields */}
      {rowVisibleHeaders.map((header) => renderHeaderField(header))}
      {false ? (
        <View style={[styles.tdCell, { width: COLS.measure, paddingHorizontal: 8, paddingVertical: 6 }]}>
          {lineOption.showMeasurement ? (
            <View style={styles.measureShell}>
              <Text style={styles.measureMiniLabel}>W</Text>
              <TextInput
                value={row.width_whole}
                onChangeText={(v) => onSetCell(idx, "width_whole", onlyWholeNumber(v))}
                style={[styles.measureInput, styles.measureWhole]}
                placeholder="0"
                placeholderTextColor={theme.colors.muted}
                keyboardType="numeric"
              />
              <View
                ref={(node) => { fractionAnchorRefs.current[`${idx}-width_frac`] = node; }}
                collapsable={false}
              >
                <Pressable
                  onPress={() => onOpenFractionPicker(idx, "width_frac")}
                  style={styles.fractionDropdownField}
                >
                  <Text style={styles.fractionDropdownText}>{row.width_frac || ""}</Text>
                  <Ionicons name="chevron-down" size={13} color={theme.colors.ink} />
                </Pressable>
              </View>
              <Text style={styles.measureX}>x</Text>
              <Text style={styles.measureMiniLabel}>L</Text>
              <TextInput
                value={row.length_whole}
                onChangeText={(v) => onSetCell(idx, "length_whole", onlyWholeNumber(v))}
                style={[styles.measureInput, styles.measureWhole]}
                placeholder="0"
                placeholderTextColor={theme.colors.muted}
                keyboardType="numeric"
              />
              <View
                ref={(node) => { fractionAnchorRefs.current[`${idx}-length_frac`] = node; }}
                collapsable={false}
              >
                <Pressable
                  onPress={() => onOpenFractionPicker(idx, "length_frac")}
                  style={styles.fractionDropdownField}
                >
                  <Text style={styles.fractionDropdownText}>{row.length_frac || ""}</Text>
                  <Ionicons name="chevron-down" size={13} color={theme.colors.ink} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.noMeasurementBox}>
              <Ionicons
                name={row.row_type === "labor" ? "hammer-outline" : "cube-outline"}
                size={14}
                color={theme.colors.mutedSoft}
              />
              <Text style={styles.noMeasurementText}>
                {rowTypeLabel(row.row_type, pricingLineOptions)}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {false ? (
      <TextInput
        value={row.color}
        onChangeText={(v) => onSetCell(idx, "color", v)}
        style={[styles.tdCell, styles.tdInput, { width: COLS.item }]}
        placeholder={
          row.row_type === "labor" ? `${rowTypeLabel(row.row_type, pricingLineOptions)} item / service`
          : row.row_type === "material" ? `${rowTypeLabel(row.row_type, pricingLineOptions)} / SKU`
          : "Color / SKU"
        }
        placeholderTextColor={theme.colors.muted}
      />
      ) : null}

      {/* CUSTOM HEADERS — conditional logic applied per row */}
      {false ? rowVisibleHeaders.map((header) => {
        const hasOptions = (header.options ?? []).length > 0;
        const currentValue = row.extra?.[header.id] ?? "";
        if (hasOptions) {
          return (
            <View
              key={header.id}
              ref={(node) => { headerOptionAnchorRefs.current[`${idx}-${header.id}`] = node; }}
              collapsable={false}
              style={{ width: COLS.custom }}
            >
              <Pressable
                onPress={() => onOpenHeaderOptionPicker(idx, header)}
                style={[styles.tdCell, styles.customSelectCell, { width: COLS.custom }]}
              >
                <Text
                  style={[styles.customSelectCellText, !currentValue ? styles.customSelectPlaceholder : null]}
                  numberOfLines={1}
                >
                  {currentValue || header.label}
                </Text>
                <Ionicons name="chevron-down" size={12} color={theme.colors.ink} />
              </Pressable>
            </View>
          );
        }
        return (
          <TextInput
            key={header.id}
            value={currentValue}
            onChangeText={(v) => onSetExtra(idx, header.id, v)}
            style={[styles.tdCell, styles.tdInput, { width: COLS.custom }]}
            placeholder={header.label}
            placeholderTextColor={theme.colors.muted}
          />
        );
      }) : null}

      {/* AMOUNT */}
      {effectiveShowAmount ? (
        <View style={[styles.tdCell, { width: COLS.amount }, styles.amountWrap]}>
          <TextInput
            value={row.amount}
            onChangeText={(v) => onSetCell(idx, "amount", formatCurrencyDisplay(v))}
            style={[styles.tdInput, styles.amountInput, !canEditRowAmount ? styles.readOnlyAmountInput : null]}
            placeholder={lineOption.pricingBehavior === "unit" ? "Unit $" : "Amount"}
            placeholderTextColor={theme.colors.muted}
            keyboardType="numeric"
            editable={canEditRowAmount}
          />
          <Text style={styles.lineTotal}>{money(line)}</Text>
        </View>
      ) : null}

      {/* ACTIONS */}
      <View style={[styles.tdCell, { width: COLS.actions }, styles.actionsCell]}>
        <Pressable
          onPress={() => canEditFieldRows ? onDuplicate(idx) : null}
          style={({ pressed }) => [styles.smallBtn, pressed ? { opacity: 0.85 } : null]}
        >
          <Ionicons name="copy-outline" size={15} color={theme.colors.ink} />
        </Pressable>
        <Pressable
          onPress={() => canEditFieldRows ? onDelete(idx) : null}
          style={({ pressed }) => [styles.smallBtnDanger, pressed ? { opacity: 0.85 } : null]}
        >
          <Ionicons name="trash-outline" size={15} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
});

export default function WorkOrderDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [linkedInvoice, setLinkedInvoice] = useState<LinkedInvoice | null>(null);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrgSettings | null>(null);

  const [saving, setSaving] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("viewer");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showPricingImport, setShowPricingImport] = useState(false);
  const [importCollections, setImportCollections] = useState<ImportableCollection[]>([]);
  const [importSelectedId, setImportSelectedId] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importAdjustments, setImportAdjustments] = useState({ installation: 0, labor: 0, material: 0 });

  const [woMeta, setWoMeta] = useState<WorkOrderMeta>({
    notes: "",
    installation: 0,
    labor: 0,
    material: 0,
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
    anchorYTop: 0,
    anchorWidth: 0,
  });
  const [rowTypePicker, setRowTypePicker] = useState<RowTypePickerState>({
    visible: false,
    rowIndex: -1,
    anchorX: 0,
    anchorY: 0,
    anchorYTop: 0,
    anchorWidth: 0,
  });
  const [headerOptionPicker, setHeaderOptionPicker] = useState<HeaderOptionPickerState>({
    visible: false,
    rowIndex: -1,
    headerId: null,
    title: "",
    options: [],
    anchorX: 0,
    anchorY: 0,
    anchorYTop: 0,
    anchorWidth: 0,
  });
  const [lastCombinedRows, setLastCombinedRows] = useState<GridRow[] | null>(null);

  const fractionAnchorRefs = useRef<Record<string, View | null>>({});
  const headerOptionAnchorRefs = useRef<Record<string, View | null>>({});
  const rowTypeAnchorRefs = useRef<Record<string, View | null>>({});

  const invoiceVisibility = useMemo<InvoiceVisibility>(
    () => ({ ...DEFAULT_INVOICE_VISIBILITY, ...(woMeta.invoiceVisibility ?? {}) }),
    [woMeta.invoiceVisibility]
  );

  const gridVisibility = useMemo<GridVisibility>(
    () => ({ ...DEFAULT_GRID_VISIBILITY, ...(woMeta.gridVisibility ?? {}) }),
    [woMeta.gridVisibility]
  );

  const pricingLineOptions = useMemo<PricingLineOptions>(
    () => normalizePricingLineOptions(woMeta.pricingLineOptions),
    [woMeta.pricingLineOptions]
  );

  const enabledPricingLineOptions = useMemo(
    () => ROW_TYPE_OPTIONS.filter((option) => pricingLineOptions[option.value].enabled),
    [pricingLineOptions]
  );

  const reviewWorkflow = useMemo<ReviewWorkflow>(
    () => ({ ...DEFAULT_REVIEW_WORKFLOW, ...(woMeta.reviewWorkflow ?? {}) }),
    [woMeta.reviewWorkflow]
  );

  const visibleGridHeaders = useMemo(() => customHeaders.filter((header) => header.enabled), [customHeaders]);
  const visibleCustomHeaders = useMemo(
    () => visibleGridHeaders.filter((header) => !isSystemGridHeader(header)),
    [visibleGridHeaders]
  );


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
  const canConvertToInvoice = canViewFinancials && reviewWorkflow.status === "priced" && !linkedInvoice;
  const isReviewStage =
    reviewWorkflow.status === "submitted_for_review" ||
    reviewWorkflow.status === "in_review" ||
    reviewWorkflow.status === "priced";
  const lockAmountVisible = isReviewStage;
  const pricingUnlocked = canViewFinancials && isReviewStage;
  const effectiveShowAmount = pricingUnlocked;
  const canConfigurePricingLines = canEditFieldRows || canViewFinancials;
  const canViewPricingTotals = pricingUnlocked;
  const canViewPricing = pricingUnlocked;
  const isArchived = !!woMeta.archivedAt;

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
      setLinkedInvoice(null);

      if (woRow) {
        const invoiceRes = await supabase
          .from("invoices")
          .select("id, invoice_number, status, total, balance_due")
          .eq("org_id", woRow.org_id)
          .eq("work_order_id", woRow.id)
          .neq("status", "void")
          .order("invoice_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!invoiceRes.error && invoiceRes.data) {
          const invoiceRow = invoiceRes.data as any;
          setLinkedInvoice({
            id: invoiceRow.id,
            invoice_number: invoiceRow.invoice_number ?? null,
            status: invoiceRow.status ?? null,
            total: Number(invoiceRow.total ?? 0),
            balance_due: Number(invoiceRow.balance_due ?? 0),
          });
        }
      }

      let loadedHeaders = cloneHeaders(DEFAULT_TEMPLATE_HEADERS.General);
      let loadedTemplateName = "General";
      let loadedGridVisibility: GridVisibility = DEFAULT_GRID_VISIBILITY;
      let loadedReviewWorkflow: ReviewWorkflow = DEFAULT_REVIEW_WORKFLOW;

      if (woRow?.description) {
        const meta = parseWorkOrderMeta(woRow.description);
        setWoMeta({
          notes: meta.notes ?? "",
          installation: typeof meta.installation === "number" ? meta.installation : 0,
          labor: typeof meta.labor === "number" ? meta.labor : 0,
          material: typeof meta.material === "number" ? meta.material : 0,
          deposit: typeof meta.deposit === "number" ? meta.deposit : 0,
          tax_rate_override: typeof meta.tax_rate_override === "number" ? meta.tax_rate_override : undefined,
          customHeaders: meta.customHeaders ?? undefined,
          selectedTemplateName: meta.selectedTemplateName ?? undefined,
          invoiceVisibility: meta.invoiceVisibility ?? undefined,
          gridVisibility: meta.gridVisibility ?? DEFAULT_GRID_VISIBILITY,
          reviewWorkflow: meta.reviewWorkflow ?? DEFAULT_REVIEW_WORKFLOW,
          pricingLineOptions: meta.pricingLineOptions ?? undefined,
          assignedTo: meta.assignedTo ?? undefined,
          createdBy: meta.createdBy ?? undefined,
          archivedAt: meta.archivedAt ?? undefined,
          archivedBy: meta.archivedBy ?? undefined,
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
          labor: 0,
          material: 0,
          deposit: 0,
          gridVisibility: DEFAULT_GRID_VISIBILITY,
          reviewWorkflow: DEFAULT_REVIEW_WORKFLOW,
          assignedTo: undefined,
          createdBy: undefined,
          archivedAt: undefined,
          archivedBy: undefined,
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

  const setCellByIndex = useCallback((idx: number, key: keyof GridRow, value: string | number | undefined) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  }, []);

  const setExtraCellByIndex = useCallback((idx: number, headerId: string, value: string) => {
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
  }, []);

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
        anchorYTop: 0,
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
          anchorYTop: y,
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
        anchorYTop: 0,
        anchorWidth: 120,
      });
    }
  }

  function closeFractionPicker() {
    setFractionPicker((prev) => ({ ...prev, visible: false }));
  }

  function selectFraction(value: FractionValue) {
    if (fractionPicker.field && fractionPicker.rowIndex >= 0) {
      setCellByIndex(fractionPicker.rowIndex, fractionPicker.field, value);
    }
    closeFractionPicker();
  }

  function openHeaderOptionPicker(rowIndex: number, header: CustomHeader) {
    const normalizedOptions = Array.from(
      new Set(["", ...(header.options ?? [])].map((option) => option.trim()))
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
        anchorYTop: 0,
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
          anchorYTop: y,
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
        anchorYTop: 0,
        anchorWidth: 140,
      });
    }
  }

  function closeHeaderOptionPicker() {
    setHeaderOptionPicker((prev) => ({ ...prev, visible: false }));
  }

  function openRowTypePicker(rowIdx: number) {
    const ref = rowTypeAnchorRefs.current[String(rowIdx)];
    if (!ref || Platform.OS !== "web") {
      setRowTypePicker({ visible: true, rowIndex: rowIdx, anchorX: 0, anchorY: 0, anchorYTop: 0, anchorWidth: 0 });
      return;
    }
    try {
      ref.measureInWindow((x, y, width, height) => {
        setRowTypePicker({ visible: true, rowIndex: rowIdx, anchorX: x, anchorY: y + height + 4, anchorYTop: y, anchorWidth: width });
      });
    } catch {
      setRowTypePicker({ visible: true, rowIndex: rowIdx, anchorX: 0, anchorY: 0, anchorYTop: 0, anchorWidth: 0 });
    }
  }

  function closeRowTypePicker() {
    setRowTypePicker((prev) => ({ ...prev, visible: false }));
  }

  function selectHeaderOption(value: string) {
    if (headerOptionPicker.rowIndex >= 0 && headerOptionPicker.headerId) {
      if (headerOptionPicker.headerId === "color") {
        setCellByIndex(headerOptionPicker.rowIndex, "color", value);
      } else {
        setExtraCellByIndex(headerOptionPicker.rowIndex, headerOptionPicker.headerId, value);
      }
    }
    closeHeaderOptionPicker();
  }

  function addRow(rowType: RowType = "measured") {
    setRows((prev) => renumberRows([...prev, blankRow(prev.length, rowType)]));
    setLastCombinedRows(null);
  }

  const duplicateRow = useCallback((idx: number) => {
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
  }, []);

  const deleteRow = useCallback((idx: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? renumberRows(next) : [blankRow(0)];
    });
    setLastCombinedRows(null);
  }, []);

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

  async function fetchNextWorkOrderNumber(activeOrgId: string) {
    const { data, error } = await supabase
      .from("work_orders")
      .select("work_order_number")
      .eq("org_id", activeOrgId)
      .order("work_order_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return Number((data as any)?.work_order_number ?? 0) + 1;
  }

  function getCurrentWorkOrderMeta(overrides: Partial<WorkOrderMeta> = {}): WorkOrderMeta {
    return {
      notes: woMeta.notes ?? "",
      installation,
      labor,
      material,
      deposit,
      tax_rate_override:
        typeof woMeta.tax_rate_override === "number" ? woMeta.tax_rate_override : undefined,
      customHeaders,
      selectedTemplateName,
      invoiceVisibility: woMeta.invoiceVisibility,
      gridVisibility: woMeta.gridVisibility,
      reviewWorkflow: woMeta.reviewWorkflow,
      pricingLineOptions: woMeta.pricingLineOptions,
      assignedTo: woMeta.assignedTo,
      createdBy: woMeta.createdBy,
      archivedAt: woMeta.archivedAt,
      archivedBy: woMeta.archivedBy,
      ...overrides,
    };
  }

  async function duplicateWorkOrder() {
    if (!wo || duplicating) return;

    try {
      setDuplicating(true);
      const nextWorkOrderNumber = await fetchNextWorkOrderNumber(wo.org_id);
      const duplicateMeta = getCurrentWorkOrderMeta({
        reviewWorkflow: DEFAULT_REVIEW_WORKFLOW,
        archivedAt: undefined,
        archivedBy: undefined,
        createdBy: currentUserId
          ? {
              userId: currentUserId,
              displayName: actorName,
              role: currentUserRole,
            }
          : woMeta.createdBy,
      });

      const duplicateRes = await supabase
        .from("work_orders")
        .insert({
          org_id: wo.org_id,
          title: `${wo.title || "Work Order"} Copy`,
          client_name: wo.client_name ?? null,
          description: buildWorkOrderDescription(duplicateMeta),
          status: wo.status || "Open",
          priority: wo.priority || "normal",
          scheduled_date: wo.scheduled_date,
          due_date: wo.due_date,
          assigned_to_user_id: woMeta.assignedTo?.userId ?? null,
          created_by_user_id: currentUserId || null,
          work_order_number: nextWorkOrderNumber,
        })
        .select("id")
        .single();

      if (duplicateRes.error || !duplicateRes.data?.id) {
        throw new Error(duplicateRes.error?.message ?? "Failed to duplicate work order.");
      }

      const duplicateId = duplicateRes.data.id;
      const itemPayload = rows.map((row, index) => ({
        org_id: wo.org_id,
        work_order_id: duplicateId,
        sort_order: index,
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
        const itemRes = await supabase.from("work_order_items").insert(itemPayload);
        if (itemRes.error) throw new Error(itemRes.error.message);
      }

      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: `duplicated work order #${wo.work_order_number ?? wo.id} as #${nextWorkOrderNumber}`,
        entity_type: "work_order",
        entity_id: duplicateId,
      });

      Alert.alert("Duplicated", "A new copy of this work order was created.");
      router.push(`/workorders/${duplicateId}`);
    } catch (error: any) {
      Alert.alert("Duplicate failed", error?.message ?? "Failed to duplicate work order.");
    } finally {
      setDuplicating(false);
    }
  }

  async function setWorkOrderArchived(nextArchived: boolean) {
    if (!wo || archiving) return;

    try {
      setArchiving(true);
      const nextMeta = getCurrentWorkOrderMeta({
        archivedAt: nextArchived ? new Date().toISOString() : undefined,
        archivedBy: nextArchived ? actorName : undefined,
      });

      const res = await supabase
        .from("work_orders")
        .update({
          description: buildWorkOrderDescription(nextMeta),
        })
        .eq("id", wo.id)
        .eq("org_id", wo.org_id);

      if (res.error) throw new Error(res.error.message);

      setWoMeta(nextMeta);

      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: `${nextArchived ? "archived" : "restored"} work order #${wo.work_order_number ?? wo.id}`,
        entity_type: "work_order",
        entity_id: wo.id,
      });

      Alert.alert(nextArchived ? "Archived" : "Restored", nextArchived ? "Work order moved to Archived." : "Work order restored to the active list.");
      if (nextArchived) router.replace("/workorders");
    } catch (error: any) {
      Alert.alert("Archive failed", error?.message ?? "Failed to update archive state.");
    } finally {
      setArchiving(false);
    }
  }

  function applyTemplate(name: string) {
    const templateHeaders = DEFAULT_TEMPLATE_HEADERS[name];
    if (!templateHeaders) return;

    const previousTemplateName = selectedTemplateName || woMeta.selectedTemplateName || "";
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

    if (wo && previousTemplateName !== name) {
      const workOrderLabel = workOrderActivityLabel(wo);
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "template_changed",
        entity_type: "work_order",
        entity_id: wo.id,
        title: "Changed work order template",
        description: `changed template on ${workOrderLabel} to ${name}`,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          old_value: previousTemplateName || "None",
          new_value: name,
        },
      });
    }
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

  function setHeaderVisibility(headerId: string, enabled: boolean) {
    const nextHeaders = customHeaders.map((header) => (header.id === headerId ? { ...header, enabled } : header));
    setCustomHeaders(nextHeaders);
    setWoMeta((prev) => ({
      ...prev,
      customHeaders: nextHeaders,
    }));
  }

  function setPricingLineOption(rowType: RowType, nextOption: Partial<PricingLineOption>) {
    setWoMeta((prev) => {
      const current = normalizePricingLineOptions(prev.pricingLineOptions);
      return {
        ...prev,
        pricingLineOptions: {
          ...(prev.pricingLineOptions ?? {}),
          [rowType]: {
            ...current[rowType],
            ...nextOption,
          },
        },
      };
    });
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

  async function persistReviewWorkflow(next: Partial<ReviewWorkflow>) {
    if (!wo || reviewSaving) return null;

    const nextReviewWorkflow: ReviewWorkflow = {
      ...reviewWorkflow,
      ...next,
    };
    const nextMeta = getCurrentWorkOrderMeta({
      reviewWorkflow: nextReviewWorkflow,
    });
    const nextDescription = buildWorkOrderDescription(nextMeta);

    setReviewSaving(true);
    setSaveError("");

    try {
      const res = await supabase
        .from("work_orders")
        .update({
          description: nextDescription,
        })
        .eq("id", wo.id)
        .eq("org_id", wo.org_id);

      if (res.error) throw new Error(res.error.message);

      setWoMeta(nextMeta);
      setWo((prev) => (prev ? { ...prev, description: nextDescription } : prev));
      return nextReviewWorkflow;
    } catch (error: any) {
      const message = error?.message ?? "Failed to update review workflow.";
      setSaveError(message);
      Alert.alert("Review update failed", message);
      return null;
    } finally {
      setReviewSaving(false);
    }
  }

  async function submitForReview() {
    if (!assignedToMe && !canManageReview) {
      Alert.alert("Access denied", "Only the assigned technician can submit this work order for review.");
      return;
    }

    const now = new Date().toISOString();
    const previousStatus = reviewWorkflow.status;
    const nextWorkflow = await persistReviewWorkflow({
      status: "submitted_for_review",
      submittedAt: now,
      submittedBy: actorName,
      reviewStartedAt: undefined,
      reviewStartedBy: undefined,
      completedAt: undefined,
      completedBy: undefined,
    });

    if (wo && nextWorkflow) {
      const workOrderLabel = workOrderActivityLabel(wo);
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "stage_changed",
        entity_type: "work_order",
        entity_id: wo.id,
        title: "Changed work order stage",
        description: `submitted ${workOrderLabel} for review`,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          old_value: reviewStatusLabel(previousStatus),
          new_value: "Submitted for Review",
        },
      });
    }
  }

  async function startPricingReview() {
    if (!canManageReview) {
      Alert.alert("Access denied", "Only managers can start pricing review.");
      return;
    }

    const now = new Date().toISOString();
    const previousStatus = reviewWorkflow.status;
    const nextWorkflow = await persistReviewWorkflow({
      status: "in_review",
      reviewStartedAt: now,
      reviewStartedBy: actorName,
      completedAt: undefined,
      completedBy: undefined,
    });

    if (wo && nextWorkflow) {
      const workOrderLabel = workOrderActivityLabel(wo);
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "stage_changed",
        entity_type: "work_order",
        entity_id: wo.id,
        title: "Changed work order stage",
        description: `moved ${workOrderLabel} into pricing review`,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          old_value: reviewStatusLabel(previousStatus),
          new_value: "In Review",
        },
      });
    }
  }

  async function markPricingComplete() {
    if (!canManageReview) {
      Alert.alert("Access denied", "Only managers can complete pricing.");
      return;
    }

    const now = new Date().toISOString();
    const previousStatus = reviewWorkflow.status;
    const nextWorkflow = await persistReviewWorkflow({
      status: "priced",
      completedAt: now,
      completedBy: actorName,
    });

    if (wo && nextWorkflow) {
      const workOrderLabel = workOrderActivityLabel(wo);
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "stage_changed",
        entity_type: "work_order",
        entity_id: wo.id,
        title: "Completed pricing",
        description: `completed pricing for ${workOrderLabel}`,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          old_value: reviewStatusLabel(previousStatus),
          new_value: "Priced",
        },
      });
    }
  }

  async function returnToDraft() {
    if (!canManageReview) {
      Alert.alert("Access denied", "Only managers can return this work order to draft.");
      return;
    }

    const previousStatus = reviewWorkflow.status;
    const nextWorkflow = await persistReviewWorkflow({
      status: "draft",
      submittedAt: undefined,
      submittedBy: undefined,
      reviewStartedAt: undefined,
      reviewStartedBy: undefined,
      completedAt: undefined,
      completedBy: undefined,
    });

    if (wo && nextWorkflow) {
      const workOrderLabel = workOrderActivityLabel(wo);
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "stage_changed",
        entity_type: "work_order",
        entity_id: wo.id,
        title: "Returned work order to draft",
        description: `returned ${workOrderLabel} to draft`,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          old_value: reviewStatusLabel(previousStatus),
          new_value: "Draft",
        },
      });
    }
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

  const subtotal = useMemo(
    () => viewRows.reduce((sum, row) => sum + rowLineTotal(row, pricingLineOptions), 0),
    [viewRows, pricingLineOptions]
  );
  const tax = useMemo(() => subtotal * (Number(taxRate) / 100), [subtotal, taxRate]);
  const installation = useMemo(() => Number(woMeta.installation ?? 0) || 0, [woMeta.installation]);
  const labor = useMemo(() => Number(woMeta.labor ?? 0) || 0, [woMeta.labor]);
  const material = useMemo(() => Number(woMeta.material ?? 0) || 0, [woMeta.material]);
  const total = useMemo(
    () => subtotal + tax + installation + labor + material,
    [subtotal, tax, installation, labor, material]
  );
  const deposit = useMemo(() => Number(woMeta.deposit ?? 0) || 0, [woMeta.deposit]);
  const balanceDue = useMemo(() => Math.max(0, total - deposit), [total, deposit]);

  async function saveAll() {
    if (!id) return;
    setSaveError("");
    setSaveSuccess(false);

    if (!canEditFieldRows && !canManageReview) {
      setSaveError("You do not have permission to edit this work order.");
      return;
    }

    setSaving(true);

    try {
      if (wo) {
        const workOrderUpdateRes = await supabase
          .from("work_orders")
          .update({
            description: buildWorkOrderDescription(getCurrentWorkOrderMeta()),
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

      const currentDb = await supabase
        .from("work_order_items")
        .select("id, sort_order, qty, unit, item, description, unit_price")
        .eq("work_order_id", id);

      if (currentDb.error) throw new Error(currentDb.error.message);

      const dbIds = (currentDb.data ?? []).map((x: any) => x.id as string);
      const dbItemById = new Map(
        (currentDb.data ?? []).map((item: any) => [item.id as string, item as LineItemSnapshot])
      );
      const dbItemKeys = new Map(
        (currentDb.data ?? []).map((item: any) => [item.id as string, lineItemSnapshotKey(item)])
      );
      const dbMeaningfulItemIds = new Set(
        (currentDb.data ?? [])
          .filter((item: any) => hasLineItemDetails(item))
          .map((item: any) => item.id as string)
      );
      const existingRows = normalizedRows.filter((row) => row.id);
      const newRows = normalizedRows.filter((row) => !row.id);
      const existingIds = existingRows.map((row) => row.id as string);
      const toDelete = dbIds.filter((dbId) => !existingIds.includes(dbId));
      const meaningfulAddedRows = newRows.filter((row) => hasGridRowDetails(row));
      const meaningfulDeletedRows = toDelete.filter((dbId) => dbMeaningfulItemIds.has(dbId));
      const updatePayload = existingRows.map((row) => ({
        id: row.id,
        org_id: wo?.org_id,
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
      const insertPayload = newRows.map((row) => ({
        org_id: wo?.org_id,
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
      const changedRowCount = updatePayload.filter((row) => {
        const existingKey = row.id ? dbItemKeys.get(row.id) : null;
        const hasDetails = hasLineItemDetails(row) || (row.id ? dbMeaningfulItemIds.has(row.id) : false);
        return hasDetails && !!existingKey && existingKey !== lineItemSnapshotKey(row);
      }).length;
      const changedRows = updatePayload
        .map((row) => {
          const before = row.id ? dbItemById.get(row.id) : null;
          if (!before) return null;
          const hasDetails = hasLineItemDetails(row) || dbMeaningfulItemIds.has(row.id as string);
          const fields = describeLineItemFieldChanges(before, row, customHeaders);
          if (!hasDetails || !Object.keys(fields).length) return null;
          return {
            type: "changed",
            inventory_number: Number(row.sort_order ?? 0) + 1,
            row_label: lineItemSnapshotLabel(row),
            row_type: parseRowMeta(row.description).rowType ?? "measured",
            fields,
          };
        })
        .filter(Boolean)
        .slice(0, 8);
      const removedRows = meaningfulDeletedRows
        .map((dbId) => {
          const before = dbItemById.get(dbId);
          if (!before) return null;
          return {
            type: "removed",
            inventory_number: Number(before.sort_order ?? 0) + 1,
            row_label: lineItemSnapshotLabel(before),
            row_type: parseRowMeta(before.description).rowType ?? "measured",
          };
        })
        .filter(Boolean)
        .slice(0, 8);
      const addedRows = meaningfulAddedRows.slice(0, 8).map((row) => ({
        type: "added",
        inventory_number: row.inventory_number,
        row_label: gridRowActivityLabel(row),
        row_type: row.row_type,
      }));

      if (toDelete.length) {
        const deleteRes = await supabase.from("work_order_items").delete().in("id", toDelete);
        if (deleteRes.error) throw new Error(deleteRes.error.message);
      }

      if (existingRows.length) {
        const updateRes = await supabase.from("work_order_items").upsert(updatePayload, { onConflict: "id" });

        if (updateRes.error) throw new Error(updateRes.error.message);
      }

      if (newRows.length) {
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (wo) {
        const workOrderLabel = workOrderActivityLabel(wo);
        const lineItemChanges = [
          meaningfulAddedRows.length ? countLabel(meaningfulAddedRows.length, "line item") + " added" : "",
          changedRowCount ? countLabel(changedRowCount, "line item") + " changed" : "",
          meaningfulDeletedRows.length ? countLabel(meaningfulDeletedRows.length, "line item") + " removed" : "",
        ].filter(Boolean);
        const addedTypeCounts = countGridRowsByType(meaningfulAddedRows);

        if (lineItemChanges.length) {
          const lineItemChangeDetails = [...addedRows, ...changedRows, ...removedRows];
          const firstChanged = changedRows[0] as { row_label?: string; fields?: Record<string, { from: string; to: string }> } | undefined;
          const firstChangedField = firstChanged?.fields ? Object.keys(firstChanged.fields)[0] : "";
          const firstChangedValues = firstChangedField && firstChanged?.fields ? firstChanged.fields[firstChangedField] : null;
          const action =
            meaningfulAddedRows.length && !changedRowCount && !meaningfulDeletedRows.length
              ? "line_items_bulk_added"
              : changedRowCount && !meaningfulAddedRows.length && !meaningfulDeletedRows.length
                ? "line_item_updated"
                : "line_items_updated";

          void logActivity(supabase, {
            org_id: wo.org_id,
            actor_user_id: currentUserId || null,
            actor_name: actorName,
            action,
            entity_type: "work_order_item",
            entity_id: wo.id,
            parent_entity_type: "work_order",
            parent_entity_id: wo.id,
            title:
              action === "line_items_bulk_added"
                ? `Added ${countLabel(meaningfulAddedRows.length, "line item")}`
                : "Updated work order line items",
            description:
              action === "line_items_bulk_added"
                ? `added ${countLabel(meaningfulAddedRows.length, "line item")} to ${workOrderLabel}`
                : `updated line items on ${workOrderLabel}: ${lineItemChanges.join(", ")}`,
            details: {
              work_order_id: wo.id,
              work_order_number: workOrderLabel,
              work_order_title: wo.title ?? "",
              added_count: meaningfulAddedRows.length,
              updated_count: changedRowCount,
              removed_count: meaningfulDeletedRows.length,
              measured_count: addedTypeCounts.measured,
              labor_count: addedTypeCounts.labor,
              material_count: addedTypeCounts.material,
              row_label: firstChanged?.row_label ?? "",
              field_changed: firstChangedField,
              old_value: firstChangedValues?.from ?? "",
              new_value: firstChangedValues?.to ?? "",
              line_item_changes: lineItemChangeDetails,
              summary: {
                added: meaningfulAddedRows.length,
                changed: changedRowCount,
                removed: meaningfulDeletedRows.length,
              },
            },
          });
        }
      }
    } catch (error: any) {
      const msg = error?.message ?? "Failed to save work order.";
      console.error("[saveAll]", msg, error);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function convertToInvoice() {
    if (!wo) return;
    if (linkedInvoice) {
      router.push(`/invoices/${linkedInvoice.id}`);
      return;
    }
    if (!canConvertToInvoice) {
      Alert.alert("Pricing incomplete", "Submit pricing through review and mark it complete before converting.");
      return;
    }

    setConverting(true);

    try {
      const nextInvoiceNumberRes = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("org_id", wo.org_id)
        .order("invoice_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nextInvoiceNumberRes.error) throw new Error(nextInvoiceNumberRes.error.message);
      const nextInvoiceNumber = Number((nextInvoiceNumberRes.data as any)?.invoice_number ?? 0) + 1;

      const invRes = await supabase
        .from("invoices")
        .insert({
          org_id: wo.org_id,
          work_order_id: wo.id,
          invoice_number: nextInvoiceNumber,
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
        org_id: wo.org_id,
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

      const adjustmentPayload = [
        { label: "Installation", amount: installation },
        { label: "Labor", amount: labor },
        { label: "Material", amount: material },
      ]
        .filter((item) => item.amount > 0)
        .map((item, index) => ({
          org_id: wo.org_id,
          invoice_id: invoiceId,
          sort_order: itemPayload.length + index,
          qty: 1,
          unit: "Adjustment",
          item: item.label,
          description: `${item.label} from work order pricing`,
          unit_price: item.amount,
          taxable: false,
        }));

      if (itemPayload.length || adjustmentPayload.length) {
        const copyRes = await supabase.from("invoice_items").insert([...itemPayload, ...adjustmentPayload]);
        if (copyRes.error) throw new Error(copyRes.error.message);
      }

      setLinkedInvoice({
        id: invoiceId,
        invoice_number: nextInvoiceNumber,
        status: "draft",
        total,
        balance_due: balanceDue,
      });

      const workOrderLabel = workOrderActivityLabel(wo);
      const invoiceLabel = formatInvoiceNumber(nextInvoiceNumber);
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "created",
        entity_type: "invoice",
        entity_id: invoiceId,
        parent_entity_type: "work_order",
        parent_entity_id: wo.id,
        title: "Created invoice",
        description: `created ${invoiceLabel} from ${workOrderLabel}`,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          invoice_id: invoiceId,
          invoice_number: invoiceLabel,
          client_name: wo.client_name ?? "",
          line_item_count: itemPayload.length + adjustmentPayload.length,
          total,
          balance_due: balanceDue,
        },
      });

      Alert.alert("Success", "Invoice created successfully.");
      router.push(`/invoices/${invoiceId}`);
    } catch (error: any) {
      Alert.alert("Convert failed", error?.message ?? "Failed to convert to invoice.");
    } finally {
      setConverting(false);
    }
  }

  async function openPricingImport() {
    if (!wo) return;
    setImportSelectedId("");
    setImportPreviewRows([]);
    setImportAdjustments({ installation: 0, labor: 0, material: 0 });
    setShowPricingImport(true);
    setImportLoading(true);
    const res = await supabase
      .from("pricing_collections")
      .select("id, name, pricing_mode, industry_type")
      .eq("org_id", wo.org_id)
      .order("name");
    setImportCollections((res.data ?? []) as ImportableCollection[]);
    setImportLoading(false);
  }

  async function selectImportCollection(collectionId: string) {
    setImportSelectedId(collectionId);
    setImportLoading(true);

    const [rulesRes, matrixRes, fabricsRes] = await Promise.all([
      supabase.from("pricing_rules")
        .select("rule_type, label, price, unit_label, formula_expr, sort_order")
        .eq("collection_id", collectionId).eq("is_active", true).order("sort_order"),
      supabase.from("pricing_matrix_cells")
        .select("price_group, width_to, height_to, price")
        .eq("collection_id", collectionId),
      supabase.from("pricing_fabrics")
        .select("fabric_style, price_group")
        .eq("collection_id", collectionId),
    ]);

    const rules = (rulesRes.data ?? []) as any[];
    const cells = (matrixRes.data ?? []) as any[];
    const fabrics = (fabricsRes.data ?? []) as any[];
    const preview: ImportPreviewRow[] = [];
    const adj = { installation: 0, labor: 0, material: 0 };

    // ── Rules pass ──────────────────────────────────────────────────────────
    for (const rule of rules) {
      const price = Number(rule.price ?? 0);
      if (rule.rule_type === "flat")     { adj.installation += price; continue; }
      if (rule.rule_type === "labor")    { adj.labor += price; continue; }
      if (rule.rule_type === "material") { adj.material += price; continue; }
      if (rule.rule_type === "unit") {
        rows.forEach((row, idx) => {
          if (row.row_type !== "measured") return;
          preview.push({
            rowIndex: idx, inventoryNum: row.inventory_number,
            currentAmount: row.amount || "0",
            newAmountRaw: price,
            newAmountDisplay: `$${price.toFixed(2)}`,
            source: `Rule: ${rule.label || "Unit rule"}`,
            selected: true,
          });
        });
      }
      if (rule.rule_type === "formula" && rule.formula_expr) {
        rows.forEach((row, idx) => {
          if (row.row_type !== "measured") return;
          const w = parseMeasurementDecimal(row.width_whole, row.width_frac);
          const h = parseMeasurementDecimal(row.length_whole, row.length_frac);
          const sqft = parseFloat(((w * h) / 144).toFixed(4));
          const evaluated = (() => {
            try {
              const expr = rule.formula_expr
                .replace(/\{qty\}/g, String(Number(row.qty) || 1))
                .replace(/\{width\}/g, String(w))
                .replace(/\{height\}/g, String(h))
                .replace(/\{sqft\}/g, String(sqft))
                .replace(/\{linearft\}/g, String(w / 12))
                .replace(/\{price\}/g, "0")
                .replace(/[^0-9+\-*/().\s]/g, "");
              // eslint-disable-next-line no-new-func
              const result = new Function(`return (${expr})`)();
              return isNaN(result) || !isFinite(result) ? 0 : Number(result.toFixed(2));
            } catch { return 0; }
          })();
          if (evaluated > 0) {
            const existing = preview.findIndex(p => p.rowIndex === idx);
            const entry = {
              rowIndex: idx, inventoryNum: row.inventory_number,
              currentAmount: row.amount || "0", newAmountRaw: evaluated,
              newAmountDisplay: `$${evaluated.toFixed(2)}`,
              source: `Formula: ${rule.label || rule.formula_expr}`, selected: true,
            };
            if (existing >= 0) preview[existing] = entry; else preview.push(entry);
          }
        });
      }
    }

    // ── Matrix pass (overrides unit rule amounts for matched rows) ──────────
    if (cells.length > 0) {
      const allGroups = [...new Set(cells.map((c: any) => c.price_group as string))];
      rows.forEach((row, idx) => {
        if (row.row_type !== "measured") return;
        const w = parseMeasurementDecimal(row.width_whole, row.width_frac);
        const h = parseMeasurementDecimal(row.length_whole, row.length_frac);
        if (!w || !h) return;

        const matchedFabric = fabrics.find(
          (f: any) => f.fabric_style.toLowerCase() === (row.color || "").trim().toLowerCase()
        );
        const priceGroup: string = matchedFabric?.price_group ?? allGroups[0] ?? "";
        if (!priceGroup) return;

        const match = cells
          .filter((c: any) => c.price_group === priceGroup && c.width_to >= w && c.height_to >= h)
          .sort((a: any, b: any) => a.width_to - b.width_to || a.height_to - b.height_to)[0];

        if (match) {
          const price = Number(match.price);
          const entry = {
            rowIndex: idx, inventoryNum: row.inventory_number,
            currentAmount: row.amount || "0", newAmountRaw: price,
            newAmountDisplay: `$${price.toFixed(2)}`,
            source: `Matrix: ${priceGroup}  ${w}×${h}`,
            selected: true,
          };
          const existing = preview.findIndex(p => p.rowIndex === idx);
          if (existing >= 0) preview[existing] = entry; else preview.push(entry);
        }
      });
    }

    setImportPreviewRows(preview);
    setImportAdjustments(adj);
    setImportLoading(false);
  }

  function applyPricingImport() {
    const selectedRows = importPreviewRows.filter((item) => item.selected);
    const nextRows = rows.map((row, idx) => {
      const item = importPreviewRows.find(p => p.rowIndex === idx && p.selected);
      if (!item) return row;
      return { ...row, amount: formatCurrencyDisplay(String(item.newAmountRaw)) };
    });
    setRows(nextRows);

    if (importAdjustments.installation || importAdjustments.labor || importAdjustments.material) {
      setWoMeta(prev => ({
        ...prev,
        installation: (prev.installation ?? 0) + importAdjustments.installation,
        labor:        (prev.labor ?? 0)        + importAdjustments.labor,
        material:     (prev.material ?? 0)     + importAdjustments.material,
      }));
    }

    if (wo && (selectedRows.length || importAdjustments.installation || importAdjustments.labor || importAdjustments.material)) {
      const workOrderLabel = workOrderActivityLabel(wo);
      const sourceCollection = importCollections.find((collection) => collection.id === importSelectedId);
      const adjustmentTotal = importAdjustments.installation + importAdjustments.labor + importAdjustments.material;
      const importDescription = selectedRows.length
        ? `imported ${countLabel(selectedRows.length, "pricing row")} into ${workOrderLabel}`
        : `imported pricing add-ons into ${workOrderLabel}`;
      void logActivity(supabase, {
        org_id: wo.org_id,
        actor_user_id: currentUserId || null,
        actor_name: actorName,
        action: "pricing_imported",
        entity_type: "pricing",
        entity_id: wo.id,
        parent_entity_type: "work_order",
        parent_entity_id: wo.id,
        title: "Imported pricing",
        description: importDescription,
        details: {
          work_order_id: wo.id,
          work_order_number: workOrderLabel,
          count: selectedRows.length,
          source_collection_id: importSelectedId,
          source_collection_name: sourceCollection?.name ?? "",
          installation: importAdjustments.installation,
          labor: importAdjustments.labor,
          material: importAdjustments.material,
          adjustment_total: adjustmentTotal,
        },
      });
    }

    setShowPricingImport(false);
    setImportSelectedId("");
    setImportPreviewRows([]);
  }

  function buildPdfHtml() {
    const bizName = orgSettings?.company_name || profile?.company_name || "GSD Grid";
    const bizPhone = orgSettings?.phone || profile?.phone || "";
    const bizWeb = orgSettings?.website || profile?.website || "";
    const brandPrimary = orgSettings?.brand_primary_color || "#111111";
    const brandSecondary = orgSettings?.brand_secondary_color || "#FFFCF6";
    const brandAccent = orgSettings?.brand_accent_color || "#2563EB";

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
    const client = wo?.client_name ?? "-";
    const workOrderLabel = formatWorkOrderNumber(wo?.work_order_number);

    const visibleColumns = [
      { key: "inventory_number", label: "INV #", width: "64px", align: "center" as const },
      ...(gridVisibility.showType
        ? [{ key: "row_type", label: "TYPE", width: "100px", align: "left" as const }]
        : []),
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
        const lineOption = pricingLineOptions[row.row_type] ?? DEFAULT_PRICING_LINE_OPTIONS[row.row_type];
        const line = rowLineTotal(row, pricingLineOptions);
        const measurementText = lineOption.showMeasurement ? formatMeasurement(row) : "-";
        const qtyText = lineOption.showQuantity ? row.qty || "1" : "-";

        const cells: Record<string, string> = {
          inventory_number: `<td style="text-align:center;">${escapeHtml(String(row.inventory_number))}</td>`,
          row_type: `<td>${escapeHtml(rowTypeLabel(row.row_type, pricingLineOptions))}</td>`,
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
      ${invoiceVisibility.showLabor ? `<tr><td class="lbl">Labor</td><td class="val">${money(labor)}</td></tr>` : ""}
      ${invoiceVisibility.showMaterial ? `<tr><td class="lbl">Material</td><td class="val">${money(material)}</td></tr>` : ""}
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
      ...(gridVisibility.showType ? ["Type"] : []),
      ...(gridVisibility.showQty ? ["Qty"] : []),
      ...(gridVisibility.showMeasurement ? ["Measurement"] : []),
      "Item / SKU",
      ...visibleCustomHeaders.map((header) => header.label),
      ...(effectiveShowAmount ? ["Amount"] : []),
      "Line Total",
      "Pricing Workflow",
    ];

    const lines = viewRows.map((row) => {
      const lineTotal = rowLineTotal(row, pricingLineOptions);
      return [
        formatWorkOrderNumber(wo?.work_order_number),
        wo?.title ?? "",
        wo?.client_name ?? "",
        row.inventory_number,
        ...(gridVisibility.showType ? [rowTypeLabel(row.row_type, pricingLineOptions)] : []),
        ...(gridVisibility.showQty ? [row.row_type === "measured" ? row.qty || "1" : ""] : []),
        ...(gridVisibility.showMeasurement ? [row.row_type === "measured" ? formatMeasurement(row) : ""] : []),
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
    return <Text style={styles.sortBadge}>{sortDir === "asc" ? "ASC" : "DESC"}</Text>;
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
        <Ionicons name="chevron-down" size={14} color={theme.colors.ink} />
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
      <Ionicons name={value ? "checkbox" : "square-outline"} size={14} color={value ? "#111" : theme.colors.ink} />
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

  const fractionMenuStyle = dropdownAnchorStyle(
    fractionPicker.anchorX,
    fractionPicker.anchorY,
    fractionPicker.anchorYTop,
    fractionPicker.anchorWidth,
    viewportWidth,
    viewportHeight,
    120,
    FRACTION_DROPDOWN_MAX_HEIGHT
  );
  const headerOptionMenuStyle = dropdownAnchorStyle(
    headerOptionPicker.anchorX,
    headerOptionPicker.anchorY,
    headerOptionPicker.anchorYTop,
    headerOptionPicker.anchorWidth,
    viewportWidth,
    viewportHeight,
    150,
    HEADER_OPTION_DROPDOWN_MAX_HEIGHT
  );
  const rowTypeMenuStyle = dropdownAnchorStyle(
    rowTypePicker.anchorX,
    rowTypePicker.anchorY,
    rowTypePicker.anchorYTop,
    rowTypePicker.anchorWidth,
    viewportWidth,
    viewportHeight,
    160,
    HEADER_OPTION_DROPDOWN_MAX_HEIGHT
  );
  const headerOptionValues = orderedHeaderOptions(headerOptionPicker.options);
  const headerOptionCurrentValue =
    headerOptionPicker.rowIndex >= 0 && headerOptionPicker.headerId
      ? getGridHeaderValue(rows[headerOptionPicker.rowIndex], headerOptionPicker.headerId)
      : "";
  const headerOptionIsAlignment = isAlignmentOptionMenu(headerOptionValues);
  const headerOptionGroupLabel = headerOptionIsAlignment ? "Alignment" : "Options";

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={theme.colors.ink} />
            <Text style={styles.backText}>Work Orders</Text>
          </Pressable>

          <View style={styles.topActions}>
            {canManageReview ? (
              <Pressable onPress={() => setShowExportMenu(true)} style={styles.secondaryBtn}>
                <Ionicons name="document-text-outline" size={16} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Export</Text>
              </Pressable>
            ) : null}

            {canManageReview ? (
              <Pressable
                onPress={duplicateWorkOrder}
                disabled={duplicating}
                style={[styles.secondaryBtn, duplicating ? styles.disabledBtn : null]}
              >
                <Ionicons name="copy-outline" size={16} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>{duplicating ? "Duplicating..." : "Duplicate"}</Text>
              </Pressable>
            ) : null}

            {canManageReview && !linkedInvoice && canConvertToInvoice ? (
              <Pressable
                onPress={() => setShowInvoicePreview(true)}
                style={styles.secondaryBtn}
              >
                <Ionicons name="eye-outline" size={16} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Preview Invoice</Text>
              </Pressable>
            ) : null}

            {canManageReview ? (
              <Pressable
                onPress={convertToInvoice}
                style={[
                  styles.secondaryBtn,
                  (!linkedInvoice && (!canConvertToInvoice || converting)) ? styles.disabledBtn : null,
                ]}
                disabled={converting || (!linkedInvoice && !canConvertToInvoice)}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>
                  {linkedInvoice ? "Open Invoice" : converting ? "Converting..." : "Convert to Invoice"}
                </Text>
              </Pressable>
            ) : null}

            {canDeleteWorkOrder ? (
              <Pressable
                onPress={() => void setWorkOrderArchived(!isArchived)}
                disabled={archiving}
                style={[styles.secondaryBtn, archiving ? styles.disabledBtn : null]}
              >
                <Ionicons name={isArchived ? "arrow-up-circle-outline" : "archive-outline"} size={16} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>
                  {archiving ? "Updating..." : isArchived ? "Restore" : "Archive"}
                </Text>
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

        {saveError ? (
          <View style={styles.saveBannerError}>
            <Ionicons name="alert-circle-outline" size={16} color="#B42318" />
            <Text style={styles.saveBannerErrorText}>{saveError}</Text>
            <Pressable onPress={() => setSaveError("")} style={{ padding: 4 }}>
              <Ionicons name="close" size={15} color="#B42318" />
            </Pressable>
          </View>
        ) : null}

        {saveSuccess ? (
          <View style={styles.saveBannerSuccess}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
            <Text style={styles.saveBannerSuccessText}>Work order saved.</Text>
          </View>
        ) : null}

        <View style={styles.headerCard}>
          <View style={styles.workOrderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>
                {formatWorkOrderNumber(wo?.work_order_number) !== "-"
                  ? `${formatWorkOrderNumber(wo?.work_order_number)} - `
                  : ""}
                {wo?.title ?? "Work Order"}
              </Text>
              <Text style={styles.sub}>
                {wo?.client_name ? `Client: ${wo.client_name}` : "Client: -"} - Template:{" "}
                {woMeta.selectedTemplateName || "General"} - Assigned: {assignedToLabel}
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
                placeholderTextColor={theme.colors.muted}
                style={styles.metaInput}
                multiline
              />
            </View>

            <View style={styles.metaColSmall}>
              <Text style={styles.metaLabel}>Workflow status</Text>
              <View style={styles.infoChip}>
                <Ionicons name="construct-outline" size={14} color={theme.colors.goldDark} />
              <Text style={styles.infoChipText}>
                  {linkedInvoice
                    ? `Linked to ${formatInvoiceNumber(linkedInvoice.invoice_number)}`
                    : reviewWorkflow.status === "priced"
                    ? "Pricing complete - ready for invoice"
                    : reviewWorkflow.status === "in_review"
                      ? "Pricing in review"
                      : reviewWorkflow.status === "submitted_for_review"
                        ? "Submitted for manager review"
                        : assignedToMe
                          ? "Complete grid, then submit for review"
                          : canViewFinancials
                            ? "In draft - pricing panel below"
                            : "Field-only access"}
                </Text>
              </View>
            </View>
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

          {linkedInvoice ? (
            <View style={styles.linkedInvoiceCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkedInvoiceLabel}>Linked invoice</Text>
                <Text style={styles.linkedInvoiceTitle}>
                  {formatInvoiceNumber(linkedInvoice.invoice_number)}
                </Text>
                <Text style={styles.linkedInvoiceMeta}>
                  Status: {linkedInvoice.status ?? "draft"} - Total: {money(Number(linkedInvoice.total ?? 0))} - Balance:{" "}
                  {money(Number(linkedInvoice.balance_due ?? 0))}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/invoices/${linkedInvoice.id}`)}
                style={styles.secondaryBtnSmall}
              >
                <Ionicons name="open-outline" size={15} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Open Invoice</Text>
              </Pressable>
            </View>
          ) : reviewWorkflow.status === "priced" ? (
            <View style={styles.invoiceReadyCard}>
              <Ionicons name="receipt-outline" size={16} color={theme.colors.goldDark} />
              <Text style={styles.invoiceReadyText}>
                Pricing is complete. Convert once to create and link the invoice.
              </Text>
            </View>
          ) : null}

          <View style={styles.reviewActions}>
            {(assignedToMe || canManageReview) && reviewWorkflow.status === "draft" ? (
              <Pressable onPress={submitForReview} style={styles.secondaryBtnSmall}>
                <Ionicons name="send-outline" size={15} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Submit for Review</Text>
              </Pressable>
            ) : null}

            {canManageReview && reviewWorkflow.status === "submitted_for_review" ? (
              <Pressable onPress={startPricingReview} style={styles.secondaryBtnSmall}>
                <Ionicons name="create-outline" size={15} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Start Review</Text>
              </Pressable>
            ) : null}

            {canManageReview &&
            (reviewWorkflow.status === "in_review" || reviewWorkflow.status === "submitted_for_review") ? (
              <Pressable onPress={markPricingComplete} style={styles.secondaryBtnSmall}>
                <Ionicons name="checkmark-done-outline" size={15} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Mark Complete</Text>
              </Pressable>
            ) : null}

            {canManageReview ? (
              <Pressable onPress={returnToDraft} style={styles.secondaryBtnSmall}>
                <Ionicons name="refresh-outline" size={15} color={theme.colors.ink} />
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
                placeholderTextColor={theme.colors.muted}
                style={styles.reviewNoteInput}
                multiline
              />
            </>
          ) : null}

          <View style={styles.reviewMetaGrid}>
            <Text style={styles.reviewMetaText}>
              Submitted:{" "}
              {reviewWorkflow.submittedAt
                ? `${new Date(reviewWorkflow.submittedAt).toLocaleString()} - ${reviewWorkflow.submittedBy ?? "-"}`
                : "-"}
            </Text>
            <Text style={styles.reviewMetaText}>
              In Review:{" "}
              {reviewWorkflow.reviewStartedAt
                ? `${new Date(reviewWorkflow.reviewStartedAt).toLocaleString()} - ${reviewWorkflow.reviewStartedBy ?? "-"}`
                : "-"}
            </Text>
            <Text style={styles.reviewMetaText}>
              Completed:{" "}
              {reviewWorkflow.completedAt
                ? `${new Date(reviewWorkflow.completedAt).toLocaleString()} - ${reviewWorkflow.completedBy ?? "-"}`
                : "-"}
            </Text>
          </View>
        </View>

        <View style={styles.gridCard}>
          <View style={styles.gridToolbar}>
            <View style={styles.gridToolbarLeft}>
              <Text style={styles.sectionTitle}>Grid</Text>
              <Text style={styles.sectionSub}>
                Measured lines, templates, dynamic headers, and review-ready pricing
              </Text>
            </View>

            <View style={styles.gridToolbarRight}>
              <Pressable
                onPress={() => addRow("measured")}
                disabled={!canEditFieldRows}
                style={[styles.addRowBtn, !canEditFieldRows ? styles.disabledBtn : null]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addRowText}>Add Row</Text>
              </Pressable>

              <Pressable onPress={combineDuplicateMeasurements} style={styles.secondaryBtnSmall}>
                <Ionicons name="git-merge-outline" size={15} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Combine</Text>
              </Pressable>

              <Pressable
                onPress={undoCombineDuplicates}
                style={[styles.secondaryBtnSmall, !lastCombinedRows?.length ? styles.disabledBtn : null]}
                disabled={!lastCombinedRows?.length}
              >
                <Ionicons name="return-up-back-outline" size={15} color={theme.colors.ink} />
                <Text style={styles.secondaryText}>Uncombine</Text>
              </Pressable>

            </View>
          </View>

          <View style={styles.headerVisibilityPanel}>
            <Text style={styles.headerVisibilityTitle}>Header visibility</Text>
            <View style={styles.headerVisibilityChips}>
              <Pressable
                onPress={() => setGridVisibility("showType", !gridVisibility.showType)}
                style={[styles.headerVisibilityChip, gridVisibility.showType ? styles.headerVisibilityChipActive : null]}
              >
                <Text style={[styles.headerVisibilityChipText, gridVisibility.showType ? styles.headerVisibilityChipTextActive : null]}>
                  Type
                </Text>
              </Pressable>
              {customHeaders.map((header) => (
                <Pressable
                  key={header.id}
                  onPress={() => setHeaderVisibility(header.id, !header.enabled)}
                  style={[styles.headerVisibilityChip, header.enabled ? styles.headerVisibilityChipActive : null]}
                >
                  <Text style={[styles.headerVisibilityChipText, header.enabled ? styles.headerVisibilityChipTextActive : null]}>
                    {header.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Horizontal scroll for wide table; the page handles vertical scroll. */}
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableHScroll}>
            <View>
              {/* Header */}
              <View style={styles.thead}>
                <Pressable onPress={() => toggleSort("inventory_number")} style={[styles.thCell, { width: COLS.inv, justifyContent: "center" }]}>
                  <Text style={styles.thText}>INV #</Text>
                  {headerSortBadge("inventory_number")}
                </Pressable>
                {gridVisibility.showType ? (
                  <Pressable onPress={() => toggleSort("row_type")} style={[styles.thCell, { width: COLS.type }]}>
                    <Text style={styles.thText}>TYPE</Text>
                    {headerSortBadge("row_type")}
                  </Pressable>
                ) : null}
                <Pressable onPress={() => toggleSort("qty")} style={[styles.thCell, { width: COLS.qty, justifyContent: "center" }]}>
                  <Text style={styles.thText}>QTY</Text>
                  {headerSortBadge("qty")}
                </Pressable>
                {visibleGridHeaders.map((header) => (
                  <Pressable key={header.id} onPress={() => toggleSort(header.id)} style={[styles.thCell, { width: gridColumnWidth(header) }]}>
                    <Text style={styles.thText} numberOfLines={1}>{header.label}</Text>
                    {headerSortBadge(header.id)}
                  </Pressable>
                ))}
                {effectiveShowAmount ? (
                  <Pressable onPress={() => toggleSort("amount")} style={[styles.thCell, { width: COLS.amount, justifyContent: "flex-end" }]}>
                    <Text style={styles.thText}>AMOUNT</Text>
                    {headerSortBadge("amount")}
                  </Pressable>
                ) : null}
                <View style={[styles.thCell, { width: COLS.actions, justifyContent: "flex-end", borderRightWidth: 0 }]}>
                  <Text style={styles.thText}>ACTIONS</Text>
                </View>
              </View>

              {/* Rows */}
              {viewRows.map((row, idx) => (
                <MemoGridRow
                  key={row.id ?? `row-${row.inventory_number}`}
                  row={row}
                  idx={idx}
                  isStriped={idx % 2 === 0}
                  pricingLineOptions={pricingLineOptions}
                  visibleCustomHeaders={visibleGridHeaders}
                  showType={gridVisibility.showType}
                  showQty
                  effectiveShowAmount={effectiveShowAmount}
                  canEditFieldRows={canEditFieldRows}
                  canEditFinancials={canEditFinancials}
                  onSetCell={setCellByIndex}
                  onSetExtra={setExtraCellByIndex}
                  onOpenFractionPicker={openFractionPicker}
                  onOpenHeaderOptionPicker={openHeaderOptionPicker}
                  onOpenRowTypePicker={openRowTypePicker}
                  onDuplicate={duplicateRow}
                  onDelete={deleteRow}
                  fractionAnchorRefs={fractionAnchorRefs}
                  headerOptionAnchorRefs={headerOptionAnchorRefs}
                  rowTypeAnchorRefs={rowTypeAnchorRefs}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {canViewPricing ? (
          <View style={styles.pricingPanel}>
            {/* Header */}
            <View style={styles.pricingPanelHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Pricing</Text>
                <Text style={styles.sectionSub}>
                  Tax, adjustments, totals, invoice controls, and imported pricing
                </Text>
              </View>
              {!canViewPricingTotals ? (
                <View style={[styles.reviewStatusPill, styles.reviewStatusPillGold]}>
                  <Text style={[styles.reviewStatusText, styles.reviewStatusTextGold]}>Draft Setup</Text>
                </View>
              ) : null}
            </View>

            {/* Import Pricing Grid button */}
            {canEditFinancials ? (
              <Pressable onPress={() => void openPricingImport()} style={styles.importPricingBtn}>
                <Ionicons name="pricetag-outline" size={14} color={theme.colors.goldDark} />
                <Text style={styles.importPricingBtnText}>Import Pricing Grid</Text>
              </Pressable>
            ) : null}

            {/* Line item options are managed by the work order grid builder. */}
            {false ? (
            <View style={styles.pricingOptionsPanel}>
              <View style={styles.pricingOptionsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pricingOptionsTitle}>Line item options</Text>
                  <Text style={styles.pricingOptionsSub}>
                    Configure measured grid rows here. Labor and material are priced below as separate adjustments.
                  </Text>
                </View>
                <Text style={styles.pricingOptionsMeta}>Grid rows</Text>
              </View>

              <View style={styles.pricingOptionsList}>
                {ROW_TYPE_OPTIONS.filter((option) => option.value === "measured").map((option) => {
                  const lineOption = pricingLineOptions[option.value];
                  const isOnlyEnabledOption = option.value === "measured" || (lineOption.enabled && enabledPricingLineOptions.length === 1);
                  const iconName =
                    option.value === "measured"
                      ? "resize-outline"
                      : option.value === "labor"
                        ? "hammer-outline"
                        : "cube-outline";

                  return (
                    <View key={option.value} style={styles.pricingOptionRow}>
                      <Pressable
                        disabled={!canConfigurePricingLines}
                        onPress={() => {
                          if (isOnlyEnabledOption) {
                            Alert.alert("Measured stays active", "Labor and material are priced as separate boxes now, so measured rows stay active in the grid.");
                            return;
                          }
                          setPricingLineOption(option.value, { enabled: !lineOption.enabled });
                        }}
                        style={[
                          styles.pricingOptionToggle,
                          lineOption.enabled ? styles.pricingOptionToggleActive : null,
                          !canConfigurePricingLines ? styles.disabledBtn : null,
                        ]}
                      >
                        <Ionicons
                          name={lineOption.enabled ? "checkmark" : "close-outline"}
                          size={14}
                          color={lineOption.enabled ? theme.colors.goldDark : theme.colors.muted}
                        />
                      </Pressable>

                      <View style={styles.pricingOptionIcon}>
                        <Ionicons name={iconName} size={16} color={theme.colors.ink} />
                      </View>

                      <TextInput
                        value={lineOption.label}
                        onChangeText={(label) => setPricingLineOption(option.value, { label })}
                        placeholder={option.label}
                        placeholderTextColor={theme.colors.muted}
                        style={[
                          styles.pricingOptionLabelInput,
                          !canConfigurePricingLines ? styles.readOnlyInput : null,
                        ]}
                        editable={canConfigurePricingLines}
                      />

                      <View style={styles.pricingOptionControls}>
                        <Pressable
                          disabled={!canConfigurePricingLines}
                          onPress={() => setPricingLineOption(option.value, { showQuantity: !lineOption.showQuantity })}
                          style={[styles.pricingOptionChip, lineOption.showQuantity ? styles.pricingOptionChipActive : null]}
                        >
                          <Text style={[styles.pricingOptionChipText, lineOption.showQuantity ? styles.pricingOptionChipTextActive : null]}>
                            Qty
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={!canConfigurePricingLines}
                          onPress={() => setPricingLineOption(option.value, { showMeasurement: !lineOption.showMeasurement })}
                          style={[styles.pricingOptionChip, lineOption.showMeasurement ? styles.pricingOptionChipActive : null]}
                        >
                          <Text style={[styles.pricingOptionChipText, lineOption.showMeasurement ? styles.pricingOptionChipTextActive : null]}>
                            Measurements
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={!canConfigurePricingLines}
                          onPress={() => setPricingLineOption(option.value, { amountEditable: !lineOption.amountEditable })}
                          style={[styles.pricingOptionChip, lineOption.amountEditable ? styles.pricingOptionChipActive : null]}
                        >
                          <Text style={[styles.pricingOptionChipText, lineOption.amountEditable ? styles.pricingOptionChipTextActive : null]}>
                            Amount editable
                          </Text>
                        </Pressable>
                        <Pressable
                          disabled={!canConfigurePricingLines}
                          onPress={() =>
                            setPricingLineOption(option.value, {
                              pricingBehavior: lineOption.pricingBehavior === "unit" ? "fixed" : "unit",
                            })
                          }
                          style={[styles.pricingOptionChip, styles.pricingOptionChipActive]}
                        >
                          <Text style={[styles.pricingOptionChipText, styles.pricingOptionChipTextActive]}>
                            {lineOption.pricingBehavior === "unit" ? "Unit price" : "Fixed amount"}
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        disabled={!canEditFieldRows || !lineOption.enabled}
                        onPress={() => addRow(option.value)}
                        style={[
                          option.value === "measured" ? styles.addRowBtn : styles.secondaryBtnSmall,
                          (!canEditFieldRows || !lineOption.enabled) ? styles.disabledBtn : null,
                        ]}
                      >
                        <Ionicons
                          name="add"
                          size={16}
                          color={option.value === "measured" ? "#111" : theme.colors.ink}
                        />
                        <Text style={option.value === "measured" ? styles.addRowText : styles.secondaryText}>
                          Add
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
            ) : null}

            {canViewFinancials ? (
              <View style={styles.pricingInputRow}>
                <View style={styles.pricingInputGroup}>
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
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                    keyboardType="numeric"
                    editable={canEditFinancials}
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.metaLabel}>Installation</Text>
                  <TextInput
                    value={formatCurrencyDisplay(String(woMeta.installation ?? 0))}
                    onChangeText={(v) =>
                      setWoMeta((p) => ({ ...p, installation: Number(cleanDecimalInput(v) || "0") }))
                    }
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                    keyboardType="numeric"
                    editable={canEditFinancials}
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.metaLabel}>Labor</Text>
                  <TextInput
                    value={formatCurrencyDisplay(String(woMeta.labor ?? 0))}
                    onChangeText={(v) =>
                      setWoMeta((p) => ({ ...p, labor: Number(cleanDecimalInput(v) || "0") }))
                    }
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                    keyboardType="numeric"
                    editable={canEditFinancials}
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.metaLabel}>Material</Text>
                  <TextInput
                    value={formatCurrencyDisplay(String(woMeta.material ?? 0))}
                    onChangeText={(v) =>
                      setWoMeta((p) => ({ ...p, material: Number(cleanDecimalInput(v) || "0") }))
                    }
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                    keyboardType="numeric"
                    editable={canEditFinancials}
                  />
                </View>

                <View style={styles.pricingInputGroup}>
                  <Text style={styles.metaLabel}>Deposit</Text>
                  <TextInput
                    value={formatCurrencyDisplay(String(woMeta.deposit ?? 0))}
                    onChangeText={(v) =>
                      setWoMeta((p) => ({ ...p, deposit: Number(cleanDecimalInput(v) || "0") }))
                    }
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.metaInputSingle, !canEditFinancials ? styles.readOnlyInput : null]}
                    keyboardType="numeric"
                    editable={canEditFinancials}
                  />
                </View>
              </View>
            ) : null}

            {canViewPricingTotals ? (
              <>
            {/* Divider */}
            <View style={styles.pricingDivider} />

            {/* Totals */}
            <View style={styles.pricingTotals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLbl}>Subtotal</Text>
                <Text style={styles.totalVal}>{money(subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLbl}>Tax ({Number(taxRate).toFixed(2)}%)</Text>
                <Text style={styles.totalVal}>{money(tax)}</Text>
              </View>
              {canViewFinancials ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLbl}>Installation</Text>
                  <Text style={styles.totalVal}>{money(installation)}</Text>
                </View>
              ) : null}
              {canViewFinancials ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLbl}>Labor</Text>
                  <Text style={styles.totalVal}>{money(labor)}</Text>
                </View>
              ) : null}
              {canViewFinancials ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLbl}>Material</Text>
                  <Text style={styles.totalVal}>{money(material)}</Text>
                </View>
              ) : null}
              <View style={[styles.totalRow, styles.totalRowStrong]}>
                <Text style={[styles.totalLbl, styles.totalStrong]}>Total</Text>
                <Text style={[styles.totalVal, styles.totalStrongValue]}>{money(total)}</Text>
              </View>
              {canViewFinancials ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLbl}>Deposit</Text>
                    <Text style={styles.totalVal}>{money(deposit)}</Text>
                  </View>
                  <View style={[styles.totalRow, styles.totalRowStrong]}>
                    <Text style={[styles.totalLbl, styles.totalStrong]}>Balance Due</Text>
                    <Text style={[styles.totalVal, styles.totalStrongValue]}>{money(balanceDue)}</Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Divider */}
            <View style={styles.pricingDivider} />

            {/* Invoice visibility toggles */}
            <Text style={styles.metaLabel}>Invoice / export visibility</Text>
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
                label="Labor"
                value={invoiceVisibility.showLabor}
                onPress={() => setInvoiceVisibility("showLabor", !invoiceVisibility.showLabor)}
              />
              <VisibilityToggle
                label="Material"
                value={invoiceVisibility.showMaterial}
                onPress={() => setInvoiceVisibility("showMaterial", !invoiceVisibility.showMaterial)}
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

            {/* Signature line */}
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
              </>
            ) : (
              <View style={styles.pricingHiddenBanner}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.colors.muted} />
                <Text style={styles.pricingHiddenText}>
                  Totals and invoice controls stay hidden until review, but line setup is available here.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.pricingHiddenBanner}>
            <Ionicons name="lock-closed-outline" size={16} color={theme.colors.muted} />
            <Text style={styles.pricingHiddenText}>
              Pricing is hidden in draft - submit for review to unlock it.
            </Text>
          </View>
        )}

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
          onRequestClose={closeRowTypePicker}
        >
          <Pressable style={styles.dropdownBackdrop} onPress={closeRowTypePicker}>
            <Pressable
              onPress={() => {}}
              style={[
                styles.headerOptionDropdownMenu,
                rowTypeMenuStyle ?? styles.headerOptionDropdownMenuCentered,
              ]}
            >
              <View style={styles.headerOptionDropdownHeader}>
                <Text style={styles.headerOptionDropdownTitle}>Select line type</Text>
              </View>
              <ScrollView style={styles.fractionDropdownScroll} nestedScrollEnabled>
                {ROW_TYPE_OPTIONS.filter((option) => {
                  const currentRowType = rows[rowTypePicker.rowIndex]?.row_type;
                  return option.value === "measured" || currentRowType === option.value;
                }).map((option) => {
                  const selected = rows[rowTypePicker.rowIndex]?.row_type === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        if (rowTypePicker.rowIndex >= 0) {
                          setRowTypeByIndex(rowTypePicker.rowIndex, option.value);
                        }
                        closeRowTypePicker();
                      }}
                      style={({ pressed, hovered }: any) => [
                        styles.headerOptionDropdownOption,
                        pressed || hovered ? styles.headerOptionDropdownOptionHovered : null,
                        selected ? styles.headerOptionDropdownOptionSelected : null,
                      ]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons
                          name={
                            option.value === "measured"
                              ? "resize-outline"
                              : option.value === "labor"
                                ? "hammer-outline"
                                : "cube-outline"
                          }
                          size={14}
                          color={selected ? theme.colors.goldDark : theme.colors.ink}
                          style={{ marginRight: 8 }}
                        />
                        <Text
                          style={[
                            styles.headerOptionDropdownOptionText,
                            selected ? styles.headerOptionDropdownOptionTextSelected : null,
                          ]}
                        >
                          {rowTypeLabel(option.value, pricingLineOptions)}
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark" size={16} color={theme.colors.goldDark} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={fractionPicker.visible} transparent animationType="fade" onRequestClose={closeFractionPicker}>
          <Pressable style={styles.dropdownBackdrop} onPress={closeFractionPicker}>
            <Pressable
              onPress={() => {}}
              style={[
                styles.fractionDropdownMenu,
                fractionMenuStyle ?? styles.fractionDropdownMenuCentered,
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
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={headerOptionPicker.visible}
          transparent
          animationType="fade"
          onRequestClose={closeHeaderOptionPicker}
        >
          <Pressable style={styles.dropdownBackdrop} onPress={closeHeaderOptionPicker}>
            <Pressable
              onPress={() => {}}
              style={[
                styles.headerOptionDropdownMenu,
                headerOptionMenuStyle ?? styles.headerOptionDropdownMenuCentered,
              ]}
            >
              <View style={styles.headerOptionDropdownHeader}>
                <Text style={styles.headerOptionDropdownTitle}>{headerOptionPicker.title || "Select option"}</Text>
                <Text style={styles.headerOptionDropdownSub}>
                  Current: {headerOptionCurrentValue || "None"}
                </Text>
              </View>

              <ScrollView style={styles.fractionDropdownScroll} nestedScrollEnabled>
                <View style={styles.headerOptionDropdownGroup}>
                  <Text style={styles.headerOptionDropdownGroupLabel}>{headerOptionGroupLabel}</Text>
                  {headerOptionValues.map((option) => {
                    const selected = headerOptionCurrentValue === option;

                    return (
                      <Pressable
                        key={`${headerOptionPicker.headerId}-${option}`}
                        onPress={() => selectHeaderOption(option)}
                        style={({ pressed, hovered }: any) => [
                          styles.headerOptionDropdownOption,
                          pressed || hovered ? styles.headerOptionDropdownOptionHovered : null,
                          selected ? styles.headerOptionDropdownOptionSelected : null,
                        ]}
                      >
                        <View style={styles.headerOptionDropdownLeftRail}>
                          {selected ? <View style={styles.headerOptionDropdownAccent} /> : null}
                        </View>
                        <Text
                          style={[
                            styles.headerOptionDropdownOptionText,
                            selected ? styles.headerOptionDropdownOptionTextSelected : null,
                          ]}
                          numberOfLines={1}
                        >
                          {option}
                        </Text>
                        {selected ? (
                          <Ionicons name="checkmark" size={16} color={theme.colors.goldDark} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.headerOptionDropdownDivider} />
                <View style={styles.headerOptionDropdownGroup}>
                  <Text style={styles.headerOptionDropdownGroupLabel}>Actions</Text>
                  <Pressable
                    onPress={() => selectHeaderOption("")}
                    style={({ pressed, hovered }: any) => [
                      styles.headerOptionDropdownAction,
                      pressed || hovered ? styles.headerOptionDropdownActionHovered : null,
                    ]}
                  >
                    <View style={styles.headerOptionDropdownIconSlot}>
                      <Ionicons name="close-circle-outline" size={15} color="#B42318" />
                    </View>
                    <Text style={styles.headerOptionDropdownActionText}>Clear</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Import Pricing Grid Modal ────────────────────────────────── */}
        <Modal visible={showPricingImport} transparent animationType="slide"
          onRequestClose={() => setShowPricingImport(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPricingImport(false)}>
            <Pressable style={styles.importModalCard} onPress={() => {}}>

              {/* Header */}
              <View style={styles.importModalHeader}>
                {importSelectedId ? (
                  <Pressable onPress={() => setImportSelectedId("")} style={styles.importModalBack}>
                    <Ionicons name="chevron-back" size={16} color={theme.colors.ink} />
                    <Text style={styles.importModalBackText}>Back</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.importModalTitle}>Import Pricing Grid</Text>
                )}
                <Pressable onPress={() => setShowPricingImport(false)} style={styles.importModalClose}>
                  <Ionicons name="close" size={18} color={theme.colors.ink} />
                </Pressable>
              </View>

              <ScrollView style={styles.importModalBody} showsVerticalScrollIndicator={false}>
                {importLoading ? (
                  <Text style={styles.importModalMuted}>Loading...</Text>
                ) : !importSelectedId ? (
                  importCollections.length === 0 ? (
                    <Text style={styles.importModalMuted}>
                      No pricing collections found. Set them up in the Pricing page first.
                    </Text>
                  ) : (
                    importCollections.map(col => (
                      <Pressable key={col.id} onPress={() => void selectImportCollection(col.id)}
                        style={({ pressed }) => [styles.importCollectionItem, pressed ? styles.trPressed : null]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.importCollectionName}>{col.name}</Text>
                          <Text style={styles.importCollectionMeta}>{col.industry_type}</Text>
                        </View>
                        <View style={styles.importModeBadge}>
                          <Text style={styles.importModeBadgeText}>{col.pricing_mode}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} />
                      </Pressable>
                    ))
                  )
                ) : (
                  importPreviewRows.length === 0 &&
                  !importAdjustments.installation && !importAdjustments.labor && !importAdjustments.material ? (
                    <Text style={styles.importModalMuted}>
                      No prices matched. Make sure rows have dimensions set, or the collection has active rules.
                    </Text>
                  ) : (
                    <>
                      {importPreviewRows.length > 0 ? (
                        <View style={styles.importPreviewSection}>
                          <Text style={styles.importPreviewSectionLabel}>Row Amounts</Text>
                          {importPreviewRows.map((item, i) => (
                            <Pressable key={i} style={styles.importPreviewRow}
                              onPress={() => setImportPreviewRows(prev =>
                                prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p))}>
                              <View style={[styles.importCheckbox, item.selected ? styles.importCheckboxOn : null]}>
                                {item.selected
                                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                                  : null}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.importPreviewRowLabel}>Row #{item.inventoryNum}</Text>
                                <Text style={styles.importPreviewSource}>{item.source}</Text>
                              </View>
                              <View style={styles.importPreviewAmounts}>
                                <Text style={styles.importPreviewOld}>{item.currentAmount || "—"}</Text>
                                <Ionicons name="arrow-forward" size={11} color={theme.colors.muted} />
                                <Text style={styles.importPreviewNew}>{item.newAmountDisplay}</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      {(importAdjustments.installation > 0 || importAdjustments.labor > 0 || importAdjustments.material > 0) ? (
                        <View style={styles.importPreviewSection}>
                          <Text style={styles.importPreviewSectionLabel}>Adjustment Fields</Text>
                          {importAdjustments.installation > 0 ? (
                            <View style={styles.importAdjRow}>
                              <Text style={styles.importAdjLabel}>Installation</Text>
                              <Text style={styles.importAdjValue}>+${importAdjustments.installation.toFixed(2)}</Text>
                            </View>
                          ) : null}
                          {importAdjustments.labor > 0 ? (
                            <View style={styles.importAdjRow}>
                              <Text style={styles.importAdjLabel}>Labor</Text>
                              <Text style={styles.importAdjValue}>+${importAdjustments.labor.toFixed(2)}</Text>
                            </View>
                          ) : null}
                          {importAdjustments.material > 0 ? (
                            <View style={styles.importAdjRow}>
                              <Text style={styles.importAdjLabel}>Material</Text>
                              <Text style={styles.importAdjValue}>+${importAdjustments.material.toFixed(2)}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </>
                  )
                )}
              </ScrollView>

              {importSelectedId && !importLoading ? (
                <View style={styles.importModalFooter}>
                  <Pressable onPress={() => setShowPricingImport(false)} style={styles.importCancelBtn}>
                    <Text style={styles.importCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={applyPricingImport} style={styles.importApplyBtn}>
                    <Text style={styles.importApplyText}>
                      Apply {importPreviewRows.filter(r => r.selected).length > 0
                        ? `(${importPreviewRows.filter(r => r.selected).length} rows)`
                        : "Adjustments"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Invoice Preview Modal ─────────────────────────────────────── */}
        <Modal visible={showInvoicePreview} transparent animationType="slide" onRequestClose={() => setShowInvoicePreview(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowInvoicePreview(false)}>
            <Pressable style={styles.invoicePreviewCard} onPress={() => {}}>
              {/* Header */}
              <View style={styles.invoicePreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoicePreviewEyebrow}>Invoice Preview</Text>
                  <Text style={styles.invoicePreviewTitle}>{wo?.title ?? "Work Order"}</Text>
                  {wo?.client_name ? (
                    <Text style={styles.invoicePreviewMeta}>Client: {wo.client_name}</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => setShowInvoicePreview(false)} style={styles.invoicePreviewCloseBtn}>
                  <Ionicons name="close" size={20} color={theme.colors.ink} />
                </Pressable>
              </View>

              <ScrollView style={styles.invoicePreviewBody} showsVerticalScrollIndicator={false}>
                {/* Line items */}
                <View style={styles.invoicePreviewSection}>
                  <Text style={styles.invoicePreviewSectionLabel}>Line Items</Text>
                  {viewRows.length === 0 ? (
                    <Text style={styles.invoicePreviewEmpty}>No line items yet.</Text>
                  ) : (
                    <View style={styles.invoicePreviewTable}>
                      {/* Table header */}
                      <View style={styles.invoicePreviewTableHead}>
                        <Text style={[styles.invoicePreviewColLabel, { flex: 3 }]}>Item / Description</Text>
                        <Text style={[styles.invoicePreviewColLabel, { flex: 1, textAlign: "right" }]}>Qty</Text>
                        <Text style={[styles.invoicePreviewColLabel, { flex: 2, textAlign: "right" }]}>Amount</Text>
                      </View>
                      {viewRows.map((row, i) => {
                        const lineTotal = rowLineTotal(row, pricingLineOptions);
                        const measurement = formatMeasurement(row);
                        const extraEntries = Object.entries(row.extra ?? {})
                          .filter(([, v]) => (v ?? "").trim())
                          .slice(0, 2)
                          .map(([, v]) => v.trim())
                          .join(" · ");
                        return (
                          <View key={row.id ?? i} style={styles.invoicePreviewTableRow}>
                            <View style={{ flex: 3 }}>
                              <Text style={styles.invoicePreviewItemName} numberOfLines={1}>
                                {row.color.trim() || `${row.row_type.charAt(0).toUpperCase() + row.row_type.slice(1)} #${row.inventory_number}`}
                              </Text>
                              {measurement ? (
                                <Text style={styles.invoicePreviewItemMeta}>{measurement}</Text>
                              ) : null}
                              {extraEntries ? (
                                <Text style={styles.invoicePreviewItemMeta} numberOfLines={1}>{extraEntries}</Text>
                              ) : null}
                            </View>
                            <Text style={[styles.invoicePreviewItemMeta, { flex: 1, textAlign: "right" }]}>
                              {row.qty || "1"}
                            </Text>
                            <Text style={[styles.invoicePreviewItemAmount, { flex: 2, textAlign: "right" }]}>
                              {money(lineTotal)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Adjustments */}
                {(installation > 0 || labor > 0 || material > 0) ? (
                  <View style={styles.invoicePreviewSection}>
                    <Text style={styles.invoicePreviewSectionLabel}>Adjustments</Text>
                    {installation > 0 ? (
                      <View style={styles.invoicePreviewTotalRow}>
                        <Text style={styles.invoicePreviewTotalLabel}>Installation</Text>
                        <Text style={styles.invoicePreviewTotalValue}>{money(installation)}</Text>
                      </View>
                    ) : null}
                    {labor > 0 ? (
                      <View style={styles.invoicePreviewTotalRow}>
                        <Text style={styles.invoicePreviewTotalLabel}>Labor</Text>
                        <Text style={styles.invoicePreviewTotalValue}>{money(labor)}</Text>
                      </View>
                    ) : null}
                    {material > 0 ? (
                      <View style={styles.invoicePreviewTotalRow}>
                        <Text style={styles.invoicePreviewTotalLabel}>Material</Text>
                        <Text style={styles.invoicePreviewTotalValue}>{money(material)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Totals */}
                <View style={styles.invoicePreviewTotalsBox}>
                  <View style={styles.invoicePreviewTotalRow}>
                    <Text style={styles.invoicePreviewTotalLabel}>Subtotal</Text>
                    <Text style={styles.invoicePreviewTotalValue}>{money(subtotal)}</Text>
                  </View>
                  {tax > 0 ? (
                    <View style={styles.invoicePreviewTotalRow}>
                      <Text style={styles.invoicePreviewTotalLabel}>Tax ({Number(taxRate).toFixed(2)}%)</Text>
                      <Text style={styles.invoicePreviewTotalValue}>{money(tax)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.invoicePreviewTotalRow, styles.invoicePreviewTotalDivider]}>
                    <Text style={styles.invoicePreviewTotalBold}>Total</Text>
                    <Text style={styles.invoicePreviewTotalBold}>{money(total)}</Text>
                  </View>
                  {deposit > 0 ? (
                    <View style={styles.invoicePreviewTotalRow}>
                      <Text style={styles.invoicePreviewTotalLabel}>Deposit Paid</Text>
                      <Text style={styles.invoicePreviewTotalValue}>-{money(deposit)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.invoicePreviewTotalRow}>
                    <Text style={styles.invoicePreviewBalanceLabel}>Balance Due</Text>
                    <Text style={styles.invoicePreviewBalanceValue}>{money(balanceDue)}</Text>
                  </View>
                </View>
              </ScrollView>

              {/* Actions */}
              <View style={styles.invoicePreviewActions}>
                <Pressable
                  onPress={() => setShowInvoicePreview(false)}
                  style={styles.invoicePreviewCancelBtn}
                >
                  <Text style={styles.invoicePreviewCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setShowInvoicePreview(false);
                    await convertToInvoice();
                  }}
                  disabled={converting}
                  style={[styles.invoicePreviewConvertBtn, converting ? styles.disabledBtn : null]}
                >
                  <Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.invoicePreviewConvertText}>
                    {converting ? "Converting..." : "Convert to Invoice"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowDeleteConfirm(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Delete work order</Text>
              <Text style={styles.modalBodyText}>
                This will permanently delete {formatWorkOrderNumber(wo?.work_order_number)}. Use Archive if you only want to hide it from the active list.
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
                  <Ionicons name="document-text-outline" size={16} color={theme.colors.ink} />
                  <Text style={styles.exportOptionText}>PDF</Text>
                </Pressable>

                <Pressable onPress={exportWord} style={styles.exportOption}>
                  <Ionicons name="document-outline" size={16} color={theme.colors.ink} />
                  <Text style={styles.exportOptionText}>Word Document</Text>
                </Pressable>

                <Pressable onPress={exportExcel} style={styles.exportOption}>
                  <Ionicons name="grid-outline" size={16} color={theme.colors.ink} />
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
    backgroundColor: theme.colors.bg,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  backText: {
    fontWeight: "900",
    color: theme.colors.ink,
  },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  secondaryBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  secondaryText: {
    fontWeight: "900",
    color: theme.colors.ink,
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
    color: theme.colors.ink,
  },

  sub: {
    marginTop: 4,
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 14,
  },

  headerCard: {
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
  },

  reviewCard: {
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewStatusPillGold: {
    backgroundColor: "#DBEAFE",
    borderColor: theme.colors.gold,
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
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 12.5,
  },

  reviewStatusTextGold: {
    color: theme.colors.goldDark,
  },

  reviewStatusTextBlue: {
    color: "#1D4ED8",
  },

  reviewStatusTextGreen: {
    color: "#166534",
  },

  reviewActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  linkedInvoiceCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  linkedInvoiceLabel: {
    color: theme.colors.goldDark,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  linkedInvoiceTitle: {
    marginTop: 3,
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  linkedInvoiceMeta: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
  },

  invoiceReadyCard: {
    marginTop: 14,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  invoiceReadyText: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  reviewNoteInput: {
    minHeight: 80,
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.ink,
    fontWeight: "800",
  },

  reviewMetaGrid: {
    marginTop: 12,
    gap: 6,
  },

  reviewMetaText: {
    color: theme.colors.mutedSoft,
    fontWeight: "700",
    fontSize: 12,
  },

  gridCard: {
    padding: 0,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  visibilityCard: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
  },

  gridToolbar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    backgroundColor: theme.colors.surface2,
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

  headerVisibilityPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },

  headerVisibilityTitle: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  headerVisibilityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  headerVisibilityChip: {
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },

  headerVisibilityChipActive: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
  },

  headerVisibilityChipText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  headerVisibilityChipTextActive: {
    color: theme.colors.goldDark,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  sectionSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  templateDropdownWrap: {
    minWidth: 210,
    maxWidth: 260,
  },

  inlineLabel: {
    fontSize: 11.5,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    marginBottom: 6,
  },

  templateDropdownField: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
  },

  templateDropdownFieldText: {
    flex: 1,
    color: theme.colors.ink,
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
    borderColor: theme.colors.primaryActive,
    backgroundColor: theme.colors.primary,
  },

  addRowText: {
    fontWeight: "900",
    color: "#fff",
  },

  tableWrap: {
    // Outer wrapper: no height cap, no scroll.
  },

  tableHScroll: {
    // Horizontal scroll only; page handles vertical scroll.
  },

  thead: {
    flexDirection: "row",
    backgroundColor: theme.colors.mutedSurface,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },

  // Shared header cell
  thCell: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },

  // Keep for backward compat with renderStaticHeader (unused after refactor but harmless)
  thPress: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },

  thText: {
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    fontSize: 11.5,
  },

  // Shared body cell: all rows use this + a fixed `width`.
  tdCell: {
    height: ROW_HEIGHT,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    alignItems: "stretch",
    justifyContent: "center",
    overflow: "hidden",
  },

  tdCenter: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },

  tdGold: {
    backgroundColor: theme.colors.primarySoft,
  },

  tdLight: {
    backgroundColor: theme.colors.surface2,
    flexDirection: "row",
    gap: 6,
  },

  tdDimmed: {
    backgroundColor: theme.colors.mutedSurface,
  },

  sortBadge: {
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    fontSize: 11.5,
  },

  tr: {
    flexDirection: "row",
    alignItems: "stretch",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    minHeight: ROW_HEIGHT,
  },

  trStriped: {
    backgroundColor: "#F8FAFC",
  },

  trPressed: {
    opacity: 0.97,
  },

  inventoryText: {
    fontWeight: "900",
    color: theme.colors.goldDark,
    fontSize: 12.5,
  },

  rowTypeCellText: {
    fontWeight: "800",
    color: theme.colors.ink,
    fontSize: 12,
  },

  // Used inside tdCell for TextInput cells
  tdInput: {
    height: ROW_HEIGHT,
    paddingHorizontal: 8,
    fontWeight: "800",
    color: theme.colors.ink,
  },

  qtyHiddenText: {
    color: theme.colors.mutedSoft,
    fontWeight: "900",
  },

  // Measurement cell: flat row layout, fixed widths.
  measureShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
  },

  noMeasurementBox: {
    height: 36,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  noMeasurementText: {
    color: theme.colors.mutedSoft,
    fontWeight: "800",
    fontSize: 12,
  },

  measureMiniLabel: {
    width: 14,
    fontSize: 10.5,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    textAlign: "center",
  },

  measureInput: {
    width: 42,
    height: 30,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  measureWhole: {
    // Same as measureInput; kept for compatibility.
  },

  measureX: {
    fontWeight: "900",
    color: theme.colors.primary,
    fontSize: 13,
    width: 14,
    textAlign: "center",
  },

  fractionDropdownField: {
    width: 76,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },

  fractionDropdownText: {
    flex: 1,
    fontWeight: "800",
    color: theme.colors.ink,
    fontSize: 11,
    textAlign: "center",
  },

  dropdownBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },

  fractionDropdownMenu: {
    position: "absolute",
    maxHeight: 330,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 12,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
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
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },

  fractionDropdownOptionSelected: {
    backgroundColor: "#FFFBEB",
  },

  fractionDropdownOptionText: {
    color: "#111111",
    fontWeight: "700",
    fontSize: 13,
  },

  fractionDropdownOptionTextSelected: {
    color: theme.colors.goldDark,
    fontWeight: "900",
  },

  headerOptionDropdownMenu: {
    position: "absolute",
    maxHeight: 340,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 14,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    overflow: "visible",
  },

  headerOptionDropdownMenuCentered: {
    left: 20,
    right: 20,
    top: 120,
  },

  headerOptionDropdownHeader: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: theme.colors.surface,
  },

  headerOptionDropdownTitle: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 13,
  },

  headerOptionDropdownSub: {
    marginTop: 3,
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 11,
  },

  headerOptionDropdownGroup: {
    gap: 4,
  },

  headerOptionDropdownGroupLabel: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    color: theme.colors.muted,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  headerOptionDropdownDivider: {
    height: 1,
    marginHorizontal: 8,
    marginVertical: 8,
    backgroundColor: "#F3E8CF",
  },

  headerOptionDropdownAction: {
    minHeight: 40,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },

  headerOptionDropdownActionHovered: {
    backgroundColor: "#FFF7F7",
  },

  headerOptionDropdownIconSlot: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  headerOptionDropdownActionText: {
    color: "#B42318",
    fontWeight: "900",
    fontSize: 13,
  },

  headerOptionDropdownOption: {
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },

  headerOptionDropdownOptionSelected: {
    backgroundColor: "#FFFBEB",
  },

  headerOptionDropdownOptionHovered: {
    backgroundColor: theme.colors.surface2,
  },

  headerOptionDropdownOptionText: {
    flex: 1,
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },

  headerOptionDropdownOptionTextSelected: {
    color: theme.colors.goldDark,
    fontWeight: "900",
  },

  headerOptionDropdownLeftRail: {
    width: 4,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  headerOptionDropdownAccent: {
    width: 4,
    height: 24,
    borderRadius: 99,
    backgroundColor: theme.colors.gold,
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
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  customSelectCellText: {
    flex: 1,
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
    textAlign: "center",
  },

  customSelectPlaceholder: {
    color: theme.colors.muted,
  },

  measurementFieldCell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  customHybridCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.surface,
  },

  customHybridPress: {
    flex: 1,
    minWidth: 0,
    height: 34,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },

  customHybridInput: {
    flex: 1,
    minWidth: 0,
    height: 38,
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  customHybridButton: {
    width: 34,
    height: 34,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },

  fieldChoiceCell: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
    backgroundColor: theme.colors.surface,
  },

  fieldPillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },

  fieldSegmentedWrap: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },

  fieldPill: {
    minHeight: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 7,
    justifyContent: "center",
  },

  fieldSegment: {
    minHeight: 28,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 7,
    justifyContent: "center",
  },

  fieldChoiceActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },

  fieldChoiceText: {
    color: theme.colors.muted,
    fontSize: 10.5,
    fontWeight: "900",
  },

  fieldChoiceTextActive: {
    color: theme.colors.primaryActive,
  },

  fieldInlineInput: {
    height: 22,
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 0,
  },

  amountWrap: {
    flexDirection: "column",
    justifyContent: "center",
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
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
    color: theme.colors.mutedSoft,
  },

  readOnlyAmountInput: {
    opacity: 0.7,
  },

  lineTotal: {
    marginTop: 2,
    textAlign: "right",
    fontWeight: "900",
    color: theme.colors.ink,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  visibilityChipOn: {
    backgroundColor: "#DBEAFE",
    borderColor: theme.colors.gold,
  },

  visibilityChipText: {
    fontWeight: "800",
    color: theme.colors.ink,
    fontSize: 12.5,
  },

  visibilityChipTextOn: {
    color: theme.colors.goldDark,
  },

  totalsBox: {
    width: 320,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    color: theme.colors.mutedSoft,
    fontWeight: "800",
  },

  totalVal: {
    color: theme.colors.ink,
    fontWeight: "900",
  },

  totalStrong: {
    fontWeight: "900",
    color: theme.colors.ink,
  },

  totalStrongValue: {
    fontWeight: "900",
    color: theme.colors.goldDark,
    fontSize: 16,
  },

  signatureRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 16,
    paddingBottom: 4,
  },

  sigLabel: {
    color: theme.colors.muted,
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
    color: theme.colors.mutedSoft,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 6,
  },

  metaInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.ink,
    fontWeight: "800",
  },

  metaInputSingle: {
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontWeight: "900",
  },

  infoChip: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  infoChipText: {
    flex: 1,
    color: theme.colors.ink,
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
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
    marginBottom: 12,
  },

  modalBodyText: {
    color: theme.colors.ink,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 14,
  },

  modalCloseBtn: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  modalCloseText: {
    fontWeight: "900",
    color: theme.colors.ink,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  modalCancelText: {
    fontWeight: "900",
    color: theme.colors.ink,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  exportOptionText: {
    fontWeight: "800",
    color: theme.colors.ink,
  },

  templateOption: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  templateOptionActive: {
    backgroundColor: "#DBEAFE",
    borderColor: theme.colors.gold,
  },

  templateOptionText: {
    fontWeight: "800",
    color: theme.colors.ink,
  },

  templateOptionTextActive: {
    color: theme.colors.goldDark,
    fontWeight: "900",
  },

  // Pricing panel.
  pricingPanel: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 14,
  },

  pricingPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  pricingInputRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  pricingInputGroup: {
    flex: 1,
    minWidth: 120,
  },

  pricingOptionsPanel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    padding: 14,
    gap: 12,
  },

  pricingOptionsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  pricingOptionsTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  pricingOptionsSub: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  pricingOptionsMeta: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  pricingOptionsList: {
    gap: 10,
  },

  pricingOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  pricingOptionToggle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  pricingOptionToggleActive: {
    borderColor: theme.colors.gold,
    backgroundColor: "#FFF7D6",
  },

  pricingOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  pricingOptionLabelInput: {
    flex: 1,
    minWidth: 180,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontWeight: "800",
  },

  pricingOptionControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1.2,
    minWidth: 260,
  },

  pricingOptionChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  pricingOptionChipActive: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
  },

  pricingOptionChipText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },

  pricingOptionChipTextActive: {
    color: theme.colors.goldDark,
  },

  pricingDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },

  pricingTotals: {
    gap: 2,
  },

  totalRowStrong: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },

  pricingHiddenBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  pricingHiddenText: {
    flex: 1,
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 13,
  },

  saveBannerError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.dangerBg,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },

  saveBannerErrorText: {
    flex: 1,
    color: "#B42318",
    fontWeight: "800",
    fontSize: 13,
  },

  saveBannerSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.successBg,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },

  saveBannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 13,
  },

  // ── Invoice Preview Modal ──────────────────────────────────────────────────
  invoicePreviewCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  invoicePreviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  invoicePreviewEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  invoicePreviewTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  invoicePreviewMeta: {
    fontSize: 12.5,
    color: theme.colors.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  invoicePreviewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  invoicePreviewBody: {
    flex: 1,
    paddingHorizontal: 18,
  },
  invoicePreviewSection: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  invoicePreviewSectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  invoicePreviewEmpty: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "600",
    fontStyle: "italic",
  },
  invoicePreviewTable: { gap: 0 },
  invoicePreviewTableHead: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  invoicePreviewColLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  invoicePreviewTableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
    alignItems: "flex-start",
  },
  invoicePreviewItemName: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  invoicePreviewItemMeta: {
    fontSize: 11.5,
    color: theme.colors.muted,
    fontWeight: "600",
    marginTop: 2,
  },
  invoicePreviewItemAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  invoicePreviewTotalsBox: {
    paddingVertical: 14,
    gap: 8,
  },
  invoicePreviewTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoicePreviewTotalDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  invoicePreviewTotalLabel: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "700",
  },
  invoicePreviewTotalValue: {
    fontSize: 13,
    color: theme.colors.ink,
    fontWeight: "700",
  },
  invoicePreviewTotalBold: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  invoicePreviewBalanceLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  invoicePreviewBalanceValue: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.goldDark,
  },
  invoicePreviewActions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  invoicePreviewCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  invoicePreviewCancelText: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  invoicePreviewConvertBtn: {
    flex: 2,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  invoicePreviewConvertText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  importPricingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: "#FFFBEB",
  },
  importPricingBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.goldDark,
  },

  importModalCard: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "85%",
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  importModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  importModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  importModalBack: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  importModalBackText: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  importModalClose: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  importModalBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  importModalMuted: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: "600",
    fontStyle: "italic",
    paddingVertical: 16,
  },
  importCollectionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  importCollectionName: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  importCollectionMeta: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "600",
    marginTop: 2,
  },
  importModeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.gold,
  },
  importModeBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
    textTransform: "capitalize",
  },
  importPreviewSection: {
    paddingBottom: 14,
  },
  importPreviewSectionLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginVertical: 10,
  },
  importPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  importCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  importCheckboxOn: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  importPreviewRowLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  importPreviewSource: {
    fontSize: 11.5,
    color: theme.colors.muted,
    fontWeight: "600",
    marginTop: 2,
  },
  importPreviewAmounts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  importPreviewOld: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  importPreviewNew: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.goldDark,
  },
  importAdjRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  importAdjLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  importAdjValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#166534",
  },
  importModalFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  importCancelBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  importCancelText: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  importApplyBtn: {
    flex: 2,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  importApplyText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
  },
});
