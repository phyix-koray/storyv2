import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const XAI_API_BASE = "https://api.x.ai/v1";

function getAspectRatio(imageFormat: string): string {
  switch (imageFormat) {
    case "mobile": return "9:16";
    case "desktop": return "16:9";
    case "square":
    default: return "1:1";
  }
}

function sanitizeEventDescription(input: string): string {
  const text = (input || "").replace(/\s+/g, " ").trim();
  if (!text) return "Scene action";

  const patterns: RegExp[] = [
    /\b(\d{1,2})\s*yaş(?:ında|larında)?\b/gi,
    /\b(yaşlı|genç|orta yaşlı|çocuk|bebek)\b/gi,
    /\b(young|old|middle-aged|elderly|child|kid|baby|teen(?:ager)?)\b/gi,
    /\b(kısa|uzun|sarı|kumral|esmer|beyaz tenli|buğday tenli|siyah saçlı|kahverengi saçlı|sarı tenli)\b/gi,
    /\b(short|tall|blonde|brunette|dark-haired|fair-skinned|tan|pale|beard|mustache|muscular|slim)\b/gi,
    /\((?:[^)]*)(?:yaş|old|young|hair|saç|ten|skin|eyes?|göz)(?:[^)]*)\)/gi,
    /\b(kucakla[a-zışçğü]*|sarıl[a-zışçğü]*|öp[a-zışçğü]*|haz\s|zevk|tutku|arzu|şehvet|çıplak|embrace|hug(?:ging)?|kiss(?:ing)?|pleasure|desire|passion|naked|bare)\b/gi,
    /\b(kel|göbekli|kilolu|ince yapılı|hafif kilolu|güler yüzlü|geniş gülümseme|neşeli gözleri|büyük gözleri)\b/gi,
    /\b(saçlı|gözlü|tenli|yapılı|boylu)\b/gi,
  ];

  let sanitized = text;
  for (const pattern of patterns) sanitized = sanitized.replace(pattern, " ");

  sanitized = sanitized
    .replace(/[;,]{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();

  if (!sanitized) return "Scene action";
  return sanitized;
}

function extractCoreAction(description: string): string {
  return sanitizeEventDescription(description);
}

// Primary: fal-ai/minimax/image-01 (text-to-image, no grok)
async function generateWithMinimax(prompt: string, falKey: string, aspectRatio: string): Promise<string | null> {
  console.log("Trying fal-ai/minimax/image-01...");
  const res = await fetch("https://fal.run/fal-ai/minimax/image-01", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`minimax/image-01 error: ${res.status} ${errText}`);
    return null;
  }

  const result = await res.json();
  const url = result.images?.[0]?.url || null;
  if (url) console.log("minimax/image-01 succeeded");
  return url;
}

// With reference images: xAI grok-imagine-image /v1/images/edits (direct API)
async function generateWithXaiEdit(prompt: string, imageUrls: string[], xaiKey: string, aspectRatio: string): Promise<{ url: string | null; status?: number; errorDetail?: string }> {
  const safeUrls = imageUrls.slice(0, 5);
  console.log(`Trying xAI grok-imagine-image/edit with ${safeUrls.length} reference image(s)...`);
  console.log(`Edit prompt (final): ${prompt}`);

  try {
    const body: Record<string, unknown> = {
      model: "grok-imagine-image",
      prompt,
      aspect_ratio: aspectRatio || "1:1",
      n: 1,
    };

    if (safeUrls.length === 1) {
      body.image = { url: safeUrls[0], type: "image_url" };
    } else {
      body.images = safeUrls.map(url => ({ type: "image_url", url }));
    }

    const res = await fetch(`${XAI_API_BASE}/images/edits`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const resultText = await res.text();
    console.log(`[xai] images/edits ${res.status}: ${resultText.slice(0, 500)}`);

    if (!res.ok) {
      let errorDetail = resultText;
      try {
        const errJson = JSON.parse(resultText);
        errorDetail = errJson?.error?.message || errJson?.detail || resultText;
      } catch {}
      console.error(`xai images/edits error: ${res.status} ${errorDetail}`);
      return { url: null, status: res.status, errorDetail };
    }

    const result = JSON.parse(resultText);
    const url = result?.data?.[0]?.url || null;
    if (url) console.log("xAI grok-imagine-image/edit succeeded");
    return { url };
  } catch (e) {
    console.error("xAI images/edits error:", (e as Error).message);
    return { url: null, status: 500, errorDetail: (e as Error).message };
  }
}

// Fallback: Fal.ai flux/schnell
async function generateWithFluxSchnell(prompt: string, falKey: string, aspectRatio: string): Promise<string | null> {
  console.log("Falling back to flux/schnell...");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  try {
    const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        "Authorization": `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        num_images: 1,
        image_size: aspectRatio === "9:16" ? "portrait_16_9" : aspectRatio === "16:9" ? "landscape_16_9" : "square",
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`flux/schnell error: ${res.status} ${errText}`);
      return null;
    }

    const result = await res.json();
    return result.images?.[0]?.url || null;
  } catch (e) {
    console.log(`flux/schnell error: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Convert base64 data URL to a signed HTTP URL
async function uploadBase64ToStorage(dataUrl: string): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      console.error("uploadBase64ToStorage: invalid data URL format");
      return null;
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
      return null;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const filePath = `fal-refs/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("story-images")
      .upload(filePath, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("reference upload to story-images failed:", uploadError.message);
      return null;
    }

    const { data: signedData, error: signedError } = await admin.storage
      .from("story-images")
      .createSignedUrl(filePath, 60 * 60);

    if (signedError || !signedData?.signedUrl) {
      console.error("createSignedUrl failed:", signedError?.message || "no signed URL");
      return null;
    }

    return signedData.signedUrl;
  } catch (e) {
    console.error("uploadBase64ToStorage error:", (e as Error).message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { scenes, characters, objectAssets, artStyle, imageFormat, characterAvatars, revisionNote, previousImage, previousImageDescription } = await req.json();

    const FAL_KEY = Deno.env.get("FAL_KEY");
    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");

    if (!FAL_KEY) {
      return new Response(JSON.stringify({ error: "FAL_KEY not configured." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const scene = scenes[0];
    const aspectRatio = getAspectRatio(imageFormat || "square");

    // Build prompt for text-only mode
    let prompt = `Generate a single illustration image${artStyle && artStyle !== "default" ? ` in ${artStyle} style` : ""}. Scene: ${scene.description}. CRITICAL: Do NOT include any text, speech bubbles, dialogue balloons, captions, titles, subtitles, labels, watermarks, or any written words in the image. The image must be purely visual with zero text elements.`;

    if (characters && Array.isArray(characters) && characters.length > 0) {
      const charDescs = characters
        .filter((c: any) => c.role?.trim())
        .map((c: any) => `${c.role}${c.description ? ` (${c.description})` : ""}`)
        .join("; ");
      if (charDescs) prompt += ` Characters: ${charDescs}.`;
    }

    if (objectAssets && Array.isArray(objectAssets) && objectAssets.length > 0) {
      const objDescs = objectAssets
        .filter((o: any) => o.description?.trim())
        .map((o: any) => o.description)
        .join("; ");
      if (objDescs) prompt += ` Objects/props: ${objDescs}.`;
    }

    if (scene.shot_breakdown) {
      const sb = scene.shot_breakdown;
      prompt += ` Shot: ${sb.shot_type || ""}, ${sb.camera_distance || ""}, ${sb.camera_angle || ""}, lighting: ${sb.lighting || ""}, mood: ${sb.mood_atmosphere || ""}.`;
    }

    if (revisionNote) prompt += ` Revision: ${revisionNote}`;

    // Collect ALL reference image URLs
    const referenceUrls: string[] = [];
    let referenceCandidates = 0;

    const addRef = async (urlOrBase64: string) => {
      const val = (urlOrBase64 || "").trim();
      if (!val) return;
      referenceCandidates++;
      if (val.startsWith("http")) {
        referenceUrls.push(val);
      } else if (val.startsWith("data:")) {
        console.log("Legacy base64 reference detected, uploading to storage...");
        const url = await uploadBase64ToStorage(val);
        if (url) referenceUrls.push(url);
      }
    };

    if (characterAvatars && Array.isArray(characterAvatars)) {
      for (const avatar of characterAvatars) {
        await addRef(avatar.url || avatar.imageUrl || avatar.base64 || "");
      }
    }

    if (characters && Array.isArray(characters)) {
      for (const ch of characters) {
        await addRef(ch.imageUrl || ch.base64 || "");
      }
    }

    if (objectAssets && Array.isArray(objectAssets)) {
      for (const obj of objectAssets) {
        await addRef(obj.imageUrl || obj.base64 || "");
      }
    }

    if (referenceCandidates > 0 && referenceUrls.length === 0) {
      throw new Error("Referans görseller yüklenemedi, image-to-image üretim yapılamadı.");
    }

    console.log(`Reference candidates: ${referenceCandidates}, usable references: ${referenceUrls.length}`);

    let imageUrl: string | null = null;

    const prevContext = previousImage && previousImageDescription
      ? ` Previous frame context: "${previousImageDescription}". If the new scene continues in the same setting, maintain visual continuity.`
      : "";

    // If references exist, use xAI grok-imagine-image/edit
    if (referenceUrls.length > 0) {
      if (!XAI_API_KEY) {
        return new Response(JSON.stringify({ error: "XAI_API_KEY not configured." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const coreAction = extractCoreAction(scene.description || "");
      let editPrompt = artStyle && artStyle !== "default"
        ? `${artStyle} style. ${coreAction}. No text.`
        : `${coreAction}. No text.`;
      
      if (prevContext) editPrompt += prevContext;

      const allRefUrls = [...referenceUrls];
      if (previousImage && previousImage.startsWith("http")) {
        allRefUrls.push(previousImage);
      }

      console.log(`Edit prompt (final): ${editPrompt}`);
      console.log(`Reference URLs for xAI images/edits: ${JSON.stringify(allRefUrls.map(u => u.substring(0, 80) + "..."))}`);

      const safeRefUrls = allRefUrls.filter(u => {
        if (u.startsWith("data:")) {
          console.error("Filtering out base64 URL that failed upload");
          return false;
        }
        return true;
      });

      if (safeRefUrls.length === 0) {
        throw new Error("Referans görseller yüklenemedi. Lütfen görselleri kontrol edip tekrar deneyin.");
      }

      const result = await generateWithXaiEdit(editPrompt, safeRefUrls, XAI_API_KEY, aspectRatio);

      if (result.url) {
        imageUrl = result.url;
      } else {
        if (result.status === 422) {
          return new Response(JSON.stringify({
            error: "content_filtered",
            message: "Görsel oluşturulamadı: İçerik güvenlik filtresine takıldı. Prompt'u düzenleyip tekrar deneyin.",
            detail: result.errorDetail,
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Retry with simple prompt
        const simplePrompt = artStyle && artStyle !== "default"
          ? `${artStyle} style. Scene action. No text.`
          : `Scene illustration. No text.`;
        console.log(`Retrying with simple prompt: ${simplePrompt}`);
        const retry = await generateWithXaiEdit(simplePrompt, safeRefUrls, XAI_API_KEY, aspectRatio);

        if (retry.url) {
          imageUrl = retry.url;
        } else if (retry.status === 422) {
          return new Response(JSON.stringify({
            error: "content_filtered",
            message: "Görsel oluşturulamadı: İçerik güvenlik filtresine takıldı. Prompt'u düzenleyip tekrar deneyin.",
            detail: retry.errorDetail,
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          throw new Error("Reference images were provided but edit generation failed.");
        }
      }
    } else {
      // No references: text-to-image fallback chain
      if (prevContext) prompt += prevContext;
      
      imageUrl = await generateWithMinimax(prompt, FAL_KEY, aspectRatio);
      if (!imageUrl) {
        imageUrl = await generateWithFluxSchnell(prompt, FAL_KEY, aspectRatio);
      }
      if (!imageUrl) {
        throw new Error("No image generated from any provider.");
      }
    }

    return new Response(JSON.stringify({ images: [{ sceneId: scene.id, imageUrl }] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("Generate images error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
