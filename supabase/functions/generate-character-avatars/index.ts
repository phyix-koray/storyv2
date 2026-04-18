import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const XAI_API_BASE = "https://api.x.ai/v1";

function normalizeStyle(artStyle?: string): string {
  if (!artStyle) return "default";
  const lowered = artStyle.toLowerCase();

  if (lowered.includes("simpsons")) {
    return "2D animated TV cartoon style, yellow-skinned characters, bold clean outlines";
  }

  return artStyle;
}

// xAI image edit: transform reference image(s) into art style
async function generateWithXaiEdit(prompt: string, imageUrls: string | string[], xaiKey: string): Promise<string | null> {
  const urls = Array.isArray(imageUrls) ? imageUrls.slice(0, 5) : [imageUrls];
  console.log(`Using xAI grok-imagine-image/edit with ${urls.length} reference image(s)`);
  try {
    const body: Record<string, unknown> = {
      model: "grok-imagine-image",
      prompt,
      aspect_ratio: "1:1",
      n: 1,
    };

    if (urls.length === 1) {
      body.image = { url: urls[0], type: "image_url" };
    } else {
      body.images = urls.map(url => ({ type: "image_url", url }));
    }

    const res = await fetch(`${XAI_API_BASE}/images/edits`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${xaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    console.log(`[xai] images/edits ${res.status}: ${text.slice(0, 500)}`);

    if (!res.ok) {
      console.error(`xAI images/edits error: ${res.status}`);
      return null;
    }

    const result = JSON.parse(text);
    return result?.data?.[0]?.url || null;
  } catch (e) {
    console.error("xAI images/edits error:", (e as Error).message);
    return null;
  }
}

// Text-to-image: fal-ai/minimax/image-01
async function generateWithMinimax(prompt: string, falKey: string): Promise<string | null> {
  const res = await fetch("https://fal.run/fal-ai/minimax/image-01", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "1:1",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`minimax/image-01 error: ${res.status} ${errText}`);
    return null;
  }

  const result = await res.json();
  return result.images?.[0]?.url || null;
}

// Fallback text-to-image: flux/schnell
async function generateWithFluxSchnell(prompt: string, falKey: string): Promise<string | null> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "square",
      num_images: 1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Flux Schnell avatar error: ${res.status} ${errText}`);
    return null;
  }

  const result = await res.json();
  return result.images?.[0]?.url || null;
}

// Upload base64 to Supabase storage and return signed URL
async function uploadBase64ToStorage(dataUrl: string): Promise<string | null> {
  try {
    const [header, base64Data] = dataUrl.split(",");
    const mimeMatch = header.match(/data:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
      return null;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const ext = mimeType.includes("png") ? "png" : "jpg";
    const filePath = `avatar-refs/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("story-images")
      .upload(filePath, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error("reference upload failed:", uploadError.message);
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
  } catch (err) {
    console.error("Upload to storage error:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { characterProfiles, characterNames, characterName, artStyle, mode, revisionNote, referenceImages } = body;

    const FAL_KEY = Deno.env.get("FAL_KEY");
    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");

    if (!FAL_KEY) {
      return new Response(JSON.stringify({ error: "FAL_KEY not configured." }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Record<string, string> = {};

    if (mode === "initial" && (characterProfiles || characterNames)) {
      const names = characterProfiles?.map((p: any) => p.name) || characterNames || [];
      for (const name of names) {
        const profile = characterProfiles?.find((p: any) => p.name === name);
        const style = normalizeStyle(artStyle);
        const prompt = `Character portrait in ${style} style: ${name}. ${profile?.features || ""}. Full face visible, centered, clean background.`;

        const refImage = referenceImages?.[name];
        if (refImage && XAI_API_KEY) {
          let imageUrl = refImage;
          if (refImage.startsWith("data:")) {
            const uploaded = await uploadBase64ToStorage(refImage);
            if (uploaded) {
              imageUrl = uploaded;
            } else {
              console.warn(`Could not upload reference for ${name}, falling back to generation`);
              const generated = (await generateWithMinimax(prompt, FAL_KEY)) || (await generateWithFluxSchnell(prompt, FAL_KEY));
              if (generated) results[name] = generated;
              continue;
            }
          }
          const editPrompt = `Transform this person into a ${style} style character portrait. Keep the face features and likeness. Full face visible, centered, clean background. Character name: ${name}.`;
          const edited = await generateWithXaiEdit(editPrompt, imageUrl, XAI_API_KEY);
          if (edited) {
            results[name] = edited;
          } else {
            const generated = (await generateWithMinimax(prompt, FAL_KEY)) || (await generateWithFluxSchnell(prompt, FAL_KEY));
            if (generated) results[name] = generated;
          }
        } else {
          const imageUrl = (await generateWithMinimax(prompt, FAL_KEY)) || (await generateWithFluxSchnell(prompt, FAL_KEY));
          if (imageUrl) results[name] = imageUrl;
        }
      }
    } else if (characterName) {
      const style = normalizeStyle(artStyle);
      let prompt = `Character portrait in ${style} style: ${characterName}. Full face visible, centered, clean background.`;
      if (revisionNote) prompt += ` Revision: ${revisionNote}`;

      const refImage = referenceImages?.[characterName];
      if (refImage && XAI_API_KEY) {
        let imageUrl = refImage;
        if (refImage.startsWith("data:")) {
          const uploaded = await uploadBase64ToStorage(refImage);
          if (uploaded) imageUrl = uploaded;
        }
        if (imageUrl && !imageUrl.startsWith("data:")) {
          const editPrompt = `Transform this person into a ${style} style character portrait. Keep the face features and likeness. ${revisionNote ? `Revision: ${revisionNote}. ` : ""}Full face visible, centered, clean background. Character: ${characterName}.`;
          const edited = await generateWithXaiEdit(editPrompt, imageUrl, XAI_API_KEY);
          if (edited) {
            results[characterName] = edited;
            return new Response(JSON.stringify({ avatars: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }
      }

      const imageUrl = (await generateWithMinimax(prompt, FAL_KEY)) || (await generateWithFluxSchnell(prompt, FAL_KEY));
      if (imageUrl) results[characterName] = imageUrl;
    }

    return new Response(JSON.stringify({ avatars: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error("Avatar generation error:", (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
