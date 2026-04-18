import { supabase } from "@/integrations/supabase/client";

export function extractStoryImagePath(value: string): string | null {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;

  const tryExtract = (input: string) => {
    const markers = [
      "/storage/v1/object/sign/story-images/",
      "/storage/v1/object/public/story-images/",
      "/object/sign/story-images/",
      "/object/public/story-images/",
    ];

    for (const marker of markers) {
      const index = input.indexOf(marker);
      if (index >= 0) {
        return decodeURIComponent(input.slice(index + marker.length).split("?")[0]);
      }
    }

    return null;
  };

  if (!value.startsWith("http://") && !value.startsWith("https://") && !value.startsWith("/")) {
    return value;
  }

  try {
    const parsed = new URL(value, "http://localhost");
    return tryExtract(parsed.pathname);
  } catch {
    return tryExtract(value);
  }
}

/**
 * Upload any image (base64 data URL, Blob, or File) to story-images bucket
 * and return the storage path. Use getSignedUrl() to get a temporary HTTP URL.
 */
export async function uploadAssetToStorage(params: {
  data: string | Blob | File;
  userId: string;
  folder?: string; // e.g. "characters", "objects"
}): Promise<string | null> {
  const { data, userId, folder = "assets" } = params;

  let blob: Blob | null = null;
  let ext = "png";

  if (typeof data === "string") {
    blob = await dataUrlToBlob(data);
    if (data.includes("image/jpeg") || data.includes("image/jpg")) ext = "jpg";
    else if (data.includes("image/webp")) ext = "webp";
  } else {
    blob = data;
    if (data instanceof File) {
      if (data.type.includes("jpeg") || data.type.includes("jpg")) ext = "jpg";
      else if (data.type.includes("webp")) ext = "webp";
    }
  }

  if (!blob) return null;

  const filePath = `${userId}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("story-images")
    .upload(filePath, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });

  if (error) {
    console.error("Asset upload failed:", error);
    return null;
  }

  return filePath;
}

/**
 * Get a signed URL for a storage path. Returns null on error.
 */
/**
 * Ensure a storage URL is absolute (not a relative /object/sign/... path).
 */
function normalizeStorageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/object/") || url.startsWith("/storage/")) {
    const base = import.meta.env.VITE_SUPABASE_URL;
    if (base) return `${base}/storage/v1${url}`;
  }
  return url;
}

async function importRemoteStoryImage(params: {
  sourceUrl: string;
  projectId: string;
  frameNumber: number;
}): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("import-story-image", {
    body: params,
  });

  if (error) {
    console.error("Remote story image import failed:", error);
    return null;
  }

  return data?.path || null;
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const extractedPath = extractStoryImagePath(path);
  const normalizedPath = extractedPath || path;

  if ((path.startsWith("http://") || path.startsWith("https://")) && !extractedPath) return path;
  // base64 data URL? Return as-is (legacy fallback).
  if (path.startsWith("data:")) return path;

  const { data, error } = await supabase.storage
    .from("story-images")
    .createSignedUrl(normalizedPath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return normalizeStorageUrl(data.signedUrl);
}

export async function uploadStoryImage(params: {
  dataUrl: string;
  userId: string;
  projectId: string;
  frameNumber: number;
}): Promise<string | null> {
  const { dataUrl, userId, projectId, frameNumber } = params;

  const blob = await dataUrlToBlob(dataUrl);
  if (!blob) {
    if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
      return importRemoteStoryImage({ sourceUrl: dataUrl, projectId, frameNumber });
    }

    console.warn("uploadStoryImage: could not convert to blob");
    return null;
  }

  const ext = blob.type?.includes("jpeg") || blob.type?.includes("jpg") ? "jpg" : "png";
  const filePath = `${userId}/${projectId}/frame-${frameNumber}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("story-images")
    .upload(filePath, blob, {
      contentType: blob.type || "image/png",
      upsert: true,
    });

  if (error) {
    console.error("Image upload failed:", error);
    return null;
  }

  return filePath;
}

export async function buildSignedImageUrlMap(paths: string[], expiresIn = 3600) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const result: Record<string, string> = {};

  if (uniquePaths.length === 0) return result;

  const signedResults = await Promise.all(
    uniquePaths.map(async (path) => {
      // If already an HTTP URL or data URL, return as-is
      if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
        const extractedPath = extractStoryImagePath(path);
        if (!extractedPath) return { path, signedUrl: path };

        const { data, error } = await supabase.storage
          .from("story-images")
          .createSignedUrl(extractedPath, expiresIn);

        if (error || !data?.signedUrl) return { path, signedUrl: path };
        return { path, signedUrl: normalizeStorageUrl(data.signedUrl) };
      }
      const { data, error } = await supabase.storage
        .from("story-images")
        .createSignedUrl(path, expiresIn);

      if (error || !data?.signedUrl) return null;
      return { path, signedUrl: normalizeStorageUrl(data.signedUrl) };
    }),
  );

  for (const item of signedResults) {
    if (item) result[item.path] = item.signedUrl;
  }

  return result;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    if (dataUrl.startsWith("data:")) {
      const response = await fetch(dataUrl);
      return await response.blob();
    }

    if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
      const response = await fetch(dataUrl);
      if (!response.ok) return null;
      return await response.blob();
    }

    return null;
  } catch (error) {
    console.error("Failed to convert image to blob:", error);
    return null;
  }
}
