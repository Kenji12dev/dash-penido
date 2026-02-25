import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if table already has data
    const { count } = await supabase.from("sales").select("id", { count: "exact", head: true });
    if (count && count > 0) {
      return new Response(JSON.stringify({ message: "Sales already seeded", count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sales } = await req.json();
    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return new Response(JSON.stringify({ error: "No sales provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < sales.length; i += batchSize) {
      const batch = sales.slice(i, i + batchSize);
      const { error } = await supabase.from("sales").insert(batch);
      if (error) {
        console.error("Batch insert error:", error);
        return new Response(JSON.stringify({ error: error.message, inserted }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += batch.length;
    }

    return new Response(JSON.stringify({ message: "Seeded successfully", inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Seed error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
