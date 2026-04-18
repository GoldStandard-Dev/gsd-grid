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

  // ðŸš¨ CRITICAL FIX:
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
  if (!orgName) {
    return { ok: false as const, error: "Organization name is required." };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { ok: false as const, error: "User not authenticated." };
  }

  const userId = authData.user.id;
  const email = authData.user.email ?? "Owner";

  const org = await supabase
    .from("organizations")
    .insert({ name: orgName, owner_user_id: userId })
    .select("id")
    .single();

  if (org.error || !org.data) {
    return { ok: false as const, error: org.error?.message || "Failed to create org." };
  }

  const orgId = org.data.id;

  const member = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: userId,
    role: "owner",
    status: "active",
    display_name: email,
  });

  if (member.error) {
    return { ok: false as const, error: member.error.message };
  }

  await supabase.from("activity_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    actor_name: email,
    action: "created organization",
    entity_type: "organization",
    entity_id: orgId,
  });

  return { ok: true as const, orgId };
}

// Sets up a brand new account in one shot:
// creates the org, membership, profile, and activity log entry.
export async function setupNewAccount(params: {
  orgName: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
}) {
  const { orgName, fullName, email, phone, jobTitle } = params;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return { ok: false as const, error: "User not authenticated." };
  }

  const userId = authData.user.id;

  // 1. Create organization
  const org = await supabase
    .from("organizations")
    .insert({ name: orgName, owner_user_id: userId })
    .select("id")
    .single();

  if (org.error || !org.data) {
    return { ok: false as const, error: org.error?.message || "Failed to create organization." };
  }

  const orgId = org.data.id;

  // 2. Create owner membership
  const member = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: userId,
    role: "owner",
    status: "active",
    display_name: fullName || email,
  });

  if (member.error) {
    return { ok: false as const, error: member.error.message };
  }

  // 3. Create profile
  const profile = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      full_name: fullName,
      email,
      phone: phone || null,
      job_title: jobTitle || "Owner",
      company_name: orgName,
    },
    { onConflict: "user_id" }
  );

  if (profile.error) {
    return { ok: false as const, error: profile.error.message };
  }

  // 4. Log activity
  await supabase.from("activity_log").insert({
    org_id: orgId,
    actor_user_id: userId,
    actor_name: fullName || email,
    action: "created organization",
    entity_type: "organization",
    entity_id: orgId,
  });

  return { ok: true as const, orgId };
}