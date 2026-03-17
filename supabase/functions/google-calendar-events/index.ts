import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return null;
  return { access_token: data.access_token, expires_in: data.expires_in };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { collaborator_id, time_min, time_max } = await req.json();

    if (!collaborator_id) {
      return new Response(JSON.stringify({ error: "collaborator_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tokenRow } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("collaborator_id", collaborator_id)
      .single();

    if (!tokenRow) {
      return new Response(
        JSON.stringify({ error: "Google Calendar não vinculado", events: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenRow.access_token;

    // Refresh if expired
    if (new Date(tokenRow.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Token expirado. Re-vincule o Google Calendar." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase
        .from("google_calendar_tokens")
        .update({ access_token: accessToken, token_expires_at: newExpiry })
        .eq("collaborator_id", collaborator_id);
    }

    // Fetch events from Google Calendar
    const now = new Date();
    const defaultMin = time_min || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const defaultMax = time_max || new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString();

    const params = new URLSearchParams({
      timeMin: defaultMin,
      timeMax: defaultMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const calData = await calRes.json();

    if (!calRes.ok) {
      return new Response(
        JSON.stringify({ error: calData.error?.message || "Erro ao buscar eventos" }),
        { status: calRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const events = (calData.items || []).map((ev: any) => ({
      id: ev.id,
      summary: ev.summary || "(Sem título)",
      description: ev.description || "",
      start: ev.start?.dateTime || ev.start?.date || "",
      end: ev.end?.dateTime || ev.end?.date || "",
      htmlLink: ev.htmlLink,
      location: ev.location || "",
      status: ev.status,
    }));

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
