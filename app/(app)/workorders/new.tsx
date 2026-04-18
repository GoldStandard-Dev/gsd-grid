import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import Screen from "../../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
} from "../../../src/components/AppPage";
import { getUserOrgId } from "../../../src/lib/auth";
import { logActivity } from "../../../src/lib/activity";
import { formatWorkOrderNumber } from "../../../src/lib/format";
import { supabase } from "../../../src/lib/supabase";
import { theme } from "../../../src/theme/theme";

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

type AddressFields = {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type HeaderFieldType = "text" | "dropdown" | "number" | "date" | "notes" | "measurement";
type HeaderWidthSize = "small" | "medium" | "large" | "full";
type HeaderDisplayStyle = "dropdown" | "pills" | "segmented" | "text" | "measurement";
type HeaderColumnRole = "primary" | "measurement" | "descriptor" | "attribute" | "system";
type HeaderMeasurementUnit = "inches" | "feet" | "sqft";
type HeaderMeasurementFormat = "width_height" | "single_value";

type ConditionalLogic = {
  showIfFieldId: string;   // id of the controlling field
  showIfValue: string;     // value that triggers visibility
};

type TemplateHeader = {
  id: string;
  label: string;
  enabled: boolean;
  fieldType?: HeaderFieldType;
  optionSource?: string;
  options?: string[];
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  columnRole?: HeaderColumnRole;
  helpText?: string;
  widthSize?: HeaderWidthSize;
  displayStyle?: HeaderDisplayStyle;
  allowManualEntry?: boolean;
  multiSelect?: boolean;
  measurementUnit?: HeaderMeasurementUnit;
  measurementFractions?: boolean;
  measurementFormat?: HeaderMeasurementFormat;
  conditionalLogic?: ConditionalLogic | null;
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
  jobAddress?: string;
  jobAddressFields?: AddressFields;
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
  {
    name: "HVAC",
    headers: [
      { id: "mount", label: "TYPE", enabled: true, options: ["AC Unit", "Heat Pump", "Furnace", "Mini Split", "Boiler"] },
      { id: "val", label: "TONNAGE", enabled: true, options: ["1.5T", "2T", "2.5T", "3T", "3.5T", "4T", "5T"] },
      { id: "opening", label: "SERVICE", enabled: true, options: ["New Install", "Replace", "Repair", "Maintenance", "Ductwork"] },
      { id: "prod", label: "BRAND", enabled: true, options: ["Carrier", "Trane", "Lennox", "Rheem", "Owner Supplied"] },
    ],
    previewRows: [
      { measurement: "2.5T unit", color: "White", fields: { mount: "AC Unit", val: "2.5T", opening: "Replace", prod: "Carrier" } },
      { measurement: "3T system", color: "Beige", fields: { mount: "Heat Pump", val: "3T", opening: "New Install", prod: "Trane" } },
    ],
  },
  {
    name: "Roofing",
    headers: [
      { id: "mount", label: "MATERIAL", enabled: true, options: ["Asphalt / 3-Tab", "Architectural", "Metal", "Tile", "TPO / Flat", "Modified Bit."] },
      { id: "val", label: "PITCH", enabled: true, options: ["Flat (1/12)", "Low (2-3/12)", "Med (4-5/12)", "Steep (6-8/12)", "Very Steep (9+)"] },
      { id: "opening", label: "SERVICE", enabled: true, options: ["Full Tear Off", "Overlay", "Repair", "Patch", "Inspection"] },
      { id: "prod", label: "BRAND", enabled: true, options: ["GAF", "CertainTeed", "Owens Corning", "Atlas", "Owner Supplied"] },
    ],
    previewRows: [
      { measurement: "24 squares", color: "Charcoal Gray", fields: { mount: "Architectural", val: "Med (4-5/12)", opening: "Full Tear Off", prod: "GAF" } },
      { measurement: "8 squares", color: "Weathered Wood", fields: { mount: "Asphalt / 3-Tab", val: "Steep (6-8/12)", opening: "Repair", prod: "Owens Corning" } },
    ],
  },
  {
    name: "Landscaping",
    headers: [
      { id: "mount", label: "SERVICE", enabled: true, options: ["Mow & Edge", "Trim & Shape", "Planting", "Hardscape", "Irrigation", "Cleanup"] },
      { id: "val", label: "FREQUENCY", enabled: true, options: ["One-Time", "Weekly", "Bi-Weekly", "Monthly", "Seasonal"] },
      { id: "opening", label: "ZONE", enabled: true, options: ["Front Yard", "Back Yard", "Side Yard", "Full Property", "Common Area"] },
      { id: "prod", label: "CONDITION", enabled: true, options: ["Clean", "Overgrown", "New Build", "Renovation", "Commercial"] },
    ],
    previewRows: [
      { measurement: "8,500 sq ft", color: "Bermuda Grass", fields: { mount: "Mow & Edge", val: "Bi-Weekly", opening: "Full Property", prod: "Clean" } },
      { measurement: "6 planting zones", color: "Mixed Beds", fields: { mount: "Planting", val: "One-Time", opening: "Front Yard", prod: "New Build" } },
    ],
  },
  {
    name: "Pressure Washing",
    headers: [
      { id: "mount", label: "SURFACE", enabled: true, options: ["Concrete / Sidewalk", "Driveway", "House Wash", "Deck / Fence", "Roof Wash", "Commercial"] },
      { id: "val", label: "CONDITION", enabled: true, options: ["Light Dirt", "Moderate", "Heavy Buildup", "Mold / Mildew", "Oil / Grease"] },
      { id: "opening", label: "METHOD", enabled: true, options: ["Pressure Wash", "Soft Wash", "Chemical + Rinse", "Hot Water", "Steam"] },
      { id: "prod", label: "AREA", enabled: true, options: ["Under 500 sqft", "500–1,500 sqft", "1,500–3,000 sqft", "Over 3,000 sqft"] },
    ],
    previewRows: [
      { measurement: "1,200 sq ft", color: "Concrete Gray", fields: { mount: "Driveway", val: "Moderate", opening: "Pressure Wash", prod: "500–1,500 sqft" } },
      { measurement: "2,000 sq ft", color: "White Siding", fields: { mount: "House Wash", val: "Mold / Mildew", opening: "Soft Wash", prod: "1,500–3,000 sqft" } },
    ],
  },
  {
    name: "General Contracting",
    headers: [
      { id: "mount", label: "TRADE", enabled: true, options: ["Carpentry", "Drywall", "Demo", "Concrete", "Framing", "Insulation", "Custom"] },
      { id: "val", label: "SCOPE", enabled: true, options: ["Small Repair", "Single Room", "Full Floor", "Whole Home", "New Construction"] },
      { id: "opening", label: "PHASE", enabled: true, options: ["Pre-Construction", "Rough-In", "Finish Work", "Punch List", "Ongoing"] },
      { id: "prod", label: "MATERIALS", enabled: true, options: ["Owner Supplied", "Contractor Supplied", "Allowance", "TBD / Estimate"] },
    ],
    previewRows: [
      { measurement: "1 room", color: "Standard", fields: { mount: "Drywall", val: "Single Room", opening: "Finish Work", prod: "Contractor Supplied" } },
      { measurement: "400 sq ft", color: "Demo scope", fields: { mount: "Demo", val: "Full Floor", opening: "Rough-In", prod: "TBD / Estimate" } },
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

const GRID_SYSTEM_FIELDS: TemplateHeader[] = [
  {
    id: "measurement",
    label: "MEASUREMENT",
    enabled: true,
    fieldType: "measurement",
    columnRole: "measurement",
    placeholder: '36" x 48"',
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

function normalizeHeader(header: TemplateHeader, index = 0): TemplateHeader {
  const label = header.label?.trim() || `HEADER ${index + 1}`;
  const optionSource = header.optionSource?.trim() || "";
  const fieldType: HeaderFieldType =
    header.fieldType === "text" ||
    header.fieldType === "number" ||
    header.fieldType === "date" ||
    header.fieldType === "notes" ||
    header.fieldType === "measurement"
      ? header.fieldType
      : "dropdown";
  const columnRole: HeaderColumnRole =
    header.columnRole === "primary" ||
    header.columnRole === "measurement" ||
    header.columnRole === "descriptor" ||
    header.columnRole === "attribute" ||
    header.columnRole === "system"
      ? header.columnRole
      : header.id === "measurement" || fieldType === "measurement"
        ? "measurement"
        : header.id === "color"
          ? "descriptor"
          : "attribute";
  const measurementUnit: HeaderMeasurementUnit =
    header.measurementUnit === "feet" || header.measurementUnit === "sqft" ? header.measurementUnit : "inches";
  const measurementFormat: HeaderMeasurementFormat =
    header.measurementFormat === "single_value" ? "single_value" : "width_height";
  return {
    ...header,
    label,
    enabled: header.enabled !== false,
    fieldType,
    columnRole,
    optionSource,
    options: Array.from(new Set((header.options ?? []).map((value) => value.trim()).filter(Boolean))),
    placeholder: header.placeholder ?? "",
    defaultValue: header.defaultValue ?? "",
    required: header.required === true,
    helpText: header.helpText ?? "",
    widthSize: header.widthSize ?? "medium",
    displayStyle: header.displayStyle ?? (fieldType === "measurement" ? "measurement" : "dropdown"),
    allowManualEntry: header.allowManualEntry === true,
    multiSelect: header.multiSelect === true,
    measurementUnit,
    measurementFractions: fieldType === "measurement" ? header.measurementFractions !== false : header.measurementFractions === true,
    measurementFormat,
  };
}

function ensureGridSystemFields(headers: TemplateHeader[]) {
  const seen = new Set(headers.map((header) => header.id));
  const systemFields = GRID_SYSTEM_FIELDS.filter((field) => !seen.has(field.id));
  return [...systemFields, ...headers];
}

function cloneHeaders(headers: TemplateHeader[]) {
  return ensureGridSystemFields(headers).map((header, index) => normalizeHeader(header, index));
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

function getMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function getCalendarDays(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const days: Array<{ key: string; day: number; iso: string; currentMonth: boolean }> = [];

  const startOffset = firstDay.getDay();
  for (let i = 0; i < startOffset; i += 1) {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() - (startOffset - i));
    days.push({
      key: `prev-${date.toISOString()}`,
      day: date.getDate(),
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      currentMonth: false,
    });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    days.push({
      key: `cur-${date.toISOString()}`,
      day,
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      currentMonth: true,
    });
  }

  while (days.length % 7 !== 0) {
    const nextIndex = days.length - (startOffset + lastDay.getDate()) + 1;
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, nextIndex);
    days.push({
      key: `next-${date.toISOString()}`,
      day: date.getDate(),
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      currentMonth: false,
    });
  }

  return days;
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

function formatAddressFields(address: AddressFields) {
  const line1 = [address.address1, address.address2].filter(Boolean).join(", ");
  const line2 = [address.city, address.state, address.zip].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" • ");
}

function createSavedTemplatePayload(name: string, sourceName: string, headers: TemplateHeader[]): SavedTemplate {
  return {
    id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    sourceName: sourceName.trim() || "Custom",
    headers: cloneHeaders(headers),
    createdAt: new Date().toISOString(),
  };
}

function getPreviewColumnWidth(header: TemplateHeader) {
  if (header.columnRole === "measurement" || header.columnRole === "descriptor") return 160;
  if (header.columnRole === "primary") return 180;

  switch (header.widthSize) {
    case "small":
      return 110;
    case "large":
      return 160;
    case "full":
      return 220;
    default:
      return 130;
  }
}

function mapWorkOrderStatusForDb(status: WorkOrderStatus) {
  switch (status) {
    case "Open":
      return "new";
    case "Scheduled":
      return "scheduled";
    case "In Progress":
      return "in_progress";
    case "On Hold":
      return "blocked";
    case "Closed":
      return "completed";
    default:
      return "new";
  }
}

const FIELD_TYPE_OPTIONS: Array<{ key: HeaderFieldType; label: string; description: string }> = [
  { key: "dropdown", label: "Dropdown", description: "Pick from a defined list" },
  { key: "text", label: "Text", description: "Free-form single line input" },
  { key: "number", label: "Number", description: "Numeric value input" },
  { key: "measurement", label: "Measurement", description: "Width × height or sq ft" },
  { key: "date", label: "Date", description: "Calendar date picker" },
  { key: "notes", label: "Notes", description: "Multi-line text block" },
];

const PRIMARY_FIELD_TYPE_OPTIONS = FIELD_TYPE_OPTIONS.filter((option) =>
  option.key === "text" || option.key === "dropdown" || option.key === "number"
);

const MORE_FIELD_TYPE_OPTIONS = FIELD_TYPE_OPTIONS.filter((option) =>
  option.key === "measurement" || option.key === "date" || option.key === "notes"
);

const FIELD_WIDTH_OPTIONS: Array<{ key: HeaderWidthSize; label: string }> = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
  { key: "full", label: "Full" },
];

const COLUMN_ROLE_OPTIONS: Array<{ key: HeaderColumnRole; label: string }> = [
  { key: "primary", label: "Primary" },
  { key: "measurement", label: "Measurement" },
  { key: "descriptor", label: "Descriptor" },
  { key: "attribute", label: "Attribute" },
];

const MEASUREMENT_UNIT_OPTIONS: Array<{ key: HeaderMeasurementUnit; label: string }> = [
  { key: "inches", label: "Inches" },
  { key: "feet", label: "Feet" },
  { key: "sqft", label: "Sq Ft" },
];

const MEASUREMENT_FORMAT_OPTIONS: Array<{ key: HeaderMeasurementFormat; label: string }> = [
  { key: "width_height", label: "Width x Height" },
  { key: "single_value", label: "Single Value" },
];

// Maps industry names to their corresponding template + pricing preset
const INDUSTRY_SETUP_MAP: Array<{
  industry: string;
  templateName: string;
  icon: string;
  description: string;
}> = [
  { industry: "Windows / Glass", templateName: "Windows", icon: "square-outline", description: "Mount, style, opening, series" },
  { industry: "Doors", templateName: "Doors", icon: "exit-outline", description: "Swing, hinge, opening, model" },
  { industry: "Flooring", templateName: "Flooring", icon: "layers-outline", description: "Install method, grade, area, SKU" },
  { industry: "Painting", templateName: "Painting", icon: "brush-outline", description: "Coats, sheen, room, product" },
  { industry: "Plumbing", templateName: "Plumbing", icon: "water-outline", description: "Type, size, location, model" },
  { industry: "Electrical", templateName: "Electrical", icon: "flash-outline", description: "Amp, volt, location, device" },
  { industry: "HVAC", templateName: "HVAC", icon: "thermometer-outline", description: "System type, tonnage, service, brand" },
  { industry: "Roofing", templateName: "Roofing", icon: "home-outline", description: "Material, pitch, service, brand" },
  { industry: "Landscaping", templateName: "Landscaping", icon: "leaf-outline", description: "Service, frequency, zone, condition" },
  { industry: "Pressure Washing", templateName: "Pressure Washing", icon: "rainy-outline", description: "Surface, condition, method, area" },
  { industry: "General Contracting", templateName: "General Contracting", icon: "construct-outline", description: "Trade, scope, phase, materials" },
  { industry: "General", templateName: "General", icon: "grid-outline", description: "Generic 4-field grid template" },
];

const FIELD_DISPLAY_OPTIONS: Array<{ key: HeaderDisplayStyle; label: string }> = [
  { key: "dropdown", label: "Dropdown" },
  { key: "measurement", label: "Measurement UI" },
  { key: "pills", label: "Pills" },
  { key: "segmented", label: "Segmented" },
  { key: "text", label: "Text" },
];

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
    jobAddress: (meta.jobAddress ?? "").trim() || undefined,
    jobAddressFields: meta.jobAddressFields,
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
  onOpenCalendar,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onOpenCalendar: () => void;
}) {
  return (
    <View style={styles.flexCol}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <Pressable onPress={onOpenCalendar} style={[styles.input, styles.dateInput, styles.dateButtonField]}>
          <Text style={styles.dateButtonText}>{formatIsoToMDY(value) || "Select date"}</Text>
        </Pressable>
        <Pressable onPress={onOpenCalendar} style={styles.todayBtn}>
          <Ionicons name="calendar-outline" size={16} color={theme.colors.goldDark} />
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
  const [openHeaderTypeMenuId, setOpenHeaderTypeMenuId] = useState<string | null>(null);
  const [expandedHeaderId, setExpandedHeaderId] = useState<string | null>(null);
  const [expandedAdvancedHeaderId, setExpandedAdvancedHeaderId] = useState<string | null>(null);
  const [newHeaderOptionInputs, setNewHeaderOptionInputs] = useState<Record<string, string>>({});
  const [startMode, setStartMode] = useState<"template" | "blank">("template");
  const [showAddFieldMenu, setShowAddFieldMenu] = useState(false);
  const [assignTiming, setAssignTiming] = useState<"later" | "now">("now");
  const [jobAddress1, setJobAddress1] = useState("");
  const [jobAddress2, setJobAddress2] = useState("");
  const [jobCity, setJobCity] = useState("");
  const [jobState, setJobState] = useState("");
  const [jobZip, setJobZip] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<"scheduled" | "due">("scheduled");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [notesExpanded, setNotesExpanded] = useState(false);

  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const [selectedSavedTemplateId, setSelectedSavedTemplateId] = useState("");

  useEffect(() => {
    void loadClients();
    void loadTeamMembers();
    void loadSavedTemplates();
  }, []);

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
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  );
  const formattedJobAddress = useMemo(
    () =>
      formatAddressFields({
        address1: jobAddress1,
        address2: jobAddress2,
        city: jobCity,
        state: jobState,
        zip: jobZip,
      }),
    [jobAddress1, jobAddress2, jobCity, jobState, jobZip]
  );

  const visibleHeaders = useMemo(() => customHeaders.filter((header) => header.enabled), [customHeaders]);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);
  const previewTemplate = useMemo(
    () => TEMPLATE_DEFINITIONS.find((template) => template.name === selectedTemplateName) ?? TEMPLATE_DEFINITIONS[0],
    [selectedTemplateName]
  );
  const selectedIndustrySetup = useMemo(
    () => INDUSTRY_SETUP_MAP.find((item) => item.templateName === selectedTemplateName) ?? INDUSTRY_SETUP_MAP[INDUSTRY_SETUP_MAP.length - 1],
    [selectedTemplateName]
  );
  const previewRows = useMemo(() => {
    return previewTemplate.previewRows.map((row, index) => {
      const nextFields: Record<string, string> = {};
      customHeaders.forEach((header) => {
        const defaultValue =
          header.id === "measurement"
            ? row.measurement
            : header.id === "color"
              ? row.color
              : row.fields?.[header.id] ?? header.defaultValue ?? "";
        nextFields[header.id] = defaultValue;
      });

      return {
        id: `${previewTemplate.name}-${index}`,
        fields: nextFields,
      };
    });
  }, [customHeaders, previewTemplate]);

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
      // Primary: load from Supabase (shared across all devices and team members)
      const activeOrgId = await resolveOrgId().catch(() => "");
      if (activeOrgId) {
        const res = await supabase
          .from("work_order_templates")
          .select("id, name, source_name, headers, created_at")
          .eq("org_id", activeOrgId)
          .order("created_at", { ascending: false });

        if (!res.error && Array.isArray(res.data)) {
          const normalized: SavedTemplate[] = res.data.map((row: any) => ({
            id: row.id,
            name: row.name,
            sourceName: row.source_name ?? "Custom",
            headers: cloneHeaders(Array.isArray(row.headers) ? row.headers : []),
            createdAt: row.created_at,
          }));
          setSavedTemplates(normalized);

          // Migrate any locally-saved templates that aren't in the DB yet
          try {
            const raw = await AsyncStorage.getItem(TEMPLATE_STORAGE_KEY);
            const local = raw ? (JSON.parse(raw) as SavedTemplate[]) : [];
            if (Array.isArray(local) && local.length > 0) {
              const dbNames = new Set(normalized.map((t) => t.name.toLowerCase()));
              const toMigrate = local.filter((t) => !dbNames.has(t.name.toLowerCase()));
              for (const t of toMigrate) {
                await supabase.from("work_order_templates").insert({
                  org_id: activeOrgId,
                  name: t.name,
                  source_name: t.sourceName ?? "Custom",
                  headers: t.headers,
                });
              }
              if (toMigrate.length > 0) {
                await AsyncStorage.removeItem(TEMPLATE_STORAGE_KEY);
                void loadSavedTemplates(); // reload after migration
              }
            }
          } catch { /* migration failure is non-critical */ }

          return;
        }
      }
    } catch { /* fall through to AsyncStorage */ }

    // Fallback: AsyncStorage (offline / pre-login)
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
    // Legacy local fallback — only used if Supabase save fails
    setSavedTemplates(nextTemplates);
    await AsyncStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
  }

  function chooseClient(client: ClientRow) {
    setSelectedClientId(client.id);
    setClientName(client.name);
    setClientQuery(client.name);
    setJobAddress1(client.address1 ?? "");
    setJobAddress2(client.address2 ?? "");
    setJobCity(client.city ?? "");
    setJobState(client.state ?? "");
    setJobZip(client.zip ?? "");
  }

  function applyTemplate(name: string) {
    const nextTemplate = TEMPLATE_DEFINITIONS.find((template) => template.name === name) ?? TEMPLATE_DEFINITIONS[0];
    setStartMode("template");
    setSelectedTemplateName(nextTemplate.name);
    setCustomHeaders(cloneHeaders(nextTemplate.headers));
    setOpenHeaderTypeMenuId(null);
    setExpandedHeaderId(null);
    setExpandedAdvancedHeaderId(null);
    setNewHeaderOptionInputs({});
  }

  function addCustomHeader(fieldType: HeaderFieldType = "dropdown") {
    const nextId = makeHeaderId();
    setCustomHeaders((prev) => [
      ...prev,
      normalizeHeader({
        id: nextId,
        label: `HEADER ${prev.length + 1}`,
        enabled: true,
        fieldType,
        optionSource: "",
        options: [],
        placeholder: "",
        defaultValue: "",
      }, prev.length),
    ]);
    setExpandedHeaderId(nextId);
    setShowAddFieldMenu(false);
    setExpandedAdvancedHeaderId(null);
    setOpenHeaderTypeMenuId(null);
  }

  function removeCustomHeader(headerId: string) {
    const nextHeaders = customHeaders.filter((header) => header.id !== headerId);
    if (!nextHeaders.length && startMode !== "blank") {
      Alert.alert("At least one header", "Keep at least one custom header on the template.");
      return;
    }
    if (nextHeaders.length > 0 && !nextHeaders.some((header) => header.enabled)) {
      nextHeaders[0].enabled = true;
    }
    setCustomHeaders(nextHeaders);
    setOpenHeaderTypeMenuId((prev) => (prev === headerId ? null : prev));
    setExpandedHeaderId((prev) => (prev === headerId ? null : prev));
    setExpandedAdvancedHeaderId((prev) => (prev === headerId ? null : prev));
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
    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId
          ? {
              ...header,
              label,
            }
          : header
      )
    );
  }

  function setHeaderDefaultFromOption(headerId: string, defaultValue: string) {
    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId
          ? {
              ...header,
              defaultValue,
            }
          : header
      )
    );
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

  function setHeaderFieldType(headerId: string, fieldType: HeaderFieldType) {
    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId
          ? {
              ...header,
              fieldType,
              columnRole: fieldType === "measurement" ? "measurement" : header.columnRole === "measurement" ? "attribute" : header.columnRole,
              displayStyle: fieldType === "measurement" ? "measurement" : header.displayStyle === "measurement" ? "dropdown" : header.displayStyle,
            }
          : header
      )
    );
    setOpenHeaderTypeMenuId(null);
  }

  function updateHeaderPlaceholder(headerId: string, placeholder: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, placeholder } : header))
    );
  }

  function updateHeaderDefaultValue(headerId: string, defaultValue: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, defaultValue } : header))
    );
  }

  function updateHeaderOptionSource(headerId: string, optionSource: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, optionSource } : header))
    );
  }

  function toggleHeaderRequired(headerId: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, required: !header.required } : header))
    );
  }

  function updateHeaderHelpText(headerId: string, helpText: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, helpText } : header))
    );
  }

  function updateHeaderColumnRole(headerId: string, columnRole: HeaderColumnRole) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, columnRole } : header))
    );
  }

  function updateHeaderWidthSize(headerId: string, widthSize: HeaderWidthSize) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, widthSize } : header))
    );
  }

  function updateHeaderDisplayStyle(headerId: string, displayStyle: HeaderDisplayStyle) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, displayStyle } : header))
    );
  }

  function toggleHeaderManualEntry(headerId: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, allowManualEntry: !header.allowManualEntry } : header))
    );
  }

  function toggleHeaderMultiSelect(headerId: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, multiSelect: !header.multiSelect } : header))
    );
  }

  function updateHeaderMeasurementUnit(headerId: string, measurementUnit: HeaderMeasurementUnit) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, measurementUnit } : header))
    );
  }

  function updateHeaderMeasurementFormat(headerId: string, measurementFormat: HeaderMeasurementFormat) {
    setCustomHeaders((prev) =>
      prev.map((header) => (header.id === headerId ? { ...header, measurementFormat } : header))
    );
  }

  function toggleHeaderMeasurementFractions(headerId: string) {
    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId
          ? { ...header, measurementFractions: !(header.measurementFractions !== false) }
          : header
      )
    );
  }

  function setHeaderConditionalLogic(headerId: string, logic: ConditionalLogic | null) {
    setCustomHeaders((prev) =>
      prev.map((header) =>
        header.id === headerId ? { ...header, conditionalLogic: logic } : header
      )
    );
  }

  function duplicateHeader(headerId: string) {
    const index = customHeaders.findIndex((header) => header.id === headerId);
    if (index === -1) return;
    const source = customHeaders[index];
    const duplicate = normalizeHeader(
      {
        ...source,
        id: makeHeaderId(),
        label: `${source.label} Copy`,
      },
      index + 1
    );
    const next = [...customHeaders];
    next.splice(index + 1, 0, duplicate);
    setCustomHeaders(next);
  }

  function startBlankBuilder() {
    setStartMode("blank");
    setSelectedSavedTemplateId("");
    setCustomHeaders([]);
    setOpenHeaderTypeMenuId(null);
    setExpandedAdvancedHeaderId(null);
    setNewHeaderOptionInputs({});
  }

  function openCalendar(target: "scheduled" | "due") {
    setCalendarTarget(target);
    const sourceValue = target === "scheduled" ? scheduledDate : dueDate;
    const sourceDate = sourceValue ? new Date(sourceValue) : new Date();
    setCalendarMonth(Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate);
    setCalendarOpen(true);
  }

  function selectCalendarDate(iso: string) {
    if (calendarTarget === "scheduled") {
      setScheduledDate(iso);
    } else {
      setDueDate(iso);
    }
    setCalendarOpen(false);
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

  function updateHeaderOption(headerId: string, optionIndex: number, nextOption: string) {
    setCustomHeaders((prev) =>
      prev.map((header) => {
        if (header.id !== headerId) return header;

        const nextOptions = [...(header.options ?? [])];
        const previousOption = nextOptions[optionIndex] ?? "";
        nextOptions[optionIndex] = nextOption;

        return {
          ...header,
          options: nextOptions,
          defaultValue: header.defaultValue === previousOption ? nextOption : header.defaultValue,
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

    try {
      const activeOrgId = await resolveOrgId();
      const { data: auth } = await supabase.auth.getUser();

      const { data: upserted, error } = await supabase
        .from("work_order_templates")
        .upsert(
          {
            org_id: activeOrgId,
            name: trimmedName,
            source_name: selectedTemplateName,
            headers: customHeaders,
            created_by_user_id: auth?.user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,name" }
        )
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      setSelectedSavedTemplateId(upserted?.id ?? "");
      await loadSavedTemplates();
      Alert.alert("Template saved", `${trimmedName} is ready to load anytime.`);
    } catch (error: any) {
      // Fallback to AsyncStorage if Supabase isn't available
      try {
        const payload = createSavedTemplatePayload(trimmedName, selectedTemplateName, customHeaders);
        const nextTemplates = [
          payload,
          ...savedTemplates.filter((template) => template.name.toLowerCase() !== trimmedName.toLowerCase()),
        ];
        await persistSavedTemplates(nextTemplates);
        setSelectedSavedTemplateId(payload.id);
        Alert.alert("Template saved (offline)", `${trimmedName} was saved locally.`);
      } catch (fallbackError: any) {
        Alert.alert("Save failed", fallbackError?.message ?? "Could not save the custom template.");
      }
    }
  }

  function loadSavedTemplate(templateId: string) {
    const match = savedTemplates.find((template) => template.id === templateId);
    if (!match) return;

    setSelectedSavedTemplateId(match.id);
    setTemplateSaveName(match.name);
    setSelectedTemplateName(match.sourceName || "Custom");
    setCustomHeaders(cloneHeaders(match.headers));
    setExpandedHeaderId(null);
    setExpandedAdvancedHeaderId(null);
    setNewHeaderOptionInputs({});
  }

  async function deleteSavedTemplate(templateId: string) {
    const match = savedTemplates.find((template) => template.id === templateId);
    if (!match) return;

    try {
      // Try Supabase first (UUID ids come from DB; legacy local ids start with "saved_")
      if (!templateId.startsWith("saved_")) {
        const { error } = await supabase
          .from("work_order_templates")
          .delete()
          .eq("id", templateId);
        if (error) throw new Error(error.message);
      }

      // Also clean up AsyncStorage fallback if present
      try {
        const nextTemplates = savedTemplates.filter((template) => template.id !== templateId);
        await AsyncStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(nextTemplates));
      } catch { /* non-critical */ }

      if (selectedSavedTemplateId === templateId) {
        setSelectedSavedTemplateId("");
      }
      await loadSavedTemplates();
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

      const normalizedHeaders = customHeaders.map((header, index) => normalizeHeader(header, index));

      const description = buildWorkOrderDescription({
        notes: notes.trim(),
        jobAddress: formattedJobAddress.trim(),
        jobAddressFields: {
          address1: jobAddress1.trim(),
          address2: jobAddress2.trim(),
          city: jobCity.trim(),
          state: jobState.trim(),
          zip: jobZip.trim(),
        },
        installation: 0,
        deposit: 0,
        headers: DEFAULT_HEADERS,
        invoiceVisibility: DEFAULT_INVOICE_VISIBILITY,
        selectedTemplateName,
        selectedTemplateLabel: selectedSavedTemplate?.name?.trim() || selectedTemplateName,
        customHeaders: normalizedHeaders,
        gridVisibility: { showQty: true, showAmount: false },
        reviewWorkflow: { status: "draft" },
        assignedTo: assignTiming === "now" && selectedAssignee
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
        assigned_to_user_id: assignTiming === "now" ? assignedUserId || null : null,
        created_by_user_id: actorId,
        work_order_number: nextWorkOrderNumber,
      };

      const insertRes = await supabase
        .from("work_orders")
        .insert(insertPayload)
        .select("id")
        .single();

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

      if (insertRes.data?.id) {
        const workOrderLabel = formatWorkOrderNumber(nextWorkOrderNumber);
        void logActivity(supabase, {
          org_id: activeOrgId,
          actor_user_id: actorId ?? null,
          actor_name:
            teamMembers.find((m) => m.user_id === actorId)?.display_name ||
            auth.user?.user_metadata?.full_name ||
            auth.user?.email ||
            "Team Member",
          action: `created work order ${workOrderLabel}`,
          entity_type: "work_order",
          entity_id: insertRes.data.id,
          details: {
            work_order_number: workOrderLabel,
            title: trimmedTitle,
            client_name: trimmedClient,
            template_name: selectedTemplateName,
          },
        });
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
      <AppPage>
        <PageHeader
          eyebrow="Operations"
          title="New Work Order"
          subtitle="Capture the essentials, choose a template, and build the grid without the extra noise."
          actions={[
            {
              label: "Save",
              onPress: () => Alert.alert("Drafts coming next", "Draft saving is not wired yet, but the builder layout is ready for it."),
            },
            {
              label: assignTiming === "later" ? "Assign Later" : "Assign Now",
              onPress: () => setAssignTiming((prev) => (prev === "later" ? "now" : "later")),
            },
            {
              label: saving ? "Submitting..." : "Submit",
              primary: true,
              onPress: () => {
                void createWorkOrder();
              },
            },
          ]}
        />

        <View style={styles.contentColumn}>
          <View style={styles.mainColumn}>
            <ContentCard
              title="Details"
              subtitle="Keep the basics in one compact place before you move into the grid."
            >
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
                  placeholderTextColor={theme.colors.muted}
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
                          onPress={() => {
                            chooseClient(client);
                          }}
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
                            <Ionicons name="checkmark-circle" size={18} color={theme.colors.goldDark} />
                          ) : null}
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Job Name</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Kitchen window replacement"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Address</Text>
                <View style={styles.section}>
                  <TextInput
                    value={jobAddress1}
                    onChangeText={setJobAddress1}
                    placeholder="Street address"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                  <TextInput
                    value={jobAddress2}
                    onChangeText={setJobAddress2}
                    placeholder="Apt, suite, unit, building"
                    placeholderTextColor={theme.colors.muted}
                    style={styles.input}
                  />
                  <View style={styles.doubleRow}>
                    <View style={styles.addressCityCol}>
                      <TextInput
                        value={jobCity}
                        onChangeText={setJobCity}
                        placeholder="City"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.addressStateCol}>
                      <TextInput
                        value={jobState}
                        onChangeText={(value) => setJobState(value.toUpperCase().slice(0, 2))}
                        placeholder="ST"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                        autoCapitalize="characters"
                        maxLength={2}
                      />
                    </View>
                    <View style={styles.addressZipCol}>
                      <TextInput
                        value={jobZip}
                        onChangeText={(value) => setJobZip(value.replace(/[^\d-]/g, "").slice(0, 10))}
                        placeholder="ZIP"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.input}
                        keyboardType="numbers-and-punctuation"
                        maxLength={10}
                      />
                    </View>
                  </View>
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
                <DateField label="Date" value={scheduledDate} onChange={setScheduledDate} onOpenCalendar={() => openCalendar("scheduled")} />
                <DateField label="Due Date" value={dueDate} onChange={setDueDate} onOpenCalendar={() => openCalendar("due")} />

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
                              {isActive ? <Ionicons name="checkmark-circle" size={18} color={theme.colors.goldDark} /> : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                </View>
              </View>

              {calendarOpen ? (
                <View style={styles.inlineCalendarCard}>
                  <View style={styles.calendarHeader}>
                    <Pressable
                      onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="chevron-back" size={14} color={theme.colors.ink} />
                    </Pressable>
                    <View style={styles.calendarTitleWrap}>
                      <Text style={styles.calendarTitle}>{getMonthLabel(calendarMonth)}</Text>
                    </View>
                    <Pressable
                      onPress={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="chevron-forward" size={14} color={theme.colors.ink} />
                    </Pressable>
                  </View>

                  <View style={styles.calendarWeekRow}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <Text key={day} style={styles.calendarWeekday}>
                        {day}
                      </Text>
                    ))}
                  </View>

                  <View style={styles.calendarGrid}>
                    {calendarDays.map((day) => {
                      const selected = (calendarTarget === "scheduled" ? scheduledDate : dueDate) === day.iso;
                      return (
                        <Pressable
                          key={day.key}
                          onPress={() => selectCalendarDate(day.iso)}
                          style={[styles.calendarDay, selected ? styles.calendarDaySelected : null]}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              !day.currentMonth ? styles.calendarDayMuted : null,
                              selected ? styles.calendarDayTextSelected : null,
                            ]}
                          >
                            {day.day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </ContentCard>

            <ContentCard
              title="Work Order Grid"
              subtitle="Choose a setup, customize the columns, then save or continue with a technician-ready grid."
            >
              {/* ── Industry Quick Setup ── */}
              <View style={styles.flowSteps}>
                {["Choose setup", "Customize fields", "Save / continue"].map((step, index) => (
                  <View key={step} style={[styles.flowStepPill, index === 0 ? styles.flowStepPillActive : null]}>
                    <Text style={[styles.flowStepNumber, index === 0 ? styles.flowStepNumberActive : null]}>{index + 1}</Text>
                    <Text style={[styles.flowStepText, index === 0 ? styles.flowStepTextActive : null]}>{step}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.setupShell}>
                <View style={styles.setupHeaderRow}>
                  <View>
                    <Text style={styles.subsectionTitle}>Choose setup</Text>
                    <Text style={styles.helper}>Pick an industry preset or start from a blank grid.</Text>
                  </View>
                </View>

                <View style={styles.industrySetupWrap}>
                  {INDUSTRY_SETUP_MAP.map((item) => {
                    const isActive = selectedTemplateName === item.templateName && startMode === "template";
                    return (
                      <Pressable
                        key={item.industry}
                        onPress={() => applyTemplate(item.templateName)}
                        style={({ pressed }) => [
                          styles.industryCardCompact,
                          isActive ? styles.industryCardCompactActive : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Ionicons
                          name={item.icon as any}
                          size={18}
                          color={isActive ? theme.colors.primaryHover : theme.colors.muted}
                        />
                        <Text
                          style={[styles.industryCardCompactLabel, isActive ? styles.industryCardCompactLabelActive : null]}
                          numberOfLines={2}
                        >
                          {item.industry}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.setupModeRow}>
                  <View style={styles.segmentedControl}>
                    {(["template", "blank"] as const).map((mode) => {
                      const isActive = startMode === mode;
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => {
                            if (mode === "template") {
                              setStartMode("template");
                              if (!customHeaders.length) applyTemplate(selectedTemplateName);
                            } else {
                              startBlankBuilder();
                            }
                          }}
                          style={[styles.segmentBtn, isActive ? styles.segmentBtnActive : null]}
                        >
                          <Text style={[styles.segmentBtnText, isActive ? styles.segmentBtnTextActive : null]}>
                            {mode === "template" ? "Use Template" : "Start Blank"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.setupSummaryRow}>
                  <View style={styles.setupSummaryPill}>
                    <Ionicons name={selectedIndustrySetup.icon as any} size={14} color={theme.colors.primaryHover} />
                    <Text style={styles.setupSummaryText}>
                      {startMode === "blank" ? "Blank grid selected" : `${selectedTemplateName} selected`}
                    </Text>
                  </View>

                  <View style={styles.setupSummaryPill}>
                    <Text style={styles.setupSummaryText}>{visibleHeaders.length} fields configured</Text>
                  </View>

                  {startMode === "template" ? (
                    <View style={styles.setupSummaryPillWide}>
                      <Text style={styles.setupSummaryText} numberOfLines={1}>
                        {selectedIndustrySetup.description}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.subsectionHeader}>
                <Text style={styles.subsectionTitle}>Field builder</Text>
                <Text style={styles.helper}>Build the core field first, then open behavior or advanced settings only when needed.</Text>
              </View>

              <View style={styles.templateBuilderTop}>
                <View style={styles.templateBuilderActions}>
                  <Pressable onPress={() => setShowAddFieldMenu((prev) => !prev)} style={styles.secondaryBtn}>
                    <Ionicons name="add" size={15} color={theme.colors.primaryHover} />
                    <Text style={styles.secondaryBtnText}>Add Field</Text>
                  </Pressable>

                  <Pressable onPress={() => applyTemplate(selectedTemplateName)} style={styles.secondaryBtn}>
                    <Ionicons name="refresh-outline" size={15} color={theme.colors.ink} />
                    <Text style={styles.secondaryBtnText}>Reset</Text>
                  </Pressable>

                  <Pressable onPress={saveCurrentTemplate} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Save Template</Text>
                  </Pressable>
                </View>
              </View>

              {showAddFieldMenu ? (
                <View style={styles.addFieldMenu}>
                  {PRIMARY_FIELD_TYPE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => addCustomHeader(option.key)}
                      style={styles.addFieldMenuItem}
                    >
                      <Text style={styles.addFieldMenuText}>{option.label}</Text>
                      <Text style={styles.addFieldMenuMeta}>{option.description}</Text>
                    </Pressable>
                  ))}
                  <View style={styles.addFieldMenuDivider} />
                  {MORE_FIELD_TYPE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => addCustomHeader(option.key)}
                      style={[styles.addFieldMenuItem, styles.addFieldMenuItemQuiet]}
                    >
                      <Text style={styles.addFieldMenuText}>{option.label}</Text>
                      <Text style={styles.addFieldMenuMeta}>{option.description}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {customHeaders.length === 0 ? (
                <View style={styles.blankStateWrap}>
                  <Text style={styles.helper}>No fields added yet. Start by adding a text, dropdown, number, date, notes, or measurement field.</Text>
                </View>
              ) : null}

              <View style={styles.headerGrid}>
                {customHeaders.map((header, index) => {
                  const optionPool = header.options ?? [];
                  const headerOptionInput = newHeaderOptionInputs[header.id] ?? "";
                  const fieldType = header.fieldType ?? "dropdown";
                  const fieldTypeLabel =
                    FIELD_TYPE_OPTIONS.find((item) => item.key === fieldType)?.label || "Dropdown";
                  const isAdvancedOpen = expandedAdvancedHeaderId === header.id;
                  const isExpanded = expandedHeaderId === header.id;
                  const roleLabel =
                    COLUMN_ROLE_OPTIONS.find((item) => item.key === (header.columnRole ?? "attribute"))?.label || "Attribute";
                  const isMoreTypeSelected = MORE_FIELD_TYPE_OPTIONS.some((item) => item.key === fieldType);

                  return (
                    <View key={header.id} style={[styles.headerCard, isExpanded ? styles.headerCardExpanded : null]}>
                      <View style={styles.headerCardTop}>
                        <View style={styles.headerCardSummary}>
                          <Text style={styles.headerCardIndex}>{index + 1}</Text>
                          <View style={styles.headerSummaryCopy}>
                            <Text style={styles.headerSummaryTitle} numberOfLines={1}>{header.label || "Untitled field"}</Text>
                            <Text style={styles.headerSummaryMeta} numberOfLines={1}>{fieldTypeLabel} | {roleLabel}{header.required ? " | Required" : ""}</Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => toggleHeaderEnabled(header.id)}
                          style={[styles.visibilitySwitch, header.enabled ? styles.visibilitySwitchOn : null]}
                        >
                          <View style={[styles.visibilitySwitchKnob, header.enabled ? styles.visibilitySwitchKnobOn : null]} />
                        </Pressable>
                        <Pressable onPress={() => setExpandedHeaderId(isExpanded ? null : header.id)} style={styles.fieldExpandBtn}>
                          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.primaryHover} />
                        </Pressable>
                      </View>

                      {isExpanded ? (
                        <>
                      <View style={styles.fieldSection}>
                        <View style={styles.fieldSectionHeader}>
                          <Text style={styles.headerFieldLabel}>Core</Text>
                          <View style={styles.fieldTypeBadge}>
                            <Text style={styles.fieldTypeBadgeText}>{fieldTypeLabel}</Text>
                          </View>
                        </View>

                        <TextInput
                          value={header.label}
                          onChangeText={(value) => renameHeader(header.id, value)}
                          placeholder="Field label"
                          placeholderTextColor={theme.colors.muted}
                          style={styles.input}
                        />

                        <View style={styles.fieldTypeRow}>
                          <Text style={styles.headerFieldLabel}>Field type</Text>
                          <View style={styles.fieldTypeChipRow}>
                            {PRIMARY_FIELD_TYPE_OPTIONS.map((typeOption) => {
                              const isActive = fieldType === typeOption.key;
                              return (
                                <Pressable
                                  key={typeOption.key}
                                  onPress={() => setHeaderFieldType(header.id, typeOption.key)}
                                  style={[styles.typeChip, isActive ? styles.typeChipActive : null]}
                                >
                                  <Text style={[styles.typeChipText, isActive ? styles.typeChipTextActive : null]}>
                                    {typeOption.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                            <Pressable
                              onPress={() => setOpenHeaderTypeMenuId((prev) => (prev === header.id ? null : header.id))}
                              style={[styles.typeChip, isMoreTypeSelected ? styles.typeChipActive : null]}
                            >
                              <Text style={[styles.typeChipText, isMoreTypeSelected ? styles.typeChipTextActive : null]}>
                                {isMoreTypeSelected ? fieldTypeLabel : "More types"}
                              </Text>
                            </Pressable>
                          </View>

                          {openHeaderTypeMenuId === header.id ? (
                            <View style={styles.moreTypeMenu}>
                              {MORE_FIELD_TYPE_OPTIONS.map((typeOption) => (
                                <Pressable
                                  key={typeOption.key}
                                  onPress={() => setHeaderFieldType(header.id, typeOption.key)}
                                  style={styles.moreTypeMenuItem}
                                >
                                  <Text style={styles.dropdownOptionText}>{typeOption.label}</Text>
                                  <Text style={styles.dropdownOptionMeta}>{typeOption.description}</Text>
                                </Pressable>
                              ))}
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.fieldTypeRow}>
                          <Text style={styles.headerFieldLabel}>Column role</Text>
                          <View style={styles.fieldTypeChipRow}>
                            {COLUMN_ROLE_OPTIONS.map((roleOption) => {
                              const isActive = (header.columnRole ?? "attribute") === roleOption.key;
                              return (
                                <Pressable
                                  key={roleOption.key}
                                  onPress={() => updateHeaderColumnRole(header.id, roleOption.key)}
                                  style={[styles.typeChip, isActive ? styles.typeChipActive : null]}
                                >
                                  <Text style={[styles.typeChipText, isActive ? styles.typeChipTextActive : null]}>
                                    {roleOption.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        <View style={styles.inlineToggleRow}>
                          <Pressable
                            onPress={() => toggleHeaderRequired(header.id)}
                            style={[styles.togglePill, header.required ? styles.togglePillOn : null]}
                          >
                            <Text style={[styles.togglePillText, header.required ? styles.togglePillTextOn : null]}>
                              {header.required ? "Required" : "Optional"}
                            </Text>
                          </Pressable>
                          {header.conditionalLogic ? (
                            <View style={styles.conditionalBadge}>
                              <Ionicons name="git-branch-outline" size={11} color={theme.colors.goldDark} />
                              <Text style={styles.conditionalBadgeText}>Conditional</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {fieldType === "dropdown" ? (
                        <View style={styles.behaviorSection}>
                          <View style={styles.fieldSectionHeader}>
                            <Text style={styles.headerFieldLabel}>Options</Text>
                            <View style={styles.compactToggleGroup}>
                              <Pressable
                                onPress={() => toggleHeaderMultiSelect(header.id)}
                                style={[styles.togglePill, header.multiSelect ? styles.togglePillOn : null]}
                              >
                                <Text style={[styles.togglePillText, header.multiSelect ? styles.togglePillTextOn : null]}>
                                  {header.multiSelect ? "Multi-select" : "Single-select"}
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => toggleHeaderManualEntry(header.id)}
                                style={[styles.togglePill, header.allowManualEntry ? styles.togglePillOn : null]}
                              >
                                <Text style={[styles.togglePillText, header.allowManualEntry ? styles.togglePillTextOn : null]}>
                                  Custom input
                                </Text>
                              </Pressable>
                            </View>
                          </View>

                          <TextInput
                            value={header.optionSource ?? ""}
                            onChangeText={(value) => updateHeaderOptionSource(header.id, value)}
                            placeholder="Shared list, or leave custom"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />

                          <View style={styles.optionList}>
                            {optionPool.length === 0 ? (
                              <View style={styles.dropdownEmptyState}>
                                <Text style={styles.dropdownEmptyText}>No options yet.</Text>
                              </View>
                            ) : (
                              optionPool.map((option, optionIndex) => (
                                <View key={`${header.id}-${optionIndex}`} style={styles.inlineOptionRow}>
                                  <TextInput
                                    value={option}
                                    onChangeText={(value) => updateHeaderOption(header.id, optionIndex, value)}
                                    placeholder={`Option ${optionIndex + 1}`}
                                    placeholderTextColor={theme.colors.muted}
                                    style={styles.inlineOptionInput}
                                  />
                                  <Pressable onPress={() => setHeaderDefaultFromOption(header.id, option)} style={styles.optionIconBtn}>
                                    <Ionicons
                                      name={header.defaultValue === option ? "checkmark-circle" : "ellipse-outline"}
                                      size={16}
                                      color={header.defaultValue === option ? theme.colors.goldDark : theme.colors.muted}
                                    />
                                  </Pressable>
                                  <Pressable onPress={() => removeHeaderOption(header.id, option)} style={styles.optionDeleteBtn}>
                                    <Ionicons name="close" size={14} color="#9f3b2f" />
                                  </Pressable>
                                </View>
                              ))
                            )}

                            <View style={styles.inlineOptionAddRow}>
                              <TextInput
                                value={headerOptionInput}
                                onChangeText={(value) =>
                                  setNewHeaderOptionInputs((prev) => ({
                                    ...prev,
                                    [header.id]: value,
                                  }))
                                }
                                placeholder="Add option"
                                placeholderTextColor={theme.colors.muted}
                                style={styles.inlineOptionInput}
                                onSubmitEditing={() => addOptionToHeader(header.id)}
                              />
                              <Pressable onPress={() => addOptionToHeader(header.id)} style={styles.optionAddBtn}>
                                <Ionicons name="add" size={14} color="#FFFFFF" />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ) : null}

                      {fieldType === "measurement" ? (
                        <View style={styles.behaviorSection}>
                          <View style={styles.fieldSectionHeader}>
                            <Text style={styles.headerFieldLabel}>Measurement</Text>
                            <Pressable
                              onPress={() => toggleHeaderMeasurementFractions(header.id)}
                              style={[styles.togglePill, header.measurementFractions !== false ? styles.togglePillOn : null]}
                            >
                              <Text style={[styles.togglePillText, header.measurementFractions !== false ? styles.togglePillTextOn : null]}>
                                Fractions {header.measurementFractions !== false ? "On" : "Off"}
                              </Text>
                            </Pressable>
                          </View>

                          <Text style={styles.headerFieldLabel}>Units</Text>
                          <View style={styles.fieldTypeChipRow}>
                            {MEASUREMENT_UNIT_OPTIONS.map((unitOption) => {
                              const isActive = (header.measurementUnit ?? "inches") === unitOption.key;
                              return (
                                <Pressable
                                  key={unitOption.key}
                                  onPress={() => updateHeaderMeasurementUnit(header.id, unitOption.key)}
                                  style={[styles.typeChip, isActive ? styles.typeChipActive : null]}
                                >
                                  <Text style={[styles.typeChipText, isActive ? styles.typeChipTextActive : null]}>
                                    {unitOption.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <Text style={styles.headerFieldLabel}>Format</Text>
                          <View style={styles.fieldTypeChipRow}>
                            {MEASUREMENT_FORMAT_OPTIONS.map((formatOption) => {
                              const isActive = (header.measurementFormat ?? "width_height") === formatOption.key;
                              return (
                                <Pressable
                                  key={formatOption.key}
                                  onPress={() => updateHeaderMeasurementFormat(header.id, formatOption.key)}
                                  style={[styles.typeChip, isActive ? styles.typeChipActive : null]}
                                >
                                  <Text style={[styles.typeChipText, isActive ? styles.typeChipTextActive : null]}>
                                    {formatOption.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <View style={styles.measurementPreviewBox}>
                            <Text style={styles.headerFieldLabel}>Format preview</Text>
                            <Text style={styles.measurementPreviewText}>
                              {(header.measurementFormat ?? "width_height") === "width_height" ? '36" x 48"' : "240 sq ft"}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {fieldType === "date" ? (
                        <View style={styles.behaviorSection}>
                          <Text style={styles.headerFieldLabel}>Default date</Text>
                          <TextInput
                            value={header.defaultValue ?? ""}
                            onChangeText={(value) => updateHeaderDefaultValue(header.id, value)}
                            placeholder="MM-DD-YYYY"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />
                        </View>
                      ) : null}

                      {fieldType === "notes" ? (
                        <View style={styles.behaviorSection}>
                          <Text style={styles.headerFieldLabel}>Notes prompt</Text>
                          <TextInput
                            value={header.placeholder ?? ""}
                            onChangeText={(value) => updateHeaderPlaceholder(header.id, value)}
                            placeholder="What should the tech write here?"
                            placeholderTextColor={theme.colors.muted}
                            style={[styles.input, styles.optionsInput]}
                            multiline
                          />
                        </View>
                      ) : null}

                      <Pressable
                        onPress={() => setExpandedAdvancedHeaderId((prev) => (prev === header.id ? null : header.id))}
                        style={styles.advancedToggle}
                      >
                        <View>
                          <Text style={styles.advancedToggleTitle}>Advanced Settings</Text>
                          <Text style={styles.advancedToggleMeta}>
                            Placeholder, default, display, help, rules, width
                          </Text>
                        </View>
                        <Ionicons
                          name={isAdvancedOpen ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={theme.colors.ink}
                        />
                      </Pressable>

                      {isAdvancedOpen ? (
                        <View style={styles.advancedPanel}>
                          <Text style={styles.headerFieldLabel}>Field content</Text>
                          {fieldType !== "date" && fieldType !== "measurement" && fieldType !== "notes" ? (
                            <TextInput
                              value={header.placeholder ?? ""}
                              onChangeText={(value) => updateHeaderPlaceholder(header.id, value)}
                              placeholder={fieldType === "dropdown" ? "Select an option" : "Enter placeholder"}
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          ) : null}

                          {fieldType !== "date" ? (
                            <TextInput
                              value={header.defaultValue ?? ""}
                              onChangeText={(value) => updateHeaderDefaultValue(header.id, value)}
                              placeholder="Optional default value"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          ) : null}

                          <Text style={styles.headerFieldLabel}>Display</Text>
                          <View style={styles.fieldTypeChipRow}>
                            {FIELD_DISPLAY_OPTIONS.map((displayOption) => {
                              const isActive = (header.displayStyle ?? "dropdown") === displayOption.key;
                              return (
                                <Pressable
                                  key={displayOption.key}
                                  onPress={() => updateHeaderDisplayStyle(header.id, displayOption.key)}
                                  style={[styles.typeChip, isActive ? styles.typeChipActive : null]}
                                >
                                  <Text style={[styles.typeChipText, isActive ? styles.typeChipTextActive : null]}>
                                    {displayOption.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <Text style={styles.headerFieldLabel}>Help</Text>
                          <TextInput
                            value={header.helpText ?? ""}
                            onChangeText={(value) => updateHeaderHelpText(header.id, value)}
                            placeholder="Optional helper text shown below the field"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.input}
                          />

                          <View style={styles.conditionalSection}>
                            <View style={styles.conditionalSectionHeader}>
                              <Text style={styles.headerFieldLabel}>Conditional visibility</Text>
                              {header.conditionalLogic ? (
                                <Pressable onPress={() => setHeaderConditionalLogic(header.id, null)} style={styles.conditionalClearBtn}>
                                  <Text style={styles.conditionalClearBtnText}>Clear</Text>
                                </Pressable>
                              ) : null}
                            </View>
                            {header.conditionalLogic ? (
                              <View style={styles.conditionalBuilder}>
                                <Text style={styles.conditionalRule}>
                                  Show when{" "}
                                  <Text style={styles.conditionalRuleStrong}>
                                    {customHeaders.find((h) => h.id === header.conditionalLogic?.showIfFieldId)?.label || "field"}
                                  </Text>
                                  {" = "}
                                  <Text style={styles.conditionalRuleStrong}>
                                    {header.conditionalLogic?.showIfValue || "value"}
                                  </Text>
                                </Text>
                                <TextInput
                                  value={header.conditionalLogic?.showIfValue ?? ""}
                                  onChangeText={(value) =>
                                    setHeaderConditionalLogic(header.id, {
                                      ...header.conditionalLogic!,
                                      showIfValue: value,
                                    })
                                  }
                                  placeholder="Value that triggers this field"
                                  placeholderTextColor={theme.colors.muted}
                                  style={styles.input}
                                />
                                <Text style={styles.headerFieldLabel}>Controlling field</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                                  {customHeaders.filter((h) => h.id !== header.id).map((h) => (
                                    <Pressable
                                      key={h.id}
                                      onPress={() =>
                                        setHeaderConditionalLogic(header.id, {
                                          showIfFieldId: h.id,
                                          showIfValue: header.conditionalLogic?.showIfValue ?? "",
                                        })
                                      }
                                      style={[
                                        styles.typeChip,
                                        header.conditionalLogic?.showIfFieldId === h.id ? styles.typeChipActive : null,
                                      ]}
                                    >
                                      <Text style={[styles.typeChipText, header.conditionalLogic?.showIfFieldId === h.id ? styles.typeChipTextActive : null]}>
                                        {h.label}
                                      </Text>
                                    </Pressable>
                                  ))}
                                </ScrollView>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() =>
                                  setHeaderConditionalLogic(header.id, {
                                    showIfFieldId: customHeaders.find((h) => h.id !== header.id)?.id ?? "",
                                    showIfValue: "",
                                  })
                                }
                                style={styles.conditionalAddBtn}
                              >
                                <Ionicons name="git-branch-outline" size={13} color={theme.colors.muted} />
                                <Text style={styles.conditionalAddBtnText}>Add show/hide rule</Text>
                              </Pressable>
                            )}
                          </View>

                          <Text style={styles.headerFieldLabel}>Width</Text>
                          <View style={styles.fieldTypeChipRow}>
                            {FIELD_WIDTH_OPTIONS.map((widthOption) => {
                              const isActive = (header.widthSize ?? "medium") === widthOption.key;
                              return (
                                <Pressable
                                  key={widthOption.key}
                                  onPress={() => updateHeaderWidthSize(header.id, widthOption.key)}
                                  style={[styles.typeChip, isActive ? styles.typeChipActive : null]}
                                >
                                  <Text style={[styles.typeChipText, isActive ? styles.typeChipTextActive : null]}>
                                    {widthOption.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      ) : null}
                        </>
                      ) : null}

                      <View style={styles.headerActions}>
                        <Pressable onPress={() => moveHeader(header.id, -1)} style={styles.iconBtn}>
                          <Ionicons name="arrow-back" size={14} color={theme.colors.ink} />
                        </Pressable>
                        <Pressable onPress={() => moveHeader(header.id, 1)} style={styles.iconBtn}>
                          <Ionicons name="arrow-forward" size={14} color={theme.colors.ink} />
                        </Pressable>
                        <Pressable onPress={() => duplicateHeader(header.id)} style={styles.iconBtn}>
                          <Ionicons name="copy-outline" size={14} color={theme.colors.ink} />
                        </Pressable>
                        <Pressable onPress={() => removeCustomHeader(header.id)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={styles.cardDivider} />

              <View style={styles.subsectionHeader}>
                <Text style={styles.subsectionTitle}>Custom template library</Text>
                <Text style={styles.helper}>
                  {loadingSavedTemplates ? "Loading saved templates..." : `${savedTemplates.length} saved templates available.`}
                </Text>
              </View>

              <View style={styles.doubleRow}>
                <View style={styles.savedColumnLeft}>
                  <Text style={styles.headerFieldLabel}>Save current template as</Text>
                  <TextInput
                    value={templateSaveName}
                    onChangeText={setTemplateSaveName}
                    placeholder="Kitchen retrofit template"
                    placeholderTextColor={theme.colors.muted}
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
                <Pressable onPress={saveCurrentTemplate} style={styles.primaryActionBtn}>
                  <Ionicons name="save-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>Save Template</Text>
                </Pressable>

                {selectedSavedTemplate ? (
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>Loaded: {selectedSavedTemplate.name}</Text>
                  </View>
                ) : null}
              </View>
            </ContentCard>

            <ContentCard title="Live preview" subtitle="Preview how this layout will appear to the technician.">
              <View style={styles.previewCardTop}>
                <Text style={styles.helper}>Technician-facing table</Text>
                <Text style={styles.previewTemplateName}>{selectedTemplateName}</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.previewTable}>
                  <View style={styles.previewHeadRow}>
                    <Text style={[styles.previewHeadCell, { width: 58 }]}>INV #</Text>
                    <Text style={[styles.previewHeadCell, { width: 92 }]}>QTY</Text>
                    {visibleHeaders.map((header) => (
                      <Text key={header.id} style={[styles.previewHeadCell, { width: getPreviewColumnWidth(header) }]} numberOfLines={1}>
                        {header.label.trim() || "HEADER"}
                      </Text>
                    ))}
                  </View>

                  {previewRows.map((row, index) => (
                    <View key={row.id} style={[styles.previewBodyRow, index % 2 === 0 ? styles.previewStriped : null]}>
                      <Text style={[styles.previewBodyCell, { width: 58 }]}>{index + 1}</Text>
                      <Text style={[styles.previewBodyCell, { width: 92 }]}>1</Text>
                      {visibleHeaders.map((header) => (
                        <View key={`${row.id}-${header.id}`} style={[styles.previewFieldCell, { width: getPreviewColumnWidth(header) }]}>
                          {(header.fieldType ?? "dropdown") === "measurement" ? (
                            <View style={styles.previewMeasurementField}>
                              <Ionicons name="resize-outline" size={12} color={theme.colors.goldDark} />
                              <Text style={styles.previewSelectFieldText} numberOfLines={1}>
                                {row.fields[header.id] || header.placeholder || '36" x 48"'}
                              </Text>
                            </View>
                          ) : (header.fieldType ?? "dropdown") === "dropdown" ? (
                            <View style={styles.previewSelectField}>
                              <Text style={styles.previewSelectFieldText} numberOfLines={1}>
                                {row.fields[header.id] || "Select option"}
                              </Text>
                              <Ionicons name="chevron-down" size={12} color={theme.colors.goldDark} />
                            </View>
                          ) : header.fieldType === "notes" ? (
                            <View style={styles.previewNotesField}>
                              <Text style={styles.previewTextFieldText} numberOfLines={2}>
                                {row.fields[header.id] || header.placeholder || "Add notes"}
                              </Text>
                            </View>
                          ) : header.fieldType === "date" ? (
                            <View style={styles.previewSelectField}>
                              <Text style={styles.previewSelectFieldText} numberOfLines={1}>
                                {row.fields[header.id] || header.defaultValue || "MM-DD-YYYY"}
                              </Text>
                              <Ionicons name="calendar-outline" size={12} color={theme.colors.goldDark} />
                            </View>
                          ) : (
                            <View style={styles.previewTextField}>
                              <Text style={styles.previewTextFieldText} numberOfLines={1}>
                                {row.fields[header.id] || header.placeholder || "Enter value"}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ContentCard>

            <ContentCard
              title="Notes"
              subtitle="Collapsed by default to keep the page focused on details and the grid."
            >
              <Pressable onPress={() => setNotesExpanded((prev) => !prev)} style={styles.notesToggle}>
                <Text style={styles.secondaryBtnText}>{notesExpanded ? "Hide Notes" : "Show Notes"}</Text>
                <Ionicons name={notesExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.ink} />
              </Pressable>

              {notesExpanded ? (
                <View style={styles.section}>
                  <Text style={styles.label}>Internal notes</Text>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Special instructions, scope notes, install notes..."
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, styles.textArea]}
                    multiline
                  />
                </View>
              ) : null}
            </ContentCard>

            <View style={styles.actionFooter}>
              <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void createWorkOrder();
                }}
                disabled={saving}
                style={[styles.primaryBtn, saving ? styles.primaryBtnDisabled : null]}
              >
                <Text style={styles.primaryBtnText}>{saving ? "Creating..." : "Create Work Order"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentColumn: {
    width: "100%",
    maxWidth: 1024,
    alignSelf: "center",
    gap: 24,
  },
  mainColumn: {
    width: "100%",
    gap: 24,
  },
  section: {
    gap: 6,
  },
  label: {
    color: theme.colors.mutedSoft,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: "700",
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  helper: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 13,
  },
  cardDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  flowSteps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  flowStepPill: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flowStepPillActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  flowStepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    color: theme.colors.muted,
    textAlign: "center",
    lineHeight: 20,
    fontSize: 11,
    fontWeight: "900",
  },
  flowStepNumberActive: {
    backgroundColor: theme.colors.primary,
    color: "#FFFFFF",
  },
  flowStepText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  flowStepTextActive: {
    color: theme.colors.primaryHover,
  },
  templateDropdownShell: {
    position: "relative",
    zIndex: 5,
  },
  templateDropdownTrigger: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  templateDropdownCopy: {
    flex: 1,
    minWidth: 0,
  },
  templateDropdownLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  templateDropdownValue: {
    marginTop: 3,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  templateMenuPanel: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 8,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  templateMenuLabel: {
    color: theme.colors.muted,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  templateMenuList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateMenuItem: {
    minHeight: 44,
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  templateMenuItemActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  templateMenuItemMain: {
    flex: 1,
    minWidth: 0,
  },
  templateMenuItemText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },
  templateMenuItemTextActive: {
    color: theme.colors.primaryHover,
  },
  templateMenuItemMeta: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  templateMenuDelete: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  subsectionHeader: {
    gap: 4,
  },
  subsectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  flexCol: {
    flex: 1,
    gap: 6,
    minWidth: 280,
  },
  addressCityCol: {
    flex: 1.4,
    minWidth: 180,
  },
  addressStateCol: {
    width: 88,
  },
  addressZipCol: {
    width: 120,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pillActive: {
    backgroundColor: theme.colors.surface2,
    borderColor: "#BFDBFE",
  },
  pillText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  pillTextActive: {
    color: theme.colors.goldDark,
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
  dateButtonField: {
    justifyContent: "center",
  },
  dateButtonText: {
    color: theme.colors.ink,
    fontWeight: "700",
  },
  todayBtn: {
    height: 48,
    width: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  inlineCalendarCard: {
    width: 320,
    maxWidth: "100%",
    alignSelf: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  calendarTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  calendarTitle: {
    textAlign: "center",
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  calendarSubTitle: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  calendarWeekday: {
    width: 36,
    textAlign: "center",
    color: theme.colors.muted,
    fontSize: 9,
    fontWeight: "700",
  },
  calendarGrid: {
    width: 276,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  calendarDay: {
    width: 36,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  calendarDaySelected: {
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  calendarDayText: {
    color: theme.colors.ink,
    fontSize: 10,
    fontWeight: "700",
  },
  calendarDayMuted: {
    color: theme.colors.muted,
    opacity: 0.45,
  },
  calendarDayTextSelected: {
    color: theme.colors.goldDark,
  },
  todayBtnText: {
    color: theme.colors.goldDark,
    fontWeight: "900",
  },
  clientPicker: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
    borderTopColor: theme.colors.border,
  },
  clientRowActive: {
    backgroundColor: "#EFF6FF",
  },
  clientName: {
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 14,
  },
  clientMeta: {
    marginTop: 2,
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  assignCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 8,
    minHeight: 64,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 8,
    minHeight: 64,
  },
  savedDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.danger,
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
  primaryActionBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startModeRow: {
    gap: 10,
  },
  blankStateWrap: {
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  templateBuilderTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
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
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 10,
    gap: 8,
  },
  headerCardExpanded: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FBFF",
  },
  headerCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  headerCardSummary: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerCardIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    color: theme.colors.primaryHover,
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "900",
    fontSize: 12,
  },
  headerSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerSummaryTitle: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },
  headerSummaryMeta: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },
  fieldSection: {
    gap: 10,
  },
  fieldSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  togglePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  togglePillOn: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
  },
  togglePillText: {
    color: theme.colors.muted,
    fontWeight: "900",
    fontSize: 11,
  },
  togglePillTextOn: {
    color: theme.colors.goldDark,
  },
  headerFieldLabel: {
    color: theme.colors.mutedSoft,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  fieldTypeRow: {
    gap: 6,
  },
  fieldTypeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  behaviorSection: {
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  moreTypeMenu: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  moreTypeMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  optionList: {
    gap: 8,
  },
  inlineOptionRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineOptionAddRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  inlineOptionInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontWeight: "700",
  },
  optionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionDeleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#efc8bc",
    backgroundColor: "#fff3ef",
    alignItems: "center",
    justifyContent: "center",
  },
  optionAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  advancedToggle: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#F8FAFC",
  },
  advancedToggleTitle: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  advancedToggleMeta: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  advancedPanel: {
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  measurementPreviewBox: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  measurementPreviewText: {
    color: theme.colors.goldDark,
    fontSize: 16,
    fontWeight: "900",
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.surface2,
  },
  segmentBtnText: {
    color: theme.colors.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  segmentBtnTextActive: {
    color: theme.colors.goldDark,
  },
  typeChip: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  typeChipActive: {
    backgroundColor: theme.colors.surface2,
    borderColor: "#BFDBFE",
  },
  typeChipText: {
    color: theme.colors.muted,
    fontWeight: "800",
    fontSize: 11.5,
  },
  typeChipTextActive: {
    color: theme.colors.goldDark,
  },
  inlineToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  visibilitySwitch: {
    width: 42,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    padding: 3,
    justifyContent: "center",
  },
  visibilitySwitchOn: {
    backgroundColor: theme.colors.primary,
  },
  visibilitySwitchKnob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  visibilitySwitchKnobOn: {
    transform: [{ translateX: 18 }],
  },
  fieldExpandBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  compactToggleGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  fieldTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  fieldTypeBadgeText: {
    color: theme.colors.goldDark,
    fontWeight: "900",
    fontSize: 11,
  },
  dropdownField: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownFieldText: {
    flex: 1,
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  dropdownMenu: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  dropdownAddWrap: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#EFF6FF",
  },
  dropdownAddInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontWeight: "700",
  },
  dropdownAddBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  addFieldMenu: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  addFieldMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    minWidth: 110,
  },
  addFieldMenuItemQuiet: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  addFieldMenuDivider: {
    width: "100%",
    height: 1,
    backgroundColor: theme.colors.border,
  },
  addFieldMenuText: {
    color: theme.colors.goldDark,
    fontSize: 12.5,
    fontWeight: "900",
  },
  dropdownEmptyState: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownEmptyText: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  dropdownOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  dropdownOptionMeta: {
    marginTop: 2,
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 11,
  },
  dropdownOptionDeleteBtn: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.danger,
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
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  previewBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  previewBadgeText: {
    color: theme.colors.goldDark,
    fontWeight: "900",
    fontSize: 12,
  },
  previewCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  previewTemplateName: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  previewTable: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  previewHeadRow: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
  },
  previewHeadCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.ink,
    fontWeight: "900",
    fontSize: 12,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  previewBodyRow: {
    flexDirection: "row",
  },
  previewStriped: {
    backgroundColor: "#F8FAFC",
  },
  previewBodyCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.ink,
    fontWeight: "700",
    fontSize: 12,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderRightColor: theme.colors.border,
    borderTopColor: theme.colors.border,
  },
  previewFieldCell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderRightColor: theme.colors.border,
    borderTopColor: theme.colors.border,
    justifyContent: "center",
  },
  previewTextField: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  previewTextFieldText: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  previewNotesField: {
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  previewSelectField: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
  },
  previewMeasurementField: {
    minHeight: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  previewSelectFieldText: {
    flex: 1,
    color: theme.colors.goldDark,
    fontSize: 11.5,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 4,
  },
  actionFooter: {
    position: "sticky" as any,
    bottom: 16,
    zIndex: 5,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    padding: 14,
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  notesToggle: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: theme.colors.ink,
    fontWeight: "900",
  },
  primaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  // ── Industry quick setup ──
  setupShell: {
    marginTop: 10,
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
  },
  setupHeaderRow: {
    gap: 4,
  },
  industrySetupWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  industryCardCompact: {
    width: 112,
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  industryCardCompactActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  industryCardCompactLabel: {
    color: theme.colors.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  industryCardCompactLabelActive: {
    color: theme.colors.primaryHover,
  },
  setupModeRow: {
    paddingTop: 2,
  },
  setupSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  setupSummaryPill: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  setupSummaryPillWide: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    maxWidth: "100%",
  },
  setupSummaryText: {
    color: theme.colors.primaryHover,
    fontSize: 12,
    fontWeight: "800",
  },

  // ── Add field menu improvements ──
  addFieldMenuMeta: {
    color: theme.colors.muted,
    fontSize: 10.5,
    fontWeight: "500",
    marginTop: 1,
  },

  // ── Conditional logic ──
  conditionalSection: {
    marginTop: 8,
    gap: 8,
  },
  conditionalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conditionalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  conditionalBadgeText: {
    color: theme.colors.goldDark,
    fontSize: 10.5,
    fontWeight: "900",
  },
  conditionalAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    backgroundColor: theme.colors.surface,
    alignSelf: "flex-start",
  },
  conditionalAddBtnText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  conditionalClearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#efc8bc",
    backgroundColor: "#fff3ef",
  },
  conditionalClearBtnText: {
    color: "#9f3b2f",
    fontSize: 11,
    fontWeight: "900",
  },
  conditionalBuilder: {
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  conditionalRule: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  conditionalRuleStrong: {
    color: theme.colors.goldDark,
    fontWeight: "900",
  },
});
