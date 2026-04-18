import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/projectStorage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Play, Pause, Download, ArrowLeft, Video, Share2, Copy, RefreshCw, Trash2, Edit3, Image as ImageIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { drawWatermarkSync, shouldWatermark } from "@/lib/watermark";
import { drawSubtitle, getSubtitleChunk, type SubtitleOptions } from "@/lib/subtitles";
import { SubtitleSettings } from "@/components/SubtitleSettings";
import { AIMusicGenerator } from "@/components/AIMusicGenerator";
import { IMAGE_COST } from "@/lib/videoPricing";

const CROSSFADE_DURATION = 0.5; // seconds
const TTS_COST_PER_1000_CHARS = 0.30;

// Generate random Ken Burns direction per frame (seeded by index)
function getKenBurnsDirection(index: number): { startX: number; startY: number; endX: number; endY: number; startZoom: number; endZoom: number } {
  const directions = [
    { startX: 0.0, startY: 0.0, endX: 0.6, endY: 0.5, startZoom: 1.0, endZoom: 1.08 }, // top-left to center-right
    { startX: 1.0, startY: 0.0, endX: 0.3, endY: 0.6, startZoom: 1.0, endZoom: 1.08 }, // top-right to center-left
    { startX: 0.5, startY: 0.0, endX: 0.5, endY: 0.8, startZoom: 1.0, endZoom: 1.10 }, // top-center to bottom-center
    { startX: 0.0, startY: 1.0, endX: 0.7, endY: 0.3, startZoom: 1.0, endZoom: 1.08 }, // bottom-left to top-right
    { startX: 1.0, startY: 1.0, endX: 0.2, endY: 0.2, startZoom: 1.0, endZoom: 1.10 }, // bottom-right to top-left
    { startX: 0.5, startY: 0.5, endX: 0.5, endY: 0.5, startZoom: 1.0, endZoom: 1.12 }, // center zoom-in only
    { startX: 0.3, startY: 0.7, endX: 0.7, endY: 0.2, startZoom: 1.05, endZoom: 1.0 }, // zoom-out with pan
    { startX: 0.7, startY: 0.3, endX: 0.3, endY: 0.7, startZoom: 1.0, endZoom: 1.06 }, // diagonal pan
  ];
  return directions[index % directions.length];
}

function SubtitlePreviewCanvas({ imageUrl, text, options, canvasRef }: {
  imageUrl: string;
  text: string;
  options: SubtitleOptions;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(400 / img.naturalWidth, 300 / img.naturalHeight, 1);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const chunk = getSubtitleChunk(text, 0.1, 5);
      if (chunk) drawSubtitle(ctx, chunk, canvas.width, canvas.height, options);
    };
    img.src = imageUrl;
  }, [imageUrl, text, options, canvasRef]);

  return (
    <div className="rounded-lg overflow-hidden border border-border/30 inline-block">
      <canvas ref={canvasRef} className="max-w-full" />
    </div>
  );
}

export function BgVocalEditor() {
  const { language, scenes, images, storyLanguage, storyTopic, setStep, currentProjectId, updateScene, frameMediaSelection, cachedTTSAudio, setCachedTTSAudio } = useAppStore();
  const { user } = useAuth();
  const { credits, isUnlimited, plan, refetch: refreshCredits } = useCredits();

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleOptions>({});
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [musicVolume, setMusicVolume] = useState(20);

  // Animation videos per frame (frame_number -> videoUrl)
  const [animationVideos, setAnimationVideos] = useState<Record<number, string>>({});

  // TTS audio management
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [playingCachedAudio, setPlayingCachedAudio] = useState<string | null>(null);
  const cachedAudioRef = useRef<HTMLAudioElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Store selected voice from ImagePreview (passed via store or localStorage)
  const [selectedVoiceId] = useState(() => {
    try { return localStorage.getItem("bgVocal_voiceId") || ""; } catch { return ""; }
  });

  // Load animation videos + saved AI music from DB; reset transient state when project changes
  useEffect(() => {
    if (!currentProjectId) return;
    setMusicUrl(null);
    setMusicEnabled(false);
    setMergedVideoUrl(null);
    (async () => {
      const { data } = await supabase.from("project_videos").select("*").eq("project_id", currentProjectId);
      if (!data) return;
      const anims: Record<number, string> = {};
      for (const v of data) {
        const fn = (v as any).frame_number as number;
        if (fn >= 1000 && v.video_url) {
          anims[fn - 1000] = v.video_url;
        } else if (fn === -1 && v.video_url) {
          // Saved AI background music for this project
          setMusicUrl(v.video_url);
          setMusicEnabled(true);
        }
      }
      setAnimationVideos(anims);
    })();
  }, [currentProjectId]);

  // Prune stale TTS cache entries that don't belong to current scenes (e.g. previous project)
  useEffect(() => {
    if (scenes.length === 0) return;
    const validIds = new Set(scenes.map(s => s.id));
    const keys = Object.keys(cachedTTSAudio);
    const hasStale = keys.some(k => !validIds.has(k));
    if (hasStale) {
      const cleaned: typeof cachedTTSAudio = {};
      for (const k of keys) {
        if (validIds.has(k)) cleaned[k] = cachedTTSAudio[k];
      }
      setCachedTTSAudio(cleaned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.map(s => s.id).join(",")]);

  // Save narration texts to DB
  const saveNarrations = useCallback(async () => {
    if (!currentProjectId) return;
    for (const scene of scenes) {
      if (scene.narration === undefined) continue;
      try {
        await supabase.from("project_frames").update({
          narration: scene.narration,
        } as any).eq("project_id", currentProjectId).eq("frame_number", scene.number);
      } catch { /* silent */ }
    }
  }, [currentProjectId, scenes]);

  useEffect(() => {
    const timeout = setTimeout(saveNarrations, 2000);
    return () => clearTimeout(timeout);
  }, [scenes.map(s => s.narration || "").join(",")]);

  // Generate TTS for each frame, then merge into video
  const generateVideo = async () => {
    if (!selectedVoiceId) {
      toast.error(language === "tr" ? "Lütfen görseller adımından bir ses seçin" : "Please select a voice from the images step");
      return;
    }

    const framesWithNarration = scenes.filter(s => s.narration?.trim()).map(s => {
      const img = images.find(i => i.sceneId === s.id);
      return { scene: s, image: img };
    }).filter(f => f.image?.imageUrl);

    if (framesWithNarration.length === 0) {
      toast.error(language === "tr" ? "Narrasyon metni olan kare bulunamadı" : "No frames with narration found");
      return;
    }

    // Check which frames need new TTS (not cached or text/voice changed)
    const framesToGenerate = framesWithNarration.filter(f => {
      const cached = cachedTTSAudio[f.scene.id];
      return !cached || cached.narrationText !== f.scene.narration || cached.voiceId !== selectedVoiceId;
    });

    // Calculate TTS cost only for non-cached frames
    const newChars = framesToGenerate.reduce((sum, f) => sum + (f.scene.narration?.length || 0), 0);
    const ttsCost = newChars > 0 ? Math.ceil(newChars / 1000) * TTS_COST_PER_1000_CHARS : 0;

    if (!isUnlimited && credits < ttsCost) {
      toast.error(language === "tr" ? `Yetersiz kredi! Bu işlem $${ttsCost.toFixed(2)} gerektirir.` : `Insufficient credits! This costs $${ttsCost.toFixed(2)}.`);
      return;
    }

    setGenerating(true);
    setProgress(0);

    try {
      // Step 1: Generate TTS for each frame (use cache when available)
      const cachedCount = framesWithNarration.length - framesToGenerate.length;
      if (cachedCount > 0) {
        setProgressLabel(language === "tr" ? `${cachedCount} ses önbellekten, ${framesToGenerate.length} yeni üretiliyor...` : `${cachedCount} from cache, generating ${framesToGenerate.length} new...`);
      } else {
        setProgressLabel(language === "tr" ? "Sesler oluşturuluyor..." : "Generating audio...");
      }

      const frameAudioData: Array<{ audioBuffer: AudioBuffer; imageUrl: string; kenBurns: boolean; duration: number; frameIndex: number; animVideoUrl?: string; narrationText?: string }> = [];
      const audioContext = new AudioContext();
      const newCachedAudio = { ...cachedTTSAudio };

      for (let i = 0; i < framesWithNarration.length; i++) {
        const { scene, image } = framesWithNarration[i];
        let audioBase64: string;

        // Check cache
        const cached = cachedTTSAudio[scene.id];
        if (cached && cached.narrationText === scene.narration && cached.voiceId === selectedVoiceId) {
          audioBase64 = cached.audioBase64;
        } else {
          // Generate new TTS
          const prevText = i > 0 ? framesWithNarration[i - 1].scene.narration : undefined;
          const nextText = i < framesWithNarration.length - 1 ? framesWithNarration[i + 1].scene.narration : undefined;

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                text: scene.narration,
                voiceId: selectedVoiceId,
                ...(prevText ? { previous_text: prevText } : {}),
                ...(nextText ? { next_text: nextText } : {}),
              }),
            }
          );

          if (!response.ok) throw new Error(`TTS failed for frame ${i + 1}`);
          const data = await response.json();
          audioBase64 = data.audioBase64;

          // Cache the new audio
          newCachedAudio[scene.id] = {
            audioBase64,
            narrationText: scene.narration || "",
            voiceId: selectedVoiceId,
            label: `${language === "tr" ? "Kare" : "Frame"} ${scene.number}`,
          };
        }

        const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        const audioBuffer = await audioContext.decodeAudioData(audioBytes.buffer.slice(0));

        // Respect frameMediaSelection: use animation video only if user selected "video"
        const mediaSelection = frameMediaSelection[scene.id];
        const animUrl = mediaSelection === "video" ? (animationVideos[scene.number] || undefined) : 
                        mediaSelection === "image" ? undefined : 
                        (animationVideos[scene.number] || undefined); // default: use animation if available

        // Resolve image URL - refresh signed URL if needed
        let resolvedImageUrl = image!.imageUrl;
        if (currentProjectId) {
          const { data: frameData } = await supabase
            .from("project_frames")
            .select("image_path")
            .eq("project_id", currentProjectId)
            .eq("frame_number", scene.number)
            .single();
          if (frameData?.image_path) {
            const path = frameData.image_path;
            if (path.startsWith("http://") || path.startsWith("https://")) {
              resolvedImageUrl = path;
            } else {
              const freshUrl = await getSignedUrl(path);
              if (freshUrl) resolvedImageUrl = freshUrl;
            }
          }
        }

        frameAudioData.push({
          audioBuffer,
          imageUrl: resolvedImageUrl,
          kenBurns: animUrl ? false : (image!.kenBurns ?? true),
          duration: audioBuffer.duration,
          frameIndex: i,
          animVideoUrl: animUrl,
          narrationText: scene.narration || "",
        });

        setProgress(Math.round(((i + 1) / framesWithNarration.length) * 40));
      }

      // Save cached audio to store
      setCachedTTSAudio(newCachedAudio);

      // Step 2: Create video with WebCodecs + mp4-muxer for MP4 output
      setProgressLabel(language === "tr" ? "Video oluşturuluyor..." : "Creating video...");
      setProgress(45);

      const totalDuration = frameAudioData.reduce((sum, f) => sum + f.duration, 0);
      const FPS = 30;
      const canvas = canvasRef.current!;

      // Determine canvas size from first image
      const firstImg = await loadImage(frameAudioData[0].imageUrl);
      const maxW = Math.min(firstImg.naturalWidth, 1280);
      const maxH = Math.min(firstImg.naturalHeight, 720);
      const scale = Math.min(maxW / firstImg.naturalWidth, maxH / firstImg.naturalHeight);
      canvas.width = Math.round(firstImg.naturalWidth * scale / 2) * 2;
      canvas.height = Math.round(firstImg.naturalHeight * scale / 2) * 2;

      const ctx = canvas.getContext("2d")!;

      // Load all images
      const loadedImages = await Promise.all(frameAudioData.map(f => loadImage(f.imageUrl)));

      // Pre-load animation video elements
      const loadedAnimVideos: (HTMLVideoElement | null)[] = await Promise.all(
        frameAudioData.map(async (f) => {
          if (!f.animVideoUrl) return null;
          return loadVideo(f.animVideoUrl);
        })
      );

      // Mix audio into a single AudioBuffer (TTS + optional background music)
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);
      let audioOffset = 0;
      for (const frame of frameAudioData) {
        const source = offlineCtx.createBufferSource();
        source.buffer = frame.audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(audioOffset);
        audioOffset += frame.duration;
      }

      // Mix in background music if available
      if (musicEnabled && musicUrl) {
        try {
          const musicResp = await fetch(musicUrl);
          const musicAb = await musicResp.arrayBuffer();
          const tempCtx = new AudioContext();
          const musicBuffer = await tempCtx.decodeAudioData(musicAb);
          await tempCtx.close();
          const musicSource = offlineCtx.createBufferSource();
          musicSource.buffer = musicBuffer;
          const gainNode = offlineCtx.createGain();
          gainNode.gain.value = musicVolume / 100;
          musicSource.connect(gainNode);
          gainNode.connect(offlineCtx.destination);
          musicSource.start(0);
        } catch (e) {
          console.warn("Failed to mix background music:", e);
        }
      }

      const renderedAudio = await offlineCtx.startRendering();

      // Try WebCodecs + mp4-muxer for MP4 output
      let outputBlob: Blob;
      try {
        outputBlob = await exportWithWebCodecs(canvas, ctx, loadedImages, loadedAnimVideos, frameAudioData, renderedAudio, totalDuration, FPS);
      } catch (e) {
        console.warn("WebCodecs failed, falling back to MediaRecorder (WebM):", e);
        outputBlob = await exportWithMediaRecorder(canvas, ctx, loadedImages, loadedAnimVideos, frameAudioData, renderedAudio, totalDuration, FPS);
      }

      const videoUrl = URL.createObjectURL(outputBlob);
      setMergedVideoUrl(videoUrl);

      // Upload video to storage and save to DB
      if (currentProjectId && user) {
        try {
          const ext = outputBlob.type.includes("mp4") ? "mp4" : "webm";
          const storagePath = `${user.id}/${currentProjectId}/bgvocal-video.${ext}`;
          await supabase.storage.from("story-images").upload(storagePath, outputBlob, { upsert: true, contentType: outputBlob.type });
          const { data: signedData } = await supabase.storage.from("story-images").createSignedUrl(storagePath, 60 * 60 * 24 * 365);
          const persistentUrl = signedData?.signedUrl || storagePath;
          await supabase.from("project_videos").upsert({
            project_id: currentProjectId,
            video_url: persistentUrl,
            frame_number: 0,
          } as any, { onConflict: "project_id,frame_number" });
        } catch (e) { console.warn("Failed to persist video:", e); }
      }

      // Debit credits (only for newly generated TTS)
      if (!isUnlimited && user && ttsCost > 0) {
        await supabase.from("user_credits").update({ credits: credits - ttsCost }).eq("user_id", user.id);
        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: ttsCost,
          type: "debit",
          description: language === "tr"
            ? `Arka plan seslendirmeli video (${newChars} karakter TTS)`
            : `Background vocal video (${newChars} char TTS)`,
        });
        refreshCredits();
      }

      setProgress(100);
      setProgressLabel(language === "tr" ? "Video hazır!" : "Video ready!");
      toast.success(language === "tr" ? "Video oluşturuldu!" : "Video created!");
    } catch (err) {
      console.error("Video generation error:", err);
      toast.error((err as Error).message || "Video generation failed");
    } finally {
      // Clean up blob URL cache
      blobUrlCacheRef.current.forEach((blobUrl) => {
        if (blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      });
      blobUrlCacheRef.current.clear();
      setGenerating(false);
    }
  };

  // WebCodecs + mp4-muxer export for MP4
  const exportWithWebCodecs = async (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    loadedImages: HTMLImageElement[],
    loadedAnimVideos: (HTMLVideoElement | null)[],
    frameAudioData: Array<{ audioBuffer: AudioBuffer; kenBurns: boolean; duration: number; frameIndex: number; animVideoUrl?: string; narrationText?: string }>,
    renderedAudio: AudioBuffer,
    totalDuration: number,
    FPS: number,
  ): Promise<Blob> => {
    const Mp4Muxer = await import("mp4-muxer");
    const width = canvas.width;
    const height = canvas.height;
    const CHANNELS = 2;
    const SAMPLE_RATE = 44100;

    const muxerOptions: any = {
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width, height },
      audio: { codec: "aac", numberOfChannels: CHANNELS, sampleRate: SAMPLE_RATE },
      fastStart: "in-memory",
    };

    const muxer = new Mp4Muxer.Muxer(muxerOptions);

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta ?? undefined); },
      error: (e) => { console.error("VideoEncoder error:", e); },
    });

    videoEncoder.configure({
      codec: "avc1.42001f",
      width, height,
      bitrate: 2_000_000,
      framerate: FPS,
    });

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => { muxer.addAudioChunk(chunk, meta ?? undefined); },
      error: (e) => { console.error("AudioEncoder error:", e); },
    });

    audioEncoder.configure({
      codec: "mp4a.40.2",
      numberOfChannels: CHANNELS,
      sampleRate: SAMPLE_RATE,
      bitrate: 128_000,
    });

    // Encode audio
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: SAMPLE_RATE,
      numberOfFrames: renderedAudio.length,
      numberOfChannels: CHANNELS,
      timestamp: 0,
      data: (() => {
        const buf = new Float32Array(renderedAudio.length * CHANNELS);
        for (let ch = 0; ch < CHANNELS; ch++) {
          const channelData = renderedAudio.getChannelData(Math.min(ch, renderedAudio.numberOfChannels - 1));
          buf.set(channelData, ch * renderedAudio.length);
        }
        return buf;
      })(),
    });
    audioEncoder.encode(audioData);
    audioData.close();

    // Encode video frames
    const totalFrames = Math.ceil(totalDuration * FPS);
    for (let f = 0; f < totalFrames; f++) {
      const currentTime = f / FPS;

      let elapsed = 0;
      let frameIndex = 0;
      let frameStartTime = 0;
      for (let i = 0; i < frameAudioData.length; i++) {
        if (currentTime < elapsed + frameAudioData[i].duration) {
          frameIndex = i;
          frameStartTime = elapsed;
          break;
        }
        elapsed += frameAudioData[i].duration;
        if (i === frameAudioData.length - 1) { frameIndex = i; frameStartTime = elapsed - frameAudioData[i].duration; }
      }

      const frameData = frameAudioData[frameIndex];
      const frameProgress = Math.min(1, (currentTime - frameStartTime) / frameData.duration);
      const img = loadedImages[frameIndex];
      const animVideo = loadedAnimVideos[frameIndex];

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (animVideo) {
        // Animation video: loop if frame duration exceeds video duration
        const timeInFrame = currentTime - frameStartTime;
        const loopedTime = animVideo.duration > 0 ? (timeInFrame % animVideo.duration) : 0;
        const targetTime = Math.min(loopedTime, animVideo.duration - 0.01);
        animVideo.currentTime = targetTime;
        // Wait for seek to complete so the frame is decoded
        await new Promise<void>((resolve) => {
          const onSeeked = () => { animVideo.removeEventListener("seeked", onSeeked); resolve(); };
          animVideo.addEventListener("seeked", onSeeked);
          // Safety timeout
          setTimeout(() => { animVideo.removeEventListener("seeked", onSeeked); resolve(); }, 100);
        });
        ctx.drawImage(animVideo, 0, 0, canvas.width, canvas.height);
      } else if (frameData.kenBurns) {
        drawKenBurns(ctx, img, canvas.width, canvas.height, frameProgress, frameData.frameIndex);
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      // Crossfade
      const timeInFrame = currentTime - frameStartTime;
      const timeUntilEnd = frameData.duration - timeInFrame;
      if (timeUntilEnd < CROSSFADE_DURATION && frameIndex < loadedImages.length - 1) {
        const alpha = 1 - (timeUntilEnd / CROSSFADE_DURATION);
        ctx.globalAlpha = alpha;
        const nextAnimVideo = loadedAnimVideos[frameIndex + 1];
        if (nextAnimVideo) {
          nextAnimVideo.currentTime = 0;
          ctx.drawImage(nextAnimVideo, 0, 0, canvas.width, canvas.height);
        } else {
          const nextImg = loadedImages[frameIndex + 1];
          if (frameAudioData[frameIndex + 1]?.kenBurns) {
            drawKenBurns(ctx, nextImg, canvas.width, canvas.height, 0, frameAudioData[frameIndex + 1].frameIndex);
          } else {
            ctx.drawImage(nextImg, 0, 0, canvas.width, canvas.height);
          }
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw subtitles
      if (subtitlesEnabled && frameData.narrationText) {
        const chunk = getSubtitleChunk(frameData.narrationText, frameProgress, 5);
        if (chunk) drawSubtitle(ctx, chunk, canvas.width, canvas.height, subtitleOptions);
      }

      if (shouldWatermark(plan)) {
        drawWatermarkSync(ctx, canvas.width, canvas.height);
      }

      const frame = new VideoFrame(canvas, { timestamp: Math.round(f * (1_000_000 / FPS)) });
      videoEncoder.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
      frame.close();

      if (f % 10 === 0) {
        setProgress(45 + Math.round((f / totalFrames) * 50));
        await new Promise(r => setTimeout(r, 0));
      }
    }

    await videoEncoder.flush();
    videoEncoder.close();
    await audioEncoder.flush();
    audioEncoder.close();
    muxer.finalize();

    const buf = (muxerOptions.target as InstanceType<typeof Mp4Muxer.ArrayBufferTarget>).buffer;
    return new Blob([buf], { type: "video/mp4" });
  };

  // Fallback: MediaRecorder (WebM)
  const exportWithMediaRecorder = async (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    loadedImages: HTMLImageElement[],
    loadedAnimVideos: (HTMLVideoElement | null)[],
    frameAudioData: Array<{ audioBuffer: AudioBuffer; kenBurns: boolean; duration: number; frameIndex: number; animVideoUrl?: string; narrationText?: string }>,
    renderedAudio: AudioBuffer,
    totalDuration: number,
    FPS: number,
  ): Promise<Blob> => {
    const stream = canvas.captureStream(FPS);
    const audioCtx2 = new AudioContext();
    const audioSource = audioCtx2.createBufferSource();
    audioSource.buffer = renderedAudio;
    const dest = audioCtx2.createMediaStreamDestination();
    audioSource.connect(dest);
    audioSource.connect(audioCtx2.destination);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));

    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const videoReady = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });

    recorder.start();
    audioSource.start();

    const startWallTime = performance.now();

    const renderLoop = () => {
      const currentTime = (performance.now() - startWallTime) / 1000;

      if (currentTime >= totalDuration) {
        recorder.stop();
        audioSource.stop();
        return;
      }

      let elapsed = 0;
      let frameIndex = 0;
      let frameStartTime = 0;
      for (let i = 0; i < frameAudioData.length; i++) {
        if (currentTime < elapsed + frameAudioData[i].duration) {
          frameIndex = i;
          frameStartTime = elapsed;
          break;
        }
        elapsed += frameAudioData[i].duration;
      }

      const frameData = frameAudioData[frameIndex];
      const frameProgress = (currentTime - frameStartTime) / frameData.duration;
      const img = loadedImages[frameIndex];
      const animVideo = loadedAnimVideos[frameIndex];

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (animVideo) {
        const timeInFrame = currentTime - frameStartTime;
        const loopedTime = animVideo.duration > 0 ? (timeInFrame % animVideo.duration) : 0;
        animVideo.currentTime = Math.min(loopedTime, animVideo.duration - 0.01);
        ctx.drawImage(animVideo, 0, 0, canvas.width, canvas.height);
      } else if (frameData.kenBurns) {
        drawKenBurns(ctx, img, canvas.width, canvas.height, frameProgress, frameData.frameIndex);
      } else {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      const timeInFrame = currentTime - frameStartTime;
      const timeUntilEnd = frameData.duration - timeInFrame;
      if (timeUntilEnd < CROSSFADE_DURATION && frameIndex < loadedImages.length - 1) {
        const alpha = 1 - (timeUntilEnd / CROSSFADE_DURATION);
        ctx.globalAlpha = alpha;
        const nextAnimVideo = loadedAnimVideos[frameIndex + 1];
        if (nextAnimVideo) {
          nextAnimVideo.currentTime = 0;
          ctx.drawImage(nextAnimVideo, 0, 0, canvas.width, canvas.height);
        } else {
          const nextImg = loadedImages[frameIndex + 1];
          ctx.drawImage(nextImg, 0, 0, canvas.width, canvas.height);
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw subtitles
      if (subtitlesEnabled && frameData.narrationText) {
        const chunk = getSubtitleChunk(frameData.narrationText, frameProgress, 5);
        if (chunk) drawSubtitle(ctx, chunk, canvas.width, canvas.height, subtitleOptions);
      }

      if (shouldWatermark(plan)) {
        drawWatermarkSync(ctx, canvas.width, canvas.height);
      }

      setProgress(45 + Math.round((currentTime / totalDuration) * 50));
      requestAnimationFrame(renderLoop);
    };

    renderLoop();
    return videoReady;
  };

  // Ken Burns with random direction per frame, MUCH slower movement
  const drawKenBurns = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    canvasW: number,
    canvasH: number,
    progress: number,
    frameIndex: number,
  ) => {
    const dir = getKenBurnsDirection(frameIndex);
    const t = progress; // 0..1

    const zoom = dir.startZoom + (dir.endZoom - dir.startZoom) * t;
    const cropW = canvasW / zoom;
    const cropH = canvasH / zoom;

    const panX = (dir.startX + (dir.endX - dir.startX) * t) * (canvasW - cropW);
    const panY = (dir.startY + (dir.endY - dir.startY) * t) * (canvasH - cropH);

    const sx = (panX / canvasW) * img.naturalWidth;
    const sy = (panY / canvasH) * img.naturalHeight;
    const sw = (cropW / canvasW) * img.naturalWidth;
    const sh = (cropH / canvasH) * img.naturalHeight;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
  };

  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());

  const toBlobUrl = async (url: string): Promise<string> => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("Failed to convert to blob URL:", url, e);
      return url;
    }
  };

  const resolveUrl = async (url: string): Promise<string> => {
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    const cache = blobUrlCacheRef.current;
    if (cache.has(url)) return cache.get(url)!;
    const blobUrl = await toBlobUrl(url);
    cache.set(url, blobUrl);
    return blobUrl;
  };

  const loadImage = async (url: string): Promise<HTMLImageElement> => {
    const resolved = await resolveUrl(url);
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback with crossOrigin
        const img2 = new window.Image();
        img2.crossOrigin = "anonymous";
        img2.onload = () => resolve(img2);
        img2.onerror = reject;
        img2.src = url;
      };
      img.src = resolved;
    });
  };

  const loadVideo = async (url: string): Promise<HTMLVideoElement> => {
    const resolved = await resolveUrl(url);
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.onloadeddata = () => resolve(video);
      video.onerror = () => {
        // Fallback with crossOrigin
        const video2 = document.createElement("video");
        video2.crossOrigin = "anonymous";
        video2.muted = true;
        video2.playsInline = true;
        video2.preload = "auto";
        video2.onloadeddata = () => resolve(video2);
        video2.onerror = reject;
        video2.src = url;
        video2.load();
      };
      video.src = resolved;
      video.load();
    });
  };

  const handleDownload = () => {
    if (!mergedVideoUrl) return;
    const a = document.createElement("a");
    a.href = mergedVideoUrl;
    a.download = "story-video.mp4";
    a.click();
  };

  return (
    <div className="space-y-6">
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setStep(3)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {language === "tr" ? "Video Oluşturma" : "Video Creation"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {language === "tr"
                ? "Kareleri seslendirme ile birleştirin"
                : "Merge frames with narration audio"}
            </p>
          </div>
        </div>
      </div>

      {/* Frames summary */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            {language === "tr" ? "Kareler ve Narrasyon" : "Frames & Narration"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {scenes.map((scene, i) => {
              const img = images.find((im) => im.sceneId === scene.id);
              const hasAnim = !!animationVideos[scene.number];
              const mediaChoice = frameMediaSelection[scene.id];
              const willUseVideo = hasAnim && mediaChoice !== "image";
              return (
                <div key={scene.id} className="flex gap-2 rounded-lg border border-border/30 bg-background/50 p-2">
                  {willUseVideo ? (
                    <video src={animationVideos[scene.number]} muted className="h-16 w-16 rounded-md object-cover" />
                  ) : img?.imageUrl ? (
                    <img src={img.imageUrl} alt={`Frame ${i + 1}`} className="h-16 w-16 rounded-md object-cover" />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {language === "tr" ? `Kare ${i + 1}` : `Frame ${i + 1}`}
                      {willUseVideo ? (
                        <span className="ml-1 text-primary">(Video)</span>
                      ) : (img?.kenBurns ?? true) ? (
                        <span className="ml-1 text-primary">(Ken Burns)</span>
                      ) : null}
                      {cachedTTSAudio[scene.id] && cachedTTSAudio[scene.id].narrationText === scene.narration && cachedTTSAudio[scene.id].voiceId === selectedVoiceId && (
                        <span className="ml-1 text-muted-foreground text-[10px]">🔊</span>
                      )}
                    </p>
                    <p className="text-xs text-foreground line-clamp-2">{scene.narration || scene.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cached TTS Audio Management */}
      {Object.entries(cachedTTSAudio).filter(([sceneId]) => scenes.some(s => s.id === sceneId)).length > 0 && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              {language === "tr" ? "Üretilmiş Sesler" : "Generated Audio"}
            </h3>
            <div className="space-y-2">
              {Object.entries(cachedTTSAudio).filter(([sceneId]) => scenes.some(s => s.id === sceneId)).map(([sceneId, cached]) => {
                const scene = scenes.find(s => s.id === sceneId)!;
                const isStale = cached.narrationText !== scene.narration || cached.voiceId !== selectedVoiceId;
                const isPlaying = playingCachedAudio === sceneId;
                return (
                  <div key={sceneId} className={`flex items-center gap-2 p-2 rounded-md border ${isStale ? "border-destructive/30 bg-destructive/5" : "border-border/30 bg-background/50"}`}>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                      if (isPlaying) {
                        cachedAudioRef.current?.pause();
                        setPlayingCachedAudio(null);
                      } else {
                        if (cachedAudioRef.current) cachedAudioRef.current.pause();
                        const audio = new Audio(`data:audio/mpeg;base64,${cached.audioBase64}`);
                        audio.onended = () => setPlayingCachedAudio(null);
                        cachedAudioRef.current = audio;
                        audio.play();
                        setPlayingCachedAudio(sceneId);
                      }
                    }}>
                      {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      {editingLabel === sceneId ? (
                        <Input
                          value={editLabelValue}
                          onChange={(e) => setEditLabelValue(e.target.value)}
                          onBlur={() => {
                            setCachedTTSAudio({ ...cachedTTSAudio, [sceneId]: { ...cached, label: editLabelValue || cached.label } });
                            setEditingLabel(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
                          }}
                          className="h-6 text-xs"
                          autoFocus
                        />
                      ) : (
                        <p className="text-xs font-medium truncate">{cached.label}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate">{cached.narrationText.slice(0, 60)}...</p>
                      {isStale && <p className="text-[10px] text-destructive">{language === "tr" ? "Metin değişmiş, yeniden üretilecek" : "Text changed, will regenerate"}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                      setEditLabelValue(cached.label);
                      setEditingLabel(sceneId);
                    }}>
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                      // Regenerate: remove from cache so next video generation will re-generate
                      const updated = { ...cachedTTSAudio };
                      delete updated[sceneId];
                      setCachedTTSAudio(updated);
                      toast.info(language === "tr" ? "Ses önbellekten silindi, sonraki üretimde yeniden oluşturulacak" : "Audio removed from cache, will regenerate next time");
                    }}>
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => {
                      const updated = { ...cachedTTSAudio };
                      delete updated[sceneId];
                      setCachedTTSAudio(updated);
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate / Progress - AI music & subtitle controls always visible */}
      <div className="space-y-3">
        {/* Subtitle + Music side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subtitle column */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Switch
                id="subtitles-toggle"
                checked={subtitlesEnabled}
                onCheckedChange={setSubtitlesEnabled}
              />
              <Label htmlFor="subtitles-toggle" className="text-sm cursor-pointer">
                {language === "tr" ? "Alt yazıları ekle" : "Add subtitles"}
              </Label>
              {subtitlesEnabled && (
                <SubtitleSettings
                  options={subtitleOptions}
                  onChange={setSubtitleOptions}
                  language={language}
                />
              )}
            </div>
            {subtitlesEnabled && (() => {
              const firstScene = scenes.find(s => s.narration?.trim());
              const firstImg = firstScene ? images.find(i => i.sceneId === firstScene.id) : null;
              if (!firstImg?.imageUrl || !firstScene?.narration) return null;
              return (
                <SubtitlePreviewCanvas
                  imageUrl={firstImg.imageUrl}
                  text={firstScene.narration}
                  options={subtitleOptions}
                  canvasRef={previewCanvasRef}
                />
              );
            })()}
          </div>

          {/* AI Music column */}
          <AIMusicGenerator
            language={language}
            storyTopic={storyTopic}
            estimatedDuration={scenes.reduce((sum, s) => sum + (s.narration?.length ? Math.max(3, s.narration.length / 15) : 3), 0)}
            onMusicGenerated={async (url) => {
              setMusicUrl(url);
              if (currentProjectId) {
                await supabase.from("project_videos").upsert({
                  project_id: currentProjectId,
                  frame_number: -1,
                  video_url: url,
                } as any, { onConflict: "project_id,frame_number" });
              }
            }}
            onMusicRemoved={async () => {
              setMusicUrl(null);
              if (currentProjectId) {
                await supabase.from("project_videos").delete().eq("project_id", currentProjectId).eq("frame_number", -1);
              }
            }}
            generatedMusicUrl={musicUrl}
            onCreditDebit={async (amount, description) => {
              if (!user || isUnlimited) return;
              await supabase.from("user_credits").update({ credits: credits - amount }).eq("user_id", user.id);
              await supabase.from("credit_transactions").insert({ user_id: user.id, amount, type: "debit", description });
              refreshCredits();
            }}
            musicEnabled={musicEnabled}
            onMusicEnabledChange={setMusicEnabled}
            volume={musicVolume}
            onVolumeChange={setMusicVolume}
          />
        </div>
        {generating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{progressLabel}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        {!mergedVideoUrl && (
          <Button
            onClick={generateVideo}
            disabled={generating}
            className="w-full h-12 text-base font-semibold"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === "tr" ? `İşleniyor... ${progress}%` : `Processing... ${progress}%`}
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                {language === "tr" ? "Videoyu Oluştur" : "Generate Video"}
              </>
            )}
          </Button>
        )}
      </div>

      {/* Video player */}
      {mergedVideoUrl && (
        <Card className="border-primary/20 bg-primary/5 backdrop-blur-sm">
          <CardContent className="p-5 space-y-4">
            <video
              ref={videoRef}
              src={mergedVideoUrl}
              controls
              className="w-full rounded-lg"
            />
            <div className="flex gap-3">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                {language === "tr" ? "Videoyu İndir (MP4)" : "Download Video (MP4)"}
              </Button>
              <Button onClick={() => { setMergedVideoUrl(null); }} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                {language === "tr" ? "Yeniden Oluştur" : "Regenerate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
