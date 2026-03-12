import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Screen from "../../src/components/Screen";
import GoldButton from "../../src/components/GoldButton";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  email: string | null;

  job_title: string | null;
  company_name: string | null;
  website: string | null;

  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;

  timezone: string | null;
  default_labor_rate: number | null;
  default_tax_rate: number | null;
  invoice_terms: string | null;
  notes: string | null;
};

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

const JOB_TITLE_PRESETS = [
  "Owner",
  "Project Manager",
  "Estimator",
  "Office Manager",
  "Installer",
  "Technician",
  "Sales",
  "Custom",
] as const;

const INVOICE_TERM_PRESETS = [
  "Due upon receipt",
  "Net 7",
  "Net 15",
  "Net 30",
  "50% deposit, balance on completion",
  "Custom",
] as const;

function formatPhoneInput(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeEmail(value: string) {
  return (value ?? "").trim().toLowerCase();
}

function formatWebsiteInput(value: string, finalize?: boolean) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  let next = trimmed.replace(/\s+/g, "");
  next = next.replace(/^https?:\/\//i, "");

  if (finalize) return `https://${next}`;
  return next;
}

function cleanDecimalInput(value: string) {
  const cleaned = (value ?? "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");

  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");

  const [addressSearch, setAddressSearch] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [stateProv, setStateProv] = useState("");
  const [zip, setZip] = useState("");

  const [timezone, setTimezone] = useState("");
  const [defaultLaborRate, setDefaultLaborRate] = useState("");
  const [defaultTaxRate, setDefaultTaxRate] = useState("");
  const [invoiceTerms, setInvoiceTerms] = useState("");
  const [notes, setNotes] = useState("");

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const addressSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = useMemo(() => {
    const source = fullName.trim() || email.trim() || accountEmail.trim() || "ME";
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }, [accountEmail, email, fullName]);

  const selectedJobTitlePreset = useMemo(() => {
    const value = jobTitle.trim().toLowerCase();
    if (!value) return "";
    return (
      JOB_TITLE_PRESETS.find((item) => item !== "Custom" && item.toLowerCase() === value) ?? "Custom"
    );
  }, [jobTitle]);

  const selectedInvoiceTermsPreset = useMemo(() => {
    const value = invoiceTerms.trim().toLowerCase();
    if (!value) return "";
    return (
      INVOICE_TERM_PRESETS.find((item) => item !== "Custom" && item.toLowerCase() === value) ?? "Custom"
    );
  }, [invoiceTerms]);

  useEffect(() => {
    void loadProfile();

    return () => {
      if (addressSearchTimeout.current) {
        clearTimeout(addressSearchTimeout.current);
      }
    };
  }, []);

  async function loadProfile() {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user?.id) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setAccountEmail(user.email ?? "");

      const res = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, phone, avatar_url, email, job_title, company_name, website, address1, address2, city, state, zip, timezone, default_labor_rate, default_tax_rate, invoice_terms, notes"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const p = (res.data as ProfileRow) ?? null;

      setFullName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");
      setAvatarUrl(p?.avatar_url ?? "");
      setEmail(p?.email ?? user.email ?? "");

      setJobTitle(p?.job_title ?? "");
      setCompanyName(p?.company_name ?? "");
      setWebsite(p?.website ? p.website.replace(/^https?:\/\//i, "") : "");

      setAddress1(p?.address1 ?? "");
      setAddress2(p?.address2 ?? "");
      setCity(p?.city ?? "");
      setStateProv(p?.state ?? "");
      setZip(p?.zip ?? "");
      setAddressSearch([p?.address1, p?.address2, p?.city, p?.state, p?.zip].filter(Boolean).join(", "));

      setTimezone(p?.timezone ?? "");
      setDefaultLaborRate(p?.default_labor_rate != null ? String(p.default_labor_rate) : "");
      setDefaultTaxRate(p?.default_tax_rate != null ? String(p.default_tax_rate) : "");
      setInvoiceTerms(p?.invoice_terms ?? "");
      setNotes(p?.notes ?? "");
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  function toNumberOrNull(s: string) {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function onPhoneChange(value: string) {
    setPhone(formatPhoneInput(value));
  }

  function onEmailBlur() {
    setEmail(normalizeEmail(email));
  }

  function onWebsiteChange(value: string) {
    setWebsite(formatWebsiteInput(value));
  }

  function onWebsiteBlur() {
    setWebsite(formatWebsiteInput(website));
  }

  function onAddressChange(value: string) {
    setAddressSearch(value);
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
    const nextCity = address.city || address.town || address.village || address.hamlet || "";
    const nextState = address.state || "";
    const nextZip = address.postcode || "";

    setAddressSearch(item.display_name);
    setAddress1(line1 || address1);
    setCity(nextCity || city);
    setStateProv(nextState || stateProv);
    setZip(nextZip || zip);

    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
  }

  function chooseJobTitle(value: string) {
    if (value === "Custom") {
      setJobTitle("");
      return;
    }
    setJobTitle(value);
  }

  function chooseInvoiceTerms(value: string) {
    if (value === "Custom") {
      setInvoiceTerms("");
      return;
    }
    setInvoiceTerms(value);
  }

  async function saveProfile(nextAvatarUrl?: string) {
    if (!userId) return;

    setSaving(true);
    setPageError("");
    setPageMessage("");

    const payload: ProfileRow = {
      user_id: userId,
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      avatar_url: (nextAvatarUrl ?? avatarUrl).trim() || null,
      email: normalizeEmail(email) || null,

      job_title: jobTitle.trim() || null,
      company_name: companyName.trim() || null,
      website: formatWebsiteInput(website, true).trim() || null,

      address1: address1.trim() || null,
      address2: address2.trim() || null,
      city: city.trim() || null,
      state: stateProv.trim() || null,
      zip: zip.trim() || null,

      timezone: timezone.trim() || null,
      default_labor_rate: toNumberOrNull(defaultLaborRate),
      default_tax_rate: toNumberOrNull(defaultTaxRate),
      invoice_terms: invoiceTerms.trim() || null,
      notes: notes.trim() || null,
    };

    const res = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });

    setSaving(false);

    if (res.error) {
      setPageError(res.error.message);
      Alert.alert("Save failed", res.error.message);
      return;
    }

    if (nextAvatarUrl) setAvatarUrl(nextAvatarUrl);

    setEmail(normalizeEmail(email));
    setWebsite(formatWebsiteInput(website));
    setPageMessage("Profile saved.");
    Alert.alert("Success", "Profile saved.");
  }

  async function pickAndUploadAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (picked.canceled) return;

    const asset = picked.assets?.[0];
    const uri = asset?.uri;
    if (!uri) return;

    try {
      setSaving(true);

      const blob = await (await fetch(uri)).blob();
      const ext = (asset?.fileName?.split(".").pop() || "jpg").toLowerCase();
      const contentType = blob.type || (ext === "png" ? "image/png" : "image/jpeg");
      const fileName = `avatar.${ext === "png" ? "png" : "jpg"}`;
      const path = `${userId}/${fileName}`;

      const uploadBody =
        typeof File !== "undefined"
          ? new File([blob], fileName, { type: contentType })
          : blob;

      const upload = await supabase.storage
        .from("avatars")
        .upload(path, uploadBody, { upsert: true, contentType });

      if (upload.error) throw new Error(upload.error.message);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
      await saveProfile(pub.publicUrl);
    } catch (e: any) {
      setSaving(false);
      Alert.alert(
        "Upload failed",
        e?.message ??
          "Check that the avatars bucket exists, is public, and storage policies are applied."
      );
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Profile</Text>
            <Text style={styles.heroSub}>
              Manage your contact details, business profile, defaults, and photo.
            </Text>
          </View>

          <GoldButton
            label={saving ? "Saving..." : "Save Profile"}
            onPress={() => saveProfile()}
            disabled={saving || loading || !userId}
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
          icon="person-circle-outline"
          title="Profile Photo"
          sub="Upload a profile image used throughout the app."
        >
          <View style={styles.photoRow}>
            <View style={styles.photoCard}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.photoActions}>
              <GoldButton
                label={avatarUrl ? "Change Photo" : "Upload Photo"}
                onPress={pickAndUploadAvatar}
                disabled={saving || loading || !userId}
                style={{ minWidth: 160 }}
              />
              <Text style={styles.helper}>Recommended: square image, 512×512 or larger.</Text>
            </View>
          </View>
        </SectionCard>

        <SectionCard
          icon="person-outline"
          title="Owner Information"
          sub="Your main contact details and job title."
        >
          <View style={styles.grid2}>
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onBlur={onEmailBlur}
                placeholder="name@company.com"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                value={phone}
                onChangeText={onPhoneChange}
                placeholder="(555) 555-5555"
                placeholderTextColor={theme.colors.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.field} />
          </View>

          <Text style={styles.miniHeading}>Job title</Text>
          <View style={styles.pillRow}>
            {JOB_TITLE_PRESETS.map((option) => (
              <ChoicePill
                key={option}
                label={option}
                active={selectedJobTitlePreset === option}
                onPress={() => chooseJobTitle(option)}
              />
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Custom job title</Text>
            <TextInput
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="Owner / Project Manager"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>
        </SectionCard>

        <SectionCard
          icon="business-outline"
          title="Business Information"
          sub="Business identity and website used on customer-facing documents."
        >
          <View style={styles.grid2}>
            <View style={styles.field}>
              <Text style={styles.label}>Company name</Text>
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="GSD Grid Services"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Website</Text>
              <TextInput
                value={website}
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
        </SectionCard>

        <SectionCard
          icon="location-outline"
          title="Business Address"
          sub="Search and autofill your address, city, state, and ZIP."
        >
          <View style={styles.field}>
            <Text style={styles.label}>Address search</Text>
            <TextInput
              value={addressSearch}
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
                  addressSearch.trim().length >= 4 ? (
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
                value={address1}
                onChangeText={setAddress1}
                placeholder="123 Main St"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address line 2</Text>
              <TextInput
                value={address2}
                onChangeText={setAddress2}
                placeholder="Suite / Unit"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>City</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>State</Text>
              <TextInput
                value={stateProv}
                onChangeText={setStateProv}
                placeholder="NC"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>ZIP</Text>
              <TextInput
                value={zip}
                onChangeText={(v) => setZip(v.replace(/[^\d-]/g, "").slice(0, 10))}
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
          sub="Common defaults used when creating invoices and work orders."
        >
          <View style={styles.grid2}>
            <View style={styles.field}>
              <Text style={styles.label}>Default labor rate</Text>
              <TextInput
                value={defaultLaborRate}
                onChangeText={(v) => setDefaultLaborRate(cleanDecimalInput(v))}
                placeholder="85"
                placeholderTextColor={theme.colors.muted}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Default tax rate (%)</Text>
              <TextInput
                value={defaultTaxRate}
                onChangeText={(v) => setDefaultTaxRate(cleanDecimalInput(v))}
                placeholder="7.25"
                placeholderTextColor={theme.colors.muted}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.miniHeading}>Invoice terms</Text>
          <View style={styles.pillRow}>
            {INVOICE_TERM_PRESETS.map((option) => (
              <ChoicePill
                key={option}
                label={option}
                active={selectedInvoiceTermsPreset === option}
                onPress={() => chooseInvoiceTerms(option)}
              />
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Custom invoice terms</Text>
            <TextInput
              value={invoiceTerms}
              onChangeText={setInvoiceTerms}
              placeholder="Due upon receipt / Net 15 / Net 30"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.grid2}>
            <View style={styles.field}>
              <Text style={styles.label}>Timezone</Text>
              <TextInput
                value={timezone}
                onChangeText={setTimezone}
                placeholder="America/New_York"
                placeholderTextColor={theme.colors.muted}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          </View>
        </SectionCard>

        <SectionCard
          icon="document-text-outline"
          title="Internal Notes"
          sub="Private notes about your workflow, invoicing, or profile details."
        >
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything you want your team to know about invoicing, procedures, etc."
              placeholderTextColor={theme.colors.muted}
              style={[styles.input, styles.textArea]}
              multiline
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

  photoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "flex-start",
  },

  photoCard: {
    width: 180,
    height: 180,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 24,
    backgroundColor: "#FFFCF6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },

  avatarInitials: {
    color: theme.colors.goldDark,
    fontWeight: "900",
    fontSize: 42,
  },

  photoActions: {
    gap: 10,
    minWidth: 180,
    flex: 1,
  },

  helper: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },

  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
});