// app/(app)/settings.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
  | "Painting"
  | "Electrical";

type BrandTheme = "Gold + White" | "Minimal White" | "Classic Gold";

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
  brand_secondary_color: string;
  brand_accent_color: string;

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

  brand_theme: "Gold + White",
  brand_logo_url: "",
  brand_primary_color: "#111111",
  brand_secondary_color: "#FFFCF6",
  brand_accent_color: "#D4AF37",

  notify_new_work_orders: true,
  notify_invoice_reminders: true,
  notify_team_activity: false,
};

const PRESET_COLORS = [
  "#111111",
  "#FFFFFF",
  "#FFFCF6",
  "#FAF7F0",
  "#D4AF37",
  "#B8962E",
  "#E7C55A",
  "#E8DFC7",
  "#6B6B6B",
  "#8B7A60",
  "#166534",
  "#B42318",
];

function SectionCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionTop}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={theme.colors.goldDark} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSub}>{sub}</Text>
        </View>
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
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
    </Pressable>
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
            placeholder="#D4AF37"
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
                    color={color === "#111111" || color === "#166534" || color === "#B42318" ? "#FFFFFF" : "#111111"}
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
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);

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
        website: row.website ?? "",
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

        brand_theme: (row.brand_theme as BrandTheme) ?? "Gold + White",
        brand_logo_url: row.brand_logo_url ?? "",
        brand_primary_color: row.brand_primary_color ?? "#111111",
        brand_secondary_color: row.brand_secondary_color ?? "#FFFCF6",
        brand_accent_color: row.brand_accent_color ?? "#D4AF37",

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

  function onPhoneChange(value: string) {
    setField("phone", formatPhoneInput(value));
  }

  function onWebsiteChange(value: string) {
    setField("website", formatWebsiteInput(value));
  }

  function onWebsiteBlur() {
    setField("website", formatWebsiteInput(form.website, true));
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
      const ext = (asset?.fileName?.split(".").pop() || "png").toLowerCase();
      const safeExt = ext === "jpg" || ext === "jpeg" || ext === "webp" ? ext : "png";
      const contentType =
        blob.type ||
        (safeExt === "png"
          ? "image/png"
          : safeExt === "webp"
            ? "image/webp"
            : "image/jpeg");

      const fileName = `logo.${safeExt === "jpeg" ? "jpg" : safeExt}`;
      const path = `${activeOrgId}/${fileName}`;

      const uploadBody =
        typeof File !== "undefined"
          ? new File([blob], fileName, { type: contentType })
          : blob;

      const uploadRes = await supabase.storage
        .from("branding")
        .upload(path, uploadBody, { upsert: true, contentType });

      if (uploadRes.error) throw new Error(uploadRes.error.message);

      const { data: pub } = supabase.storage.from("branding").getPublicUrl(uploadRes.data.path);
      setField("brand_logo_url", pub.publicUrl);
      setPageMessage("Logo uploaded. Save settings to apply.");
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
        email: form.email.trim() || null,
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
        brand_secondary_color: normalizeHexColor(form.brand_secondary_color) || "#FFFCF6",
        brand_accent_color: normalizeHexColor(form.brand_accent_color) || "#D4AF37",

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
        website: formatWebsiteInput(prev.website, true),
        brand_primary_color: normalizeHexColor(prev.brand_primary_color),
        brand_secondary_color: normalizeHexColor(prev.brand_secondary_color),
        brand_accent_color: normalizeHexColor(prev.brand_accent_color),
      }));

      setPageMessage("Settings saved.");
      Alert.alert("Success", "Settings saved.");
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to save settings.");
      Alert.alert("Save failed", error?.message ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  const templateOptions = useMemo<TemplateName[]>(
    () => ["General", "Windows", "Doors", "Flooring", "Painting", "Electrical"],
    []
  );

  const brandThemes = useMemo<BrandTheme[]>(
    () => ["Gold + White", "Minimal White", "Classic Gold"],
    []
  );

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Settings</Text>
            <Text style={styles.heroSub}>
              Manage company defaults, branding, documents, notifications, and team controls.
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
          <View style={styles.bannerError}>
            <Text style={styles.bannerErrorText}>{pageError}</Text>
          </View>
        ) : null}

        {pageMessage ? (
          <View style={styles.bannerSuccess}>
            <Text style={styles.bannerSuccessText}>{pageMessage}</Text>
          </View>
        ) : null}

        <SectionCard
          icon="business-outline"
          title="Organization"
          sub="Core business details used across the app."
        >
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

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={form.email}
                onChangeText={(v) => setField("email", v)}
                placeholder="info@yourcompany.com"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>
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

          <View style={styles.grid2}>
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
                placeholder="Suite / Unit"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>City</Text>
              <TextInput
                value={form.city}
                onChangeText={(v) => setField("city", v)}
                placeholder="City"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>State</Text>
              <TextInput
                value={form.state}
                onChangeText={(v) => setField("state", v)}
                placeholder="NC"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
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
        </SectionCard>

        <SectionCard
          icon="receipt-outline"
          title="Invoice Defaults"
          sub="Default settings for invoices and customer billing."
        >
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

          <View style={styles.toggleStack}>
            <ToggleRow
              label="Show company address"
              sub="Display your business address on invoices."
              value={form.invoice_show_company_address}
              onChange={(v) => setField("invoice_show_company_address", v)}
            />
            <ToggleRow
              label="Show payment terms"
              sub="Include terms automatically on invoice exports."
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
        </SectionCard>

        <SectionCard
          icon="document-text-outline"
          title="Work Order Defaults"
          sub="Set the default behavior and output for work orders."
        >
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

          <View style={styles.toggleStack}>
            <ToggleRow
              label="Auto-show measurements"
              sub="Display measurement fields by default."
              value={form.workorder_show_measurements}
              onChange={(v) => setField("workorder_show_measurements", v)}
            />
            <ToggleRow
              label="Enable invoice conversion"
              sub="Allow work orders to be converted into invoices."
              value={form.workorder_enable_invoice_conversion}
              onChange={(v) => setField("workorder_enable_invoice_conversion", v)}
            />
            <ToggleRow
              label="Include signature line"
              sub="Show signature section on printed work orders."
              value={form.workorder_include_signature}
              onChange={(v) => setField("workorder_include_signature", v)}
            />
          </View>
        </SectionCard>

        <SectionCard
          icon="color-palette-outline"
          title="Branding"
          sub="Upload a logo and set brand colors for documents and future theme controls."
        >
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
                style={{ minWidth: 160 }}
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

          <Text style={styles.miniHeading}>Theme style</Text>
          <View style={styles.pillRow}>
            {brandThemes.map((option) => (
              <ChoicePill
                key={option}
                label={option}
                active={form.brand_theme === option}
                onPress={() => setField("brand_theme", option)}
              />
            ))}
          </View>

          <View style={styles.grid3}>
            <ColorSelector
              label="Primary color"
              value={form.brand_primary_color}
              onChange={(v) => setField("brand_primary_color", v)}
            />
            <ColorSelector
              label="Secondary color"
              value={form.brand_secondary_color}
              onChange={(v) => setField("brand_secondary_color", v)}
            />
            <ColorSelector
              label="Accent color"
              value={form.brand_accent_color}
              onChange={(v) => setField("brand_accent_color", v)}
            />
          </View>

          <View style={styles.brandSampleCard}>
            <Text style={styles.brandSampleLabel}>Preview</Text>

            <View
              style={[
                styles.brandSample,
                {
                  backgroundColor: form.brand_secondary_color || "#FFFCF6",
                  borderColor: form.brand_accent_color || "#D4AF37",
                },
              ]}
            >
              <Text
                style={[
                  styles.brandSampleTitle,
                  { color: form.brand_primary_color || "#111111" },
                ]}
              >
                {form.company_name || "Your Company"}
              </Text>

              <View
                style={[
                  styles.brandSampleBadge,
                  { backgroundColor: form.brand_accent_color || "#D4AF37" },
                ]}
              >
                <Text style={styles.brandSampleBadgeText}>Brand Accent</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        <SectionCard
          icon="notifications-outline"
          title="Notifications"
          sub="Choose which updates and reminders should appear."
        >
          <View style={styles.toggleStack}>
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
              sub="Notify when members join or roles change."
              value={form.notify_team_activity}
              onChange={(v) => setField("notify_team_activity", v)}
            />
          </View>
        </SectionCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 22,
    gap: 14,
  },

  hero: {
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
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
  },

  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
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
    borderColor: theme.colors.border,
    backgroundColor: "#FFF7E2",
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

  sectionBody: {
    gap: 14,
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
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
    backgroundColor: "#FFFFFF",
  },

  toggleStack: {
    gap: 12,
  },

  toggleRow: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: "#FFFCF6",
    paddingHorizontal: 14,
    paddingVertical: 12,
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

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  pillActive: {
    backgroundColor: "#F5E6B8",
    borderColor: theme.colors.gold,
  },

  pillText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  pillTextActive: {
    color: theme.colors.goldDark,
  },

  suggestionsBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    backgroundColor: "#fff",
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

  logoPreviewCard: {
    width: 180,
    height: 140,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    backgroundColor: "#FFFCF6",
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  secondaryBtnText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },

  colorSelectorCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: "#FFFDF8",
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
    borderColor: theme.colors.border,
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
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  colorSwatchActive: {
    borderWidth: 2,
    borderColor: theme.colors.ink,
  },

  brandSampleCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#FFFDF8",
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
});