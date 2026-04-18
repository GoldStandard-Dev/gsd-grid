import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Screen from "../../src/components/Screen";
import GoldButton from "../../src/components/GoldButton";
import { getUserOrgId } from "../../src/lib/auth";
import {
  cleanDecimalInput,
  formatPhoneInput,
  formatPercentDisplay,
  formatWebsiteInput,
  normalizeHexColor,
  onlyAlphaNumericUpper,
} from "../../src/lib/format";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

type AddressSuggestion = {
  place_id: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    state?: string;
    postcode?: string;
  };
};

type TemplateName =
  | "General"
  | "Windows"
  | "Doors"
  | "Flooring"
  | "HVAC"
  | "Roofing"
  | "Landscaping"
  | "Pressure Washing"
  | "General Contracting"
  | "Painting"
  | "Plumbing"
  | "Electrical";

type BrandTheme = "Blue + White" | "Minimal White" | "Classic Blue" | "Premium" | "Bold" | "Utility";
type BrandTypography = "Sans" | "Serif" | "Mono";
type BrandWeight = "Light" | "Regular" | "Bold";
type BrandHeaderLayout = "Left logo / right info" | "Centered logo" | "Minimal header" | "Bold header";
type BrandButtonStyle = "Rounded" | "Pill" | "Square";
type BrandButtonVariant = "Fill" | "Outline";
type BrandCardStyle = "Flat" | "Soft shadow" | "Bordered" | "Elevated";
type BrandInputStyle = "Rounded outline" | "Sharp outline" | "Filled rounded";
type DocumentDensity = "Compact" | "Spacious";
type DocumentDetailLevel = "Minimal" | "Detailed";
type BrandPreviewTab = "Work Order" | "Invoice" | "Client View";
type SettingsSection = "company" | "branding" | "defaults" | "team" | "notifications" | "advanced";
type BrandColorKey =
  | "brand_primary_color"
  | "brand_primary_hover_color"
  | "brand_primary_text_color"
  | "brand_secondary_color"
  | "brand_secondary_text_color"
  | "brand_accent_color"
  | "brand_background_color"
  | "brand_surface_color"
  | "brand_border_color"
  | "brand_success_color"
  | "brand_warning_color"
  | "brand_error_color";
type ThemePresetKey = "gold" | "blue" | "dark" | "contrast";

type SettingsForm = {
  company_name: string;
  phone: string;
  website: string;
  email: string;
  address_search: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;

  tax_rate: string;
  default_deposit: string;
  invoice_prefix: string;
  payment_terms: string;

  invoice_show_company_address: boolean;
  invoice_show_payment_terms: boolean;
  invoice_show_due_date: boolean;

  default_template: TemplateName;
  workorder_show_measurements: boolean;
  workorder_enable_invoice_conversion: boolean;
  workorder_include_signature: boolean;

  brand_theme: BrandTheme;
  brand_logo_url: string;
  brand_primary_color: string;
  brand_primary_hover_color: string;
  brand_primary_text_color: string;
  brand_secondary_color: string;
  brand_secondary_text_color: string;
  brand_accent_color: string;
  brand_background_color: string;
  brand_surface_color: string;
  brand_border_color: string;
  brand_success_color: string;
  brand_warning_color: string;
  brand_error_color: string;

  brand_typography: BrandTypography;
  brand_heading_size: string;
  brand_body_size: string;
  brand_font_weight: BrandWeight;
  brand_header_layout: BrandHeaderLayout;
  brand_button_style: BrandButtonStyle;
  brand_button_variant: BrandButtonVariant;
  brand_button_shadow: boolean;
  brand_card_style: BrandCardStyle;
  brand_input_style: BrandInputStyle;
  brand_show_logo: boolean;
  brand_show_company_name: boolean;
  brand_show_document_number_badge: boolean;
  brand_show_divider: boolean;

  document_density: DocumentDensity;
  document_detail_level: DocumentDetailLevel;
  document_grid_lines: boolean;
  document_show_measurements: boolean;
  document_show_notes: boolean;
  document_show_installation: boolean;
  document_show_deposit: boolean;
  document_show_signature: boolean;
  document_show_line_item_descriptions: boolean;

  notify_new_work_orders: boolean;
  notify_invoice_reminders: boolean;
  notify_team_activity: boolean;
};

const DEFAULT_FORM: SettingsForm = {
  company_name: "",
  phone: "",
  website: "",
  email: "",
  address_search: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",

  tax_rate: "0",
  default_deposit: "0",
  invoice_prefix: "INV",
  payment_terms: "Due upon receipt",

  invoice_show_company_address: true,
  invoice_show_payment_terms: true,
  invoice_show_due_date: true,

  default_template: "General",
  workorder_show_measurements: true,
  workorder_enable_invoice_conversion: true,
  workorder_include_signature: true,

  brand_theme: "Blue + White",
  brand_logo_url: "",
  brand_primary_color: "#2563EB",
  brand_primary_hover_color: "#1D4ED8",
  brand_primary_text_color: "#FFFFFF",
  brand_secondary_color: "#EFF6FF",
  brand_secondary_text_color: "#0F172A",
  brand_accent_color: "#6366F1",
  brand_background_color: "#F8FAFC",
  brand_surface_color: "#FFFFFF",
  brand_border_color: "#E2E8F0",
  brand_success_color: "#10B981",
  brand_warning_color: "#F59E0B",
  brand_error_color: "#EF4444",

  brand_typography: "Sans",
  brand_heading_size: "28",
  brand_body_size: "14",
  brand_font_weight: "Bold",
  brand_header_layout: "Left logo / right info",
  brand_button_style: "Rounded",
  brand_button_variant: "Fill",
  brand_button_shadow: false,
  brand_card_style: "Bordered",
  brand_input_style: "Rounded outline",
  brand_show_logo: true,
  brand_show_company_name: true,
  brand_show_document_number_badge: true,
  brand_show_divider: true,

  document_density: "Compact",
  document_detail_level: "Detailed",
  document_grid_lines: true,
  document_show_measurements: true,
  document_show_notes: true,
  document_show_installation: true,
  document_show_deposit: true,
  document_show_signature: true,
  document_show_line_item_descriptions: true,

  notify_new_work_orders: true,
  notify_invoice_reminders: true,
  notify_team_activity: false,
};

const PRESET_COLORS = [
  "#111111",
  "#FFFFFF",
  "#EFF6FF",
  "#F8FAFC",
  "#2563EB",
  "#1D4ED8",
  "#6366F1",
  "#DBEAFE",
  "#475569",
  "#64748B",
  "#10B981",
  "#EF4444",
];

const PREMIUM_SWATCHES = ["#111111", "#FFFFFF", "#D4AF37", "#B8962E", "#2563EB", "#1D4ED8", "#F8FAFC", "#E2E8F0"];

const BRAND_PREVIEW_TABS: BrandPreviewTab[] = ["Work Order", "Invoice", "Client View"];
const BRAND_THEMES: BrandTheme[] = ["Blue + White", "Minimal White", "Classic Blue", "Premium", "Bold", "Utility"];
const BRAND_TYPOGRAPHY_OPTIONS: BrandTypography[] = ["Sans", "Serif", "Mono"];
const BRAND_WEIGHT_OPTIONS: BrandWeight[] = ["Light", "Regular", "Bold"];
const BRAND_HEADER_LAYOUTS: BrandHeaderLayout[] = ["Left logo / right info", "Centered logo", "Minimal header", "Bold header"];
const BRAND_BUTTON_STYLES: BrandButtonStyle[] = ["Rounded", "Pill", "Square"];
const BRAND_BUTTON_VARIANTS: BrandButtonVariant[] = ["Fill", "Outline"];
const BRAND_CARD_STYLES: BrandCardStyle[] = ["Flat", "Soft shadow", "Bordered", "Elevated"];
const BRAND_INPUT_STYLES: BrandInputStyle[] = ["Rounded outline", "Sharp outline", "Filled rounded"];
const DOCUMENT_DENSITY_OPTIONS: DocumentDensity[] = ["Compact", "Spacious"];
const DOCUMENT_DETAIL_OPTIONS: DocumentDetailLevel[] = ["Minimal", "Detailed"];
const SETTINGS_NAV: { id: SettingsSection; label: string; icon: keyof typeof Ionicons.glyphMap; sub: string }[] = [
  { id: "company", label: "Company", icon: "business-outline", sub: "Identity and contact" },
  { id: "branding", label: "Branding", icon: "color-palette-outline", sub: "Logo, colors, preview" },
  { id: "defaults", label: "Defaults", icon: "options-outline", sub: "Work orders and invoices" },
  { id: "team", label: "Team & Roles", icon: "people-outline", sub: "Profile and permissions" },
  { id: "notifications", label: "Notifications", icon: "notifications-outline", sub: "Operational alerts" },
  { id: "advanced", label: "Advanced", icon: "shield-checkmark-outline", sub: "System controls" },
];

const CORE_COLOR_ROLES: { key: BrandColorKey; label: string; sub: string; featured?: boolean }[] = [
  { key: "brand_primary_color", label: "Primary", sub: "Main actions and headings", featured: true },
  { key: "brand_accent_color", label: "Accent", sub: "Badges, focus, emphasis", featured: true },
  { key: "brand_secondary_color", label: "Secondary", sub: "Quiet supporting surfaces" },
  { key: "brand_background_color", label: "Background", sub: "Document backdrop" },
  { key: "brand_surface_color", label: "Surface", sub: "Cards and panels" },
  { key: "brand_border_color", label: "Border", sub: "Dividers and outlines" },
];

const ADVANCED_COLOR_ROLES: { key: BrandColorKey; label: string; sub: string }[] = [
  { key: "brand_primary_hover_color", label: "Primary (Hover)", sub: "Pressed action state" },
  { key: "brand_primary_text_color", label: "Primary Text", sub: "Text over primary color" },
  { key: "brand_secondary_text_color", label: "Secondary Text", sub: "Text on secondary surfaces" },
  { key: "brand_success_color", label: "Success", sub: "Positive status color" },
  { key: "brand_warning_color", label: "Warning", sub: "Attention status color" },
  { key: "brand_error_color", label: "Error", sub: "Risk and destructive states" },
];

const THEME_PRESETS: Record<ThemePresetKey, { label: string; sub: string; values: Partial<SettingsForm> }> = {
  gold: {
    label: "Gold",
    sub: "GSD premium",
    values: {
      brand_theme: "Premium",
      brand_primary_color: "#111111",
      brand_primary_hover_color: "#27211A",
      brand_primary_text_color: "#FFFFFF",
      brand_secondary_color: "#FFFCF6",
      brand_secondary_text_color: "#111111",
      brand_accent_color: "#D4AF37",
      brand_background_color: "#FFFFFF",
      brand_surface_color: "#FFFFFF",
      brand_border_color: "#E4D6B2",
    },
  },
  blue: {
    label: "Blue",
    sub: "Current app",
    values: {
      brand_theme: "Blue + White",
      brand_primary_color: "#2563EB",
      brand_primary_hover_color: "#1D4ED8",
      brand_primary_text_color: "#FFFFFF",
      brand_secondary_color: "#EFF6FF",
      brand_secondary_text_color: "#0F172A",
      brand_accent_color: "#6366F1",
      brand_background_color: "#F8FAFC",
      brand_surface_color: "#FFFFFF",
      brand_border_color: "#E2E8F0",
    },
  },
  dark: {
    label: "Dark mode",
    sub: "Black / gold",
    values: {
      brand_theme: "Premium",
      brand_primary_color: "#0B0B0B",
      brand_primary_hover_color: "#1F1A12",
      brand_primary_text_color: "#FFFFFF",
      brand_secondary_color: "#171717",
      brand_secondary_text_color: "#F8FAFC",
      brand_accent_color: "#D4AF37",
      brand_background_color: "#0B0B0B",
      brand_surface_color: "#141414",
      brand_border_color: "#3A3020",
    },
  },
  contrast: {
    label: "High contrast",
    sub: "Sharp and readable",
    values: {
      brand_theme: "Bold",
      brand_primary_color: "#000000",
      brand_primary_hover_color: "#111111",
      brand_primary_text_color: "#FFFFFF",
      brand_secondary_color: "#FFFFFF",
      brand_secondary_text_color: "#000000",
      brand_accent_color: "#F59E0B",
      brand_background_color: "#FFFFFF",
      brand_surface_color: "#FFFFFF",
      brand_border_color: "#000000",
    },
  },
};

function normalizeBrandTheme(value?: string | null): BrandTheme {
  if (value === "Gold + White") return "Blue + White";
  if (value === "Classic Gold") return "Classic Blue";
  if (BRAND_THEMES.includes(value as BrandTheme)) return value as BrandTheme;
  return "Blue + White";
}

function SectionCard({
  icon,
  title,
  sub,
  actionLabel,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[ui.sectionCard, styles.sectionCard]}>
      <View style={styles.sectionTop}>
        <View style={ui.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={GOLD_DARK} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{sub}</Text>
        </View>

        {actionLabel ? (
          <View style={styles.sectionActionPill}>
            <Text style={styles.sectionActionText}>{actionLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#E7DDC6", true: "#E7C55A" }}
        thumbColor={value ? "#B8962E" : "#FFFFFF"}
      />
    </View>
  );
}

function ChoicePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, active ? styles.pillActive : null]}>
      <Text style={[ui.pillText, active ? ui.pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function QuickSettingCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.quickCard}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={16} color={GOLD_DARK} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text style={styles.quickValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.quickSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

function ColorSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.colorSelectorCard}>
        <View style={styles.colorSelectorTop}>
          <View style={[styles.colorPreviewLarge, { backgroundColor: value || "#FFFFFF" }]} />
          <TextInput
            value={value}
            onChangeText={(v) => onChange(normalizeHexColor(v))}
            placeholder="#2563EB"
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="characters"
            style={[styles.input, styles.colorHexInput]}
          />
        </View>

        <View style={styles.colorSwatchGrid}>
          {PRESET_COLORS.map((color) => {
            const active = color.toUpperCase() === (value || "").toUpperCase();

            return (
              <Pressable
                key={`${label}-${color}`}
                onPress={() => onChange(color)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  active ? styles.colorSwatchActive : null,
                ]}
              >
                {active ? (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={
                      color === "#111111" || color === "#166534" || color === "#B42318"
                        ? "#FFFFFF"
                        : "#111111"
                    }
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [brandPreviewTab, setBrandPreviewTab] = useState<BrandPreviewTab>("Work Order");
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>("company");
  const [activeColorRole, setActiveColorRole] = useState<BrandColorKey>("brand_primary_color");
  const [showAdvancedColors, setShowAdvancedColors] = useState(false);
  const [themeDirty, setThemeDirty] = useState(false);

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const addressSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadSettings();

    return () => {
      if (addressSearchTimeout.current) {
        clearTimeout(addressSearchTimeout.current);
      }
    };
  }, []);

  async function resolveOrgId() {
    const { data: auth, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);

    const userId = auth.user?.id;
    if (!userId) throw new Error("No authenticated user found.");

    const resolvedOrgId = await getUserOrgId(userId);
    if (!resolvedOrgId) throw new Error("Could not determine the active organization.");

    setOrgId(resolvedOrgId);
    return resolvedOrgId;
  }

  async function loadSettings() {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const activeOrgId = await resolveOrgId();

      const res = await supabase
        .from("organization_settings")
        .select("*")
        .eq("org_id", activeOrgId)
        .maybeSingle();

      if (res.error) throw new Error(res.error.message);

      if (!res.data) {
        setForm(DEFAULT_FORM);
        return;
      }

      const row = res.data as any;

      setForm({
        company_name: row.company_name ?? "",
        phone: row.phone ?? "",
        website: row.website ? formatWebsiteInput(row.website) : "",
        email: row.email ?? "",
        address_search:
          row.address_search ??
          [row.address1, row.address2, row.city, row.state, row.zip].filter(Boolean).join(", "),
        address1: row.address1 ?? "",
        address2: row.address2 ?? "",
        city: row.city ?? "",
        state: row.state ?? "",
        zip: row.zip ?? "",

        tax_rate: row.tax_rate != null ? formatPercentDisplay(String(row.tax_rate)) : "0",
        default_deposit:
          row.default_deposit != null ? cleanDecimalInput(String(row.default_deposit)) : "0",
        invoice_prefix: row.invoice_prefix ?? "INV",
        payment_terms: row.payment_terms ?? "Due upon receipt",

        invoice_show_company_address: row.invoice_show_company_address ?? true,
        invoice_show_payment_terms: row.invoice_show_payment_terms ?? true,
        invoice_show_due_date: row.invoice_show_due_date ?? true,

        default_template: (row.default_template as TemplateName) ?? "General",
        workorder_show_measurements: row.workorder_show_measurements ?? true,
        workorder_enable_invoice_conversion: row.workorder_enable_invoice_conversion ?? true,
        workorder_include_signature: row.workorder_include_signature ?? true,

        brand_theme: normalizeBrandTheme(row.brand_theme),
        brand_logo_url: row.brand_logo_url ?? "",
        brand_primary_color: row.brand_primary_color ?? "#2563EB",
        brand_primary_hover_color: row.brand_primary_hover_color ?? "#1D4ED8",
        brand_primary_text_color: row.brand_primary_text_color ?? "#FFFFFF",
        brand_secondary_color: row.brand_secondary_color ?? "#EFF6FF",
        brand_secondary_text_color: row.brand_secondary_text_color ?? "#0F172A",
        brand_accent_color: row.brand_accent_color ?? "#6366F1",
        brand_background_color: row.brand_background_color ?? "#F8FAFC",
        brand_surface_color: row.brand_surface_color ?? "#FFFFFF",
        brand_border_color: row.brand_border_color ?? "#E2E8F0",
        brand_success_color: row.brand_success_color ?? "#10B981",
        brand_warning_color: row.brand_warning_color ?? "#F59E0B",
        brand_error_color: row.brand_error_color ?? "#EF4444",

        brand_typography: (row.brand_typography as BrandTypography) ?? "Sans",
        brand_heading_size: row.brand_heading_size != null ? String(row.brand_heading_size) : "28",
        brand_body_size: row.brand_body_size != null ? String(row.brand_body_size) : "14",
        brand_font_weight: (row.brand_font_weight as BrandWeight) ?? "Bold",
        brand_header_layout: (row.brand_header_layout as BrandHeaderLayout) ?? "Left logo / right info",
        brand_button_style: (row.brand_button_style as BrandButtonStyle) ?? "Rounded",
        brand_button_variant: (row.brand_button_variant as BrandButtonVariant) ?? "Fill",
        brand_button_shadow: row.brand_button_shadow ?? false,
        brand_card_style: (row.brand_card_style as BrandCardStyle) ?? "Bordered",
        brand_input_style: (row.brand_input_style as BrandInputStyle) ?? "Rounded outline",
        brand_show_logo: row.brand_show_logo ?? true,
        brand_show_company_name: row.brand_show_company_name ?? true,
        brand_show_document_number_badge: row.brand_show_document_number_badge ?? true,
        brand_show_divider: row.brand_show_divider ?? true,

        document_density: (row.document_density as DocumentDensity) ?? "Compact",
        document_detail_level: (row.document_detail_level as DocumentDetailLevel) ?? "Detailed",
        document_grid_lines: row.document_grid_lines ?? true,
        document_show_measurements: row.document_show_measurements ?? true,
        document_show_notes: row.document_show_notes ?? true,
        document_show_installation: row.document_show_installation ?? true,
        document_show_deposit: row.document_show_deposit ?? true,
        document_show_signature: row.document_show_signature ?? true,
        document_show_line_item_descriptions: row.document_show_line_item_descriptions ?? true,

        notify_new_work_orders: row.notify_new_work_orders ?? true,
        notify_invoice_reminders: row.notify_invoice_reminders ?? true,
        notify_team_activity: row.notify_team_activity ?? false,
      });
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  function setField<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setThemeColor(key: BrandColorKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: normalizeHexColor(value) }));
    setThemeDirty(true);
  }

  function applyThemePreset(presetKey: ThemePresetKey) {
    setForm((prev) => ({ ...prev, ...THEME_PRESETS[presetKey].values }));
    setThemeDirty(true);
  }

  async function saveTheme() {
    const saved = await saveSettings();
    if (saved) setThemeDirty(false);
  }

  function onPhoneChange(value: string) {
    setField("phone", formatPhoneInput(value));
  }

  function onWebsiteChange(value: string) {
    setField("website", formatWebsiteInput(value));
  }

  function onWebsiteBlur() {
    setField("website", formatWebsiteInput(form.website, true));
  }

  function onEmailBlur() {
    setField("email", form.email.trim().toLowerCase());
  }

  function onPercentChange(value: string) {
    setField("tax_rate", formatPercentDisplay(value));
  }

  function onCurrencyLikeChange(key: "default_deposit", value: string) {
    setField(key, cleanDecimalInput(value));
  }

  function onPrefixChange(value: string) {
    setField("invoice_prefix", onlyAlphaNumericUpper(value).slice(0, 8));
  }

  function applyBrandThemePreset(nextTheme: BrandTheme) {
    setForm((prev) => {
      const presets: Partial<Record<BrandTheme, Partial<SettingsForm>>> = {
        "Blue + White": {
          brand_primary_color: "#2563EB",
          brand_primary_hover_color: "#1D4ED8",
          brand_primary_text_color: "#FFFFFF",
          brand_secondary_color: "#EFF6FF",
          brand_secondary_text_color: "#0F172A",
          brand_accent_color: "#6366F1",
          brand_background_color: "#F8FAFC",
          brand_surface_color: "#FFFFFF",
          brand_border_color: "#E2E8F0",
          brand_card_style: "Bordered",
          document_density: "Compact",
        },
        "Minimal White": {
          brand_primary_color: "#111111",
          brand_primary_hover_color: "#374151",
          brand_primary_text_color: "#FFFFFF",
          brand_secondary_color: "#FFFFFF",
          brand_secondary_text_color: "#111111",
          brand_accent_color: "#6B7280",
          brand_background_color: "#F9FAFB",
          brand_surface_color: "#FFFFFF",
          brand_border_color: "#E5E7EB",
          brand_card_style: "Flat",
          document_density: "Compact",
        },
        "Classic Blue": {
          brand_primary_color: "#1E40AF",
          brand_primary_hover_color: "#1E3A8A",
          brand_primary_text_color: "#FFFFFF",
          brand_secondary_color: "#EFF6FF",
          brand_secondary_text_color: "#0F172A",
          brand_accent_color: "#60A5FA",
          brand_background_color: "#F8FAFC",
          brand_surface_color: "#FFFFFF",
          brand_border_color: "#BFDBFE",
          brand_card_style: "Soft shadow",
          document_density: "Spacious",
        },
        Premium: {
          brand_primary_color: "#111827",
          brand_primary_hover_color: "#4B5563",
          brand_primary_text_color: "#FFFFFF",
          brand_secondary_color: "#EFF6FF",
          brand_secondary_text_color: "#111827",
          brand_accent_color: "#2563EB",
          brand_background_color: "#F9FAFB",
          brand_surface_color: "#FFFFFF",
          brand_border_color: "#E2E8F0",
          brand_typography: "Serif",
          brand_card_style: "Elevated",
          document_density: "Spacious",
        },
        Bold: {
          brand_primary_color: "#111111",
          brand_primary_hover_color: "#000000",
          brand_primary_text_color: "#FFFFFF",
          brand_secondary_color: "#DBEAFE",
          brand_secondary_text_color: "#111111",
          brand_accent_color: "#2563EB",
          brand_background_color: "#FFFFFF",
          brand_surface_color: "#FFFFFF",
          brand_border_color: "#111111",
          brand_card_style: "Bordered",
          brand_button_shadow: true,
        },
        Utility: {
          brand_primary_color: "#1F2937",
          brand_primary_hover_color: "#111827",
          brand_primary_text_color: "#FFFFFF",
          brand_secondary_color: "#F3F4F6",
          brand_secondary_text_color: "#111827",
          brand_accent_color: "#6B7280",
          brand_background_color: "#F9FAFB",
          brand_surface_color: "#FFFFFF",
          brand_border_color: "#D1D5DB",
          brand_typography: "Sans",
          brand_card_style: "Bordered",
          document_density: "Compact",
        },
      };

      return { ...prev, brand_theme: nextTheme, ...(presets[nextTheme] ?? {}) };
    });
  }

  function onAddressChange(value: string) {
    setField("address_search", value);
    setShowAddressSuggestions(true);

    if (addressSearchTimeout.current) clearTimeout(addressSearchTimeout.current);

    const query = value.trim();
    if (query.length < 4) {
      setAddressSuggestions([]);
      setLoadingAddressSuggestions(false);
      return;
    }

    addressSearchTimeout.current = setTimeout(() => {
      void fetchAddressSuggestions(query);
    }, 350);
  }

  async function fetchAddressSuggestions(query: string) {
    setLoadingAddressSuggestions(true);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error("Address lookup failed.");

      const data = await res.json();

      const suggestions: AddressSuggestion[] = Array.isArray(data)
        ? data.map((item: any) => ({
            place_id: String(item.place_id),
            display_name: item.display_name ?? "",
            address: item.address ?? {},
          }))
        : [];

      setAddressSuggestions(suggestions);
      setShowAddressSuggestions(true);
    } catch {
      setAddressSuggestions([]);
    } finally {
      setLoadingAddressSuggestions(false);
    }
  }

  function chooseAddress(item: AddressSuggestion) {
    const address = item.address ?? {};
    const line1 = [address.house_number, address.road].filter(Boolean).join(" ").trim();
    const city = address.city || address.town || address.village || address.hamlet || "";
    const state = address.state || "";
    const zip = address.postcode || "";

    setForm((prev) => ({
      ...prev,
      address_search: item.display_name,
      address1: line1 || prev.address1,
      city: city || prev.city,
      state: state || prev.state,
      zip: zip || prev.zip,
    }));

    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
  }

  async function pickAndUploadLogo() {
    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.95,
      });

      if (picked.canceled) return;

      const asset = picked.assets?.[0];
      const uri = asset?.uri;
      if (!uri) return;

      setUploadingLogo(true);

      const blob = await (await fetch(uri)).blob();
      const ext = (asset?.fileName?.split(".").pop() || "").toLowerCase();
      const mimeType = asset?.mimeType || blob.type || "";
      const safeExt =
        ext === "jpg" || ext === "jpeg" || mimeType.includes("jpeg") || mimeType.includes("jpg")
          ? "jpg"
          : ext === "webp" || mimeType.includes("webp")
            ? "webp"
            : "png";
      const contentType =
        safeExt === "png" ? "image/png" : safeExt === "webp" ? "image/webp" : "image/jpeg";

      const fileName = `logo-${Date.now()}.${safeExt}`;
      const path = `${activeOrgId}/${fileName}`;

      const uploadBody =
        typeof File !== "undefined" ? new File([blob], fileName, { type: contentType }) : blob;

      const uploadRes = await supabase.storage
        .from("branding")
        .upload(path, uploadBody, { cacheControl: "3600", upsert: false, contentType });

      if (uploadRes.error) throw new Error(uploadRes.error.message);

      const { data: pub } = supabase.storage.from("branding").getPublicUrl(uploadRes.data.path);
      setField("brand_logo_url", pub.publicUrl);

      const saveLogoRes = await supabase
        .from("organization_settings")
        .upsert({ org_id: activeOrgId, brand_logo_url: pub.publicUrl }, { onConflict: "org_id" });

      if (saveLogoRes.error) throw new Error(saveLogoRes.error.message);

      setPageMessage("Logo uploaded and saved.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message ?? "Failed to upload logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveSettings() {
    if (saving) return;

    setSaving(true);
    setPageError("");
    setPageMessage("");

    try {
      const activeOrgId = orgId || (await resolveOrgId());

      const payload = {
        org_id: activeOrgId,
        company_name: form.company_name.trim() || null,
        phone: form.phone.trim() || null,
        website: formatWebsiteInput(form.website, true).trim() || null,
        email: form.email.trim().toLowerCase() || null,
        address_search: form.address_search.trim() || null,
        address1: form.address1.trim() || null,
        address2: form.address2.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,

        tax_rate: Number(cleanDecimalInput(form.tax_rate) || "0"),
        default_deposit: Number(cleanDecimalInput(form.default_deposit) || "0"),
        invoice_prefix: form.invoice_prefix.trim() || "INV",
        payment_terms: form.payment_terms.trim() || null,

        invoice_show_company_address: form.invoice_show_company_address,
        invoice_show_payment_terms: form.invoice_show_payment_terms,
        invoice_show_due_date: form.invoice_show_due_date,

        default_template: form.default_template,
        workorder_show_measurements: form.workorder_show_measurements,
        workorder_enable_invoice_conversion: form.workorder_enable_invoice_conversion,
        workorder_include_signature: form.workorder_include_signature,

        brand_theme: form.brand_theme,
        brand_logo_url: form.brand_logo_url.trim() || null,
        brand_primary_color: normalizeHexColor(form.brand_primary_color) || "#111111",
        brand_primary_hover_color: normalizeHexColor(form.brand_primary_hover_color) || "#B8962E",
        brand_primary_text_color: normalizeHexColor(form.brand_primary_text_color) || "#FFFFFF",
        brand_secondary_color: normalizeHexColor(form.brand_secondary_color) || "#FFFCF6",
        brand_secondary_text_color: normalizeHexColor(form.brand_secondary_text_color) || "#111111",
        brand_accent_color: normalizeHexColor(form.brand_accent_color) || "#2563EB",
        brand_background_color: normalizeHexColor(form.brand_background_color) || "#F9FAFB",
        brand_surface_color: normalizeHexColor(form.brand_surface_color) || "#FFFFFF",
        brand_border_color: normalizeHexColor(form.brand_border_color) || "#E5E7EB",
        brand_success_color: normalizeHexColor(form.brand_success_color) || "#166534",
        brand_warning_color: normalizeHexColor(form.brand_warning_color) || "#B45309",
        brand_error_color: normalizeHexColor(form.brand_error_color) || "#B42318",
        brand_typography: form.brand_typography,
        brand_heading_size: Number(cleanDecimalInput(form.brand_heading_size) || "28"),
        brand_body_size: Number(cleanDecimalInput(form.brand_body_size) || "14"),
        brand_font_weight: form.brand_font_weight,
        brand_header_layout: form.brand_header_layout,
        brand_button_style: form.brand_button_style,
        brand_button_variant: form.brand_button_variant,
        brand_button_shadow: form.brand_button_shadow,
        brand_card_style: form.brand_card_style,
        brand_input_style: form.brand_input_style,
        brand_show_logo: form.brand_show_logo,
        brand_show_company_name: form.brand_show_company_name,
        brand_show_document_number_badge: form.brand_show_document_number_badge,
        brand_show_divider: form.brand_show_divider,
        document_density: form.document_density,
        document_detail_level: form.document_detail_level,
        document_grid_lines: form.document_grid_lines,
        document_show_measurements: form.document_show_measurements,
        document_show_notes: form.document_show_notes,
        document_show_installation: form.document_show_installation,
        document_show_deposit: form.document_show_deposit,
        document_show_signature: form.document_show_signature,
        document_show_line_item_descriptions: form.document_show_line_item_descriptions,

        notify_new_work_orders: form.notify_new_work_orders,
        notify_invoice_reminders: form.notify_invoice_reminders,
        notify_team_activity: form.notify_team_activity,
      };

      const res = await supabase.from("organization_settings").upsert(payload, {
        onConflict: "org_id",
      });

      if (res.error) throw new Error(res.error.message);

      setForm((prev) => ({
        ...prev,
        email: prev.email.trim().toLowerCase(),
        website: formatWebsiteInput(prev.website, true),
        brand_primary_color: normalizeHexColor(prev.brand_primary_color),
        brand_primary_hover_color: normalizeHexColor(prev.brand_primary_hover_color),
        brand_primary_text_color: normalizeHexColor(prev.brand_primary_text_color),
        brand_secondary_color: normalizeHexColor(prev.brand_secondary_color),
        brand_secondary_text_color: normalizeHexColor(prev.brand_secondary_text_color),
        brand_accent_color: normalizeHexColor(prev.brand_accent_color),
        brand_background_color: normalizeHexColor(prev.brand_background_color),
        brand_surface_color: normalizeHexColor(prev.brand_surface_color),
        brand_border_color: normalizeHexColor(prev.brand_border_color),
        brand_success_color: normalizeHexColor(prev.brand_success_color),
        brand_warning_color: normalizeHexColor(prev.brand_warning_color),
        brand_error_color: normalizeHexColor(prev.brand_error_color),
      }));

      setPageMessage("Settings saved.");
      Alert.alert("Success", "Settings saved.");
      return true;
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to save settings.");
      Alert.alert("Save failed", error?.message ?? "Failed to save settings.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const templateOptions = useMemo<TemplateName[]>(
    () => [
      "General",
      "Windows",
      "Doors",
      "Flooring",
      "Painting",
      "Electrical",
      "Plumbing",
      "HVAC",
      "Roofing",
      "Landscaping",
      "Pressure Washing",
      "General Contracting",
    ],
    []
  );

  const brandThemes = useMemo<BrandTheme[]>(() => BRAND_THEMES, []);
  const activeColorConfig =
    CORE_COLOR_ROLES.find((role) => role.key === activeColorRole) ??
    ADVANCED_COLOR_ROLES.find((role) => role.key === activeColorRole) ??
    CORE_COLOR_ROLES[0];
  const activeColorValue = form[activeColorRole];

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Settings</Text>
            <Text style={styles.heroSub}>
              Manage company details, document defaults, branding, and organization controls.
            </Text>
          </View>

          <GoldButton
            label={saving ? "Saving..." : "Save Settings"}
            onPress={saveSettings}
            disabled={saving || loading}
            style={styles.saveBtn}
          />
        </View>

        {pageError ? (
          <View style={ui.bannerError}>
            <Text style={ui.bannerErrorText}>{pageError}</Text>
          </View>
        ) : null}

        {pageMessage ? (
          <View style={ui.bannerSuccess}>
            <Text style={ui.bannerSuccessText}>{pageMessage}</Text>
          </View>
        ) : null}

        <View style={styles.quickGrid}>
          <QuickSettingCard
            icon="document-text-outline"
            label="Default template"
            value={form.default_template}
            sub="Used when creating new work orders"
          />
          <QuickSettingCard
            icon="color-palette-outline"
            label="Brand theme"
            value={form.brand_theme}
            sub={form.brand_accent_color || "Accent color not set"}
          />
          <QuickSettingCard
            icon="receipt-outline"
            label="Invoice defaults"
            value={`${form.invoice_prefix || "INV"} / ${form.tax_rate || "0"}%`}
            sub={`${form.payment_terms || "No payment terms"} terms`}
          />
        </View>

        <View style={styles.settingsWorkspace}>
          <View style={styles.settingsSidebar}>
            <Text style={styles.sidebarKicker}>Settings</Text>
            <Text style={styles.sidebarTitle}>Control center</Text>
            <View style={styles.sidebarRule} />
            {SETTINGS_NAV.map((item) => {
              const active = activeSettingsSection === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setActiveSettingsSection(item.id)}
                  style={[styles.sidebarNavItem, active ? styles.sidebarNavItemActive : null]}
                >
                  <View style={[styles.sidebarNavIcon, active ? styles.sidebarNavIconActive : null]}>
                    <Ionicons name={item.icon} size={16} color={active ? "#111111" : theme.colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sidebarNavText, active ? styles.sidebarNavTextActive : null]}>{item.label}</Text>
                    <Text style={styles.sidebarNavSub}>{item.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.settingsMain}>
            {activeSettingsSection === "company" ? (
        <SectionCard
          icon="business-outline"
          title="Company"
          sub="Core identity, contact info, and USPS-style address fields used across documents."
          actionLabel="Editable"
        >
          <View>
            <Text style={styles.subsectionTitle}>Company information</Text>
            <Text style={styles.subsectionSub}>Used on work orders, invoices, and client-facing headers.</Text>
          </View>

          <View style={styles.grid2}>
            <View style={styles.field}>
              <Text style={styles.label}>Company name</Text>
              <TextInput
                value={form.company_name}
                onChangeText={(v) => setField("company_name", v)}
                placeholder="GSD Contracting"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Business email</Text>
              <TextInput
                value={form.email}
                onChangeText={(v) => setField("email", v)}
                onBlur={onEmailBlur}
                placeholder="info@yourcompany.com"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                value={form.phone}
                onChangeText={onPhoneChange}
                placeholder="(555) 555-5555"
                placeholderTextColor={theme.colors.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Website</Text>
              <TextInput
                value={form.website}
                onChangeText={onWebsiteChange}
                onBlur={onWebsiteBlur}
                placeholder="yourcompany.com"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                keyboardType="url"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.addressBlock}>
            <View>
              <Text style={styles.subsectionTitle}>Address</Text>
              <Text style={styles.subsectionSub}>Search, then confirm the clean mailing fields.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address search</Text>
              <TextInput
                value={form.address_search}
                onChangeText={onAddressChange}
                onFocus={() => {
                  if (addressSuggestions.length) setShowAddressSuggestions(true);
                }}
                placeholder="Start typing your business address..."
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />

              {showAddressSuggestions ? (
                <View style={styles.suggestionsBox}>
                  {loadingAddressSuggestions ? (
                    <Text style={styles.suggestionLoading}>Searching addresses...</Text>
                  ) : addressSuggestions.length === 0 ? (
                    form.address_search.trim().length >= 4 ? (
                      <Text style={styles.suggestionLoading}>No address matches found.</Text>
                    ) : null
                  ) : (
                    addressSuggestions.map((item) => (
                      <Pressable
                        key={item.place_id}
                        onPress={() => chooseAddress(item)}
                        style={({ pressed }) => [
                          styles.suggestionItem,
                          pressed ? styles.suggestionItemPressed : null,
                        ]}
                      >
                        <Text style={styles.suggestionText}>{item.display_name}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address line 1</Text>
              <TextInput
                value={form.address1}
                onChangeText={(v) => setField("address1", v)}
                placeholder="123 Main St"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address line 2</Text>
              <TextInput
                value={form.address2}
                onChangeText={(v) => setField("address2", v)}
                placeholder="Apt, suite, unit, building"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.addressCityRow}>
              <View style={styles.cityField}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  value={form.city}
                  onChangeText={(v) => setField("city", v)}
                  placeholder="City"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </View>

              <View style={styles.stateField}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  value={form.state}
                  onChangeText={(v) => setField("state", v.toUpperCase().slice(0, 2))}
                  placeholder="NC"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </View>

              <View style={styles.zipField}>
                <Text style={styles.label}>ZIP</Text>
                <TextInput
                  value={form.zip}
                  onChangeText={(v) => setField("zip", v.replace(/[^\d-]/g, "").slice(0, 10))}
                  placeholder="28012"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            </View>
          </View>
        </SectionCard>
            ) : null}

            {activeSettingsSection === "defaults" ? (
        <SectionCard
          icon="options-outline"
          title="Financial defaults & preferences"
          sub="Invoice behavior, template defaults, and document preferences grouped like a settings workspace."
          actionLabel="Defaults"
        >
          <View style={styles.subsectionBlock}>
            <View>
              <Text style={styles.subsectionTitle}>Work orders</Text>
              <Text style={styles.subsectionSub}>Used when creating new work orders.</Text>
            </View>

            <Text style={styles.miniHeading}>Default template</Text>
            <View style={styles.pillRow}>
              {templateOptions.map((option) => (
                <ChoicePill
                  key={option}
                  label={option}
                  active={form.default_template === option}
                  onPress={() => setField("default_template", option)}
                />
              ))}
            </View>

            <View style={styles.compactToggleList}>
              <ToggleRow
                label="Auto-show measurements"
                sub="Display measurement fields by default."
                value={form.workorder_show_measurements}
                onChange={(v) => setField("workorder_show_measurements", v)}
              />
              <ToggleRow
                label="Enable invoice conversion"
                sub="Allow approved work orders to convert into invoices."
                value={form.workorder_enable_invoice_conversion}
                onChange={(v) => setField("workorder_enable_invoice_conversion", v)}
              />
              <ToggleRow
                label="Include signature line"
                sub="Show a signature section on printed work orders."
                value={form.workorder_include_signature}
                onChange={(v) => setField("workorder_include_signature", v)}
              />
            </View>
          </View>

          <View style={styles.subsectionDivider} />

          <View style={styles.subsectionBlock}>
            <View>
              <Text style={styles.subsectionTitle}>Invoices</Text>
              <Text style={styles.subsectionSub}>Default billing behavior and printed invoice details.</Text>
            </View>

            <View style={styles.grid3}>
              <View style={styles.field}>
                <Text style={styles.label}>Tax rate %</Text>
                <TextInput
                  value={form.tax_rate}
                  onChangeText={onPercentChange}
                  placeholder="7.25"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Default deposit</Text>
                <TextInput
                  value={form.default_deposit}
                  onChangeText={(v) => onCurrencyLikeChange("default_deposit", v)}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Invoice prefix</Text>
                <TextInput
                  value={form.invoice_prefix}
                  onChangeText={onPrefixChange}
                  placeholder="INV"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Payment terms</Text>
              <TextInput
                value={form.payment_terms}
                onChangeText={(v) => setField("payment_terms", v)}
                placeholder="Due upon receipt / Net 15 / Net 30"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.compactToggleList}>
              <ToggleRow
                label="Show company address"
                sub="Display your business address on invoices."
                value={form.invoice_show_company_address}
                onChange={(v) => setField("invoice_show_company_address", v)}
              />
              <ToggleRow
                label="Show payment terms"
                sub="Include payment terms automatically on invoice exports."
                value={form.invoice_show_payment_terms}
                onChange={(v) => setField("invoice_show_payment_terms", v)}
              />
              <ToggleRow
                label="Show due date"
                sub="Display due date on customer-facing invoices."
                value={form.invoice_show_due_date}
                onChange={(v) => setField("invoice_show_due_date", v)}
              />
            </View>
          </View>
        </SectionCard>
            ) : null}

            {activeSettingsSection === "branding" ? (
        <SectionCard
          icon="color-palette-outline"
          title="Brand system builder"
          sub="Build a white-label document style with colors, typography, layout, components, and live previews."
          actionLabel="Live preview"
        >
          <View style={styles.brandingLayout}>
            <View style={styles.brandingControls}>
              <View style={styles.brandBuilderSection}>
                <View>
                  <Text style={styles.subsectionTitle}>Logo & identity</Text>
                  <Text style={styles.subsectionSub}>Set the visual anchor for documents and client-facing views.</Text>
                </View>

                <View style={styles.brandingTop}>
                  <View style={styles.logoPreviewCard}>
                    {form.brand_logo_url ? (
                      <Image source={{ uri: form.brand_logo_url }} style={styles.logoPreviewImage} />
                    ) : (
                      <View style={styles.logoPreviewEmpty}>
                        <Ionicons name="image-outline" size={32} color={theme.colors.goldDark} />
                        <Text style={styles.logoPreviewText}>No logo uploaded</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.brandingActions}>
                    <GoldButton
                      label={uploadingLogo ? "Uploading..." : "Upload Logo"}
                      onPress={pickAndUploadLogo}
                      disabled={uploadingLogo || loading}
                      style={styles.logoUploadBtn}
                    />

                    {form.brand_logo_url ? (
                      <Pressable
                        onPress={() => setField("brand_logo_url", "")}
                        style={styles.secondaryBtn}
                      >
                        <Text style={styles.secondaryBtnText}>Remove Logo</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.pillRow}>
                  {brandThemes.map((option) => (
                    <ChoicePill
                      key={option}
                      label={option}
                      active={form.brand_theme === option}
                      onPress={() => applyBrandThemePreset(option)}
                    />
                  ))}
                </View>
              </View>

              <View style={[styles.brandBuilderSection, styles.themeControlPanel]}>
                <View style={styles.themePanelHeader}>
                  <View>
                    <Text style={styles.subsectionTitle}>Colors</Text>
                    <Text style={styles.subsectionSub}>Choose a preset, then tune one role at a time.</Text>
                  </View>
                  <View style={[styles.themeDirtyPill, themeDirty ? styles.themeDirtyPillActive : null]}>
                    <Text style={[styles.themeDirtyText, themeDirty ? styles.themeDirtyTextActive : null]}>
                      {themeDirty ? "Unsaved changes" : "Theme saved"}
                    </Text>
                  </View>
                </View>

                <View style={styles.themePresetRow}>
                  {(Object.keys(THEME_PRESETS) as ThemePresetKey[]).map((presetKey) => {
                    const preset = THEME_PRESETS[presetKey];
                    const active = form.brand_primary_color === preset.values.brand_primary_color && form.brand_accent_color === preset.values.brand_accent_color;
                    return (
                      <Pressable
                        key={presetKey}
                        onPress={() => applyThemePreset(presetKey)}
                        style={[styles.themePresetCard, active ? styles.themePresetCardActive : null]}
                      >
                        <View style={styles.themePresetDots}>
                          <View style={[styles.themePresetDot, { backgroundColor: String(preset.values.brand_primary_color) }]} />
                          <View style={[styles.themePresetDot, { backgroundColor: String(preset.values.brand_accent_color) }]} />
                          <View style={[styles.themePresetDot, { backgroundColor: String(preset.values.brand_surface_color) }]} />
                        </View>
                        <Text style={styles.themePresetTitle}>{preset.label}</Text>
                        <Text style={styles.themePresetSub}>{preset.sub}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.themeEditorShell}>
                  <View style={styles.colorRoleList}>
                    <Text style={styles.themeListLabel}>Core roles</Text>
                    {CORE_COLOR_ROLES.map((role) => {
                      const active = activeColorRole === role.key;
                      return (
                        <Pressable
                          key={role.key}
                          onPress={() => setActiveColorRole(role.key)}
                          style={[
                            styles.colorRoleItem,
                            role.featured ? styles.colorRoleItemFeatured : null,
                            active ? styles.colorRoleItemActive : null,
                          ]}
                        >
                          <View style={[styles.colorRoleDot, role.featured ? styles.colorRoleDotFeatured : null, { backgroundColor: form[role.key] }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.colorRoleTitle}>{role.label}</Text>
                            <Text style={styles.colorRoleSub}>{role.sub}</Text>
                          </View>
                          <Text style={styles.colorRoleHex}>{form[role.key]}</Text>
                        </Pressable>
                      );
                    })}

                    <Pressable onPress={() => setShowAdvancedColors((prev) => !prev)} style={styles.advancedColorToggle}>
                      <Text style={styles.themeListLabel}>Advanced colors</Text>
                      <Ionicons name={showAdvancedColors ? "chevron-up" : "chevron-down"} size={16} color={LUX_GOLD} />
                    </Pressable>

                    {showAdvancedColors ? (
                      <View style={styles.advancedColorList}>
                        {ADVANCED_COLOR_ROLES.map((role) => {
                          const active = activeColorRole === role.key;
                          return (
                            <Pressable
                              key={role.key}
                              onPress={() => setActiveColorRole(role.key)}
                              style={[styles.colorRoleItem, active ? styles.colorRoleItemActive : null]}
                            >
                              <View style={[styles.colorRoleDot, { backgroundColor: form[role.key] }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.colorRoleTitle}>{role.label}</Text>
                                <Text style={styles.colorRoleSub}>{role.sub}</Text>
                              </View>
                              <Text style={styles.colorRoleHex}>{form[role.key]}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.activeColorEditor}>
                    <View style={styles.activeColorHero}>
                      <View style={[styles.activeColorSwatch, { backgroundColor: activeColorValue }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activeColorKicker}>Active role</Text>
                        <Text style={styles.activeColorTitle}>{activeColorConfig.label}</Text>
                        <Text style={styles.activeColorSub}>{activeColorConfig.sub}</Text>
                      </View>
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Hex value</Text>
                      <TextInput
                        value={activeColorValue}
                        onChangeText={(value) => setThemeColor(activeColorRole, value)}
                        placeholder="#D4AF37"
                        placeholderTextColor={theme.colors.muted}
                        autoCapitalize="characters"
                        style={[styles.input, styles.themeHexInput]}
                      />
                    </View>

                    <View>
                      <Text style={styles.themeListLabel}>Palette</Text>
                      <View style={styles.premiumSwatchRow}>
                        {PREMIUM_SWATCHES.map((color) => {
                          const active = color.toUpperCase() === activeColorValue.toUpperCase();
                          return (
                            <Pressable
                              key={`${activeColorRole}-${color}`}
                              onPress={() => setThemeColor(activeColorRole, color)}
                              style={[styles.premiumSwatch, { backgroundColor: color }, active ? styles.premiumSwatchActive : null]}
                            >
                              {active ? <Ionicons name="checkmark" size={15} color={color === "#111111" ? "#FFFFFF" : "#111111"} /> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.usagePreviewCard}>
                      <View style={styles.usagePreviewHeader}>
                        <Text style={styles.usagePreviewTitle}>Usage preview</Text>
                        <View style={[styles.usagePreviewBadge, { backgroundColor: form.brand_accent_color }]}>
                          <Text style={[styles.usagePreviewBadgeText, { color: form.brand_primary_text_color }]}>Premium</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.usagePreviewSurface,
                          {
                            backgroundColor: form.brand_surface_color,
                            borderColor: form.brand_border_color,
                          },
                        ]}
                      >
                        <Text style={[styles.usagePreviewHeading, { color: form.brand_primary_color }]}>Document style</Text>
                        <Text style={[styles.usagePreviewCopy, { color: form.brand_secondary_text_color }]}>
                          Clean headings, quiet surfaces, and one deliberate accent.
                        </Text>
                        <View style={styles.usagePreviewActions}>
                          <View style={[styles.usagePreviewButton, { backgroundColor: form.brand_primary_color }]}>
                            <Text style={[styles.usagePreviewButtonText, { color: form.brand_primary_text_color }]}>Save Theme</Text>
                          </View>
                          <View style={[styles.usagePreviewGhost, { borderColor: form.brand_accent_color }]}>
                            <Text style={[styles.usagePreviewGhostText, { color: form.brand_accent_color }]}>Accent</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.themeActionRow}>
                      <Pressable onPress={() => void saveTheme()} disabled={saving || loading} style={styles.themeSaveButton}>
                        <Text style={styles.themeSaveButtonText}>{saving ? "Saving..." : "Save Theme"}</Text>
                      </Pressable>
                      <Pressable onPress={() => applyThemePreset("gold")} style={styles.themeResetButton}>
                        <Text style={styles.themeResetButtonText}>Reset to Default</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.brandBuilderSection}>
                <View>
                  <Text style={styles.subsectionTitle}>Typography</Text>
                  <Text style={styles.subsectionSub}>Pick a document tone: SaaS, premium, or technical.</Text>
                </View>
                <View style={styles.pillRow}>
                  {BRAND_TYPOGRAPHY_OPTIONS.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_typography === option} onPress={() => setField("brand_typography", option)} />
                  ))}
                  {BRAND_WEIGHT_OPTIONS.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_font_weight === option} onPress={() => setField("brand_font_weight", option)} />
                  ))}
                </View>
                <View style={styles.grid2}>
                  <View style={styles.field}>
                    <Text style={styles.label}>Heading size</Text>
                    <TextInput value={form.brand_heading_size} onChangeText={(v) => setField("brand_heading_size", cleanDecimalInput(v))} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Body size</Text>
                    <TextInput value={form.brand_body_size} onChangeText={(v) => setField("brand_body_size", cleanDecimalInput(v))} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>
              </View>

              <View style={styles.brandBuilderSection}>
                <View>
                  <Text style={styles.subsectionTitle}>Layout & document style</Text>
                  <Text style={styles.subsectionSub}>Control header layout, density, and section visibility.</Text>
                </View>
                <View style={styles.pillRow}>
                  {BRAND_HEADER_LAYOUTS.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_header_layout === option} onPress={() => setField("brand_header_layout", option)} />
                  ))}
                </View>
                <View style={styles.pillRow}>
                  {DOCUMENT_DENSITY_OPTIONS.map((option) => (
                    <ChoicePill key={option} label={option} active={form.document_density === option} onPress={() => setField("document_density", option)} />
                  ))}
                  {DOCUMENT_DETAIL_OPTIONS.map((option) => (
                    <ChoicePill key={option} label={option} active={form.document_detail_level === option} onPress={() => setField("document_detail_level", option)} />
                  ))}
                </View>
                <View style={styles.compactToggleList}>
                  <ToggleRow label="Show logo" sub="Display the uploaded logo in document headers." value={form.brand_show_logo} onChange={(v) => setField("brand_show_logo", v)} />
                  <ToggleRow label="Show company name" sub="Print the company name beside or above the document info." value={form.brand_show_company_name} onChange={(v) => setField("brand_show_company_name", v)} />
                  <ToggleRow label="Document number badge" sub="Show invoice or work order numbers as a badge." value={form.brand_show_document_number_badge} onChange={(v) => setField("brand_show_document_number_badge", v)} />
                  <ToggleRow label="Divider line" sub="Use a clean divider under the document header." value={form.brand_show_divider} onChange={(v) => setField("brand_show_divider", v)} />
                  <ToggleRow label="Grid lines" sub="Show table grid lines in document tables." value={form.document_grid_lines} onChange={(v) => setField("document_grid_lines", v)} />
                </View>
              </View>

              <View style={styles.brandBuilderSection}>
                <View>
                  <Text style={styles.subsectionTitle}>Components</Text>
                  <Text style={styles.subsectionSub}>Tune the feel of buttons, cards, and inputs.</Text>
                </View>
                <View style={styles.pillRow}>
                  {BRAND_BUTTON_STYLES.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_button_style === option} onPress={() => setField("brand_button_style", option)} />
                  ))}
                  {BRAND_BUTTON_VARIANTS.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_button_variant === option} onPress={() => setField("brand_button_variant", option)} />
                  ))}
                </View>
                <View style={styles.pillRow}>
                  {BRAND_CARD_STYLES.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_card_style === option} onPress={() => setField("brand_card_style", option)} />
                  ))}
                  {BRAND_INPUT_STYLES.map((option) => (
                    <ChoicePill key={option} label={option} active={form.brand_input_style === option} onPress={() => setField("brand_input_style", option)} />
                  ))}
                </View>
                <View style={styles.compactToggleList}>
                  <ToggleRow label="Button shadow" sub="Adds a subtle raised action style for document buttons." value={form.brand_button_shadow} onChange={(v) => setField("brand_button_shadow", v)} />
                </View>
              </View>

              <View style={styles.brandBuilderSection}>
                <View>
                  <Text style={styles.subsectionTitle}>Invoice / work order sections</Text>
                  <Text style={styles.subsectionSub}>Choose what client-facing documents show by default.</Text>
                </View>
                <View style={styles.compactToggleList}>
                  <ToggleRow label="Measurements" sub="Show size and measurement blocks." value={form.document_show_measurements} onChange={(v) => setField("document_show_measurements", v)} />
                  <ToggleRow label="Notes" sub="Show notes and internal instructions." value={form.document_show_notes} onChange={(v) => setField("document_show_notes", v)} />
                  <ToggleRow label="Installation" sub="Show installation or service details." value={form.document_show_installation} onChange={(v) => setField("document_show_installation", v)} />
                  <ToggleRow label="Deposit" sub="Show deposit and payment breakdowns." value={form.document_show_deposit} onChange={(v) => setField("document_show_deposit", v)} />
                  <ToggleRow label="Signature" sub="Show customer approval signature section." value={form.document_show_signature} onChange={(v) => setField("document_show_signature", v)} />
                  <ToggleRow label="Line item descriptions" sub="Show detailed descriptions below line item names." value={form.document_show_line_item_descriptions} onChange={(v) => setField("document_show_line_item_descriptions", v)} />
                </View>
              </View>
            </View>

            <View
              style={[
                styles.documentPreview,
                {
                  backgroundColor: form.brand_background_color || "#F9FAFB",
                  borderColor: form.brand_border_color || "#E5E7EB",
                },
              ]}
            >
              <View style={styles.previewTopBar}>
                <Text style={styles.brandSampleLabel}>Live preview</Text>
                <View style={styles.pillRow}>
                  {BRAND_PREVIEW_TABS.map((tab) => (
                    <ChoicePill key={tab} label={tab} active={brandPreviewTab === tab} onPress={() => setBrandPreviewTab(tab)} />
                  ))}
                </View>
              </View>

              <View
                style={[
                  styles.previewDocument,
                  {
                    backgroundColor: form.brand_surface_color || "#FFFFFF",
                    borderColor: form.brand_border_color || "#E5E7EB",
                    padding: form.document_density === "Spacious" ? 22 : 16,
                  },
                  form.brand_card_style === "Elevated" || form.brand_card_style === "Soft shadow" ? styles.previewDocumentRaised : null,
                ]}
              >
                <View style={[styles.documentPreviewTop, form.brand_header_layout === "Centered logo" ? styles.documentPreviewCentered : null]}>
                  {form.brand_show_logo ? (
                    form.brand_logo_url ? (
                      <Image source={{ uri: form.brand_logo_url }} style={styles.documentPreviewLogo} />
                    ) : (
                      <View style={[styles.documentPreviewLogo, styles.documentPreviewLogoEmpty, { borderColor: form.brand_border_color }]}>
                        <Text style={[styles.documentPreviewLogoText, { color: form.brand_accent_color }]}>
                          {(form.company_name || "GSD").slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )
                  ) : null}
                  <View style={{ flex: 1, alignItems: form.brand_header_layout === "Centered logo" ? "center" : "flex-start" }}>
                    {form.brand_show_company_name ? (
                      <Text
                        style={[
                          styles.brandSampleTitle,
                          {
                            color: form.brand_primary_color || "#111111",
                            fontFamily: form.brand_typography === "Serif" ? "serif" : form.brand_typography === "Mono" ? "monospace" : undefined,
                            fontSize: Number(form.brand_heading_size || 28),
                            fontWeight: form.brand_font_weight === "Light" ? "500" : form.brand_font_weight === "Regular" ? "700" : "900",
                          },
                        ]}
                      >
                        {form.company_name || "Your Company"}
                      </Text>
                    ) : null}
                    <Text style={[styles.previewMeta, { color: form.brand_secondary_text_color }]}>
                      {brandPreviewTab} / {form.brand_header_layout}
                    </Text>
                  </View>
                  {form.brand_show_document_number_badge ? (
                    <View style={[styles.brandSampleBadge, { backgroundColor: form.brand_accent_color || "#2563EB" }]}>
                      <Text style={[styles.brandSampleBadgeText, { color: form.brand_primary_text_color || "#FFFFFF" }]}>
                        {brandPreviewTab === "Invoice" ? form.invoice_prefix || "INV" : "WO"}-1024
                      </Text>
                    </View>
                  ) : null}
                </View>
                {form.brand_show_divider ? <View style={[styles.previewLine, { backgroundColor: form.brand_accent_color }]} /> : null}

                <View style={styles.previewRows}>
                  {form.document_show_line_item_descriptions ? <View style={[styles.previewRow, { backgroundColor: form.brand_border_color }]} /> : null}
                  {form.document_show_measurements ? <View style={[styles.previewRow, styles.previewRowShort, { backgroundColor: form.brand_border_color }]} /> : null}
                  {form.document_show_installation ? <View style={[styles.previewRow, { backgroundColor: form.brand_border_color }]} /> : null}
                </View>

                <View style={[styles.previewTable, form.document_grid_lines ? { borderColor: form.brand_border_color, borderWidth: 1 } : null]}>
                  {["Line item", "Qty", "Total"].map((label) => (
                    <Text key={label} style={[styles.previewTableCell, { color: form.brand_primary_color, borderColor: form.brand_border_color }]}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={styles.previewFooterRow}>
                  {form.document_show_notes ? <Text style={[styles.previewMeta, { color: form.brand_secondary_text_color }]}>Notes enabled</Text> : null}
                  {form.document_show_deposit ? <Text style={[styles.previewMeta, { color: form.brand_warning_color }]}>Deposit shown</Text> : null}
                  {form.document_show_signature ? <Text style={[styles.previewMeta, { color: form.brand_success_color }]}>Signature included</Text> : null}
                </View>

                <View
                  style={[
                    styles.previewButton,
                    {
                      backgroundColor: form.brand_button_variant === "Fill" ? form.brand_primary_color : "transparent",
                      borderColor: form.brand_primary_color,
                      borderRadius: form.brand_button_style === "Pill" ? 999 : form.brand_button_style === "Square" ? 4 : 12,
                    },
                    form.brand_button_shadow ? styles.previewButtonShadow : null,
                  ]}
                >
                  <Text style={{ color: form.brand_button_variant === "Fill" ? form.brand_primary_text_color : form.brand_primary_color, fontWeight: "900" }}>
                    Client action
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SectionCard>
            ) : null}

            {activeSettingsSection === "team" ? (
        <SectionCard
          icon="people-outline"
          title="Team & Roles"
          sub="Profile settings stay separate from organization controls."
          actionLabel="Access"
        >
          <View style={styles.profileOrgGrid}>
            <View style={styles.controlMiniCard}>
              <View style={styles.controlMiniHeader}>
                <Ionicons name="person-circle-outline" size={20} color={GOLD_DARK} />
                <Text style={styles.subsectionTitle}>Profile</Text>
              </View>
              <Text style={styles.subsectionSub}>Manage your name, email, and password from the profile page.</Text>
              <Pressable onPress={() => router.push("/profile")} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Open Profile</Text>
              </Pressable>
            </View>

            <View style={styles.controlMiniCard}>
              <View style={styles.controlMiniHeader}>
                <Ionicons name="people-outline" size={20} color={GOLD_DARK} />
                <Text style={styles.subsectionTitle}>Organization</Text>
              </View>
              <Text style={styles.subsectionSub}>Invite users, assign roles, and keep access rules separate from branding.</Text>
              <View style={styles.compactToggleList}>
                <ToggleRow
                  label="Team activity updates"
                  sub="Notify when members join or role access changes."
                  value={form.notify_team_activity}
                  onChange={(v) => setField("notify_team_activity", v)}
                />
              </View>
            </View>
          </View>
        </SectionCard>
            ) : null}

            {activeSettingsSection === "notifications" ? (
        <SectionCard
          icon="notifications-outline"
          title="Notifications"
          sub="Keep alerts lightweight and focused on operational updates."
          actionLabel="Alerts"
        >
          <View style={styles.compactToggleList}>
            <ToggleRow
              label="New work order alerts"
              sub="Notify when a work order is created."
              value={form.notify_new_work_orders}
              onChange={(v) => setField("notify_new_work_orders", v)}
            />
            <ToggleRow
              label="Invoice reminders"
              sub="Show reminders for open balances and due invoices."
              value={form.notify_invoice_reminders}
              onChange={(v) => setField("notify_invoice_reminders", v)}
            />
            <ToggleRow
              label="Team activity updates"
              sub="Notify when members join or role access changes."
              value={form.notify_team_activity}
              onChange={(v) => setField("notify_team_activity", v)}
            />
          </View>
        </SectionCard>
            ) : null}

            {activeSettingsSection === "advanced" ? (
        <SectionCard
          icon="shield-checkmark-outline"
          title="Advanced"
          sub="System controls and high-risk settings stay isolated from daily configuration."
          actionLabel="Restricted"
        >
          <View style={styles.profileOrgGrid}>
            <View style={styles.controlMiniCard}>
              <View style={styles.controlMiniHeader}>
                <Ionicons name="refresh-outline" size={20} color={GOLD_DARK} />
                <Text style={styles.subsectionTitle}>Reset changes</Text>
              </View>
              <Text style={styles.subsectionSub}>Reload the last saved organization settings without touching saved records.</Text>
              <Pressable onPress={() => void loadSettings()} disabled={saving || loading} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Reset Unsaved Changes</Text>
              </Pressable>
            </View>

            <View style={[styles.controlMiniCard, styles.dangerZoneCard]}>
              <View style={styles.controlMiniHeader}>
                <Ionicons name="warning-outline" size={20} color="#B91C1C" />
                <Text style={styles.dangerTitle}>Danger Zone</Text>
              </View>
              <Text style={styles.dangerSub}>Delete organization and reset system actions should be handled deliberately.</Text>
              <Pressable
                onPress={() => Alert.alert("Danger Zone", "Organization deletion needs a dedicated confirmation flow.")}
                style={styles.dangerAction}
              >
                <Text style={styles.dangerActionText}>Delete Organization</Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
            ) : null}
          </View>
        </View>

        <View style={styles.stickySaveBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stickySaveTitle}>Settings control center</Text>
            <Text style={styles.stickySaveSub}>Save once to apply profile, defaults, branding, and notification changes.</Text>
          </View>
          <Pressable
            onPress={() => void loadSettings()}
            disabled={saving || loading}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Reset Changes</Text>
          </Pressable>
          <GoldButton
            label={saving ? "Saving..." : "Save Settings"}
            onPress={saveSettings}
            disabled={saving || loading}
            style={styles.saveBtn}
          />
        </View>
      </View>
    </Screen>
  );
}

const PAGE_BG = theme.colors.bg;
const CARD_BG = theme.colors.surface;
const BORDER = theme.colors.border;
const GOLD = theme.colors.primary;
const GOLD_DARK = theme.colors.primaryHover;
const LUX_GOLD = "#D4AF37";
const LUX_DARK = "#111111";
const DARK_CARD = "#111111";
const DARK_BORDER = theme.colors.border;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 24,
    gap: 16,
    backgroundColor: PAGE_BG,
  },

  hero: {
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 8,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  heroSub: {
    marginTop: 6,
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },

  saveBtn: {
    minWidth: 180,
    borderRadius: 8,
    borderColor: GOLD,
    backgroundColor: GOLD,
    shadowColor: GOLD,
  },

  logoUploadBtn: {
    minWidth: 160,
    borderRadius: 8,
    borderColor: GOLD,
    backgroundColor: GOLD,
    shadowColor: GOLD,
  },

  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  quickCard: {
    flex: 1,
    minWidth: 220,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD_BG,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  quickLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  quickValue: {
    marginTop: 3,
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  quickSub: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },

  sectionNav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 2,
  },

  settingsWorkspace: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },

  settingsSidebar: {
    width: 250,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD_BG,
    padding: 14,
    gap: 8,
    position: "sticky" as any,
    top: 12,
  },

  settingsMain: {
    flex: 1,
    minWidth: 320,
  },

  sidebarKicker: {
    color: GOLD_DARK,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  sidebarTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },

  sidebarRule: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 6,
  },

  sidebarNavItem: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  sidebarNavItemActive: {
    borderColor: BORDER,
    backgroundColor: theme.colors.primarySoft,
  },

  sidebarNavIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  sidebarNavIconActive: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primaryLight,
  },

  sidebarNavText: {
    color: theme.colors.ink,
    fontSize: 13.5,
    fontWeight: "900",
  },

  sidebarNavTextActive: {
    color: "#111111",
  },

  sidebarNavSub: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },

  navPill: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    justifyContent: "center",
  },

  navPillText: {
    color: theme.colors.ink,
    fontSize: 12.5,
    fontWeight: "900",
  },

  sectionCard: {
    padding: 18,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD_BG,
  },

  sectionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  sectionSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.muted,
  },

  sectionActionPill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFCF6",
    paddingHorizontal: 12,
    justifyContent: "center",
  },

  sectionActionText: {
    color: theme.colors.goldDark,
    fontSize: 11.5,
    fontWeight: "900",
  },

  sectionBody: {
    gap: 14,
  },

  addressBlock: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 14,
  },

  addressCityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  cityField: {
    flex: 1,
    minWidth: 220,
  },

  stateField: {
    width: 92,
    minWidth: 92,
  },

  zipField: {
    width: 130,
    minWidth: 130,
  },

  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  grid3: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  field: {
    flex: 1,
    minWidth: 220,
  },

  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    letterSpacing: 0.2,
  },

  input: {
    ...ui.input,
  },

  toggleStack: {
    gap: 12,
  },

  compactToggleList: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD_BG,
    overflow: "hidden",
  },

  toggleRow: {
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  toggleTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  toggleSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.muted,
    lineHeight: 18,
  },

  miniHeading: {
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    letterSpacing: 0.2,
  },

  subsectionBlock: {
    gap: 12,
  },

  profileOrgGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  controlMiniCard: {
    flex: 1,
    minWidth: 260,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12,
  },

  controlMiniHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  dangerZoneCard: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF7F7",
  },

  dangerTitle: {
    color: "#B91C1C",
    fontSize: 16,
    fontWeight: "900",
  },

  dangerSub: {
    color: "#7F1D1D",
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  dangerAction: {
    alignSelf: "flex-start",
    minHeight: 40,
    borderWidth: 1,
    borderColor: "#B91C1C",
    borderRadius: 8,
    backgroundColor: "#B91C1C",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  dangerActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  subsectionDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
  },

  subsectionTitle: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "900",
  },

  subsectionSub: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12.5,
    fontWeight: "700",
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    ...ui.pill,
  },

  pillActive: {
    ...ui.pillActive,
  },

  suggestionsBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    overflow: "hidden",
  },

  suggestionLoading: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.muted,
    fontWeight: "700",
  },

  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },

  suggestionItemPressed: {
    backgroundColor: "#faf7ef",
  },

  suggestionText: {
    color: theme.colors.ink,
    fontWeight: "700",
    lineHeight: 19,
  },

  bannerError: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerErrorText: {
    color: "#991b1b",
    fontWeight: "800",
  },

  bannerSuccess: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  bannerSuccessText: {
    color: "#166534",
    fontWeight: "800",
  },

  brandingTop: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "flex-start",
  },

  brandingLayout: {
    flexDirection: "column",
    gap: 16,
  },

  brandingControls: {
    width: "100%",
    gap: 14,
  },

  brandBuilderSection: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: CARD_BG,
    padding: 14,
    gap: 12,
  },

  logoPreviewCard: {
    width: 180,
    height: 140,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  logoPreviewImage: {
    width: "88%",
    height: "78%",
    resizeMode: "contain",
  },

  logoPreviewEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  logoPreviewText: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  brandingActions: {
    gap: 10,
    minWidth: 180,
  },

  secondaryBtn: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  secondaryBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },

  themeControlPanel: {
    padding: 12,
    gap: 16,
  },

  themePanelHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 14,
  },

  themeDirtyPill: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    paddingHorizontal: 12,
    justifyContent: "center",
  },

  themeDirtyPillActive: {
    borderColor: LUX_GOLD,
    backgroundColor: "#FFFBEB",
  },

  themeDirtyText: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "900",
  },

  themeDirtyTextActive: {
    color: "#7A5A12",
  },

  themePresetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  themePresetCard: {
    flex: 1,
    minWidth: 160,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 8,
  },

  themePresetCardActive: {
    borderColor: LUX_GOLD,
    backgroundColor: "#FFFCF2",
    shadowColor: LUX_GOLD,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  themePresetDots: {
    flexDirection: "row",
    gap: 6,
  },

  themePresetDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  themePresetTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  themePresetSub: {
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },

  themeEditorShell: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "stretch",
  },

  colorRoleList: {
    flex: 1,
    minWidth: 300,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 10,
    gap: 8,
  },

  themeListLabel: {
    color: theme.colors.mutedSoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  colorRoleItem: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  colorRoleItemFeatured: {
    minHeight: 66,
  },

  colorRoleItemActive: {
    borderColor: LUX_GOLD,
    backgroundColor: "#FFFCF2",
  },

  colorRoleDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  colorRoleDotFeatured: {
    width: 34,
    height: 34,
    borderRadius: 17,
    shadowColor: LUX_GOLD,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },

  colorRoleTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },

  colorRoleSub: {
    marginTop: 2,
    color: theme.colors.muted,
    fontSize: 11.5,
    fontWeight: "700",
  },

  colorRoleHex: {
    color: theme.colors.mutedSoft,
    fontSize: 11.5,
    fontWeight: "900",
  },

  advancedColorToggle: {
    minHeight: 38,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  advancedColorList: {
    gap: 6,
  },

  activeColorEditor: {
    flex: 1.2,
    minWidth: 340,
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 8,
    backgroundColor: LUX_DARK,
    padding: 14,
    gap: 14,
  },

  activeColorHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  activeColorSwatch: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: LUX_GOLD,
  },

  activeColorKicker: {
    color: LUX_GOLD,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  activeColorTitle: {
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },

  activeColorSub: {
    marginTop: 3,
    color: "rgba(255,255,255,0.68)",
    fontSize: 12.5,
    fontWeight: "700",
  },

  themeHexInput: {
    borderColor: "rgba(212,175,55,0.55)",
    backgroundColor: "#FFFFFF",
  },

  premiumSwatchRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  premiumSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },

  premiumSwatchActive: {
    borderWidth: 2,
    borderColor: LUX_GOLD,
    transform: [{ scale: 1.05 }],
  },

  usagePreviewCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    gap: 10,
  },

  usagePreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  usagePreviewTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  usagePreviewBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  usagePreviewBadgeText: {
    fontSize: 11.5,
    fontWeight: "900",
  },

  usagePreviewSurface: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },

  usagePreviewHeading: {
    fontSize: 18,
    fontWeight: "900",
  },

  usagePreviewCopy: {
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
  },

  usagePreviewActions: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  usagePreviewButton: {
    minHeight: 36,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  usagePreviewButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },

  usagePreviewGhost: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  usagePreviewGhostText: {
    fontSize: 12,
    fontWeight: "900",
  },

  themeActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  themeSaveButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LUX_GOLD,
    backgroundColor: LUX_GOLD,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  themeSaveButtonText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "900",
  },

  themeResetButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  themeResetButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  colorSelectorCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    padding: 10,
    gap: 10,
  },

  colorSelectorTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  colorPreviewLarge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },

  colorHexInput: {
    flex: 1,
  },

  colorSwatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },

  colorSwatchActive: {
    borderWidth: 2,
    borderColor: theme.colors.ink,
  },

  brandSampleCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    padding: 14,
    backgroundColor: CARD_BG,
  },

  brandSampleLabel: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
  },

  brandSample: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    justifyContent: "space-between",
  },

  brandSampleTitle: {
    fontSize: 20,
    fontWeight: "900",
  },

  brandSampleBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  brandSampleBadgeText: {
    color: "#111111",
    fontSize: 12,
    fontWeight: "900",
  },

  documentPreview: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },

  previewTopBar: {
    gap: 10,
  },

  previewDocument: {
    borderWidth: 1,
    borderRadius: 22,
    gap: 14,
  },

  previewDocumentRaised: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  documentPreviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  documentPreviewCentered: {
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },

  documentPreviewLogo: {
    width: 58,
    height: 58,
    borderRadius: 16,
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
  },

  documentPreviewLogoEmpty: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },

  documentPreviewLogoText: {
    color: theme.colors.goldDark,
    fontSize: 16,
    fontWeight: "900",
  },

  previewMeta: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },

  previewLine: {
    height: 3,
    borderRadius: 99,
    backgroundColor: "rgba(17,17,17,0.12)",
  },

  previewRows: {
    gap: 10,
  },

  previewRow: {
    height: 12,
    borderRadius: 99,
    backgroundColor: "rgba(17,17,17,0.10)",
  },

  previewRowShort: {
    width: "62%",
  },

  previewTable: {
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  previewTableCell: {
    flex: 1,
    minHeight: 42,
    borderRightWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 12,
    fontWeight: "900",
  },

  previewFooterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  previewButton: {
    alignSelf: "flex-start",
    minHeight: 42,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  previewButtonShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  stickySaveBar: {
    position: "sticky" as any,
    bottom: 16,
    zIndex: 5,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  stickySaveTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },

  stickySaveSub: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});
