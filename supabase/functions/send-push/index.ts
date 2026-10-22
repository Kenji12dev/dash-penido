import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Manda notificacao push (Web Push / VAPID) para os aparelhos cadastrados em
// `push_subscriptions`.
//
// Dois modos:
//  - Webhook do banco: o trigger `sales_push_notify` chama com o header
//    `x-push-secret` e o corpo {type, record, old_record, actor}. A function
//    decide quem avisar a partir do que mudou na venda.
//  - Teste pelo painel: o usuario logado chama com Authorization e corpo
//    {action: "test"} e recebe um push nos proprios aparelhos.
//
// Segredos (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// (base64url cru, como o `web-push` gera), PUSH_WEBHOOK_SECRET e, opcional,
// VAPID_SUBJECT (mailto:...).
//
// NOTA: este arquivo e deliberadamente ASCII puro. O editor de functions do
// painel do Supabase corrompe acentos colados. Texto acentuado entra por \u.

const STATUS_APLICACAO = "Aplica\u00e7\u00e3o";
const STATUS_PENDENTE = "Pendente";
const STATUS_PAGO = "Pago";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface SaleRow {
  id: string;
  date: string;
  client_name: string;
  product: string;
  gross_value: number | string;
  closer: string;
  sdr: string;
  status: string;
  lead_source: string | null;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidReady = false;

function setupVapid() {
  if (vapidReady) return;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  if (!publicKey || !privateKey) throw new Error("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY nao configuradas");
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:oandrekenji@gmail.com", publicKey, privateKey);
  vapidReady = true;
}

// ---------------------------------------------------------------------------
// Quem avisar
// ---------------------------------------------------------------------------

const fmtDataHora = (iso: string) => {
  try {
    const d = new Date(iso);
    const data = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
    }).format(d);
    const hora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `${data} ${hora}`;
  } catch {
    return "";
  }
};

const fmtReais = (v: number | string) =>
  "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Decision {
  payload: PushPayload;
  // Nomes de colaborador (closer/sdr) que devem receber.
  collaboratorNames: string[];
  // Tipos de colaborador que recebem em bloco ("sdr").
  collaboratorTypes: string[];
  // Admins recebem tambem.
  admins: boolean;
}

function decide(type: string, rec: SaleRow, old: SaleRow | null): Decision | null {
  const statusMudou = type === "INSERT" || (old !== null && old.status !== rec.status);
  const closerMudou = type === "UPDATE" && old !== null && old.closer !== rec.closer;

  // Lead novo (formulario externo ou cartao criado na coluna Aplicacoes).
  if (type === "INSERT" && rec.status === STATUS_APLICACAO) {
    const origem = rec.lead_source ? ` \u00b7 ${rec.lead_source}` : "";
    return {
      payload: {
        title: "Novo lead",
        body: `${rec.client_name}${origem}`,
        url: "/?tab=kanban",
        tag: `lead-${rec.id}`,
      },
      collaboratorNames: [],
      collaboratorTypes: ["sdr"],
      admins: true,
    };
  }

  // Agendamento novo, lead movido para Agendado/Pendente ou closer trocado.
  if (rec.status === STATUS_PENDENTE && rec.closer && (statusMudou || closerMudou)) {
    const quando = fmtDataHora(rec.date);
    return {
      payload: {
        title: "Novo agendamento",
        body: `${rec.client_name} \u2014 ${rec.product}${quando ? ` \u00b7 ${quando}` : ""}`,
        url: "/?tab=agenda",
        tag: `agendamento-${rec.id}`,
      },
      collaboratorNames: [rec.closer],
      collaboratorTypes: [],
      admins: false,
    };
  }

  // Venda paga: avisa os admins.
  if (statusMudou && rec.status === STATUS_PAGO) {
    return {
      payload: {
        title: "Venda paga",
        body: `${rec.client_name} \u2014 ${rec.product} \u00b7 ${fmtReais(rec.gross_value)}`,
        url: "/?tab=dashboard",
        tag: `pago-${rec.id}`,
      },
      collaboratorNames: [],
      collaboratorTypes: [],
      admins: true,
    };
  }

  return null;
}

// deno-lint-ignore no-explicit-any
async function resolveUserIds(admin: any, d: Decision): Promise<Set<string>> {
  const ids = new Set<string>();

  if (d.collaboratorNames.length > 0 || d.collaboratorTypes.length > 0) {
    const { data } = await admin.from("collaborators").select("name, type, user_id");
    for (const c of data || []) {
      if (!c.user_id) continue;
      if (d.collaboratorNames.includes(c.name) || d.collaboratorTypes.includes(c.type)) ids.add(c.user_id);
    }
  }

  if (d.admins) {
    const { data } = await admin.from("user_roles").select("user_id").eq("role", "admin");
    for (const r of data || []) ids.add(r.user_id);
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function sendToUsers(admin: any, userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0, removed: 0, failed: 0 };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const rows: SubscriptionRow[] = subs || [];
  if (rows.length === 0) return { sent: 0, removed: 0, failed: 0 };

  setupVapid();
  const message = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          message,
          { TTL: 60 * 60 * 24, urgency: "high", topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode ?? 0;
        // 404/410: o aparelho cancelou a inscricao. Limpa a linha.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
        } else {
          failed++;
          console.error("push falhou", row.endpoint.slice(0, 60), String(err));
        }
      }
    }),
  );

  return { sent, removed, failed };
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

// Call nos proximos 30 min: avisa o closer uma unica vez (call_reminder_sent_at).
// deno-lint-ignore no-explicit-any
async function callReminders(admin: any) {
  const agora = new Date();
  const limite = new Date(agora.getTime() + 30 * 60 * 1000);
  const { data } = await admin
    .from("sales")
    .select("id, date, client_name, product, closer")
    .eq("status", STATUS_PENDENTE)
    .is("call_reminder_sent_at", null)
    .gte("date", agora.toISOString())
    .lte("date", limite.toISOString());

  let reminders = 0;
  for (const sale of data || []) {
    // Marca primeiro: se o envio falhar, melhor perder um aviso que repetir a cada 5 min.
    await admin.from("sales").update({ call_reminder_sent_at: agora.toISOString() }).eq("id", sale.id);
    const ids = await resolveUserIds(admin, {
      payload: { title: "", body: "", url: "", tag: "" },
      collaboratorNames: [sale.closer],
      collaboratorTypes: [],
      admins: false,
    });
    const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })
      .format(new Date(sale.date));
    await sendToUsers(admin, Array.from(ids), {
      title: "Call em 30 minutos",
      body: `${sale.client_name} \u2014 ${sale.product} \u00b7 ${hora}`,
      url: "/?tab=agenda",
      tag: `call-${sale.id}`,
    });
    reminders++;
  }
  return { reminders };
}

// 19h: SDR com login que ainda nao lancou o diario de hoje (data de Brasilia).
// deno-lint-ignore no-explicit-any
async function sdrDailyReminder(admin: any) {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { data: sdrs } = await admin.from("collaborators").select("user_id").eq("type", "sdr");
  const { data: feitos } = await admin.from("sdr_daily_metrics").select("user_id").eq("date", hoje);
  const jaFez = new Set((feitos || []).map((r: { user_id: string }) => r.user_id));
  const ids = (sdrs || [])
    .map((c: { user_id: string | null }) => c.user_id)
    .filter((id: string | null): id is string => !!id && !jaFez.has(id));
  const result = await sendToUsers(admin, ids, {
    title: "Di\u00e1rio em aberto",
    body: "Voc\u00ea ainda n\u00e3o lan\u00e7ou os n\u00fameros de hoje.",
    url: "/?tab=pre-sales",
    tag: `diario-${hoje}`,
  });
  return { recipients: ids.length, ...result };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Corpo invalido" }, 400);
  }

  try {
    // --- Modo webhook (trigger do banco) e cron -----------------------------
    const secret = Deno.env.get("PUSH_WEBHOOK_SECRET") || "";
    const given = req.headers.get("x-push-secret") || "";
    if (given) {
      if (!secret || given !== secret) return json({ error: "Unauthorized" }, 401);

      if (body.action === "call_reminders") return json({ ok: true, ...(await callReminders(admin)) });
      if (body.action === "sdr_daily_reminder") return json({ ok: true, ...(await sdrDailyReminder(admin)) });

      const type = String(body.type || "");
      const rec = body.record as SaleRow | null;
      const old = (body.old_record as SaleRow | null) || null;
      const actor = typeof body.actor === "string" ? body.actor : null;
      if (!rec) return json({ ok: true, skipped: "sem record" });

      const decision = decide(type, rec, old);
      if (!decision) return json({ ok: true, skipped: "nada a avisar" });

      const ids = await resolveUserIds(admin, decision);
      if (actor) ids.delete(actor);

      const result = await sendToUsers(admin, Array.from(ids), decision.payload);
      return json({ ok: true, ...result, recipients: ids.size });
    }

    // --- Modo usuario logado (teste pelo painel) ----------------------------
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    if (body.action === "test") {
      // Espera no servidor: no iPhone o aviso so aparece com o app em segundo plano.
      const atraso = Math.min(Math.max(Number(body.delay_seconds) || 0, 0), 20);
      if (atraso > 0) await new Promise((r) => setTimeout(r, atraso * 1000));
      const result = await sendToUsers(admin, [caller.id], {
        title: "Notifica\u00e7\u00f5es ativas",
        body: "Este aparelho vai receber os avisos do painel.",
        url: "/?tab=profile",
        tag: "teste",
      });
      return json({ ok: true, ...result });
    }

    return json({ error: "A\u00e7\u00e3o desconhecida" }, 400);
  } catch (err) {
    console.error("send-push erro", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
