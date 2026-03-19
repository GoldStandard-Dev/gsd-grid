import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
const MUTED_2 = "#7b746b";
const DANGER = "#9f3b2f";
const DANGER_BG = "#fff3ef";
const DANGER_BORDER = "#efc8bc";
const SUCCESS = "#216a43";
const SUCCESS_BG = "#eefaf2";
const SUCCESS_BORDER = "#b9dfc8";

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

      const signUpRes = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanFullName,
            company_name: cleanCompanyName,
            phone: phoneDigits || null,
            job_title: cleanJobTitle,
            owner_profile_created: true,
          },
        },
      });

      if (signUpRes.error) {
        throw new Error(signUpRes.error.message);
      }

      const userId = signUpRes.data.user?.id;

      if (!userId) {
        throw new Error("Account created, but no user ID was returned.");
      }

      const hasSession = !!signUpRes.data.session;

      if (!hasSession) {
        setMsg("Account created. Check your email to confirm your account, then sign in.");
        return;
      }

      const profilePayload = {
        user_id: userId,
        full_name: cleanFullName,
        phone: phoneDigits || null,
        email: cleanEmail,
        job_title: cleanJobTitle,
        company_name: cleanCompanyName,
        notes: "Owner profile created during signup.",
      };

      const profileRes = await supabase.from("profiles").upsert(profilePayload, { onConflict: "user_id" });

      if (profileRes.error) {
        throw new Error(profileRes.error.message);
      }

      router.replace("/(onboarding)/create-org");
    } catch (error: any) {
      setErr(error?.message ?? "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Owner Setup</Text>
              <Text style={styles.heroTitle}>Create your account</Text>
              <Text style={styles.heroSubtitle}>
                Set up your owner profile first, then create your organization and start inviting your team.
              </Text>

              <View style={styles.heroPills}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Owner profile included</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Dashboard-matched UI</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroPanel}>
              <Image
                source={require("../../assets/brand/gsd-grid-icon.png")}
                style={styles.logo}
              />
              <Text style={styles.heroPanelLabel}>What happens next</Text>
              <Text style={styles.heroPanelValue}>Account → Org → Team</Text>
              <Text style={styles.heroPanelText}>
                After signup, you will create your organization and land in the main dashboard experience.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardEyebrow}>New Workspace</Text>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Set up your owner profile to get started.</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={(value) => {
                    setFullName(value);
                    if (err) setErr(null);
                  }}
                  placeholder="Tyler Harrington"
                  placeholderTextColor={MUTED_2}
                  style={styles.input}
                />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.label}>Job Title</Text>
                <TextInput
                  value={jobTitle}
                  onChangeText={(value) => {
                    setJobTitle(value);
                    if (err) setErr(null);
                  }}
                  placeholder="Owner"
                  placeholderTextColor={MUTED_2}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Company Name</Text>
              <TextInput
                value={companyName}
                onChangeText={(value) => {
                  setCompanyName(value);
                  if (err) setErr(null);
                }}
                placeholder="GSD Contracting"
                placeholderTextColor={MUTED_2}
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(formatPhoneInput(value));
                    if (err) setErr(null);
                  }}
                  placeholder="(704) 555-0199"
                  placeholderTextColor={MUTED_2}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>

              <View style={styles.halfField}>
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
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (err) setErr(null);
                }}
                placeholder="Minimum 8 characters"
                placeholderTextColor={MUTED_2}
                secureTextEntry
                style={styles.input}
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
                onPress={() => void handleCreateAccount()}
                disabled={loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  loading ? styles.primaryBtnDisabled : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={styles.primaryBtnText}>{loading ? "Creating account..." : "Create Account"}</Text>
              </Pressable>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/(auth)/sign-in" style={styles.footerLink}>
                Sign in
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
    width: 300,
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

  row: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },

  field: {
    marginBottom: 16,
  },

  halfField: {
    flex: 1,
    minWidth: 250,
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
    marginTop: 2,
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