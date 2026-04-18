import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { GeneratedImage } from "@/lib/types";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Copy, Download, Loader2, RefreshCw, Share2, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl, uploadStoryImage } from "@/lib/projectStorage";
import { AIMusicGenerator } from "@/components/AIMusicGenerator";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";

type OutputKind = "mp4";

const DOWNLOAD_FORMATS = [
  { id: "mp4", label: "MP4", ext: "mp4", mime: "video/mp4" },
  { id: "mov", label: "MOV", ext: "mov", mime: "video/quicktime" },
] as const;

function roundEven(n: number) {
  return Math.max(2, Math.round(n / 2) * 2);
}

function scaleToMaxArea(w: number, h: number, maxArea: number) {
  const area = w * h;
  if (area <= maxArea) return { w, h };
  const factor = Math.sqrt(maxArea / area);
  return {
    w: roundEven(Math.floor(w * factor)),
    h: roundEven(Math.floor(h * factor)),
  };
}

async function pickSupportedH264Codec(width: number, height: number, fps: number) {
  const candidates = [
    "avc1.640033", "avc1.640032", "avc1.640029", "avc1.4D0029",
    "avc1.42E029", "avc1.640028", "avc1.4D0028", "avc1.42E028", "avc1.42001f",
  ];
  for (const codec of candidates) {
    const cfg: VideoEncoderConfig = {
      codec, width, height, bitrate: 5_000_000, framerate: fps,
      hardwareAcceleration: "prefer-hardware", latencyMode: "realtime",
    };
    try {
      const supported = await (VideoEncoder as any).isConfigSupported(cfg);
      if (supported?.supported) return { codec, config: supported.config as VideoEncoderConfig };
    } catch { /* ignore */ }
  }
  return null;
}

export function VideoCreator() {
  const { language, images, scenes, storyTopic, storyLanguage, videoUrl, setVideoUrl, isCreatingVideo, setIsCreatingVideo, setStep, currentProjectId } = useAppStore();
  const { user } = useAuth();
  const { credits, isUnlimited, refetch: refetchCredits } = useCredits();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedFormat, setSelectedFormat] = useState<(typeof DOWNLOAD_FORMATS)[number]["id"]>("mp4");
  const [createProgress, setCreateProgress] = useState(0);
  const [socialCaption, setSocialCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(20);
  const [showPreCreate, setShowPreCreate] = useState(true);

  const debitCredits = async (amount: number, description: string) => {
    if (!user || isUnlimited) return;
    await supabase.from("user_credits").update({ credits: credits - amount }).eq("user_id", user.id);
    await supabase.from("credit_transactions").insert({ user_id: user.id, amount, type: "debit", description });
    refetchCredits();
  };

  const outputBlobRef = useRef<Blob | null>(null);
  const outputKindRef = useRef<OutputKind | null>(null);

  // Estimate total video duration
  const estimatedDuration = images.reduce((sum, img) => {
    const d = Number(img.duration);
    return sum + (Number.isFinite(d) && d > 0 ? d : 3);
  }, 0);

  // Load cached caption or auto-generate when video is ready
  useEffect(() => {
    if (!videoUrl) return;
    if (socialCaption) return;
    // Try loading cached caption
    const cacheKey = currentProjectId ? `caption_storyboard_${currentProjectId}` : null;
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setSocialCaption(cached); return; }
    }
    if (!captionLoading) generateCaption();
  }, [videoUrl]);

  const generateCaption = async () => {
    setCaptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-social-caption", {
        body: {
          storyTopic,
          scenes: scenes.map(s => ({ description: s.description })),
          language: storyLanguage,
        },
      });
      if (error) throw error;
      const caption = data?.caption || "";
      setSocialCaption(caption);
      if (caption && currentProjectId) {
        localStorage.setItem(`caption_storyboard_${currentProjectId}`, caption);
      }
    } catch (err) {
      console.error("Caption generation error:", err);
    } finally {
      setCaptionLoading(false);
    }
  };

  const copyCaption = () => {
    if (!socialCaption) return;
    navigator.clipboard.writeText(socialCaption);
    toast.success(language === "tr" ? "Kopyalandı!" : "Copied!");
  };

  const handleShare = async (platform: "instagram" | "tiktok" | "youtube") => {
    const blob = outputBlobRef.current;
    if (!blob) {
      toast.error(language === "tr" ? "Önce video oluşturun" : "Create a video first");
      return;
    }

    // Use Web Share API if available
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], `story-video.mp4`, {
          type: "video/mp4",
        });
        const shareData: ShareData = {
          title: storyTopic || "Story Video",
          text: socialCaption || "",
          files: [file],
        };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.warn("Web Share failed:", err);
      }
    }

    // Fallback: download + open platform
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-video.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);

    // Copy caption to clipboard
    if (socialCaption) {
      navigator.clipboard.writeText(socialCaption);
      toast.success(language === "tr" ? "Açıklama panoya kopyalandı! Video indiriliyor..." : "Caption copied! Video downloading...");
    }

    const urls: Record<string, string> = {
      instagram: "https://www.instagram.com/",
      tiktok: "https://www.tiktok.com/upload",
      youtube: "https://studio.youtube.com/",
    };
    setTimeout(() => window.open(urls[platform], "_blank"), 500);
  };

  const startCreateVideo = () => {
    setShowPreCreate(false);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    createVideo();
  };

  const createVideo = async () => {
    setIsCreatingVideo(true);
    setCreateProgress(5);
    const objectUrlsToRevoke: string[] = [];

    const isExternalImageUrl = (value: string) => {
      if (!value.startsWith("http://") && !value.startsWith("https://")) return false;
      try {
        const parsed = new URL(value);
        const storageBase = import.meta.env.VITE_SUPABASE_URL ? new URL(import.meta.env.VITE_SUPABASE_URL) : null;
        return !storageBase || parsed.origin !== storageBase.origin;
      } catch {
        return false;
      }
    };

    try {
      const validImages = images.filter((img) => img.imageUrl && img.imageUrl.length > 0);
      if (validImages.length === 0) {
        toast.error(t(language, "error"));
        return;
      }

      // Fetch music audio if available
      let musicAudioBuffer: AudioBuffer | null = null;
      if (musicEnabled && musicUrl) {
        try {
          const resp = await fetch(musicUrl);
          const ab = await resp.arrayBuffer();
          const audioCtx = new AudioContext();
          musicAudioBuffer = await audioCtx.decodeAudioData(ab);
          await audioCtx.close();
        } catch (e) {
          console.warn("Failed to load music audio:", e);
        }
      }

      // Refresh signed URLs and resolve storage paths
      const refreshedImages = await Promise.all(
        validImages.map(async (imgMeta) => {
          let url = imgMeta.imageUrl;
          try {
            // Always try to get a fresh signed URL from project_frames first
            if (currentProjectId) {
              const scene = scenes.find(s => s.id === imgMeta.sceneId);
              if (scene) {
                const { data: frameData } = await supabase
                  .from("project_frames")
                  .select("image_path, text_overlays, duration")
                  .eq("project_id", currentProjectId)
                  .eq("frame_number", scene.number)
                  .single();
                if (frameData?.image_path) {
                  let resolvedPath = frameData.image_path;
                  if (user && currentProjectId && isExternalImageUrl(frameData.image_path)) {
                    const importedPath = await uploadStoryImage({
                      dataUrl: frameData.image_path,
                      userId: user.id,
                      projectId: currentProjectId,
                      frameNumber: scene.number,
                    });
                    if (importedPath) {
                      resolvedPath = importedPath;
                    }
                  }

                  const freshUrl = await getSignedUrl(resolvedPath);
                  if (freshUrl) url = freshUrl;
                }

                let latestTextOverlays = imgMeta.textOverlays;
                if (frameData?.text_overlays) {
                  try {
                    const dbOverlays = typeof frameData.text_overlays === "string"
                      ? JSON.parse(frameData.text_overlays)
                      : frameData.text_overlays;
                    if (Array.isArray(dbOverlays) && dbOverlays.length > 0) {
                      // Check if DB overlays have timing info; if not, prefer store overlays
                      const hasTimingInfo = dbOverlays.some((o: any) => o.startTime !== undefined || o.endTime !== undefined);
                      if (hasTimingInfo || !imgMeta.textOverlays?.some((o: any) => o.startTime !== undefined)) {
                        latestTextOverlays = dbOverlays;
                      }
                    }
                  } catch {
                    latestTextOverlays = imgMeta.textOverlays;
                  }
                }

                return {
                  ...imgMeta,
                  imageUrl: url,
                  textOverlays: Array.isArray(latestTextOverlays) ? latestTextOverlays : imgMeta.textOverlays,
                  duration: typeof frameData?.duration === "number" && frameData.duration > 0 ? frameData.duration : imgMeta.duration,
                };
              }
            }
            // Fallback: resolve storage path or refresh expired token
            if (user && currentProjectId && isExternalImageUrl(url)) {
              const scene = scenes.find((s) => s.id === imgMeta.sceneId);
              if (scene) {
                const importedPath = await uploadStoryImage({
                  dataUrl: url,
                  userId: user.id,
                  projectId: currentProjectId,
                  frameNumber: scene.number,
                });
                if (importedPath) {
                  const importedUrl = await getSignedUrl(importedPath);
                  if (importedUrl) url = importedUrl;
                }
              }
            }

            if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:")) {
              const freshUrl = await getSignedUrl(url);
              if (freshUrl) url = freshUrl;
            } else if (url.includes("supabase") && url.includes("token=")) {
              const pathMatch = url.match(/story-images\/([^?]+)/);
              if (pathMatch) {
                const freshUrl = await getSignedUrl(decodeURIComponent(pathMatch[1]));
                if (freshUrl) url = freshUrl;
              }
            } else if (url.includes("supabase") && url.includes("/story-images/") && !url.includes("token=")) {
              const pathMatch = url.match(/story-images\/([^?]+)/);
              if (pathMatch) {
                const freshUrl = await getSignedUrl(decodeURIComponent(pathMatch[1]));
                if (freshUrl) url = freshUrl;
              }
            }
          } catch { /* use original */ }
          return { ...imgMeta, imageUrl: url };
        })
      );

      const loadImage = async (url: string): Promise<HTMLImageElement> => {
        // Fetch as blob to avoid CORS canvas tainting
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          objectUrlsToRevoke.push(blobUrl);
          const img = new Image();
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error("Blob image load failed"));
            img.src = blobUrl;
          });
          return img;
        } catch {
          // Direct fallback for data URLs or same-origin
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error("Image load failed entirely"));
            img.src = url;
          });
          return img;
        }
      };

      const loadedEntries: { image: HTMLImageElement; meta: typeof validImages[0] }[] = [];
      for (const imgMeta of refreshedImages) {
        try {
          const image = await loadImage(imgMeta.imageUrl);
          loadedEntries.push({ image, meta: imgMeta });
        } catch (e) {
          console.warn("Failed to load image, skipping URL:", imgMeta.imageUrl, e);
        }
      }

      if (loadedEntries.length === 0) {
        toast.error(language === "tr" ? "Görseller yüklenemedi. Lütfen geri dönüp tekrar deneyin." : "Failed to load images. Please go back and try again.");
        return;
      }

      setCreateProgress(15);

      const sourceW = roundEven(loadedEntries[0].image.naturalWidth);
      const sourceH = roundEven(loadedEntries[0].image.naturalHeight);

      if (typeof VideoEncoder !== "undefined") {
        await createWithWebCodecs(loadedEntries, sourceW, sourceH, musicAudioBuffer);
      } else {
        toast.error(language === "tr" ? "Tarayıcınız MP4 video üretimini desteklemiyor." : "Your browser does not support MP4 video creation.");
      }
    } catch (err) {
      console.error("Video creation error:", err);
      toast.error(t(language, "error"));
    } finally {
      objectUrlsToRevoke.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
      setIsCreatingVideo(false);
    }
  };

  const createWithWebCodecs = async (
    loadedEntries: { image: HTMLImageElement; meta: GeneratedImage }[],
    sourceW: number, sourceH: number,
    bgMusic: AudioBuffer | null = null,
  ) => {
    const Mp4Muxer = await import("mp4-muxer");
    setCreateProgress(20);
    const FPS = 30;
    let width = sourceW;
    let height = sourceH;

    let picked = await pickSupportedH264Codec(width, height, FPS);
    if (!picked) {
      const scaled = scaleToMaxArea(width, height, 1280 * 720);
      width = scaled.w; height = scaled.h;
      picked = await pickSupportedH264Codec(width, height, FPS);
    }
    if (!picked) throw new Error("No supported H.264 codec config found");

    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";

    // Calculate total duration for audio
    let totalDurationSec = 0;
    for (const { meta } of loadedEntries) {
      const dur = Number(meta.duration);
      totalDurationSec += Math.max(1, Number.isFinite(dur) && dur > 0 ? dur : 3);
    }

    // Setup muxer with optional audio
    const hasAudio = !!bgMusic;
    const muxerOptions: any = {
      target: undefined as any,
      video: { codec: "avc", width, height },
      fastStart: "in-memory",
    };
    if (hasAudio) {
      muxerOptions.audio = { codec: "aac", sampleRate: 44100, numberOfChannels: 2 };
    }

    const target = new Mp4Muxer.ArrayBufferTarget();
    muxerOptions.target = target;
    const muxer = new Mp4Muxer.Muxer(muxerOptions);

    let encoderClosed = false;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta ?? undefined); },
      error: (e) => { encoderClosed = true; console.error("VideoEncoder error:", e); },
    });
    encoder.configure(picked.config);
    setCreateProgress(25);

    let totalFrames = 0;
    for (const { meta } of loadedEntries) {
      const dur = Number(meta.duration);
      totalFrames += Math.max(1, Number.isFinite(dur) && dur > 0 ? dur : 3) * FPS;
    }

    let frameIndex = 0;
    for (let entryIdx = 0; entryIdx < loadedEntries.length; entryIdx++) {
      const { image, meta } = loadedEntries[entryIdx];
      const parsedDuration = Number(meta.duration);
      const finalDuration = Math.max(1, Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 3);
      const frameCount = Math.max(1, Math.round(finalDuration * FPS));

      // Debug: log overlay timing for this scene
      if (meta.textOverlays?.length) {
        console.log(`[VideoCreator] Scene ${entryIdx}: duration=${finalDuration}s, overlays:`,
          meta.textOverlays.map((o: any) => ({ text: o.text?.substring(0, 20), startTime: o.startTime, endTime: o.endTime, type: o.type }))
        );
      }

      for (let f = 0; f < frameCount; f++) {
        if (encoderClosed) throw new Error("Encoder closed during encode");
        const sceneTime = f / FPS;
        drawSceneFrame(ctx, { image, meta, canvasW: width, canvasH: height, currentTime: sceneTime });
        const timestamp = (frameIndex * 1_000_000) / FPS;
        const frame = new VideoFrame(canvas, { timestamp, duration: 1_000_000 / FPS });
        encoder.encode(frame, { keyFrame: f === 0 });
        frame.close();
        frameIndex++;
        if (frameIndex % 10 === 0) {
          setCreateProgress(Math.min(90, 25 + Math.round((frameIndex / totalFrames) * 65)));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    await encoder.flush(); encoder.close();

    // Encode audio if music is available
    if (hasAudio && bgMusic) {
      try {
        const sampleRate = 44100;
        const channels = 2;
        const totalSamples = Math.ceil(totalDurationSec * sampleRate);
        
        // Resample music to match target
        const offCtx = new OfflineAudioContext(channels, totalSamples, sampleRate);
        const src = offCtx.createBufferSource();
        src.buffer = bgMusic;
        const gainNode = offCtx.createGain();
        gainNode.gain.value = musicVolume / 100;
        src.connect(gainNode);
        gainNode.connect(offCtx.destination);
        src.start(0);
        const rendered = await offCtx.startRendering();

        const audioEncoder = new AudioEncoder({
          output: (chunk, meta) => { muxer.addAudioChunk(chunk, meta ?? undefined); },
          error: (e) => console.error("AudioEncoder error:", e),
        });
        audioEncoder.configure({
          codec: "mp4a.40.2",
          sampleRate,
          numberOfChannels: channels,
          bitrate: 128_000,
        });

        const audioData = new AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfFrames: rendered.length,
          numberOfChannels: channels,
          timestamp: 0,
          data: (() => {
            const interleaved = new Float32Array(rendered.length * channels);
            for (let ch = 0; ch < channels; ch++) {
              const chData = rendered.getChannelData(ch);
              interleaved.set(chData, ch * rendered.length);
            }
            return interleaved;
          })(),
        });
        audioEncoder.encode(audioData);
        audioData.close();
        await audioEncoder.flush();
        audioEncoder.close();
      } catch (e) {
        console.warn("Failed to encode audio, video will have no sound:", e);
      }
    }

    muxer.finalize();
    setCreateProgress(95);
    const blob = new Blob([target.buffer], { type: "video/mp4" });
    outputBlobRef.current = blob; outputKindRef.current = "mp4";
    setVideoUrl(URL.createObjectURL(blob));

    if (currentProjectId && user) {
      try {
        const storagePath = `${user.id}/${currentProjectId}/storyboard-video.mp4`;
        await supabase.storage.from("story-images").upload(storagePath, blob, { upsert: true, contentType: "video/mp4" });
        const { data: signedData } = await supabase.storage.from("story-images").createSignedUrl(storagePath, 60 * 60 * 24 * 365);
        await supabase.from("project_videos").upsert({
          project_id: currentProjectId,
          video_url: signedData?.signedUrl || storagePath,
          frame_number: 0,
        } as any, { onConflict: "project_id,frame_number" });
      } catch (error) {
        console.warn("Failed to persist storyboard video:", error);
      }
    }

    setCreateProgress(100);
  };


  const handleDownload = async () => {
    const blob = outputBlobRef.current;
    const kind = outputKindRef.current;
    if (!blob || !kind) return;
    const effectiveFormat = DOWNLOAD_FORMATS.find((f) => f.id === selectedFormat) || DOWNLOAD_FORMATS[0];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-video.${effectiveFormat.ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t(language, "videoTitle")}</h2>
        <Button variant="ghost" onClick={() => setStep(3)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t(language, "backToImages")}
        </Button>
      </div>

      {/* Pre-creation: Music Generator + Create Button */}
      {showPreCreate && !videoUrl && !isCreatingVideo && (
        <div className="space-y-4">
          <AIMusicGenerator
            language={language}
            storyTopic={storyTopic}
            estimatedDuration={estimatedDuration}
            onMusicGenerated={(url) => setMusicUrl(url)}
            onMusicRemoved={() => setMusicUrl(null)}
            generatedMusicUrl={musicUrl}
            onCreditDebit={debitCredits}
            musicEnabled={musicEnabled}
            onMusicEnabledChange={setMusicEnabled}
            volume={musicVolume}
            onVolumeChange={setMusicVolume}
          />
          <Button onClick={startCreateVideo} className="w-full h-12 text-base font-semibold">
            <Video className="mr-2 h-4 w-4" />
            {language === "tr" ? "Videoyu Oluştur" : "Create Video"}
          </Button>
        </div>
      )}

      {/* Social Media Caption - at top */}
      {videoUrl && (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              {language === "tr" ? "Sosyal Medya Açıklaması" : "Social Media Caption"}
            </h3>
            <Button size="sm" variant="ghost" onClick={generateCaption} disabled={captionLoading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${captionLoading ? "animate-spin" : ""}`} />
              {language === "tr" ? "Yenile" : "Refresh"}
            </Button>
          </div>

          {captionLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {language === "tr" ? "Viral açıklama oluşturuluyor..." : "Generating viral caption..."}
              </span>
            </div>
          ) : socialCaption ? (
            <div className="space-y-3">
              <div className="relative rounded-md border bg-background p-3">
                <p className="text-sm whitespace-pre-wrap pr-8">{socialCaption}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={copyCaption}
                  title={language === "tr" ? "Kopyala" : "Copy"}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleShare("instagram")} className="flex-1 min-w-[120px]">
                  <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                  </svg>
                  Instagram
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleShare("tiktok")} className="flex-1 min-w-[120px]">
                  <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.18v-3.45a4.85 4.85 0 01-1-.06z"/>
                  </svg>
                  TikTok
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleShare("youtube")} className="flex-1 min-w-[120px]">
                  <svg className="h-4 w-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube Shorts
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-muted">
        {isCreatingVideo ? (
          <div className="flex aspect-square items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t(language, "creatingVideo")}</p>
              <Progress value={createProgress} className="h-2 w-48" />
            </div>
          </div>
        ) : videoUrl ? (
          <video ref={videoRef} src={videoUrl} controls className="w-full" />
        ) : null}
      </div>

      {/* Regenerate Video Button */}
      {videoUrl && !isCreatingVideo && (
        <Button onClick={startCreateVideo} variant="outline" className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          {language === "tr" ? "Videoyu Yeniden Oluştur" : "Regenerate Video"}
        </Button>
      )}

      <div className="flex gap-3">
        <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOWNLOAD_FORMATS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleDownload} disabled={!videoUrl || isCreatingVideo} className="flex-1" size="lg">
          <Download className="mr-2 h-4 w-4" />
          {t(language, "downloadVideo")}
        </Button>
      </div>
    </div>
  );
}

type DrawSceneParams = {
  image: HTMLImageElement;
  meta: GeneratedImage;
  canvasW: number;
  canvasH: number;
  currentTime?: number;
};

function drawSceneFrame(ctx: CanvasRenderingContext2D, { image, meta, canvasW, canvasH, currentTime }: DrawSceneParams) {
  const scale = Math.min(canvasW / image.naturalWidth, canvasH / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;
  const overlayScale = drawW / image.naturalWidth;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);

  if (!meta.textOverlays?.length) return;

  for (const overlay of meta.textOverlays) {
    if (currentTime !== undefined) {
      const start = Number(overlay.startTime) || 0;
      const end = overlay.endTime !== undefined && overlay.endTime !== null ? Number(overlay.endTime) : Infinity;
      if (currentTime < start || currentTime >= end) continue;
    }
    const tx = offsetX + overlay.x * overlayScale;
    const ty = offsetY + overlay.y * overlayScale;
    const tw = overlay.width * overlayScale;
    const fontSize = Math.max(12, Math.round(overlay.fontSize * overlayScale));

    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;

    if (overlay.type === "bubble") {
      const lines = wrapText(ctx, overlay.text, tw - fontSize * 0.8);
      const lineHeight = fontSize * 1.3;
      const textBlockHeight = lines.length * lineHeight;
      const padY = fontSize * 0.4;
      const bw = tw;
      const bh = textBlockHeight + padY * 2;
      const radius = Math.min(bh / 2, fontSize);
      const flipH = overlay.flipH || false;
      const flipV = overlay.flipV || false;

      ctx.save();
      const cx = tx + bw / 2;
      const cy = ty + bh / 2;
      ctx.translate(cx, cy);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.translate(-cx, -cy);

      ctx.fillStyle = overlay.inverted ? "rgba(0,0,0,0.85)" : "#ffffff";
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, tx, ty, bw, bh, radius);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = overlay.inverted ? "rgba(0,0,0,0.85)" : "#ffffff";
      ctx.beginPath();
      ctx.moveTo(tx + fontSize, ty + bh);
      ctx.lineTo(tx + fontSize, ty + bh + fontSize * 0.6);
      ctx.lineTo(tx + fontSize * 2, ty + bh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = overlay.inverted ? "#ffffff" : "#000000";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const textStartY = ty + padY;
      for (let li = 0; li < lines.length; li++) {
        ctx.fillText(lines[li], tx + bw / 2, textStartY + li * lineHeight);
      }
    } else {
      const isInverted = overlay.inverted;
      ctx.fillStyle = isInverted ? "#ffffff" : "#000000";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const lines = wrapText(ctx, overlay.text, tw);
      const lineHeight = fontSize * 1.3;
      for (let li = 0; li < lines.length; li++) {
        ctx.strokeStyle = isInverted ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)";
        ctx.lineWidth = 3;
        ctx.strokeText(lines[li], tx, ty + li * lineHeight);
        ctx.fillText(lines[li], tx, ty + li * lineHeight);
      }
    }

    ctx.restore();
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}
