import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Screen from "../../src/components/Screen";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";

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
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>Accept Invite</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={theme.colors.goldDark} />
              <Text style={styles.text}>{message}</Text>
            </View>
          ) : error ? (
            <>
              <Text style={styles.error}>{error}</Text>
              <Pressable onPress={() => router.replace("/(app)/dashboard")} style={styles.button}>
                <Text style={styles.buttonText}>Go to Dashboard</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.text}>{message}</Text>
              <Pressable onPress={() => router.replace("/(app)/dashboard")} style={styles.button}>
                <Text style={styles.buttonText}>Open Dashboard</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAF7F0",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 22,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: theme.colors.ink,
    marginBottom: 14,
  },

  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  text: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },

  error: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 22,
  },

  button: {
    marginTop: 18,
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.gold,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  buttonText: {
    color: "#111111",
    fontWeight: "900",
    fontSize: 14,
  },
});