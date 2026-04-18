import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { image, script, storyTopic, language, sentenceCount } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `Analyze this image and identify characters. Return JSON with:
- characters: array of { id, name, description, position }
- script: array of { character_id, character_name, text } with ${sentenceCount || 2} lines of dialogue in ${language || "tr"}.
${script ? `Use this script as basis: ${script}` : ""}
${storyTopic ? `Story topic: ${storyTopic}` : ""}

Analyze this image, identify characters, and create dialogue.`;

    // Extract base64 data and mime type from data URL
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : "image/png";
    const base64Data = matches ? matches[2] : image;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      throw new Error("No text response from Gemini.");
    }

    const content = JSON.parse(textContent);

    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
