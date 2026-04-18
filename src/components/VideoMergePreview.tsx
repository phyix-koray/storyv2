import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Copy, Download, Loader2, RefreshCw, Share2, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { drawWatermarkSync, shouldWatermark } from "@/lib/watermark";
import { drawSubtitle, getSubtitleChunk, type SubtitleOptions } from "@/lib/subtitles";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";
import { AIMusicGenerator } from "@/components/AIMusicGenerator";

type OutputKind = "mp4" | "webm";

const VIDEO_FORMATS = [
  { id: "mp4", label: "MP4", ext: "mp4", mime: "video/mp4" },
  { id: "mov", label: "MOV", ext: "mov", mime: "video/quicktime" },
  { id: "webm", label: "WebM", ext: "webm", mime: "video/webm" },
] as const;

interface VideoMergePreviewProps {
  videoUrls: string[];
  language: string;
  onBack: () => void;
  storyTopic?: string;
  scenes?: Array<{ description: string; dialogues?: Array<{ character: string; text: string }>; [key: string]: any }>;
  storyLanguage?: string;
  subtitlesEnabled?: boolean;
  subtitleOptions?: SubtitleOptions;
  musicUrl?: string | null;
  onMusicGenerated?: (url: string) => void;
  onMusicRemoved?: () => void;
  estimatedDuration?: number;
  initialMergedUrl?: string | null;
  onMergedUrlChange?: (url: string | null) => void;
}

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supported = await (VideoEncoder as any).isConfigSupported(cfg);
      if (supported?.supported) return { codec, config: supported.config as VideoEncoderConfig };
    } catch { /* continue */ }
  }
  return null;
}

/** Convert a remote video URL to a blob URL to bypass CORS restrictions */
async function toBlobUrl(url: string): Promise<string> {
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  } catch {
    // Fallback: proxy via import-story-image isn't suitable for video, so just return original
    console.warn("[VideoMerge] Could not fetch video as blob, using original URL:", url);
    return url;
  }
}

const _blobUrlCache = new Map<string, string>();

async function resolveVideoUrl(url: string): Promise<string> {
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (_blobUrlCache.has(url)) return _blobUrlCache.get(url)!;
  const blobUrl = await toBlobUrl(url);
  _blobUrlCache.set(url, blobUrl);
  return blobUrl;
}

async function loadVideo(url: string): Promise<HTMLVideoElement> {
  const resolvedUrl = await resolveVideoUrl(url);
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.src = resolvedUrl;
    video.onloadedmetadata = () => { video.onloadedmetadata = null; video.onerror = null; resolve(video); };
    video.onerror = () => { video.onloadedmetadata = null; video.onerror = null; reject(new Error(`Video load failed: ${url}`)); };
  });
}

async function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  const target = Math.max(0, Math.min(timeSec, Math.max(0, video.duration - 0.001)));
  if (Math.abs(video.currentTime - target) < 0.02) return;
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      // Small delay to ensure the frame is fully decoded and painted
      requestAnimationFrame(() => resolve());
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = target;
  });
}

function drawVideoFrame(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, canvasW: number, canvasH: number) {
  const scale = Math.min(canvasW / video.videoWidth, canvasH / video.videoHeight);
  const drawW = video.videoWidth * scale;
  const drawH = video.videoHeight * scale;
  const offsetX = (canvasW - drawW) / 2;
  const offsetY = (canvasH - drawH) / 2;
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
}

/** Fetch a URL as ArrayBuffer (handles both blob: and http URLs, uses blob cache) */
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const resolved = await resolveVideoUrl(url);
  const resp = await fetch(resolved);
  return resp.arrayBuffer();
}

/** Decode audio from a video URL. Returns null if no audio track or decoding fails. */
async function decodeAudioFromUrl(url: string, audioCtx: OfflineAudioContext | AudioContext): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await fetchAsArrayBuffer(url);
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } catch (err) {
    console.warn("No audio track or decode failed for:", url, err);
    return null;
  }
}

/** Concatenate multiple AudioBuffers into one. Null entries produce silence for the corresponding video duration. */
function concatenateAudioBuffers(
  buffers: (AudioBuffer | null)[],
  videoDurations: number[],
  sampleRate: number,
  channels: number,
): AudioBuffer | null {
  let totalLength = 0;
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (buf) {
      totalLength += buf.length;
    } else {
      totalLength += Math.round(videoDurations[i] * sampleRate);
    }
  }

  if (totalLength === 0) return null;

  const offlineCtx = new OfflineAudioContext(channels, totalLength, sampleRate);
  const result = offlineCtx.createBuffer(channels, totalLength, sampleRate);

  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    const buf = buffers[i];
    if (buf) {
      for (let ch = 0; ch < channels; ch++) {
        const destData = result.getChannelData(ch);
        const srcData = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1));
        destData.set(srcData, offset);
      }
      offset += buf.length;
    } else {
      offset += Math.round(videoDurations[i] * sampleRate);
    }
  }

  return result;
}

/** Check if AudioEncoder supports AAC */
async function canEncodeAAC(sampleRate: number, channels: number): Promise<boolean> {
  if (typeof AudioEncoder === "undefined") return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (AudioEncoder as any).isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate,
      numberOfChannels: channels,
      bitrate: 128_000,
    });
    return !!result?.supported;
  } catch {
    return false;
  }
}

export function VideoMergePreview({ videoUrls, language, onBack, storyTopic, scenes: captionScenes, storyLanguage, subtitlesEnabled = false, subtitleOptions, musicUrl, onMusicGenerated, onMusicRemoved, estimatedDuration, initialMergedUrl, onMergedUrlChange }: VideoMergePreviewProps) {
  const { plan, credits, isUnlimited, refetch: refetchCredits } = useCredits();
  const { user } = useAuth();
  const [mergedUrl, setMergedUrl] = useState<string | null>(initialMergedUrl || null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<(typeof VIDEO_FORMATS)[number]["id"]>("mp4");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [socialCaption, setSocialCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [showPreMerge, setShowPreMerge] = useState(!initialMergedUrl);
  const [localMusicUrl, setLocalMusicUrl] = useState<string | null>(musicUrl || null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(20);

  const outputBlobRef = useRef<Blob | null>(null);
  const outputKindRef = useRef<OutputKind | null>(null);

  const effectiveMusicUrl = musicUrl !== undefined ? musicUrl : localMusicUrl;

  // Load cached caption or auto-generate
  useEffect(() => {
    if (!mergedUrl || !storyTopic) return;
    if (socialCaption) return;
    const cacheKey = `caption_animation_${storyTopic?.substring(0, 30)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setSocialCaption(cached); return; }
    if (!captionLoading) generateCaption();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedUrl]);

  const generateCaption = async () => {
    if (!storyTopic) return;
    setCaptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-social-caption", {
        body: {
          storyTopic,
          scenes: (captionScenes || []).map(s => ({ description: s.description })),
          language: storyLanguage || "tr",
        },
      });
      if (error) throw error;
      const caption = data?.caption || "";
      setSocialCaption(caption);
      if (caption) {
        localStorage.setItem(`caption_animation_${storyTopic?.substring(0, 30)}`, caption);
      }
    } catch (err) {
      console.error("Caption error:", err);
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
      toast.error(language === "tr" ? "Video henüz hazır değil" : "Video not ready yet");
      return;
    }

    // Try native share
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], `story.${outputKindRef.current === "webm" ? "webm" : "mp4"}`, { type: blob.type });
        const shareData: ShareData = { title: storyTopic || "Story Video", text: socialCaption || "", files: [file] };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch { /* fallback below */ }
    }

    // Fallback: download + copy caption + open platform
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story.${outputKindRef.current === "webm" ? "webm" : "mp4"}`;
    a.click();
    URL.revokeObjectURL(a.href);

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

  const mergeVideos = async () => {
    if (videoUrls.length === 0) return;
    setIsMerging(true);
    setMergeProgress(5);

    try {
      // Load video elements for frame extraction
      const loadedVideos: HTMLVideoElement[] = [];
      for (let i = 0; i < videoUrls.length; i++) {
        const video = await loadVideo(videoUrls[i]);
        loadedVideos.push(video);
        setMergeProgress(5 + Math.round(((i + 1) / videoUrls.length) * 5));
      }

      // Decode audio from each video
      const audioCtx = new AudioContext();
      const audioBuffers: (AudioBuffer | null)[] = [];
      const videoDurations: number[] = [];
      for (let i = 0; i < videoUrls.length; i++) {
        const audioBuf = await decodeAudioFromUrl(videoUrls[i], audioCtx);
        audioBuffers.push(audioBuf);
        const vid = loadedVideos[i];
        videoDurations.push(Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 1);
        setMergeProgress(10 + Math.round(((i + 1) / videoUrls.length) * 5));
      }
      await audioCtx.close();

      const hasAnyAudio = audioBuffers.some(b => b !== null);

      const sourceW = roundEven(loadedVideos[0].videoWidth || 1024);
      const sourceH = roundEven(loadedVideos[0].videoHeight || 1024);

      if (typeof VideoEncoder !== "undefined") {
        try {
          await mergeWithWebCodecs(loadedVideos, sourceW, sourceH, audioBuffers, videoDurations, hasAnyAudio);
          return;
        } catch (error) {
          console.error("WebCodecs merge failed, falling back to MediaRecorder:", error);
          toast.error(
            language === "tr"
              ? "MP4 birleştirme desteklenmedi, WebM hazırlanıyor."
              : "MP4 merge not supported; preparing WebM.",
          );
        }
      }

      await mergeWithMediaRecorder(loadedVideos, sourceW, sourceH, audioBuffers, videoDurations, hasAnyAudio);
    } catch (err) {
      console.error("Video merge error:", err);
      toast.error(language === "tr" ? "Video birleştirme başarısız oldu." : "Video merge failed.");
    } finally {
      setIsMerging(false);
    }
  };

  const mergeWithWebCodecs = async (
    loadedVideos: HTMLVideoElement[],
    sourceW: number,
    sourceH: number,
    audioBuffers: (AudioBuffer | null)[],
    videoDurations: number[],
    hasAnyAudio: boolean,
  ) => {
    const Mp4Muxer = await import("mp4-muxer");
    const FPS = 30;

    let width = sourceW;
    let height = sourceH;

    let picked = await pickSupportedH264Codec(width, height, FPS);
    if (!picked) {
      const scaled = scaleToMaxArea(width, height, 1280 * 720);
      width = scaled.w;
      height = scaled.h;
      picked = await pickSupportedH264Codec(width, height, FPS);
    }
    if (!picked) throw new Error("No supported H.264 codec config found");

    // Audio setup
    const SAMPLE_RATE = 48000;
    const CHANNELS = 2;
    let useAudioEncoder = false;
    let concatenatedAudio: AudioBuffer | null = null;

    if (hasAnyAudio) {
      // Resample all audio to consistent sample rate
      const resampledBuffers: (AudioBuffer | null)[] = [];
      for (let i = 0; i < audioBuffers.length; i++) {
        const buf = audioBuffers[i];
        if (buf && (buf.sampleRate !== SAMPLE_RATE || buf.numberOfChannels !== CHANNELS)) {
          // Resample using OfflineAudioContext
          const offCtx = new OfflineAudioContext(CHANNELS, Math.round(buf.duration * SAMPLE_RATE), SAMPLE_RATE);
          const source = offCtx.createBufferSource();
          source.buffer = buf;
          source.connect(offCtx.destination);
          source.start();
          const resampled = await offCtx.startRendering();
          resampledBuffers.push(resampled);
        } else {
          resampledBuffers.push(buf);
        }
      }

      concatenatedAudio = concatenateAudioBuffers(resampledBuffers, videoDurations, SAMPLE_RATE, CHANNELS);

      // Mix in background music if available
      if (concatenatedAudio && musicEnabled && effectiveMusicUrl) {
        try {
          const musicResp = await fetch(effectiveMusicUrl);
          const musicAb = await musicResp.arrayBuffer();
          const tempCtx2 = new AudioContext();
          const musicBuffer = await tempCtx2.decodeAudioData(musicAb);
          await tempCtx2.close();

          const totalSamples = concatenatedAudio.length;
          const mixCtx = new OfflineAudioContext(CHANNELS, totalSamples, SAMPLE_RATE);
          const origSrc = mixCtx.createBufferSource();
          origSrc.buffer = concatenatedAudio;
          origSrc.connect(mixCtx.destination);
          origSrc.start(0);
          const musicSrc = mixCtx.createBufferSource();
          musicSrc.buffer = musicBuffer;
          const gainNode = mixCtx.createGain();
          gainNode.gain.value = musicVolume / 100;
          musicSrc.connect(gainNode);
          gainNode.connect(mixCtx.destination);
          musicSrc.start(0);
          concatenatedAudio = await mixCtx.startRendering();
        } catch (e) {
          console.warn("Failed to mix background music:", e);
        }
      }

      if (concatenatedAudio) {
        useAudioEncoder = await canEncodeAAC(SAMPLE_RATE, CHANNELS);
      }
    }

    // Build muxer config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const muxerOptions: any = {
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width, height },
      fastStart: "in-memory",
    };

    if (useAudioEncoder && concatenatedAudio) {
      muxerOptions.audio = {
        codec: "aac",
        numberOfChannels: CHANNELS,
        sampleRate: SAMPLE_RATE,
      };
    }

    const muxer = new Mp4Muxer.Muxer(muxerOptions);

    // Video encoder
    let videoEncoderClosed = false;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta ?? undefined); },
      error: (e) => { videoEncoderClosed = true; console.error("VideoEncoder error:", e); },
    });
    videoEncoder.configure(picked.config);

    // Audio encoder
    let audioEncoder: AudioEncoder | null = null;
    if (useAudioEncoder && concatenatedAudio) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => { muxer.addAudioChunk(chunk, meta ?? undefined); },
        error: (e) => { console.error("AudioEncoder error:", e); },
      });
      audioEncoder.configure({
        codec: "mp4a.40.2",
        sampleRate: SAMPLE_RATE,
        numberOfChannels: CHANNELS,
        bitrate: 128_000,
      });
    }

    setMergeProgress(20);

    // Encode video frames
    let totalFrames = 0;
    for (const video of loadedVideos) {
      const sec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      totalFrames += Math.max(1, Math.round(sec * FPS));
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    let frameIndex = 0;
    for (let videoIdx = 0; videoIdx < loadedVideos.length; videoIdx++) {
      const video = loadedVideos[videoIdx];
      const sec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const frameCount = Math.max(1, Math.round(sec * FPS));

      for (let f = 0; f < frameCount; f++) {
        if (videoEncoderClosed) throw new Error("Encoder kapandı");

        const targetTime = f / FPS;
        await seekVideo(video, targetTime);
        drawVideoFrame(ctx, video, width, height);

        // Subtitles
        if (subtitlesEnabled && captionScenes && captionScenes[videoIdx]) {
          const scene = captionScenes[videoIdx];
          const dialogues = scene.dialogues || [];
          let subtitleText = "";
          if (dialogues.length > 0) {
            const sec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
            const sliceDuration = sec / dialogues.length;
            const currentDialogueIdx = Math.min(Math.floor((f / FPS) / sliceDuration), dialogues.length - 1);
            const d = dialogues[currentDialogueIdx];
            const fullText = d.text || "";
            const dialogueProgress = ((f / FPS) - currentDialogueIdx * sliceDuration) / sliceDuration;
            subtitleText = getSubtitleChunk(fullText, dialogueProgress, 5);
          } else if (scene.description) {
            const sceneProgress = f / frameCount;
            subtitleText = getSubtitleChunk(scene.description, sceneProgress, 5);
          }
          if (subtitleText) drawSubtitle(ctx, subtitleText, width, height, subtitleOptions);
        }

        if (shouldWatermark(plan)) drawWatermarkSync(ctx, width, height);

        const timestamp = (frameIndex * 1_000_000) / FPS;
        const frame = new VideoFrame(canvas, { timestamp, duration: 1_000_000 / FPS });
        videoEncoder.encode(frame, { keyFrame: f === 0 });
        frame.close();
        frameIndex++;

        if (frameIndex % 10 === 0) {
          setMergeProgress(Math.min(85, 20 + Math.round((frameIndex / totalFrames) * 65)));
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    await videoEncoder.flush();
    videoEncoder.close();

    // Encode audio in chunks
    if (audioEncoder && concatenatedAudio) {
      const CHUNK_SIZE = 4096;
      const totalSamples = concatenatedAudio.length;

      for (let offset = 0; offset < totalSamples; offset += CHUNK_SIZE) {
        const remaining = Math.min(CHUNK_SIZE, totalSamples - offset);
        // WebCodecs AudioData expects a valid AudioSampleFormat; use planar float32.
        const planar = new Float32Array(remaining * CHANNELS);
        for (let ch = 0; ch < CHANNELS; ch++) {
          const channelData = concatenatedAudio.getChannelData(ch);
          const planeOffset = ch * remaining;
          for (let s = 0; s < remaining; s++) {
            planar[planeOffset + s] = channelData[offset + s];
          }
        }

        const audioData = new AudioData({
          format: "f32-planar" as AudioSampleFormat,
          sampleRate: SAMPLE_RATE,
          numberOfFrames: remaining,
          numberOfChannels: CHANNELS,
          timestamp: Math.round((offset / SAMPLE_RATE) * 1_000_000),
          data: new Uint8Array(planar.buffer),
        });

        audioEncoder.encode(audioData);
        audioData.close();

        if (offset % (CHUNK_SIZE * 50) === 0) {
          setMergeProgress(Math.min(95, 85 + Math.round((offset / totalSamples) * 10)));
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      await audioEncoder.flush();
      audioEncoder.close();
    }

    muxer.finalize();
    setMergeProgress(98);

    const buf = (muxerOptions.target as InstanceType<typeof Mp4Muxer.ArrayBufferTarget>).buffer;
    const blob = new Blob([buf], { type: "video/mp4" });
    outputBlobRef.current = blob;
    outputKindRef.current = "mp4";

    const url = URL.createObjectURL(blob);
    setMergedUrl(url);
    onMergedUrlChange?.(url);
    setMergeProgress(100);
  };

  const mergeWithMediaRecorder = async (
    loadedVideos: HTMLVideoElement[],
    sourceW: number,
    sourceH: number,
    audioBuffers: (AudioBuffer | null)[],
    videoDurations: number[],
    hasAnyAudio: boolean,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = sourceW;
    canvas.height = sourceH;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    const FPS = 30;
    const frameDelay = 1000 / FPS;

    // Create combined stream: canvas video + audio
    const videoStream = canvas.captureStream(FPS);

    let combinedStream: MediaStream;

    if (hasAnyAudio) {
      // Use AudioContext to play concatenated audio into a MediaStreamDestination
      const SAMPLE_RATE = 48000;
      const CHANNELS = 2;

      const resampledBuffers: (AudioBuffer | null)[] = [];
      const tempCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      for (let i = 0; i < audioBuffers.length; i++) {
        const buf = audioBuffers[i];
        if (buf && (buf.sampleRate !== SAMPLE_RATE || buf.numberOfChannels !== CHANNELS)) {
          const offCtx = new OfflineAudioContext(CHANNELS, Math.round(buf.duration * SAMPLE_RATE), SAMPLE_RATE);
          const source = offCtx.createBufferSource();
          source.buffer = buf;
          source.connect(offCtx.destination);
          source.start();
          resampledBuffers.push(await offCtx.startRendering());
        } else {
          resampledBuffers.push(buf);
        }
      }

      let concatenatedAudio = concatenateAudioBuffers(resampledBuffers, videoDurations, SAMPLE_RATE, CHANNELS);

      // Mix in background music
      if (concatenatedAudio && effectiveMusicUrl) {
        try {
          const musicResp = await fetch(effectiveMusicUrl);
          const musicAb = await musicResp.arrayBuffer();
          const musicBuffer = await tempCtx.decodeAudioData(musicAb);
          const totalSamples = concatenatedAudio.length;
          const mixCtx = new OfflineAudioContext(CHANNELS, totalSamples, SAMPLE_RATE);
          const origSrc = mixCtx.createBufferSource();
          origSrc.buffer = concatenatedAudio;
          origSrc.connect(mixCtx.destination);
          origSrc.start(0);
          const musicSrc = mixCtx.createBufferSource();
          musicSrc.buffer = musicBuffer;
          const gainNode = mixCtx.createGain();
          gainNode.gain.value = 0.25;
          musicSrc.connect(gainNode);
          gainNode.connect(mixCtx.destination);
          musicSrc.start(0);
          concatenatedAudio = await mixCtx.startRendering();
        } catch (e) {
          console.warn("Failed to mix background music in MediaRecorder:", e);
        }
      }

      if (concatenatedAudio) {
        const audioDest = tempCtx.createMediaStreamDestination();
        const bufferSource = tempCtx.createBufferSource();
        bufferSource.buffer = concatenatedAudio;
        bufferSource.connect(audioDest);
        bufferSource.start();

        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDest.stream.getAudioTracks(),
        ]);
      } else {
        combinedStream = videoStream;
      }
    } else if (effectiveMusicUrl) {
      // No video audio but music available
      try {
        const musicResp = await fetch(effectiveMusicUrl);
        const musicAb = await musicResp.arrayBuffer();
        const tempCtx = new AudioContext();
        const musicBuffer = await tempCtx.decodeAudioData(musicAb);
        const audioDest = tempCtx.createMediaStreamDestination();
        const src = tempCtx.createBufferSource();
        src.buffer = musicBuffer;
        src.connect(audioDest);
        src.start(0);
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDest.stream.getAudioTracks(),
        ]);
      } catch (e) {
        console.warn("Failed to add music:", e);
        combinedStream = videoStream;
      }
    } else {
      combinedStream = videoStream;
    }

    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(
      (m) => MediaRecorder.isTypeSupported(m),
    ) || "video/webm";

    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    const donePromise = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    recorder.start(100);

    let totalFrames = 0;
    for (const video of loadedVideos) {
      const sec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      totalFrames += Math.max(1, Math.round(sec * FPS));
    }

    let frameIndex = 0;
    for (let videoIdx = 0; videoIdx < loadedVideos.length; videoIdx++) {
      const video = loadedVideos[videoIdx];
      const sec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const frameCount = Math.max(1, Math.round(sec * FPS));
      for (let f = 0; f < frameCount; f++) {
        await seekVideo(video, f / FPS);
        drawVideoFrame(ctx, video, sourceW, sourceH);

        // Subtitles
        if (subtitlesEnabled && captionScenes && captionScenes[videoIdx]) {
          const scene = captionScenes[videoIdx];
          const dialogues = scene.dialogues || [];
          let subtitleText = "";
          if (dialogues.length > 0) {
            const sliceDuration = sec / dialogues.length;
            const currentDialogueIdx = Math.min(Math.floor((f / FPS) / sliceDuration), dialogues.length - 1);
            const d = dialogues[currentDialogueIdx];
            const fullText = d.text || "";
            const dialogueProgress = ((f / FPS) - currentDialogueIdx * sliceDuration) / sliceDuration;
            subtitleText = getSubtitleChunk(fullText, dialogueProgress, 5);
          } else if (scene.description) {
            const sceneProgress = f / frameCount;
            subtitleText = getSubtitleChunk(scene.description, sceneProgress, 5);
          }
          if (subtitleText) drawSubtitle(ctx, subtitleText, sourceW, sourceH, subtitleOptions);
        }

        if (shouldWatermark(plan)) drawWatermarkSync(ctx, sourceW, sourceH);
        await new Promise((r) => setTimeout(r, frameDelay));
        frameIndex++;
        if (frameIndex % 5 === 0) {
          setMergeProgress(Math.min(95, 20 + Math.round((frameIndex / totalFrames) * 75)));
        }
      }
    }

    recorder.stop();
    await donePromise;

    const blob = new Blob(chunks, { type: mimeType });
    outputBlobRef.current = blob;
    outputKindRef.current = "webm";

    const url = URL.createObjectURL(blob);
    setMergedUrl(url);
    onMergedUrlChange?.(url);
    setMergeProgress(100);
  };

  const handleDownload = async () => {
    const blob = outputBlobRef.current;
    const kind = outputKindRef.current;
    if (!blob || !kind) return;

    const effectiveFormat =
      kind === "webm"
        ? VIDEO_FORMATS.find((f) => f.id === "webm")!
        : VIDEO_FORMATS.find((f) => f.id === selectedFormat) || VIDEO_FORMATS[0];

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `story-video.${effectiveFormat.ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {language === "tr" ? "Video Önizleme" : "Video Preview"}
        </h2>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {language === "tr" ? "Editöre Dön" : "Back to Editor"}
        </Button>
      </div>

      {/* Pre-merge: Music Generator + Merge Button */}
      {showPreMerge && !mergedUrl && !isMerging && (
        <div className="space-y-4">
          <AIMusicGenerator
            language={language}
            storyTopic={storyTopic}
            estimatedDuration={estimatedDuration || videoUrls.length * 5}
            onMusicGenerated={(url) => {
              setLocalMusicUrl(url);
              onMusicGenerated?.(url);
            }}
            onMusicRemoved={() => {
              setLocalMusicUrl(null);
              onMusicRemoved?.();
            }}
            generatedMusicUrl={effectiveMusicUrl}
            onCreditDebit={async (amount, description) => {
              if (!user || isUnlimited) return;
              await supabase.from("user_credits").update({ credits: credits - amount }).eq("user_id", user.id);
              await supabase.from("credit_transactions").insert({ user_id: user.id, amount, type: "debit", description });
              refetchCredits();
            }}
            musicEnabled={musicEnabled}
            onMusicEnabledChange={setMusicEnabled}
            volume={musicVolume}
            onVolumeChange={setMusicVolume}
          />
          <Button
            onClick={() => {
              setShowPreMerge(false);
              void mergeVideos();
            }}
            className="w-full h-12 text-base font-semibold"
          >
            <Video className="mr-2 h-4 w-4" />
            {language === "tr" ? "Videoyu Birleştir" : "Merge & Create Video"}
          </Button>
        </div>
      )}

      {/* Social Media Caption */}
      {storyTopic && mergedUrl && (
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
              <span className="text-sm text-muted-foreground">{language === "tr" ? "Viral açıklama oluşturuluyor..." : "Generating viral caption..."}</span>
            </div>
          ) : socialCaption ? (
            <div className="space-y-3">
              <div className="relative rounded-md border bg-background p-3">
                <p className="text-sm whitespace-pre-wrap pr-8">{socialCaption}</p>
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={copyCaption}>
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
        {isMerging ? (
          <div className="flex aspect-video items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {language === "tr" ? "Videolar hazırlanıyor..." : "Preparing videos..."}
              </p>
              <Progress value={mergeProgress} className="h-2 w-48" />
            </div>
          </div>
        ) : mergedUrl ? (
          <video ref={videoRef} src={mergedUrl} controls className="w-full" />
        ) : (
          <div className="flex aspect-video items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {language === "tr" ? "Video hazırlanıyor..." : "Preparing video..."}
            </p>
          </div>
        )}
      </div>

      {/* Regenerate Video Button */}
      {mergedUrl && !isMerging && (
        <Button onClick={() => { setMergedUrl(null); setShowPreMerge(false); void mergeVideos(); }} variant="outline" className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          {language === "tr" ? "Videoyu Yeniden Oluştur" : "Regenerate Video"}
        </Button>
      )}

      <div className="flex gap-3">
        <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as (typeof VIDEO_FORMATS)[number]["id"])}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_FORMATS.map((f) => (
              <SelectItem key={f.id} value={f.id} disabled={outputKindRef.current === "webm" && f.id !== "webm"}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleDownload}
          disabled={!mergedUrl || isMerging}
          className="flex-1"
          size="lg"
        >
          <Download className="mr-2 h-4 w-4" />
          {language === "tr" ? "Videoyu İndir" : "Download Video"}
        </Button>
      </div>
    </div>
  );
}
