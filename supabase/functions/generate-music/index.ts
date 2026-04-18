import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUEUE_BASE = "https://queue.fal.run";
const MODEL = "cassetteai/music-generator";

function normalizeFalKey(value: string | null): string {
  if (!value) return "";
  return value.replace(/^(FAL_KEY=|Key\s+|Bearer\s+)/i, "").trim();
}

async function falFetch(url: string, token: string, method = "GET", body?: string) {
  const headers: Record<string, string> = {
    Authorization: `Key ${token}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, { method, headers, ...(body ? { body } : {}) });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: { raw: text } };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, prompt, duration, request_id } = await req.json();
    const FAL_KEY = normalizeFalKey(Deno.env.get("FAL_KEY"));
    if (!FAL_KEY) {
      return new Response(JSON.stringify({ error: "FAL_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit a new music generation request
    if (action === "submit") {
      if (!prompt || !duration) {
        return new Response(JSON.stringify({ error: "prompt and duration are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const clampedDuration = Math.round(Math.min(Math.max(1, duration), 180));

      const submitUrl = `${QUEUE_BASE}/${MODEL}`;
      const result = await falFetch(submitUrl, FAL_KEY, "POST", JSON.stringify({
        prompt,
        duration: clampedDuration,
      }));

      console.log("Music submit response:", result.status, JSON.stringify(result.data));

      if (result.status >= 400) {
        return new Response(JSON.stringify({ error: "Failed to submit music generation", details: result.data }), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requestId = result.data.request_id;
      return new Response(JSON.stringify({ request_id: requestId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check status
    if (action === "status") {
      if (!request_id) {
        return new Response(JSON.stringify({ error: "request_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusUrl = `${QUEUE_BASE}/${MODEL}/requests/${request_id}/status`;
      const result = await falFetch(statusUrl, FAL_KEY);
      console.log("Music status:", result.status, JSON.stringify(result.data));

      const status = result.data.status || "UNKNOWN";
      return new Response(JSON.stringify({ status, details: result.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get result
    if (action === "result") {
      if (!request_id) {
        return new Response(JSON.stringify({ error: "request_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resultUrl = `${QUEUE_BASE}/${MODEL}/requests/${request_id}`;
      const result = await falFetch(resultUrl, FAL_KEY);
      console.log("Music result:", result.status);

      if (result.status >= 400) {
        return new Response(JSON.stringify({ error: "Failed to get result", details: result.data }), {
          status: result.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const audioUrl = result.data?.audio_file?.url || result.data?.data?.audio_file?.url;
      return new Response(JSON.stringify({ audio_url: audioUrl, raw: result.data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use submit, status, or result" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-music error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
