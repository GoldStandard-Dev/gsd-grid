import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../src/components/Screen";
import {
  AppPage,
  ContentCard,
  PageHeader,
  SoftAccentCard,
  SummaryCard,
  SummaryStrip,
} from "../../src/components/AppPage";
import EmptyState from "../../src/components/EmptyState";
import { getUserOrgId } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";

type IndustryType =
  | "Window Treatments"
  | "General Construction"
  | "Flooring"
  | "Painting"
  | "Electrical"
  | "Plumbing"
  | "HVAC"
  | "Custom";

type PricingMode = "matrix" | "unit" | "flat" | "labor" | "material" | "formula";
type PercentIncreaseMode = "flat" | "row_progressive" | "column_progressive" | "full_progressive";
type MatrixImportMode = "csv" | "json" | "paste";
type ItemFieldType = "text" | "dropdown" | "multi_select" | "number" | "toggle" | "formula";
type ItemFieldVisibility = "all" | "manager" | "tech";
type FieldMeasurementFormat = "single" | "width_height";
type BuilderSelectKind = "quick_type" | "field_type" | "field_visibility" | "rule_field" | "rule_operator";

type ItemFieldDefinition = {
  id: string;
  label: string;
  type: ItemFieldType;
  required: boolean;
  visibility: ItemFieldVisibility;
  options: string[];
  formula: string;
  measurementMode?: boolean;
  measurementFormat?: FieldMeasurementFormat;
  measurementFractions?: boolean;
  conditionalFieldId?: string;
  conditionalValue?: string;
};

type BuilderSelectMenu = {
  visible: boolean;
  title: string;
  kind: BuilderSelectKind;
  fieldId?: string;
  ruleId?: string;
};

type ItemTagOption = {
  id: string;
  label: string;
  color: string;
};

type GroupRule = {
  id: string;
  group: string;
  fieldId: string;
  operator: "equals" | "contains" | "less_than" | "greater_than";
  value: string;
};

type ItemPricingLink = {
  group?: string;
  ruleId?: string;
  formula?: string;
  matrix?: string;
};

type IndustryPreset = {
  itemLabel: string;
  groupLabel: string;
  widthLabel: string;
  flagsLabel: string;
  notesLabel: string;
  gridType: string;
  fields: string[];
};

const MATRIX_ROW_HEADER_WIDTH = 92;
const MATRIX_CELL_WIDTH = 92;
const MATRIX_CELL_HEIGHT = 50;

type PricingCollection = {
  id: string;
  name: string;
  industry_type: IndustryType;
  pricing_mode: PricingMode;
  is_default: boolean;
  description?: string | null;
  item_field_schema?: ItemFieldDefinition[] | null;
  item_tag_options?: ItemTagOption[] | null;
  group_rules?: GroupRule[] | null;
};

type FabricRow = {
  id: string;
  collection_id: string;
  fabric_style: string;
  price_group: string;
  fabric_width: string;
  fr: boolean;
  roller_shade: boolean;
  panel_track: boolean;
  multi_directional: boolean;
  field_values?: Record<string, string | boolean | string[]> | null;
  tags?: string[] | null;
  pricing_link?: ItemPricingLink | null;
};

type MatrixCell = {
  id: string;
  collection_id: string;
  price_group: string;
  width_to: number;
  height_to: number;
  price: number;
};

type FabricDraftRow = {
  key: string;
  fabricId?: string;
  collection_id: string;
  fabric_style: string;
  price_group: string;
  fabric_width: string;
  fr: boolean;
  roller_shade: boolean;
  panel_track: boolean;
  multi_directional: boolean;
  field_values: Record<string, string | boolean | string[]>;
  tags: string[];
  pricing_link: ItemPricingLink;
  isNew?: boolean;
  dirty?: boolean;
};

type PricingGroupDraft = {
  key: string;
  collection_id: string;
  price_group: string;
  widths: number[];
  heights: number[];
  cells: Record<string, string>;
  cellIds: Record<string, string | undefined>;
  isNew?: boolean;
  dirty?: boolean;
};

type PricingRuleType = "unit" | "flat" | "labor" | "material" | "formula";

type PricingRule = {
  id?: string;          // undefined = new, not yet saved
  key: string;          // client-side draft key
  collection_id: string;
  rule_type: PricingRuleType;
  label: string;
  price: string;        // string so TextInput can edit it
  unit_label: string;
  min_qty: string;
  formula_expr: string;
  sort_order: number;
  is_active: boolean;
  isNew?: boolean;
  dirty?: boolean;
};

const INDUSTRY_OPTIONS: IndustryType[] = [
  "Window Treatments",
  "General Construction",
  "Flooring",
  "Painting",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Custom",
];

const PRICING_MODE_OPTIONS: PricingMode[] = ["matrix", "unit", "flat", "labor", "material", "formula"];
const PERCENT_INCREASE_MODE_OPTIONS: { value: PercentIncreaseMode; label: string }[] = [
  { value: "flat", label: "Flat" },
  { value: "row_progressive", label: "Row Progressive" },
  { value: "column_progressive", label: "Column Progressive" },
  { value: "full_progressive", label: "Full Progressive" },
];
const ITEM_FIELD_TYPE_OPTIONS: { value: ItemFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "dropdown", label: "Dropdown" },
  { value: "multi_select", label: "Multi-select" },
  { value: "number", label: "Number" },
  { value: "toggle", label: "Toggle" },
  { value: "formula", label: "Formula" },
];
const ITEM_FIELD_VISIBILITY_OPTIONS: { value: ItemFieldVisibility; label: string }[] = [
  { value: "all", label: "All" },
  { value: "manager", label: "Manager" },
  { value: "tech", label: "Tech" },
];
const DEFAULT_TAG_COLORS = ["#EFF6FF", "#FEF3C7", "#DCFCE7", "#FEE2E2", "#EDE9FE", "#F1F5F9"];

const DEFAULT_WIDTHS = [24, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144];
const DEFAULT_HEIGHTS = [36, 48, 60, 72, 84, 96, 108, 120, 132, 144];
const MATRIX_BREAKPOINT_PRESETS = [
  { label: "Standard", widths: DEFAULT_WIDTHS, heights: DEFAULT_HEIGHTS },
  { label: "Small", widths: [18, 24, 30, 36, 42, 48, 54, 60], heights: [24, 30, 36, 42, 48, 54, 60, 72] },
  { label: "Large", widths: [48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168], heights: [60, 72, 84, 96, 108, 120, 132, 144] },
  { label: "Window", widths: DEFAULT_WIDTHS, heights: DEFAULT_HEIGHTS },
  { label: "Flooring", widths: [100, 250, 500, 750, 1000, 1500, 2000], heights: [1, 2, 3, 4, 5] },
  { label: "Custom", widths: [], heights: [] },
];

const DEFAULT_FIELD_SCHEMA_BY_INDUSTRY: Record<IndustryType, ItemFieldDefinition[]> = {
  "Window Treatments": [
    makeFieldDefinition("Fabric Type", "dropdown", ["Blackout", "Sheer", "Solar"]),
    makeFieldDefinition("Width", "number"),
    makeFieldDefinition("Mount Type", "dropdown", ["Inside", "Outside", "Ceiling"]),
  ],
  Flooring: [
    makeFieldDefinition("Product Type", "dropdown", ["LVP", "Tile", "Hardwood", "Carpet"]),
    makeFieldDefinition("Coverage", "number"),
    makeFieldDefinition("Install Method", "dropdown", ["Glue", "Float", "Nail", "Thinset"]),
  ],
  Painting: [
    makeFieldDefinition("Surface", "dropdown", ["Wall", "Ceiling", "Trim", "Exterior"]),
    makeFieldDefinition("Coats", "number"),
    makeFieldDefinition("Sheen", "dropdown", ["Flat", "Eggshell", "Satin", "Semi-Gloss"]),
  ],
  Electrical: [
    makeFieldDefinition("Service Type", "dropdown", ["Device", "Circuit", "Panel", "Fixture"]),
    makeFieldDefinition("Amp", "dropdown", ["15A", "20A", "30A", "50A"]),
    makeFieldDefinition("Qty", "number"),
  ],
  Plumbing: [
    makeFieldDefinition("Fixture Type", "dropdown", ["Faucet", "Valve", "Drain", "Water Heater"]),
    makeFieldDefinition("Service Type", "dropdown", ["Repair", "Replace", "Rough-In"]),
    makeFieldDefinition("Qty", "number"),
  ],
  HVAC: [
    makeFieldDefinition("Equipment", "dropdown", ["Condenser", "Air Handler", "Duct", "Thermostat"]),
    makeFieldDefinition("Tonnage", "number"),
    makeFieldDefinition("Service Tier", "dropdown", ["Standard", "Premium", "Emergency"]),
  ],
  "General Construction": [
    makeFieldDefinition("Item Type", "dropdown", ["Labor", "Material", "Subcontract", "Allowance"]),
    makeFieldDefinition("Qty", "number"),
    makeFieldDefinition("Unit", "dropdown", ["each", "sqft", "linear ft", "hour"]),
  ],
  Custom: [
    makeFieldDefinition("Option", "text"),
    makeFieldDefinition("Qty", "number"),
    makeFieldDefinition("Category", "dropdown", ["Standard", "Premium", "Custom"]),
  ],
};

const INDUSTRY_PRESETS: Record<IndustryType, IndustryPreset> = {
  "Window Treatments": {
    itemLabel: "Style",
    groupLabel: "Group",
    widthLabel: "Fabric Width",
    flagsLabel: "Shade Flags",
    notesLabel: "Notes",
    gridType: "2D Matrix",
    fields: ["Width x height", "Fabric width", "Mount type", "Opening", "Product"],
  },
  Flooring: {
    itemLabel: "Product",
    groupLabel: "Group",
    widthLabel: "Coverage",
    flagsLabel: "Install Flags",
    notesLabel: "Unit / cost notes",
    gridType: "Tier Matrix",
    fields: ["Coverage", "Unit", "Material cost", "Labor cost", "Install group"],
  },
  Painting: {
    itemLabel: "Surface",
    groupLabel: "Group",
    widthLabel: "Unit",
    flagsLabel: "Prep / coats",
    notesLabel: "Prep notes",
    gridType: "Tier Matrix",
    fields: ["Surface type", "Prep level", "Coats", "Unit", "Price"],
  },
  Electrical: {
    itemLabel: "Service Item",
    groupLabel: "Group",
    widthLabel: "Unit",
    flagsLabel: "Service Flags",
    notesLabel: "Labor / material notes",
    gridType: "Unit Price Grid",
    fields: ["Unit", "Base price", "Labor", "Material", "Service type"],
  },
  Plumbing: {
    itemLabel: "Fixture / Service",
    groupLabel: "Group",
    widthLabel: "Unit",
    flagsLabel: "Service Flags",
    notesLabel: "Labor / material notes",
    gridType: "Labor + Material Grid",
    fields: ["Fixture type", "Labor", "Material", "Service fee", "Flat price"],
  },
  HVAC: {
    itemLabel: "Equipment / Service",
    groupLabel: "Group",
    widthLabel: "Unit",
    flagsLabel: "Service Flags",
    notesLabel: "Equipment notes",
    gridType: "Labor + Material Grid",
    fields: ["Tonnage", "Labor hours", "Equipment", "Duct add-ons", "Service tier"],
  },
  "General Construction": {
    itemLabel: "Item",
    groupLabel: "Group",
    widthLabel: "Unit",
    flagsLabel: "Item Flags",
    notesLabel: "Notes",
    gridType: "Mixed Grid",
    fields: ["Matrix", "Unit", "Flat", "Labor", "Material", "Mixed"],
  },
  Custom: {
    itemLabel: "Item",
    groupLabel: "Group",
    widthLabel: "Unit",
    flagsLabel: "Flags",
    notesLabel: "Notes",
    gridType: "Custom Grid",
    fields: ["Matrix", "Unit", "Flat", "Labor", "Material", "Custom"],
  },
};

function cleanDecimal(value: string) {
  const next = (value ?? "").replace(/[^0-9.]/g, "");
  const parts = next.split(".");
  if (parts.length <= 1) return next;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeFieldDefinition(
  label: string,
  type: ItemFieldType = "text",
  options: string[] = []
): ItemFieldDefinition {
  return {
    id: makeId("field"),
    label,
    type,
    required: false,
    visibility: "all",
    options,
    formula: "",
    measurementMode: false,
    measurementFormat: "single",
    measurementFractions: true,
  };
}

function makeTagOption(label: string, color = "#EFF6FF"): ItemTagOption {
  return {
    id: makeId("tag"),
    label,
    color,
  };
}

function asObject(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
}

function asArray<T>(value: unknown): T[] {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeItemFieldSchema(value: unknown, industry: IndustryType) {
  const schema = asArray<any>(value)
    .map((field, index) => ({
      id: String(field.id || `field-${index}`),
      label: String(field.label || `Field ${index + 1}`),
      type: (["text", "dropdown", "multi_select", "number", "toggle", "formula"].includes(field.type)
        ? field.type
        : "text") as ItemFieldType,
      required: field.required === true,
      visibility: (["all", "manager", "tech"].includes(field.visibility) ? field.visibility : "all") as ItemFieldVisibility,
      options: Array.isArray(field.options) ? field.options.map(String) : [],
      formula: String(field.formula || ""),
      measurementMode: field.measurementMode === true,
      measurementFormat: (["single", "width_height"].includes(field.measurementFormat) ? field.measurementFormat : "single") as FieldMeasurementFormat,
      measurementFractions: field.measurementFractions !== false,
      conditionalFieldId: field.conditionalFieldId ? String(field.conditionalFieldId) : undefined,
      conditionalValue: field.conditionalValue ? String(field.conditionalValue) : undefined,
    }));

  return schema.length ? schema : DEFAULT_FIELD_SCHEMA_BY_INDUSTRY[industry];
}

function normalizeItemTagOptions(value: unknown) {
  const tags = asArray<any>(value)
    .map((tag, index) => ({
      id: String(tag.id || `tag-${index}`),
      label: String(tag.label || `Tag ${index + 1}`),
      color: String(tag.color || DEFAULT_TAG_COLORS[index % DEFAULT_TAG_COLORS.length]),
    }))
    .filter((tag) => tag.label.trim().length > 0);

  return tags;
}

function normalizeGroup(value: string) {
  return value.trim().toUpperCase();
}

function getGroupLabel(value: string) {
  const normalized = normalizeGroup(value);
  return normalized ? `Group ${normalized}` : "Unassigned";
}

function groupIndexToName(index: number) {
  let value = index + 1;
  let name = "";

  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }

  return name;
}

function getNextPriceGroupName(existingGroups: string[]) {
  const used = new Set(existingGroups.map(normalizeGroup).filter(Boolean));
  let index = 0;

  while (true) {
    const candidate = groupIndexToName(index);
    if (!used.has(candidate)) return candidate;
    index += 1;
  }
}

function buildCellKey(width: number, height: number) {
  return `${width}x${height}`;
}

function formatPriceCell(value: number) {
  return Number(value || 0).toFixed(2);
}

function parseBreakpointsCsv(value: string) {
  const seen = new Set<number>();
  return (value ?? "")
    .split(",")
    .map((part) => Number(String(part).replace(/[^0-9.]/g, "").trim()))
    .filter((num) => Number.isFinite(num) && num > 0)
    .sort((a, b) => a - b)
    .filter((num) => {
      if (seen.has(num)) return false;
      seen.add(num);
      return true;
    });
}

function breakpointsToCsv(values: number[]) {
  return values.join(", ");
}

function sameBreakpointList(a: number[], b: number[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function parseDelimitedRows(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(line.includes("\t") ? "\t" : ",")
        .map((cell) => cell.trim())
    );
}

function parseMatrixImport(mode: MatrixImportMode, value: string) {
  const errors: string[] = [];
  let widths: number[] = [];
  let heights: number[] = [];
  const cells: Record<string, string> = {};

  try {
    if (mode === "json") {
      const parsed = JSON.parse(value);
      widths = Array.isArray(parsed.widths) ? parseBreakpointsCsv(parsed.widths.join(",")) : [];
      heights = Array.isArray(parsed.heights) ? parseBreakpointsCsv(parsed.heights.join(",")) : [];

      if (parsed.cells && typeof parsed.cells === "object") {
        Object.entries(parsed.cells as Record<string, any>).forEach(([key, cellValue]) => {
          cells[key] = cleanDecimal(String(cellValue ?? "0"));
        });
      }

      if (Array.isArray(parsed.matrix)) {
        parsed.matrix.forEach((row: any[], rowIndex: number) => {
          if (!Array.isArray(row)) return;
          row.forEach((cellValue, colIndex) => {
            const width = widths[colIndex];
            const height = heights[rowIndex];
            if (width && height) cells[buildCellKey(width, height)] = cleanDecimal(String(cellValue ?? "0"));
          });
        });
      }
    } else {
      const rows = parseDelimitedRows(value);
      const widthRow = rows.find((row) => /^widths?$/i.test(row[0] ?? ""));
      const heightRow = rows.find((row) => /^heights?$/i.test(row[0] ?? ""));

      if (widthRow && heightRow) {
        widths = parseBreakpointsCsv(widthRow.slice(1).join(","));
        heights = parseBreakpointsCsv(heightRow.slice(1).join(","));
      } else if (rows.length > 1) {
        widths = parseBreakpointsCsv(rows[0].slice(1).join(","));
        heights = parseBreakpointsCsv(rows.slice(1).map((row) => row[0]).join(","));

        rows.slice(1).forEach((row, rowIndex) => {
          const height = heights[rowIndex];
          row.slice(1).forEach((cellValue, colIndex) => {
            const width = widths[colIndex];
            if (width && height && cellValue !== "") cells[buildCellKey(width, height)] = cleanDecimal(cellValue);
          });
        });
      }
    }
  } catch (error: any) {
    errors.push(error?.message ?? "Import data could not be parsed.");
  }

  if (!widths.length) errors.push("No valid width breakpoints found.");
  if (!heights.length) errors.push("No valid height breakpoints found.");

  return { widths, heights, cells, errors };
}

function buildFabricDrafts(rows: FabricRow[]) {
  return rows.map((row) => ({
    key: row.id,
    fabricId: row.id,
    collection_id: row.collection_id,
    fabric_style: row.fabric_style || "",
    price_group: row.price_group || "",
    fabric_width: row.fabric_width || "",
    fr: row.fr,
    roller_shade: row.roller_shade,
    panel_track: row.panel_track,
    multi_directional: row.multi_directional,
    field_values: asObject(row.field_values) ?? {},
    tags: asArray<string>(row.tags),
    pricing_link: asObject(row.pricing_link) ?? {},
  }));
}

function buildDynamicNotes(row: FabricDraftRow, tagOptions: ItemTagOption[]) {
  const tags = row.tags
    .map((tagId) => tagOptions.find((tag) => tag.id === tagId)?.label || tagId)
    .filter(Boolean);
  return tags.length ? tags.join(" - ") : "-";
}

function buildGroupDrafts(cells: MatrixCell[], collectionId: string) {
  const scoped = cells.filter((cell) => cell.collection_id === collectionId);
  const byGroup = new Map<string, MatrixCell[]>();

  for (const cell of scoped) {
    const group = normalizeGroup(cell.price_group || "");
    if (!group) continue;
    const list = byGroup.get(group) ?? [];
    list.push(cell);
    byGroup.set(group, list);
  }

  return Array.from(byGroup.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, rows]) => {
      const widths = Array.from(new Set(rows.map((row) => Number(row.width_to || 0)).filter(Boolean))).sort((a, b) => a - b);
      const heights = Array.from(new Set(rows.map((row) => Number(row.height_to || 0)).filter(Boolean))).sort((a, b) => a - b);

      const draft: PricingGroupDraft = {
        key: group,
        collection_id: collectionId,
        price_group: group,
        widths,
        heights,
        cells: {},
        cellIds: {},
      };

      for (const row of rows) {
        const key = buildCellKey(Number(row.width_to), Number(row.height_to));
        draft.cells[key] = String(Number(row.price || 0));
        draft.cellIds[key] = row.id;
      }

      return draft;
    });
}

function cloneGroup(group: PricingGroupDraft, nextName: string): PricingGroupDraft {
  const normalizedName = normalizeGroup(nextName);
  const nextCells: Record<string, string> = {};

  for (const height of group.heights) {
    for (const width of group.widths) {
      const key = buildCellKey(width, height);
      nextCells[key] = group.cells[key] ?? "0";
    }
  }

  return {
    key: `new-group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    collection_id: group.collection_id,
    price_group: normalizedName,
    widths: [...group.widths],
    heights: [...group.heights],
    cells: nextCells,
    cellIds: {},
    isNew: true,
    dirty: true,
  };
}

function reshapeGroup(group: PricingGroupDraft, widths: number[], heights: number[]) {
  const nextCells: Record<string, string> = {};
  const nextCellIds: Record<string, string | undefined> = {};

  for (const height of heights) {
    for (const width of widths) {
      const key = buildCellKey(width, height);
      nextCells[key] = group.cells[key] ?? "0";
      nextCellIds[key] = group.cellIds[key];
    }
  }

  return {
    ...group,
    widths,
    heights,
    cells: nextCells,
    cellIds: nextCellIds,
    dirty: true,
  };
}

export default function PricingPage() {
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [supportsDynamicConfigurator, setSupportsDynamicConfigurator] = useState(true);

  const [collections, setCollections] = useState<PricingCollection[]>([]);
  const [fabrics, setFabrics] = useState<FabricRow[]>([]);
  const [matrixCells, setMatrixCells] = useState<MatrixCell[]>([]);

  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState<IndustryType | "All">("All");
  const [showNotes, setShowNotes] = useState(true);

  const [draftFabrics, setDraftFabrics] = useState<FabricDraftRow[]>([]);
  const [draftGroups, setDraftGroups] = useState<PricingGroupDraft[]>([]);
  const [deletedFabricIds, setDeletedFabricIds] = useState<string[]>([]);
  const [deletedMatrixCellIds, setDeletedMatrixCellIds] = useState<string[]>([]);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateIndustry, setNewTemplateIndustry] = useState<IndustryType>("Window Treatments");
  const [newTemplateMode, setNewTemplateMode] = useState<PricingMode>("matrix");
  const [deletingTemplateId, setDeletingTemplateId] = useState("");
  const [templatePendingDelete, setTemplatePendingDelete] = useState<PricingCollection | null>(null);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showFieldBuilder, setShowFieldBuilder] = useState(true);
  const [expandedFieldId, setExpandedFieldId] = useState("");
  const [quickFieldName, setQuickFieldName] = useState("");
  const [quickFieldType, setQuickFieldType] = useState<ItemFieldType>("text");
  const [builderSelectMenu, setBuilderSelectMenu] = useState<BuilderSelectMenu>({
    visible: false,
    title: "",
    kind: "quick_type",
  });
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupWidths, setNewGroupWidths] = useState(breakpointsToCsv(DEFAULT_WIDTHS));
  const [newGroupHeights, setNewGroupHeights] = useState(breakpointsToCsv(DEFAULT_HEIGHTS));
  const [newGroupDefaultPrice, setNewGroupDefaultPrice] = useState("0");

  const [groupWidthsInput, setGroupWidthsInput] = useState("");
  const [groupHeightsInput, setGroupHeightsInput] = useState("");
  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ width: number; height: number } | null>(null);
  const [showMatrixImportMenu, setShowMatrixImportMenu] = useState(false);
  const [matrixImportMode, setMatrixImportMode] = useState<MatrixImportMode | "">("");
  const [matrixImportText, setMatrixImportText] = useState("");
  const [matrixImportStrategy, setMatrixImportStrategy] = useState<"replace" | "merge">("replace");
  const [fillValue, setFillValue] = useState("0");
  const [percentIncrease, setPercentIncrease] = useState("8");
  const [percentIncreaseMode, setPercentIncreaseMode] = useState<PercentIncreaseMode>("full_progressive");

  // Pricing Rules (unit / flat / formula modes)
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [deletedRuleIds, setDeletedRuleIds] = useState<string[]>([]);
  const [formulaTestValues, setFormulaTestValues] = useState<Record<string, string>>({
    qty: "1", width: "36", height: "48", sqft: "150", linearft: "20",
  });
  const [previewGroup, setPreviewGroup] = useState("");
  const [previewWidth, setPreviewWidth] = useState("36");
  const [previewHeight, setPreviewHeight] = useState("48");
  const [previewQty, setPreviewQty] = useState("1");
  const [selectedAddOnKeys, setSelectedAddOnKeys] = useState<string[]>([]);

  useEffect(() => {
    void loadPricingPage();
  }, []);

  async function resolveSession() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const currentUserId = auth.user?.id;
    if (!currentUserId) throw new Error("No authenticated user found.");

    const resolvedOrgId = await getUserOrgId(currentUserId);
    if (!resolvedOrgId) throw new Error("Could not determine the active organization.");

    setOrgId(resolvedOrgId);
    return { resolvedOrgId };
  }

  async function loadPricingPage() {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const { resolvedOrgId } = await resolveSession();

      let collectionsRes: any;
      let fabricsRes: any;
      let matricesRes: any;
      let rulesRes: any;
      [collectionsRes, fabricsRes, matricesRes, rulesRes] = await Promise.all([
        supabase
          .from("pricing_collections")
          .select("id, name, description, industry_type, pricing_mode, is_default, item_field_schema, item_tag_options, group_rules")
          .eq("org_id", resolvedOrgId)
          .order("is_default", { ascending: false })
          .order("name", { ascending: true }),
        supabase
          .from("pricing_fabrics")
          .select(
            "id, collection_id, fabric_style, price_group, fabric_width, fr, roller_shade, panel_track, multi_directional, field_values, tags, pricing_link"
          )
          .eq("org_id", resolvedOrgId)
          .order("fabric_style", { ascending: true }),
        supabase
          .from("pricing_matrix_cells")
          .select("id, collection_id, price_group, width_to, height_to, price")
          .eq("org_id", resolvedOrgId),
        supabase
          .from("pricing_rules")
          .select("id, collection_id, rule_type, label, price, unit_label, min_qty, formula_expr, sort_order, is_active")
          .eq("org_id", resolvedOrgId)
          .order("sort_order", { ascending: true }),
      ]);

      if (collectionsRes.error || fabricsRes.error) {
        setSupportsDynamicConfigurator(false);
        [collectionsRes, fabricsRes] = await Promise.all([
          supabase
            .from("pricing_collections")
            .select("id, name, description, industry_type, pricing_mode, is_default")
            .eq("org_id", resolvedOrgId)
            .order("is_default", { ascending: false })
            .order("name", { ascending: true }),
          supabase
            .from("pricing_fabrics")
            .select("id, collection_id, fabric_style, price_group, fabric_width, fr, roller_shade, panel_track, multi_directional")
            .eq("org_id", resolvedOrgId)
            .order("fabric_style", { ascending: true }),
        ]);
      } else {
        setSupportsDynamicConfigurator(true);
      }

      if (collectionsRes.error) throw new Error(collectionsRes.error.message);
      if (fabricsRes.error) throw new Error(fabricsRes.error.message);
      if (matricesRes.error) throw new Error(matricesRes.error.message);
      if (rulesRes.error) throw new Error(rulesRes.error.message);

      const nextCollections = ((collectionsRes.data ?? []) as PricingCollection[]).map((collection) => ({
        ...collection,
        item_field_schema: normalizeItemFieldSchema(collection.item_field_schema, collection.industry_type),
        item_tag_options: normalizeItemTagOptions(collection.item_tag_options),
        group_rules: asArray<GroupRule>(collection.group_rules),
      }));
      const nextFabrics = (fabricsRes.data ?? []) as FabricRow[];
      const nextMatrixCells = (matricesRes.data ?? []) as MatrixCell[];
      const nextRules = (rulesRes.data ?? []).map((r: any) => ({
        id: r.id,
        key: r.id,
        collection_id: r.collection_id,
        rule_type: r.rule_type as PricingRuleType,
        label: r.label ?? "",
        price: String(r.price ?? "0"),
        unit_label: r.unit_label ?? "",
        min_qty: String(r.min_qty ?? ""),
        formula_expr: r.formula_expr ?? "",
        sort_order: r.sort_order ?? 0,
        is_active: r.is_active !== false,
      })) as PricingRule[];

      setCollections(nextCollections);
      setFabrics(nextFabrics);
      setMatrixCells(nextMatrixCells);
      setPricingRules(nextRules);

      const defaultCollection = nextCollections.find((item) => item.is_default) ?? nextCollections[0] ?? null;
      setSelectedCollectionId((prev) =>
        nextCollections.some((item) => item.id === prev) ? prev : defaultCollection?.id ?? ""
      );
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load pricing.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCollections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collections.filter((item) => {
      if (industryFilter !== "All" && item.industry_type !== industryFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        item.industry_type.toLowerCase().includes(q)
      );
    });
  }, [collections, industryFilter, search]);

  const selectedCollection = useMemo(
    () => collections.find((item) => item.id === selectedCollectionId) ?? filteredCollections[0] ?? null,
    [collections, filteredCollections, selectedCollectionId]
  );

  useEffect(() => {
    if (!selectedCollection) {
      setDraftFabrics([]);
      setDraftGroups([]);
      setDeletedFabricIds([]);
      setDeletedMatrixCellIds([]);
      setSelectedGroupKey("");
      setGroupWidthsInput("");
      setGroupHeightsInput("");
      return;
    }

    const nextFabrics = buildFabricDrafts(fabrics.filter((row) => row.collection_id === selectedCollection.id));
    const nextGroups = buildGroupDrafts(matrixCells, selectedCollection.id);

    setDraftFabrics(nextFabrics);
    setDraftGroups(nextGroups);
    setDeletedFabricIds([]);
    setDeletedMatrixCellIds([]);
    setDeletedRuleIds([]);
    setSelectedGroupKey((prev) => (nextGroups.some((group) => group.key === prev) ? prev : nextGroups[0]?.key ?? ""));
  }, [selectedCollection?.id, fabrics, matrixCells]);

  const selectedGroup = useMemo(
    () => draftGroups.find((group) => group.key === selectedGroupKey) ?? draftGroups[0] ?? null,
    [draftGroups, selectedGroupKey]
  );
  const pendingMatrixWidths = useMemo(() => parseBreakpointsCsv(groupWidthsInput), [groupWidthsInput]);
  const pendingMatrixHeights = useMemo(() => parseBreakpointsCsv(groupHeightsInput), [groupHeightsInput]);
  const pendingMatrixCellCount = pendingMatrixWidths.length * pendingMatrixHeights.length;
  const matrixImportPreview = useMemo(
    () => (matrixImportMode ? parseMatrixImport(matrixImportMode, matrixImportText) : null),
    [matrixImportMode, matrixImportText]
  );

  useEffect(() => {
    if (!selectedGroup) {
      setGroupWidthsInput("");
      setGroupHeightsInput("");
      return;
    }
    setGroupWidthsInput(breakpointsToCsv(selectedGroup.widths));
    setGroupHeightsInput(breakpointsToCsv(selectedGroup.heights));
  }, [selectedGroup?.key]);

  const totalTemplates = collections.length;
  const totalFabrics = draftFabrics.length;
  const totalGroups = draftGroups.length;
  const totalMatrixCells = useMemo(
    () => draftGroups.reduce((sum, group) => sum + group.widths.length * group.heights.length, 0),
    [draftGroups]
  );
  const averageMatrixPrice = useMemo(() => {
    const values = draftGroups.flatMap((group) =>
      group.heights.flatMap((height) =>
        group.widths.map((width) => Number(group.cells[buildCellKey(width, height)] || 0))
      )
    );
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [draftGroups]);
  const selectedIndustryPreset = useMemo(
    () => INDUSTRY_PRESETS[selectedCollection?.industry_type ?? "Window Treatments"],
    [selectedCollection?.industry_type]
  );
  const itemFieldSchema = useMemo(
    () =>
      selectedCollection
        ? normalizeItemFieldSchema(selectedCollection.item_field_schema, selectedCollection.industry_type)
        : [],
    [selectedCollection]
  );
  const itemTagOptions = useMemo(
    () =>
      selectedCollection
        ? normalizeItemTagOptions(selectedCollection.item_tag_options)
        : [],
    [selectedCollection]
  );
  const groupRules = useMemo(
    () => (selectedCollection ? asArray<GroupRule>(selectedCollection.group_rules) : []),
    [selectedCollection]
  );
  const visibleFabricRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return draftFabrics;
    return draftFabrics.filter((row) => {
      return (
        row.fabric_style.toLowerCase().includes(q) ||
        row.price_group.toLowerCase().includes(q) ||
        row.fabric_width.toLowerCase().includes(q) ||
        buildDynamicNotes(row, itemTagOptions).toLowerCase().includes(q)
      );
    });
  }, [draftFabrics, itemTagOptions, search]);

  function updateCollectionField(
    collectionId: string,
    field: keyof PricingCollection,
    value: string | boolean | ItemFieldDefinition[] | ItemTagOption[] | GroupRule[]
  ) {
    setCollections((prev) =>
      prev.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              [field]: value,
            }
          : collection
      )
    );
  }

  function setFabricValue(key: string, field: keyof FabricDraftRow, value: string | boolean) {
    setDraftFabrics((prev) =>
      prev.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]: typeof value === "string" ? value : value,
              dirty: true,
            }
          : row
      )
    );
  }

  function updateItemFieldSchema(nextSchema: ItemFieldDefinition[]) {
    if (!selectedCollection) return;
    updateCollectionField(selectedCollection.id, "item_field_schema", nextSchema);
  }

  function addItemField(type: ItemFieldType = "text") {
    const defaultLabel =
      type === "dropdown" ? "New Dropdown"
      : type === "multi_select" ? "New Multi-select"
      : type === "number" ? "New Number"
      : type === "toggle" ? "New Toggle"
      : type === "formula" ? "New Formula"
      : "New Field";
    const nextField = makeFieldDefinition(defaultLabel, type);
    updateItemFieldSchema([...itemFieldSchema, nextField]);
    setExpandedFieldId(nextField.id);
  }

  function addQuickField() {
    const label = quickFieldName.trim() || (
      quickFieldType === "dropdown" ? "New Dropdown"
      : quickFieldType === "multi_select" ? "New Multi-select"
      : quickFieldType === "number" ? "New Number"
      : quickFieldType === "toggle" ? "New Toggle"
      : quickFieldType === "formula" ? "New Formula"
      : "New Field"
    );
    const nextField = makeFieldDefinition(label, quickFieldType);
    updateItemFieldSchema([...itemFieldSchema, nextField]);
    setQuickFieldName("");
    setExpandedFieldId(nextField.id);
  }

  function applyFieldTemplate(industry: IndustryType) {
    const nextSchema = DEFAULT_FIELD_SCHEMA_BY_INDUSTRY[industry].map((field) => ({
      ...makeFieldDefinition(field.label, field.type, field.options),
      required: field.required,
      visibility: field.visibility,
      formula: field.formula,
      measurementMode: field.measurementMode,
      measurementFormat: field.measurementFormat,
      measurementFractions: field.measurementFractions,
    }));
    updateItemFieldSchema(nextSchema);
    setExpandedFieldId(nextSchema[0]?.id ?? "");
  }

  function updateItemField(fieldId: string, patch: Partial<ItemFieldDefinition>) {
    updateItemFieldSchema(
      itemFieldSchema.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
    );
  }

  function fieldTypeLabel(value: ItemFieldType) {
    return ITEM_FIELD_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Text";
  }

  function fieldVisibilityLabel(value: ItemFieldVisibility) {
    if (value === "manager") return "Managers only";
    if (value === "tech") return "Techs only";
    return "All";
  }

  function operatorLabel(value: GroupRule["operator"]) {
    if (value === "contains") return "contains";
    if (value === "less_than") return "is less than";
    if (value === "greater_than") return "is greater than";
    return "equals";
  }

  function openBuilderSelect(kind: BuilderSelectKind, title: string, meta: Partial<BuilderSelectMenu> = {}) {
    setBuilderSelectMenu({
      visible: true,
      title,
      kind,
      ...meta,
    });
  }

  function closeBuilderSelect() {
    setBuilderSelectMenu((prev) => ({ ...prev, visible: false }));
  }

  function selectBuilderOption(value: string) {
    const { kind, fieldId, ruleId } = builderSelectMenu;
    if (kind === "quick_type") setQuickFieldType(value as ItemFieldType);
    if (kind === "field_type" && fieldId) updateItemField(fieldId, { type: value as ItemFieldType });
    if (kind === "field_visibility" && fieldId) updateItemField(fieldId, { visibility: value as ItemFieldVisibility });
    if (kind === "rule_field" && ruleId) updateGroupRule(ruleId, { fieldId: value });
    if (kind === "rule_operator" && ruleId) updateGroupRule(ruleId, { operator: value as GroupRule["operator"] });
    closeBuilderSelect();
  }

  function builderSelectOptions() {
    if (builderSelectMenu.kind === "field_visibility") {
      return ITEM_FIELD_VISIBILITY_OPTIONS.map((option) => ({
        label: fieldVisibilityLabel(option.value),
        value: option.value,
      }));
    }
    if (builderSelectMenu.kind === "rule_field") {
      return itemFieldSchema.map((field) => ({ label: field.label || "Untitled field", value: field.id }));
    }
    if (builderSelectMenu.kind === "rule_operator") {
      return (["equals", "contains", "less_than", "greater_than"] as GroupRule["operator"][]).map((operator) => ({
        label: operatorLabel(operator),
        value: operator,
      }));
    }
    return ITEM_FIELD_TYPE_OPTIONS.map((option) => ({ label: option.label, value: option.value }));
  }

  function moveItemField(fieldId: string, direction: -1 | 1) {
    const index = itemFieldSchema.findIndex((field) => field.id === fieldId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= itemFieldSchema.length) return;

    const next = [...itemFieldSchema];
    const [field] = next.splice(index, 1);
    next.splice(nextIndex, 0, field);
    updateItemFieldSchema(next);
  }

  function removeItemField(fieldId: string) {
    updateItemFieldSchema(itemFieldSchema.filter((field) => field.id !== fieldId));
    setDraftFabrics((prev) =>
      prev.map((row) => {
        const nextValues = { ...row.field_values };
        delete nextValues[fieldId];
        return { ...row, field_values: nextValues, dirty: true };
      })
    );
  }

  function commitTagInput(rawValue: string, nextInputValue = "") {
    if (!selectedCollection) {
      setNewTagLabel(nextInputValue);
      return;
    }

    const existingLabels = new Set(itemTagOptions.map((tag) => tag.label.trim().toLowerCase()));
    const nextTags = rawValue
      .split(",")
      .map((label) => label.trim())
      .filter((label) => label.length > 0)
      .filter((label, index, labels) => labels.findIndex((next) => next.toLowerCase() === label.toLowerCase()) === index)
      .filter((label) => !existingLabels.has(label.toLowerCase()))
      .map((label, index) =>
        makeTagOption(label, DEFAULT_TAG_COLORS[(itemTagOptions.length + index) % DEFAULT_TAG_COLORS.length])
      );

    if (nextTags.length) {
      updateCollectionField(selectedCollection.id, "item_tag_options", [...itemTagOptions, ...nextTags]);
    }

    setNewTagLabel(nextInputValue);
  }

  function handleTagInputChange(value: string) {
    if (!value.includes(",")) {
      setNewTagLabel(value);
      return;
    }

    const parts = value.split(",");
    const completeValue = parts.slice(0, -1).join(",");
    const trailingValue = parts[parts.length - 1]?.trimStart() ?? "";
    commitTagInput(completeValue, trailingValue);
  }

  function addTagOption() {
    commitTagInput(newTagLabel);
  }

  function removeTagOption(tagId: string) {
    if (!selectedCollection) return;
    updateCollectionField(selectedCollection.id, "item_tag_options", itemTagOptions.filter((tag) => tag.id !== tagId));
    setDraftFabrics((prev) =>
      prev.map((row) => ({
        ...row,
        tags: row.tags.filter((tag) => tag !== tagId),
        dirty: true,
      }))
    );
  }

  function toggleRowTag(rowKey: string, tagId: string) {
    setDraftFabrics((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              tags: row.tags.includes(tagId)
                ? row.tags.filter((tag) => tag !== tagId)
                : [...row.tags, tagId],
              dirty: true,
            }
          : row
      )
    );
  }

  function setRowFieldValue(rowKey: string, fieldId: string, value: string | boolean | string[]) {
    setDraftFabrics((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              field_values: {
                ...row.field_values,
                [fieldId]: value,
              },
              dirty: true,
            }
          : row
      )
    );
  }

  function toggleRowMultiValue(rowKey: string, fieldId: string, value: string) {
    setDraftFabrics((prev) =>
      prev.map((row) => {
        if (row.key !== rowKey) return row;
        const current = Array.isArray(row.field_values[fieldId]) ? row.field_values[fieldId] as string[] : [];
        return {
          ...row,
          field_values: {
            ...row.field_values,
            [fieldId]: current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          },
          dirty: true,
        };
      })
    );
  }

  function setRowPricingLink(rowKey: string, patch: Partial<ItemPricingLink>) {
    setDraftFabrics((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              pricing_link: {
                ...row.pricing_link,
                ...patch,
              },
              dirty: true,
            }
          : row
      )
    );
  }

  function addGroupRule(groupName?: string) {
    if (!selectedCollection) return;
    const firstField = itemFieldSchema[0];
    const nextRule: GroupRule = {
      id: makeId("group-rule"),
      group: normalizeGroup(groupName || selectedGroup?.price_group || draftGroups[0]?.price_group || ""),
      fieldId: firstField?.id ?? "",
      operator: "equals",
      value: "",
    };
    updateCollectionField(selectedCollection.id, "group_rules", [...groupRules, nextRule]);
  }

  function updateGroupRule(ruleId: string, patch: Partial<GroupRule>) {
    if (!selectedCollection) return;
    updateCollectionField(
      selectedCollection.id,
      "group_rules",
      groupRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule))
    );
  }

  function removeGroupRule(ruleId: string) {
    if (!selectedCollection) return;
    updateCollectionField(
      selectedCollection.id,
      "group_rules",
      groupRules.filter((rule) => rule.id !== ruleId)
    );
  }

  function ruleMatchesRow(rule: GroupRule, row: FabricDraftRow) {
    const value = row.field_values[rule.fieldId] ?? "";
    const text = Array.isArray(value) ? value.join(", ").toLowerCase() : String(value).toLowerCase();
    const target = rule.value.toLowerCase();
    if (!rule.fieldId || !target) return false;
    if (rule.operator === "contains") return text.includes(target);
    if (rule.operator === "less_than") return Number(text) < Number(target);
    if (rule.operator === "greater_than") return Number(text) > Number(target);
    return text === target;
  }

  function applyGroupRulesToRows() {
    if (!groupRules.length) return;
    setDraftFabrics((prev) =>
      prev.map((row) => {
        const match = groupRules.find((rule) => ruleMatchesRow(rule, row));
        return match
          ? {
              ...row,
              price_group: normalizeGroup(match.group),
              pricing_link: {
                ...row.pricing_link,
                group: normalizeGroup(match.group),
                matrix: normalizeGroup(match.group),
              },
              dirty: true,
            }
          : row;
      })
    );
  }

  function assignRowGroup(rowKey: string, groupName: string) {
    const normalized = normalizeGroup(groupName);
    setDraftFabrics((prev) =>
      prev.map((row) =>
        row.key === rowKey
          ? {
              ...row,
              price_group: normalized,
              pricing_link: {
                ...row.pricing_link,
                group: normalized,
                matrix: normalized,
              },
              dirty: true,
            }
          : row
      )
    );
  }

  function shouldShowFieldForRow(field: ItemFieldDefinition, row: FabricDraftRow) {
    if (!field.conditionalFieldId || !field.conditionalValue) return true;
    const value = row.field_values[field.conditionalFieldId];
    if (Array.isArray(value)) return value.includes(field.conditionalValue);
    return String(value ?? "") === field.conditionalValue;
  }

  // ── Pricing Rules ──────────────────────────────────────────────────────────
  const activeCollectionRules = useMemo(
    () => (selectedCollection ? pricingRules.filter((r) => r.collection_id === selectedCollection.id) : []),
    [pricingRules, selectedCollection]
  );

  function addPricingRule(ruleType: PricingRuleType = "unit") {
    if (!selectedCollection) return;
    const key = `new-rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPricingRules((prev) => [
      ...prev,
      {
        key,
        collection_id: selectedCollection.id,
        rule_type: ruleType,
        label: "",
        price: "0",
        unit_label: ruleType === "unit" ? "each" : "",
        min_qty: "",
        formula_expr: ruleType === "formula" ? "{qty} * {price}" : "",
        sort_order: prev.filter((r) => r.collection_id === selectedCollection.id).length,
        is_active: true,
        isNew: true,
        dirty: true,
      },
    ]);
  }

  const activeAddOnRules = useMemo(
    () => activeCollectionRules.filter((rule) => rule.rule_type === "flat" && rule.unit_label === "add-on"),
    [activeCollectionRules]
  );

  const activeNonAddOnRules = useMemo(
    () => activeCollectionRules.filter((rule) => !(rule.rule_type === "flat" && rule.unit_label === "add-on")),
    [activeCollectionRules]
  );

  function addAddOnRule() {
    if (!selectedCollection) return;
    const key = `new-addon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setPricingRules((prev) => [
      ...prev,
      {
        key,
        collection_id: selectedCollection.id,
        rule_type: "flat",
        label: "",
        price: "0",
        unit_label: "add-on",
        min_qty: "",
        formula_expr: "",
        sort_order: prev.filter((rule) => rule.collection_id === selectedCollection.id).length,
        is_active: true,
        isNew: true,
        dirty: true,
      },
    ]);
  }

  function updatePricingRule(key: string, field: keyof PricingRule, value: string | boolean | number) {
    setPricingRules((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value, dirty: true } : r))
    );
  }

  function removePricingRule(rule: PricingRule) {
    if (rule.id) setDeletedRuleIds((prev) => [...prev, rule.id!]);
    setPricingRules((prev) => prev.filter((r) => r.key !== rule.key));
  }

  function evaluateFormula(expr: string, vars: Record<string, string>): string {
    try {
      const safeExpr = expr
        .replace(/\{qty\}/g, String(Number(vars.qty) || 1))
        .replace(/\{width\}/g, String(Number(vars.width) || 0))
        .replace(/\{height\}/g, String(Number(vars.height) || 0))
        .replace(/\{sqft\}/g, String(Number(vars.sqft) || 0))
        .replace(/\{linearft\}/g, String(Number(vars.linearft) || 0))
        .replace(/\{price\}/g, "0")
        .replace(/[^0-9+\-*/().\s]/g, "");
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${safeExpr})`)();
      return isNaN(result) || !isFinite(result) ? "—" : `$${Number(result).toFixed(2)}`;
    } catch {
      return "—";
    }
  }

  function addFabricRow() {
    if (!selectedCollection) return;

    const nextGroup = selectedGroup?.price_group ?? "";
    const key = `new-fabric-${Date.now()}`;

    setDraftFabrics((prev) => [
      ...prev,
      {
        key,
        collection_id: selectedCollection.id,
        fabric_style: "",
        price_group: nextGroup,
        fabric_width: "",
        fr: false,
        roller_shade: false,
        panel_track: false,
        multi_directional: false,
        field_values: Object.fromEntries(
          itemFieldSchema.map((field) => [
            field.id,
            field.type === "toggle" ? false : field.type === "multi_select" ? [] : "",
          ])
        ),
        tags: [],
        pricing_link: {
          group: nextGroup,
          matrix: nextGroup,
        },
        isNew: true,
        dirty: true,
      },
    ]);
  }

  function duplicateFabricRow(row: FabricDraftRow) {
    const key = `new-fabric-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDraftFabrics((prev) => [
      ...prev,
      {
        ...row,
        key,
        fabricId: undefined,
        field_values: { ...row.field_values },
        tags: [...row.tags],
        pricing_link: { ...row.pricing_link },
        isNew: true,
        dirty: true,
      },
    ]);
  }

  function removeFabricRow(row: FabricDraftRow) {
    if (row.fabricId) {
      setDeletedFabricIds((prev) => [...prev, row.fabricId!]);
    }
    setDraftFabrics((prev) => prev.filter((item) => item.key !== row.key));
  }

  function makeGroupDraft({
    priceGroup,
    widths,
    heights,
    defaultPrice,
  }: {
    priceGroup: string;
    widths: number[];
    heights: number[];
    defaultPrice: string;
  }) {
    if (!selectedCollection) return null;

    const cells: Record<string, string> = {};
    for (const height of heights) {
      for (const width of widths) {
        cells[buildCellKey(width, height)] = defaultPrice || "0";
      }
    }

    return {
      key: `new-group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      collection_id: selectedCollection.id,
      price_group: priceGroup,
      widths,
      heights,
      cells,
      cellIds: {},
      isNew: true,
      dirty: true,
    } satisfies PricingGroupDraft;
  }

  function addQuickGroup() {
    if (!selectedCollection) return;

    const priceGroup = getNextPriceGroupName(draftGroups.map((group) => group.price_group));
    const nextGroup = makeGroupDraft({
      priceGroup,
      widths: DEFAULT_WIDTHS,
      heights: DEFAULT_HEIGHTS,
      defaultPrice: "0",
    });
    if (!nextGroup) return;

    setDraftGroups((prev) => [...prev, nextGroup].sort((a, b) => a.price_group.localeCompare(b.price_group)));
    setSelectedGroupKey(nextGroup.key);
    setSelectedMatrixCell({ width: nextGroup.widths[0], height: nextGroup.heights[0] });
    setPageMessage(`Created ${getGroupLabel(priceGroup)}.`);
  }

  function createGroup() {
    if (!selectedCollection) return;

    const priceGroup = normalizeGroup(newGroupName) || getNextPriceGroupName(draftGroups.map((group) => group.price_group));
    const widths = parseBreakpointsCsv(newGroupWidths);
    const heights = parseBreakpointsCsv(newGroupHeights);
    const defaultPrice = cleanDecimal(newGroupDefaultPrice || "0");

    if (draftGroups.some((group) => normalizeGroup(group.price_group) === priceGroup)) {
      Alert.alert("Group exists", "That price group already exists in this template.");
      return;
    }

    if (!widths.length || !heights.length) {
      Alert.alert("Missing breakpoints", "Enter at least one width and one height.");
      return;
    }

    const nextGroup = makeGroupDraft({
      priceGroup,
      widths,
      heights,
      defaultPrice,
    });
    if (!nextGroup) return;

    setDraftGroups((prev) => [...prev, nextGroup].sort((a, b) => a.price_group.localeCompare(b.price_group)));
    setSelectedGroupKey(nextGroup.key);
    setSelectedMatrixCell({ width: nextGroup.widths[0], height: nextGroup.heights[0] });
    setShowGroupModal(false);
    setNewGroupName("");
    setNewGroupWidths(breakpointsToCsv(DEFAULT_WIDTHS));
    setNewGroupHeights(breakpointsToCsv(DEFAULT_HEIGHTS));
    setNewGroupDefaultPrice("0");
  }

  function duplicateGroup(group: PricingGroupDraft) {
    const nextName = getNextPriceGroupName(draftGroups.map((item) => item.price_group));
    const nextGroup = cloneGroup(group, nextName);
    setDraftGroups((prev) => [...prev, nextGroup].sort((a, b) => a.price_group.localeCompare(b.price_group)));
    setSelectedGroupKey(nextGroup.key);
    setSelectedMatrixCell({ width: nextGroup.widths[0], height: nextGroup.heights[0] });
  }

  function applyMatrixPreset(preset: (typeof MATRIX_BREAKPOINT_PRESETS)[number]) {
    if (!preset.widths.length || !preset.heights.length) {
      setGroupWidthsInput("");
      setGroupHeightsInput("");
      setPageMessage("Custom matrix selected. Enter the breakpoints you want to use.");
      return;
    }

    setGroupWidthsInput(breakpointsToCsv(preset.widths));
    setGroupHeightsInput(breakpointsToCsv(preset.heights));
    setPageMessage(`${preset.label} breakpoints loaded. Generate the matrix to apply them.`);
  }

  function handleMatrixImportAction(action: "csv" | "json" | "template" | "duplicate" | "paste") {
    setShowMatrixImportMenu(false);

    if (action === "template") {
      setGroupWidthsInput(breakpointsToCsv(DEFAULT_WIDTHS));
      setGroupHeightsInput(breakpointsToCsv(DEFAULT_HEIGHTS));
      setPageMessage("Template breakpoints loaded. Generate the matrix to apply them.");
      return;
    }

    if (action === "duplicate") {
      if (!selectedGroup) return;
      duplicateGroup(selectedGroup);
      setPageMessage(`Duplicated ${getGroupLabel(selectedGroup.price_group)} with its current matrix.`);
      return;
    }

    setMatrixImportMode(action);
    setMatrixImportText("");
    setMatrixImportStrategy("replace");
  }

  function applyMatrixImport() {
    if (!selectedGroup || !matrixImportPreview || matrixImportPreview.errors.length) return;
    const importedCells = matrixImportPreview.cells;

    setDraftGroups((prev) => {
      const current = prev.find((group) => group.key === selectedGroup.key);
      if (!current) return prev;

      const removedIds: string[] = [];
      for (const oldHeight of current.heights) {
        for (const oldWidth of current.widths) {
          const cellKey = buildCellKey(oldWidth, oldHeight);
          const willKeep = matrixImportPreview.widths.includes(oldWidth) && matrixImportPreview.heights.includes(oldHeight);
          if (!willKeep && current.cellIds[cellKey]) removedIds.push(current.cellIds[cellKey] as string);
        }
      }
      if (removedIds.length) setDeletedMatrixCellIds((existing) => [...existing, ...removedIds]);

      return prev.map((group) => {
        if (group.key !== selectedGroup.key) return group;
        const reshaped = reshapeGroup(group, matrixImportPreview.widths, matrixImportPreview.heights);
        const nextCells = matrixImportStrategy === "merge" ? { ...reshaped.cells } : { ...reshaped.cells };

        if (matrixImportStrategy === "replace") {
          for (const key of Object.keys(nextCells)) nextCells[key] = "0";
        }

        Object.entries(importedCells).forEach(([key, value]) => {
          if (key in nextCells) nextCells[key] = value;
        });

        return {
          ...reshaped,
          cells: nextCells,
          dirty: true,
        };
      });
    });

    setGroupWidthsInput(breakpointsToCsv(matrixImportPreview.widths));
    setGroupHeightsInput(breakpointsToCsv(matrixImportPreview.heights));
    setSelectedMatrixCell({ width: matrixImportPreview.widths[0], height: matrixImportPreview.heights[0] });
    setMatrixImportMode("");
    setMatrixImportText("");
    setPageMessage(
      `Imported ${matrixImportPreview.widths.length} widths, ${matrixImportPreview.heights.length} heights, and ${Object.keys(importedCells).length} cells.`
    );
  }

  function removeGroup(group: PricingGroupDraft) {
    const assignedStyles = draftFabrics.filter(
      (row) => normalizeGroup(row.price_group) === normalizeGroup(group.price_group)
    ).length;
    if (assignedStyles > 0) {
      Alert.alert(
        "Delete assigned group?",
        `${getGroupLabel(group.price_group)} is assigned to ${assignedStyles} style${assignedStyles === 1 ? "" : "s"}. Deleting it will clear those assignments.`
      );
    }

    const ids = Object.values(group.cellIds).filter(Boolean) as string[];
    if (ids.length) {
      setDeletedMatrixCellIds((prev) => [...prev, ...ids]);
    }

    setDraftGroups((prev) => prev.filter((item) => item.key !== group.key));
    setDraftFabrics((prev) =>
      prev.map((row) =>
        normalizeGroup(row.price_group) === normalizeGroup(group.price_group)
          ? {
              ...row,
              price_group: "",
              dirty: true,
            }
          : row
      )
    );
  }

  function renameGroup(groupKey: string, value: string) {
    const normalized = normalizeGroup(value);
    setDraftGroups((prev) => {
      const current = prev.find((group) => group.key === groupKey);
      if (!current) return prev;

      const oldName = current.price_group;

      const next = prev.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              price_group: normalized,
              dirty: true,
            }
          : group
      );

      if (normalized && normalized !== oldName) {
        setDraftFabrics((rows) =>
          rows.map((row) =>
            normalizeGroup(row.price_group) === normalizeGroup(oldName)
              ? {
                  ...row,
                  price_group: normalized,
                  dirty: true,
                }
              : row
          )
        );
      }

      return next;
    });
  }

  function updateGroupCell(groupKey: string, width: number, height: number, value: string) {
    const cellKey = buildCellKey(width, height);
    setDraftGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              cells: {
                ...group.cells,
                [cellKey]: cleanDecimal(value),
              },
              dirty: true,
            }
          : group
      )
    );
  }

  function updateGroupCells(groupKey: string, updater: (group: PricingGroupDraft) => Record<string, string>) {
    setDraftGroups((prev) =>
      prev.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              cells: {
                ...group.cells,
                ...updater(group),
              },
              dirty: true,
            }
          : group
      )
    );
  }

  function fillSelectedRow() {
    if (!selectedGroup || !selectedMatrixCell) return;
    const value = cleanDecimal(fillValue || "0");
    updateGroupCells(selectedGroup.key, (group) => {
      const next: Record<string, string> = {};
      for (const width of group.widths) {
        next[buildCellKey(width, selectedMatrixCell.height)] = value;
      }
      return next;
    });
  }

  function fillSelectedColumn() {
    if (!selectedGroup || !selectedMatrixCell) return;
    const value = cleanDecimal(fillValue || "0");
    updateGroupCells(selectedGroup.key, (group) => {
      const next: Record<string, string> = {};
      for (const height of group.heights) {
        next[buildCellKey(selectedMatrixCell.width, height)] = value;
      }
      return next;
    });
  }

  function fillAllCells() {
    if (!selectedGroup) return;
    const value = cleanDecimal(fillValue || "0");
    updateGroupCells(selectedGroup.key, (group) => {
      const next: Record<string, string> = {};
      for (const height of group.heights) {
        for (const width of group.widths) {
          next[buildCellKey(width, height)] = value;
        }
      }
      return next;
    });
  }

  function increaseSelectedGroupByPercent() {
    if (!selectedGroup) return;
    const percent = Number(cleanDecimal(percentIncrease || "0"));
    if (!Number.isFinite(percent)) return;
    const factor = 1 + percent / 100;

    updateGroupCells(selectedGroup.key, (group) => {
      const next: Record<string, string> = {};

      if (percentIncreaseMode === "flat") {
        for (const height of group.heights) {
          for (const width of group.widths) {
            const key = buildCellKey(width, height);
            next[key] = formatPriceCell(Number(group.cells[key] || 0) * factor);
          }
        }
        return next;
      }

      if (percentIncreaseMode === "row_progressive") {
        for (const height of group.heights) {
          let previousValue = 0;
          group.widths.forEach((width, index) => {
            const key = buildCellKey(width, height);
            previousValue = index === 0 ? Number(group.cells[key] || 0) : previousValue * factor;
            next[key] = formatPriceCell(previousValue);
          });
        }
        return next;
      }

      if (percentIncreaseMode === "column_progressive") {
        group.widths.forEach((width) => {
          let previousValue = 0;
          group.heights.forEach((height, index) => {
            const key = buildCellKey(width, height);
            previousValue = index === 0 ? Number(group.cells[key] || 0) : previousValue * factor;
            next[key] = formatPriceCell(previousValue);
          });
        });
        return next;
      }

      let previousRowValues: Record<number, number> = {};
      group.heights.forEach((height, rowIndex) => {
        let previousValue = 0;
        group.widths.forEach((width, colIndex) => {
          const key = buildCellKey(width, height);
          const value =
            rowIndex === 0 && colIndex === 0
              ? Number(group.cells[key] || 0)
              : rowIndex === 0
                ? previousValue * factor
                : (previousRowValues[width] ?? 0) * factor;

          previousValue = value;
          next[key] = formatPriceCell(value);
        });

        previousRowValues = Object.fromEntries(
          group.widths.map((width) => [width, Number(next[buildCellKey(width, height)] || 0)])
        );
      });

      return next;
    });
  }

  function getNearestBreakpoint(breakpoints: number[], rawValue: number) {
    if (!breakpoints.length) return 0;
    const sorted = [...breakpoints].sort((a, b) => a - b);
    return sorted.find((value) => rawValue <= value) ?? sorted[sorted.length - 1];
  }

  function toggleAddOnSelection(ruleKey: string) {
    setSelectedAddOnKeys((prev) =>
      prev.includes(ruleKey) ? prev.filter((item) => item !== ruleKey) : [...prev, ruleKey]
    );
  }

  const previewGroupDraft = useMemo(() => {
    if (!draftGroups.length) return null;
    return draftGroups.find((group) => group.price_group === previewGroup) ?? selectedGroup ?? draftGroups[0] ?? null;
  }, [draftGroups, previewGroup, selectedGroup]);

  useEffect(() => {
    if (!previewGroupDraft) {
      setPreviewGroup("");
      return;
    }
    setPreviewGroup((prev) => prev || previewGroupDraft.price_group);
  }, [previewGroupDraft?.key]);

  const pricingPreview = useMemo(() => {
    if (!previewGroupDraft) {
      return {
        widthInput: 0,
        heightInput: 0,
        qtyInput: 1,
        matchedWidth: 0,
        matchedHeight: 0,
        matrixUnitPrice: 0,
        matrixSubtotal: 0,
        ruleSubtotal: 0,
        addOnTotal: 0,
        total: 0,
        selectedAddOns: [] as PricingRule[],
      };
    }

    const widthInput = Number(cleanDecimal(previewWidth || "0")) || 0;
    const heightInput = Number(cleanDecimal(previewHeight || "0")) || 0;
    const qtyInput = Math.max(1, Number(cleanDecimal(previewQty || "1")) || 1);
    const matchedWidth = getNearestBreakpoint(previewGroupDraft.widths, widthInput || previewGroupDraft.widths[0] || 0);
    const matchedHeight = getNearestBreakpoint(previewGroupDraft.heights, heightInput || previewGroupDraft.heights[0] || 0);
    const matrixUnitPrice = Number(previewGroupDraft.cells[buildCellKey(matchedWidth, matchedHeight)] || 0);
    const matrixSubtotal = matrixUnitPrice * qtyInput;

    const vars = {
      qty: String(qtyInput),
      width: String(widthInput),
      height: String(heightInput),
      sqft: String((widthInput * heightInput) / 144),
      linearft: String((widthInput + heightInput) / 12),
      price: String(matrixUnitPrice),
    };

    const activeRules = activeNonAddOnRules.filter((rule) => rule.is_active);
    const ruleSubtotal = activeRules.reduce((sum, rule) => {
      const basePrice = Number(cleanDecimal(rule.price || "0")) || 0;
      if (rule.rule_type === "unit") return sum + basePrice * qtyInput;
      if (rule.rule_type === "flat") return sum + basePrice;
      if (rule.rule_type === "labor" || rule.rule_type === "material") return sum + basePrice * qtyInput;
      if (rule.rule_type === "formula") {
        try {
          const safeExpr = (rule.formula_expr || "0")
            .replace(/\{qty\}/g, vars.qty)
            .replace(/\{width\}/g, vars.width)
            .replace(/\{height\}/g, vars.height)
            .replace(/\{sqft\}/g, vars.sqft)
            .replace(/\{linearft\}/g, vars.linearft)
            .replace(/\{price\}/g, vars.price)
            .replace(/[^0-9+\-*/().\s]/g, "");
          const value = Number(new Function(`return (${safeExpr})`)());
          return sum + (Number.isFinite(value) ? value : 0);
        } catch {
          return sum;
        }
      }
      return sum;
    }, 0);

    const selectedAddOns = activeAddOnRules.filter((rule) => selectedAddOnKeys.includes(rule.key) && rule.is_active);
    const addOnTotal = selectedAddOns.reduce((sum, rule) => sum + (Number(cleanDecimal(rule.price || "0")) || 0), 0);

    return {
      widthInput,
      heightInput,
      qtyInput,
      matchedWidth,
      matchedHeight,
      matrixUnitPrice,
      matrixSubtotal,
      ruleSubtotal,
      addOnTotal,
      total: matrixSubtotal + ruleSubtotal + addOnTotal,
      selectedAddOns,
    };
  }, [previewGroupDraft, previewWidth, previewHeight, previewQty, activeNonAddOnRules, activeAddOnRules, selectedAddOnKeys]);

  function clearGroupPrices() {
    if (!selectedGroup) return;
    updateGroupCells(selectedGroup.key, (group) => {
      const next: Record<string, string> = {};
      for (const height of group.heights) {
        for (const width of group.widths) {
          next[buildCellKey(width, height)] = "0";
        }
      }
      return next;
    });
  }

  function applyGroupBreakpoints(groupKey: string, widthsCsv: string, heightsCsv: string) {
    const widths = parseBreakpointsCsv(widthsCsv);
    const heights = parseBreakpointsCsv(heightsCsv);

    if (!widths.length || !heights.length) {
      Alert.alert("Invalid breakpoints", "Widths and heights must each contain at least one number.");
      return;
    }

    setDraftGroups((prev) => {
      const current = prev.find((group) => group.key === groupKey);
      if (!current) return prev;

      const removedIds: string[] = [];

      for (const oldHeight of current.heights) {
        for (const oldWidth of current.widths) {
          const cellKey = buildCellKey(oldWidth, oldHeight);
          const willKeep = widths.includes(oldWidth) && heights.includes(oldHeight);
          if (!willKeep && current.cellIds[cellKey]) {
            removedIds.push(current.cellIds[cellKey] as string);
          }
        }
      }

      if (removedIds.length) {
        setDeletedMatrixCellIds((existing) => [...existing, ...removedIds]);
      }

      return prev.map((group) => (group.key === groupKey ? reshapeGroup(group, widths, heights) : group));
    });
  }

  async function createTemplate() {
    const name = newTemplateName.trim();
    if (!name) {
      Alert.alert("Missing name", "Enter a template name.");
      return;
    }

    try {
      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;
      const insertRes = await supabase
        .from("pricing_collections")
        .insert({
          org_id: activeOrgId,
          name,
          description: null,
          industry_type: newTemplateIndustry,
          pricing_mode: newTemplateMode,
          is_default: collections.length === 0,
          ...(supportsDynamicConfigurator
            ? {
                item_field_schema: DEFAULT_FIELD_SCHEMA_BY_INDUSTRY[newTemplateIndustry],
                item_tag_options: [],
                group_rules: [],
              }
            : {}),
        })
        .select(
          supportsDynamicConfigurator
            ? "id, name, description, industry_type, pricing_mode, is_default, item_field_schema, item_tag_options, group_rules"
            : "id, name, description, industry_type, pricing_mode, is_default"
        )
        .single();

      if (insertRes.error) throw new Error(insertRes.error.message);

      const nextTemplate = insertRes.data as unknown as PricingCollection;
      setCollections((prev) => [...prev, nextTemplate].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCollectionId(nextTemplate.id);
      setShowTemplateModal(false);
      setNewTemplateName("");
      setNewTemplateIndustry("Window Treatments");
      setNewTemplateMode("matrix");
      setPageMessage(`Created template: ${nextTemplate.name}`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to create template.");
    }
  }

  async function deleteTemplate(collection: PricingCollection) {
    if (deletingTemplateId) return false;

    try {
      setDeletingTemplateId(collection.id);
      setPageError("");
      setPageMessage("");

      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      const rulesRes = await supabase
        .from("pricing_rules")
        .delete()
        .eq("org_id", activeOrgId)
        .eq("collection_id", collection.id);
      if (rulesRes.error) throw new Error(rulesRes.error.message);

      const fabricsRes = await supabase
        .from("pricing_fabrics")
        .delete()
        .eq("org_id", activeOrgId)
        .eq("collection_id", collection.id);
      if (fabricsRes.error) throw new Error(fabricsRes.error.message);

      const cellsRes = await supabase
        .from("pricing_matrix_cells")
        .delete()
        .eq("org_id", activeOrgId)
        .eq("collection_id", collection.id);
      if (cellsRes.error) throw new Error(cellsRes.error.message);

      const collectionRes = await supabase
        .from("pricing_collections")
        .delete()
        .eq("id", collection.id)
        .eq("org_id", activeOrgId)
        .select("id");
      if (collectionRes.error) throw new Error(collectionRes.error.message);
      if (!collectionRes.data?.length) {
        throw new Error("No pricing template was deleted. Check that your account has delete access for this organization.");
      }

      setSelectedCollectionId("");
      await loadPricingPage();
      setPageMessage(`Deleted template: ${collection.name}`);
      return true;
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Failed to delete pricing template.");
      return false;
    } finally {
      setDeletingTemplateId("");
    }
  }

  function confirmDeleteTemplate(collection: PricingCollection) {
    setTemplatePendingDelete(collection);
  }

  async function saveGrid() {
    if (!selectedCollection || saving) return;

    try {
      setSaving(true);
      setPageError("");
      setPageMessage("");

      const activeOrgId = orgId || (await resolveSession()).resolvedOrgId;

      const currentCollection = collections.find((item) => item.id === selectedCollection.id) ?? selectedCollection;

      const updateCollectionRes = await supabase
        .from("pricing_collections")
        .update({
          name: currentCollection.name.trim() || "Untitled Template",
          description: currentCollection.description ?? null,
          industry_type: currentCollection.industry_type,
          pricing_mode: currentCollection.pricing_mode,
          ...(supportsDynamicConfigurator
            ? {
                item_field_schema: itemFieldSchema,
                item_tag_options: itemTagOptions,
                group_rules: groupRules,
              }
            : {}),
        })
        .eq("id", currentCollection.id)
        .eq("org_id", activeOrgId);

      if (updateCollectionRes.error) throw new Error(updateCollectionRes.error.message);

      if (deletedFabricIds.length) {
        const deleteFabricRes = await supabase
          .from("pricing_fabrics")
          .delete()
          .eq("org_id", activeOrgId)
          .in("id", deletedFabricIds);

        if (deleteFabricRes.error) throw new Error(deleteFabricRes.error.message);
      }

      if (deletedMatrixCellIds.length) {
        const deleteCellsRes = await supabase
          .from("pricing_matrix_cells")
          .delete()
          .eq("org_id", activeOrgId)
          .in("id", deletedMatrixCellIds);

        if (deleteCellsRes.error) throw new Error(deleteCellsRes.error.message);
      }

      for (const row of draftFabrics) {
        const payload = {
          org_id: activeOrgId,
          collection_id: selectedCollection.id,
          fabric_style: row.fabric_style.trim() || "Untitled Style",
          price_group: normalizeGroup(row.price_group) || null,
          fabric_width: row.fabric_width.trim() || null,
          fr: row.fr,
          roller_shade: row.roller_shade,
          panel_track: row.panel_track,
          multi_directional: row.multi_directional,
          ...(supportsDynamicConfigurator
            ? {
                field_values: row.field_values,
                tags: row.tags,
                pricing_link: {
                  ...row.pricing_link,
                  group: normalizeGroup(row.price_group) || row.pricing_link.group || "",
                  matrix: normalizeGroup(row.price_group) || row.pricing_link.matrix || "",
                },
              }
            : {}),
        };

        if (row.isNew || !row.fabricId) {
          const insertRes = await supabase.from("pricing_fabrics").insert(payload);
          if (insertRes.error) throw new Error(insertRes.error.message);
        } else if (row.dirty) {
          const updateRes = await supabase
            .from("pricing_fabrics")
            .update(payload)
            .eq("id", row.fabricId)
            .eq("org_id", activeOrgId);

          if (updateRes.error) throw new Error(updateRes.error.message);
        }
      }

      for (const group of draftGroups) {
        const groupName = normalizeGroup(group.price_group);
        if (!groupName) continue;

        for (const height of group.heights) {
          for (const width of group.widths) {
            const cellKey = buildCellKey(width, height);
            const payload = {
              org_id: activeOrgId,
              collection_id: selectedCollection.id,
              price_group: groupName,
              width_to: width,
              height_to: height,
              price: Number(cleanDecimal(group.cells[cellKey] || "0")),
            };

            const existingId = group.cellIds[cellKey];

            if (existingId) {
              const updateRes = await supabase
                .from("pricing_matrix_cells")
                .update(payload)
                .eq("id", existingId)
                .eq("org_id", activeOrgId);

              if (updateRes.error) throw new Error(updateRes.error.message);
            } else {
              const insertRes = await supabase.from("pricing_matrix_cells").insert(payload);
              if (insertRes.error) throw new Error(insertRes.error.message);
            }
          }
        }
      }

      // Save pricing rules (unit / flat / formula)
      if (deletedRuleIds.length) {
        await supabase.from("pricing_rules").delete().eq("org_id", activeOrgId).in("id", deletedRuleIds);
      }

      for (const rule of activeCollectionRules) {
        const rulePayload = {
          org_id: activeOrgId,
          collection_id: selectedCollection.id,
          rule_type: rule.rule_type,
          label: rule.label.trim() || "Untitled Rule",
          price: Number(cleanDecimal(rule.price || "0")),
          unit_label: rule.unit_label.trim() || null,
          min_qty: rule.min_qty ? Number(cleanDecimal(rule.min_qty)) : null,
          formula_expr: rule.formula_expr.trim() || null,
          sort_order: rule.sort_order,
          is_active: rule.is_active,
          updated_at: new Date().toISOString(),
        };

        if (rule.isNew || !rule.id) {
          const insertRes = await supabase.from("pricing_rules").insert(rulePayload);
          if (insertRes.error) throw new Error(insertRes.error.message);
        } else if (rule.dirty) {
          const updateRes = await supabase
            .from("pricing_rules")
            .update(rulePayload)
            .eq("id", rule.id)
            .eq("org_id", activeOrgId);
          if (updateRes.error) throw new Error(updateRes.error.message);
        }
      }
      setDeletedRuleIds([]);

      await loadPricingPage();
      setPageMessage("Pricing template saved.");
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save pricing grid.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen padded={false}>
        <AppPage>
          <PageHeader
            eyebrow="Pricing"
            title="Pricing Grid"
            subtitle="Loading pricing templates, groups, and matrices..."
          />
        </AppPage>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <AppPage>
        <PageHeader
          eyebrow="Pricing"
          title="Pricing Matrix Builder"
          subtitle="Build pricing templates by collection, auto-create price groups, and manage real width x height grids like your vendor sheets."
          actions={[
            { label: "New Template", onPress: () => setShowTemplateModal(true) },
            { label: "New Group", onPress: addQuickGroup },
            { label: saving ? "Saving..." : "Save", primary: true, onPress: () => void saveGrid() },
          ]}
        />

        {pageError ? (
          <View style={styles.bannerError}>
            <Text style={styles.bannerErrorText}>{pageError}</Text>
          </View>
        ) : null}

        {pageMessage ? (
          <View style={styles.bannerSuccess}>
            <Text style={styles.bannerSuccessText}>{pageMessage}</Text>
          </View>
        ) : null}

        <SummaryStrip>
          <SummaryCard label="Templates" value={String(totalTemplates)} meta="Pricing collections" accent="purple" />
          <SummaryCard label="Styles" value={String(totalFabrics)} meta="Fabric/style rows" accent="indigo" />
          <SummaryCard label="Groups" value={String(totalGroups)} meta="Auto-created matrices" accent="violet" />
          <SummaryCard
            label="Avg. Cell"
            value={formatMoney(averageMatrixPrice)}
            meta={`${totalMatrixCells} matrix cells`}
            accent="lavender"
          />
        </SummaryStrip>

        <ContentCard
          title="Template setup"
          subtitle="Choose the pricing template, industry preset, and grid behavior before editing groups."
        >
          <View style={styles.controlsRow}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={theme.colors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search templates, groups, styles"
                placeholderTextColor={theme.colors.muted}
                style={styles.search}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              <Pressable
                onPress={() => setShowNotes((prev) => !prev)}
                style={[styles.filterPill, showNotes ? styles.filterPillActive : null]}
              >
                <Text style={[styles.filterPillText, showNotes ? styles.filterPillTextActive : null]}>Show Notes</Text>
              </Pressable>

              {INDUSTRY_OPTIONS.map((option) => {
                const active = industryFilter === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setIndustryFilter(active ? "All" : option)}
                    style={[styles.filterPill, active ? styles.sortPillActive : null]}
                  >
                    <Text style={[styles.filterPillText, active ? styles.sortPillActiveText : null]}>{option}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {filteredCollections.map((item) => {
              const active = item.id === selectedCollection?.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedCollectionId(item.id)}
                  style={({ pressed }) => [
                    styles.filterPill,
                    active ? styles.savedViewActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={[styles.filterPillText, active ? styles.savedViewActiveText : null]}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedCollection ? (
            <View style={styles.setupGrid}>
              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Template name</Text>
                <TextInput
                  value={selectedCollection.name}
                  onChangeText={(value) => updateCollectionField(selectedCollection.id, "name", value)}
                  placeholder="Template name"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.modalInput}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Description</Text>
                <TextInput
                  value={selectedCollection.description ?? ""}
                  onChangeText={(value) => updateCollectionField(selectedCollection.id, "description", value)}
                  placeholder="Notes about this template"
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.modalInput, styles.multilineInput]}
                  multiline
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Industry preset</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {INDUSTRY_OPTIONS.map((option) => {
                    const active = selectedCollection.industry_type === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => updateCollectionField(selectedCollection.id, "industry_type", option)}
                        style={[styles.filterPill, active ? styles.filterPillActive : null]}
                      >
                        <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Pricing mode</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {PRICING_MODE_OPTIONS.map((option) => {
                    const active = selectedCollection.pricing_mode === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => updateCollectionField(selectedCollection.id, "pricing_mode", option)}
                        style={[styles.filterPill, active ? styles.filterPillActive : null]}
                      >
                        <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={styles.helperText}>Grid type: {selectedIndustryPreset.gridType}</Text>
              </View>

              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Industry fields</Text>
                <View style={styles.flagRow}>
                  {selectedIndustryPreset.fields.map((field) => (
                    <View key={field} style={[styles.miniFlag, styles.miniFlagActive]}>
                      <Text style={[styles.miniFlagText, styles.miniFlagTextActive]}>{field}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.detailActions}>
                <Pressable
                  style={[styles.secondaryBtn, styles.dangerBtn]}
                  onPress={() => confirmDeleteTemplate(selectedCollection)}
                  disabled={deletingTemplateId === selectedCollection.id}
                >
                  <Text style={styles.dangerBtnText}>
                    {deletingTemplateId === selectedCollection.id ? "Deleting Template..." : "Delete Template"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ContentCard>

        <ContentCard
          title="Live pricing preview"
          subtitle="Test the active template like a real workorder so the matrix feels connected to actual pricing."
          meta={selectedCollection ? `${selectedCollection.pricing_mode} mode` : undefined}
        >
          {!selectedCollection || !previewGroupDraft ? (
            <SoftAccentCard title="Nothing to preview" body="Select a pricing template and at least one group to test pricing." />
          ) : (
            <View style={styles.previewCard}>
              <View style={styles.previewControls}>
                <View style={styles.previewField}>
                  <Text style={styles.detailLabel}>Group</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    {draftGroups.map((group) => {
                      const active = previewGroupDraft.key === group.key;
                      return (
                        <Pressable
                          key={group.key}
                          onPress={() => setPreviewGroup(group.price_group)}
                          style={[styles.filterPill, active ? styles.filterPillActive : null]}
                        >
                          <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                            {getGroupLabel(group.price_group)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <View style={styles.previewInputRow}>
                  <View style={styles.previewField}>
                    <Text style={styles.detailLabel}>Width</Text>
                    <TextInput value={previewWidth} onChangeText={(value) => setPreviewWidth(cleanDecimal(value))} keyboardType="numeric" style={styles.modalInput} placeholder="36" placeholderTextColor={theme.colors.muted} />
                  </View>
                  <View style={styles.previewField}>
                    <Text style={styles.detailLabel}>Height</Text>
                    <TextInput value={previewHeight} onChangeText={(value) => setPreviewHeight(cleanDecimal(value))} keyboardType="numeric" style={styles.modalInput} placeholder="48" placeholderTextColor={theme.colors.muted} />
                  </View>
                  <View style={styles.previewField}>
                    <Text style={styles.detailLabel}>Qty</Text>
                    <TextInput value={previewQty} onChangeText={(value) => setPreviewQty(cleanDecimal(value))} keyboardType="numeric" style={styles.modalInput} placeholder="1" placeholderTextColor={theme.colors.muted} />
                  </View>
                </View>

                {activeAddOnRules.length ? (
                  <View style={styles.previewField}>
                    <Text style={styles.detailLabel}>Add-ons</Text>
                    <View style={styles.previewAddOnWrap}>
                      {activeAddOnRules.map((rule) => {
                        const active = selectedAddOnKeys.includes(rule.key);
                        return (
                          <Pressable key={rule.key} onPress={() => toggleAddOnSelection(rule.key)} style={[styles.previewAddOnChip, active ? styles.previewAddOnChipActive : null]}>
                            <Text style={[styles.previewAddOnChipText, active ? styles.previewAddOnChipTextActive : null]}>{rule.label || "Untitled add-on"}</Text>
                            <Text style={[styles.previewAddOnChipPrice, active ? styles.previewAddOnChipTextActive : null]}>{formatMoney(Number(cleanDecimal(rule.price || "0")) || 0)}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.previewSummary}>
                <View style={styles.previewMetricRow}>
                  <Text style={styles.previewMetricLabel}>Matched matrix cell</Text>
                  <Text style={styles.previewMetricValue}>{pricingPreview.matchedWidth}" × {pricingPreview.matchedHeight}"</Text>
                </View>
                <View style={styles.previewMetricRow}>
                  <Text style={styles.previewMetricLabel}>Matrix unit price</Text>
                  <Text style={styles.previewMetricValue}>{formatMoney(pricingPreview.matrixUnitPrice)}</Text>
                </View>
                <View style={styles.previewMetricRow}>
                  <Text style={styles.previewMetricLabel}>Matrix subtotal</Text>
                  <Text style={styles.previewMetricValue}>{formatMoney(pricingPreview.matrixSubtotal)}</Text>
                </View>
                <View style={styles.previewMetricRow}>
                  <Text style={styles.previewMetricLabel}>Rule adjustments</Text>
                  <Text style={styles.previewMetricValue}>{formatMoney(pricingPreview.ruleSubtotal)}</Text>
                </View>
                <View style={styles.previewMetricRow}>
                  <Text style={styles.previewMetricLabel}>Selected add-ons</Text>
                  <Text style={styles.previewMetricValue}>{formatMoney(pricingPreview.addOnTotal)}</Text>
                </View>
                <View style={[styles.previewMetricRow, styles.previewMetricTotalRow]}>
                  <Text style={styles.previewTotalLabel}>Preview total</Text>
                  <Text style={styles.previewTotalValue}>{formatMoney(pricingPreview.total)}</Text>
                </View>
                <Text style={styles.helperText}>
                  This preview snaps the input to the nearest available width and height breakpoint, then layers in rule pricing and optional add-ons.
                </Text>
              </View>
            </View>
          )}
        </ContentCard>

        <View style={styles.contentGrid}>
          <View style={styles.tableColumn}>
            <ContentCard
              title="Items / assignments"
              subtitle="Build configurable product rows with custom fields, tags, group logic, and pricing links."
            >
              {!selectedCollection ? (
                <EmptyState
                  icon="grid-outline"
                  title="No pricing template yet"
                  body="Create a pricing template to start building groups and grids."
                  actionLabel="New Template"
                  onAction={() => setShowTemplateModal(true)}
                />
              ) : (
                <>
                  {!supportsDynamicConfigurator ? (
                    <View style={styles.bannerError}>
                      <Text style={styles.bannerErrorText}>
                        Dynamic fields need the latest pricing configurator migration before they can be saved.
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.builderTop}>
                    <Pressable onPress={() => setShowFieldBuilder((prev) => !prev)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryBtnText}>
                        {showFieldBuilder ? "Hide Builder" : "Show Builder"}
                      </Text>
                    </Pressable>
                  </View>

                  {showFieldBuilder ? (
                    <View style={styles.builderPanel}>
                      <View style={styles.builderSection}>
                        <View style={styles.builderSectionHeader}>
                          <View>
                            <Text style={styles.builderTitle}>Field Builder</Text>
                            <Text style={styles.builderSub}>Add one clean field at a time. Open a row to edit behavior.</Text>
                          </View>
                          <View style={styles.templateChipRow}>
                            {(["Window Treatments", "Flooring", "Painting", "Custom"] as IndustryType[]).map((industry) => (
                              <Pressable key={industry} onPress={() => applyFieldTemplate(industry)} style={styles.templateChip}>
                                <Text style={styles.templateChipText}>
                                  {industry === "Window Treatments" ? "Window" : industry}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>

                        <View style={styles.quickAddRow}>
                          <Text style={styles.dragHandle}>+</Text>
                          <TextInput
                            value={quickFieldName}
                            onChangeText={setQuickFieldName}
                            placeholder="Field name"
                            placeholderTextColor={theme.colors.muted}
                            style={[styles.ruleInput, styles.quickAddName]}
                          />
                          <Pressable
                            onPress={() => openBuilderSelect("quick_type", "Field type")}
                            style={styles.selectControl}
                          >
                            <Text style={styles.selectControlText}>{fieldTypeLabel(quickFieldType)}</Text>
                            <Ionicons name="chevron-down" size={14} color={theme.colors.goldDark} />
                          </Pressable>
                          <Pressable onPress={addQuickField} style={styles.primaryBtn}>
                            <Text style={styles.primaryBtnText}>Add</Text>
                          </Pressable>
                        </View>

                        <View style={styles.fieldBuilderList}>
                          {itemFieldSchema.map((field) => {
                            const expanded = expandedFieldId === field.id;
                            const isOptionField = field.type === "dropdown" || field.type === "multi_select";
                            return (
                              <View key={field.id} style={[styles.fieldBuilderCard, expanded ? styles.fieldBuilderCardActive : null]}>
                                <Pressable onPress={() => setExpandedFieldId(expanded ? "" : field.id)} style={styles.fieldBuilderHeader}>
                                  <Ionicons name="reorder-three-outline" size={20} color={theme.colors.goldDark} />
                                  <Text style={styles.fieldBuilderSummary} numberOfLines={1}>
                                    {field.label || "Untitled field"}
                                  </Text>
                                  <Text style={styles.fieldBuilderMeta}>{fieldTypeLabel(field.type)}</Text>
                                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.muted} />
                                </Pressable>

                                {expanded ? (
                                  <>
                                    <View style={styles.fieldEditorTopRow}>
                                      <TextInput
                                        value={field.label}
                                        onChangeText={(value) => updateItemField(field.id, { label: value })}
                                        placeholder="Field name"
                                        placeholderTextColor={theme.colors.muted}
                                        style={[styles.ruleInput, styles.fieldNameInput]}
                                      />
                                      <Pressable
                                        onPress={() => openBuilderSelect("field_type", "Field type", { fieldId: field.id })}
                                        style={styles.selectControl}
                                      >
                                        <Text style={styles.selectControlText}>{fieldTypeLabel(field.type)}</Text>
                                        <Ionicons name="chevron-down" size={14} color={theme.colors.goldDark} />
                                      </Pressable>
                                      <Pressable
                                        onPress={() => updateItemField(field.id, { required: !field.required })}
                                        style={[styles.requiredToggle, field.required ? styles.requiredToggleActive : null]}
                                      >
                                        <Text style={[styles.requiredToggleText, field.required ? styles.requiredToggleTextActive : null]}>
                                          Required
                                        </Text>
                                      </Pressable>
                                      <Pressable onPress={() => removeItemField(field.id)} style={[styles.iconAction, styles.iconActionDanger]}>
                                        <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                      </Pressable>
                                    </View>

                                    {isOptionField ? (
                                      <View style={styles.conditionalEditorRow}>
                                        <Text style={styles.inlineLabel}>Options</Text>
                                        <TextInput
                                          value={field.options.join(", ")}
                                          onChangeText={(value) =>
                                            updateItemField(field.id, {
                                              options: value.split(",").map((part) => part.trim()).filter(Boolean),
                                            })
                                          }
                                          placeholder="Blackout, Sheer, Solar"
                                          placeholderTextColor={theme.colors.muted}
                                          style={[styles.ruleInput, styles.optionsInput]}
                                        />
                                      </View>
                                    ) : null}

                                    {field.type === "number" ? (
                                      <View style={styles.measurementModeBox}>
                                        <Pressable
                                          onPress={() =>
                                            updateItemField(field.id, {
                                              measurementMode: !field.measurementMode,
                                              measurementFormat: field.measurementMode ? "single" : "width_height",
                                            })
                                          }
                                          style={[styles.measurementToggle, field.measurementMode ? styles.measurementToggleActive : null]}
                                        >
                                          <Ionicons
                                            name={field.measurementMode ? "checkmark-circle" : "ellipse-outline"}
                                            size={16}
                                            color={field.measurementMode ? theme.colors.goldDark : theme.colors.muted}
                                          />
                                          <Text style={[styles.measurementToggleText, field.measurementMode ? styles.measurementToggleTextActive : null]}>
                                            Measurement Mode
                                          </Text>
                                        </Pressable>
                                        {field.measurementMode ? (
                                          <View style={styles.measurementOptionsRow}>
                                            <Pressable
                                              onPress={() => updateItemField(field.id, { measurementFormat: "width_height" })}
                                              style={[styles.filterPill, field.measurementFormat !== "single" ? styles.filterPillActive : null]}
                                            >
                                              <Text style={[styles.filterPillText, field.measurementFormat !== "single" ? styles.filterPillTextActive : null]}>
                                                Width / Height
                                              </Text>
                                            </Pressable>
                                            <Pressable
                                              onPress={() => updateItemField(field.id, { measurementFractions: !field.measurementFractions })}
                                              style={[styles.filterPill, field.measurementFractions ? styles.filterPillActive : null]}
                                            >
                                              <Text style={[styles.filterPillText, field.measurementFractions ? styles.filterPillTextActive : null]}>
                                                Fractions
                                              </Text>
                                            </Pressable>
                                          </View>
                                        ) : null}
                                      </View>
                                    ) : null}

                                    {field.type === "formula" ? (
                                      <View style={styles.conditionalEditorRow}>
                                        <Text style={styles.inlineLabel}>Formula</Text>
                                        <TextInput
                                          value={field.formula}
                                          onChangeText={(value) => updateItemField(field.id, { formula: value })}
                                          placeholder="{width} * {height} / 144"
                                          placeholderTextColor={theme.colors.muted}
                                          style={[styles.ruleInput, styles.optionsInput]}
                                          autoCapitalize="none"
                                          autoCorrect={false}
                                        />
                                      </View>
                                    ) : null}

                                    <View style={styles.roleVisibilityRow}>
                                      <Text style={styles.inlineLabel}>Visible to</Text>
                                      <Pressable
                                        onPress={() => openBuilderSelect("field_visibility", "Visible to", { fieldId: field.id })}
                                        style={styles.selectControl}
                                      >
                                        <Text style={styles.selectControlText}>{fieldVisibilityLabel(field.visibility)}</Text>
                                        <Ionicons name="chevron-down" size={14} color={theme.colors.goldDark} />
                                      </Pressable>
                                    </View>
                                  </>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.builderSection}>
                        <View style={styles.groupLogicHeader}>
                          <View>
                            <Text style={styles.builderTitle}>Group Logic</Text>
                            <Text style={styles.builderSub}>Build rules that assign rows to pricing groups.</Text>
                          </View>
                          <View style={styles.rowActionsCell}>
                            <Pressable onPress={() => addGroupRule()} style={styles.secondaryBtn}>
                              <Text style={styles.secondaryBtnText}>Add Rule</Text>
                            </Pressable>
                            <Pressable onPress={applyGroupRulesToRows} style={styles.primaryBtn}>
                              <Text style={styles.primaryBtnText}>Apply Rules</Text>
                            </Pressable>
                          </View>
                        </View>

                        {groupRules.length === 0 ? (
                          <Text style={styles.cellText}>No rules yet. Add one to auto-assign rows to groups.</Text>
                        ) : (
                          <View style={styles.groupRuleList}>
                            {groupRules.map((rule) => {
                              const ruleField = itemFieldSchema.find((field) => field.id === rule.fieldId);
                              return (
                                <View key={rule.id} style={styles.groupRuleCard}>
                                  <Text style={styles.ruleSentenceText}>IF</Text>
                                  <Pressable
                                    onPress={() => openBuilderSelect("rule_field", "Rule field", { ruleId: rule.id })}
                                    style={[styles.selectControl, styles.groupRuleFieldInput]}
                                  >
                                    <Text style={styles.selectControlText}>{ruleField?.label || "Choose field"}</Text>
                                    <Ionicons name="chevron-down" size={14} color={theme.colors.goldDark} />
                                  </Pressable>
                                  <Pressable
                                    onPress={() => openBuilderSelect("rule_operator", "Condition", { ruleId: rule.id })}
                                    style={styles.selectControl}
                                  >
                                    <Text style={styles.selectControlText}>{operatorLabel(rule.operator)}</Text>
                                    <Ionicons name="chevron-down" size={14} color={theme.colors.goldDark} />
                                  </Pressable>
                                  <TextInput
                                    value={rule.value}
                                    onChangeText={(value) => updateGroupRule(rule.id, { value })}
                                    placeholder="Value"
                                    placeholderTextColor={theme.colors.muted}
                                    style={[styles.ruleInput, styles.groupRuleValueInput]}
                                  />
                                  <Text style={styles.ruleSentenceText}>-&gt; Assign</Text>
                                  <TextInput
                                    value={rule.group}
                                    onChangeText={(value) => updateGroupRule(rule.id, { group: normalizeGroup(value) })}
                                    placeholder="Group A"
                                    placeholderTextColor={theme.colors.muted}
                                    style={[styles.ruleInput, styles.groupRuleGroupInput]}
                                  />
                                  <Pressable onPress={() => removeGroupRule(rule.id)} style={[styles.iconAction, styles.iconActionDanger]}>
                                    <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                  </Pressable>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>

                      <View style={styles.builderSection}>
                        <Text style={styles.builderTitle}>Templates / Tags</Text>
                        <View style={styles.tagBuilderRow}>
                          <TextInput
                            value={newTagLabel}
                            onChangeText={handleTagInputChange}
                            onSubmitEditing={addTagOption}
                            returnKeyType="done"
                            blurOnSubmit={false}
                            placeholder="Type tag and press Enter..."
                            placeholderTextColor={theme.colors.muted}
                            style={[styles.ruleInput, styles.tagInput]}
                          />
                          <Pressable onPress={addTagOption} style={styles.primaryBtn}>
                            <Text style={styles.primaryBtnText}>Add Tag</Text>
                          </Pressable>
                        </View>
                        <View style={styles.flagRow}>
                          {itemTagOptions.length ? (
                            itemTagOptions.map((tag) => (
                              <Pressable
                                key={tag.id}
                                onPress={() => removeTagOption(tag.id)}
                                style={[styles.tagOptionPill, { backgroundColor: tag.color }]}
                              >
                                <Text style={styles.tagOptionText}>{tag.label} x</Text>
                              </Pressable>
                            ))
                          ) : (
                            <Text style={styles.tagEmptyText}>No tags added</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {!visibleFabricRows.length ? (
                    <EmptyState
                      icon="layers-outline"
                      title="No items yet"
                      body="Add a product row, then configure fields, tags, and pricing groups."
                      actionLabel="Add Item"
                      onAction={addFabricRow}
                    />
                  ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  style={styles.tableScroller}
                  contentContainerStyle={styles.tableScrollerContent}
                >
                  <View style={[styles.table, { minWidth: 850 + itemFieldSchema.length * 180 }]}>
                    <View style={styles.tableHead}>
                      <Text style={[styles.th, styles.colStyle]}>{selectedIndustryPreset.itemLabel}</Text>
                      <Text style={[styles.th, styles.colGroup]}>{selectedIndustryPreset.groupLabel}</Text>
                      <Text style={[styles.th, styles.colTags]}>Tags</Text>
                      {itemFieldSchema.map((field) => (
                        <Text key={field.id} style={[styles.th, styles.colDynamicField]}>{field.label}</Text>
                      ))}
                      <Text style={[styles.th, styles.colPricingLink]}>Pricing Link</Text>
                      {showNotes ? <Text style={[styles.th, styles.colNotes]}>{selectedIndustryPreset.notesLabel}</Text> : null}
                      <Text style={[styles.th, styles.colRowActions]}>Actions</Text>
                    </View>

                    {visibleFabricRows.map((row, index) => (
                      <View
                        key={row.key}
                        style={[styles.tr, index % 2 === 0 ? styles.trStriped : null]}
                      >
                        <TextInput
                          value={row.fabric_style}
                          onChangeText={(value) => setFabricValue(row.key, "fabric_style", value)}
                          placeholder="Fabric style"
                          placeholderTextColor={theme.colors.muted}
                          style={[styles.cellInput, styles.colStyle]}
                        />

                        <View style={[styles.colGroup, styles.groupAssignmentCell]}>
                          {draftGroups.length ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChipRow}>
                              {draftGroups.map((group) => {
                                const active = normalizeGroup(row.price_group) === normalizeGroup(group.price_group);
                                return (
                                  <Pressable
                                    key={`${row.key}-${group.key}`}
                                    onPress={() => assignRowGroup(row.key, group.price_group)}
                                    style={[styles.groupChip, active ? styles.groupChipActive : null]}
                                  >
                                    <Text style={[styles.groupChipText, active ? styles.groupChipTextActive : null]}>
                                      {getGroupLabel(group.price_group)}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                          ) : (
                            <Text style={styles.cellText}>Create a group first</Text>
                          )}
                        </View>

                        <View style={[styles.colTags, styles.flagRow]}>
                          {itemTagOptions.length ? (
                            itemTagOptions.map((tag) => {
                              const active = row.tags.includes(tag.id) || row.tags.includes(tag.label);
                              return (
                                <Pressable
                                  key={`${row.key}-${tag.id}`}
                                  onPress={() => toggleRowTag(row.key, tag.id)}
                                  style={[
                                    styles.tagOptionPill,
                                    { backgroundColor: active ? tag.color : theme.colors.surface },
                                    active ? styles.tagOptionPillActive : null,
                                  ]}
                                >
                                  <Text style={styles.tagOptionText}>{tag.label}</Text>
                                </Pressable>
                              );
                            })
                          ) : (
                            <Text style={styles.tagEmptyText}>No tags added</Text>
                          )}
                        </View>

                        {itemFieldSchema.map((field) => {
                          const value = row.field_values[field.id];
                          const visible = shouldShowFieldForRow(field, row);
                          if (!visible) {
                            return (
                              <View key={`${row.key}-${field.id}`} style={[styles.colDynamicField, styles.hiddenFieldCell]}>
                                <Text style={styles.cellText}>Hidden</Text>
                              </View>
                            );
                          }

                          if (field.type === "toggle") {
                            const active = value === true || value === "true";
                            return (
                              <Pressable
                                key={`${row.key}-${field.id}`}
                                onPress={() => setRowFieldValue(row.key, field.id, !active)}
                                style={[styles.colDynamicField, styles.toggleField, active ? styles.toggleFieldActive : null]}
                              >
                                <Text style={[styles.toggleFieldText, active ? styles.toggleFieldTextActive : null]}>
                                  {active ? "Yes" : "No"}
                                </Text>
                              </Pressable>
                            );
                          }

                          if (field.type === "dropdown" || field.type === "multi_select") {
                            return (
                              <View key={`${row.key}-${field.id}`} style={[styles.colDynamicField, styles.optionFieldCell]}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChipRow}>
                                  {field.options.map((option: string) => {
                                    const active = field.type === "multi_select"
                                      ? Array.isArray(value) && value.includes(option)
                                      : String(value ?? "") === option;
                                    return (
                                      <Pressable
                                        key={`${row.key}-${field.id}-${option}`}
                                        onPress={() =>
                                          field.type === "multi_select"
                                            ? toggleRowMultiValue(row.key, field.id, option)
                                            : setRowFieldValue(row.key, field.id, option)
                                        }
                                        style={[styles.groupChip, active ? styles.groupChipActive : null]}
                                      >
                                        <Text style={[styles.groupChipText, active ? styles.groupChipTextActive : null]}>
                                          {option}
                                        </Text>
                                      </Pressable>
                                    );
                                  })}
                                </ScrollView>
                              </View>
                            );
                          }

                          return (
                            <TextInput
                              key={`${row.key}-${field.id}`}
                              value={String(value ?? "")}
                              onChangeText={(nextValue) => setRowFieldValue(row.key, field.id, nextValue)}
                              placeholder={field.type === "number" ? "0" : field.label}
                              placeholderTextColor={theme.colors.muted}
                              keyboardType={field.type === "number" ? "numeric" : "default"}
                              style={[styles.cellInput, styles.colDynamicField]}
                            />
                          );
                        })}

                        <View style={[styles.colPricingLink, styles.pricingLinkCell]}>
                          <Text style={styles.cellText}>Matrix: {row.pricing_link.matrix || row.price_group || "-"}</Text>
                          <TextInput
                            value={row.pricing_link.formula ?? ""}
                            onChangeText={(value) => setRowPricingLink(row.key, { formula: value })}
                            placeholder="Formula or rule"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.pricingLinkInput}
                          />
                        </View>

                        {showNotes ? (
                          <Text style={[styles.cellText, styles.colNotes]}>{buildDynamicNotes(row, itemTagOptions)}</Text>
                        ) : null}

                        <View style={[styles.colRowActions, styles.rowActionsCell]}>
                          <Pressable onPress={() => duplicateFabricRow(row)} style={styles.iconAction}>
                            <Ionicons name="copy-outline" size={15} color={theme.colors.ink} />
                          </Pressable>
                          <Pressable
                            onPress={() => removeFabricRow(row)}
                            style={[styles.iconAction, styles.iconActionDanger]}
                          >
                            <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
                </>
              )}

              {selectedCollection ? (
                <View style={styles.inlineActions}>
                  <Pressable onPress={addFabricRow} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Add Item</Text>
                  </Pressable>
                </View>
              ) : null}
            </ContentCard>

            <ContentCard
              title="Pricing grid"
              subtitle={`${selectedIndustryPreset.gridType}: edit the active group with spreadsheet-style width and height cells.`}
            >
              {!selectedCollection ? null : !draftGroups.length ? (
                <EmptyState
                  icon="calculator-outline"
                  title="No price groups yet"
                  body="Create a new group and this page will generate a full editable pricing grid."
                  actionLabel="New Group"
                  onAction={addQuickGroup}
                />
              ) : (
                <>
                  <View style={styles.inlineActions}>
                    <Pressable onPress={addQuickGroup} style={styles.primaryBtn}>
                      <Text style={styles.primaryBtnText}>Quick Add Group</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowGroupModal(true)} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryBtnText}>Advanced Group</Text>
                    </Pressable>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                    {draftGroups.map((group) => {
                      const active = selectedGroup?.key === group.key;
                      return (
                        <Pressable
                          key={group.key}
                          onPress={() => setSelectedGroupKey(group.key)}
                          style={[styles.filterPill, active ? styles.savedViewActive : null]}
                        >
                          <Text style={[styles.filterPillText, active ? styles.savedViewActiveText : null]}>
                            {getGroupLabel(group.price_group)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {selectedGroup ? (
                    <>
                      <View style={styles.matrixSectionHeader}>
                        <View style={styles.matrixSectionCopy}>
                          <Text style={styles.matrixSectionTitle}>Pricing Matrix</Text>
                          <Text style={styles.matrixSectionSubtitle}>
                            Set base values and apply automatic increases.
                          </Text>
                        </View>
                        <View style={styles.matrixStatusPill}>
                          <Text style={styles.matrixStatusText}>
                            {selectedGroup.widths.length} widths x {selectedGroup.heights.length} heights
                          </Text>
                        </View>
                      </View>

                      <View style={styles.groupHeader}>
                        <View style={styles.groupTitleWrap}>
                          <Text style={styles.groupTitle}>Active group</Text>
                          <TextInput
                            value={selectedGroup.price_group}
                            onChangeText={(value) => renameGroup(selectedGroup.key, value)}
                            placeholder="Price group"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.groupNameInput}
                          />
                        </View>

                        <View style={styles.inlineActions}>
                          <Pressable style={styles.secondaryBtn} onPress={() => duplicateGroup(selectedGroup)}>
                            <Text style={styles.secondaryBtnText}>Duplicate Group</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.secondaryBtn, styles.dangerGhostBtn]}
                            onPress={() => removeGroup(selectedGroup)}
                          >
                            <Text style={styles.dangerBtnText}>Delete Group</Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.matrixSetupCard}>
                        <View style={styles.matrixSetupHeader}>
                          <View style={styles.matrixSetupCopy}>
                            <Text style={styles.matrixSetupTitle}>Matrix Setup</Text>
                            <Text style={styles.matrixSetupSubtitle}>
                              Set breakpoints, import table data, then generate this pricing matrix.
                            </Text>
                          </View>

                          <View style={styles.matrixSetupHeaderActions}>
                            <View style={styles.matrixSizeBadge}>
                              <Text style={styles.matrixSizeBadgeText}>
                                {pendingMatrixWidths.length || selectedGroup.widths.length} x{" "}
                                {pendingMatrixHeights.length || selectedGroup.heights.length}
                              </Text>
                            </View>

                            <View style={styles.matrixImportWrap}>
                              <Pressable
                                style={styles.matrixImportBtn}
                                onPress={() => setShowMatrixImportMenu((prev) => !prev)}
                              >
                                <Ionicons name="cloud-upload-outline" size={15} color={theme.colors.primaryHover} />
                                <Text style={styles.matrixImportBtnText}>Import</Text>
                                <Ionicons name={showMatrixImportMenu ? "chevron-up" : "chevron-down"} size={14} color={theme.colors.primaryHover} />
                              </Pressable>

                              {showMatrixImportMenu ? (
                                <View style={styles.matrixImportMenu}>
                                  <Text style={styles.matrixImportMenuLabel}>Import Data</Text>
                                  {[
                                    { key: "csv", label: "Import CSV", icon: "document-text-outline" },
                                    { key: "json", label: "Import JSON", icon: "code-slash-outline" },
                                  ].map((item) => (
                                    <Pressable
                                      key={item.key}
                                      style={styles.matrixImportMenuItem}
                                      onPress={() => handleMatrixImportAction(item.key as "csv" | "json")}
                                    >
                                      <Ionicons name={item.icon as any} size={15} color={theme.colors.muted} />
                                      <Text style={styles.matrixImportMenuText}>{item.label}</Text>
                                    </Pressable>
                                  ))}

                                  <View style={styles.matrixImportMenuDivider} />
                                  <Text style={styles.matrixImportMenuLabel}>Templates</Text>
                                  {[
                                    { key: "template", label: "Load Template", icon: "albums-outline" },
                                    { key: "duplicate", label: "Duplicate Group", icon: "copy-outline" },
                                  ].map((item) => (
                                    <Pressable
                                      key={item.key}
                                      style={styles.matrixImportMenuItem}
                                      onPress={() => handleMatrixImportAction(item.key as "template" | "duplicate")}
                                    >
                                      <Ionicons name={item.icon as any} size={15} color={theme.colors.muted} />
                                      <Text style={styles.matrixImportMenuText}>{item.label}</Text>
                                    </Pressable>
                                  ))}

                                  <View style={styles.matrixImportMenuDivider} />
                                  <Text style={styles.matrixImportMenuLabel}>Quick</Text>
                                  <Pressable
                                    style={styles.matrixImportMenuItem}
                                    onPress={() => handleMatrixImportAction("paste")}
                                  >
                                    <Ionicons name="clipboard-outline" size={15} color={theme.colors.muted} />
                                    <Text style={styles.matrixImportMenuText}>Paste from Spreadsheet</Text>
                                  </Pressable>
                                </View>
                              ) : null}
                            </View>

                            <Pressable
                              style={styles.matrixGenerateBtn}
                              onPress={() => applyGroupBreakpoints(selectedGroup.key, groupWidthsInput, groupHeightsInput)}
                            >
                              <Ionicons name="grid-outline" size={15} color="#FFFFFF" />
                              <Text style={styles.matrixGenerateBtnText}>Generate Matrix</Text>
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.matrixPresetBlock}>
                          <Text style={styles.matrixPresetLabel}>Presets</Text>
                          <View style={styles.matrixPresetRow}>
                            {MATRIX_BREAKPOINT_PRESETS.map((preset) => {
                              const active =
                                preset.widths.length > 0 &&
                                sameBreakpointList(pendingMatrixWidths, preset.widths) &&
                                sameBreakpointList(pendingMatrixHeights, preset.heights);
                              return (
                                <Pressable
                                  key={preset.label}
                                  onPress={() => applyMatrixPreset(preset)}
                                  style={[styles.matrixPresetChip, active ? styles.matrixPresetChipActive : null]}
                                >
                                  <Text style={[styles.matrixPresetChipText, active ? styles.matrixPresetChipTextActive : null]}>
                                    {preset.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>

                        <View style={styles.matrixBreakpointGrid}>
                          <View style={styles.matrixBreakpointField}>
                            <Text style={styles.matrixBreakpointLabel}>Width breakpoints</Text>
                            <Text style={styles.matrixBreakpointHint}>Comma-separated values</Text>
                            <TextInput
                              value={groupWidthsInput}
                              onChangeText={setGroupWidthsInput}
                              placeholder='24, 36, 48, 60, 72'
                              placeholderTextColor={theme.colors.muted}
                              style={styles.matrixBreakpointInput}
                            />
                          </View>

                          <View style={styles.matrixBreakpointField}>
                            <Text style={styles.matrixBreakpointLabel}>Height breakpoints</Text>
                            <Text style={styles.matrixBreakpointHint}>Comma-separated values</Text>
                            <TextInput
                              value={groupHeightsInput}
                              onChangeText={setGroupHeightsInput}
                              placeholder='36, 48, 60, 72, 84'
                              placeholderTextColor={theme.colors.muted}
                              style={styles.matrixBreakpointInput}
                            />
                          </View>
                        </View>

                        <View style={styles.matrixSetupPreview}>
                          <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.primaryHover} />
                          <Text style={styles.matrixSetupPreviewText}>
                            Matrix will generate {pendingMatrixWidths.length || 0} widths - {pendingMatrixHeights.length || 0} heights - {pendingMatrixCellCount} cells.
                          </Text>
                        </View>
                      </View>

                      <View style={styles.matrixControlPanel}>
                        <View style={styles.matrixToolGroup}>
                          <Text style={styles.matrixToolGroupTitle}>Fill</Text>
                          <View style={styles.matrixToolRow}>
                            <View style={styles.toolInputWrap}>
                              <Text style={styles.breakpointLabel}>Value</Text>
                              <TextInput
                                value={fillValue}
                                onChangeText={(value) => setFillValue(cleanDecimal(value))}
                                placeholder="0"
                                placeholderTextColor={theme.colors.mutedSoft}
                                keyboardType="numeric"
                                style={styles.toolInput}
                              />
                            </View>

                            <View style={styles.toolButtonRow}>
                              <Pressable style={styles.compactBtn} onPress={fillSelectedRow} disabled={!selectedMatrixCell}>
                                <Text style={styles.compactBtnText}>Fill Row</Text>
                              </Pressable>
                              <Pressable style={styles.compactBtn} onPress={fillSelectedColumn} disabled={!selectedMatrixCell}>
                                <Text style={styles.compactBtnText}>Fill Column</Text>
                              </Pressable>
                              <Pressable style={styles.compactBtn} onPress={fillAllCells}>
                                <Text style={styles.compactBtnText}>Fill All</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>

                        <View style={styles.matrixToolGroup}>
                          <Text style={styles.matrixToolGroupTitle}>Increase</Text>
                          <View style={styles.matrixToolRow}>
                            <View style={styles.toolInputWrap}>
                              <Text style={styles.breakpointLabel}>Percent</Text>
                              <TextInput
                                value={percentIncrease}
                                onChangeText={(value) => setPercentIncrease(cleanDecimal(value))}
                                placeholder="8"
                                placeholderTextColor={theme.colors.mutedSoft}
                                keyboardType="numeric"
                                style={styles.toolInput}
                              />
                            </View>

                            <View style={styles.percentModeWrap}>
                              <Text style={styles.breakpointLabel}>Mode</Text>
                              <View style={styles.percentSegment}>
                                {PERCENT_INCREASE_MODE_OPTIONS.map((option) => {
                                  const active = percentIncreaseMode === option.value;
                                  const label =
                                    option.value === "row_progressive"
                                      ? "Row"
                                      : option.value === "column_progressive"
                                        ? "Column"
                                        : option.value === "full_progressive"
                                          ? "Full"
                                          : "Flat";
                                  return (
                                    <Pressable
                                      key={option.value}
                                      onPress={() => setPercentIncreaseMode(option.value)}
                                      style={[styles.percentSegmentBtn, active ? styles.percentSegmentBtnActive : null]}
                                    >
                                      <Text style={[styles.percentSegmentText, active ? styles.percentSegmentTextActive : null]}>
                                        {label}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>

                            <Pressable style={styles.applyIncreaseBtn} onPress={increaseSelectedGroupByPercent}>
                              <Text style={styles.applyIncreaseText}>Apply Increase</Text>
                            </Pressable>
                          </View>
                        </View>

                        <View style={styles.matrixToolGroup}>
                          <Text style={styles.matrixToolGroupTitle}>Actions</Text>
                          <View style={styles.toolButtonRow}>
                            <Pressable style={[styles.compactBtn, styles.dangerGhostBtn]} onPress={clearGroupPrices}>
                              <Text style={styles.dangerBtnText}>Clear</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      <View style={styles.matrixEditorPanel}>
                        <View style={styles.matrixEditorHeader}>
                          <View>
                            <Text style={styles.matrixEditorTitle}>{getGroupLabel(selectedGroup.price_group)}</Text>
                            <Text style={styles.matrixEditorMeta}>Mode: {PERCENT_INCREASE_MODE_OPTIONS.find((option) => option.value === percentIncreaseMode)?.label ?? "Flat"}</Text>
                          </View>
                        </View>

                      <ScrollView horizontal showsHorizontalScrollIndicator>
                        <View style={styles.matrixWrap}>
                          <View style={styles.matrixHeadRow}>
                            <View style={[styles.matrixCorner, styles.matrixHeadCell]}>
                              <Text style={styles.matrixHeaderText}>Height \ Width</Text>
                            </View>
                            {selectedGroup.widths.map((width) => (
                              <Pressable
                                key={width}
                                onPress={() => setSelectedMatrixCell({ width, height: selectedGroup.heights[0] })}
                                style={[
                                  styles.matrixHeadCell,
                                  styles.matrixCellBox,
                                  selectedMatrixCell?.width === width ? styles.matrixActiveHeader : null,
                                ]}
                              >
                                <Text style={[styles.matrixHeaderText, selectedMatrixCell?.width === width ? styles.matrixHeaderTextActive : null]}>
                                  {width}"
                                </Text>
                              </Pressable>
                            ))}
                          </View>

                          {selectedGroup.heights.map((height, rowIndex) => (
                            <View key={height} style={[styles.matrixBodyRow, rowIndex % 2 === 1 ? styles.matrixBodyRowAlt : null]}>
                              <Pressable
                                onPress={() => setSelectedMatrixCell({ width: selectedGroup.widths[0], height })}
                                style={[
                                  styles.matrixSideCell,
                                  styles.matrixCellBox,
                                  selectedMatrixCell?.height === height ? styles.matrixActiveHeader : null,
                                ]}
                              >
                                <Text style={[styles.matrixHeaderText, selectedMatrixCell?.height === height ? styles.matrixHeaderTextActive : null]}>
                                  {height}"
                                </Text>
                              </Pressable>
                              {selectedGroup.widths.map((width) => {
                                const key = buildCellKey(width, height);
                                const cellValue = selectedGroup.cells[key] ?? "";
                                const visibleCellValue = Number(cellValue || 0) === 0 ? "" : cellValue;
                                const selected =
                                  selectedMatrixCell?.width === width && selectedMatrixCell?.height === height;
                                const related =
                                  selectedMatrixCell?.width === width || selectedMatrixCell?.height === height;
                                return (
                                  <Pressable
                                    key={key}
                                    onPress={() => setSelectedMatrixCell({ width, height })}
                                    style={({ hovered }: any) => [
                                      styles.matrixCellBox,
                                      styles.matrixEditableCell,
                                      rowIndex % 2 === 1 ? styles.matrixEditableCellAlt : null,
                                      related ? styles.matrixRelatedCell : null,
                                      hovered ? styles.matrixHoverCell : null,
                                      selected ? styles.matrixSelectedCell : null,
                                    ]}
                                  >
                                    <TextInput
                                      value={visibleCellValue}
                                      onFocus={() => setSelectedMatrixCell({ width, height })}
                                      onChangeText={(value) => updateGroupCell(selectedGroup.key, width, height, value)}
                                      placeholder="0"
                                      placeholderTextColor={theme.colors.mutedSoft}
                                      keyboardType="numeric"
                                      style={styles.matrixInput}
                                    />
                                  </Pressable>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                      </View>
                    </>
                  ) : null}
                </>
              )}
            </ContentCard>
          </View>

        </View>

        <ContentCard
          title="Add-ons"
          subtitle="Optional charges that can be attached to this pricing template, like trip fees, disposal, hardware, rush work, or specialty labor."
          meta={selectedCollection ? `${activeAddOnRules.length} add-ons` : undefined}
        >
          {!selectedCollection ? (
            <SoftAccentCard title="Select a template" body="Choose a pricing template above to manage its add-ons." />
          ) : (
            <>
              <View style={styles.inlineActions}>
                <Pressable onPress={addAddOnRule} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Add Add-on</Text>
                </Pressable>
              </View>

              {activeAddOnRules.length === 0 ? (
                <SoftAccentCard
                  title="No add-ons yet"
                  body="Add optional fees or extra services so they stay available with this template."
                />
              ) : (
                <View style={styles.addOnList}>
                  {activeAddOnRules.map((rule) => (
                    <View key={rule.key} style={[styles.addOnCard, !rule.is_active ? styles.ruleCardInactive : null]}>
                      <View style={styles.addOnHeader}>
                        <View style={styles.ruleTypeBadge}>
                          <Text style={styles.ruleTypeBadgeText}>add-on</Text>
                        </View>
                        <Pressable
                          onPress={() => updatePricingRule(rule.key, "is_active", !rule.is_active)}
                          style={[styles.ruleToggle, rule.is_active ? styles.ruleToggleOn : null]}
                        >
                          <Text style={[styles.ruleToggleText, rule.is_active ? styles.ruleToggleTextOn : null]}>
                            {rule.is_active ? "Active" : "Off"}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => removePricingRule(rule)} style={styles.ruleDeleteBtn}>
                          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                        </Pressable>
                      </View>

                      <View style={styles.addOnFields}>
                        <View style={styles.addOnNameField}>
                          <Text style={styles.ruleFieldLabel}>Add-on</Text>
                          <TextInput
                            value={rule.label}
                            onChangeText={(value) => updatePricingRule(rule.key, "label", value)}
                            placeholder="e.g. Rush install, disposal, hardware kit"
                            placeholderTextColor={theme.colors.muted}
                            style={styles.ruleInput}
                          />
                        </View>
                        <View style={styles.addOnPriceField}>
                          <Text style={styles.ruleFieldLabel}>Price ($)</Text>
                          <TextInput
                            value={rule.price}
                            onChangeText={(value) => updatePricingRule(rule.key, "price", cleanDecimal(value))}
                            placeholder="0.00"
                            placeholderTextColor={theme.colors.muted}
                            keyboardType="numeric"
                            style={styles.ruleInput}
                          />
                        </View>
                        <View style={styles.addOnMinField}>
                          <Text style={styles.ruleFieldLabel}>Min qty</Text>
                          <TextInput
                            value={rule.min_qty}
                            onChangeText={(value) => updatePricingRule(rule.key, "min_qty", cleanDecimal(value))}
                            placeholder="-"
                            placeholderTextColor={theme.colors.muted}
                            keyboardType="numeric"
                            style={styles.ruleInput}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ContentCard>

        <ContentCard
          title="Pricing rules"
          subtitle="Unit prices, flat fees, and formula-based calculations for unit, flat, labor, material, and formula modes."
          meta={selectedCollection ? `${activeNonAddOnRules.length} rules` : undefined}
        >
          {!selectedCollection ? (
            <SoftAccentCard title="Select a template" body="Choose a pricing template above to manage its rules." />
          ) : (
            <>
              {/* Rule type add buttons */}
              <View style={styles.ruleAddRow}>
                {(["unit", "flat", "labor", "material", "formula"] as PricingRuleType[]).map((type) => (
                  <Pressable key={type} onPress={() => addPricingRule(type)} style={styles.ruleAddBtn}>
                    <Ionicons name="add" size={13} color={theme.colors.goldDark} />
                    <Text style={styles.ruleAddBtnText}>{type}</Text>
                  </Pressable>
                ))}
              </View>

              {activeNonAddOnRules.length === 0 ? (
                <SoftAccentCard
                  title="No rules yet"
                  body="Add unit prices (per each / sqft / hour), flat fees, or formula rules that auto-calculate based on dimensions or qty."
                />
              ) : (
                <View style={styles.ruleList}>
                  {activeNonAddOnRules.map((rule, index) => {
                    const testResult = rule.rule_type === "formula"
                      ? evaluateFormula(rule.formula_expr, formulaTestValues)
                      : null;
                    return (
                      <View key={rule.key} style={[styles.ruleCard, !rule.is_active ? styles.ruleCardInactive : null]}>
                        {/* Header row */}
                        <View style={styles.ruleCardHeader}>
                          <View style={styles.ruleTypeBadge}>
                            <Text style={styles.ruleTypeBadgeText}>{rule.rule_type}</Text>
                          </View>
                          <Pressable
                            onPress={() => updatePricingRule(rule.key, "is_active", !rule.is_active)}
                            style={[styles.ruleToggle, rule.is_active ? styles.ruleToggleOn : null]}
                          >
                            <Text style={[styles.ruleToggleText, rule.is_active ? styles.ruleToggleTextOn : null]}>
                              {rule.is_active ? "Active" : "Off"}
                            </Text>
                          </Pressable>
                          <Pressable onPress={() => removePricingRule(rule)} style={styles.ruleDeleteBtn}>
                            <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                          </Pressable>
                        </View>

                        {/* Label */}
                        <TextInput
                          value={rule.label}
                          onChangeText={(v) => updatePricingRule(rule.key, "label", v)}
                          placeholder={rule.rule_type === "flat" ? "e.g. Base service fee" : rule.rule_type === "formula" ? "e.g. Per sqft install" : "e.g. Per window install"}
                          placeholderTextColor={theme.colors.muted}
                          style={styles.ruleInput}
                        />

                        {/* Price / unit */}
                        {rule.rule_type !== "formula" ? (
                          <View style={styles.rulePriceRow}>
                            <View style={styles.rulePriceField}>
                              <Text style={styles.ruleFieldLabel}>Price ($)</Text>
                              <TextInput
                                value={rule.price}
                                onChangeText={(v) => updatePricingRule(rule.key, "price", cleanDecimal(v))}
                                placeholder="0.00"
                                placeholderTextColor={theme.colors.muted}
                                keyboardType="numeric"
                                style={styles.ruleInput}
                              />
                            </View>
                            {rule.rule_type === "unit" && (
                              <View style={styles.ruleUnitField}>
                                <Text style={styles.ruleFieldLabel}>Per unit</Text>
                                <TextInput
                                  value={rule.unit_label}
                                  onChangeText={(v) => updatePricingRule(rule.key, "unit_label", v)}
                                  placeholder="each / sqft / hr"
                                  placeholderTextColor={theme.colors.muted}
                                  style={styles.ruleInput}
                                />
                              </View>
                            )}
                            <View style={styles.ruleMinQtyField}>
                              <Text style={styles.ruleFieldLabel}>Min qty</Text>
                              <TextInput
                                value={rule.min_qty}
                                onChangeText={(v) => updatePricingRule(rule.key, "min_qty", cleanDecimal(v))}
                                placeholder="—"
                                placeholderTextColor={theme.colors.muted}
                                keyboardType="numeric"
                                style={styles.ruleInput}
                              />
                            </View>
                          </View>
                        ) : (
                          /* Formula mode */
                          <>
                            <Text style={styles.ruleFieldLabel}>Formula expression</Text>
                            <TextInput
                              value={rule.formula_expr}
                              onChangeText={(v) => updatePricingRule(rule.key, "formula_expr", v)}
                              placeholder="{qty} * {price}   or   {sqft} * 2.5"
                              placeholderTextColor={theme.colors.muted}
                              style={[styles.ruleInput, styles.ruleFormulaInput]}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                            <Text style={styles.ruleFormulaHint}>
                              Variables: {"{qty}"} {"{width}"} {"{height}"} {"{sqft}"} {"{linearft}"}
                            </Text>

                            {/* Live test calculator */}
                            <View style={styles.formulaTestBox}>
                              <Text style={styles.ruleFieldLabel}>Live test</Text>
                              <View style={styles.formulaTestInputs}>
                                {Object.entries(formulaTestValues).map(([varName, val]) => (
                                  <View key={varName} style={styles.formulaTestField}>
                                    <Text style={styles.formulaTestVarLabel}>{varName}</Text>
                                    <TextInput
                                      value={val}
                                      onChangeText={(v) => setFormulaTestValues((prev) => ({ ...prev, [varName]: v }))}
                                      keyboardType="numeric"
                                      style={styles.formulaTestInput}
                                    />
                                  </View>
                                ))}
                              </View>
                              <View style={styles.formulaTestResult}>
                                <Text style={styles.formulaTestResultLabel}>Result:</Text>
                                <Text style={styles.formulaTestResultValue}>{testResult}</Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ContentCard>

        <View style={styles.footerActions}>
          <Pressable style={styles.secondaryBtn} onPress={() => setShowTemplateModal(true)}>
            <Text style={styles.secondaryBtnText}>New Template</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={addQuickGroup} disabled={!selectedCollection}>
            <Text style={styles.secondaryBtnText}>New Group</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => void saveGrid()} disabled={!selectedCollection || saving}>
            <Text style={styles.primaryBtnText}>{saving ? "Saving..." : "Save Pricing"}</Text>
          </Pressable>
        </View>

        <Modal
          visible={Boolean(matrixImportMode)}
          transparent
          animationType="fade"
          onRequestClose={() => setMatrixImportMode("")}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.matrixImportModalCard]}>
              <View style={styles.matrixImportModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {matrixImportMode === "json" ? "Import JSON" : matrixImportMode === "paste" ? "Paste from Spreadsheet" : "Import CSV"}
                  </Text>
                  <Text style={styles.matrixImportModalSub}>
                    Paste breakpoints only or a full matrix with widths across the first row and heights down the first column.
                  </Text>
                </View>
                <Pressable style={styles.iconAction} onPress={() => setMatrixImportMode("")}>
                  <Ionicons name="close-outline" size={18} color={theme.colors.ink} />
                </Pressable>
              </View>

              <TextInput
                value={matrixImportText}
                onChangeText={setMatrixImportText}
                placeholder={
                  matrixImportMode === "json"
                    ? '{ "widths": [24, 36], "heights": [36, 48], "matrix": [[100, 120], [130, 150]] }'
                    : ",24,36,48\n36,100,120,140\n48,130,150,170"
                }
                placeholderTextColor={theme.colors.muted}
                style={[styles.modalInput, styles.matrixImportTextarea]}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.matrixImportStrategyRow}>
                {(["replace", "merge"] as const).map((strategy) => {
                  const active = matrixImportStrategy === strategy;
                  return (
                    <Pressable
                      key={strategy}
                      onPress={() => setMatrixImportStrategy(strategy)}
                      style={[styles.matrixImportStrategyBtn, active ? styles.matrixImportStrategyBtnActive : null]}
                    >
                      <Text style={[styles.matrixImportStrategyText, active ? styles.matrixImportStrategyTextActive : null]}>
                        {strategy === "replace" ? "Replace" : "Merge"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.matrixImportPreviewBox}>
                <Text style={styles.matrixImportPreviewText}>
                  {(matrixImportPreview?.widths.length ?? 0)} widths found - {(matrixImportPreview?.heights.length ?? 0)} heights found - {Object.keys(matrixImportPreview?.cells ?? {}).length} cells found
                </Text>
                {matrixImportPreview?.errors.length ? (
                  <Text style={styles.matrixImportErrorText}>{matrixImportPreview.errors.join(" ")}</Text>
                ) : (
                  <Text style={styles.matrixImportHelpText}>Valid imports can be applied to the active group.</Text>
                )}
              </View>

              <View style={styles.detailActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => setMatrixImportMode("")}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={applyMatrixImport}
                  disabled={!matrixImportPreview || Boolean(matrixImportPreview.errors.length)}
                >
                  <Text style={styles.primaryBtnText}>Apply Import</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={builderSelectMenu.visible} transparent animationType="fade" onRequestClose={closeBuilderSelect}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.selectModalCard]}>
              <Text style={styles.modalTitle}>{builderSelectMenu.title}</Text>
              <View style={styles.selectOptionList}>
                {builderSelectOptions().map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => selectBuilderOption(option.value)}
                    style={({ pressed }) => [styles.selectOptionRow, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.selectOptionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.secondaryBtn} onPress={closeBuilderSelect}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(templatePendingDelete)}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!deletingTemplateId) setTemplatePendingDelete(null);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.deleteTemplateModalCard]}>
              <View style={styles.deleteTemplateIcon}>
                <Ionicons name="trash-outline" size={22} color="#B91C1C" />
              </View>
              <Text style={styles.modalTitle}>Delete pricing template?</Text>
              <Text style={styles.deleteTemplateBody}>
                This will permanently delete {templatePendingDelete?.name ?? "this template"}, including its styles,
                groups, matrix cells, rules, and add-ons.
              </Text>

              <View style={styles.detailActions}>
                <Pressable
                  style={styles.secondaryBtn}
                  disabled={Boolean(deletingTemplateId)}
                  onPress={() => setTemplatePendingDelete(null)}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryBtn, styles.dangerBtn]}
                  disabled={!templatePendingDelete || Boolean(deletingTemplateId)}
                  onPress={() => {
                    if (!templatePendingDelete) return;
                    void deleteTemplate(templatePendingDelete).then((deleted) => {
                      if (deleted) setTemplatePendingDelete(null);
                    });
                  }}
                >
                  <Text style={styles.dangerBtnText}>
                    {deletingTemplateId ? "Deleting..." : "Delete Template"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showTemplateModal} transparent animationType="fade" onRequestClose={() => setShowTemplateModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>New Pricing Template</Text>

              <TextInput
                value={newTemplateName}
                onChangeText={setNewTemplateName}
                placeholder="Template name"
                placeholderTextColor={theme.colors.muted}
                style={styles.modalInput}
              />

              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Industry</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {INDUSTRY_OPTIONS.map((option) => {
                    const active = newTemplateIndustry === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setNewTemplateIndustry(option)}
                        style={[styles.filterPill, active ? styles.filterPillActive : null]}
                      >
                        <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.formField}>
                <Text style={styles.detailLabel}>Mode</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                  {PRICING_MODE_OPTIONS.map((option) => {
                    const active = newTemplateMode === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setNewTemplateMode(option)}
                        style={[styles.filterPill, active ? styles.filterPillActive : null]}
                      >
                        <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.detailActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => setShowTemplateModal(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={() => void createTemplate()}>
                  <Text style={styles.primaryBtnText}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showGroupModal} transparent animationType="fade" onRequestClose={() => setShowGroupModal(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Advanced Price Group</Text>

              <TextInput
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder={`Optional group name (${getNextPriceGroupName(draftGroups.map((group) => group.price_group))})`}
                placeholderTextColor={theme.colors.muted}
                style={styles.modalInput}
              />

              <TextInput
                value={newGroupWidths}
                onChangeText={setNewGroupWidths}
                placeholder='Widths: 24, 36, 48, 60'
                placeholderTextColor={theme.colors.muted}
                style={styles.modalInput}
              />

              <TextInput
                value={newGroupHeights}
                onChangeText={setNewGroupHeights}
                placeholder='Heights: 36, 48, 60, 72'
                placeholderTextColor={theme.colors.muted}
                style={styles.modalInput}
              />

              <TextInput
                value={newGroupDefaultPrice}
                onChangeText={(value) => setNewGroupDefaultPrice(cleanDecimal(value))}
                placeholder="Default price"
                placeholderTextColor={theme.colors.muted}
                keyboardType="numeric"
                style={styles.modalInput}
              />

              <View style={styles.detailActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => setShowGroupModal(false)}>
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryBtn} onPress={createGroup}>
                  <Text style={styles.primaryBtnText}>Create Group</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </AppPage>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bannerError: {
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerErrorText: { color: "#991B1B", fontWeight: "800" },
  bannerSuccess: {
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bannerSuccessText: { color: "#166534", fontWeight: "800" },

  controlsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchWrap: {
    flex: 1,
    minWidth: 260,
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: { flex: 1, color: theme.colors.ink, fontSize: 14, fontWeight: "500" },
  setupGrid: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 18,
    gap: 16,
  },
  helperText: {
    marginTop: 8,
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
  },

  pillRow: { gap: 8, paddingVertical: 2 },
  filterPill: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  filterPillActive: { backgroundColor: theme.colors.surface2, borderColor: "#BFDBFE" },
  filterPillText: { color: theme.colors.ink, fontWeight: "700", fontSize: 12.5 },
  filterPillTextActive: { color: theme.colors.goldDark },
  savedViewActive: { backgroundColor: theme.colors.ink, borderColor: theme.colors.ink },
  savedViewActiveText: { color: "#FFFFFF" },
  sortPillActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  sortPillActiveText: { color: "#1D4ED8" },

  contentGrid: {
    flexDirection: "column",
    gap: 20,
  },
  tableColumn: { width: "100%", minWidth: 320, gap: 20 },
  builderTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
  },
  builderPanel: {
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  builderSection: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  builderSectionHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  builderTitle: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  builderSub: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  templateChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  templateChip: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  templateChipText: {
    color: theme.colors.primaryHover,
    fontSize: 11.5,
    fontWeight: "900",
  },
  quickAddRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface2,
  },
  dragHandle: {
    width: 24,
    textAlign: "center",
    color: theme.colors.primaryHover,
    fontSize: 16,
    fontWeight: "900",
  },
  quickAddName: {
    flex: 1,
    minWidth: 180,
  },
  selectControl: {
    minHeight: 40,
    minWidth: 150,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectControlText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
  },
  fieldBuilderList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fieldBuilderCard: {
    width: "100%",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fieldBuilderCardActive: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
  },
  fieldBuilderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  fieldBuilderSummary: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },
  fieldBuilderMeta: {
    color: theme.colors.primaryHover,
    fontSize: 11.5,
    fontWeight: "900",
  },
  fieldBuilderIndex: {
    color: theme.colors.goldDark,
    fontSize: 12,
    fontWeight: "900",
  },
  fieldEditorTopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  fieldNameInput: {
    flex: 1,
    minWidth: 200,
  },
  requiredToggle: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  requiredToggleActive: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
  },
  requiredToggleText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  requiredToggleTextActive: {
    color: theme.colors.primaryHover,
  },
  conditionalEditorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  inlineLabel: {
    minWidth: 72,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  optionsInput: {
    flex: 1,
    minWidth: 220,
  },
  measurementModeBox: {
    gap: 8,
  },
  measurementToggle: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  measurementToggleActive: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
  },
  measurementToggleText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  measurementToggleTextActive: {
    color: theme.colors.primaryHover,
  },
  measurementOptionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleVisibilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  builderOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  tagBuilderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  tagInput: {
    flex: 1,
    minWidth: 220,
  },
  tagOptionPill: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  tagOptionPillActive: {
    borderColor: theme.colors.gold,
  },
  tagOptionText: {
    color: theme.colors.ink,
    fontSize: 11.5,
    fontWeight: "800",
  },
  tagEmptyText: {
    minHeight: 30,
    paddingHorizontal: 4,
    paddingVertical: 7,
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "800",
    fontStyle: "italic",
  },
  groupLogicHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  groupRuleList: {
    gap: 8,
  },
  groupRuleCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
  },
  groupRuleGroupInput: { width: 110 },
  groupRuleFieldInput: { width: 180 },
  groupRuleValueInput: { width: 160 },
  ruleSentenceText: {
    color: theme.colors.primaryHover,
    fontSize: 12,
    fontWeight: "900",
  },

  table: {
    minWidth: 1080,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  tableScroller: {
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    paddingBottom: 12,
  },
  tableScrollerContent: {
    paddingRight: 18,
    paddingBottom: 12,
  },
  tableHead: {
    minHeight: 46,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  th: {
    color: theme.colors.muted,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    minHeight: 62,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  trStriped: { backgroundColor: "#F8FAFC" },

  colStyle: { width: 220 },
  colGroup: { width: 190 },
  colWidth: { width: 120 },
  colFlags: { width: 300 },
  colTags: { width: 220 },
  colDynamicField: { width: 180 },
  colPricingLink: { width: 190 },
  colNotes: { width: 180 },
  colRowActions: { width: 88 },

  flagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  miniFlag: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  miniFlagActive: {
    borderColor: theme.colors.gold,
    backgroundColor: "#FFF7E6",
  },
  miniFlagText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  miniFlagTextActive: {
    color: theme.colors.goldDark,
  },

  rowActionsCell: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  iconAction: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionDanger: { backgroundColor: "#C14343", borderColor: "#C14343" },
  hiddenFieldCell: {
    minHeight: 44,
    justifyContent: "center",
  },
  optionFieldCell: {
    justifyContent: "center",
  },
  toggleField: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleFieldActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  toggleFieldText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  toggleFieldTextActive: {
    color: theme.colors.goldDark,
  },
  pricingLinkCell: {
    gap: 6,
    justifyContent: "center",
  },
  pricingLinkInput: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },

  cellInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  cellText: { color: theme.colors.muted, fontSize: 12.5, fontWeight: "500" },
  groupAssignmentCell: {
    justifyContent: "center",
  },
  groupChipRow: {
    gap: 6,
    alignItems: "center",
  },
  groupChip: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  groupChipActive: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
  },
  groupChipText: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "800",
  },
  groupChipTextActive: {
    color: theme.colors.goldDark,
  },

  inlineActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },

  matrixSectionHeader: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  matrixSectionCopy: {
    flex: 1,
    minWidth: 260,
  },
  matrixSectionTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  matrixSectionSubtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  matrixStatusPill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixStatusText: {
    color: theme.colors.primaryHover,
    fontSize: 12,
    fontWeight: "900",
  },

  groupHeader: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  groupTitleWrap: {
    flex: 1,
    minWidth: 260,
    gap: 8,
  },
  groupTitle: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupNameInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },

  breakpointEditor: {
    marginTop: 14,
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
  },
  breakpointField: { gap: 6 },
  breakpointLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  matrixSetupCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    overflow: "visible",
    zIndex: 80,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  matrixSetupHeader: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: "#FBFDFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    zIndex: 90,
  },
  matrixSetupCopy: {
    flex: 1,
    minWidth: 260,
  },
  matrixSetupTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  matrixSetupSubtitle: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  matrixSetupHeaderActions: {
    position: "relative",
    zIndex: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  matrixSizeBadge: {
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixSizeBadgeText: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  matrixImportWrap: {
    position: "relative",
    zIndex: 150,
  },
  matrixImportBtn: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  matrixImportBtnText: {
    color: theme.colors.primaryHover,
    fontSize: 13,
    fontWeight: "900",
  },
  matrixImportMenu: {
    position: "absolute",
    top: 43,
    right: 0,
    width: 224,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    padding: 7,
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 20,
    zIndex: 200,
  },
  matrixImportMenuItem: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  matrixImportMenuText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  matrixImportMenuLabel: {
    paddingHorizontal: 8,
    paddingTop: 3,
    paddingBottom: 3,
    color: theme.colors.muted,
    fontSize: 10.5,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  matrixImportMenuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  matrixGenerateBtn: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1D4ED8",
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  matrixGenerateBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  matrixImportModalCard: {
    maxWidth: 760,
  },
  matrixImportModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  matrixImportModalSub: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },
  matrixImportTextarea: {
    minHeight: 170,
    textAlignVertical: "top",
    paddingVertical: 12,
    fontFamily: "monospace",
  },
  matrixImportStrategyRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  matrixImportStrategyBtn: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixImportStrategyBtnActive: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  matrixImportStrategyText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  matrixImportStrategyTextActive: {
    color: theme.colors.primaryHover,
  },
  matrixImportPreviewBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    padding: 12,
    gap: 4,
  },
  matrixImportPreviewText: {
    color: theme.colors.primaryHover,
    fontSize: 12.5,
    fontWeight: "900",
  },
  matrixImportHelpText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  matrixImportErrorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
  },
  matrixPresetBlock: {
    position: "relative",
    zIndex: 1,
    paddingHorizontal: 14,
    paddingTop: 11,
    gap: 7,
  },
  matrixPresetLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  matrixPresetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  matrixPresetChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixPresetChipActive: {
    borderColor: "#93C5FD",
    backgroundColor: "#EFF6FF",
  },
  matrixPresetChipText: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: "800",
  },
  matrixPresetChipTextActive: {
    color: theme.colors.primaryHover,
  },
  matrixBreakpointGrid: {
    position: "relative",
    zIndex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  matrixBreakpointField: {
    flex: 1,
    minWidth: 280,
    maxWidth: 520,
    gap: 4,
  },
  matrixBreakpointLabel: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },
  matrixBreakpointHint: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  matrixBreakpointInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    backgroundColor: "#F8FAFC",
    fontSize: 13,
    fontWeight: "700",
  },
  matrixSetupPreview: {
    position: "relative",
    zIndex: 1,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FBFDFF",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  matrixSetupPreviewText: {
    color: theme.colors.primaryHover,
    fontSize: 12,
    fontWeight: "800",
  },
  matrixTools: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-end",
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
  },
  matrixControlPanel: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    padding: 14,
    gap: 14,
  },
  matrixToolGroup: {
    gap: 8,
  },
  matrixToolGroupTitle: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  matrixToolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "flex-end",
  },
  toolInputWrap: {
    gap: 6,
    minWidth: 120,
  },
  toolInput: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    fontWeight: "700",
  },
  toolButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  compactBtn: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  compactBtnText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "800",
  },
  percentModeWrap: {
    gap: 6,
    minWidth: 300,
    flex: 1,
  },
  percentModeRow: {
    gap: 8,
  },
  percentModePill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  percentModePillActive: {
    borderColor: "#BFDBFE",
    backgroundColor: theme.colors.surface2,
  },
  percentModePillText: {
    color: theme.colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  percentModePillTextActive: {
    color: theme.colors.goldDark,
  },
  percentSegment: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  percentSegmentBtn: {
    minHeight: 30,
    borderRadius: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  percentSegmentBtnActive: {
    backgroundColor: "#DBEAFE",
  },
  percentSegmentText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  percentSegmentTextActive: {
    color: theme.colors.primaryHover,
    fontWeight: "900",
  },
  applyIncreaseBtn: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  applyIncreaseText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "900",
  },
  matrixEditorPanel: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  matrixEditorHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: "#F8FAFC",
  },
  matrixEditorTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  matrixEditorMeta: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  matrixWrap: {
    backgroundColor: theme.colors.surface,
  },
  matrixHeadRow: {
    flexDirection: "row",
    backgroundColor: "#EAF1F9",
  },
  matrixBodyRow: {
    flexDirection: "row",
  },
  matrixBodyRowAlt: {
    backgroundColor: "#FBFDFF",
  },
  matrixCorner: {
    width: MATRIX_ROW_HEADER_WIDTH,
  },
  matrixHeadCell: {
    width: MATRIX_CELL_WIDTH,
    minWidth: MATRIX_CELL_WIDTH,
    maxWidth: MATRIX_CELL_WIDTH,
    height: MATRIX_CELL_HEIGHT,
    minHeight: MATRIX_CELL_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: "#D7E2F0",
    borderBottomColor: "#D7E2F0",
    alignItems: "center",
    justifyContent: "center",
  },
  matrixSideCell: {
    width: MATRIX_ROW_HEADER_WIDTH,
    minWidth: MATRIX_ROW_HEADER_WIDTH,
    maxWidth: MATRIX_ROW_HEADER_WIDTH,
    height: MATRIX_CELL_HEIGHT,
    minHeight: MATRIX_CELL_HEIGHT,
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: "#D7E2F0",
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#EAF1F9",
    alignItems: "center",
    justifyContent: "center",
  },
  matrixHeaderText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
    textAlign: "center",
  },
  matrixHeaderTextActive: {
    color: theme.colors.primaryHover,
  },
  matrixCellBox: {
    width: MATRIX_CELL_WIDTH,
    minWidth: MATRIX_CELL_WIDTH,
    maxWidth: MATRIX_CELL_WIDTH,
    height: MATRIX_CELL_HEIGHT,
    minHeight: MATRIX_CELL_HEIGHT,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: "#E2E8F0",
    borderBottomColor: "#E2E8F0",
  },
  matrixEditableCell: {
    backgroundColor: theme.colors.surface,
  },
  matrixEditableCellAlt: {
    backgroundColor: "#FBFDFF",
  },
  matrixRelatedCell: {
    backgroundColor: "#F1F7FF",
  },
  matrixHoverCell: {
    backgroundColor: "#EEF6FF",
  },
  matrixSelectedCell: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  matrixActiveHeader: {
    backgroundColor: "#DBEAFE",
  },
  matrixInput: {
    width: "100%",
    height: "100%",
    minHeight: MATRIX_CELL_HEIGHT - 1,
    color: theme.colors.ink,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: "transparent",
    paddingHorizontal: 14,
  },

  detailStack: { gap: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { color: theme.colors.muted, fontSize: 12.5, fontWeight: "700" },
  detailValue: { flex: 1, color: theme.colors.ink, fontSize: 12.5, fontWeight: "700", textAlign: "right" },

  detailActions: { marginTop: 16, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  footerActions: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  formField: { gap: 8 },

  secondaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },

  primaryBtn: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  dangerBtn: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  dangerGhostBtn: {
    borderColor: "#FECACA",
    backgroundColor: "#FFFFFF",
  },
  dangerBtnText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "800",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 14,
  },
  selectModalCard: {
    maxWidth: 360,
    borderColor: theme.colors.border,
    borderRadius: 8,
  },
  deleteTemplateModalCard: {
    maxWidth: 460,
    alignItems: "flex-start",
  },
  deleteTemplateIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTemplateBody: {
    color: theme.colors.muted,
    fontSize: 13.5,
    fontWeight: "700",
    lineHeight: 20,
  },
  selectOptionList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.surface,
  },
  selectOptionRow: {
    minHeight: 42,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  selectOptionText: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  modalTitle: { fontSize: 20, fontWeight: "900", color: theme.colors.ink },
  modalInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
  },
  multilineInput: {
    minHeight: 88,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  pressed: { opacity: 0.92 },

  // ── Pricing rules ──────────────────────────────────────────────────────────
  addOnList: {
    gap: 12,
  },
  addOnCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    backgroundColor: theme.colors.surface,
  },
  addOnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addOnFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  addOnNameField: {
    flex: 2.2,
    minWidth: 220,
    gap: 4,
  },
  addOnPriceField: {
    flex: 1,
    minWidth: 120,
    gap: 4,
  },
  addOnMinField: {
    flex: 1,
    minWidth: 100,
    gap: 4,
  },
  ruleAddRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  ruleAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: "#FFFBEB",
  },
  ruleAddBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.goldDark,
    textTransform: "capitalize",
  },
  ruleList: { gap: 12 },
  ruleCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    backgroundColor: theme.colors.surface,
  },
  ruleCardInactive: {
    opacity: 0.55,
    backgroundColor: "#F8FAFC",
  },
  ruleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.gold,
  },
  ruleTypeBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ruleToggle: {
    marginLeft: "auto" as any,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  ruleToggleOn: {
    borderColor: "#BBF7D0",
    backgroundColor: "#ECFDF5",
  },
  ruleToggleText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: theme.colors.muted,
  },
  ruleToggleTextOn: {
    color: "#166534",
  },
  ruleDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },
  ruleInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: theme.colors.surface,
  },
  rulePriceRow: {
    flexDirection: "row",
    gap: 8,
  },
  rulePriceField: { flex: 2, gap: 4 },
  ruleUnitField: { flex: 2, gap: 4 },
  ruleMinQtyField: { flex: 1, gap: 4 },
  ruleFieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ruleFormulaInput: {
    fontFamily: "monospace" as any,
    fontSize: 13,
  },
  ruleFormulaHint: {
    fontSize: 11.5,
    color: theme.colors.muted,
    fontWeight: "600",
  },
  formulaTestBox: {
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    backgroundColor: "#F0F9FF",
    padding: 12,
    gap: 10,
  },
  formulaTestInputs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  formulaTestField: {
    gap: 4,
    minWidth: 70,
  },
  formulaTestVarLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0369A1",
    textTransform: "none",
  },
  formulaTestInput: {
    minHeight: 36,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 8,
    paddingHorizontal: 8,
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: theme.colors.surface,
    width: 70,
  },
  formulaTestResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  formulaTestResultLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0369A1",
  },
  formulaTestResultValue: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  previewCard: {
    gap: 16,
  },
  previewControls: {
    gap: 14,
  },
  previewField: {
    gap: 6,
  },
  previewInputRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  previewAddOnWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  previewAddOnChip: {
    minWidth: 140,
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  previewAddOnChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  previewAddOnChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  previewAddOnChipPrice: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  previewAddOnChipTextActive: {
    color: "#FFFFFF",
  },
  previewSummary: {
    borderWidth: 1,
    borderColor: "#DBEAFE",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  previewMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  previewMetricLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
  },
  previewMetricValue: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.colors.ink,
  },
  previewMetricTotalRow: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
  },
  previewTotalLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  previewTotalValue: {
    fontSize: 20,
    fontWeight: "900",
    color: theme.colors.ink,
  },
});
