import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um coach de SDRs especializado em Social Selling para o perfil Hey Investidor no Instagram. O público-alvo são pessoas CLT que querem renda extra ou sair do emprego formal. Analise a conversa nos prints enviados e avalie: (1) qualidade da abertura, (2) personalização da mensagem ao contexto do lead, (3) qualificação financeira feita — renda, sobra mensal, limite do cartão, (4) ancoragem da reunião, (5) erros cometidos. Ao final, reescreva a mensagem que deveria ter sido enviada em cada etapa onde houve erro. Seja direto e específico — cite as mensagens exatas do print.

Ao final da análise, classifique o agendamento em uma das categorias:
- **Quente**: qualificação completa, lead engajado, objeções tratadas
- **Morno**: qualificação parcial, lead respondeu mas sem profundidade
- **Frio**: sem qualificação, lead desinteressado ou abordagem fraca

Termine sua resposta com uma linha no formato exato:
CLASSIFICAÇÃO: [Quente|Morno|Frio]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get collaborator info
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

    // Check role
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
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build message content with images
    const userContent: any[] = [];

    for (const img of images) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
        },
      });
    }

    const contextMsg = `SDR: ${collaborator.name}\n${message ? `Contexto adicional do SDR: ${message}` : "Analise os prints acima."}`;
    userContent.push({ type: "text", text: contextMsg });

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar análise" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    // Extract classification
    const classMatch = analysis.match(/CLASSIFICAÇÃO:\s*(Quente|Morno|Frio)/i);
    const classification = classMatch ? classMatch[1] : "Morno";

    // Save to database using service role for insert
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceClient.from("sdr_analyses").insert({
      sdr_id: collaborator.id,
      analysis,
      classification,
      images_count: images.length,
    });

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
