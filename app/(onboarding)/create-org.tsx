import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import { createOrganizationForCurrentUser, getUserOrgId } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";

const PAGE_BG = "#f7f3ea";
const CARD_BG = "#fffdf8";
const BORDER = "#e4d6b2";
const BORDER_SOFT = "#dcc89a";
const GOLD = "#c9a227";
const GOLD_BRIGHT = "#d4af37";
const TEXT = "#111111";
const MUTED = "#6f6a63";
const DANGER = "#9f3b2f";
const DANGER_BG = "#fff3ef";
const DANGER_BORDER = "#efc8bc";

export default function CreateOrg() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setChecking(false);
        router.replace("/(auth)/sign-in");
        return;
      }

      const orgId = await getUserOrgId(data.user.id);

      if (orgId) {
        router.replace("/(app)/dashboard");
        return;
      }

      setChecking(false);
    })();
  }, [router]);

  async function handleCreateOrg() {
    if (loading) return;

    setErr(null);

    const cleanName = name.trim();

    if (!cleanName) {
      setErr("Enter your organization name.");
      return;
    }

    try {
      setLoading(true);

      const res = await createOrganizationForCurrentUser(cleanName);

      if (res.ok) {
        router.replace("/(app)/dashboard");
        return;
      }

      if (res.error?.toLowerCase().includes("duplicate")) {
        router.replace("/(app)/dashboard");
        return;
      }

      setErr(res.error);
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Workspace Setup</Text>
              <Text style={styles.heroTitle}>Create your organization</Text>
              <Text style={styles.heroSubtitle}>
                You will be added as the owner. This becomes the main workspace for your dashboard,
                team, pricing, work orders, and invoices.
              </Text>
            </View>

            <View style={styles.heroPanel}>
              <Text style={styles.heroPanelLabel}>Next step</Text>
              <Text style={styles.heroPanelValue}>Dashboard unlock</Text>
              <Text style={styles.heroPanelText}>
                Once your organization is created, the app routes directly into the main dashboard.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Organization</Text>
            <Text style={styles.title}>Set up your workspace</Text>
            <Text style={styles.subtitle}>Create your company and continue into the dashboard.</Text>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.label}>Organization name</Text>
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (err) setErr(null);
                }}
                placeholder="GSD Contracting"
                placeholderTextColor={MUTED}
                style={styles.input}
                onSubmitEditing={() => {
                  if (!loading) void handleCreateOrg();
                }}
              />
            </View>

            {err ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{err}</Text>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => void handleCreateOrg()}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  loading ? styles.primaryBtnDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? "Creating organization..." : "Create Organization"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: PAGE_BG,
    padding: 24,
    justifyContent: "center",
  },

  wrap: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    gap: 16,
  },

  hero: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    backgroundColor: TEXT,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },

  heroCopy: {
    flex: 1,
    minWidth: 280,
    justifyContent: "center",
  },

  eyebrow: {
    color: GOLD_BRIGHT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  heroTitle: {
    color: "#ffffff",
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
  },

  heroSubtitle: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 10,
    maxWidth: 640,
  },

  heroPanel: {
    width: 300,
    minWidth: 260,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    justifyContent: "center",
  },

  heroPanelLabel: {
    color: GOLD_BRIGHT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 8,
  },

  heroPanelValue: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
  },

  heroPanelText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  cardEyebrow: {
    color: GOLD,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  title: {
    marginTop: 6,
    color: TEXT,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
  },

  subtitle: {
    marginTop: 6,
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },

  divider: {
    height: 1,
    backgroundColor: "#efe4c8",
    marginTop: 16,
    marginBottom: 18,
  },

  field: {
    marginBottom: 16,
  },

  label: {
    color: TEXT,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fffaf0",
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },

  errorBox: {
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    backgroundColor: DANGER_BG,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  errorText: {
    color: DANGER,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },

  actionRow: {
    marginTop: 18,
  },

  primaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: GOLD_BRIGHT,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    shadowColor: "#c9a227",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  primaryBtnDisabled: {
    opacity: 0.7,
  },

  primaryBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.92,
  },
});