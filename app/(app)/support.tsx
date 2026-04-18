import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppPage, ContentCard, PageHeader, SummaryCard, SummaryStrip } from "../../src/components/AppPage";
import { theme } from "../../src/theme/theme";

const SUPPORT_EMAIL = "goldstandarddigital@outlook.com";

function mailto(subject: string, body?: string) {
  const params = new URLSearchParams({
    subject,
    ...(body ? { body } : {}),
  });

  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

function SupportRow({
  icon,
  title,
  body,
  onPress,
  chevron = true,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress?: () => void;
  chevron?: boolean;
  tone?: "default" | "accent";
}) {
  const content = (
    <>
      <View style={[styles.rowIcon, tone === "accent" ? styles.rowIconAccent : null]}>
        <Ionicons
          name={icon}
          size={18}
          color={tone === "accent" ? theme.colors.primaryHover : theme.colors.primary}
        />
      </View>

      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>

      {chevron ? <Ionicons name="chevron-forward" size={17} color={theme.colors.mutedSoft} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.rowBase}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => [
        styles.rowBase,
        hovered ? styles.rowHover : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

export default function SupportPage() {
  const router = useRouter();

  return (
    <AppPage>
      <PageHeader
        eyebrow="Support"
        title="Help & Support"
        subtitle="A cleaner place to get help, report issues, and review legal resources without repeating the same layout blocks."
        actions={[
          {
            label: "Back",
            onPress: () => router.back(),
          },
          {
            label: "Email Support",
            primary: true,
            onPress: () =>
              void Linking.openURL(
                mailto(
                  "GSD Grid support",
                  "Please describe the issue, what page you were on, and the steps to reproduce it."
                )
              ),
          },
        ]}
      />

      <SummaryStrip>
        <SummaryCard label="Support" value="Email" meta={SUPPORT_EMAIL} accent="violet" />
        <SummaryCard label="Reply Time" value="1 day" meta="Business days" accent="indigo" />
        <SummaryCard label="Resources" value="Legal + FAQs" meta="Terms, privacy, common help" accent="lavender" />
      </SummaryStrip>

      <ContentCard title="Quick Actions" subtitle="Primary support actions without extra filler sections.">
        <View style={styles.sectionList}>
          <SupportRow
            icon="mail-outline"
            title="Email Support"
            body="Send a general support request."
            tone="accent"
            onPress={() =>
              void Linking.openURL(
                mailto(
                  "GSD Grid support",
                  "Please describe the issue, what page you were on, and the steps to reproduce it."
                )
              )
            }
          />
          <SupportRow
            icon="bug-outline"
            title="Report a Bug"
            body="Include steps to reproduce, screenshots, and the page where the issue happened."
            onPress={() =>
              void Linking.openURL(
                mailto(
                  "GSD Grid bug report",
                  "Issue:\nPage:\nSteps to reproduce:\nExpected result:\nActual result:\n"
                )
              )
            }
          />
          <SupportRow
            icon="document-text-outline"
            title="Terms of Service"
            body="Review platform, invoice, and work order terms."
            onPress={() => router.push("/terms" as never)}
          />
          <SupportRow
            icon="shield-checkmark-outline"
            title="Privacy Policy"
            body="Review how app and customer data are handled."
            onPress={() => router.push("/privacy" as never)}
          />
        </View>
      </ContentCard>

      <ContentCard title="Before You Reach Out" subtitle="A single helpful info block instead of another repeated support section.">
        <View style={styles.sectionList}>
          <SupportRow
            icon="information-circle-outline"
            title="Best Support Request"
            body="Include your issue, the page name, what you clicked, and screenshots when possible."
            chevron={false}
          />
          <SupportRow
            icon="time-outline"
            title="Support Hours"
            body="Monday to Friday during standard business hours."
            chevron={false}
          />
        </View>
      </ContentCard>

      <ContentCard title="Common Questions" subtitle="Short answers for the most common support needs.">
        <View style={styles.sectionList}>
          <SupportRow
            icon="help-circle-outline"
            title="How do I create a work order?"
            body="Open Work Orders, choose New, select a template, and complete the required fields."
            chevron={false}
          />
          <SupportRow
            icon="help-circle-outline"
            title="Why can’t some users see pricing?"
            body="Pricing visibility depends on role permissions and the current workflow status."
            chevron={false}
          />
          <SupportRow
            icon="help-circle-outline"
            title="How do I send an invoice?"
            body="Open the related work order, convert it to an invoice, then send it from the invoice view."
            chevron={false}
          />
        </View>
      </ContentCard>
    </AppPage>
  );
}

const styles = StyleSheet.create({
  sectionList: {
    gap: 10,
  },
  rowBase: {
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowHover: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconAccent: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  rowBody: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.9,
  },
});