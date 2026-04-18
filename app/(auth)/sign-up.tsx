import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import AlertBox from "../../src/components/AlertBox";
import FormField from "../../src/components/FormField";
import PrimaryButton from "../../src/components/PrimaryButton";
import { supabase } from "../../src/lib/supabase";
import { setupNewAccount } from "../../src/lib/auth";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

function formatPhoneInput(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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

      // Step 1 - create auth user
      const signUpRes = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
            company_name: cleanCompanyName,
            phone: phoneDigits || null,
            job_title: cleanJobTitle,
          },
        },
      });

      if (signUpRes.error) throw new Error(signUpRes.error.message);
      if (!signUpRes.data.user?.id) throw new Error("Account created but no user ID returned.");

      // Email confirmation required - no session yet
      if (!signUpRes.data.session) {
        setMsg("Account created! Check your email to confirm, then sign in.");
        return;
      }

      // Step 2 - create org + profile in one shot, go straight to dashboard
      const setup = await setupNewAccount({
        orgName: cleanCompanyName,
        fullName: cleanFullName,
        email: cleanEmail,
        phone: phoneDigits || undefined,
        jobTitle: cleanJobTitle,
      });

      if (!setup.ok) throw new Error(setup.error);

      router.replace("/(app)/dashboard");
    } catch (error: any) {
      setErr(error?.message ?? "Failed to create account.");
    } finally {
      setLoading(false);
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
