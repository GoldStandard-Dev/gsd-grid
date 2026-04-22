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

  const repaired = await supabase.functions.invoke("ensure-owner-workspace", {
    body: {
      company_name: orgName,
      full_name: fullName,
      email,
      phone: phone || null,
      job_title: jobTitle || "Owner",
    },
  });

  if (!repaired.error && repaired.data?.org_id) {
    return { ok: true as const, orgId: String(repaired.data.org_id) };
  }

  const existingOrg = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(1);

  if (existingOrg.error) {
    return {
      ok: false as const,
      error:
        repaired.error?.message ||
        (repaired.data?.error ? String(repaired.data.error) : "") ||
        existingOrg.error.message,
    };
  }

  let orgId = existingOrg.data?.[0]?.id as string | undefined;

  if (!orgId) {
    const org = await supabase
      .from("organizations")
      .insert({ name: orgName, owner_user_id: userId })
      .select("id")
      .single();

    if (org.error || !org.data) {
      return { ok: false as const, error: org.error?.message || "Failed to create organization." };
    }

    orgId = org.data.id;
  }

  const existingMember = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .limit(1);

  if (existingMember.error) {
    return { ok: false as const, error: existingMember.error.message };
  }

  const memberId = existingMember.data?.[0]?.id as string | undefined;
  const memberPayload = {
    role: "owner",
    status: "active",
    display_name: fullName || email,
    email,
    phone: phone || null,
    job_title: jobTitle || "Owner",
    portal_type: "admin",
    is_field_user: false,
    mobile_access_enabled: true,
    desktop_access_enabled: true,
  };

  if (memberId) {
    const member = await supabase
      .from("org_members")
      .update(memberPayload)
      .eq("id", memberId);

    if (member.error) {
      return { ok: false as const, error: member.error.message };
    }
  } else {
    const member = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: userId,
      ...memberPayload,
    });

    if (member.error) {
      return { ok: false as const, error: member.error.message };
    }
  }

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
