import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
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
const SUCCESS = "#216a43";
const SUCCESS_BG = "#eefaf2";
const SUCCESS_BORDER = "#b9dfc8";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const inviteId = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Checking invite...");
  const [error, setError] = useState("");

  useEffect(() => {
    void handleInvite();
  }, [inviteId]);

  async function handleInvite() {
    setLoading(true);
    setError("");

    try {
      if (!inviteId) {
        throw new Error("Missing invite ID.");
      }

      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        const redirectTo =
          typeof window !== "undefined"
            ? `${window.location.origin}/accept-invite?id=${encodeURIComponent(inviteId)}`
            : undefined;

        if (redirectTo) {
          router.replace(`/(auth)/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`);
          return;
        }

        router.replace("/(auth)/sign-in");
        return;
      }

      const inviteRes = await supabase
        .from("org_invites")
        .select("id, email, status")
        .eq("id", inviteId)
        .maybeSingle();

      if (inviteRes.error) {
        throw new Error(inviteRes.error.message);
      }

      if (!inviteRes.data) {
        throw new Error("Invite not found.");
      }

      const inviteEmail = (inviteRes.data.email ?? "").trim().toLowerCase();
      const userEmail = (user.email ?? "").trim().toLowerCase();

      if (inviteEmail && userEmail && inviteEmail !== userEmail) {
        throw new Error(`This invite was sent to ${inviteEmail}. Sign in with that email to accept it.`);
      }

      if ((inviteRes.data.status ?? "").toLowerCase() !== "pending") {
        setMessage("This invite has already been used or cancelled.");
        setLoading(false);
        return;
      }

      const acceptRes = await supabase.rpc("accept_org_invites_for_current_user");

      if (acceptRes.error) {
        throw new Error(acceptRes.error.message);
      }

      setMessage("Invite accepted. Redirecting to dashboard...");
      setLoading(false);

      setTimeout(() => {
        router.replace("/(app)/dashboard");
      }, 1200);
    } catch (err: any) {
      setError(err?.message ?? "Failed to accept invite.");
      setLoading(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Team Access</Text>
              <Text style={styles.heroTitle}>Accept organization invite</Text>
              <Text style={styles.heroSubtitle}>
                Join the workspace and route directly into the dashboard once your invite is confirmed.
              </Text>
            </View>

            <View style={styles.heroPanel}>
              <Text style={styles.heroPanelLabel}>Invite flow</Text>
              <Text style={styles.heroPanelValue}>Verify → Accept → Enter</Text>
              <Text style={styles.heroPanelText}>
                We confirm the invite, match the signed-in email, and attach you to the organization.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Organization Invite</Text>
            <Text style={styles.title}>Accept invite</Text>
            <Text style={styles.subtitle}>This page matches the dashboard visual system.</Text>

            <View style={styles.divider} />

            {loading ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={GOLD} />
                <Text style={styles.statusText}>{message}</Text>
              </View>
            ) : error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{message}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={() => router.replace("/(app)/dashboard")}
                style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null]}
              >
                <Text style={styles.primaryBtnText}>{error ? "Go to Dashboard" : "Open Dashboard"}</Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                style={({ pressed }) => [styles.secondaryBtn, pressed ? styles.pressed : null]}
              >
                <Text style={styles.secondaryBtnText}>Back to Sign In</Text>
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

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },

  statusText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "800",
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

  successBox: {
    borderWidth: 1,
    borderColor: SUCCESS_BORDER,
    backgroundColor: SUCCESS_BG,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  successText: {
    color: SUCCESS,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "800",
  },

  actions: {
    marginTop: 18,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
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
    minWidth: 180,
    shadowColor: "#c9a227",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },

  primaryBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "900",
  },

  secondaryBtn: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    minWidth: 160,
  },

  secondaryBtnText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.92,
  },
});