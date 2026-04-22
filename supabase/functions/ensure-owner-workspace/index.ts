import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return json({ error: "Missing authorization token." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: userError?.message ?? "Could not verify signed-in user." }, 401);
    }

    const user = userData.user;
    const meta = user.user_metadata ?? {};
    const cleanCompanyName = String(body.company_name ?? meta.company_name ?? "").trim();
    const cleanFullName = String(body.full_name ?? meta.full_name ?? "").trim();
    const cleanEmail = String(body.email ?? user.email ?? "").trim().toLowerCase();
    const cleanPhone = String(body.phone ?? meta.phone ?? "").trim();
    const cleanJobTitle = String(body.job_title ?? meta.job_title ?? "Owner").trim() || "Owner";

    if (!cleanCompanyName) {
      return json({ error: "Company name is required." }, 400);
    }

    const existingOrg = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1);

    if (existingOrg.error) throw new Error(existingOrg.error.message);

    let orgId = existingOrg.data?.[0]?.id as string | undefined;

    if (!orgId) {
      const org = await supabase
        .from("organizations")
        .insert({ name: cleanCompanyName, owner_user_id: user.id })
        .select("id")
        .single();

      if (org.error || !org.data?.id) {
        throw new Error(org.error?.message ?? "Failed to create organization.");
      }

      orgId = org.data.id;
    }

    const existingMember = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .limit(1);

    if (existingMember.error) throw new Error(existingMember.error.message);

    const memberId = existingMember.data?.[0]?.id as string | undefined;
    const richMemberPayload = {
      role: "owner",
      status: "active",
      display_name: cleanFullName || cleanEmail,
      email: cleanEmail,
      phone: cleanPhone || null,
      job_title: cleanJobTitle,
      portal_type: "admin",
      is_field_user: false,
      mobile_access_enabled: true,
      desktop_access_enabled: true,
    };

    if (memberId) {
      const richUpdate = await supabase.from("org_members").update(richMemberPayload).eq("id", memberId);

      if (richUpdate.error) {
        const fallbackUpdate = await supabase
          .from("org_members")
          .update({
            role: "owner",
            status: "active",
            display_name: cleanFullName || cleanEmail,
          })
          .eq("id", memberId);

        if (fallbackUpdate.error) throw new Error(fallbackUpdate.error.message);
      }
    } else {
      const richInsert = await supabase.from("org_members").insert({
        org_id: orgId,
        user_id: user.id,
        ...richMemberPayload,
      });

      if (richInsert.error) {
        const fallbackInsert = await supabase.from("org_members").insert({
          org_id: orgId,
          user_id: user.id,
          role: "owner",
          status: "active",
          display_name: cleanFullName || cleanEmail,
        });

        if (fallbackInsert.error) throw new Error(fallbackInsert.error.message);
      }
    }

    const profile = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        full_name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone || null,
        job_title: cleanJobTitle,
        company_name: cleanCompanyName,
      },
      { onConflict: "user_id" }
    );

    if (profile.error) throw new Error(profile.error.message);

    return json({ org_id: orgId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Failed to repair owner workspace." });
  }
});
