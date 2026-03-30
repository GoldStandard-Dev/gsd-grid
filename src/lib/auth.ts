import { supabase } from "./supabase";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  // 🚨 CRITICAL FIX:
  // If email confirmation is ON, there is NO session yet
  if (!data.session) {
    return {
      ok: true as const,
      needsEmailConfirmation: true as const
    };
  }

  return { ok: true as const };
}

export async function getUserOrgId(userId: string) {
  const res = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return res.data?.org_id ?? null;
}

export async function createOrganizationForCurrentUser(orgName: string) {
  if (!orgName?.trim()) {
    return { ok: false as const, error: "Organization name is required." };
  }

  // Use the SECURITY DEFINER RPC so the insert is never blocked by RLS,
  // even if the client session hasn't finished restoring from localStorage.
  const { data, error } = await supabase.rpc("create_organization_for_user", {
    p_org_name: orgName.trim(),
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  const result = data as { ok: boolean; error?: string; org_id?: string };

  if (!result.ok) {
    return { ok: false as const, error: result.error ?? "Failed to create organization." };
  }

  return { ok: true as const, orgId: result.org_id! };
}