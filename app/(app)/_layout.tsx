import { Ionicons } from "@expo/vector-icons";
import { Slot, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import TopBarProfile from "../../src/components/TopBarProfile";
import { getUserOrgId } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import {
  ROLE_PERMISSIONS,
  hasPermission,
  type Permission,
  type UserRole,
} from "../../src/lib/permissions";
import { theme } from "../../src/theme/theme";

type NavItem = {
  name: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
  permission: Permission;
  section: "main" | "finance" | "operations" | "system";
  badgeKey?: keyof NavBadges;
};

type NavBadges = {
  workorders: number;
  invoices: number;
  team: number;
};

const SUPPORT_EMAIL = "goldstandarddigital@outlook.com";

function pageTitleFromPath(
  pathname: string,
  labels: {
    workorders: string;
    pricing: string;
    clients: string;
    team: string;
    workforce: string;
  }
) {
  if (pathname.endsWith("/dashboard")) return "Dashboard";
  if (pathname.includes("/workorders")) return labels.workorders;
  if (pathname.endsWith("/pricing")) return labels.pricing;
  if (pathname.endsWith("/invoices")) return "Invoices";
  if (pathname.endsWith("/clients")) return labels.clients;
  if (pathname.endsWith("/team")) return labels.team;
  if (pathname.endsWith("/workforce")) return "Team";
  if (pathname.endsWith("/settings")) return "Settings";
  if (pathname.endsWith("/profile")) return "Profile";
  if (pathname.endsWith("/support")) return "Support";
  if (pathname.endsWith("/privacy")) return "Privacy Policy";
  if (pathname.endsWith("/terms")) return "Terms";
  return "GSD Grid";
}

function pageEyebrowFromPath(pathname: string) {
  if (pathname.endsWith("/dashboard")) return "";
  if (pathname.includes("/workorders")) return "Operations";
  if (pathname.endsWith("/pricing")) return "Templates";
  if (pathname.endsWith("/invoices")) return "Billing";
  if (pathname.endsWith("/clients")) return "Relationships";
  if (pathname.endsWith("/workforce")) return "People";
  if (pathname.endsWith("/settings")) return "Administration";
  if (pathname.endsWith("/profile")) return "Account";
  if (pathname.endsWith("/support")) return "Help";
  if (pathname.endsWith("/privacy")) return "Legal";
  if (pathname.endsWith("/terms")) return "Legal";
  return "Workspace";
}

function getDefaultRoute(permissions: Permission[]) {
  if (hasPermission(permissions, "view_dashboard")) return "/dashboard";
  if (hasPermission(permissions, "view_workorders")) return "/workorders";
  if (hasPermission(permissions, "view_invoices")) return "/invoices";
  if (hasPermission(permissions, "view_clients")) return "/clients";
  if (hasPermission(permissions, "view_people")) return "/team";
  if (hasPermission(permissions, "view_hr")) return "/workforce";
  if (hasPermission(permissions, "view_settings")) return "/settings";
  return "/dashboard";
}

function parseReviewStatus(description?: string | null) {
  if (!description) return "draft";

  try {
    const parsed = JSON.parse(description);
    return String(parsed?.reviewWorkflow?.status ?? "draft");
  } catch {
    return "draft";
  }
}

function supportMailto(subject: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export default function AppLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  const [collapsed, setCollapsed] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("viewer");
  const [navBadges, setNavBadges] = useState<NavBadges>({
    workorders: 0,
    invoices: 0,
    team: 0,
  });
  const [collapsedSections, setCollapsedSections] = useState({
    finance: false,
    operations: false,
  });
  const [labels, setLabels] = useState({
    workorders: "Work Orders",
    pricing: "Pricing Grid",
    clients: "Clients",
    team: "Team & Roles",
    workforce: "Team & Roles",
  });

  useEffect(() => {
    let mounted = true;

    async function loadUserData() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return;

        const userId = data.user?.id;
        if (!userId) return;

        let orgId = await getUserOrgId(userId);

        // No org yet — happens when email confirmation redirects straight to the app
        // without going through sign-in.tsx. Auto-create from signup metadata.
        if (!orgId) {
          const { data: authData } = await supabase.auth.getUser();
          const meta = (authData?.user?.user_metadata ?? {}) as Record<string, string>;
          const companyName = meta.company_name?.trim();
          if (companyName) {
            const { setupNewAccount } = await import("../../src/lib/auth");
            const setup = await setupNewAccount({
              orgName: companyName,
              fullName: meta.full_name ?? "",
              email: authData?.user?.email ?? "",
              phone: meta.phone ?? undefined,
              jobTitle: meta.job_title ?? "Owner",
            });
            if (setup.ok) orgId = setup.orgId;
          }
        }

        if (!orgId) return;

        const { data: member } = await supabase
          .from("org_members")
          .select("role")
          .eq("org_id", orgId)
          .eq("user_id", userId)
          .maybeSingle();

        const nextRole = String(member?.role ?? "viewer") as UserRole;

        if (mounted) {
          setUserRole(nextRole in ROLE_PERMISSIONS ? nextRole : "viewer");
        }

        const { data: settings } = await supabase
          .from("organization_settings")
          .select("*")
          .eq("org_id", orgId)
          .maybeSingle();

        if (settings && mounted) {
          setLabels({
            workorders: settings.nav_label_workorders || "Work Orders",
            pricing: settings.nav_label_pricing || "Pricing Grid",
            clients: settings.nav_label_clients || "Clients",
            team: settings.nav_label_team || "Team & Roles",
            workforce: settings.nav_label_workforce || "Team & Roles",
          });
        }

        const [workOrdersRes, invoicesRes, invitesRes] = await Promise.all([
          supabase
            .from("work_orders")
            .select("description, status")
            .eq("org_id", orgId),
          supabase
            .from("invoices")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .in("status", ["unpaid", "overdue", "sent", "partial"]),
          supabase
            .from("org_invites")
            .select("id", { count: "exact", head: true })
            .eq("org_id", orgId)
            .eq("status", "pending"),
        ]);

        if (mounted) {
          const reviewCount = workOrdersRes.error
            ? 0
            : (workOrdersRes.data ?? []).filter((row) => {
                const reviewStatus = parseReviewStatus(row.description);
                const stageStatus = String(row.status ?? "").toLowerCase();
                return (
                  reviewStatus === "submitted_for_review" ||
                  reviewStatus === "in_review" ||
                  stageStatus === "in_review"
                );
              }).length;

          setNavBadges({
            workorders: reviewCount,
            invoices: invoicesRes.error ? 0 : invoicesRes.count ?? 0,
            team: invitesRes.error ? 0 : invitesRes.count ?? 0,
          });
        }
      } catch {
        if (mounted) {
          setUserRole("viewer");
        }
      }
    }

    void loadUserData();

    return () => {
      mounted = false;
    };
  }, []);

  const userPermissions = useMemo(
    () => ROLE_PERMISSIONS[userRole] ?? ROLE_PERMISSIONS.viewer,
    [userRole]
  );

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        name: "Dashboard",
        path: "/dashboard",
        icon: "grid-outline",
        permission: "view_dashboard",
        section: "main",
      },
      {
        name: labels.workorders,
        path: "/workorders",
        icon: "clipboard",
        permission: "view_workorders",
        section: "main",
        badgeKey: "workorders",
      },
      {
        name: labels.clients,
        path: "/clients",
        icon: "people",
        permission: "view_clients",
        section: "main",
      },
      {
        name: labels.pricing,
        path: "/pricing",
        icon: "calculator",
        permission: "view_financials",
        section: "finance",
      },
      {
        name: "Invoices",
        path: "/invoices",
        icon: "document-text-outline",
        permission: "view_invoices",
        section: "finance",
        badgeKey: "invoices",
      },
      {
        name: labels.workforce,
        path: "/workforce",
        icon: "id-card-outline",
        permission: "view_hr",
        section: "operations",
        badgeKey: "team",
      },
      {
        name: "Settings",
        path: "/settings",
        icon: "settings",
        permission: "view_settings",
        section: "system",
      },
    ],
    [labels]
  );

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasPermission(userPermissions, item.permission)),
    [navItems, userPermissions]
  );

  const mainNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.section === "main"),
    [visibleNavItems]
  );

  const financeNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.section === "finance"),
    [visibleNavItems]
  );

  const operationsNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.section === "operations"),
    [visibleNavItems]
  );

  const systemNavItems = useMemo(
    () => visibleNavItems.filter((item) => item.section === "system"),
    [visibleNavItems]
  );

  const allowedPaths = useMemo(
    () => [...visibleNavItems.map((item) => item.path), "/profile", "/support", "/privacy", "/terms"],
    [visibleNavItems]
  );

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (!pathname) return;
    if (pathname === "/") return;

    const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));

    if (!isAllowed && allowedPaths.length > 0) {
      router.replace(getDefaultRoute(userPermissions));
    }
  }, [allowedPaths, pathname, rootNavigationState?.key, router, userPermissions]);

  const pageTitle = pageTitleFromPath(pathname, labels);
  const pageEyebrow = pageEyebrowFromPath(pathname);
  const navSections = [
    { key: "main" as const, label: "Main", items: mainNavItems, collapsible: false },
    { key: "finance" as const, label: "Finance", items: financeNavItems, collapsible: true },
    { key: "operations" as const, label: "Operations", items: operationsNavItems, collapsible: true },
    { key: "system" as const, label: "System", items: systemNavItems, collapsible: false },
  ];
  return (
    <View style={styles.container}>
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
        <View style={styles.sidebarHeaderTint}>
          <View style={styles.sidebarHeader}>
            <View style={styles.logoWrap}>
              <Image source={require("../../assets/brand/gsd-grid-icon.png")} style={styles.logo} />
            </View>

            {!collapsed ? (
              <View style={styles.brandBlock}>
                <Text style={styles.brandTitle}>GSD Grid</Text>
                <Text style={styles.brandSub}>Professional workflow management</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sidebarControls}>
          <Pressable
            style={({ pressed }) => [styles.collapseButton, pressed ? styles.pressed : null]}
            onPress={() => setCollapsed((prev) => !prev)}
          >
            <Ionicons
              name={collapsed ? "chevron-forward" : "chevron-back"}
              size={16}
              color={theme.colors.primaryHover}
            />
          </Pressable>
        </View>

        {navSections.map((section) =>
          section.items.length ? (
            <View key={section.label} style={styles.navSection}>
              {!collapsed ? (
                <Pressable
                  disabled={!section.collapsible}
                  onPress={() => {
                    if (!section.collapsible) return;
                    setCollapsedSections((prev) => ({
                      ...prev,
                      [section.key]: !prev[section.key as "finance" | "operations"],
                    }));
                  }}
                  style={styles.navSectionHeader}
                >
                  <Text style={styles.navLabel}>{section.label}</Text>
                  {section.collapsible ? (
                    <Ionicons
                      name={collapsedSections[section.key as "finance" | "operations"] ? "chevron-forward" : "chevron-down"}
                      size={13}
                      color={theme.colors.mutedSoft}
                    />
                  ) : null}
                </Pressable>
              ) : null}
              {section.label !== "Main" ? <View style={styles.navDivider} /> : null}
              <View style={[styles.navList, !collapsed && section.collapsible && collapsedSections[section.key as "finance" | "operations"] ? styles.navListHidden : null]}>
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.path);
                  const badgeValue = item.badgeKey ? navBadges[item.badgeKey] : 0;

                  return (
                    <Pressable
                      key={item.path}
                      onPress={() => router.push(item.path as never)}
                      style={({ pressed, hovered }: any) => [
                        styles.navItem,
                        active ? styles.navItemActive : null,
                        hovered && !active ? styles.navItemHover : null,
                        pressed && !active ? styles.navItemPressed : null,
                        pressed ? styles.pressed : null,
                      ]}
                    >
                      {active ? <View style={styles.navActiveStrip} /> : null}
                      <View style={[styles.navIconWrap, active ? styles.navIconWrapActive : null]}>
                        <Ionicons
                          name={item.icon}
                          size={18}
                          color={active ? theme.colors.primaryHover : theme.colors.mutedSoft}
                        />
                      </View>
                      {!collapsed ? (
                        <Text style={[styles.navText, active ? styles.navTextActive : null]}>
                          {item.name}
                        </Text>
                      ) : null}
                      {badgeValue > 0 ? (
                        <View style={[styles.navBadge, collapsed ? styles.navBadgeCollapsed : null]}>
                          <Text style={styles.navBadgeText}>{badgeValue > 99 ? "99+" : String(badgeValue)}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null
        )}

        <View style={styles.sidebarSupportWrap}>
          <Pressable
            accessibilityLabel="Support"
            onPress={() => setSupportOpen(true)}
            style={({ pressed, hovered }: any) => [
              styles.sidebarSupportButton,
              hovered ? styles.sidebarSupportButtonHover : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <View style={styles.sidebarSupportIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={theme.colors.primaryHover} />
            </View>
            {!collapsed ? (
              <View style={styles.sidebarSupportCopy}>
                <Text style={styles.sidebarSupportTitle}>Support</Text>
                <Text style={styles.sidebarSupportMeta}>Help, docs, report issue</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

      </View>

      <View style={styles.main}>
        <View style={styles.topbarAccent} />
        <View style={styles.topbar}>
          <View>
            {pageEyebrow ? <Text style={styles.topbarEyebrow}>{pageEyebrow}</Text> : null}
            <Text style={styles.pageTitle}>{pageTitle}</Text>
          </View>
          <TopBarProfile />
        </View>

        <View style={styles.content}>
          <Slot />
        </View>
      </View>

      <Modal visible={supportOpen} transparent animationType="fade" onRequestClose={() => setSupportOpen(false)}>
        <Pressable style={styles.supportBackdrop} onPress={() => setSupportOpen(false)}>
          <Pressable style={styles.supportPanel} onPress={() => {}}>
            <View style={styles.supportPanelHeader}>
              <View>
                <Text style={styles.supportPanelTitle}>Support</Text>
                <Text style={styles.supportPanelSub}>{SUPPORT_EMAIL}</Text>
              </View>
              <Pressable onPress={() => setSupportOpen(false)} style={styles.supportCloseBtn}>
                <Ionicons name="close" size={16} color={theme.colors.ink} />
              </Pressable>
            </View>

            {[
              {
                icon: "mail-outline" as const,
                label: "Contact Support",
                onPress: () => void Linking.openURL(supportMailto("GSD Grid support")),
              },
              {
                icon: "book-outline" as const,
                label: "View Docs",
                onPress: () => router.push("/support" as never),
              },
              {
                icon: "bug-outline" as const,
                label: "Report Issue",
                onPress: () => void Linking.openURL(supportMailto("GSD Grid issue report")),
              },
            ].map((item) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  setSupportOpen(false);
                  item.onPress();
                }}
                style={({ pressed, hovered }: any) => [
                  styles.supportAction,
                  hovered ? styles.supportActionHover : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={styles.supportActionIcon}>
                  <Ionicons name={item.icon} size={17} color={theme.colors.primaryHover} />
                </View>
                <Text style={styles.supportActionText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.mutedSoft} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: theme.colors.bg,
  },
  sidebar: {
    width: 252,
    backgroundColor: theme.colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: theme.colors.sidebarBorder,
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
    display: "flex",
  },
  sidebarCollapsed: {
    width: 92,
  },
  sidebarHeaderTint: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: theme.colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  brandSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.mutedSoft,
  },
  sidebarControls: {
    gap: 10,
    paddingTop: 10,
    paddingBottom: 10,
  },
  collapseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  roleCard: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  roleCardLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.colors.mutedSoft,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roleCardValue: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.colors.primaryHover,
  },
  navSection: {
    gap: 8,
    marginBottom: 17,
  },
  navSectionHeader: {
    minHeight: 20,
    paddingHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.colors.mutedSoft,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  navDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 6,
    marginBottom: 2,
  },
  navList: {
    gap: 5,
  },
  navListHidden: {
    display: "none",
  },
  navItem: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "relative",
  },
  navItemActive: {
    backgroundColor: "#DBEAFE",
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  navItemHover: {
    backgroundColor: theme.colors.primarySoft,
    transform: [{ translateX: 3 }],
  },
  navItemPressed: {
    backgroundColor: theme.colors.primaryLight,
  },
  navActiveStrip: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  navIconWrap: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrapActive: {
    backgroundColor: "#FFFFFF",
  },
  navText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "800",
    color: theme.colors.muted,
  },
  navTextActive: {
    color: theme.colors.primaryHover,
    fontWeight: "900",
  },
  navBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  navBadgeCollapsed: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  navBadgeText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "900",
  },
  sidebarSupportWrap: {
    marginTop: "auto",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sidebarSupportButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sidebarSupportButtonHover: {
    backgroundColor: theme.colors.primarySoft,
    transform: [{ translateX: 2 }],
  },
  sidebarSupportIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  sidebarSupportCopy: {
    flex: 1,
    minWidth: 0,
  },
  sidebarSupportTitle: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  sidebarSupportMeta: {
    marginTop: 2,
    color: theme.colors.mutedSoft,
    fontSize: 11.5,
    fontWeight: "700",
  },
  main: {
    flex: 1,
  },
  topbarAccent: {
    height: 3,
    backgroundColor: theme.colors.primary,
  },
  topbar: {
    minHeight: 78,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  topbarEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: theme.colors.primaryHover,
  },
  pageTitle: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: theme.colors.ink,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  pressed: {
    opacity: 0.92,
  },
  supportBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    alignItems: "flex-start",
    justifyContent: "flex-end",
    padding: 24,
    paddingLeft: 276,
  },
  supportPanel: {
    width: 320,
    maxWidth: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    padding: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  supportPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 8,
  },
  supportPanelTitle: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  supportPanelSub: {
    marginTop: 3,
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  supportCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  supportAction: {
    minHeight: 46,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
  },
  supportActionHover: {
    backgroundColor: theme.colors.primarySoft,
  },
  supportActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  supportActionText: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
});
