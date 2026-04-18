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

function LegalSection({
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

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.stack}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function TermsPage() {
  const router = useRouter();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="Effective April 17, 2026"
        actions={[
          {
            label: "Back",
            onPress: () => router.back(),
          },
          {
            label: "Email Support",
            primary: true,
            onPress: () => void Linking.openURL(mailto("GSD Grid terms")),
          },
        ]}
      />

      <SummaryStrip>
        <SummaryCard label="Document" value="Terms" meta="Service and usage rules" accent="violet" />
        <SummaryCard label="Applies To" value="All Users" meta="Platform access and billing" accent="indigo" />
        <SummaryCard label="Questions" value="Support" meta={SUPPORT_EMAIL} accent="lavender" />
      </SummaryStrip>

      <ContentCard title="Platform Terms" subtitle="Core rules for using GSD Grid.">
        <View style={styles.stack}>
          <LegalSection icon="checkmark-circle-outline" title="Use of Service">
            You agree to use the platform only for lawful business purposes. You may not misuse, disrupt, or attempt unauthorized access to the system.
          </LegalSection>
          <LegalSection icon="person-circle-outline" title="Accounts">
            You are responsible for maintaining the security of your account. Activity under your account remains your responsibility.
          </LegalSection>
          <LegalSection icon="card-outline" title="Payments">
            Subscription fees, if applicable, are billed in advance and are non-refundable unless otherwise stated.
          </LegalSection>
          <LegalSection icon="folder-open-outline" title="Data">
            You retain ownership of your data. By using the platform, you grant permission for storage and processing required to provide the service.
          </LegalSection>
          <LegalSection icon="close-circle-outline" title="Termination">
            Accounts that violate these terms may be suspended or terminated.
          </LegalSection>
          <LegalSection icon="warning-outline" title="Limitation of Liability">
            GSD Grid is provided as is, without warranties, and we are not liable for damages resulting from use of the platform.
          </LegalSection>
          <LegalSection icon="refresh-outline" title="Changes">
            These terms may be updated over time. Continued use of the platform means you accept the latest version.
          </LegalSection>
        </View>
      </ContentCard>

      <ContentCard title="Acceptable Use" subtitle="Actions that are not allowed in the platform.">
        <BulletList
          items={[
            "Use the platform for illegal activity",
            "Upload harmful, abusive, or fraudulent content",
            "Attempt to hack, disrupt, or overload the system",
            "Use the platform to spam or harass others",
            "Repeated misuse may result in suspension or termination",
          ]}
        />
      </ContentCard>

      <ContentCard title="Commercial Terms" subtitle="Default terms related to work orders and invoices.">
        <View style={styles.stack}>
          <LegalSection icon="receipt-outline" title="Invoice Terms">
            Payment is due according to the stated invoice terms. Late balances may be subject to additional fees, and deposits may be required before work begins.
          </LegalSection>
          <LegalSection icon="construct-outline" title="Work Order Terms">
            Services are performed according to the approved work order. Additional work outside the approved scope may result in added charges.
          </LegalSection>
          <LegalSection icon="thumbs-up-outline" title="Approval">
            Client approval confirms agreement to the listed scope, pricing, and related service terms.
          </LegalSection>
        </View>
      </ContentCard>

      <Pressable
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={({ pressed }) => [styles.contactBox, pressed ? styles.pressed : null]}
      >
        <Text style={styles.contactLabel}>Questions About Terms?</Text>
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
  bulletRow: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  bulletText: {
    flex: 1,
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
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