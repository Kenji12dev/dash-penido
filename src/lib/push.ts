import { supabase } from "@/integrations/supabase/client";

// Notificacoes push no aparelho (Web Push + service worker em /sw.js).
// O aparelho se inscreve no push service do navegador e a inscricao fica em
// `push_subscriptions`; a edge function `send-push` usa essas linhas para avisar.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushSupport =
  | { ok: true }
  | { ok: false; reason: "no-key" | "no-sw" | "no-push" | "ios-not-installed" | "insecure" };

export const isIos = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export function getPushSupport(): PushSupport {
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-key" };
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "no-sw" };
  // No iPhone o push so existe com o app adicionado a Tela de Inicio.
  if (isIos() && !isStandalone()) return { ok: false, reason: "ios-not-installed" };
  if (!("PushManager" in window) || !("Notification" in window)) return { ok: false, reason: "no-push" };
  return { ok: true };
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker nao registrou:", err);
    });
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration() {
  return navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);
}

/** Inscricao ativa deste aparelho, se houver. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!getPushSupport().ok) return null;
  const reg = await getRegistration();
  return reg.pushManager.getSubscription();
}

/** Pede permissao, inscreve o aparelho e grava no banco para o usuario logado. */
export async function subscribeToPush(userId: string): Promise<{ error: string | null }> {
  const support = getPushSupport();
  if (!support.ok) return { error: "Este aparelho não suporta notificações." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Permissão de notificação negada. Libere nas configurações do navegador." };
  }

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
  }

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return { error: "Inscrição inválida." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh, auth, user_agent: navigator.userAgent.slice(0, 200) },
      { onConflict: "endpoint" },
    );

  return { error: error ? error.message : null };
}

/** Cancela a inscricao deste aparelho e apaga do banco. */
export async function unsubscribeFromPush(): Promise<{ error: string | null }> {
  const sub = await getCurrentSubscription();
  if (!sub) return { error: null };
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { error: error ? error.message : null };
}

/** Motivo real do erro: o supabase-js esconde o corpo da resposta em `error.context`. */
async function motivoDoErro(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
    } catch {
      // corpo sem JSON: cai na mensagem generica abaixo
    }
  }
  return (error as Error)?.message || "Falha ao enviar";
}

/**
 * Pede a edge function para mandar um push de teste ao usuario logado.
 * No iPhone o aviso nao aparece com o app aberto na frente, entao a function
 * espera `delay_seconds` no servidor (com a requisicao aberta) antes de enviar.
 * `agendado` = a conexao caiu porque a tela foi bloqueada, o envio segue la.
 */
export async function sendTestPush(): Promise<{ error: string | null; sent: number; agendado?: boolean }> {
  const { data, error } = await supabase.functions.invoke("send-push", {
    body: { action: "test", delay_seconds: 8 },
  });
  if (error) {
    if ((error as Error).name === "FunctionsFetchError") return { error: null, sent: 0, agendado: true };
    return { error: await motivoDoErro(error), sent: 0 };
  }
  if (data?.error) return { error: String(data.error), sent: 0 };
  return { error: null, sent: Number(data?.sent || 0) };
}
