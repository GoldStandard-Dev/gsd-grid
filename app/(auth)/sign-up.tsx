import { useState } from "react";
import { Link, useRouter } from "expo-router";
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
import { supabase } from "../../src/lib/supabase";

// ─── Palette ────────────────────────────────────────────────
const BG          = "#080808";
const SURFACE     = "#111111";
const SURFACE2    = "#191919";
const SURFACE3    = "#1C1C1C";
const BORDER      = "#222222";
const BORDER_FOCUS = "rgba(212,175,55,0.60)";
const GOLD        = "#D4AF37";
const GOLD_DARK   = "#B8962E";
const WHITE       = "#FFFFFF";
const WHITE_80    = "rgba(255,255,255,0.80)";
const WHITE_45    = "rgba(255,255,255,0.45)";
const WHITE_20    = "rgba(255,255,255,0.20)";
const DANGER      = "#F87171";
const DANGER_BG   = "rgba(239,68,68,0.10)";
const DANGER_BR   = "rgba(239,68,68,0.22)";
const SUCCESS     = "#4ADE80";
const SUCCESS_BG  = "rgba(74,222,128,0.08)";
const SUCCESS_BR  = "rgba(74,222,128,0.22)";

// ─── Helpers ─────────────────────────────────────────────────
function formatPhoneInput(value: string) {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getStrength(p: string): { score: number; label: string; color: string } {
  if (p.length === 0) return { score: 0, label: "", color: BORDER };
  let score = 0;
  if (p.length >= 8)            score++;
  if (p.length >= 12)           score++;
  if (/[A-Z]/.test(p))          score++;
  if (/[0-9]/.test(p))          score++;
  if (/[^A-Za-z0-9]/.test(p))   score++;

  if (score <= 1) return { score: 1, label: "Weak",   color: "#F87171" };
  if (score <= 2) return { score: 2, label: "Fair",   color: "#FBBF24" };
  if (score <= 3) return { score: 3, label: "Good",   color: "#34D399" };
  return              { score: 4, label: "Strong", color: "#4ADE80"  };
}

// ─── Step indicator ──────────────────────────────────────────
const STEPS = [
  { label: "Account",      icon: "person-outline"    as const },
  { label: "Organization", icon: "business-outline"  as const },
  { label: "Dashboard",    icon: "grid-outline"      as const },
];

function StepIndicator({ active }: { active: number }) {
  return (
    <View style={si.row}>
      {STEPS.map((step, i) => {
        const done    = i < active;
        const current = i === active;
        return (
          <View key={step.label} style={si.item}>
            {/* connector before */}
            {i > 0 && (
              <View style={[si.connector, done && si.connectorDone]} />
            )}
            {/* dot */}
            <View style={[
              si.dot,
              current && si.dotCurrent,
              done    && si.dotDone,
            ]}>
              {done
                ? <Ionicons name="checkmark" size={9}  color="#0A0A0A" />
                : <Text style={[si.dotNum, current && si.dotNumCurrent]}>{i + 1}</Text>
              }
            </View>
            {/* label */}
            <Text style={[si.label, current && si.labelCurrent, done && si.labelDone]}>
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
    gap: 0,
  },
  item: {
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    flex: 1,
    gap: 6,
  },
  connector: {
    position: "absolute",
    top: 13,
    left: "-50%",
    right: "50%",
    height: 1,
    backgroundColor: BORDER,
    zIndex: 0,
  },
  connectorDone: { backgroundColor: GOLD },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SURFACE2,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dotCurrent: {
    borderColor: GOLD,
    backgroundColor: "rgba(212,175,55,0.12)",
  },
  dotDone: {
    backgroundColor: GOLD,
    borderColor: GOLD_DARK,
  },
  dotNum: {
    fontSize: 10,
    fontWeight: "700",
    color: WHITE_45,
  },
  dotNumCurrent: {
    color: GOLD,
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: WHITE_45,
    textAlign: "center",
  },
  labelCurrent: { color: WHITE, fontWeight: "700" },
  labelDone:    { color: GOLD,  fontWeight: "600" },
});

// ─── Field component ─────────────────────────────────────────
type FieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: "default" | "email-address" | "phone-pad";
  secure?: boolean;
  showSecure?: boolean;
  onToggleSecure?: () => void;
  autoCapitalize?: "none" | "words" | "sentences";
  hint?: string;
  optional?: boolean;
  onSubmit?: () => void;
  returnKey?: "next" | "go" | "done";
};

function Field({
  label, icon, value, onChange, placeholder,
  keyboard, secure, showSecure, onToggleSecure,
  autoCapitalize, hint, optional, onSubmit, returnKey,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={f.group}>
      <View style={f.labelRow}>
        <Text style={f.label}>{label}</Text>
        {optional && <Text style={f.optional}>Optional</Text>}
      </View>
      <View style={[f.wrap, focused && f.wrapFocus]}>
        <Ionicons
          name={icon}
          size={15}
          color={focused ? GOLD : WHITE_20}
          style={f.icon}
        />
        <TextInput
          style={[f.input, secure && { flex: 1 }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={WHITE_20}
          keyboardType={keyboard ?? "default"}
          secureTextEntry={secure && !showSecure}
          autoCapitalize={autoCapitalize ?? "sentences"}
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          returnKeyType={returnKey ?? "next"}
        />
        {secure && onToggleSecure && (
          <Pressable onPress={onToggleSecure} style={f.eyeBtn} hitSlop={8}>
            <Ionicons
              name={showSecure ? "eye-off-outline" : "eye-outline"}
              size={16}
              color={WHITE_20}
            />
          </Pressable>
        )}
      </View>
      {hint ? <Text style={f.hint}>{hint}</Text> : null}
    </View>
  );
}

const f = StyleSheet.create({
  group: { marginBottom: 14 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  label: { fontSize: 12, fontWeight: "600", color: WHITE_80 },
  optional: { fontSize: 11, fontWeight: "400", color: WHITE_45 },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 13,
    minHeight: 48,
  },
  wrapFocus: {
    borderColor: BORDER_FOCUS,
    shadowColor: GOLD,
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, fontWeight: "500", color: WHITE, paddingVertical: 0 },
  eyeBtn: { paddingLeft: 10, paddingVertical: 4 },
  hint: { marginTop: 5, fontSize: 11, fontWeight: "400", color: WHITE_45, lineHeight: 16 },
});

// ─── Main component ──────────────────────────────────────────
export default function SignUp() {
  const router = useRouter();

  const [fullName,    setFullName]    = useState("");
  const [jobTitle,    setJobTitle]    = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone,       setPhone]       = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [msg,         setMsg]         = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  const strength = getStrength(password);

  function clear() { setErr(null); setMsg(null); }

  async function handleCreate() {
    clear();

    const cleanName    = fullName.trim();
    const cleanCompany = companyName.trim();
    const cleanEmail   = email.trim().toLowerCase();
    const cleanTitle   = jobTitle.trim() || "Owner";
    const phoneDigits  = phone.replace(/\D/g, "");

    if (!cleanName)              { setErr("Enter your full name."); return; }
    if (!cleanCompany)           { setErr("Enter your company name."); return; }
    if (!cleanEmail)             { setErr("Enter your email address."); return; }
    if (password.length < 8)     { setErr("Password must be at least 8 characters."); return; }
    if (phone && phoneDigits.length < 10) {
      setErr("Enter a complete 10-digit phone number.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name:    cleanName,
            company_name: cleanCompany,
            phone:        phoneDigits || null,
            job_title:    cleanTitle,
          },
        },
      });

      if (error) throw new Error(error.message);

      const userId    = data.user?.id;
      const hasSession = !!data.session;

      if (!userId) throw new Error("Account created but no user ID was returned.");

      if (!hasSession) {
        setMsg("Account created! Check your email to confirm, then sign in.");
        return;
      }

      // Upsert profile using correct PK `id`
      await supabase.from("profiles").upsert({
        id:         userId,
        full_name:  cleanName,
        first_name: cleanName.split(" ")[0] ?? "",
        last_name:  cleanName.split(" ").slice(1).join(" ") || null,
        phone:      phoneDigits || null,
      }, { onConflict: "id" });

      router.replace("/(onboarding)/create-org");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

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

            {/* Step progress */}
            <StepIndicator active={0} />

            {/* Card header */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Create your account</Text>
              <Text style={styles.cardSub}>
                Set up your owner profile — you'll configure your organization next.
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Section: Your details */}
            <Text style={styles.sectionLabel}>Your details</Text>

            <Field
              label="Full name"
              icon="person-outline"
              value={fullName}
              onChange={(v) => { setFullName(v); clear(); }}
              placeholder="Tyler Harrington"
              autoCapitalize="words"
            />

            <Field
              label="Job title"
              icon="briefcase-outline"
              value={jobTitle}
              onChange={(v) => { setJobTitle(v); clear(); }}
              placeholder="Owner"
              autoCapitalize="words"
              optional
            />

            {/* Section: Your company */}
            <Text style={[styles.sectionLabel, { marginTop: 6 }]}>Your company</Text>

            <Field
              label="Company name"
              icon="business-outline"
              value={companyName}
              onChange={(v) => { setCompanyName(v); clear(); }}
              placeholder="Acme Contracting LLC"
              autoCapitalize="words"
            />

            {/* Section: Contact & credentials */}
            <Text style={[styles.sectionLabel, { marginTop: 6 }]}>Contact & credentials</Text>

            <Field
              label="Email address"
              icon="mail-outline"
              value={email}
              onChange={(v) => { setEmail(v); clear(); }}
              placeholder="you@company.com"
              keyboard="email-address"
              autoCapitalize="none"
            />

            <Field
              label="Phone number"
              icon="call-outline"
              value={phone}
              onChange={(v) => { setPhone(formatPhoneInput(v)); clear(); }}
              placeholder="(704) 555-0199"
              keyboard="phone-pad"
              optional
            />

            {/* Password with strength */}
            <View style={f.group}>
              <Text style={f.label}>Password</Text>
              <Field
                label=""
                icon="lock-closed-outline"
                value={password}
                onChange={(v) => { setPassword(v); clear(); }}
                placeholder="Minimum 8 characters"
                secure
                showSecure={showPass}
                onToggleSecure={() => setShowPass((s) => !s)}
                autoCapitalize="none"
                hint={undefined}
              />
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  {[1, 2, 3, 4].map((seg) => (
                    <View
                      key={seg}
                      style={[
                        styles.strengthSeg,
                        { backgroundColor: strength.score >= seg ? strength.color : BORDER },
                      ]}
                    />
                  ))}
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>
                    {strength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Alerts */}
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
              onPress={() => void handleCreate()}
              disabled={loading}
              style={({ pressed }) => [
                styles.cta,
                loading && styles.ctaBusy,
                pressed && !loading && styles.ctaPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0A0A0A" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Create Account</Text>
                  <Ionicons name="arrow-forward" size={15} color="#0A0A0A" />
                </>
              )}
            </Pressable>

            {/* Legal note */}
            <Text style={styles.legal}>
              By creating an account you agree to our{" "}
              <Text style={styles.legalLink}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={styles.legalLink}>Privacy Policy</Text>.
            </Text>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/(auth)/sign-in" style={styles.footerLink}>Sign in</Link>
            </View>
          </View>

          {/* ── Secure badge ── */}
          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark-outline" size={13} color={WHITE_45} />
            <Text style={styles.secureText}>
              Your data is encrypted and never shared with third parties.
            </Text>
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
    paddingTop: 64,
    paddingBottom: 52,
  },

  // ── Brand ──
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 36,
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
  logo: { width: 28, height: 28, resizeMode: "contain" },
  brandText: { gap: 2 },
  appName: { fontSize: 20, fontWeight: "800", color: WHITE, letterSpacing: -0.2 },
  appSub: { fontSize: 11, fontWeight: "500", color: WHITE_45, letterSpacing: 0.2 },

  // ── Card ──
  card: {
    width: "100%",
    maxWidth: 480,
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
  cardHeader: { marginBottom: 22 },
  cardTitle: {
    fontSize: 21,
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
  divider: { height: 1, backgroundColor: BORDER, marginBottom: 20 },

  // ── Section labels ──
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: WHITE_45,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // ── Password strength ──
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  strengthSeg: { flex: 1, height: 2.5, borderRadius: 2 },
  strengthLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    minWidth: 44,
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
  alertError:   { backgroundColor: DANGER_BG,  borderColor: DANGER_BR  },
  alertSuccess: { backgroundColor: SUCCESS_BG, borderColor: SUCCESS_BR },
  alertText: { flex: 1, fontSize: 12, fontWeight: "500", lineHeight: 17 },

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
  ctaBusy:    { opacity: 0.55, shadowOpacity: 0 },
  ctaPressed: { opacity: 0.90, transform: [{ scale: 0.985 }] },
  ctaText: { fontSize: 14, fontWeight: "700", color: "#0A0A0A", letterSpacing: 0.1 },

  // ── Legal ──
  legal: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: "400",
    color: WHITE_45,
    textAlign: "center",
    lineHeight: 16,
  },
  legalLink: { color: GOLD, fontWeight: "600" },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 16,
  },
  footerText: { fontSize: 12, fontWeight: "400", color: WHITE_45 },
  footerLink: { fontSize: 12, fontWeight: "700", color: GOLD },

  // ── Secure badge ──
  secureBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 24,
    paddingHorizontal: 12,
  },
  secureText: {
    fontSize: 11,
    fontWeight: "400",
    color: WHITE_45,
    textAlign: "center",
    flex: 1,
    lineHeight: 15,
  },
});
