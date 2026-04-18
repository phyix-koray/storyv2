import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateImage(prompt: string, apiKey: string): Promise<string | null> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI gateway error: ${response.status} ${errText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.images?.[0]?.image_url?.url || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { image, characters, script, mode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const frames: any[] = [];

    if (mode === "mouth-open") {
      for (const char of characters || []) {
        const prompt = `Edit this image: make ${char.name}'s mouth open as if speaking. Keep everything else identical. Original scene description preserved.`;
        const imageUrl = await generateImage(prompt, LOVABLE_API_KEY);
        if (imageUrl) {
          frames.push({ characterId: char.id, characterName: char.name, imageUrl });
        }
      }
    } else {
      for (let i = 0; i < (script || []).length; i++) {
        const line = script[i];
        const prompt = `Illustration of a scene where ${line.character_name} is speaking: "${line.text}". Mouth open, expressive.`;
        const imageUrl = await generateImage(prompt, LOVABLE_API_KEY);
        if (imageUrl) {
          frames.push({ index: i, speakingCharacter: line.character_name, text: line.text, imageUrl });
        }
      }
    }

    return new Response(JSON.stringify({ frames }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
