import { useMemo, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Screen from "../../src/components/Screen";
import { getUserOrgId, signInWithEmail } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";

// ─── Palette ────────────────────────────────────────────────
const BG         = "#080808";
const SURFACE    = "#111111";
const SURFACE2   = "#191919";
const BORDER     = "#222222";
const BORDER_FOCUS = "rgba(212,175,55,0.60)";
const GOLD       = "#D4AF37";
const GOLD_DARK  = "#B8962E";
const GOLD_DIM   = "rgba(212,175,55,0.18)";
const WHITE      = "#FFFFFF";
const WHITE_80   = "rgba(255,255,255,0.80)";
const WHITE_45   = "rgba(255,255,255,0.45)";
const WHITE_20   = "rgba(255,255,255,0.20)";
const DANGER     = "#F87171";
const DANGER_BG  = "rgba(239,68,68,0.10)";
const DANGER_BR  = "rgba(239,68,68,0.22)";
const SUCCESS    = "#4ADE80";
const SUCCESS_BG = "rgba(74,222,128,0.08)";
const SUCCESS_BR = "rgba(74,222,128,0.22)";

export default function SignIn() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();

  const redirectTo = useMemo(
    () => (typeof params.redirectTo === "string" ? params.redirectTo : ""),
    [params.redirectTo]
  );

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass,  setFocusPass]  = useState(false);
  const [err,        setErr]        = useState<string | null>(null);
  const [msg,        setMsg]        = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [resetting,  setResetting]  = useState(false);

  // ─── Routing ─────────────────────────────────────────────
  async function routeAfterSignIn() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(authError.message);
    const user = authData.user;
    if (!user) throw new Error("Sign-in succeeded but no user was found.");

    if (redirectTo && typeof window !== "undefined") {
      window.location.href = redirectTo;
      return;
    }

    const orgId = await getUserOrgId(user.id);
    if (!orgId) {
      router.replace("/(onboarding)/create-org");
      return;
    }
    router.replace("/(app)/dashboard");
  }

  // ─── Handlers ────────────────────────────────────────────
  async function handleSignIn() {
    setErr(null);
    setMsg(null);

    const cleanEmail    = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail)    { setErr("Enter your email address."); return; }
    if (!cleanPassword) { setErr("Enter your password."); return; }

    try {
      setLoading(true);
      const result = await signInWithEmail(cleanEmail, cleanPassword);
      if (!result.ok) throw new Error(result.error);
      await routeAfterSignIn();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim().toLowerCase();
    setErr(null);
    setMsg(null);

    if (!cleanEmail) {
      setErr("Enter your email address above, then tap Forgot password.");
      return;
    }

    try {
      setResetting(true);
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/(auth)/sign-in`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw new Error(error.message);
      setMsg("Reset link sent — check your inbox.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send reset email.");
    } finally {
      setResetting(false);
    }
  }

  const busy = loading || resetting;

  // ─── Render ───────────────────────────────────────────────
  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Brand mark ── */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Image
                source={require("../../assets/brand/gsd-grid-icon.png")}
                style={styles.logo}
              />
            </View>
            <View style={styles.brandText}>
              <Text style={styles.appName}>GSD Grid</Text>
              <Text style={styles.appSub}>Field Service Management</Text>
            </View>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>

            {/* Card header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Welcome back</Text>
              <Text style={styles.cardSub}>
                Sign in to your workspace to continue.
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputWrap, focusEmail && styles.inputFocus]}>
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={focusEmail ? GOLD : WHITE_20}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErr(null); setMsg(null); }}
                  placeholder="you@company.com"
                  placeholderTextColor={WHITE_20}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  onFocus={() => setFocusEmail(true)}
                  onBlur={() => setFocusEmail(false)}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <Pressable
                  onPress={handleForgotPassword}
                  disabled={busy}
                  hitSlop={8}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={styles.forgotText}>
                    {resetting ? "Sending…" : "Forgot password?"}
                  </Text>
                </Pressable>
              </View>
              <View style={[styles.inputWrap, focusPass && styles.inputFocus]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={focusPass ? GOLD : WHITE_20}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErr(null); }}
                  placeholder="Enter your password"
                  placeholderTextColor={WHITE_20}
                  secureTextEntry={!showPass}
                  onFocus={() => setFocusPass(true)}
                  onBlur={() => setFocusPass(false)}
                  onSubmitEditing={() => { if (!busy) void handleSignIn(); }}
                  returnKeyType="go"
                />
                <Pressable
                  onPress={() => setShowPass((s) => !s)}
                  style={styles.eyeBtn}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPass ? "eye-off-outline" : "eye-outline"}
                    size={17}
                    color={WHITE_20}
                  />
                </Pressable>
              </View>
            </View>

            {/* Alert */}
            {err ? (
              <View style={[styles.alert, styles.alertError]}>
                <Ionicons name="alert-circle-outline" size={14} color={DANGER} />
                <Text style={[styles.alertText, { color: DANGER }]}>{err}</Text>
              </View>
            ) : null}

            {msg ? (
              <View style={[styles.alert, styles.alertSuccess]}>
                <Ionicons name="checkmark-circle-outline" size={14} color={SUCCESS} />
                <Text style={[styles.alertText, { color: SUCCESS }]}>{msg}</Text>
              </View>
            ) : null}

            {/* CTA */}
            <Pressable
              onPress={() => void handleSignIn()}
              disabled={busy}
              style={({ pressed }) => [
                styles.cta,
                busy && styles.ctaBusy,
                pressed && !busy && styles.ctaPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0A0A0A" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Sign In</Text>
                  <Ionicons name="arrow-forward" size={15} color="#0A0A0A" />
                </>
              )}
            </Pressable>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Link href="/(auth)/sign-up" style={styles.footerLink}>
                Create one
              </Link>
            </View>
          </View>

          {/* ── Trust row ── */}
          <View style={styles.trust}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={12} color={WHITE_45} />
              <Text style={styles.trustText}>End-to-end encrypted</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Ionicons name="lock-closed-outline" size={12} color={WHITE_45} />
              <Text style={styles.trustText}>SOC 2 ready</Text>
            </View>
            <View style={styles.trustDot} />
            <View style={styles.trustItem}>
              <Ionicons name="cloud-done-outline" size={12} color={WHITE_45} />
              <Text style={styles.trustText}>99.9% uptime</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: BG },

  page: {
    flexGrow: 1,
    backgroundColor: BG,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 52,
  },

  // ── Brand mark ──
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 40,
    alignSelf: "center",
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.30)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logo: {
    width: 28,
    height: 28,
    resizeMode: "contain",
  },
  brandText: {
    gap: 2,
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    color: WHITE,
    letterSpacing: -0.2,
  },
  appSub: {
    fontSize: 11,
    fontWeight: "500",
    color: WHITE_45,
    letterSpacing: 0.2,
  },

  // ── Card ──
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 28,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  cardHeader: {
    marginBottom: 22,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: WHITE,
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  cardSub: {
    fontSize: 13,
    fontWeight: "400",
    color: WHITE_45,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 22,
  },

  // ── Fields ──
  field: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: WHITE_80,
    marginBottom: 7,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 13,
    minHeight: 48,
  },
  inputFocus: {
    borderColor: BORDER_FOCUS,
    shadowColor: GOLD,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: WHITE,
    paddingVertical: 0,
  },
  eyeBtn: {
    paddingLeft: 10,
    paddingVertical: 4,
  },

  // ── Forgot ──
  forgotText: {
    fontSize: 12,
    fontWeight: "600",
    color: GOLD,
  },

  // ── Alerts ──
  alert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  alertError: {
    backgroundColor: DANGER_BG,
    borderColor: DANGER_BR,
  },
  alertSuccess: {
    backgroundColor: SUCCESS_BG,
    borderColor: SUCCESS_BR,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
  },

  // ── CTA ──
  cta: {
    height: 50,
    backgroundColor: GOLD,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: GOLD,
    shadowOpacity: 0.30,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    marginTop: 4,
  },
  ctaBusy: {
    opacity: 0.55,
    shadowOpacity: 0,
  },
  ctaPressed: {
    opacity: 0.90,
    transform: [{ scale: 0.985 }],
  },
  ctaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A0A0A",
    letterSpacing: 0.1,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "400",
    color: WHITE_45,
  },
  footerLink: {
    fontSize: 12,
    fontWeight: "700",
    color: GOLD,
  },

  // ── Trust row ──
  trust: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 28,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trustText: {
    fontSize: 11,
    fontWeight: "400",
    color: WHITE_45,
  },
  trustDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: WHITE_20,
  },
});
