import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AlertBox from "../../src/components/AlertBox";
import FormField from "../../src/components/FormField";
import PrimaryButton from "../../src/components/PrimaryButton";
import Screen from "../../src/components/Screen";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

function getRecoveryUrlParts() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { code: "", accessToken: "", refreshToken: "" };
  }

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return {
    code: search.get("code") ?? hash.get("code") ?? "",
    accessToken: hash.get("access_token") ?? search.get("access_token") ?? "",
    refreshToken: hash.get("refresh_token") ?? search.get("refresh_token") ?? "",
  };
}

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function prepareRecoverySession() {
      setErr(null);

      try {
        const { code, accessToken, refreshToken } = getRecoveryUrlParts();

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error(error.message);
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw new Error(error.message);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw new Error(error.message);

        if (!mounted) return;
        setHasRecoverySession(!!data.session);
        if (!data.session) {
          setErr("This reset link is invalid or expired. Request a new reset email from the sign-in page.");
        }
      } catch (error: any) {
        if (!mounted) return;
        setHasRecoverySession(false);
        setErr(error?.message ?? "Could not verify the password reset link.");
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
        setErr(null);
      }
    });

    void prepareRecoverySession();

    return () => {
      mounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  function clearMessages() {
    if (err) setErr(null);
    if (msg) setMsg(null);
  }

  async function handleResetPassword() {
    setErr(null);
    setMsg(null);

    if (!hasRecoverySession) {
      setErr("Open the reset link from your email before choosing a new password.");
      return;
    }

    if (password.trim().length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);

      setMsg("Password updated.");
      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in?reset=success");
    } catch (error: any) {
      setErr(error?.message ?? "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.logoWrap}>
            <Image source={require("../../assets/brand/gsd-grid-icon.png")} style={styles.logoImg} />
          </View>

          <Text style={styles.logoWordmark}>GSD Grid</Text>
          <Text style={styles.heading}>Reset password</Text>
          <Text style={styles.subheading}>Choose a new password for your account.</Text>
          <View style={styles.headingRule} />

          <FormField label="New Password">
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearMessages();
              }}
              placeholder="Minimum 8 characters"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </FormField>

          <FormField label="Confirm Password">
            <TextInput
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                clearMessages();
              }}
              placeholder="Re-enter new password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
              onSubmitEditing={() => {
                if (!saving && !checkingSession) void handleResetPassword();
              }}
            />
          </FormField>

          {err ? <View style={styles.alertWrap}><AlertBox type="error" message={err} /></View> : null}
          {msg ? <View style={styles.alertWrap}><AlertBox type="success" message={msg} /></View> : null}

          <View style={styles.btnWrap}>
            <PrimaryButton
              title={checkingSession ? "Checking reset link..." : "Update Password"}
              loadingTitle="Updating password..."
              onPress={() => void handleResetPassword()}
              loading={saving}
              disabled={checkingSession || !hasRecoverySession}
            />
          </View>

          <View style={styles.footerRow}>
            <Link href="/(auth)/sign-in" style={styles.footerLink}>
              Back to sign in
            </Link>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: theme.colors.bg,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 28,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  logoImg: {
    width: 32,
    height: 32,
    resizeMode: "contain",
  },
  logoWordmark: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.colors.ink,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 24,
    letterSpacing: 0.2,
  },
  heading: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.colors.ink,
    letterSpacing: -0.2,
  },
  subheading: {
    marginTop: 6,
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: "500",
  },
  headingRule: {
    width: 48,
    height: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.gold,
    marginTop: 16,
    marginBottom: 24,
  },
  input: {
    ...ui.input,
    minHeight: 48,
  },
  alertWrap: {
    marginBottom: 12,
  },
  btnWrap: {
    marginTop: 8,
  },
  footerRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  footerLink: {
    color: theme.colors.goldDark,
    fontSize: 14,
    fontWeight: "800",
  },
});
