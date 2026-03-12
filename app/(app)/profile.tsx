import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Screen from "../../src/components/Screen";
import GoldButton from "../../src/components/GoldButton";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;

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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
}) {
  const editable = !!onChangeText;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          keyboardType={keyboardType ?? "default"}
          style={styles.input}
        />
      ) : (
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.disabledText}>{value || "—"}</Text>
        </View>
      )}
    </View>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");

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

  const initials = useMemo(() => {
    const name = fullName.trim();
    if (name) {
      const parts = name.split(/\s+/).slice(0, 2);
      return parts.map((p) => p[0]?.toUpperCase()).join("") || "ME";
    }
    return email ? email.slice(0, 2).toUpperCase() : "ME";
  }, [email, fullName]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user?.id) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const res = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, phone, avatar_url, job_title, company_name, website, address1, address2, city, state, zip, timezone, default_labor_rate, default_tax_rate, invoice_terms, notes"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const p = (res.data as ProfileRow) ?? null;

      setFullName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");
      setAvatarUrl(p?.avatar_url ?? "");

      setJobTitle(p?.job_title ?? "");
      setCompanyName(p?.company_name ?? "");
      setWebsite(p?.website ?? "");

      setAddress1(p?.address1 ?? "");
      setAddress2(p?.address2 ?? "");
      setCity(p?.city ?? "");
      setStateProv(p?.state ?? "");
      setZip(p?.zip ?? "");

      setTimezone(p?.timezone ?? "");
      setDefaultLaborRate(p?.default_labor_rate != null ? String(p.default_labor_rate) : "");
      setDefaultTaxRate(p?.default_tax_rate != null ? String(p.default_tax_rate) : "");
      setInvoiceTerms(p?.invoice_terms ?? "");
      setNotes(p?.notes ?? "");

      setLoading(false);
    })();
  }, []);

  function toNumberOrNull(s: string) {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  async function saveProfile(nextAvatarUrl?: string) {
    if (!userId) return;

    setSaving(true);

    const payload: ProfileRow = {
      user_id: userId,
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      avatar_url: (nextAvatarUrl ?? avatarUrl).trim() || null,

      job_title: jobTitle.trim() || null,
      company_name: companyName.trim() || null,
      website: website.trim() || null,

      address1: address1.trim() || null,
      address2: address2.trim() || null,
      city: city.trim() || null,
      state: stateProv.trim() || null,
      zip: zip.trim() || null,

      timezone: timezone.trim() || null,
      default_labor_rate: toNumberOrNull(defaultLaborRate),
      default_tax_rate: toNumberOrNull(defaultTaxRate),
      invoice_terms: invoiceTerms.trim() || null,
      notes: notes.trim() || null
    };

    const res = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });

    setSaving(false);

    if (res.error) {
      Alert.alert("Save failed", res.error.message);
      return;
    }

    if (nextAvatarUrl) setAvatarUrl(nextAvatarUrl);
  }

  async function pickAndUploadAvatar() {
    // Permissions (mobile). Web usually returns granted = true.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9
    });

    if (picked.canceled) return;

    const asset = picked.assets?.[0];
    const uri = asset?.uri;
    if (!uri) return;

    try {
      setSaving(true);

      // Convert to Blob
      const blob = await (await fetch(uri)).blob();
      const ext = (asset?.fileName?.split(".").pop() || "jpg").toLowerCase();
      const contentType = blob.type || (ext === "png" ? "image/png" : "image/jpeg");
      const fileName = `avatar.${ext === "png" ? "png" : "jpg"}`;

      // Upload path must start with userId/ (matches storage policy)
      const path = `${userId}/${fileName}`;

      // Web upload is most reliable with File
      const uploadBody =
        typeof File !== "undefined"
          ? new File([blob], fileName, { type: contentType })
          : blob;

      const upload = await supabase.storage
        .from("avatars")
        .upload(path, uploadBody, { upsert: true, contentType });

      if (upload.error) throw new Error(upload.error.message);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(upload.data.path);
      const publicUrl = pub.publicUrl;

      await saveProfile(publicUrl);
    } catch (e: any) {
      Alert.alert(
        "Upload failed",
        e?.message ??
          "Check that the avatars bucket exists, is public, and storage policies are applied."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={ui.container}>
        <Text style={ui.h1}>Profile</Text>
        <Text style={ui.sub}>Owner details, business defaults, and profile photo.</Text>

        <View style={[ui.card, styles.card]}>
          <View style={styles.grid}>
            {/* LEFT: photo */}
            <View style={styles.left}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}

              <Pressable
                onPress={pickAndUploadAvatar}
                style={({ pressed }) => [styles.photoBtn, pressed ? { opacity: 0.9 } : null]}
                disabled={saving || loading || !userId}
              >
                <Text style={styles.photoBtnText}>{avatarUrl ? "Change photo" : "Add photo"}</Text>
              </Pressable>

              <Text style={styles.helper}>
                Recommended: square image, 512×512+
              </Text>
            </View>

            {/* RIGHT: fields */}
            <View style={styles.right}>
              <Section title="Owner" />
              <Field label="Email" value={email} />
              <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
              <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" />
              <Field label="Job title" value={jobTitle} onChangeText={setJobTitle} placeholder="Owner / Project Manager" />

              <Section title="Business" />
              <Field label="Company name" value={companyName} onChangeText={setCompanyName} placeholder="GSD Grid Services" />
              <Field label="Website" value={website} onChangeText={setWebsite} placeholder="https://..." keyboardType="url" />

              <Section title="Business address" />
              <Field label="Address line 1" value={address1} onChangeText={setAddress1} placeholder="Street address" />
              <Field label="Address line 2" value={address2} onChangeText={setAddress2} placeholder="Suite / Unit (optional)" />
              <View style={styles.row3}>
                <View style={styles.rowItem}>
                  <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
                </View>
                <View style={styles.rowItem}>
                  <Field label="State" value={stateProv} onChangeText={setStateProv} placeholder="NC" />
                </View>
                <View style={styles.rowItem}>
                  <Field label="ZIP" value={zip} onChangeText={setZip} placeholder="28012" keyboardType="numeric" />
                </View>
              </View>

              <Section title="Defaults (used for new invoices/work orders later)" />
              <View style={styles.row2}>
                <View style={styles.rowItem}>
                  <Field
                    label="Default labor rate"
                    value={defaultLaborRate}
                    onChangeText={setDefaultLaborRate}
                    placeholder="e.g. 85"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Field
                    label="Default tax rate (%)"
                    value={defaultTaxRate}
                    onChangeText={setDefaultTaxRate}
                    placeholder="e.g. 7.25"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Field
                label="Invoice terms"
                value={invoiceTerms}
                onChangeText={setInvoiceTerms}
                placeholder="e.g. Due upon receipt / Net 15 / Net 30"
              />
              <Field
                label="Timezone"
                value={timezone}
                onChangeText={setTimezone}
                placeholder="e.g. America/New_York"
              />

              <View style={styles.notesBlock}>
                <Text style={styles.label}>Notes (internal)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Anything you want your team to know about invoicing, procedures, etc."
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.input, styles.textArea]}
                  multiline
                />
              </View>

              <GoldButton
                label={saving ? "Saving..." : "Save changes"}
                onPress={() => saveProfile()}
                disabled={saving || loading || !userId}
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14 },

  grid: {
    flexDirection: "row",
    gap: 18,
    flexWrap: "wrap",
    alignItems: "flex-start"
  },

  left: { width: 230, gap: 10 },
  right: { flex: 1, minWidth: 320 },

  avatarImg: {
    width: 180,
    height: 180,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  avatarFallback: {
    width: 180,
    height: 180,
    borderRadius: 26,
    backgroundColor: theme.colors.sidebar,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F1F1F"
  },
  avatarInitials: { color: theme.colors.gold, fontWeight: "900", fontSize: 48 },

  photoBtn: {
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  photoBtnText: { color: theme.colors.ink, fontWeight: "900" },

  helper: { color: theme.colors.muted, fontWeight: "700", fontSize: 12 },

  sectionHeader: { marginTop: 14, marginBottom: 10 },
  sectionTitle: { color: theme.colors.ink2, fontWeight: "900", letterSpacing: 0.2 },
  sectionLine: { height: 1, backgroundColor: theme.colors.border, marginTop: 8 },

  field: { marginBottom: 12 },
  label: { color: theme.colors.muted, fontWeight: "800", fontSize: 12, marginBottom: 6 },

  input: {
    minHeight: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
    color: theme.colors.ink
  },
  inputDisabled: { justifyContent: "center" },
  disabledText: { color: theme.colors.muted, fontWeight: "800" },

  row2: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  row3: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  rowItem: { flex: 1, minWidth: 160 },

  notesBlock: { marginTop: 6 },
  textArea: { minHeight: 110, textAlignVertical: "top" }
});