import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LANGUAGE_NAMES: Record<string, string> = {
  tr: "Turkish",
  en: "English",
  zh: "Mandarin Chinese",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  pt: "Portuguese",
  id: "Indonesian",
};

function buildScenesSummary(scenes: any[]): string {
  return (scenes || [])
    .map((scene: any, index: number) => {
      const dialogueText = Array.isArray(scene?.dialogues)
        ? scene.dialogues
            .map((dialogue: any) => [dialogue?.character, dialogue?.text].filter(Boolean).join(": "))
            .filter(Boolean)
            .join(" | ")
        : "";
      const parts = [
        scene?.description,
        scene?.narration,
        scene?.text,
        dialogueText,
      ].filter((value) => typeof value === "string" && value.trim().length > 0);

      return `Scene ${index + 1}: ${parts.join(" — ")}`;
    })
    .join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { storyTopic, scenes, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lang = typeof language === "string" && language.trim() ? language.trim().toLowerCase() : "tr";
    const targetLanguage = LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.en;
    const scenesSummary = buildScenesSummary(scenes || []);

    const systemPrompt = `You are a social media content strategist for short-form video platforms.
Rules:
- Write exactly one viral caption for Instagram Reels, TikTok and YouTube Shorts
- The final caption must be written strictly in ${targetLanguage}
- Use dramatic, curiosity-driven storytelling with strong emotional pull
- Make it feel like a shocking episode recap or cliffhanger
- Use 2-4 fitting emojis, not more
- Add 5-8 hashtags after the caption
- Keep the main caption around 150-300 characters excluding hashtags
- Return only the final caption text`;

    const userPrompt = `Story topic: ${storyTopic || "Unknown"}
Scenes:
${scenesSummary || "No scene details provided."}

Write a viral short-form social media caption in ${targetLanguage}.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const caption = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ caption }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-social-caption error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
