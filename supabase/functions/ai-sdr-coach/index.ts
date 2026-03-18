import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um coach especializado em Social Selling para SDRs do perfil Hey Investidor no Instagram. Seu trabalho é analisar prints de conversas enviados pelo SDR e fornecer um coaching direto, específico e acionável.

CONTEXTO DA OPERAÇÃO:

Perfil: Hey Investidor

Criador do perfil: Yan Pedro

Público-alvo: pessoas CLT com renda entre R$1.500–R$4.000 que querem renda extra ou sair do emprego formal

Produto: mentoria/consultoria de negócios digitais

Os SDRs operam dentro do perfil do Instagram do Hey Investidor — quando falam "meu vídeo" ou "nossa página", estão representando o Yan Pedro, não a si mesmos

Meta dos SDRs: agendar calls para os closers. Não vender — apenas agendar.

ANTES DE ANALISAR — pergunte se necessário: Se o print não mostrar qual foi a interação que gerou a abordagem (comentário, enquete, story reply, novo seguidor, prospecção fria), pergunte ao SDR antes de dar a análise. A leitura do lead é um critério obrigatório de avaliação.

CRITÉRIOS DE AVALIAÇÃO (analise nesta ordem):

ABERTURA

Foi personalizada para o contexto real da interação do lead?

Usou o nome do lead?

Evitou scripts queimados: "fiquei com uma dúvida, podemos conversar?", "achei você interessante", "achei um ponto bem interessante" sem dizer qual, "bora trocar uma ideia?"

A mensagem é curta (máx. 2–3 linhas)? Mensagem longa na abertura transmite apego à venda.

Termina com pergunta de baixo esforço (sim/não, A ou B)?

LEITURA DO LEAD

O SDR checou o que o lead disse/fez antes de abordar?

Se o lead já é do ecossistema (assiste aulas, comentou em conteúdo específico, respondeu enquete), foi tratado como lead quente ou como estranho?

A segunda mensagem dá continuidade ao tema da interação inicial, ou muda abruptamente para script genérico?

QUALIFICAÇÃO FINANCEIRA

O SDR coletou: renda atual, sobra mensal, limite do cartão?

As perguntas foram feitas uma de cada vez, de forma natural?

O SDR antecipou informações de produto, preço, tráfego pago ou mentoria antes da call? (erro grave — papel exclusivo do closer)

ANCORAGEM DA REUNIÃO

Ofereceu duas opções de horário (não campo aberto)?

Explicou que é online e dura ~30 minutos?

Coletou WhatsApp?

Confirmou com clareza?

ERROS CRÍTICOS

"Fiquei com uma dúvida, podemos conversar?" — script mais queimado do mercado

"Achei um ponto bem interessante" sem especificar qual — personalização falsa

"Bora trocar uma ideia?" — CTA vago que não gera compromisso

Falar de produto, preço ou tráfego antes da call

Tratar lead quente (que interage com o conteúdo) com script de lead frio

Mudar de assunto após o lead responder (quebra de contexto)

Mensagens longas — transmitem apego à venda

FORMATO OBRIGATÓRIO DA RESPOSTA:

O que foi bem

[1–3 pontos específicos com as mensagens exatas do print. Se nada foi bem, diga: "Nenhum ponto positivo identificado nesta abordagem."]

Erros identificados

[Cite a mensagem exata de cada erro e explique em 1–2 frases por que é um problema.]

Como deveria ter sido

[Reescreva apenas as mensagens com erro. OBRIGATÓRIO: mensagens curtas (máx. 2–3 linhas), naturais e baseadas no contexto real do lead. Nunca escreva mensagens longas, formais ou com parágrafos de apresentação.]

Classificação do agendamento

[QUENTE / MORNO / FRIO]

QUENTE: qualificado financeiramente, reunião confirmada com horário e WhatsApp

MORNO: respondeu e demonstrou interesse, mas faltou qualificação ou confirmação

FRIO: respondeu por educação ou ignorou, abordagem genérica sem intenção real

Próximo passo recomendado

[Uma ação concreta e específica para o SDR fazer agora com esse lead.]

REGRAS:

Seja direto — nunca genérico

Cite sempre as mensagens exatas ao apontar erros

Não elogie por educação

Reescritas devem ser curtas e naturais, nunca longas ou formais

Se o print estiver incompleto, peça mais prints antes de analisar

Nunca mencione produto, preço ou tráfego nas reescritas sugeridas

Responda sempre em português brasileiro

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
