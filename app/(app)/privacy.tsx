import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppPage, ContentCard, PageHeader, SummaryCard, SummaryStrip } from "../../src/components/AppPage";
import { theme } from "../../src/theme/theme";

const SUPPORT_EMAIL = "goldstandarddigital@outlook.com";

function mailto(subject: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

function PolicySection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={16} color={theme.colors.primaryHover} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Effective April 17, 2026"
        actions={[
          {
            label: "Back",
            onPress: () => router.back(),
          },
          {
            label: "Email Support",
            primary: true,
            onPress: () => void Linking.openURL(mailto("GSD Grid privacy")),
          },
        ]}
      />

      <SummaryStrip>
        <SummaryCard label="Document" value="Privacy" meta="How data is handled" accent="violet" />
        <SummaryCard label="Covers" value="App Data" meta="Accounts, work orders, invoices" accent="indigo" />
        <SummaryCard label="Requests" value="Support" meta="Access, updates, deletion" accent="lavender" />
      </SummaryStrip>

      <ContentCard title="Privacy Overview" subtitle="How Gold Standard Digital handles user and business data inside GSD Grid.">
        <View style={styles.stack}>
          <PolicySection icon="person-outline" title="Information We Collect">
            We may collect account details such as your name and email, business records such as clients, invoices, and work orders, and usage data related to how the app is used.
          </PolicySection>
          <PolicySection icon="cog-outline" title="How We Use Data">
            Data is used to operate the app, improve the product experience, process transactions, and respond to support requests.
          </PolicySection>
          <PolicySection icon="server-outline" title="Data Storage">
            Data is stored using third-party infrastructure and services required to run the platform, including Supabase.
          </PolicySection>
          <PolicySection icon="share-outline" title="Data Sharing">
            We do not sell your data. Data may be shared only when necessary to operate, secure, or maintain the service.
          </PolicySection>
          <PolicySection icon="shield-checkmark-outline" title="Security">
            We take reasonable steps to protect data, but no platform can guarantee absolute security.
          </PolicySection>
          <PolicySection icon="document-text-outline" title="Your Rights">
            You may request access to your data, ask for corrections, or request deletion, subject to operational and legal requirements.
          </PolicySection>
        </View>
      </ContentCard>

      <Pressable
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={({ pressed }) => [styles.contactBox, pressed ? styles.pressed : null]}
      >
        <Text style={styles.contactLabel}>Privacy Requests</Text>
        <Text style={styles.contactValue}>{SUPPORT_EMAIL}</Text>
      </Pressable>
    </AppPage>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  sectionBody: {
    marginTop: 8,
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  contactBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
    padding: 14,
  },
  contactLabel: {
    color: theme.colors.primaryHover,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  contactValue: {
    marginTop: 4,
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.9,
  },
});