import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {Alert, Image, Pressable, StyleSheet, Text, TextInput, View,} from "react-native";
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
  notes: string | null;
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

function formatPhoneInput(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function normalizeEmail(value: string) {
  return (value ?? "").trim().toLowerCase();
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
  const [notes, setNotes] = useState("");

  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");

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

  useEffect(() => {
    void loadProfile();
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
        .select("user_id, full_name, phone, avatar_url, email, job_title, notes")
        .eq("user_id", user.id)
        .maybeSingle();

      const p = (res.data as ProfileRow) ?? null;

      setFullName(p?.full_name ?? "");
      setPhone(p?.phone ?? "");
      setAvatarUrl(p?.avatar_url ?? "");
      setEmail(p?.email ?? user.email ?? "");
      setJobTitle(p?.job_title ?? "");
      setNotes(p?.notes ?? "");
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }

  function onPhoneChange(value: string) {
    setPhone(formatPhoneInput(value));
  }

  function onEmailBlur() {
    setEmail(normalizeEmail(email));
  }

  function chooseJobTitle(value: string) {
    if (value === "Custom") {
      setJobTitle("");
      return;
    }

    setJobTitle(value);
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
    if (!uri || !userId) return;

    try {
      setSaving(true);

      const blob = await (await fetch(uri)).blob();
      const ext = (asset?.fileName?.split(".").pop() || "jpg").toLowerCase();
      const contentType = blob.type || (ext === "png" ? "image/png" : "image/jpeg");
      const fileName = `avatar.${ext === "png" ? "png" : "jpg"}`;
      const path = `${userId}/${fileName}`;

      const uploadBody =
        typeof File !== "undefined" ? new File([blob], fileName, { type: contentType }) : blob;

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
              Manage your personal account details, job title, and profile photo.
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
          sub="Upload a personal profile image used throughout the app."
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
          title="Personal Information"
          sub="Your main contact details for your account."
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

            <View style={styles.field}>
              <Text style={styles.label}>Account email</Text>
              <TextInput
                value={accountEmail}
                editable={false}
                placeholderTextColor={theme.colors.muted}
                style={[styles.input, styles.inputDisabled]}
              />
            </View>
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
          icon="document-text-outline"
          title="Personal Notes"
          sub="Private notes for your own profile or internal reference."
        >
          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes about your role, contact preferences, or account details."
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

const PAGE_BG = "#f7f3ea";
const CARD_BG = "#fffdf8";
const BORDER = "#e4d6b2";
const GOLD = "#c9a227";
const DARK_CARD = "#111111";
const DARK_BORDER = "rgba(212, 175, 55, 0.35)";

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
    backgroundColor: DARK_CARD,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    borderRadius: 28,
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
    color: "#FFFFFF",
  },

  heroSub: {
    marginTop: 6,
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    fontWeight: "700",
  },

  saveBtn: {
    minWidth: 180,
  },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
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
    borderColor: BORDER,
    backgroundColor: "rgba(212, 175, 55, 0.14)",
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
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
    backgroundColor: CARD_BG,
  },

  inputDisabled: {
    opacity: 0.7,
    backgroundColor: "#f3eee3",
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
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    alignItems: "center",
    justifyContent: "center",
  },

  pillActive: {
    backgroundColor: "#F5E6B8",
    borderColor: GOLD,
  },

  pillText: {
    color: theme.colors.ink,
    fontWeight: "800",
    fontSize: 12.5,
  },

  pillTextActive: {
    color: theme.colors.goldDark,
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
    borderColor: BORDER,
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