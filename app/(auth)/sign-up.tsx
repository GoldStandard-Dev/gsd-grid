import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import AlertBox from "../../src/components/AlertBox";
import FormField from "../../src/components/FormField";
import PrimaryButton from "../../src/components/PrimaryButton";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

function formatPhoneInput(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getConfirmationRedirectUrl() {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  return `${window.location.origin}/sign-in?confirmed=success`;
}

export default function SignUp() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("Owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  function clearErr() {
    if (err) setErr(null);
  }

  async function handleCreateAccount() {
    setErr(null);
    setMsg(null);

    const cleanFullName = fullName.trim();
    const cleanCompanyName = companyName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanJobTitle = jobTitle.trim() || "Owner";

    if (!cleanFullName) {
      setErr("Enter your full name.");
      return;
    }
    if (!cleanCompanyName) {
      setErr("Enter your company name.");
      return;
    }
    if (!cleanEmail) {
      setErr("Enter your email.");
      return;
    }
    if (password.trim().length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    const phoneDigits = cleanPhone.replace(/\D/g, "");
    if (cleanPhone && phoneDigits.length < 10) {
      setErr("Enter a full 10-digit phone number.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke("create-account", {
        body: {
          email: cleanEmail,
          password,
          full_name: cleanFullName,
          company_name: cleanCompanyName,
          phone: phoneDigits || null,
          job_title: cleanJobTitle,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(String(data.error));
      if (!data?.user_id || !data?.org_id) {
        throw new Error("Account created, but the owner workspace was not returned.");
      }

      // Session present (e.g. email confirmation disabled) — go straight to dashboard
      router.replace(`/(auth)/sign-in?signup=created&email=${encodeURIComponent(cleanEmail)}` as any);
    } catch (error: any) {
      setErr(error?.message ?? "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    const cleanEmail = (pendingEmail || email).trim().toLowerCase();

    if (!cleanEmail) {
      setErr("Enter the email address you used to create the account.");
      return;
    }

    setErr(null);
    setMsg(null);
    setResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: {
          emailRedirectTo: getConfirmationRedirectUrl(),
        },
      });

      if (error) throw new Error(error.message);

      setPendingEmail(cleanEmail);
      setMsg(`Confirmation email sent to ${cleanEmail}. Check spam or junk if it does not show up.`);
    } catch (error: any) {
      setErr(error?.message ?? "Could not resend confirmation email.");
    } finally {
      setResending(false);
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
          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>Set up your workspace in one quick step.</Text>
          <View style={styles.headingRule} />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <FormField label="Full Name">
                <TextInput
                  value={fullName}
                  onChangeText={(value) => {
                    setFullName(value);
                    clearErr();
                  }}
                  placeholder="Full name"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </FormField>
            </View>
            <View style={styles.halfField}>
              <FormField label="Job Title">
                <TextInput
                  value={jobTitle}
                  onChangeText={(value) => {
                    setJobTitle(value);
                    clearErr();
                  }}
                  placeholder="Owner"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
              </FormField>
            </View>
          </View>

          <FormField label="Company Name">
            <TextInput
              value={companyName}
              onChangeText={(value) => {
                setCompanyName(value);
                clearErr();
              }}
              placeholder="GSD Contracting"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
            />
          </FormField>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <FormField label="Phone">
                <TextInput
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(formatPhoneInput(value));
                    clearErr();
                  }}
                  placeholder="(704) 555-0199"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </FormField>
            </View>
            <View style={styles.halfField}>
              <FormField label="Email">
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    clearErr();
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
            </View>
          </View>

          <FormField label="Password">
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                clearErr();
              }}
              placeholder="Minimum 8 characters"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </FormField>

          {err ? (
            <View style={styles.alertWrap}>
              <AlertBox type="error" message={err} />
            </View>
          ) : null}
          {msg ? (
            <View style={styles.alertWrap}>
              <AlertBox type="success" message={msg} />
            </View>
          ) : null}

          {pendingEmail ? (
            <Pressable
              onPress={() => void handleResendConfirmation()}
              disabled={resending || loading}
              style={({ pressed }) => [
                styles.resendButton,
                pressed && !resending && !loading ? styles.resendButtonPressed : null,
              ]}
            >
              <Text style={styles.resendButtonText}>
                {resending ? "Sending confirmation..." : "Resend confirmation email"}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.btnWrap}>
            <PrimaryButton
              title="Create Account"
              loadingTitle="Creating account..."
              onPress={() => void handleCreateAccount()}
              loading={loading}
            />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/sign-in" style={styles.footerLink}>
              Sign in
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
  row: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  halfField: {
    flex: 1,
    minWidth: 168,
  },
  input: {
    ...ui.input,
    minHeight: 48,
  },
  alertWrap: {
    marginBottom: 12,
  },
  resendButton: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  resendButtonPressed: {
    backgroundColor: theme.colors.primaryLight,
  },
  resendButtonText: {
    color: theme.colors.primaryHover,
    fontSize: 13,
    fontWeight: "900",
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
