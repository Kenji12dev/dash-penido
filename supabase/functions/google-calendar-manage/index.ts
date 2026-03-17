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

async function getAccessToken(supabase: any, collaboratorId: string): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("collaborator_id", collaboratorId)
    .single();

  if (!tokenRow) return null;

  let accessToken = tokenRow.access_token;

  if (new Date(tokenRow.token_expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    if (!refreshed) return null;
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_tokens")
      .update({ access_token: accessToken, token_expires_at: newExpiry })
      .eq("collaborator_id", collaboratorId);
  }

  return accessToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, collaborator_id, event_id, event_data } = body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const accessToken = await getAccessToken(supabase, collaborator_id);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Google Calendar não vinculado ou token expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // CREATE
    if (action === "create") {
      const event = buildGoogleEvent(event_data);
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(event),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: data.error?.message || "Erro ao criar evento" }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, event: mapEvent(data) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE
    if (action === "update") {
      if (!event_id) {
        return new Response(
          JSON.stringify({ error: "event_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const event = buildGoogleEvent(event_data);
      const res = await fetch(`${baseUrl}/${event_id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(event),
      });
      const data = await res.json();
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: data.error?.message || "Erro ao atualizar evento" }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, event: mapEvent(data) }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE
    if (action === "delete") {
      if (!event_id) {
        return new Response(
          JSON.stringify({ error: "event_id required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const res = await fetch(`${baseUrl}/${event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: data.error?.message || "Erro ao excluir evento" }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "action must be create, update, or delete" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildGoogleEvent(data: any) {
  const event: any = {
    summary: data.summary,
    description: data.description || "",
    location: data.location || "",
  };

  if (data.all_day) {
    event.start = { date: data.date };
    event.end = { date: data.date };
  } else {
    event.start = {
      dateTime: `${data.date}T${data.start_time}:00`,
      timeZone: "America/Sao_Paulo",
    };
    event.end = {
      dateTime: `${data.date}T${data.end_time}:00`,
      timeZone: "America/Sao_Paulo",
    };
  }

  return event;
}

function mapEvent(ev: any) {
  return {
    id: ev.id,
    summary: ev.summary || "(Sem título)",
    description: ev.description || "",
    start: ev.start?.dateTime || ev.start?.date || "",
    end: ev.end?.dateTime || ev.end?.date || "",
    htmlLink: ev.htmlLink,
    location: ev.location || "",
    status: ev.status,
  };
}
