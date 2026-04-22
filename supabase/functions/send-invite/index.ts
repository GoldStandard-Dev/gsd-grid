import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, invite_id, app_url } = await req.json();

    if (!email || !invite_id) {
      return new Response(JSON.stringify({ error: "Missing email or invite_id." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const baseUrl = app_url || Deno.env.get("SITE_URL") || "https://gsdgrid.com";
    const redirectTo = `${baseUrl}/accept-invite?id=${invite_id}`;

    // Use Supabase's built-in invite — creates the auth account and sends the branded email
    const { error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });

    if (error) {
      // If user already has an account, send a magic link to the accept page instead
      if (error.message.includes("already") || error.status === 422) {
        const { error: magicError } = await supabase.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });
        if (magicError) {
          return new Response(JSON.stringify({ error: magicError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true, method: "magiclink" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, method: "invite" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
