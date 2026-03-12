import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const { email, invite_id, app_url } = await req.json();

    if (!email || !invite_id) {
      return new Response(JSON.stringify({ error: "Missing email or invite_id." }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY." }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const baseUrl = app_url || "http://localhost:8081";
    const inviteLink = `${baseUrl}/accept-invite?id=${invite_id}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GSD Grid <onboarding@resend.dev>",
        to: email,
        subject: "You're invited to GSD Grid",
        html: `
          <div style="font-family:Arial,sans-serif;color:#111;padding:24px;">
            <h2 style="margin:0 0 12px;">You’ve been invited to GSD Grid</h2>
            <p style="margin:0 0 18px;line-height:1.6;">
              Click the button below to sign in and accept your team invite.
            </p>
            <a href="${inviteLink}"
               style="display:inline-block;padding:12px 18px;background:#D4AF37;color:#111;text-decoration:none;border-radius:8px;font-weight:700;">
              Accept Invite
            </a>
            <p style="margin:18px 0 0;line-height:1.6;color:#666;">
              If you did not expect this invite, you can ignore this email.
            </p>
          </div>
        `,
      }),
    });

    const data = await resendRes.json();

    return new Response(JSON.stringify(data), {
      status: resendRes.ok ? 200 : resendRes.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});