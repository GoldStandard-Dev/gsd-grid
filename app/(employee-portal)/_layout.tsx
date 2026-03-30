import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { getUserOrgId } from "../../src/lib/auth";

const FIELD_ROLES = ["technician", "field_supervisor"];

export default function EmployeePortalLayout() {
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

    const orgId = await getUserOrgId(user.id);
    if (!orgId) {
      router.replace("/(onboarding)/create-org");
      return;
    }

    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();

    const role = member?.role ?? "";

    // Admin/manager roles → redirect to main app
    if (role && !FIELD_ROLES.includes(role)) {
      router.replace("/(app)/dashboard");
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

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: "#F7F4ED",
    alignItems: "center",
    justifyContent: "center",
  },
});
