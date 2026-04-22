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
    const { email, password, full_name, company_name, phone, job_title } = await req.json();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const cleanCompanyName = String(company_name ?? "").trim();
    const cleanFullName = String(full_name ?? "").trim();
    const cleanPhone = String(phone ?? "").trim();
    const cleanJobTitle = String(job_title ?? "").trim() || "Owner";

    if (!cleanEmail || !password) {
      return json({ error: "Email and password are required." }, 400);
    }

    if (!cleanCompanyName) {
      return json({ error: "Company name is required." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanFullName,
        company_name: cleanCompanyName,
        phone: cleanPhone || null,
        job_title: cleanJobTitle,
        role: "owner",
        portal_type: "admin",
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      const friendlyMsg =
        msg.includes("already") || msg.includes("registered") || msg.includes("exist")
          ? "An account with this email already exists. Please sign in instead."
          : error.message;

      return json({ error: friendlyMsg });
    }

    const userId = data.user.id;
    let orgId = "";

    try {
      const org = await supabase
        .from("organizations")
        .insert({ name: cleanCompanyName, owner_user_id: userId })
        .select("id")
        .single();

      if (org.error || !org.data?.id) {
        throw new Error(org.error?.message ?? "Failed to create organization.");
      }

      orgId = org.data.id;

      const richMember = await supabase.from("org_members").insert({
        org_id: orgId,
        user_id: userId,
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
      });

      if (richMember.error) {
        const fallbackMember = await supabase.from("org_members").insert({
          org_id: orgId,
          user_id: userId,
          role: "owner",
          status: "active",
          display_name: cleanFullName || cleanEmail,
        });

        if (fallbackMember.error) {
          throw new Error(fallbackMember.error.message);
        }
      }

      const profile = await supabase.from("profiles").upsert(
        {
          user_id: userId,
          full_name: cleanFullName,
          email: cleanEmail,
          phone: cleanPhone || null,
          job_title: cleanJobTitle,
          company_name: cleanCompanyName,
        },
        { onConflict: "user_id" }
      );

      if (profile.error) throw new Error(profile.error.message);

      await supabase.from("activity_log").insert({
        org_id: orgId,
        actor_user_id: userId,
        actor_name: cleanFullName || cleanEmail,
        action: "created organization",
        entity_type: "organization",
        entity_id: orgId,
      });
    } catch (setupError) {
      await supabase.auth.admin.deleteUser(userId);
      return json({
        error: setupError instanceof Error ? setupError.message : "Failed to create owner workspace.",
      });
    }

    return json({ user_id: userId, org_id: orgId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});
