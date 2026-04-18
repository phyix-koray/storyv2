import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getExtension(contentType: string | null, sourceUrl: string) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";

  const match = sourceUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return match?.[1]?.toLowerCase() || "jpg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { sourceUrl, projectId, frameNumber } = await req.json();
    if (!sourceUrl || !projectId || typeof frameNumber !== "number") {
      return json({ error: "Missing required fields" }, 400);
    }

    if (!/^https?:\/\//i.test(sourceUrl)) {
      return json({ error: "Invalid image URL" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) return json({ error: "Unauthorized" }, 403);

    const { data: project, error: projectError } = await adminClient
      .from("story_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (projectError || !project) return json({ error: "Project not found" }, 404);

    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) {
      return json({ error: `Source fetch failed with ${sourceResponse.status}` }, 400);
    }

    const contentType = sourceResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return json({ error: "Source URL did not return an image" }, 400);
    }

    const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
    const ext = getExtension(contentType, sourceUrl);
    const path = `${user.id}/${projectId}/frame-${frameNumber}-${Date.now()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("story-images")
      .upload(path, bytes, { contentType, upsert: true });

    if (uploadError) return json({ error: uploadError.message }, 500);

    await adminClient
      .from("project_frames")
      .update({ image_path: path })
      .eq("project_id", projectId)
      .eq("frame_number", frameNumber);

    const { data: signedData, error: signedError } = await adminClient.storage
      .from("story-images")
      .createSignedUrl(path, 60 * 60);

    if (signedError) return json({ error: signedError.message }, 500);

    return json({ path, signedUrl: signedData?.signedUrl || null });
  } catch (error) {
    console.error("import-story-image error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});