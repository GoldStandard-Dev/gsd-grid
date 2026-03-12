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
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false as const, error: error.message };
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
  if (!orgName) return { ok: false as const, error: "Organization name is required." };

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  const email = auth.user?.email ?? null;
  if (!userId) return { ok: false as const, error: "Not signed in." };

  const org = await supabase.from("organizations").insert({ name: orgName, owner_user_id: userId }).select("id").single();
  if (org.error) return { ok: false as const, error: org.error.message };

  const member = await supabase.from("org_members").insert({
    org_id: org.data.id,
    user_id: userId,
    role: "owner",
    status: "active",
    display_name: email
  });

  if (member.error) return { ok: false as const, error: member.error.message };

  await supabase.from("activity_log").insert({
    org_id: org.data.id,
    actor_user_id: userId,
    actor_name: email,
    action: "created organization",
    entity_type: "organization",
    entity_id: org.data.id
  });

  return { ok: true as const };
}