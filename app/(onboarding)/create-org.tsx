// app/(onboarding)/create-org.tsx
import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import GoldButton from "../../src/components/GoldButton";
import { createOrganizationForCurrentUser } from "../../src/lib/auth";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

export default function CreateOrg() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <Screen>
      <View style={ui.authContainer}>
        <View style={styles.hero}>
          <Text style={styles.brand}>GSD Grid</Text>
          <Text style={styles.kicker}>Set up your workspace</Text>
        </View>

        <View style={ui.heroCard}>
          <Text style={ui.h1}>Create your organization</Text>
          <Text style={ui.sub}>You’ll be the owner. Add your company now and invite your team next.</Text>

          <View style={ui.section}>
            <Text style={ui.label}>Organization name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="GSD Contracting"
              placeholderTextColor={theme.colors.muted}
              style={ui.input}
            />
          </View>

          {err ? (
            <View style={styles.errorBox}>
              <Text style={ui.errorText}>{err}</Text>
            </View>
          ) : null}

          <GoldButton
            label={loading ? "Creating..." : "Create Organization"}
            onPress={async () => {
              setErr(null);
              setLoading(true);
              const res = await createOrganizationForCurrentUser(name.trim());
              setLoading(false);
              if (res.ok) router.replace("/(app)/dashboard");
              else setErr(res.error);
            }}
            style={{ marginTop: 18 }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: 14,
    paddingHorizontal: 6,
  },

  brand: {
    fontSize: 30,
    fontWeight: "900",
    color: theme.colors.ink,
  },

  kicker: {
    marginTop: 4,
    color: theme.colors.goldDark,
    fontSize: 13,
    fontWeight: "800",
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
});