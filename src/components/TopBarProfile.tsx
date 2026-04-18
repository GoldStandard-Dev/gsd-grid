// src/components/TopBarProfile.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { theme } from "../theme/theme";

type UserProfile = {
  full_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  company_name?: string | null;
};

const PALETTE = {
  black: theme.colors.ink,
  gold: theme.colors.primary,
  goldDark: theme.colors.primaryHover,
  white: theme.colors.surface,
  panel: theme.colors.surface2,
  border: theme.colors.border,
  text: theme.colors.ink,
  textMuted: theme.colors.muted,
  danger: theme.colors.danger,
};

function getInitials(name?: string | null, email?: string | null) {
  const source = (name && name.trim()) || (email && email.trim()) || "User";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatDisplayName(name?: string | null, email?: string | null) {
  if (!name || !name.trim()) {
    return email ?? "User";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";

  return `${first} ${lastInitial}`.trim();
}

export default function TopBarProfile() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      if (!user) {
        setProfile({});
        return;
      }

      const baseProfile: UserProfile = {
        email: user.email ?? null,
        full_name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        company_name: (user.user_metadata?.company_name as string | undefined) ?? null,
      };

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, company_name")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile({
        email: baseProfile.email,
        full_name: profileRow?.full_name ?? baseProfile.full_name ?? null,
        avatar_url: profileRow?.avatar_url ?? baseProfile.avatar_url ?? null,
        company_name: profileRow?.company_name ?? baseProfile.company_name ?? null,
      });
    } catch {
      setProfile({});
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.replace("/(auth)/sign-in");
  }

  const displayName = useMemo(
    () => formatDisplayName(profile.full_name, profile.email),
    [profile.full_name, profile.email]
  );

  const subtitle = useMemo(() => {
    if (profile.company_name?.trim()) return profile.company_name.trim();
    return "Account";
  }, [profile.company_name]);

  const initials = useMemo(
    () => getInitials(profile.full_name, profile.email),
    [profile.full_name, profile.email]
  );

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed ? styles.triggerHover : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <View style={styles.identityWrap}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>{initials}</Text>
            </View>
          )}

          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.name}>
              {loading ? "Loading..." : displayName}
            </Text>
            <Text numberOfLines={1} style={styles.role}>
              {loading ? "Account" : subtitle}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-down" size={16} color={PALETTE.textMuted} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menu} onPress={() => {}}>
            <View style={styles.menuHeader}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.menuAvatarImage} />
              ) : (
                <View style={styles.menuAvatarFallback}>
                  <Text style={styles.menuAvatarFallbackText}>{initials}</Text>
                </View>
              )}

              <View style={styles.menuHeaderCopy}>
                <Text numberOfLines={1} style={styles.menuName}>
                  {displayName}
                </Text>
                <Text numberOfLines={1} style={styles.menuEmail}>
                  {profile.email ?? "No email"}
                </Text>
              </View>
            </View>

            <View style={styles.menuMetaCard}>
              <View style={styles.menuMetaRow}>
                <Ionicons name="business-outline" size={14} color={PALETTE.goldDark} />
                <Text numberOfLines={1} style={styles.menuMetaText}>
                  {subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push("/(app)/profile");
              }}
              style={({ pressed }) => [styles.menuItem, pressed ? styles.pressed : null]}
            >
              <Ionicons name="person-outline" size={18} color={PALETTE.textMuted} />
              <Text style={styles.menuItemText}>Profile</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push("/(app)/settings");
              }}
              style={({ pressed }) => [styles.menuItem, pressed ? styles.pressed : null]}
            >
              <Ionicons name="settings-outline" size={18} color={PALETTE.textMuted} />
              <Text style={styles.menuItemText}>Settings</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.menuItem, pressed ? styles.pressed : null]}
            >
              <Ionicons name="log-out-outline" size={18} color={PALETTE.danger} />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 220,
    maxWidth: 320,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  triggerHover: {
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
  },

  identityWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PALETTE.panel,
  },

  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarFallbackText: {
    color: PALETTE.goldDark,
    fontWeight: "900",
    fontSize: 12,
  },

  copy: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    color: PALETTE.text,
    fontSize: 13.5,
    fontWeight: "900",
  },

  role: {
    marginTop: 2,
    color: PALETTE.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.12)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 72,
    paddingRight: 24,
  },

  menu: {
    width: 290,
    borderRadius: 18,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  menuAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PALETTE.panel,
  },

  menuAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: "center",
    justifyContent: "center",
  },

  menuAvatarFallbackText: {
    color: PALETTE.goldDark,
    fontWeight: "900",
    fontSize: 14,
  },

  menuHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },

  menuName: {
    color: PALETTE.text,
    fontSize: 14,
    fontWeight: "900",
  },

  menuEmail: {
    marginTop: 2,
    color: PALETTE.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },

  menuMetaCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  menuMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  menuMetaText: {
    flex: 1,
    color: PALETTE.text,
    fontSize: 12.5,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: PALETTE.border,
    marginVertical: 12,
  },

  menuItem: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  menuItemText: {
    color: PALETTE.text,
    fontSize: 14,
    fontWeight: "700",
  },

  logoutText: {
    color: PALETTE.danger,
    fontSize: 14,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.92,
  },
});
