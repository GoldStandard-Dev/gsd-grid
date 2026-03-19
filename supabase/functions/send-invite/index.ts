import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  try {
    console.log("send-invite called");

    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    const { email, invite_id, app_url } = await req.json();

    console.log("payload received", { email, invite_id, app_url });

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
      console.error("Missing RESEND_API_KEY");
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

    const resendPayload = {
      from: "GSD Grid <invite@gsdgrid.com>",
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
    };

    console.log("sending email via resend");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    const data = await resendRes.json();

    console.log("resend response", { status: resendRes.status, data });

    return new Response(JSON.stringify(data), {
      status: resendRes.ok ? 200 : resendRes.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("send-invite fatal error", err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});