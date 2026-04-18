import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, category, storyLanguage, storyTopic, frameCount, characterName, lawCountry } = await req.json();
    const lang = storyLanguage || "tr";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "viral_topics") {
      const categoryRules = getCategoryRulesForFictional(lang, category, lawCountry);

      systemPrompt = lang === "tr"
        ? `Sen viral sosyal medya hikaye konusu üreten bir AI'sın. Kısa, dikkat çekici, sosyal medyada paylaşılabilir hikaye konuları üret. Her konu 1-2 cümle olmalı. SADECE kurgusal (fictional) hikayeler üret. Tüm 5 konu kurgusal olmalı.

KURGUSAL hikayeler: Tamamen kurgusal karakterler ve olaylar kullan. Etiket: "fictional"

ÖNEMLİ KURALLAR:
- Hikayeler GERÇEK HAYATTAN İLHAM ALMALI. İnsanların empati kurabileceği, kendi hayatlarında yaşadıkları veya tanık oldukları durumlar olmalı.
- Hikayeler espirili, duygusal veya düşündürücü olmalı. İzleyiciler kendilerini hikayede bulabilmeli.
- Saçma sapan fantastik olaylar üretme. Gerçekçi, günlük hayata dokunan, paylaşılabilir hikayeler yaz.
- Hedef: İzleyicinin videoyu arkadaşına, sevgilisine veya ailesine göndermek istemesi.

${categoryRules}

Cevabını JSON olarak ver: { "suggestions": [{ "text": "konu", "tag": "fictional" }] }`
        : `You are an AI that generates viral social media story topics. Generate short, attention-grabbing, shareable story topics. ALL 5 topics must be fictional.

FICTIONAL stories: Use entirely made-up characters and events. Tag: "fictional"

IMPORTANT RULES:
- Stories must be INSPIRED BY REAL LIFE. They should depict situations people can empathize with, situations they've experienced or witnessed.
- Stories should be humorous, emotional, or thought-provoking. Viewers should see themselves in the story.
- Do NOT create absurd fantasy events. Write realistic, relatable, shareable stories.
- Goal: Make viewers want to send the video to their friend, partner, or family.

${categoryRules}

Reply in JSON: { "suggestions": [{ "text": "topic", "tag": "fictional" }] }`;

      userPrompt = category
        ? (lang === "tr" ? `"${category}" kategorisinde 5 viral kurgusal hikaye konusu üret.` : `Generate 5 viral fictional story topics in the "${category}" category.`)
        : (lang === "tr" ? "5 farklı kategoride viral kurgusal hikaye konusu üret." : "Generate 5 viral fictional story topics across different categories.");

      // Try OpenRouter with perplexity/sonar for real-time trending data
      const OPENROUTER_KEY_VIRAL = Deno.env.get("OPENROUTER_API_KEY");
      if (OPENROUTER_KEY_VIRAL) {
        try {
          console.log("Using OpenRouter perplexity/sonar for viral topics (real-time)...");
          const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENROUTER_KEY_VIRAL}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://storilyne.com",
              "X-Title": "Storilyne AI",
            },
            body: JSON.stringify({
              model: "perplexity/sonar",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (orResponse.ok) {
            const orData = await orResponse.json();
            const orText = orData.choices?.[0]?.message?.content || "";
            let orCleaned = orText.trim();
            if (orCleaned.startsWith("```")) {
              orCleaned = orCleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
            }
            orCleaned = orCleaned.replace(/,\s*([}\]])/g, "$1");
            const orParsed = JSON.parse(orCleaned);
            console.log("OpenRouter perplexity/sonar viral topics success");
            return new Response(JSON.stringify(orParsed), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            const errText = await orResponse.text();
            console.error("OpenRouter viral error, falling back to Gemini:", orResponse.status, errText);
          }
        } catch (err) {
          console.error("OpenRouter viral failed, falling back to Gemini:", err);
        }
      }

    } else if (type === "documentary_topics") {
      const categoryRules = getCategoryRulesForDocumentary(lang, category, lawCountry);

      systemPrompt = lang === "tr"
        ? `Sen belgesel içerik üreten bir AI'sın. YALNIZCA gerçek, doğrulanabilir, güvenilir kaynaklara dayalı hikaye konuları üret. Kurgusal hiçbir şey yazma. Tüm hikayeler gerçek kişilerin başından geçmiş, tarihte belgelenmiş olaylar olmalı. Tüm etiketler "real" olmalı.

Kurallar:
- Her konu gerçek bir olay veya gerçek bir kişinin hikayesi olmalı
- Kaynağa dayalı, doğrulanabilir bilgiler kullan
- Konular ilgi çekici, dramatik ve izleyiciyi eğitici olmalı
- Kısa ve net yaz (1-2 cümle)
- 2024, 2025 ve 2026 yıllarındaki güncel olayları da dahil et
${characterName ? `- "${characterName}" hakkında konular üret` : ""}
${categoryRules}

Cevabını JSON olarak ver: { "suggestions": [{ "text": "konu", "tag": "real" }] }`
        : `You are a documentary content AI. Generate ONLY real, verifiable, source-based story topics. Do NOT write anything fictional. All stories must be about real people and documented historical events. ALL tags must be "real".

Rules:
- Every topic must be a real event or real person's story
- Use source-based, verifiable information
- Topics should be engaging, dramatic, and educational
- Keep it short (1-2 sentences)
- Include current events from 2024, 2025, and 2026 as well
${characterName ? `- Generate topics about "${characterName}"` : ""}
${categoryRules}

Reply in JSON: { "suggestions": [{ "text": "topic", "tag": "real" }] }`;

      userPrompt = characterName
        ? (lang === "tr"
          ? `"${characterName}" hakkında ${category ? `"${category}" kategorisinde ` : ""}5 gerçek belgesel hikaye konusu üret. Tüm etiketler "real" olmalı.`
          : `Generate 5 real documentary story topics about "${characterName}"${category ? ` in the "${category}" category` : ""}. All tags must be "real".`)
        : (lang === "tr"
          ? `${category ? `"${category}" kategorisinde ` : ""}5 gerçek belgesel hikaye konusu üret. Tüm etiketler "real" olmalı.`
          : `Generate 5 real documentary story topics${category ? ` in the "${category}" category` : ""}. All tags must be "real".`);

      // Try OpenRouter with perplexity/sonar for real-time data
      const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
      if (OPENROUTER_API_KEY) {
        try {
          console.log("Using OpenRouter perplexity/sonar for documentary topics...");
          const openrouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://storilyne.com",
              "X-Title": "Storilyne AI",
            },
            body: JSON.stringify({
              model: "perplexity/sonar",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (openrouterResponse.ok) {
            const pData = await openrouterResponse.json();
            const pText = pData.choices?.[0]?.message?.content || "";
            let pCleaned = pText.trim();
            if (pCleaned.startsWith("```")) {
              pCleaned = pCleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
            }
            pCleaned = pCleaned.replace(/,\s*([}\]])/g, "$1");
            const pParsed = JSON.parse(pCleaned);
            console.log("OpenRouter perplexity/sonar documentary topics success");
            return new Response(JSON.stringify(pParsed), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            const errText = await openrouterResponse.text();
            console.error("OpenRouter error, falling back to Gemini:", openrouterResponse.status, errText);
          }
        } catch (pErr) {
          console.error("OpenRouter failed, falling back to Gemini:", pErr);
        }
      } else {
        console.log("No OPENROUTER_API_KEY, using Gemini for documentary topics");
      }

    } else if (type === "frame_suggestions") {
      const fc = frameCount || 4;
      systemPrompt = lang === "tr"
        ? `Sen hikaye kare açıklamalarını yazan bir AI'sın. Verilen hikaye konusuna göre ${fc} karelik kısa ve öz görsel açıklamalar üret. Her kare en fazla 1-2 kısa cümle olmalı, sahneyi ve aksiyonu özet şekilde anlat. Gereksiz detay ekleme. JSON olarak cevap ver: { "frames": ["kare1 açıklaması", "kare2 açıklaması", ...] }`
        : `You are an AI that writes story frame descriptions. Generate ${fc} concise visual frame descriptions for the given story topic. Each frame should be 1-2 short sentences max, briefly describing the scene and action. Keep it minimal, no unnecessary detail. Reply in JSON: { "frames": ["frame1 description", "frame2 description", ...] }`;

      userPrompt = lang === "tr"
        ? `Hikaye konusu: "${storyTopic}"\n\n${fc} kare için detaylı görsel açıklamalar üret.`
        : `Story topic: "${storyTopic}"\n\nGenerate detailed visual descriptions for ${fc} frames.`;
    } else {
      throw new Error("Invalid type. Use 'viral_topics', 'documentary_topics', or 'frame_suggestions'.");
    }

    // Gemini call (used for viral_topics, frame_suggestions, and as documentary fallback)
    const requestBody: any = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-story-suggestions error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getCategoryRulesForFictional(lang: string, category?: string, lawCountry?: string): string {
  const cat = (category || "").toLowerCase();

  if (lang === "tr") {
    if (cat.includes("ilişki") || cat.includes("relationship")) {
      return `
KATEGORİ: İlişkiler
- Hikayeler kurgusal karakterler arasında gerçekçi ilişki dinamiklerini anlatmalı.
- İnsanların kendi ilişkilerinde yaşadığı veya tanıdığı anları yansıtmalı.
- Gülümseten, tetikleyici veya "aynen böyle!" dedirtecek durumlar olmalı.
- Örnek tonlar:
  * Kadının erkek arkadaşının yanında feminenliğini yaşamak istemesi (yanında yardım isterken, tek başına her şeyi yapması)
  * Bekar kadınların "Tanrım bana birini gönder" deyip gelen kişiyi beğenmemesi
  * Çiftlerin arasındaki küçük ama herkesin bildiği komik alışkanlıklar
  * Sevgilinin mesajı geç cevaplama stratejileri
- Hedef: İzleyicinin "bu benim!" deyip sevgilisine/arkadaşına göndermesi.
- Fantastik veya saçma olaylar yazma. Fincan altında gizli bölme gibi absürt senaryolar YAZMA.`;
    }

    if (cat.includes("hukuk") || cat.includes("law")) {
      const country = lawCountry || "Türkiye";
      return `
KATEGORİ: Hukuk (${country} kanunları)
- Hikayeler ${country} hukuk sistemi çerçevesinde geçmeli.
- Gerçek hayattan bir çok insanın yaşadığı hukuki sorunları konu almalı.
- Hikayede bir sorun yaşanmalı, ardından avukat/hukukçu devreye girerek ilgili kanun maddesini açıklamalı.
- İzleyiciler hakları ve yapmaları gerekenleri öğrenmeli.
- Örnekler:
  * Üst komşunun halı silkelemesi, alt komşunun haklarını öğrenmesi
  * İşten haksız çıkarılan çalışanın tazminat hakları
  * Kiracı-ev sahibi anlaşmazlıkları ve yasal haklar
  * Online alışverişte iade ve tüketici hakları
- Hedef: İzleyicinin "bunu bilmiyordum!" deyip paylaşması.`;
    }

    if (cat.includes("sağlık") || cat.includes("health")) {
      return `
KATEGORİ: Sağlık
- Hikayeler sağlıklı ve sağlıksız yaşam tarzlarının sonuçlarını karşılaştırmalı.
- İnsanların çok az bildiği ama hayat kurtaran önemli bilgileri kısaca vermeli.
- Besinleri karakter haline getirip kendilerini anlattırabiliriz.
- Örnekler:
  * Yıllarca abur cubur tüketen vs sağlıklı beslenen iki kişinin 10 yıl sonraki halleri
  * Bir besin karakteri olarak "Ben brokoli, beni yemezseniz..." diye konuşması
  * Uyku düzeni bozuk vs düzenli uyuyan iki arkadaşın iş performansı
  * Su içmeyi unutan vs düzenli su içen kişinin vücut farkları
- Hedef: İzleyicinin sağlık alışkanlıklarını sorgulaması ve videoyu paylaşması.`;
    }

    if (cat.includes("günlük") || cat.includes("daily")) {
      return `
KATEGORİ: Günlük Hayat
- İnsanların empati kurabileceği espirili günlük olaylar.
- Herkesin yaşadığı ama kimsenin dile getirmediği komik durumlar.
- Ders çıkarılabilir veya insanların "bende de böyle!" diyeceği anlar.
- Örnekler:
  * Sabah alarmını 5 kere erteleyip "bugün erken kalkacağım" diye yatan kişi
  * Markette kasada en kısa sırayı seçip en uzun bekleyen kişi
  * "5 dakikada hazırlanırım" deyip 45 dakika süren hazırlık
  * Bulaşıkları "birazdan yıkarım" deyip 3 gün erteleme
- Hedef: İzleyicinin gülüp arkadaşlarına göndermesi.`;
    }

    if (cat.includes("iş") || cat.includes("work")) {
      return `
KATEGORİ: İş Hayatı
- Beyaz yakanın entrikaları, beklentileri, çalışanlar arası iletişim.
- Müdür-çalışan dinamikleri, manipülasyonlar, zam görüşmeleri.
- Üniversite mezuniyeti sonrası beklenti vs gerçek.
- Örnekler:
  * Mira üniversiteden mezun olurken büyük hayaller kuruyor, sonra süpermarkette kasiyer oluyor
  * Müdürün "seni takdir ediyorum" deyip zam vermemesi
  * "Bu şirkette kariyer yaparsın" deyip stajyere tüm işleri yıkma
  * Toplantıda herkesin "harika fikir" deyip hiç uygulamadığı projeler
- Hedef: Beyaz yakalıların empati kurup iş arkadaşlarına göndermesi.`;
    }

    if (cat.includes("din") || cat.includes("religion")) {
      const religion = lawCountry || "";
      return `
KATEGORİ: Din${religion ? ` (${religion})` : ""}
- ${religion ? `${religion} diniyle ilgili` : "Farklı dinlerle ilgili"} ilham verici, düşündürücü hikayeler.
- Gerçek hayattan ilham alan, dini değerlere saygılı hikayeler.
- İnsanların manevi yolculuklarını, inanç ile günlük hayat arasındaki ilişkiyi konu al.
- Hedef: İzleyicilerin düşünmesi ve paylaşması.`;
    }

    if (cat.includes("astroloji") || cat.includes("astrology")) {
      const zodiac = lawCountry || "";
      return `
KATEGORİ: Astroloji${zodiac ? ` (${zodiac})` : ""}
- ${zodiac ? `${zodiac} burcuyla ilgili` : "Burçlarla ilgili"} komik, relatable hikayeler.
- Her burcun tipik davranışlarını espirili şekilde anlat.
- İnsanların "bu benim burç!" deyip paylaşacağı içerikler.
- Hedef: İzleyicilerin kendi burçlarını bulup arkadaşlarına göndermesi.`;
    }

    if (cat.includes("tarih") || cat.includes("history")) {
      const topic = lawCountry || "";
      return `
KATEGORİ: Tarih${topic ? ` (${topic})` : ""}
- ${topic ? `${topic} ile ilgili` : "Tarihi olaylarla ilgili"} ilgi çekici, dramatik hikayeler.
- Az bilinen ama şaşırtıcı tarihi gerçekleri konu al.
- Hikayeler eğitici ve heyecan verici olmalı.
- Hedef: İzleyicilerin "bunu bilmiyordum!" deyip paylaşması.`;
    }

    if (cat.includes("hayvan") || cat.includes("animal")) {
      const animal = lawCountry || "";
      return `
KATEGORİ: Hayvan${animal ? ` (${animal})` : ""}
- ${animal ? `${animal} ile ilgili` : "Hayvanlarla ilgili"} ilgi çekici, eğlenceli veya eğitici hikayeler.
- Hayvanların şaşırtıcı davranışları, insan-hayvan ilişkileri.
- Duygusal veya komik anlar.
- Hedef: Hayvan severlerin paylaşacağı içerikler.`;
    }

    return `
Kategori bazlı kurallar:
- Hikayeler gerçek hayattan ilham almalı, insanların empati kurabileceği durumlar olmalı.
- Fantastik veya absürt senaryolar yazma. Gerçekçi ve paylaşılabilir ol.`;
  }

  // English
  if (cat.includes("relationship")) {
    return `
CATEGORY: Relationships
- Stories should depict realistic relationship dynamics between fictional characters.
- They should reflect moments people experience or recognize in their own relationships.
- Situations that make people smile, feel triggered, or say "that's so me!"
- Example tones: partner dynamics, dating struggles, couple habits everyone knows
- Goal: Make viewers tag their partner or send it to friends.
- Do NOT write absurd or fantastical scenarios.`;
  }

  if (cat.includes("law")) {
    const country = lawCountry || "United States";
    return `
CATEGORY: Law (${country} laws)
- Stories should be set within the ${country} legal system.
- Cover legal issues many people face in real life.
- A problem occurs, then a lawyer explains the relevant law/rights.
- Viewers should learn their rights and what to do.
- Goal: Make viewers say "I didn't know that!" and share.`;
  }

  if (cat.includes("health")) {
    return `
CATEGORY: Health
- Compare healthy vs unhealthy lifestyle consequences over time.
- Share little-known but life-saving health information.
- Can personify foods as characters telling their story.
- Goal: Make viewers question their health habits and share.`;
  }

  if (cat.includes("daily")) {
    return `
CATEGORY: Daily Life
- Humorous daily situations people can empathize with.
- Common experiences everyone has but nobody talks about.
- Goal: Make viewers laugh and send to friends.`;
  }

  if (cat.includes("work")) {
    return `
CATEGORY: Work Life
- White-collar intrigues, expectations, manager-employee dynamics.
- Post-graduation expectations vs reality.
- Goal: Make office workers empathize and share with colleagues.`;
  }

  if (cat.includes("religion")) {
    const religion = lawCountry || "";
    return `
CATEGORY: Religion${religion ? ` (${religion})` : ""}
- ${religion ? `Stories about ${religion}` : "Stories about different religions"} that are inspiring and thought-provoking.
- Respectful stories about faith, spirituality, and daily life.
- Goal: Make viewers reflect and share.`;
  }

  if (cat.includes("astrology")) {
    const zodiac = lawCountry || "";
    return `
CATEGORY: Astrology${zodiac ? ` (${zodiac})` : ""}
- ${zodiac ? `Stories about ${zodiac}` : "Stories about zodiac signs"} that are funny and relatable.
- Typical behaviors of each zodiac sign in a humorous way.
- Goal: Make viewers find their sign and share with friends.`;
  }

  if (cat.includes("history")) {
    const topic = lawCountry || "";
    return `
CATEGORY: History${topic ? ` (${topic})` : ""}
- ${topic ? `Stories about ${topic}` : "Historical stories"} that are engaging and dramatic.
- Little-known but surprising historical facts.
- Goal: Make viewers say "I didn't know that!" and share.`;
  }

  if (cat.includes("animal")) {
    const animal = lawCountry || "";
    return `
CATEGORY: Animals${animal ? ` (${animal})` : ""}
- ${animal ? `Stories about ${animal}` : "Animal stories"} that are engaging, fun, or educational.
- Surprising animal behaviors, human-animal relationships.
- Goal: Create content animal lovers will share.`;
  }

  return `
Category rules:
- Stories should be inspired by real life, depicting relatable situations.
- Do NOT write absurd or fantastical scenarios. Be realistic and shareable.`;
}

function getCategoryRulesForDocumentary(lang: string, category?: string, lawCountry?: string): string {
  const cat = (category || "").toLowerCase();

  if (cat.includes("hukuk") || cat.includes("law")) {
    const country = lawCountry || (lang === "tr" ? "Türkiye" : "United States");
    if (lang === "tr") {
      return `
KATEGORİ: Hukuk (${country} kanunları)
- Gerçek hukuk davaları ve emsal kararlar üzerinden hikayeler üret.
- ${country} kanunlarına ve hukuk sistemine dayalı konular olmalı.
- İzleyicilere hukuki hakları ve kanun maddeleri hakkında bilgi vermeli.`;
    }
    return `
CATEGORY: Law (${country} laws)
- Generate stories based on real legal cases and precedents.
- Topics should be based on ${country} laws and legal system.
- Should educate viewers about their legal rights.`;
  }

  if (cat.includes("sağlık") || cat.includes("health")) {
    if (lang === "tr") {
      return `
KATEGORİ: Sağlık
- Gerçek tıbbi araştırmalara ve bilimsel verilere dayanan hikayeler üret.
- Beslenme, egzersiz ve yaşam tarzı konularında gerçek istatistikler ver.`;
    }
    return `
CATEGORY: Health
- Stories based on real medical research and scientific data.
- Provide real statistics about nutrition, exercise, and lifestyle.`;
  }

  if (cat.includes("din") || cat.includes("religion")) {
    const religion = lawCountry || "";
    if (lang === "tr") {
      return `
KATEGORİ: Din${religion ? ` (${religion})` : ""}
- ${religion ? `${religion} diniyle ilgili` : "Farklı dinlerle ilgili"} gerçek tarihi olaylar ve önemli şahsiyetler hakkında belgesel içerikler.
- Doğrulanabilir kaynaklara dayalı olmalı.`;
    }
    return `
CATEGORY: Religion${religion ? ` (${religion})` : ""}
- Documentary content about ${religion ? religion : "various religions"}, real historical events and important figures.
- Must be based on verifiable sources.`;
  }

  if (cat.includes("astroloji") || cat.includes("astrology")) {
    const zodiac = lawCountry || "";
    if (lang === "tr") {
      return `
KATEGORİ: Astroloji${zodiac ? ` (${zodiac})` : ""}
- ${zodiac ? `${zodiac} burcuyla ilgili` : "Burçlarla ilgili"} gerçek astrolojik bilgiler ve tarihi kaynaklar.
- Bilimsel perspektif ve kültürel önemi konu al.`;
    }
    return `
CATEGORY: Astrology${zodiac ? ` (${zodiac})` : ""}
- Real astrological facts and historical sources about ${zodiac || "zodiac signs"}.
- Cover scientific perspective and cultural significance.`;
  }

  if (cat.includes("tarih") || cat.includes("history")) {
    const topic = lawCountry || "";
    if (lang === "tr") {
      return `
KATEGORİ: Tarih${topic ? ` (${topic})` : ""}
- ${topic ? `${topic} hakkında` : "Tarihi olaylar hakkında"} gerçek, belgelenmiş hikayeler.
- Kaynaklara dayalı, doğrulanabilir bilgiler kullan.
- Dramatik ve eğitici olmalı.`;
    }
    return `
CATEGORY: History${topic ? ` (${topic})` : ""}
- Real, documented stories about ${topic || "historical events"}.
- Use source-based, verifiable information.
- Should be dramatic and educational.`;
  }

  if (cat.includes("hayvan") || cat.includes("animal")) {
    const animal = lawCountry || "";
    if (lang === "tr") {
      return `
KATEGORİ: Hayvan${animal ? ` (${animal})` : ""}
- ${animal ? `${animal} hakkında` : "Hayvanlar hakkında"} gerçek bilimsel veriler ve belgesel hikayeler.
- Doğadan gerçek olaylar ve hayvan davranışları konu al.`;
    }
    return `
CATEGORY: Animals${animal ? ` (${animal})` : ""}
- Real scientific data and documentary stories about ${animal || "animals"}.
- Cover real events from nature and animal behaviors.`;
  }

  return "";
}
