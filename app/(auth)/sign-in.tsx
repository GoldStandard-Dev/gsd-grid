import { useMemo, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import { getUserOrgId, signInWithEmail } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";

const PAGE_BG = "#f7f3ea";
const CARD_BG = "#fffdf8";
const BORDER = "#e4d6b2";
const BORDER_SOFT = "#dcc89a";
const GOLD = "#c9a227";
const GOLD_BRIGHT = "#d4af37";
const TEXT = "#111111";
const MUTED = "#6f6a63";
const MUTED_2 = "#7b746b";
const DANGER = "#9f3b2f";
const DANGER_BG = "#fff3ef";
const DANGER_BORDER = "#efc8bc";
const SUCCESS = "#216a43";
const SUCCESS_BG = "#eefaf2";
const SUCCESS_BORDER = "#b9dfc8";

export default function SignIn() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();

  const redirectTo = useMemo(() => {
    return typeof params.redirectTo === "string" ? params.redirectTo : "";
  }, [params.redirectTo]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function routeAfterSignIn() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(authError.message);
    }

    const user = authData.user;

    if (!user) {
      throw new Error("Sign-in succeeded, but no active user was found.");
    }

    if (redirectTo) {
      if (typeof window !== "undefined") {
        window.location.href = redirectTo;
        return;
      }
    }

    const orgId = await getUserOrgId(user.id);

    if (!orgId) {
      router.replace("/(onboarding)/create-org");
      return;
    }

    router.replace("/(app)/dashboard");
  }

  async function handleSignIn() {
    setErr(null);
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail) {
      setErr("Enter your email.");
      return;
    }

    if (!cleanPassword) {
      setErr("Enter your password.");
      return;
    }

    try {
      setLoading(true);

      const result = await signInWithEmail(cleanEmail, cleanPassword);

      if (!result.ok) {
        throw new Error(result.error);
      }

      await routeAfterSignIn();
    } catch (error: any) {
      setErr(error?.message ?? "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();

    setErr(null);
    setMsg(null);

    if (!cleanEmail) {
      setErr("Enter your email first so we can send a reset link.");
      return;
    }

    try {
      setResetting(true);

      const redirectToUrl =
        typeof window !== "undefined" ? `${window.location.origin}/(auth)/sign-in` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectToUrl,
      });

      if (error) {
        throw new Error(error.message);
      }

      setMsg("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      setErr(error?.message ?? "Failed to send password reset email.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>GSD Grid</Text>
              <Text style={styles.heroTitle}>Welcome back</Text>
              <Text style={styles.heroSubtitle}>
                Sign in to manage work orders, pricing, invoices, workforce, and daily operations.
              </Text>
            </View>

            <View style={styles.heroPanel}>
              <Image
                source={require("../../assets/brand/gsd-grid-icon.png")}
                style={styles.logo}
              />
              <Text style={styles.heroPanelLabel}>Secure access</Text>
              <Text style={styles.heroPanelValue}>Owner + team portal</Text>
              <Text style={styles.heroPanelText}>
                Use your company email to access your organization workspace and assigned tools.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardEyebrow}>Account Access</Text>
                <Text style={styles.title}>Sign in</Text>
                <Text style={styles.subtitle}>Access your account and continue where you left off.</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (err) setErr(null);
                  if (msg) setMsg(null);
                }}
                placeholder="you@company.com"
                placeholderTextColor={MUTED_2}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>

                <Pressable
                  onPress={handleForgotPassword}
                  disabled={resetting || loading}
                  style={({ pressed }) => [styles.linkBtn, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.forgotLink}>
                    {resetting ? "Sending reset..." : "Forgot password?"}
                  </Text>
                </Pressable>
              </View>

              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (err) setErr(null);
                }}
                placeholder="Enter password"
                placeholderTextColor={MUTED_2}
                secureTextEntry
                style={styles.input}
                onSubmitEditing={() => {
                  if (!loading && !resetting) {
                    void handleSignIn();
                  }
                }}
              />
            </View>

            {err ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{err}</Text>
              </View>
            ) : null}

            {msg ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{msg}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={() => void handleSignIn()}
                disabled={loading || resetting}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (loading || resetting) ? styles.primaryBtnDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.primaryBtnText}>{loading ? "Signing in..." : "Sign In"}</Text>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Need an account?</Text>
              <Link href="/(auth)/sign-up" style={styles.footerLink}>
                Create one
              </Link>
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
    maxWidth: 620,
  },

  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },

  heroPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  heroPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  heroPanel: {
    width: 290,
    minWidth: 260,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    justifyContent: "center",
  },

  logo: {
    width: 56,
    height: 56,
    resizeMode: "contain",
    marginBottom: 16,
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

  cardTop: {
    gap: 6,
  },

  cardEyebrow: {
    color: GOLD,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },

  title: {
    color: TEXT,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
  },

  subtitle: {
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

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    flexWrap: "wrap",
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

  linkBtn: {
    borderRadius: 12,
  },

  forgotLink: {
    color: GOLD,
    fontSize: 13,
    fontWeight: "900",
  },

  errorBox: {
    marginTop: 2,
    marginBottom: 2,
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
    marginTop: 2,
    marginBottom: 2,
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

  footerRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },

  footerText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "700",
  },

  footerLink: {
    color: GOLD,
    fontSize: 13,
    fontWeight: "900",
  },

  pressed: {
    opacity: 0.92,
  },
});