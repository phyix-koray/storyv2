import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, Plus, Trash2, Download, Volume2, VolumeX,
  SkipBack, Film, Image as ImageIcon, Music, MoveUp, MoveDown,
  Search, Upload, Loader2, Copy, Group,
} from "lucide-react";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TimelineClip, TimelineAudioClip, TimelineMusicClip } from "@/lib/types";

interface TimelineVideoEditorProps {
  availableImages: Array<{ url: string; label: string }>;
  availableAudio: Array<{ url: string; label: string; characterName?: string; text?: string; duration: number }>;
}

interface FreesoundResult {
  id: number;
  name: string;
  duration: number;
  username: string;
  license: string;
  tags: string[];
  previewUrl: string;
}

export function TimelineVideoEditor({ availableImages, availableAudio }: TimelineVideoEditorProps) {
  const { language } = useAppStore();
  const t = (tr: string, en: string) => language === "tr" ? tr : en;

  const [clips, setClips] = useState<(TimelineClip & { groupId?: string })[]>([]);
  const [audioClips, setAudioClips] = useState<TimelineAudioClip[]>([]);
  const [musicClips, setMusicClips] = useState<TimelineMusicClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Music search state
  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<FreesoundResult[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [musicPage, setMusicPage] = useState(1);
  const [musicHasNext, setMusicHasNext] = useState(false);
  const [playingPreviewId, setPlayingPreviewId] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicFileRef = useRef<HTMLInputElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackRef = useRef<{ cancel: boolean }>({ cancel: false });
  const videoRef = useRef<HTMLVideoElement>(null);

  const totalDuration = Math.max(
    clips.reduce((sum, c) => sum + c.duration, 0),
    audioClips.filter(a => !a.muted).reduce((sum, a) => sum + a.duration, 0),
    musicClips.filter(m => !m.muted).reduce((sum, m) => sum + m.duration, 0),
    0.1
  );

  // Auto-populate timeline from available media
  useEffect(() => {
    if (clips.length === 0 && availableImages.length > 0) {
      setClips(availableImages.map((img, i) => ({
        id: crypto.randomUUID(),
        imageUrl: img.url,
        duration: availableAudio[i]?.duration || 3,
        label: img.label,
      })));
    }
    if (audioClips.length === 0 && availableAudio.length > 0) {
      setAudioClips(availableAudio.map((aud) => ({
        id: crypto.randomUUID(),
        audioUrl: aud.url,
        duration: aud.duration,
        label: aud.label,
        characterName: aud.characterName,
        text: aud.text,
        muted: false,
        volume: 1,
      })));
    }
  }, []);

  // ── Clip actions ──
  const addClip = (imgUrl: string, label: string) => {
    setClips(prev => [...prev, { id: crypto.randomUUID(), imageUrl: imgUrl, duration: 3, label }]);
  };

  const addAudioClip = (aud: typeof availableAudio[0]) => {
    setAudioClips(prev => [...prev, {
      id: crypto.randomUUID(), audioUrl: aud.url, duration: aud.duration,
      label: aud.label, characterName: aud.characterName, text: aud.text, muted: false, volume: 1,
    }]);
  };

  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    if (selectedClipId === id) setSelectedClipId(null);
  };

  const removeAudioClip = (id: string) => {
    setAudioClips(prev => prev.filter(a => a.id !== id));
    if (selectedAudioId === id) setSelectedAudioId(null);
  };

  const removeMusicClip = (id: string) => {
    setMusicClips(prev => prev.filter(m => m.id !== id));
  };

  const updateClipDuration = (id: string, duration: number) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, duration: Math.max(0.01, duration) } : c));
  };

  const toggleAudioMute = (id: string) => {
    setAudioClips(prev => prev.map(a => a.id === id ? { ...a, muted: !a.muted } : a));
  };

  const toggleMusicMute = (id: string) => {
    setMusicClips(prev => prev.map(m => m.id === id ? { ...m, muted: !m.muted } : m));
  };

  const updateMusicVolume = (id: string, volume: number) => {
    setMusicClips(prev => prev.map(m => m.id === id ? { ...m, volume } : m));
  };

  const moveClip = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= clips.length) return;
    setClips(prev => { const arr = [...prev]; [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]; return arr; });
  };

  const moveAudio = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= audioClips.length) return;
    setAudioClips(prev => { const arr = [...prev]; [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]; return arr; });
  };

  const duplicateClip = (id: string) => {
    // Get all IDs to duplicate: selected clips, or group members, or single clip
    const targetIds = new Set<string>();

    if (selectedClipIds.size > 1) {
      // Multi-select: duplicate all selected
      selectedClipIds.forEach(sid => targetIds.add(sid));
    } else {
      // Check if clip is in a group
      const clip = clips.find(c => c.id === id);
      if (clip?.groupId) {
        clips.filter(c => c.groupId === clip.groupId).forEach(c => targetIds.add(c.id));
      } else {
        targetIds.add(id);
      }
    }

    setClips(prev => {
      const arr = [...prev];
      const newGroupId = targetIds.size > 1 ? crypto.randomUUID() : undefined;
      // Insert copies after the last target clip
      const lastIdx = Math.max(...Array.from(targetIds).map(tid => arr.findIndex(c => c.id === tid)));
      const copies = Array.from(targetIds).map(tid => {
        const original = arr.find(c => c.id === tid)!;
        return { ...original, id: crypto.randomUUID(), label: `${original.label || 'Clip'} (copy)`, groupId: newGroupId };
      });
      arr.splice(lastIdx + 1, 0, ...copies);
      return arr;
    });
    toast.success(t(`${targetIds.size} klip kopyalandı`, `${targetIds.size} clip(s) duplicated`));
  };

  const toggleClipSelection = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && selectedClipIds.size > 0) {
      // Range selection: from last selected to current
      const lastSelected = Array.from(selectedClipIds).pop()!;
      const lastIdx = clips.findIndex(c => c.id === lastSelected);
      const currentIdx = clips.findIndex(c => c.id === id);
      const start = Math.min(lastIdx, currentIdx);
      const end = Math.max(lastIdx, currentIdx);
      const range = new Set(selectedClipIds);
      for (let i = start; i <= end; i++) range.add(clips[i].id);
      setSelectedClipIds(range);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedClipIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedClipIds(new Set([id]));
    }
  };

  const groupSelectedClips = () => {
    if (selectedClipIds.size < 2) {
      toast.error(t("En az 2 klip seçin", "Select at least 2 clips"));
      return;
    }
    const groupId = crypto.randomUUID();
    setClips(prev => prev.map(c => selectedClipIds.has(c.id) ? { ...c, groupId } : c));
    toast.success(t("Klipler gruplandı", "Clips grouped"));
    setSelectedClipIds(new Set());
  };

  const ungroupClip = (groupId: string) => {
    setClips(prev => prev.map(c => c.groupId === groupId ? { ...c, groupId: undefined } : c));
    toast.success(t("Grup çözüldü", "Group removed"));
  };

  const getGroupColor = (groupId: string) => {
    const colors = ["border-l-blue-500", "border-l-green-500", "border-l-yellow-500", "border-l-purple-500", "border-l-pink-500", "border-l-orange-500"];
    let hash = 0;
    for (let i = 0; i < groupId.length; i++) hash = ((hash << 5) - hash) + groupId.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  // ── Music search ──
  const searchMusic = async (page = 1) => {
    if (!musicQuery.trim()) return;
    setMusicSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-music", {
        body: { query: musicQuery.trim(), page, minDuration: 5, maxDuration: 600 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMusicResults(page === 1 ? data.results : [...musicResults, ...data.results]);
      setMusicHasNext(data.hasNext);
      setMusicPage(page);
    } catch (err: any) {
      toast.error(err?.message || t("Müzik araması başarısız", "Music search failed"));
    } finally {
      setMusicSearching(false);
    }
  };

  const togglePreview = (result: FreesoundResult) => {
    if (playingPreviewId === result.id) {
      previewAudioRef.current?.pause();
      setPlayingPreviewId(null);
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(result.previewUrl);
    audio.onended = () => setPlayingPreviewId(null);
    audio.play();
    previewAudioRef.current = audio;
    setPlayingPreviewId(result.id);
  };

  const addMusicFromResult = (result: FreesoundResult) => {
    setMusicClips(prev => [...prev, {
      id: crypto.randomUUID(),
      audioUrl: result.previewUrl,
      duration: result.duration,
      label: `${result.name} (${result.username})`,
      volume: 0.5,
      muted: false,
    }]);
    toast.success(t("Müzik eklendi", "Music added"));
  };

  const handleLocalMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setMusicClips(prev => [...prev, {
        id: crypto.randomUUID(),
        audioUrl: url,
        duration: audio.duration,
        label: file.name,
        volume: 0.5,
        muted: false,
      }]);
      toast.success(t("Müzik yüklendi", "Music uploaded"));
    };
    if (musicFileRef.current) musicFileRef.current.value = "";
  };

  // ── Draw frame ──
  const drawFrame = useCallback(async (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let elapsed = 0;
    let currentClip: TimelineClip | null = null;
    for (const clip of clips) {
      if (time >= elapsed && time < elapsed + clip.duration) { currentClip = clip; break; }
      elapsed += clip.duration;
    }

    if (!currentClip) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      img.onload = () => { canvas.width = img.naturalWidth || 800; canvas.height = img.naturalHeight || 600; ctx.drawImage(img, 0, 0); resolve(); };
      img.onerror = () => { ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, canvas.width, canvas.height); resolve(); };
      img.src = currentClip!.imageUrl;
    });
  }, [clips]);

  // ── Playback ──
  const startPlayback = async () => {
    if (clips.length === 0) return;
    setIsPlaying(true);
    playbackRef.current.cancel = false;

    const startTime = performance.now();
    const playDuration = totalDuration;

    // Play TTS audio
    const audioElements: HTMLAudioElement[] = [];
    let audioOffset = 0;
    for (const ac of audioClips.filter(a => !a.muted)) {
      const audio = new Audio(ac.audioUrl);
      audio.volume = ac.volume ?? 1;
      const delay = audioOffset;
      setTimeout(() => { if (!playbackRef.current.cancel) audio.play(); }, delay * 1000);
      audioElements.push(audio);
      audioOffset += ac.duration;
    }

    // Play music
    const musicElements: HTMLAudioElement[] = [];
    for (const mc of musicClips.filter(m => !m.muted)) {
      const audio = new Audio(mc.audioUrl);
      audio.volume = mc.volume;
      if (!playbackRef.current.cancel) audio.play();
      musicElements.push(audio);
    }

    const animate = async () => {
      if (playbackRef.current.cancel) {
        audioElements.forEach(a => a.pause());
        musicElements.forEach(a => a.pause());
        return;
      }
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= playDuration) {
        setIsPlaying(false);
        setCurrentTime(0);
        audioElements.forEach(a => a.pause());
        musicElements.forEach(a => a.pause());
        return;
      }
      setCurrentTime(elapsed);
      await drawFrame(elapsed);
      requestAnimationFrame(animate);
    };
    animate();
  };

  const stopPlayback = () => {
    playbackRef.current.cancel = true;
    setIsPlaying(false);
  };

  // ── Export ──
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => resolve(img); img.onerror = reject; img.src = src;
    });

  const exportVideo = async () => {
    if (clips.length === 0) { toast.error(t("Clip ekleyin", "Add clips")); return; }
    setIsExporting(true);
    try {
      const firstImg = await loadImage(clips[0].imageUrl);
      const canvasW = firstImg.naturalWidth || 800;
      const canvasH = firstImg.naturalHeight || 600;
      const canvas = document.createElement("canvas");
      canvas.width = canvasW; canvas.height = canvasH;
      const ctx = canvas.getContext("2d", { alpha: false })!;
      const stream = canvas.captureStream(30);

      const audioCtx = new AudioContext();
      const activeAudio = audioClips.filter(a => !a.muted);
      const activeMusic = musicClips.filter(m => !m.muted);
      const totalAudioDuration = activeAudio.reduce((s, a) => s + a.duration, 0);
      const totalTime = Math.max(
        clips.reduce((s, c) => s + c.duration, 0),
        totalAudioDuration,
        activeMusic.reduce((s, m) => s + m.duration, 0)
      );

      let mergedStream: MediaStream;

      if (activeAudio.length > 0 || activeMusic.length > 0) {
        const sampleRate = audioCtx.sampleRate;
        const totalSamples = Math.ceil(totalTime * sampleRate);
        const merged = audioCtx.createBuffer(1, totalSamples, sampleRate);
        const data = merged.getChannelData(0);

        // Mix TTS audio
        if (activeAudio.length > 0) {
          let offset = 0;
          for (const ac of activeAudio) {
            const resp = await fetch(ac.audioUrl);
            const arrBuf = await resp.arrayBuffer();
            const decoded = await audioCtx.decodeAudioData(arrBuf);
            const ch = decoded.getChannelData(0);
            const vol = ac.volume ?? 1;
            for (let i = 0; i < ch.length && offset + i < totalSamples; i++) {
              data[offset + i] += ch[i] * vol;
            }
            offset += decoded.length;
          }
        }

        // Mix music
        for (const mc of activeMusic) {
          try {
            const resp = await fetch(mc.audioUrl);
            const arrBuf = await resp.arrayBuffer();
            const decoded = await audioCtx.decodeAudioData(arrBuf);
            const ch = decoded.getChannelData(0);
            const vol = mc.volume;
            for (let i = 0; i < ch.length && i < totalSamples; i++) {
              data[i] += ch[i] * vol;
            }
          } catch (e) {
            console.warn("Could not decode music clip:", e);
          }
        }

        // Clamp
        for (let i = 0; i < totalSamples; i++) {
          data[i] = Math.max(-1, Math.min(1, data[i]));
        }

        const source = audioCtx.createBufferSource();
        source.buffer = merged;
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        mergedStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        source.start();
      } else {
        mergedStream = stream;
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus" : "video/webm";
      const recorder = new MediaRecorder(mergedStream, { mimeType, videoBitsPerSecond: 20_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
      recorder.start();

      const imageCache: Record<string, HTMLImageElement> = {};
      for (const clip of clips) {
        if (!imageCache[clip.imageUrl]) imageCache[clip.imageUrl] = await loadImage(clip.imageUrl);
      }

      for (const clip of clips) {
        const img = imageCache[clip.imageUrl];
        const clipEnd = performance.now() + clip.duration * 1000;
        while (performance.now() < clipEnd) {
          ctx.drawImage(img, 0, 0, canvasW, canvasH);
          const remaining = clipEnd - performance.now();
          if (remaining > 0) await new Promise(r => setTimeout(r, Math.min(remaining, 33)));
        }
      }

      await new Promise(r => setTimeout(r, 200));
      recorder.stop();
      await done;
      audioCtx.close();

      const blob = new Blob(chunks, { type: mimeType });
      setVideoUrl(URL.createObjectURL(blob));
      toast.success(t("Video oluşturuldu!", "Video exported!"));
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement("a"); a.href = videoUrl; a.download = "timeline-video.webm"; a.click();
  };

  useEffect(() => {
    if (clips.length > 0 && !isPlaying) drawFrame(currentTime);
  }, [clips, currentTime, isPlaying, drawFrame]);

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="rounded-lg border overflow-hidden bg-muted aspect-video flex items-center justify-center">
        {videoUrl ? (
          <video ref={videoRef} src={videoUrl} controls className="w-full h-full object-contain" />
        ) : (
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2 justify-center">
        <Button size="sm" variant="ghost" onClick={() => { setCurrentTime(0); drawFrame(0); }}>
          <SkipBack className="h-4 w-4" />
        </Button>
        {isPlaying ? (
          <Button size="sm" onClick={stopPlayback}>
            <Pause className="h-4 w-4 mr-1" /> {t("Durdur", "Pause")}
          </Button>
        ) : (
          <Button size="sm" onClick={startPlayback} disabled={clips.length === 0}>
            <Play className="h-4 w-4 mr-1" /> {t("Oynat", "Play")}
          </Button>
        )}
        <Badge variant="secondary" className="text-xs">
          {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
        </Badge>
      </div>

      <Slider value={[currentTime]} min={0} max={totalDuration} step={0.1}
        onValueChange={([v]) => { setCurrentTime(v); if (!isPlaying) drawFrame(v); }} />

      {/* Media Pools: Images + Audio + Music */}
      <div className="grid grid-cols-3 gap-3">
        {/* Images Pool */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <ImageIcon className="h-3 w-3" /> {t("Görseller", "Images")}
          </Label>
          <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
            {availableImages.map((img, i) => (
              <button key={i} className="relative rounded border overflow-hidden hover:ring-2 ring-primary transition-all aspect-square"
                onClick={() => addClip(img.url, img.label)} title={t("Timeline'a ekle", "Add to timeline")}>
                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[8px] text-center py-0.5 truncate">{img.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Audio Pool */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Volume2 className="h-3 w-3" /> {t("Sesler", "Audio")}
          </Label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {availableAudio.map((aud, i) => (
              <button key={i} className="w-full flex items-center gap-1.5 rounded border p-1.5 hover:bg-accent/50 transition-colors text-left"
                onClick={() => addAudioClip(aud)}>
                <Plus className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-[10px] flex-1 truncate">{aud.label}</span>
                <Badge variant="secondary" className="text-[8px] shrink-0">{aud.duration.toFixed(1)}s</Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Music Pool */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Music className="h-3 w-3" /> {t("Müzik", "Music")}
          </Label>
          {/* Mood presets */}
          <div className="flex flex-wrap gap-1">
            {[
              { en: "epic cinematic", tr: "epik sinematik", label: "🎬 Epic" },
              { en: "happy upbeat", tr: "mutlu neşeli", label: "😊 Happy" },
              { en: "sad emotional piano", tr: "hüzünlü duygusal piyano", label: "😢 Sad" },
              { en: "tense suspense", tr: "gerilim heyecan", label: "😰 Tense" },
              { en: "calm ambient", tr: "sakin ambient", label: "🧘 Calm" },
              { en: "funny comedy", tr: "komik komedi", label: "😂 Funny" },
              { en: "war battle", tr: "savaş savaşı", label: "⚔️ War" },
              { en: "romantic love", tr: "romantik aşk", label: "❤️ Romance" },
            ].map(mood => (
              <button
                key={mood.en}
                className="px-1.5 py-0.5 rounded-full bg-accent/50 hover:bg-accent text-[8px] font-medium transition-colors"
                onClick={() => { setMusicQuery(language === "tr" ? mood.tr : mood.en); searchMusic(1); }}
              >
                {mood.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Input placeholder={t("Ara...", "Search...")} value={musicQuery}
              onChange={e => setMusicQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchMusic(1)}
              className="h-6 text-[10px] px-1.5" />
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => searchMusic(1)} disabled={musicSearching}>
              {musicSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </Button>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {musicResults.map(r => (
              <div key={r.id} className="flex items-center gap-1 rounded border p-1 text-[10px]">
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0 shrink-0" onClick={() => togglePreview(r)}>
                  {playingPreviewId === r.id ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
                </Button>
                <span className="flex-1 truncate" title={r.name}>{r.name}</span>
                <Badge variant="secondary" className="text-[7px] shrink-0">{r.duration}s</Badge>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0 shrink-0" onClick={() => addMusicFromResult(r)}>
                  <Plus className="h-2.5 w-2.5" />
                </Button>
              </div>
            ))}
            {musicHasNext && (
              <Button size="sm" variant="ghost" className="w-full h-5 text-[9px]" onClick={() => searchMusic(musicPage + 1)} disabled={musicSearching}>
                {t("Daha fazla", "Load more")}
              </Button>
            )}
          </div>
          <Button size="sm" variant="outline" className="w-full h-6 text-[10px]" onClick={() => musicFileRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> {t("Dosyadan Yükle", "Upload File")}
          </Button>
          <input ref={musicFileRef} type="file" accept="audio/*" className="hidden" onChange={handleLocalMusicUpload} />
        </div>
      </div>

      {/* Video Track */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1">
          <Film className="h-3 w-3" /> {t("Video Kanalı", "Video Track")}
        </Label>
        {clips.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">
            {t("Görsel eklemek için yukarıdaki havuzdan tıklayın", "Click images above to add to timeline")}
          </p>
        ) : (
          <div className="space-y-1">
            {selectedClipIds.size >= 2 && (
              <Button size="sm" variant="outline" className="w-full h-6 text-[10px] mb-1" onClick={groupSelectedClips}>
                <Group className="h-3 w-3 mr-1" /> {t(`${selectedClipIds.size} klip grupla`, `Group ${selectedClipIds.size} clips`)}
              </Button>
            )}
            {clips.map((clip, i) => (
              <ContextMenu key={clip.id}>
                <ContextMenuTrigger asChild>
                  <div
                    className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors border-l-4 ${clip.groupId ? getGroupColor(clip.groupId) : "border-l-transparent"} ${selectedClipIds.has(clip.id) ? "ring-2 ring-primary bg-accent/30" : selectedClipId === clip.id ? "ring-1 ring-primary/50 bg-accent/20" : "hover:bg-accent/20"}`}
                    onContextMenu={(e) => {
                      // Don't reset selection on right-click
                      if (!selectedClipIds.has(clip.id)) {
                        setSelectedClipIds(new Set([clip.id]));
                      }
                      setSelectedClipId(clip.id); setSelectedAudioId(null);
                    }}
                    onClick={(e) => {
                      toggleClipSelection(clip.id, e);
                      setSelectedClipId(clip.id); setSelectedAudioId(null);
                      const startTime = clips.slice(0, i).reduce((s, c) => s + c.duration, 0);
                      setCurrentTime(startTime); drawFrame(startTime);
                    }}>
                    <div className="flex flex-col gap-0.5">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={e => { e.stopPropagation(); moveClip(i, -1); }}><MoveUp className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={e => { e.stopPropagation(); moveClip(i, 1); }}><MoveDown className="h-3 w-3" /></Button>
                    </div>
                    <img src={clip.imageUrl} alt="" className="h-10 w-14 rounded object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium truncate">{clip.label || `Clip ${i + 1}`}</p>
                      {clip.groupId && <Badge variant="secondary" className="text-[7px]">{t("Grup", "Group")}</Badge>}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Input type="number" value={clip.duration}
                          onChange={e => updateClipDuration(clip.id, parseFloat(e.target.value) || 0.01)}
                          className="h-5 w-14 text-[10px] px-1" min={0.01} step={0.01}
                          onClick={e => e.stopPropagation()} />
                        <span className="text-[9px] text-muted-foreground">s</span>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); removeClip(clip.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => duplicateClip(clip.id)}>
                    <Copy className="h-3.5 w-3.5 mr-2" /> {t("Kopyala", "Duplicate")}
                  </ContextMenuItem>
                  {selectedClipIds.size >= 2 && (
                    <ContextMenuItem onClick={groupSelectedClips}>
                      <Group className="h-3.5 w-3.5 mr-2" /> {t("Seçilenleri Grupla", "Group Selected")}
                    </ContextMenuItem>
                  )}
                  {clip.groupId && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => ungroupClip(clip.groupId!)}>
                        {t("Grubu Çöz", "Ungroup")}
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem className="text-destructive" onClick={() => removeClip(clip.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-2" /> {t("Sil", "Delete")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
      </div>

      {/* Audio Track */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1">
          <Volume2 className="h-3 w-3" /> {t("Ses Kanalı", "Audio Track")}
        </Label>
        {audioClips.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">
            {t("Ses eklemek için yukarıdaki havuzdan tıklayın", "Click audio above to add")}
          </p>
        ) : (
          <div className="space-y-1">
            {audioClips.map((ac, i) => (
              <div key={ac.id}
                className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${selectedAudioId === ac.id ? "ring-2 ring-primary bg-accent/30" : "hover:bg-accent/20"}`}
                onClick={() => { setSelectedAudioId(ac.id); setSelectedClipId(null); }}>
                <div className="flex flex-col gap-0.5">
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={e => { e.stopPropagation(); moveAudio(i, -1); }}><MoveUp className="h-3 w-3" /></Button>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={e => { e.stopPropagation(); moveAudio(i, 1); }}><MoveDown className="h-3 w-3" /></Button>
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); toggleAudioMute(ac.id); }}>
                  {ac.muted ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Volume2 className="h-3.5 w-3.5" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate">{ac.characterName || ac.label || `Audio ${i + 1}`}</p>
                  {ac.text && <p className="text-[9px] text-muted-foreground truncate">{ac.text}</p>}
                </div>
                <Badge variant="secondary" className="text-[8px] shrink-0">{ac.duration.toFixed(1)}s</Badge>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); new Audio(ac.audioUrl).play(); }}>
                  <Play className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={e => { e.stopPropagation(); removeAudioClip(ac.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Music Track */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold flex items-center gap-1">
          <Music className="h-3 w-3" /> {t("Müzik Kanalı", "Music Track")}
        </Label>
        {musicClips.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">
            {t("Müzik eklemek için yukarıdaki havuzdan arayın veya yükleyin", "Search or upload music above")}
          </p>
        ) : (
          <div className="space-y-1">
            {musicClips.map((mc, i) => (
              <div key={mc.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => toggleMusicMute(mc.id)}>
                  {mc.muted ? <VolumeX className="h-3.5 w-3.5 text-muted-foreground" /> : <Music className="h-3.5 w-3.5" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate">{mc.label}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[8px] text-muted-foreground shrink-0">Vol</span>
                    <Slider value={[mc.volume]} min={0} max={1} step={0.05}
                      onValueChange={([v]) => updateMusicVolume(mc.id, v)}
                      className="flex-1 h-3" />
                    <span className="text-[8px] text-muted-foreground w-6">{Math.round(mc.volume * 100)}%</span>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[8px] shrink-0">{mc.duration.toFixed(1)}s</Badge>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => new Audio(mc.audioUrl).play()}>
                  <Play className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => removeMusicClip(mc.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div className="flex gap-3">
        {!videoUrl ? (
          <Button onClick={exportVideo} className="flex-1" size="lg" disabled={isExporting || clips.length === 0}>
            {isExporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Export ediliyor...", "Exporting...")}</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> {t("Video Export", "Export Video")}</>
            )}
          </Button>
        ) : (
          <>
            <Button onClick={handleDownload} className="flex-1" size="lg">
              <Download className="mr-2 h-4 w-4" /> {t("Videoyu İndir", "Download Video")}
            </Button>
            <Button variant="outline" size="lg" onClick={() => setVideoUrl(null)}>
              {t("Tekrar Düzenle", "Edit Again")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
