// app/(auth)/sign-in.tsx
import { useState } from "react";
import { Link, useRouter } from "expo-router";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import GoldButton from "../../src/components/GoldButton";
import { signInWithEmail } from "../../src/lib/auth";
import { theme } from "../../src/theme/theme";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.card}>
          <View style={styles.brandWrap}>
            <Image
              source={require("../../assets/brand/gsd-grid-icon.png")}
              style={styles.logo}
            />
            <Text style={styles.brand}>GSD Grid</Text>
            <Text style={styles.kicker}>Gold Standard Workflow</Text>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Access your account</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {err ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{err}</Text>
            </View>
          ) : null}

          <GoldButton
            label={loading ? "Signing in..." : "Sign In"}
            onPress={async () => {
              setErr(null);
              setLoading(true);
              const res = await signInWithEmail(email.trim(), password);
              setLoading(false);

              if (res.ok) router.replace("/");
              else setErr(res.error);
            }}
            style={styles.button}
          />

          <Text style={styles.linkRow}>
            No account?{" "}
            <Link href="/(auth)/sign-up" style={styles.link}>
              Create one
            </Link>
          </Text>
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
    padding: 24,
  },

  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E8DFC7",
    padding: 28,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  brandWrap: {
    alignItems: "center",
    marginBottom: 24,
  },

  logo: {
    width: 64,
    height: 64,
    resizeMode: "contain",
    marginBottom: 10,
  },

  brand: {
    fontSize: 34,
    fontWeight: "900",
    color: "#111111",
  },

  kicker: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
    color: "#B8962E",
  },

  header: {
    marginBottom: 18,
    alignItems: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#111111",
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
    color: "#6B6B6B",
  },

  field: {
    marginTop: 14,
  },

  label: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "900",
    color: "#8B7A60",
    letterSpacing: 0.2,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#E8DFC7",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "700",
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },

  errorBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#F1C5C1",
    backgroundColor: "#FFF5F4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },

  button: {
    marginTop: 20,
  },

  linkRow: {
    marginTop: 16,
    textAlign: "center",
    color: "#6B6B6B",
    fontSize: 13,
    fontWeight: "700",
  },

  link: {
    color: "#B8962E",
    fontWeight: "900",
  },
});