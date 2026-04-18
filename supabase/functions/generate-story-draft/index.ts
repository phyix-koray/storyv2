import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      storyTopic, frameCount: rawFrameCount, artStyle, characters, objectAssets,
      perFrameMode, perFrameContext, storyMode,
      category, categoryMode: catMode, lawCountry,
      webSearch,
    } = body;

    const storyLanguage = body.storyLanguage || body.language || "tr";
    const framePrompts = body.framePrompts || body.frameDescriptions;

    // Auto frame count: when web search/documentary is on and user didn't pick a count,
    // default to 8 (room for rich documentary content) instead of 4.
    const isResearchMode = (webSearch || catMode === "documentary") && !!storyTopic;
    const frameCount = rawFrameCount || (isResearchMode ? 8 : 4);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const languageName = storyLanguage === "tr" ? "Turkish" : "English";

    // Build character context string for prompts
    let characterContext = "";
    if (characters?.length) {
      characterContext = `\nCharacters in this story:\n${characters.map((c: any) => {
        const name = c.role || c.name || "unnamed";
        return `- ${name}`;
      }).join("\n")}\nIMPORTANT: Always refer to characters by their NAME and use correct gender pronouns (he/she, not "they" for single characters). If the character name suggests a gender (e.g. Turkish names like Saliha=female, Ahmet=male), use the appropriate pronoun.`;
    }

    let systemPrompt = "";

    if (storyMode === "bgVocal") {
      systemPrompt = `You are an expert storyteller writing voiceover narration for short-form video content.
IMPORTANT: ALL text MUST be written in ${languageName}.

Each scene should have:
- "description": A DETAILED visual description for image generation (2 sentences). This is ONLY for creating the image, NOT narrated. Describe the visual scene clearly.
- "narration": A natural voiceover narration. HARD MAXIMUM: 150 characters total (including spaces). One single moment per frame.
- "dialogues": [] (always empty array for this mode)

CRITICAL NARRATION RULES:
1. Write like a HUMAN talks, not like an AI. Natural, conversational tone.
2. HARD LIMIT: Each narration MUST be ≤150 characters total. Count characters. If over, shorten.
3. Each frame covers ONE single moment or event ONLY. Do not pack multiple events into one frame.
4. Use CHARACTER NAMES directly. Say "Saliha" not "she". Say "Ahmet" not "the man".
5. Use HOOKS when natural: "Ama sonra...", "İşte tam o an..."
6. Do NOT describe visuals. Narration ≠ visual description.
7. Each narration advances the PLOT with ONE new beat.
8. Sound NATURAL. Like you're telling a friend a story over coffee. No formal language. No literary phrases.
9. ALWAYS include REAL facts, dates, statistics, locations, and verifiable information when the topic allows it. This adds documentary quality and credibility.
10. Mention specific years, cities, names of real places, real numbers and percentages when relevant. For example: "2011'de İstanbul'da 13 milyon kişi yaşıyordu" instead of "Büyük bir şehirde çok kişi yaşıyordu."
${characterContext}

DOCUMENTARY MODE RULES:
If the story topic mentions real people, real events, or is clearly documentary content:
- Use REAL facts, statistics, dates, and verifiable information in EVERY frame
- Include specific numbers, percentages, years, and place names
- Write as if narrating a casual but informative documentary
- Example: "1986 Dünya Kupası çeyrek finalinde Maradona, İngiltere'ye karşı 'Tanrı'nın Eli' golünü attı. 51.000 seyirci buna şahit oldu. Hakem ise hiçbir şey görmedi."

BAD (too formal): "Bir adam parkta sakin bir şekilde yürüyüş yapmaktadır."
BAD (over 150 chars, multiple events): "Saliha balkonda halı silkerken sesler geldi. Mehmet kapıyı çaldı, saat gece 2'ydi. Söyleyeceği şey Saliha'yı şoke edecekti."
GOOD (≤150 chars, ONE moment): "Saliha balkonda halı silkerken aşağıdan garip bir ses geldi." (60 chars)
GOOD (≤150 chars, ONE moment): "Maradona 1986'da 'Tanrı'nın Eli' golünü attı. Hakem hiçbir şey görmedi." (71 chars)

Also include shot_breakdown with: shot_type, camera_distance, camera_angle, visual_focus, characters_visible, character_positioning, setting_detail, lighting, mood_atmosphere, depth_of_field.

IMPORTANT: You MUST also return a "characters" array listing EVERY character. For each:
- "name": the character's name
- "features": brief physical description in ${languageName}. If the story topic or context mentions a character's profession/occupation (e.g. lawyer, doctor, teacher), ALWAYS include it at the beginning of the features field (e.g. "Avukat, kısa siyah saçlı...").

Return JSON: { scenes: [...], characters: [{ name: "...", features: "..." }, ...] }`;
    } else {
      systemPrompt = `You are a professional story writer and visual director. Generate a story draft with scenes for a comic/storyboard.
IMPORTANT: ALL scene descriptions and ALL dialogue texts MUST be written in ${languageName}.
Each scene should have: description (a DETAILED visual description for image generation, in ${languageName}), dialogues (array of {character, text}, text must be in ${languageName}).

CRITICAL RULES FOR SCENE DESCRIPTIONS:
1. Descriptions should be 2-4 sentences. Describe WHAT IS VISIBLE in this exact frame moment: character positions, facial expressions, body language, key objects, and the environment.
2. Every description MUST explicitly mention the LOCATION/SETTING and CHARACTER NAMES.
3. Each frame captures ONE specific action moment. Describe what the viewer sees frozen in that instant.
4. Include details like: facial expressions (shock, joy, confusion), body positions, what characters are holding, what is happening to objects (e.g. "books falling to the ground"), eye contact or gaze direction.

BAD (too vague): "Sümeyye kampüste Zion'a çarpar."
BAD (no visual detail): "Maç yeni bitmiş, taraftarlar sevinç içinde."
GOOD: "Sümeyye, üniversite kampüsünde dersine yetişmek için hızla yürürken yanlışlıkla Zion'a çarpar. Sümeyye'nin yüz ifadesi şok ve kaygı içindeyken Zion da ne olduğunu anlamaya çalışıyordur. Sümeyye'nin elindeki kitaplar o sırada yere düşmüştür."
GOOD: "FB maçı yeni bitmiş, Baba ve oğul stadyum tribünlerinde ayakta sevinç içinde kollarını havaya kaldırıyorlar. Babanın yüzünde geniş bir gülümseme var, oğlu ise heyecanla bağırıyor. Ellerinde sarı-lacivert bayraklar tutuyor."

CRITICAL RULE FOR SAME-LOCATION SCENES:
If consecutive scenes happen in the SAME location with the SAME characters and there is NO new significant action (no new character entering/leaving, no new facial expression change, no new physical action like objects falling), do NOT create a new frame. Instead, ADD MORE DIALOGUES (up to 6 dialogue entries) to the existing frame. Only create a new frame when:
- A NEW character enters or an existing character leaves the scene
- A significant NEW ACTION or MOVEMENT happens (e.g. someone stands up, an object falls, a door opens)
- The LOCATION changes
- A character's expression or body language dramatically changes in a way worth illustrating

Also include shot_breakdown with: shot_type, camera_distance, camera_angle, visual_focus, characters_visible, character_positioning, setting_detail, lighting, mood_atmosphere, depth_of_field.
The shot_breakdown should direct the "camera" like a film director: specify the focal point (who/what is the center of attention), describe what is in the foreground vs background, and note if we see any character from behind or at an angle. For dialogue scenes, the focal character should be the speaker, and the listener may be seen from behind or at an angle.

${storyMode === "voiceAnimation" ? `CRITICAL DIALOGUE RULE FOR VOICE ANIMATION MODE:
Each character MUST speak ONLY ONE very short sentence per dialogue entry — maximum 3-7 words. No compound sentences, no commas joining two thoughts. These dialogues will be converted to voice audio, so extreme brevity is essential.
BAD: "Merhaba, ben Sümeyye. Bugün üniversiteye yeni geldim ve kampüsü keşfetmeye çalışıyorum."
BAD: "Çok özür dilerim, seni görmedim!"
GOOD: "Ah, çok özür dilerim!"
GOOD: "Sorun değil, iyi misin?"
GOOD: Kitaplarımı toplar mısın?
GOOD: Gıdıklama, Anneciğim!
Each character should have at most ONE short line per frame.` : ""}

CRITICAL DIALOGUE TEXT FORMAT RULES:
1. NEVER use quotation marks ("") around dialogue text. Write dialogue text directly without any wrapping quotes.
   BAD: "Merhaba, nasılsın?"
   GOOD: Merhaba, nasılsın?
2. NEVER use parenthetical stage directions like (şaşkın bir ifadeyle) or (fısıldayarak) in dialogue text. Just write the spoken words.
   BAD: (Gözleri dolmuş, fısıldayarak) Ben... ne?
   BAD: (Şaşkın ve savunmacı bir tonla) Ne saçmalıyorsun?
   GOOD: Ben... ne?
   GOOD: Ne saçmalıyorsun?
3. Dialogue text must contain ONLY the words the character speaks. No stage directions, no emotional descriptions, no quotation marks.

IMPORTANT: You MUST also return a "characters" array listing EVERY SINGLE character that appears in the story. Each person mentioned is a SEPARATE character entry, even if they are related (e.g. "Baba" and "Oğul" are TWO separate characters, not one). For each character provide:
- "name": the character's name as used in dialogues (e.g. "Baba", "Oğul", "Ali", "Ayşe")
- "features": a brief physical description (hair color, eye color, skin tone, build, clothing, age, distinguishing features). If the user's story topic or scene descriptions mention specific physical traits for a character, use those EXACTLY. If no physical traits are mentioned, invent brief but consistent and vivid physical features randomly (e.g. "kısa siyah saçlı, yeşil gözlü, atletik yapılı, 25 yaşında genç adam" or "uzun kızıl saçlı, mavi gözlü, ince yapılı, 30 yaşında kadın"). If the story topic or context mentions a character's profession/occupation (e.g. lawyer, doctor, teacher, biologist), ALWAYS include it at the beginning of the features field (e.g. "Avukat, kısa siyah saçlı..." or "Biyolog, uzun kahverengi saçlı..."). Features MUST be in ${languageName}.

CRITICAL: Do NOT merge multiple characters into one. If the story has "Baba ve Oğul", you MUST return TWO character entries: one for "Baba" and one for "Oğul". Every person who appears or is mentioned gets their own entry.

Return JSON: { scenes: [...], characters: [{ name: "...", features: "..." }, ...] }`;
    }

    let userPrompt = "";
    if (perFrameMode && framePrompts?.length) {
      userPrompt = `Create a ${framePrompts.length}-frame story in ${languageName}. Each frame prompt:\n${framePrompts.map((p: string, i: number) => `Frame ${i + 1}: ${p}`).join("\n")}`;
      if (perFrameContext) userPrompt += `\nOverall context: ${perFrameContext}`;
    } else {
      userPrompt = `Create a ${frameCount}-frame story about: "${storyTopic}" in ${languageName}. Art style: ${artStyle}.`;

      // If a content category was selected, add specific instructions
      if (category) {
        const cat = (category || "").toLowerCase();
        if (cat.includes("hukuk") || cat.includes("law")) {
          const country = lawCountry || (storyLanguage === "tr" ? "Türkiye" : "Turkey");
          userPrompt += `\n\nCRITICAL CATEGORY INSTRUCTION - LAW (${country}):
This story MUST include specific legal references from ${country}'s legal system. Requirements:
- At least one character must be a lawyer/legal expert who explains the relevant law
- Include SPECIFIC law article numbers, court decisions, or legal codes (e.g. "Türk Borçlar Kanunu Madde 49" or "Tüketici Koruma Kanunu Madde 11")
- The story must educate viewers about their legal rights with REAL, VERIFIABLE legal information
- Show a real-life legal problem and its resolution through proper legal channels
- End with a clear legal takeaway that viewers can apply in their own lives`;
        } else if (cat.includes("sağlık") || cat.includes("health")) {
          userPrompt += `\n\nCATEGORY: Health - Include real health facts, statistics, or medical information. Make the story educational.`;
        } else if (cat.includes("din") || cat.includes("religion")) {
          const religion = lawCountry || "";
          userPrompt += `\n\nCATEGORY: Religion${religion ? ` (${religion})` : ""} - Include authentic religious references, teachings, or stories. Be respectful and educational.`;
        } else if (cat.includes("tarih") || cat.includes("history")) {
          const topic = lawCountry || "";
          userPrompt += `\n\nCATEGORY: History${topic ? ` (${topic})` : ""} - Include real historical facts, dates, and verifiable information.`;
        }
      }
    }

    if (characters?.length) {
      userPrompt += `\nCharacters: ${characters.map((c: any) => c.role || c.name || "unnamed").join(", ")}`;
    }

    userPrompt += `\n\nREMINDER: Write ALL descriptions and dialogues in ${languageName}.`;
    if (storyMode === "bgVocal") {
      userPrompt += `\nREMINDER: Each narration MUST be ≤150 characters total and cover ONE single moment/event only. Use character NAMES, sound NATURAL. Include REAL dates, places, names, and verifiable data when the topic allows.`;
    }

    // ---- Two-stage Perplexity research (only when web search or documentary mode is on) ----
    const shouldResearch = (webSearch || catMode === "documentary") && storyTopic;
    let researchSucceeded = false;
    let allCitations: string[] = [];

    if (shouldResearch) {
      const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
      if (PERPLEXITY_API_KEY) {
        const researchLang = storyLanguage === "tr" ? "Türkçe" : "English";
        const isDocumentary = catMode === "documentary";

        // Stage 1: deep biographical/topical fact sheet (sonar-pro, no recency filter)
        const factQuery = storyLanguage === "tr"
          ? `"${storyTopic}" hakkında doğrulanmış bir BİYOGRAFİK / KONU ÖZETİ hazırla.

Şunları net şekilde listele (varsa):
- Kim olduğu (tam ad, doğum tarihi, doğum yeri, milliyet)
- ŞU AN sahip olduğu en güncel rol/görev/pozisyon (kulüp, şirket, kurum, ülke)
- Önceki önemli roller (kronolojik, yıllarla)
- En önemli başarıları, ödülleri, rekorları
- Bilinen tartışmalar veya önemli olaylar
- Bugünkü durumu

Her bilgiyi kaynaklı ver. Emin olmadığın bir şeyi yazma. ASLA tahminde bulunma. Halüsinasyon yok.`
          : `Provide a verified BIOGRAPHICAL / TOPICAL FACT SHEET about "${storyTopic}".

List clearly (if applicable):
- Who they are (full name, date of birth, place of birth, nationality)
- Their CURRENT role/position/job RIGHT NOW (club, company, institution, country)
- Previous important roles (chronological, with years)
- Key achievements, awards, records
- Known controversies or major events
- Current status

Cite every fact. Do not write anything you are not sure about. NEVER guess. No hallucinations.`;

        try {
          console.log("Perplexity stage 1 (sonar-pro fact sheet)...");
          const r1 = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "sonar-pro",
              messages: [
                { role: "system", content: `You are a strict factual research assistant. Only state facts you can verify from sources. Respond in ${researchLang}. If unsure, say so explicitly.` },
                { role: "user", content: factQuery },
              ],
            }),
          });

          let factSheet = "";
          if (r1.ok) {
            const d1 = await r1.json();
            factSheet = d1.choices?.[0]?.message?.content || "";
            allCitations = allCitations.concat(d1.citations || []);
          } else {
            console.log("Perplexity stage 1 failed:", r1.status, await r1.text());
          }

          // Stage 2: latest news (sonar, recent)
          const newsQuery = storyLanguage === "tr"
            ? `"${storyTopic}" ile ilgili son 1 ayın en güncel haberlerini, gelişmelerini ve olaylarını özetle. Sadece doğrulanmış bilgileri ver.`
            : `Summarize the most recent news, developments and events about "${storyTopic}" from the last month. Only verified information.`;

          console.log("Perplexity stage 2 (sonar recent news)...");
          const r2 = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                { role: "system", content: `Strict factual research. Only verified info with sources. Respond in ${researchLang}.` },
                { role: "user", content: newsQuery },
              ],
              search_recency_filter: "month",
            }),
          });

          let newsBrief = "";
          if (r2.ok) {
            const d2 = await r2.json();
            newsBrief = d2.choices?.[0]?.message?.content || "";
            allCitations = allCitations.concat(d2.citations || []);
          } else {
            console.log("Perplexity stage 2 failed:", r2.status);
          }

          if (factSheet || newsBrief) {
            researchSucceeded = true;
            const sourcesList = Array.from(new Set(allCitations)).slice(0, 8);
            userPrompt += `\n\n=== FACT SHEET (THE ONLY ALLOWED SOURCE OF TRUTH) ===\n${factSheet}\n\n=== LATEST NEWS ===\n${newsBrief}\n`;
            if (sourcesList.length) userPrompt += `\nSources: ${sourcesList.join(", ")}\n`;
            userPrompt += `=== END RESEARCH ===\n\n`;
            userPrompt += `🚨 CRITICAL ANTI-HALLUCINATION RULES 🚨
1. You MUST use ONLY information that appears in the FACT SHEET or LATEST NEWS above.
2. DO NOT invent any roles, jobs, dates, places, achievements, or events. If it's not in the FACT SHEET, it does not exist.
3. If the FACT SHEET says the person is currently at X club/company/role, you MUST use that exact role. Never claim they are somewhere else.
4. When mentioning a real person, ALWAYS include their CURRENT verified role/title (from the FACT SHEET) in early frames.
5. If the FACT SHEET is short, expand by using more detail FROM THE FACT SHEET — never by inventing.
6. In the "characters" array, the "features" field for any real person MUST start with their actual profession/role from the FACT SHEET (e.g. "Fenerbahçe teknik direktörü, ...").
7. If a key fact is missing from the FACT SHEET (e.g. a date or place), simply omit it. Never fill gaps with guesses.
8. Each frame must contain at least ONE specific verifiable fact (date, place, number, name) from the FACT SHEET.
9. Generate ${frameCount} frames. Use the depth of the FACT SHEET — do not collapse rich material into too few frames.`;
            if (isDocumentary) {
              userPrompt += `\n10. This is a DOCUMENTARY. Use narrator perspective and real names from the FACT SHEET. No fictional characters.`;
            }
          } else {
            console.log("Perplexity returned no usable research content.");
          }
        } catch (perplexityErr) {
          console.log("Perplexity error:", (perplexityErr as Error).message);
        }
      } else {
        console.log("PERPLEXITY_API_KEY not set, skipping web research");
      }

      // If research was requested but failed → fail the request rather than hallucinating
      if (!researchSucceeded && webSearch) {
        return new Response(
          JSON.stringify({ error: storyLanguage === "tr"
            ? "Web araştırması başarısız oldu. Lütfen birkaç saniye sonra tekrar deneyin veya Web Search'i kapatıp deneyin."
            : "Web research failed. Please retry in a few seconds or disable Web Search and try again." }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    let result: any = null;
    const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
    
    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.8,
            },
          }),
        });

        result = await response.json();
        
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
          console.log(`Success with model: ${model}`);
          break;
        }
        console.log(`Model ${model} returned no content, trying next...`);
        result = null;
      } catch (e) {
        console.log(`Model ${model} failed: ${(e as Error).message}`);
      }
    }

    if (!result) {
      throw new Error("All Gemini models failed to respond.");
    }

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      throw new Error("No text response from Gemini. Response: " + JSON.stringify(result).substring(0, 500));
    }

    let cleanedText = textContent.trim();
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    cleanedText = cleanedText.replace(/,\s*([}\]])/g, "$1");

    let content: any;
    try {
      content = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON parse failed, raw length:", textContent.length, "error:", (parseErr as Error).message);
      const aggressive = cleanedText.replace(/[\x00-\x1F\x7F]/g, (ch: string) => ch === '\n' || ch === '\r' || ch === '\t' ? ch : '');
      content = JSON.parse(aggressive);
    }

    // Attach citations so the UI can show "Sources" under frames
    if (allCitations.length > 0) {
      content.citations = Array.from(new Set(allCitations)).slice(0, 8);
    }
    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
