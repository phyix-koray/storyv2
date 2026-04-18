import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query, page, minDuration, maxDuration } = await req.json();

    // Use Freesound API for royalty-free music search
    const FREESOUND_API_KEY = Deno.env.get("FREESOUND_API_KEY");
    if (!FREESOUND_API_KEY) {
      return new Response(JSON.stringify({ error: "FREESOUND_API_KEY not configured. Please add it in Cloud secrets." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const params = new URLSearchParams({
      query: query || "background music",
      page: String(page || 1),
      page_size: "10",
      fields: "id,name,duration,previews,tags",
      filter: `duration:[${minDuration || 5} TO ${maxDuration || 600}]`,
      token: FREESOUND_API_KEY,
    });

    const response = await fetch(`https://freesound.org/apiv2/search/text/?${params}`);
    const data = await response.json();

    const results = (data.results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      duration: r.duration,
      previewUrl: r.previews?.["preview-hq-mp3"] || r.previews?.["preview-lq-mp3"],
      tags: r.tags,
    }));

    return new Response(JSON.stringify({ results, count: data.count, next: data.next }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
