import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";

export default function ClientPortalLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void check();
  }, []);

  async function check() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Check if user has client portal access record
    const { data: portal } = await supabase
      .from("client_portal_access")
      .select("id, status, client_id")
      .eq("email", user.email ?? "")
      .eq("status", "active")
      .maybeSingle();

    if (!portal) {
      // Not a portal user — send to main app or sign-in
      router.replace("/(auth)/sign-in");
      return;
    }

    setReady(true);
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#F7F4ED",
    alignItems: "center",
    justifyContent: "center",
  },
});
