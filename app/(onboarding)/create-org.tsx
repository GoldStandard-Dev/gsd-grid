import { useEffect, useState } from "react";
import { useRootNavigationState, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Screen from "../../src/components/Screen";
import AlertBox from "../../src/components/AlertBox";
import FormField from "../../src/components/FormField";
import PrimaryButton from "../../src/components/PrimaryButton";
import { createOrganizationForCurrentUser, getUserOrgId } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { theme } from "../../src/theme/theme";
import { ui } from "../../src/theme/ui";

export default function CreateOrg() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!rootNavigationState?.key) return;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace("/(auth)/sign-in");
        return;
      }
      // Org is now created during sign-up - always redirect to dashboard
      router.replace("/(app)/dashboard");
    })();
  }, [rootNavigationState?.key, router]);

  async function handleCreateOrg() {
    if (loading) return;
    setErr(null);
    const cleanName = name.trim();
    if (!cleanName) { setErr("Enter your organization name."); return; }
    try {
      setLoading(true);
      const res = await createOrganizationForCurrentUser(cleanName);
      if (res.ok) { router.replace("/(app)/dashboard"); return; }
      if (res.error?.toLowerCase().includes("duplicate")) { router.replace("/(app)/dashboard"); return; }
      setErr(res.error);
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.wrap}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text style={[ui.eyebrow, { color: theme.colors.gold, marginBottom: 10 }]}>Workspace Setup</Text>
              <Text style={styles.heroTitle}>Create your organization</Text>
              <Text style={styles.heroSubtitle}>
                You will be added as the owner. This becomes the main workspace for your dashboard,
                team, pricing, work orders, and invoices.
              </Text>
            </View>

            <View style={styles.heroPanel}>
              <Text style={[ui.eyebrow, { color: theme.colors.gold, marginBottom: 8 }]}>Next step</Text>
              <Text style={styles.heroPanelValue}>Dashboard unlock</Text>
              <Text style={styles.heroPanelText}>
                Once your organization is created, the app routes directly into the main dashboard.
              </Text>
            </View>
          </View>

          {/* Form card */}
          <View style={styles.card}>
            <Text style={[ui.eyebrow, { color: theme.colors.goldDark, marginBottom: 4 }]}>Organization</Text>
            <Text style={styles.title}>Set up your workspace</Text>
            <Text style={styles.subtitle}>Create your company and continue into the dashboard.</Text>

            <View style={ui.divider} />

            <View style={{ marginTop: 18 }}>
              <FormField label="Organization name">
                <TextInput
                  value={name}
                  onChangeText={(v) => { setName(v); if (err) setErr(null); }}
                  placeholder="GSD Contracting"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  onSubmitEditing={() => { if (!loading) void handleCreateOrg(); }}
                />
              </FormField>

              {err ? <AlertBox type="error" message={err} /> : null}

              <View style={{ marginTop: 18 }}>
                <PrimaryButton
                  title="Create Organization"
                  loadingTitle="Creating organization..."
                  onPress={() => void handleCreateOrg()}
                  loading={loading}
                />
              </View>
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
    ...ui.heroDark,
  },
  heroCopy: {
    flex: 1,
    minWidth: 280,
    justifyContent: "center",
  },
  heroTitle: {
    ...ui.heroDarkTitle,
  },
  heroSubtitle: {
    ...ui.heroDarkSubtitle,
    maxWidth: 640,
  },
  heroPanel: {
    width: 300,
    ...ui.heroDarkPanel,
  },
  heroPanelValue: {
    ...ui.heroDarkPanelValue,
  },
  heroPanelText: {
    ...ui.heroDarkPanelText,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 22,
    ...theme.shadow.card,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    marginBottom: 16,
  },
  input: {
    ...ui.inputSoft,
  },
});
