// app/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import TopBarProfile from "../../src/components/TopBarProfile";
import { theme } from "../../src/theme/theme";

type NavItem = {
  name: string;
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
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

function pageTitleFromPath(pathname: string) {
  if (pathname.endsWith("/dashboard")) return "Dashboard";
  if (pathname.endsWith("/workorders")) return "Work Orders";
  if (pathname.endsWith("/invoices")) return "Invoices";
  if (pathname.endsWith("/clients")) return "Clients";
  if (pathname.endsWith("/team")) return "Team";
  if (pathname.endsWith("/settings")) return "Settings";
  return "GSD Grid";
}

export default function AppLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = useMemo<NavItem[]>(
    () => [
      { name: "Dashboard", path: "/dashboard", icon: "grid-outline" },
      { name: "Work Orders", path: "/workorders", icon: "clipboard-outline" },
      { name: "Invoices", path: "/invoices", icon: "document-text-outline" },
      { name: "Clients", path: "/clients", icon: "people-outline" },
      { name: "Team", path: "/team", icon: "person-outline" },
      { name: "Settings", path: "/settings", icon: "settings-outline" },
    ],
    []
  );

  return (
    <View style={styles.container}>
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
        <View style={styles.sidebarHeader}>
          <View style={styles.logoWrap}>
            <Image source={require("../../assets/brand/gsd-grid-icon.png")} style={styles.logo} />
          </View>

          {!collapsed && (
            <View style={styles.brandBlock}>
              <Text style={styles.brandTitle}>GSD Grid</Text>
              <Text style={styles.brandSub}>Gold Standard Workflow</Text>
            </View>
          )}
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

        <View style={styles.nav}>
          {navItems.map((item) => {
            const active = pathname.includes(item.path);

            return (
              <Pressable
                key={item.path}
                onPress={() => router.push(item.path)}
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

                {!collapsed && (
                  <Text style={[styles.navText, active ? styles.navTextActive : null]}>{item.name}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {!collapsed && (
          <View style={styles.sidebarFooter}>
            <Text style={styles.footerText}>Powered by GSD</Text>
          </View>
        )}
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <Text style={styles.pageTitle}>{pageTitleFromPath(pathname)}</Text>
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
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 24,
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
    backgroundColor: PALETTE.canvas,
  },

  pressed: {
    opacity: 0.92,
  },
});