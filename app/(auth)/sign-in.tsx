import { useMemo, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import AlertBox from "../../src/components/AlertBox";
import FormField from "../../src/components/FormField";
import PrimaryButton from "../../src/components/PrimaryButton";
import { getUserOrgId, setupNewAccount, signInWithEmail } from "../../src/lib/auth";
import { getMobilePortalHomeForRole } from "../../src/lib/portals";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

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
    if (authError) throw new Error(authError.message);
    const user = authData.user;
    if (!user) throw new Error("Sign-in succeeded, but no active user was found.");

    if (redirectTo && typeof window !== "undefined") {
      window.location.href = redirectTo;
      return;
    }

    let orgId = await getUserOrgId(user.id);

    // No org yet - happens when email confirmation was required at sign-up.
    // Auto-create the org + profile using the metadata saved during sign-up.
    if (!orgId) {
      const meta = (user.user_metadata ?? {}) as Record<string, string>;
      const companyName = meta.company_name?.trim();

      if (companyName) {
        const setup = await setupNewAccount({
          orgName: companyName,
          fullName: meta.full_name ?? "",
          email: user.email ?? "",
          phone: meta.phone ?? undefined,
          jobTitle: meta.job_title ?? "Owner",
        });
        if (setup.ok) orgId = setup.orgId;
      }
    }

    if (Platform.OS !== "web") {
      if (!orgId) {
        const clientUserRes = await supabase
          .from("client_users")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (clientUserRes.data) {
          router.replace(getMobilePortalHomeForRole("client") as any);
          return;
        }
      }

      const { data: member } = orgId
        ? await supabase
            .from("org_members")
            .select("role")
            .eq("org_id", orgId)
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null };

      router.replace(getMobilePortalHomeForRole(String(member?.role ?? "viewer")) as any);
      return;
    }

    router.replace("/(app)/dashboard");
  }

  async function handleSignIn() {
    setErr(null);
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErr("Enter your email.");
      return;
    }

    if (!password) {
      setErr("Enter your password.");
      return;
    }

    try {
      setLoading(true);
      const result = await signInWithEmail(cleanEmail, password);
      if (!result.ok) throw new Error(result.error);
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
      if (error) throw new Error(error.message);
      setMsg("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      setErr(error?.message ?? "Failed to send password reset email.");
    } finally {
      setResetting(false);
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
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to your workspace</Text>
          <View style={styles.headingRule} />

          <FormField label="Email">
            <TextInput
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (err) setErr(null);
                if (msg) setMsg(null);
              }}
              placeholder="you@company.com"
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.input}
            />
          </FormField>

          <FormField
            label="Password"
            rightLabel={
              <Pressable
                onPress={handleForgotPassword}
                disabled={resetting || loading}
                style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
              >
                <Text style={styles.forgotLink}>
                  {resetting ? "Sending..." : "Forgot password?"}
                </Text>
              </Pressable>
            }
          >
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (err) setErr(null);
              }}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
              onSubmitEditing={() => {
                if (!loading && !resetting) void handleSignIn();
              }}
            />
          </FormField>

          {err ? <View style={styles.alertWrap}><AlertBox type="error" message={err} /></View> : null}
          {msg ? <View style={styles.alertWrap}><AlertBox type="success" message={msg} /></View> : null}

          <View style={styles.btnWrap}>
            <PrimaryButton
              title="Sign In"
              loadingTitle="Signing in..."
              onPress={() => void handleSignIn()}
              loading={loading}
              disabled={resetting}
            />
          </View>

          <View style={styles.footerRow}>
            <Link href="/(auth)/sign-up" style={styles.footerLink}>
              Create an account
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
  forgotLink: {
    color: theme.colors.goldDark,
    fontSize: 13,
    fontWeight: "700",
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
  footerText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  footerLink: {
    color: theme.colors.goldDark,
    fontSize: 14,
    fontWeight: "800",
  },
});
