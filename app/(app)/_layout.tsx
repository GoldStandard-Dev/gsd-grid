import { Ionicons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
};

const PALETTE = {
  ink: theme.colors.ink,
  ink2: theme.colors.ink2,
  gold: theme.colors.gold,
  goldDark: theme.colors.goldDark,
  goldSoft: theme.colors.gold2,
  white: theme.colors.surface,
  panel: theme.colors.surface2,
  canvas: theme.colors.bg,
  border: theme.colors.border,
  text: theme.colors.ink,
  textMuted: theme.colors.muted,
};

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
  if (pathname.endsWith("/workforce")) return labels.workforce;
  if (pathname.endsWith("/settings")) return "Settings";
  if (pathname.endsWith("/profile")) return "Profile";
  return "GSD Grid";
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

export default function AppLayout() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("viewer");
  const [labels, setLabels] = useState({
    workorders: "Work Orders",
    pricing: "Pricing",
    clients: "Clients",
    team: "Team",
    workforce: "Workforce",
  });

  useEffect(() => {
    let mounted = true;

    async function loadUserData() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return;

        const userId = data.user?.id;
        if (!userId) return;

        const orgId = await getUserOrgId(userId);
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
            pricing: settings.nav_label_pricing || "Pricing",
            clients: settings.nav_label_clients || "Clients",
            team: settings.nav_label_team || "Team",
            workforce: settings.nav_label_workforce || "Workforce",
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
      },
      {
        name: labels.workorders,
        path: "/workorders",
        icon: "clipboard-outline",
        permission: "view_workorders",
      },
      {
        name: labels.pricing,
        path: "/pricing",
        icon: "calculator-outline",
        permission: "view_workorders",
      },
      {
        name: "Invoices",
        path: "/invoices",
        icon: "document-text-outline",
        permission: "view_invoices",
      },
      {
        name: labels.clients,
        path: "/clients",
        icon: "people-outline",
        permission: "view_clients",
      },
      {
        name: labels.team,
        path: "/team",
        icon: "people-circle-outline",
        permission: "view_people",
      },
      {
        name: labels.workforce,
        path: "/workforce",
        icon: "briefcase-outline",
        permission: "view_hr",
      },
      {
        name: "Settings",
        path: "/settings",
        icon: "settings-outline",
        permission: "view_settings",
      },
    ],
    [labels]
  );

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasPermission(userPermissions, item.permission)),
    [navItems, userPermissions]
  );

  const allowedPaths = useMemo(
    () => [...visibleNavItems.map((item) => item.path), "/profile"],
    [visibleNavItems]
  );

  useEffect(() => {
    if (!pathname) return;
    if (pathname === "/") return;

    const isAllowed = allowedPaths.some((path) => pathname.startsWith(path));

    if (!isAllowed && allowedPaths.length > 0) {
      router.replace(getDefaultRoute(userPermissions));
    }
  }, [allowedPaths, pathname, router, userPermissions]);

  return (
    <View style={styles.container}>
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
        <View style={styles.sidebarHeader}>
          <View style={styles.logoWrap}>
            <Image source={require("../../assets/brand/gsd-grid-icon.png")} style={styles.logo} />
          </View>

          {!collapsed ? (
            <View style={styles.brandBlock}>
              <Text style={styles.brandTitle}>GSD Grid</Text>
              <Text style={styles.brandSub}>Gold Standard Workflow</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [styles.collapseButton, pressed ? styles.pressed : null]}
          onPress={() => setCollapsed((prev) => !prev)}
        >
          <Ionicons
            name={collapsed ? "chevron-forward" : "chevron-back"}
            size={16}
            color={PALETTE.goldDark}
          />
        </Pressable>

        <View style={styles.roleCard}>
          {!collapsed ? (
            <>
              <Text style={styles.roleCardLabel}>Signed in as</Text>
              <Text style={styles.roleCardValue}>
                {userRole
                  .split("_")
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(" ")}
              </Text>
            </>
          ) : (
            <Ionicons name="shield-checkmark-outline" size={18} color={PALETTE.goldDark} />
          )}
        </View>

        <View style={styles.nav}>
          {visibleNavItems.map((item) => {
            const active = pathname.startsWith(item.path);

            return (
              <Pressable
                key={item.path}
                onPress={() => router.push(item.path as never)}
                style={({ pressed }) => [
                  styles.navItem,
                  active ? styles.navItemActive : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <View style={[styles.navIconWrap, active ? styles.navIconWrapActive : null]}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? PALETTE.goldDark : PALETTE.textMuted}
                  />
                </View>

                {!collapsed ? (
                  <Text style={[styles.navText, active ? styles.navTextActive : null]}>
                    {item.name}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {!collapsed ? (
          <View style={styles.sidebarFooter}>
            <Text style={styles.footerText}>Powered by GSD</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <Text style={styles.pageTitle}>{pageTitleFromPath(pathname, labels)}</Text>
          <TopBarProfile />
        </View>

        <View style={styles.content}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: PALETTE.canvas,
  },

  sidebar: {
    width: 240,
    backgroundColor: PALETTE.white,
    borderRightWidth: 1,
    borderRightColor: PALETTE.border,
    paddingTop: 18,
    paddingHorizontal: 14,
  },

  sidebarCollapsed: {
    width: 82,
  },

  sidebarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    minHeight: 48,
  },

  logoWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: "#FFF8E8",
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
    color: PALETTE.text,
  },

  brandSub: {
    marginTop: 2,
    fontSize: 11.5,
    color: PALETTE.textMuted,
    fontWeight: "700",
  },

  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  roleCard: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: "#FBF7EC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  roleCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: PALETTE.textMuted,
    marginBottom: 3,
  },

  roleCardValue: {
    fontSize: 13,
    fontWeight: "900",
    color: PALETTE.goldDark,
  },

  nav: {
    gap: 8,
  },

  navItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },

  navItemActive: {
    backgroundColor: "#FBF4E2",
    borderColor: PALETTE.border,
  },

  navIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  navIconWrapActive: {
    backgroundColor: "#F5E6B8",
  },

  navText: {
    fontSize: 14,
    fontWeight: "800",
    color: PALETTE.textMuted,
  },

  navTextActive: {
    color: PALETTE.goldDark,
  },

  sidebarFooter: {
    marginTop: "auto",
    paddingBottom: 18,
  },

  footerText: {
    fontSize: 11,
    color: PALETTE.textMuted,
    fontWeight: "700",
  },

  main: {
    flex: 1,
  },

  topbar: {
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: PALETTE.text,
  },

  content: {
    flex: 1,
  },

  pressed: {
    opacity: 0.9,
  },
});