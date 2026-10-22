import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recebe as respostas do "Formulario - Grupo Penido" (Respondi) e cria um
// cartao na coluna "Aplicacao" do Kanban de vendas.
//
// O Respondi nao assina o webhook nem manda Authorization, entao esta function
// roda com verify_jwt desligado e so aceita os formularios listados em
// ORIGEM_POR_FORMULARIO. Reenvio da mesma resposta nao duplica o cartao
// (indice unico em external_submission_id).
//
// NOTA: este arquivo e deliberadamente ASCII puro. O editor de functions do
// painel do Supabase corrompe acentos colados. Texto acentuado entra por \u.

const STATUS_APLICACAO = "Aplica\u00e7\u00e3o";

// id do formulario no Respondi -> origem (selo do cartao no Kanban).
const ORIGEM_POR_FORMULARIO: Record<string, string> = {
  ogrYSgaf: "Formul\u00e1rio", // Formulario - Grupo Penido
};

const CAMPOS_CONTATO = ["nome", "whatsapp", "instagram"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Tira acento e caixa, para o casamento da pergunta nao depender de diacritico. */
const normalizar = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** "1.Qual e o seu nome?" -> "Qual e o seu nome" */
const limparPergunta = (s: string) =>
  String(s || "").trim().replace(/^\d+\s*[.)-]\s*/, "").replace(/[?:]+$/, "").trim();

const textoDe = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(textoDe).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Telefone costuma vir como {country, phone} ou parecido.
    if (o.phone || o.number) return [o.country ?? o.ddi ?? "", o.phone ?? o.number].filter(Boolean).join(" ");
    return Object.values(o).map(textoDe).filter(Boolean).join(" ");
  }
  return String(v).trim();
};

/** Junta os formatos que o Respondi pode mandar numa lista [pergunta, resposta]. */
// deno-lint-ignore no-explicit-any
function extrairRespostas(respondent: any): { pergunta: string; valor: string }[] {
  const out: { pergunta: string; valor: string }[] = [];
  const raw = respondent?.raw_answers;
  if (Array.isArray(raw) && raw.length) {
    for (const r of raw) {
      const pergunta = r?.question?.question_title ?? r?.question_title ?? r?.title ?? "";
      out.push({ pergunta: limparPergunta(pergunta), valor: textoDe(r?.answer ?? r?.value) });
    }
    return out;
  }
  const answers = respondent?.answers;
  if (answers && typeof answers === "object" && !Array.isArray(answers)) {
    for (const [k, v] of Object.entries(answers)) out.push({ pergunta: limparPergunta(k), valor: textoDe(v) });
  } else if (Array.isArray(answers)) {
    for (const a of answers) {
      out.push({ pergunta: limparPergunta(a?.question ?? a?.title ?? a?.label ?? ""), valor: textoDe(a?.answer ?? a?.value) });
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    console.log("respondi payload:", rawBody.slice(0, 4000));

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Corpo invalido" }, 400);
    }

    const form = payload.form ?? {};
    const respondent = payload.respondent ?? payload.response ?? {};
    const formId = String(form.form_id ?? form.id ?? payload.form_id ?? "");
    const origem = ORIGEM_POR_FORMULARIO[formId];
    if (!origem) {
      console.warn("formulario nao aceito:", formId);
      return json({ error: "Formulario nao aceito" }, 403);
    }

    const respostas = extrairRespostas(respondent);
    const achar = (trecho: string) =>
      respostas.find((r) => normalizar(r.pergunta).includes(trecho))?.valor ?? "";

    const nome = achar("nome");
    const whatsapp = achar("whatsapp");
    const instagram = achar("instagram");
    if (!nome) return json({ error: "Resposta sem nome" }, 400);

    const submissionId = String(
      respondent.respondent_id ?? respondent.id ?? payload.respondent_id ?? payload.id ?? "",
    );
    if (!submissionId) return json({ error: "Resposta sem id" }, 400);

    // Toda pergunta que nao e contato vira "Pergunta: resposta" por linha.
    const formAnswers = respostas
      .filter((r) => r.valor && !CAMPOS_CONTATO.some((c) => normalizar(r.pergunta).includes(c)))
      .map((r) => `${r.pergunta}: ${r.valor}`)
      .join("\n");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { error } = await admin.from("sales").upsert(
      {
        date: respondent.date ?? respondent.created_at ?? new Date().toISOString(),
        client_name: nome.slice(0, 200),
        product: "",
        gross_value: 0,
        net_value: 0,
        payment_method: "",
        closer: "",
        sdr: "",
        status: STATUS_APLICACAO,
        lead_source: origem,
        notes: "",
        form_answers: formAnswers,
        whatsapp: whatsapp.slice(0, 60),
        instagram: instagram.slice(0, 120),
        external_submission_id: `respondi:${submissionId}`,
      },
      { onConflict: "external_submission_id", ignoreDuplicates: true },
    );

    if (error) {
      console.error("Falha ao gravar aplicacao:", error.message);
      return json({ error: error.message }, 500);
    }
    return json({ ok: true });
  } catch (err) {
    console.error("Erro inesperado:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
