import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun ?? false;
    const batchSize = body.batchSize ?? 50;

    const results = { characters: { found: 0, migrated: 0, failed: 0, errors: [] as string[] }, objects: { found: 0, migrated: 0, failed: 0, errors: [] as string[] } };

    // --- Migrate saved_characters ---
    const { data: chars, error: charsErr } = await supabase
      .from("saved_characters")
      .select("id, user_id, image_url")
      .not("image_url", "is", null)
      .limit(batchSize);

    if (charsErr) throw charsErr;

    const base64Chars = (chars || []).filter(c => c.image_url?.startsWith("data:"));
    results.characters.found = base64Chars.length;

    if (!dryRun) {
      for (const char of base64Chars) {
        try {
          const storagePath = await uploadBase64(supabase, char.image_url, char.user_id, "characters");
          if (!storagePath) { results.characters.failed++; results.characters.errors.push(`char ${char.id}: upload failed`); continue; }
          const { error: updateErr } = await supabase.from("saved_characters").update({ image_url: storagePath }).eq("id", char.id);
          if (updateErr) { results.characters.failed++; results.characters.errors.push(`char ${char.id}: ${updateErr.message}`); } else { results.characters.migrated++; }
        } catch (e) { results.characters.failed++; results.characters.errors.push(`char ${char.id}: ${(e as Error).message}`); }
      }
    }

    // --- Migrate saved_objects ---
    const { data: objs, error: objsErr } = await supabase
      .from("saved_objects")
      .select("id, user_id, image_url")
      .not("image_url", "is", null)
      .limit(batchSize);

    if (objsErr) throw objsErr;

    const base64Objs = (objs || []).filter(o => o.image_url?.startsWith("data:"));
    results.objects.found = base64Objs.length;

    if (!dryRun) {
      for (const obj of base64Objs) {
        try {
          const storagePath = await uploadBase64(supabase, obj.image_url, obj.user_id, "objects");
          if (!storagePath) { results.objects.failed++; results.objects.errors.push(`obj ${obj.id}: upload failed`); continue; }
          const { error: updateErr } = await supabase.from("saved_objects").update({ image_url: storagePath }).eq("id", obj.id);
          if (updateErr) { results.objects.failed++; results.objects.errors.push(`obj ${obj.id}: ${updateErr.message}`); } else { results.objects.migrated++; }
        } catch (e) { results.objects.failed++; results.objects.errors.push(`obj ${obj.id}: ${(e as Error).message}`); }
      }
    }

    return new Response(JSON.stringify({ dryRun, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Migration error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function uploadBase64(supabase: any, dataUrl: string, userId: string, folder: string): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const base64Data = match[2];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : mimeType.includes("webp") ? "webp" : "png";
    const filePath = `${userId}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("story-images")
      .upload(filePath, bytes, { contentType: mimeType, upsert: false });

    if (error) {
      console.error(`Upload failed for ${folder}:`, error.message);
      return null;
    }

    return filePath;
  } catch (e) {
    console.error(`Upload error for ${folder}:`, (e as Error).message);
    return null;
  }
}
