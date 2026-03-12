import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { getSession, getUserOrgId } from "../src/lib/auth";

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) return setTarget("/(auth)/sign-in");

      const orgId = await getUserOrgId(session.user.id);
      if (!orgId) return setTarget("/(onboarding)/create-org");

      setTarget("/(app)/dashboard");
    })();
  }, []);

  if (!target) return null;
  return <Redirect href={target} />;
}