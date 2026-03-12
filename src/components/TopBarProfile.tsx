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
};

const PALETTE = {
  black: theme.colors.ink,
  gold: theme.colors.gold,
  goldDark: theme.colors.goldDark,
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

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
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
      };

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      setProfile({
        email: baseProfile.email,
        full_name: profileRow?.full_name ?? baseProfile.full_name ?? null,
        avatar_url: profileRow?.avatar_url ?? baseProfile.avatar_url ?? null,
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

  const displayName = useMemo(() => {
    if (profile.full_name?.trim()) return profile.full_name.trim();
    if (profile.email?.trim()) return profile.email.trim();
    return "User";
  }, [profile.full_name, profile.email]);

  const initials = useMemo(
    () => getInitials(profile.full_name, profile.email),
    [profile.full_name, profile.email]
  );

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed ? styles.pressed : null]}
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
              Account
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
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  identityWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },

  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PALETTE.panel,
  },

  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF5D6",
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
    fontSize: 13,
    fontWeight: "800",
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
    width: 270,
    borderRadius: 16,
    backgroundColor: PALETTE.white,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 12,
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  menuAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: PALETTE.panel,
  },

  menuAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF5D6",
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
    fontWeight: "800",
  },

  menuEmail: {
    marginTop: 2,
    color: PALETTE.textMuted,
    fontSize: 12,
    fontWeight: "700",
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