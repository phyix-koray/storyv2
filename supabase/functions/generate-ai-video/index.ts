import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fal.ai Model IDs (non-grok models)
const MODEL_SEEDANCE = "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
const MODEL_WAN = "fal-ai/wan/v2.6/image-to-video/flash";
const MODEL_VEO = "fal-ai/veo3.1/fast/image-to-video";
const MODEL_LTX = "fal-ai/ltx-2.3/image-to-video/fast";
const MODEL_HAILUO = "fal-ai/minimax/hailuo-02-fast/image-to-video";

const QUEUE_BASE = "https://queue.fal.run";
const XAI_API_BASE = "https://api.x.ai/v1";

const normalizeFalKey = (value: string | null): string => {
  if (!value) return "";
  let key = value.trim().replace(/^['"]|['"]$/g, "");
  if (key.startsWith("FAL_KEY=")) key = key.slice("FAL_KEY=".length).trim();
  if (key.toLowerCase().startsWith("key ")) key = key.slice(4).trim();
  if (key.toLowerCase().startsWith("bearer ")) key = key.slice(7).trim();
  return key;
};

const falFetch = async (url: string, token: string, method = "GET", body?: string) => {
  const headers: Record<string, string> = {
    Authorization: `Key ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  console.log(`[fal] ${method} ${url}`);
  const response = await fetch(url, { method, headers, ...(body ? { body } : {}) });
  const text = await response.text();
  console.log(`[fal] ${response.status}: ${text.slice(0, 500)}`);

  let result: any = null;
  try {
    result = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { response, result };
};

// ---- xAI API helpers for Grok Video ----
const xaiFetch = async (url: string, token: string, method = "GET", body?: string) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  console.log(`[xai] ${method} ${url}`);
  const response = await fetch(url, { method, headers, ...(body ? { body } : {}) });
  const text = await response.text();
  console.log(`[xai] ${response.status}: ${text.slice(0, 500)}`);

  let result: any = null;
  try {
    result = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { response, result };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      action,
      imageUrl,
      prompt,
      duration,
      requestId,
      aspect_ratio,
      resolution,
      camera_fixed,
      generate_audio,
      statusUrl,
      responseUrl,
      model,
    } = await req.json();

    const isGrok = model === "grok";

    // For Grok, use xAI direct API; for others, use Fal.ai
    if (isGrok) {
      const xaiKey = Deno.env.get("XAI_API_KEY");
      if (!xaiKey) {
        return new Response(JSON.stringify({ error: "XAI_API_KEY not configured." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "submit") {
        // xAI /v1/videos/generations
        const body: Record<string, unknown> = {
          model: "grok-imagine-video",
          prompt: prompt || "Animate this scene with subtle, natural movement",
        };

        // Image-to-video: pass image as { url }
        if (imageUrl) {
          body.image = { url: imageUrl };
        }

        if (aspect_ratio) body.aspect_ratio = aspect_ratio;

        // Duration: xAI supports 1-15 seconds, default 8
        const durNum = Number(duration) || 8;
        body.duration = Math.max(1, Math.min(15, durNum));

        if (resolution) body.resolution = resolution;

        const { response, result } = await xaiFetch(
          `${XAI_API_BASE}/videos/generations`,
          xaiKey,
          "POST",
          JSON.stringify(body),
        );

        if (!response.ok) {
          const errorMsg = result?.error?.message || result?.detail || JSON.stringify(result);
          return new Response(JSON.stringify({ error: `Video error: ${errorMsg}` }), {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // xAI returns { request_id }
        return new Response(
          JSON.stringify({
            requestId: result?.request_id,
            statusUrl: `${XAI_API_BASE}/videos/${result?.request_id}`,
            responseUrl: `${XAI_API_BASE}/videos/${result?.request_id}`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (action === "status") {
        // xAI GET /v1/videos/{request_id}
        const pollUrl = statusUrl || `${XAI_API_BASE}/videos/${requestId}`;
        const { response, result } = await xaiFetch(pollUrl, xaiKey);

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch status" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Map xAI statuses: "pending" | "done" | "expired" | "failed"
        const xaiStatus = result?.status;
        let mappedStatus = "IN_PROGRESS";
        if (xaiStatus === "done") mappedStatus = "COMPLETED";
        else if (xaiStatus === "failed" || xaiStatus === "expired") mappedStatus = "FAILED";

        return new Response(JSON.stringify({ status: mappedStatus }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "result") {
        const pollUrl = responseUrl || statusUrl || `${XAI_API_BASE}/videos/${requestId}`;
        const { response, result } = await xaiFetch(pollUrl, xaiKey);

        if (!response.ok) {
          return new Response(JSON.stringify({ error: "Failed to fetch result" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // xAI returns { status: "done", video: { url, duration }, model, progress }
        const videoUrl = result?.video?.url || null;

        return new Response(JSON.stringify({ videoUrl, status: result?.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Fal.ai models (non-grok) ----
    const FAL_MODEL =
      model === "ltx"
        ? MODEL_LTX
        : model === "hailuo"
          ? MODEL_HAILUO
          : model === "wan"
            ? MODEL_WAN
            : model === "veo"
              ? MODEL_VEO
              : model === "seedance"
                ? MODEL_SEEDANCE
                : MODEL_SEEDANCE; // default

    const token = normalizeFalKey(Deno.env.get("FAL_KEY") || null);
    if (!token) {
      return new Response(JSON.stringify({ error: "FAL_KEY not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "submit") {
      const body: Record<string, unknown> = {
        image_url: imageUrl,
        prompt: prompt || "Animate this scene with subtle, natural movement",
      };

      // Model-specific duration validation
      if (FAL_MODEL === MODEL_HAILUO) {
        const durNum = Number(duration) || 6;
        body.duration = durNum >= 8 ? "10" : "6";
      } else if (FAL_MODEL === MODEL_WAN) {
        const durNum = Number(duration) || 5;
        body.duration = durNum <= 7 ? "5" : durNum <= 12 ? "10" : "15";
      } else if (FAL_MODEL === MODEL_VEO) {
        const durNum = Number(duration) || 5;
        body.duration = durNum <= 7 ? "5" : durNum <= 12 ? "10" : "15";
      } else if (FAL_MODEL === MODEL_LTX) {
        const durNum = Number(duration) || 6;
        const validLtx = [6, 8, 10, 12, 14, 16, 18, 20];
        const closest = validLtx.reduce((prev, curr) => Math.abs(curr - durNum) < Math.abs(prev - durNum) ? curr : prev);
        body.num_frames = closest * 25;
      } else if (FAL_MODEL === MODEL_SEEDANCE) {
        const durNum = Number(duration) || 5;
        body.duration = String(Math.max(4, Math.min(12, durNum)));
      } else if (duration && duration !== "default") {
        body.duration = String(duration);
      }

      if (aspect_ratio) body.aspect_ratio = aspect_ratio;

      // Hailuo doesn't support resolution or generate_audio params
      if (FAL_MODEL !== MODEL_HAILUO) {
        if (resolution) body.resolution = resolution;
        if (camera_fixed === true) body.camera_fixed = true;
        body.generate_audio = generate_audio !== false;
      }

      const submitUrl = `${QUEUE_BASE}/${FAL_MODEL}`;
      const { response, result } = await falFetch(submitUrl, token, "POST", JSON.stringify(body));

      if (!response.ok) {
        const errorMsg = result?.detail || result?.message || JSON.stringify(result);
        return new Response(JSON.stringify({ error: `Video error: ${errorMsg}` }), {
          status: response.status >= 400 ? response.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          requestId: result?.request_id,
          statusUrl: result?.status_url,
          responseUrl: result?.response_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "status") {
      const candidateUrls: string[] = [];
      if (statusUrl) candidateUrls.push(statusUrl);
      if (responseUrl) {
        const derived = `${responseUrl.replace(/\/+$/, "")}/status`;
        candidateUrls.push(derived);
      }
      candidateUrls.push(`${QUEUE_BASE}/${FAL_MODEL}/requests/${requestId}/status`);

      for (const url of candidateUrls) {
        if (!url?.trim()) continue;
        const attempt = await falFetch(url, token);
        if (attempt.response.ok) {
          const status = attempt.result?.status || attempt.result?.request_status;
          return new Response(JSON.stringify({ status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(
        JSON.stringify({ error: "Failed to fetch status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "result") {
      const candidateUrls: string[] = [];
      if (responseUrl) {
        candidateUrls.push(responseUrl.replace(/\/+$/, ""));
      }
      candidateUrls.push(`${QUEUE_BASE}/${FAL_MODEL}/requests/${requestId}`);

      for (const url of candidateUrls) {
        if (!url?.trim()) continue;
        const attempt = await falFetch(url, token);
        if (attempt.response.ok) {
          const videoUrl =
            attempt.result?.video?.url ||
            attempt.result?.video_url ||
            attempt.result?.output?.video?.url ||
            null;
          return new Response(JSON.stringify({ videoUrl, status: attempt.result?.status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(
        JSON.stringify({ error: "Failed to fetch result" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
