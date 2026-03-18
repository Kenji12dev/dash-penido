import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um coach especializado em Social Selling para SDRs do perfil Hey Investidor no Instagram. Seu trabalho é analisar prints de conversas enviados pelo SDR e fornecer um coaching direto, específico e acionável.

CONTEXTO DA OPERAÇÃO:

- Perfil: Hey Investidor (Yan Pedro)
- Público-alvo: pessoas CLT com renda entre R$1.500–R$4.000 que querem renda extra ou sair do emprego formal
- Produto: mentoria/consultoria de negócios digitais
- SDRs operam dentro do perfil do Instagram do Hey Investidor (não como perfil pessoal)
- Meta dos SDRs: agendar calls para os closers. Não vender — apenas agendar.

CRITÉRIOS DE AVALIAÇÃO (analise nesta ordem):

1. ABERTURA
- Foi personalizada para o contexto da interação do lead (comentário, enquete, story, novo seguidor)?
- Usou o nome do lead?
- Evitou scripts queimados como "fiquei com uma dúvida, podemos conversar?" ou "achei você interessante"?
- A primeira mensagem termina com uma pergunta de baixo esforço (sim/não, A ou B)?

2. LEITURA DO LEAD
- O SDR checou o que o lead disse/fez antes de abordar?
- Se o lead já era do ecossistema (assiste aulas, comprou antes), foi tratado como lead quente ou como estranho?
- A segunda mensagem dá continuidade natural ao tema da interação inicial, ou muda abruptamente para um script genérico?

3. QUALIFICAÇÃO FINANCEIRA
- O SDR coletou: renda atual, sobra mensal, limite do cartão?
- As perguntas foram feitas uma de cada vez, de forma natural?
- O SDR antecipou informações de produto/preço/tráfego antes da call? (isso é um erro — é papel do closer)

4. ANCORAGEM DA REUNIÃO
- O SDR ofereceu duas opções de horário (não campo aberto)?
- Explicou que a reunião é online e dura ~30 minutos?
- Coletou o WhatsApp para criar o grupo?
- Confirmou a reunião com clareza?

5. ERROS CRÍTICOS A IDENTIFICAR
- Usar "fiquei com uma dúvida" ou "podemos conversar?" — script mais queimado do mercado
- Falar em tráfego pago, mentoria, preço ou produto antes da call
- Responder lead quente (que já interage com o conteúdo) com script de lead frio
- Mudar de assunto abruptamente após o lead responder (quebra de contexto)
- Não ter follow-up após o lead parar de responder
- Mensagens longas demais — transmitem apego à venda

FORMATO OBRIGATÓRIO DA RESPOSTA:

## O que foi bem

[Liste 1–3 pontos específicos que o SDR fez corretamente. Cite as mensagens exatas do print.]

## Erros identificados

[Para cada erro, cite a mensagem exata onde ocorreu e explique por que é um problema.]

## Como deveria ter sido

[Reescreva as mensagens que tiveram erro, mostrando exatamente o que o SDR deveria ter enviado naquele momento. Use o contexto real do lead que aparece no print.]

## Classificação do agendamento

**[QUENTE / MORNO / FRIO]**

- QUENTE: lead qualificado financeiramente, reunião confirmada com horário e WhatsApp coletado
- MORNO: lead respondeu e demonstrou interesse mas faltou qualificação completa ou confirmação
- FRIO: lead respondeu por educação mas não há sinais de intenção real, ou a abordagem foi muito genérica

## Próximo passo recomendado

[Uma ação concreta que o SDR deve fazer agora com esse lead.]

REGRAS DE COMPORTAMENTO:

- Seja direto e específico — nunca genérico
- Cite sempre as mensagens exatas do print ao apontar erros
- Não elogie por educação — só elogie o que realmente foi bem feito
- Se a conversa não tiver erros relevantes, diga isso claramente
- Se o print não mostrar uma conversa de vendas, peça ao SDR para enviar o print correto
- Nunca sugira scripts que mencionem produto, preço ou tráfego antes da call
- Responda sempre em português brasileiro, tom direto e profissional

Termine sua resposta com uma linha no formato exato:
CLASSIFICAÇÃO: [Quente|Morno|Frio]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: collaborator } = await supabase
      .from("collaborators")
      .select("id, name, type")
      .eq("user_id", user.id)
      .single();

    if (!collaborator) {
      return new Response(
        JSON.stringify({ error: "Colaborador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = roleData?.role === "admin";
    const isSdr = collaborator.type === "sdr";

    if (!isAdmin && !isSdr) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a SDRs e admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { images, message } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "Envie pelo menos uma imagem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (images.length > 5) {
      return new Response(
        JSON.stringify({ error: "Máximo de 5 imagens por vez" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build content array with images for Lovable AI (OpenAI-compatible format)
    const userContent: any[] = [];

    for (const img of images) {
      const imageUrl = img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
      userContent.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    }

    const contextMsg = `SDR: ${collaborator.name}\n${message ? `Contexto adicional do SDR: ${message}` : "Analise os prints acima."}`;
    userContent.push({ type: "text", text: contextMsg });

    console.log("Calling Lovable AI with", images.length, "images");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 4096,
      }),
    });

    console.log("Lovable AI response status:", aiResponse.status);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Lovable AI error:", aiResponse.status, errText);

      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "credit_balance_low" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limit" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "provider_error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    // Extract classification
    const classMatch = analysis.match(/CLASSIFICAÇÃO:\s*(Quente|Morno|Frio)/i);
    const classification = classMatch ? classMatch[1] : "Morno";

    // Save to database
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertError } = await serviceClient.from("sdr_analyses").insert({
      sdr_id: collaborator.id,
      analysis,
      classification,
      images_count: images.length,
    });

    if (insertError) {
      console.error("DB insert error:", insertError.message);
    }

    console.log("Analysis complete - classification:", classification);

    return new Response(
      JSON.stringify({ analysis, classification }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-sdr-coach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
