import { useEffect, useMemo, useState } from "react";
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

type RowMeta = {
  notes?: string;
  fields?: Record<string, string>;
};

type GridRow = {
  id?: string;
  sort_order: number;
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

type CustomHeader = {
  id: string;
  label: string;
  enabled: boolean;
};

type WorkOrderMeta = {
  notes?: string;
  installation?: number;
  deposit?: number;
  tax_rate_override?: number;
  customHeaders?: CustomHeader[];
  selectedTemplateName?: string;
  invoiceVisibility?: Partial<InvoiceVisibility>;
};

type FractionPickerState = {
  visible: boolean;
  rowIndex: number;
  field: "width_frac" | "length_frac" | null;
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
};

const FRACTION_OPTIONS = ["", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8"] as const;
type FractionValue = (typeof FRACTION_OPTIONS)[number];

const DEFAULT_INVOICE_VISIBILITY: InvoiceVisibility = {
  showNotes: true,
  showMeasurement: true,
  showInstallation: true,
  showDeposit: true,
  showSignature: true,
};

const DEFAULT_TEMPLATE_HEADERS: Record<string, CustomHeader[]> = {
  General: [
    { id: "mount", label: "MOUNT", enabled: true },
    { id: "val", label: "VAL", enabled: true },
    { id: "opening", label: "OPENING", enabled: true },
    { id: "prod", label: "PROD.", enabled: true },
  ],
  Windows: [
    { id: "mount", label: "MOUNT", enabled: true },
    { id: "val", label: "STYLE", enabled: true },
    { id: "opening", label: "OPENING", enabled: true },
    { id: "prod", label: "SERIES", enabled: true },
  ],
  Doors: [
    { id: "mount", label: "SWING", enabled: true },
    { id: "val", label: "HINGE", enabled: true },
    { id: "opening", label: "OPENING", enabled: true },
    { id: "prod", label: "MODEL", enabled: true },
  ],
  Flooring: [
    { id: "mount", label: "INSTALL", enabled: true },
    { id: "val", label: "GRADE", enabled: true },
    { id: "opening", label: "AREA", enabled: true },
    { id: "prod", label: "SKU", enabled: true },
  ],
  Painting: [
    { id: "mount", label: "COAT", enabled: true },
    { id: "val", label: "SHEEN", enabled: true },
    { id: "opening", label: "ROOM", enabled: true },
    { id: "prod", label: "SKU", enabled: true },
  ],
  Plumbing: [
    { id: "mount", label: "TYPE", enabled: true },
    { id: "val", label: "SIZE", enabled: true },
    { id: "opening", label: "LOCATION", enabled: true },
    { id: "prod", label: "MODEL", enabled: true },
  ],
  Electrical: [
    { id: "mount", label: "AMP", enabled: true },
    { id: "val", label: "VOLT", enabled: true },
    { id: "opening", label: "LOCATION", enabled: true },
    { id: "prod", label: "MODEL", enabled: true },
  ],
};

function cloneHeaders(headers: CustomHeader[]) {
  return headers.map((header) => ({ ...header }));
}

function makeHeaderId() {
  return `hdr_${Math.random().toString(36).slice(2, 10)}`;
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
      fields: j.fields ?? {},
    };
  }

  return {
    notes: (description ?? "").trim(),
    fields: {},
  };
}

function buildRowDescription(meta: RowMeta) {
  const payload: RowMeta = {
    notes: (meta.notes ?? "").trim() || undefined,
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
  };

  return JSON.stringify(payload);
}

function onlyWholeNumber(raw: string) {
  return (raw ?? "").replace(/[^0-9]/g, "");
}

function fractionToDecimal(frac: string) {
  switch (frac) {
    case "1/8":
      return 0.125;
    case "1/4":
      return 0.25;
    case "3/8":
      return 0.375;
    case "1/2":
      return 0.5;
    case "5/8":
      return 0.625;
    case "3/4":
      return 0.75;
    case "7/8":
      return 0.875;
    default:
      return 0;
  }
}

function measurementToSortableValue(row: GridRow) {
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
    if (!clean) return { whole: "", frac: "" };

    const fractionMatch = clean.match(/(1\/8|1\/4|3\/8|1\/2|5\/8|3\/4|7\/8)/);
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [woMeta, setWoMeta] = useState<WorkOrderMeta>({ notes: "", installation: 0, deposit: 0 });
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>(cloneHeaders(DEFAULT_TEMPLATE_HEADERS.General));
  const [selectedTemplateName, setSelectedTemplateName] = useState("General");

  const [sortKey, setSortKey] = useState<"sort_order" | "qty" | "measurement" | "color" | "amount" | string>("sort_order");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [fractionPicker, setFractionPicker] = useState<FractionPickerState>({
    visible: false,
    rowIndex: -1,
    field: null,
  });

  const invoiceVisibility = useMemo<InvoiceVisibility>(
    () => ({ ...DEFAULT_INVOICE_VISIBILITY, ...(woMeta.invoiceVisibility ?? {}) }),
    [woMeta.invoiceVisibility]
  );

  const visibleCustomHeaders = useMemo(() => customHeaders.filter((header) => header.enabled), [customHeaders]);

  const taxRate = useMemo(() => {
    const override = woMeta.tax_rate_override;
    if (typeof override === "number" && Number.isFinite(override)) return override;
    return profile?.default_tax_rate ?? 0;
  }, [profile?.default_tax_rate, woMeta.tax_rate_override]);

  useEffect(() => {
    void loadAll();
  }, [id]);

  function blankRow(sort: number): GridRow {
    const extra: Record<string, string> = {};
    customHeaders.forEach((header) => {
      extra[header.id] = "";
    });

    return {
      sort_order: sort,
      qty: "1",
      width_whole: "",
      width_frac: "",
      length_whole: "",
      length_frac: "",
      color: "",
      amount: "1",
      extra,
    };
  }

  function ensureRowExtras(nextRows: GridRow[], headers: CustomHeader[]) {
    return nextRows.map((row) => {
      const nextExtra = { ...(row.extra ?? {}) };

      headers.forEach((header) => {
        if (typeof nextExtra[header.id] !== "string") nextExtra[header.id] = "";
      });

      Object.keys(nextExtra).forEach((key) => {
        if (!headers.some((header) => header.id === key)) delete nextExtra[key];
      });

      return { ...row, extra: nextExtra };
    });
  }

  function applyHeaders(headers: CustomHeader[]) {
    setCustomHeaders(headers);
    setRows((prev) => ensureRowExtras(prev, headers));
    setWoMeta((prev) => ({
      ...prev,
      customHeaders: headers,
    }));
  }

  async function loadAll() {
    if (!id) return;

    try {
      const woRes = await supabase
        .from("work_orders")
        .select("id, org_id, title, client_name, description, status, priority, scheduled_date, due_date, created_at, work_order_number")
        .eq("id", id)
        .maybeSingle();

      if (woRes.error) throw new Error(woRes.error.message);

      const woRow = (woRes.data as WorkOrder) ?? null;
      setWo(woRow);

      let loadedHeaders = cloneHeaders(DEFAULT_TEMPLATE_HEADERS.General);
      let loadedTemplateName = "General";

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
        });

        if (meta.selectedTemplateName?.trim()) {
          loadedTemplateName = meta.selectedTemplateName.trim();
        }

        if (meta.customHeaders?.length) {
          loadedHeaders = cloneHeaders(meta.customHeaders);
        } else if (DEFAULT_TEMPLATE_HEADERS[loadedTemplateName]) {
          loadedHeaders = cloneHeaders(DEFAULT_TEMPLATE_HEADERS[loadedTemplateName]);
        }
      } else {
        setWoMeta({ notes: "", installation: 0, deposit: 0 });
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

      const grid: GridRow[] = (itemsRes.data ?? []).map((r: any) => {
        const meta = parseRowMeta(r.description);
        const measurement = parseMeasurement(r.unit);
        const fields = { ...(meta.fields ?? {}) };

        loadedHeaders.forEach((header) => {
          if (typeof fields[header.id] !== "string") fields[header.id] = "";
        });

        return {
          id: r.id,
          sort_order: r.sort_order ?? 0,
          qty: r.qty?.toString?.() ?? "1",
          width_whole: measurement.width_whole,
          width_frac: measurement.width_frac,
          length_whole: measurement.length_whole,
          length_frac: measurement.length_frac,
          color: r.item ?? "",
          amount: r.unit_price?.toString?.() ?? "1",
          extra: fields,
        };
      });

      setRows(grid.length ? ensureRowExtras(grid, loadedHeaders) : [blankRow(0)]);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;

      if (userId) {
        const pRes = await supabase
          .from("profiles")
          .select("full_name, company_name, phone, website, address1, address2, city, state, zip, default_tax_rate")
          .eq("user_id", userId)
          .maybeSingle();

        if (!pRes.error) setProfile((pRes.data as Profile) ?? null);
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

  function openFractionPicker(rowIndex: number, field: "width_frac" | "length_frac") {
    setFractionPicker({
      visible: true,
      rowIndex,
      field,
    });
  }

  function closeFractionPicker() {
    setFractionPicker({
      visible: false,
      rowIndex: -1,
      field: null,
    });
  }

  function selectFraction(value: FractionValue) {
    if (fractionPicker.field && fractionPicker.rowIndex >= 0) {
      setCellByIndex(fractionPicker.rowIndex, fractionPicker.field, value);
    }
    closeFractionPicker();
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow(prev.length)]);
  }

  function duplicateRow(idx: number) {
    setRows((prev) => {
      const src = prev[idx];
      const copy: GridRow = {
        ...src,
        id: undefined,
        sort_order: prev.length,
        extra: { ...(src.extra ?? {}) },
      };
      return [...prev, copy];
    });
  }

  function deleteRow(idx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next.map((row, i) => ({ ...row, sort_order: i })) : [blankRow(0)];
    });
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
    applyHeaders(nextHeaders);
    setWoMeta((prev) => ({
      ...prev,
      selectedTemplateName: name,
      customHeaders: nextHeaders,
    }));
  }

  function addCustomHeader() {
    const nextHeaders = [
      ...customHeaders,
      {
        id: makeHeaderId(),
        label: `HEADER ${customHeaders.length + 1}`,
        enabled: true,
      },
    ];

    applyHeaders(nextHeaders);
  }

  function removeCustomHeader(headerId: string) {
    const nextHeaders = customHeaders.filter((header) => header.id !== headerId);

    if (nextHeaders.length === 0) {
      Alert.alert("At least one header", "Keep at least one custom header in the template.");
      return;
    }

    applyHeaders(nextHeaders);
  }

  function toggleHeaderEnabled(headerId: string) {
    const nextHeaders = customHeaders.map((header) =>
      header.id === headerId ? { ...header, enabled: !header.enabled } : header
    );

    if (!nextHeaders.some((header) => header.enabled)) {
      Alert.alert("At least one visible header", "Keep at least one custom header visible.");
      return;
    }

    applyHeaders(nextHeaders);
  }

  function renameHeader(headerId: string, label: string) {
    const nextHeaders = customHeaders.map((header) =>
      header.id === headerId ? { ...header, label } : header
    );
    applyHeaders(nextHeaders);
  }

  function moveHeader(headerId: string, dir: -1 | 1) {
    const index = customHeaders.findIndex((header) => header.id === headerId);
    if (index === -1) return;

    const target = index + dir;
    if (target < 0 || target >= customHeaders.length) return;

    const nextHeaders = [...customHeaders];
    const temp = nextHeaders[index];
    nextHeaders[index] = nextHeaders[target];
    nextHeaders[target] = temp;
    applyHeaders(nextHeaders);
  }

  function resetHeadersToDefault() {
    applyTemplate("General");
  }

  function combineDuplicateMeasurements() {
    const ordered = viewRows;
    const map = new Map<string, GridRow>();
    const norm = (s: string) => (s ?? "").toString().trim().toLowerCase();

    for (const row of ordered) {
      const customParts = visibleCustomHeaders.map((header) => norm(row.extra?.[header.id] ?? ""));

      const key = [
        norm(row.width_whole),
        norm(row.width_frac),
        norm(row.length_whole),
        norm(row.length_frac),
        norm(row.color),
        ...customParts,
      ].join("|");

      if (!key.replaceAll("|", "")) continue;

      const existing = map.get(key);
      if (existing) {
        existing.qty = String(n(existing.qty) + n(row.qty));
      } else {
        map.set(key, {
          ...row,
          id: undefined,
          extra: { ...(row.extra ?? {}) },
        });
      }
    }

    const merged = Array.from(map.values()).map((row, index) => ({ ...row, sort_order: index }));
    setRows(merged.length ? merged : [blankRow(0)]);
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

  const viewRows = useMemo(() => {
    if (sortKey === "sort_order") return rows;

    const dir = sortDir === "asc" ? 1 : -1;

    const toCmp = (row: GridRow) => {
      if (sortKey === "measurement") return measurementToSortableValue(row);
      if (sortKey === "qty" || sortKey === "amount") return n(String((row as any)[sortKey] ?? ""));
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

  const subtotal = useMemo(() => viewRows.reduce((sum, row) => sum + n(row.qty || "1") * n(row.amount || "1"), 0), [viewRows]);
  const tax = useMemo(() => subtotal * (Number(taxRate) / 100), [subtotal, taxRate]);
  const installation = useMemo(() => Number(woMeta.installation ?? 0) || 0, [woMeta.installation]);
  const total = useMemo(() => subtotal + tax + installation, [subtotal, tax, installation]);
  const deposit = useMemo(() => Number(woMeta.deposit ?? 0) || 0, [woMeta.deposit]);
  const balanceDue = useMemo(() => Math.max(0, total - deposit), [total, deposit]);

  async function saveAll() {
    if (!id) return;
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
              tax_rate_override: typeof woMeta.tax_rate_override === "number" ? woMeta.tax_rate_override : undefined,
              customHeaders,
              selectedTemplateName,
              invoiceVisibility: woMeta.invoiceVisibility,
            }),
          })
          .eq("id", wo.id);

        if (workOrderUpdateRes.error) throw new Error(workOrderUpdateRes.error.message);
      }

      const normalizedRows = rows.map((row, i) => ({
        ...row,
        sort_order: i,
        qty: row.qty?.trim() ? row.qty : "1",
        amount: row.amount?.trim() ? row.amount : "1",
      }));

      const existingIds = normalizedRows.filter((row) => row.id).map((row) => row.id as string);

      const currentDb = await supabase.from("work_order_items").select("id").eq("work_order_id", id);
      if (currentDb.error) throw new Error(currentDb.error.message);

      const dbIds = (currentDb.data ?? []).map((x: any) => x.id as string);
      const toDelete = dbIds.filter((x) => !existingIds.includes(x));

      if (toDelete.length) {
        const deleteRes = await supabase.from("work_order_items").delete().in("id", toDelete);
        if (deleteRes.error) throw new Error(deleteRes.error.message);
      }

      const payload = normalizedRows.map((row, i) => ({
        ...(row.id ? { id: row.id } : {}),
        work_order_id: id,
        sort_order: i,
        qty: n(row.qty || "1"),
        unit: formatMeasurement(row).trim() || null,
        item: row.color.trim() || null,
        description: buildRowDescription({
          fields: row.extra,
        }),
        unit_price: n(row.amount || "1"),
        taxable: true,
      }));

      const upRes = await supabase
        .from("work_order_items")
        .upsert(payload)
        .select("id, sort_order, qty, unit, item, description, unit_price");

      if (upRes.error) throw new Error(upRes.error.message);

      const refreshed: GridRow[] = (upRes.data ?? [])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((row: any) => {
          const meta = parseRowMeta(row.description);
          const measurement = parseMeasurement(row.unit);
          const fields = { ...(meta.fields ?? {}) };

          customHeaders.forEach((header) => {
            if (typeof fields[header.id] !== "string") fields[header.id] = "";
          });

          return {
            id: row.id,
            sort_order: row.sort_order ?? 0,
            qty: row.qty?.toString?.() ?? "1",
            width_whole: measurement.width_whole,
            width_frac: measurement.width_frac,
            length_whole: measurement.length_whole,
            length_frac: measurement.length_frac,
            color: row.item ?? "",
            amount: row.unit_price?.toString?.() ?? "1",
            extra: fields,
          };
        });

      setRows(refreshed.length ? ensureRowExtras(refreshed, customHeaders) : [blankRow(0)]);
      Alert.alert("Saved", "Work order updated.");
    } catch (error: any) {
      Alert.alert("Save failed", error?.message ?? "Failed to save work order.");
    } finally {
      setSaving(false);
    }
  }

  async function convertToInvoice() {
    if (!wo) return;
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

      if (invRes.error || !invRes.data?.id) throw new Error(invRes.error?.message ?? "Failed to create invoice.");

      const invoiceId = invRes.data.id;
      const normalizedRows = rows.map((row) => ({
        ...row,
        qty: row.qty?.trim() ? row.qty : "1",
        amount: row.amount?.trim() ? row.amount : "1",
      }));

      const itemPayload = normalizedRows.map((row, i) => ({
        invoice_id: invoiceId,
        sort_order: i,
        qty: n(row.qty),
        unit: formatMeasurement(row).trim() || null,
        item: row.color.trim() || null,
        description: buildRowDescription({
          fields: row.extra,
        }),
        unit_price: n(row.amount),
        taxable: true,
      }));

      const copyRes = await supabase.from("invoice_items").insert(itemPayload);
      if (copyRes.error) throw new Error(copyRes.error.message);

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
      { key: "qty", label: "QTY", width: "52px", align: "center" as const },
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
      { key: "amount", label: "AMOUNT", width: "110px", align: "right" as const },
    ];

    const headerHtml = visibleColumns
      .map((col) => {
        const alignStyle = col.align === "center" ? "text-align:center;" : col.align === "right" ? "text-align:right;" : "";
        return `<th style="width:${col.width};${alignStyle}">${escapeHtml(col.label)}</th>`;
      })
      .join("");

    const rowsHtml = rows
      .map((row) => {
        const line = n(row.qty || "1") * n(row.amount || "1");
        const cells: Record<string, string> = {
          qty: `<td style="text-align:center;">${escapeHtml(row.qty || "1")}</td>`,
          measurement: `<td>${escapeHtml(formatMeasurement(row))}</td>`,
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
      "Qty",
      "Measurement",
      "Item / SKU",
      ...visibleCustomHeaders.map((header) => header.label),
      "Unit Amount",
      "Line Total",
    ];

    const lines = viewRows.map((row) => {
      const lineTotal = n(row.qty || "1") * n(row.amount || "1");
      return [
        formatWorkOrderNumber(wo?.work_order_number),
        wo?.title ?? "",
        wo?.client_name ?? "",
        row.qty || "1",
        formatMeasurement(row),
        row.color,
        ...visibleCustomHeaders.map((header) => row.extra?.[header.id] ?? ""),
        row.amount,
        lineTotal.toFixed(2),
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
      const filename = `${formatWorkOrderNumber(wo?.work_order_number).replace(/[^a-zA-Z0-9-]/g, "_") || "work-order"}.doc`;
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
      const filename = `${formatWorkOrderNumber(wo?.work_order_number).replace(/[^a-zA-Z0-9-]/g, "_") || "work-order"}.csv`;
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

  const FractionSelect = ({ value, onPress }: { value: string; onPress: () => void }) => (
    <Pressable onPress={onPress} style={styles.fractionChip}>
      <Text style={styles.fractionChipText}>{value || "Select"}</Text>
      <Ionicons name="chevron-down" size={12} color={PALETTE.mutedSoft} />
    </Pressable>
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
    key: "qty" | "measurement" | "color" | "amount",
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

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={PALETTE.ink} />
            <Text style={styles.backText}>Work Orders</Text>
          </Pressable>

          <View style={styles.topActions}>
            <Pressable onPress={() => setShowExportMenu(true)} style={styles.secondaryBtn}>
              <Ionicons name="document-text-outline" size={16} color={PALETTE.ink} />
              <Text style={styles.secondaryText}>Export</Text>
            </Pressable>

            <Pressable
              onPress={convertToInvoice}
              style={[styles.secondaryBtn, converting ? { opacity: 0.7 } : null]}
              disabled={converting}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={PALETTE.ink} />
              <Text style={styles.secondaryText}>{converting ? "Converting..." : "Convert to Invoice"}</Text>
            </Pressable>

            <Pressable onPress={() => setShowDeleteConfirm(true)} disabled={deleting} style={[styles.deletePrimaryBtn, deleting ? styles.disabledBtn : null]}>
              <Ionicons name="trash-outline" size={15} color="#fff" />
              <Text style={styles.deletePrimaryBtnText}>{deleting ? "Deleting..." : "Delete"}</Text>
            </Pressable>

            <GoldButton label={saving ? "Saving..." : "Save"} onPress={saveAll} disabled={saving} style={{ minWidth: 140 }} />
          </View>
        </View>

        <View style={styles.headerCard}>
          <View style={styles.workOrderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h1}>
                {formatWorkOrderNumber(wo?.work_order_number) !== "—" ? `${formatWorkOrderNumber(wo?.work_order_number)} • ` : ""}
                {wo?.title ?? "Work Order"}
              </Text>
              <Text style={styles.sub}>{wo?.client_name ? `Client: ${wo.client_name}` : "Client: —"}</Text>
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

            <View style={styles.metaColSmall}>
              <Text style={styles.metaLabel}>Tax %</Text>
              <TextInput
                value={formatPercentDisplay(String(typeof woMeta.tax_rate_override === "number" ? woMeta.tax_rate_override : taxRate))}
                onChangeText={(v) => {
                  const x = formatPercentDisplay(v);
                  setWoMeta((p) => ({ ...p, tax_rate_override: x.trim() ? Number(x) : undefined }));
                }}
                placeholder="0"
                placeholderTextColor={PALETTE.muted}
                style={styles.metaInputSingle}
                keyboardType="numeric"
              />

              <Text style={[styles.metaLabel, { marginTop: 10 }]}>Installation</Text>
              <TextInput
                value={formatCurrencyDisplay(String(woMeta.installation ?? 0))}
                onChangeText={(v) => setWoMeta((p) => ({ ...p, installation: Number(cleanDecimalInput(v) || "0") }))}
                placeholder="0.00"
                placeholderTextColor={PALETTE.muted}
                style={styles.metaInputSingle}
                keyboardType="numeric"
              />

              <Text style={[styles.metaLabel, { marginTop: 10 }]}>Deposit</Text>
              <TextInput
                value={formatCurrencyDisplay(String(woMeta.deposit ?? 0))}
                onChangeText={(v) => setWoMeta((p) => ({ ...p, deposit: Number(cleanDecimalInput(v) || "0") }))}
                placeholder="0.00"
                placeholderTextColor={PALETTE.muted}
                style={styles.metaInputSingle}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.gridCard}>
          <View style={styles.gridToolbar}>
            <View style={styles.gridToolbarLeft}>
              <Text style={styles.sectionTitle}>Grid</Text>
              <Text style={styles.sectionSub}>Templates, dynamic headers, measurements, rows</Text>
            </View>

            <View style={styles.gridToolbarRight}>
              <View style={styles.templateWrapCompact}>
                <Text style={styles.inlineLabel}>Header template</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatePills}>
                  {Object.keys(DEFAULT_TEMPLATE_HEADERS).map((name) => {
                    const active = name === selectedTemplateName;
                    return (
                      <Pressable key={name} onPress={() => applyTemplate(name)} style={[styles.templatePill, active ? styles.templatePillActive : null]}>
                        <Text style={[styles.templatePillText, active ? styles.templatePillTextActive : null]}>{name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Pressable onPress={addCustomHeader} style={styles.secondaryBtnSmall}>
                <Ionicons name="add-circle-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Add header</Text>
              </Pressable>

              <Pressable onPress={resetHeadersToDefault} style={styles.secondaryBtnSmall}>
                <Ionicons name="refresh-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Reset</Text>
              </Pressable>

              <Pressable onPress={combineDuplicateMeasurements} style={styles.secondaryBtnSmall}>
                <Ionicons name="git-merge-outline" size={15} color={PALETTE.ink} />
                <Text style={styles.secondaryText}>Combine</Text>
              </Pressable>

              <Pressable onPress={addRow} style={styles.addRowBtn}>
                <Ionicons name="add" size={16} color="#111" />
                <Text style={styles.addRowText}>Add row</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.headerManagerCard}>
            <View style={styles.headerManagerTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.managerTitle}>Headers</Text>
                <Text style={styles.managerSub}>Compact editor for rename, show/hide, move, and delete.</Text>
              </View>

              <Pressable onPress={addCustomHeader} style={styles.headerMiniAddBtn}>
                <Ionicons name="add" size={14} color="#111" />
                <Text style={styles.headerMiniAddBtnText}>Header</Text>
              </Pressable>
            </View>

            <View style={styles.headerManagerGridCompact}>
              {customHeaders.map((header, index) => (
                <View key={header.id} style={styles.headerCompactCard}>
                  <View style={styles.headerCompactTop}>
                    <Text style={styles.headerCompactIndex}>{index + 1}</Text>

                    <Pressable
                      onPress={() => toggleHeaderEnabled(header.id)}
                      style={[styles.headerCompactToggle, header.enabled ? styles.headerCompactToggleOn : null]}
                    >
                      <Text style={[styles.headerCompactToggleText, header.enabled ? styles.headerCompactToggleTextOn : null]}>
                        {header.enabled ? "On" : "Off"}
                      </Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={header.label}
                    onChangeText={(v) => renameHeader(header.id, v)}
                    placeholder="Header"
                    placeholderTextColor={PALETTE.muted}
                    style={styles.headerCompactInput}
                  />

                  <View style={styles.headerCompactActions}>
                    <Pressable onPress={() => moveHeader(header.id, -1)} style={styles.headerCompactIconBtn}>
                      <Ionicons name="arrow-back" size={14} color={PALETTE.ink} />
                    </Pressable>

                    <Pressable onPress={() => moveHeader(header.id, 1)} style={styles.headerCompactIconBtn}>
                      <Ionicons name="arrow-forward" size={14} color={PALETTE.ink} />
                    </Pressable>

                    <Pressable onPress={() => removeCustomHeader(header.id)} style={styles.headerCompactDeleteBtn}>
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.tableWrap}>
            <View style={styles.thead}>
              {renderStaticHeader("qty", "QTY", 0.65, "center")}
              {renderStaticHeader("measurement", "MEASUREMENT", 2.55)}
              {renderStaticHeader("color", "ITEM / SKU", 2.05)}

              {visibleCustomHeaders.map((header) => (
                <Pressable key={header.id} onPress={() => toggleSort(header.id)} style={[styles.thPress, { flex: 0.95 }]}>
                  <Text style={styles.thText} numberOfLines={1}>
                    {header.label}
                  </Text>
                  {headerSortBadge(header.id)}
                </Pressable>
              ))}

              {renderStaticHeader("amount", "AMOUNT", 0.9, "flex-end")}

              <View style={[styles.thPress, { width: 88, alignItems: "flex-end" }]}>
                    <Text style={styles.thText} numberOfLines={1}>
                  ACTIONS
                </Text>
              </View>
            </View>

            <ScrollView style={styles.rowsScroll}>
              {viewRows.map((row, idx) => {
                const line = n(row.qty || "1") * n(row.amount || "1");
                const isStriped = idx % 2 === 0;

                return (
                  <Pressable key={row.id ?? `new-${idx}`} style={({ pressed }) => [styles.tr, isStriped ? styles.trStriped : null, pressed ? styles.trPressed : null]}>
                    <TextInput
                      value={row.qty}
                      onChangeText={(v) => setCellByIndex(idx, "qty", onlyWholeNumber(v))}
                      style={[styles.tdInput, styles.qtyCell]}
                      placeholder="1"
                      placeholderTextColor={PALETTE.muted}
                      keyboardType="numeric"
                    />

                    <View style={styles.measureCell}>
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
                          <FractionSelect value={row.width_frac} onPress={() => openFractionPicker(idx, "width_frac")} />
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
                          <FractionSelect value={row.length_frac} onPress={() => openFractionPicker(idx, "length_frac")} />
                        </View>
                      </View>
                    </View>

                    <TextInput
                      value={row.color}
                      onChangeText={(v) => setCellByIndex(idx, "color", v)}
                      style={[styles.tdInput, { flex: 2.05 }]}
                      placeholder="Color / SKU"
                      placeholderTextColor={PALETTE.muted}
                    />

                    {visibleCustomHeaders.map((header) => (
                      <TextInput
                        key={`${row.id ?? idx}-${header.id}`}
                        value={row.extra?.[header.id] ?? ""}
                        onChangeText={(v) => setExtraCellByIndex(idx, header.id, v)}
                        style={[styles.tdInput, { flex: 0.95 }]}
                        placeholder={header.label}
                        placeholderTextColor={PALETTE.muted}
                      />
                    ))}

                    <View style={[styles.amountWrap, { flex: 0.9 }]}>
                      <TextInput
                        value={row.amount}
                        onChangeText={(v) => setCellByIndex(idx, "amount", formatCurrencyDisplay(v))}
                        style={[styles.tdInput, styles.amountInput]}
                        placeholder="1.00"
                        placeholderTextColor={PALETTE.muted}
                        keyboardType="numeric"
                      />
                      <Text style={styles.lineTotal}>{money(line)}</Text>
                    </View>

                    <View style={styles.actionsCell}>
                      <Pressable onPress={() => duplicateRow(idx)} style={({ pressed }) => [styles.smallBtn, pressed ? { opacity: 0.85 } : null]}>
                        <Ionicons name="copy-outline" size={15} color={PALETTE.ink} />
                      </Pressable>
                      <Pressable onPress={() => deleteRow(idx)} style={({ pressed }) => [styles.smallBtnDanger, pressed ? { opacity: 0.85 } : null]}>
                        <Ionicons name="trash-outline" size={15} color="#fff" />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.gridBottomRow}>
              <View style={{ flex: 1 }} />
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
            <VisibilityToggle label="Notes" value={invoiceVisibility.showNotes} onPress={() => setInvoiceVisibility("showNotes", !invoiceVisibility.showNotes)} />
            <VisibilityToggle label="Measurement" value={invoiceVisibility.showMeasurement} onPress={() => setInvoiceVisibility("showMeasurement", !invoiceVisibility.showMeasurement)} />
            <VisibilityToggle label="Installation" value={invoiceVisibility.showInstallation} onPress={() => setInvoiceVisibility("showInstallation", !invoiceVisibility.showInstallation)} />
            <VisibilityToggle label="Deposit" value={invoiceVisibility.showDeposit} onPress={() => setInvoiceVisibility("showDeposit", !invoiceVisibility.showDeposit)} />
            <VisibilityToggle label="Signature" value={invoiceVisibility.showSignature} onPress={() => setInvoiceVisibility("showSignature", !invoiceVisibility.showSignature)} />
          </View>
        </View>

        <Modal visible={fractionPicker.visible} transparent animationType="fade" onRequestClose={closeFractionPicker}>
          <Pressable style={styles.modalBackdrop} onPress={closeFractionPicker}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>Select fraction</Text>

              <View style={styles.modalFractionGrid}>
                {FRACTION_OPTIONS.map((option) => (
                  <Pressable key={option || "none"} onPress={() => selectFraction(option)} style={[styles.modalFractionOption, option === "" ? styles.modalFractionOptionNeutral : null]}>
                    <Text style={styles.modalFractionText}>{option || "None"}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable onPress={closeFractionPicker} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </Pressable>
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

                <Pressable onPress={confirmDeleteWorkOrder} style={[styles.modalDeleteBtn, deleting ? styles.disabledBtn : null]} disabled={deleting}>
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
    opacity: 0.7,
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

  templateWrapCompact: {
    minWidth: 210,
    maxWidth: 420,
  },

  inlineLabel: {
    fontSize: 11.5,
    fontWeight: "900",
    color: PALETTE.mutedSoft,
    marginBottom: 6,
  },

  templatePills: {
    gap: 8,
    paddingRight: 6,
  },

  templatePill: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },

  templatePillActive: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },

  templatePillText: {
    fontWeight: "900",
    color: PALETTE.ink,
    fontSize: 12.5,
  },

  templatePillTextActive: {
    color: PALETTE.goldDark,
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

  headerManagerCard: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFBF2",
  },

  headerManagerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },

  managerTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: PALETTE.ink,
  },

  managerSub: {
    marginTop: 2,
    color: PALETTE.muted,
    fontWeight: "700",
    fontSize: 11.5,
  },

  headerMiniAddBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.goldDark,
    backgroundColor: PALETTE.goldSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  headerMiniAddBtnText: {
    fontWeight: "900",
    color: PALETTE.goldDark,
    fontSize: 12,
  },

  headerManagerGridCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  headerCompactCard: {
    width: 220,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 14,
    backgroundColor: PALETTE.card,
    padding: 10,
    gap: 8,
  },

  headerCompactTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  headerCompactIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: PALETTE.cardSoft,
    color: PALETTE.mutedSoft,
    fontWeight: "900",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 22,
  },

  headerCompactToggle: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCompactToggleOn: {
    backgroundColor: PALETTE.goldSoft,
    borderColor: PALETTE.gold,
  },

  headerCompactToggleText: {
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 11,
  },

  headerCompactToggleTextOn: {
    color: PALETTE.goldDark,
  },

  headerCompactInput: {
    height: 38,
    borderWidth: 1,
    borderColor: PALETTE.border,
    borderRadius: 10,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 10,
    color: PALETTE.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  headerCompactActions: {
    flexDirection: "row",
    gap: 6,
  },

  headerCompactIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCompactDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#C14343",
    backgroundColor: "#C14343",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },

  tableWrap: {
    padding: 12,
  },

  rowsScroll: {
    maxHeight: 360,
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

  measureCell: {
    flex: 2.55,
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
    borderRadius: 8,
    backgroundColor: PALETTE.card,
    color: PALETTE.ink,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 4,
  },

  measureWhole: {
    width: 40,
    flexShrink: 0,
  },

  measureX: {
    fontWeight: "900",
    color: PALETTE.goldDark,
    fontSize: 12,
    textAlign: "center",
  },

  fractionChip: {
    height: 32,
    minWidth: 62,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    flexShrink: 0,
  },

  fractionChipText: {
    fontWeight: "800",
    color: PALETTE.ink,
    fontSize: 11.5,
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.3)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 380,
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

  modalFractionGrid: {
    gap: 8,
  },

  modalFractionOption: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  modalFractionOptionNeutral: {
    backgroundColor: "#faf7ef",
  },

  modalFractionText: {
    color: PALETTE.ink,
    fontWeight: "800",
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
});