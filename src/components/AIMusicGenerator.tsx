import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, Loader2, Music, Pencil, Play, Pause, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AIMusicGeneratorProps {
  language: string;
  storyTopic?: string;
  estimatedDuration?: number;
  onMusicGenerated: (audioUrl: string) => void;
  onMusicRemoved: () => void;
  generatedMusicUrl?: string | null;
  onCreditDebit?: (amount: number, description: string) => Promise<void>;
  onMusicEnabledChange?: (enabled: boolean) => void;
  musicEnabled?: boolean;
  onVolumeChange?: (volume: number) => void;
  volume?: number;
}

const MAX_DURATION = 180;

interface MoodOption {
  id: string;
  labelEn: string;
  labelTr: string;
  prompt: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { id: "tense", labelEn: "Tense", labelTr: "Gergin", prompt: "tense and dramatic" },
  { id: "happy", labelEn: "Happy", labelTr: "Mutlu", prompt: "happy and uplifting" },
  { id: "emotional", labelEn: "Emotional", labelTr: "Duygusal", prompt: "emotional and touching" },
  { id: "exciting", labelEn: "Exciting", labelTr: "Heyecanlı", prompt: "exciting and energetic" },
  { id: "calm", labelEn: "Calm", labelTr: "Sakin", prompt: "calm and peaceful" },
  { id: "epic", labelEn: "Epic", labelTr: "Epik", prompt: "epic and cinematic" },
  { id: "dark", labelEn: "Dark", labelTr: "Karanlık", prompt: "dark and mysterious" },
  { id: "romantic", labelEn: "Romantic", labelTr: "Romantik", prompt: "romantic and gentle" },
  { id: "playful", labelEn: "Playful", labelTr: "Eğlenceli", prompt: "playful and cheerful" },
  { id: "suspenseful", labelEn: "Suspenseful", labelTr: "Gerilimli", prompt: "suspenseful and intense" },
];

function detectMoodFromTopic(topic: string): string {
  const lower = topic.toLowerCase();
  if (lower.includes("war") || lower.includes("savaş") || lower.includes("battle")) return "tense";
  if (lower.includes("horror") || lower.includes("korku") || lower.includes("scary")) return "dark";
  if (lower.includes("romance") || lower.includes("love") || lower.includes("aşk")) return "romantic";
  if (lower.includes("comedy") || lower.includes("komedi") || lower.includes("funny")) return "playful";
  if (lower.includes("adventure") || lower.includes("macera")) return "exciting";
  if (lower.includes("sad") || lower.includes("drama") || lower.includes("üzgün")) return "emotional";
  if (lower.includes("action") || lower.includes("aksiyon")) return "exciting";
  if (lower.includes("mystery") || lower.includes("gizem") || lower.includes("thriller")) return "suspenseful";
  if (lower.includes("nature") || lower.includes("doğa") || lower.includes("space") || lower.includes("ocean")) return "calm";
  if (lower.includes("epic") || lower.includes("hero") || lower.includes("kahraman")) return "epic";
  if (lower.includes("happy") || lower.includes("joy") || lower.includes("mutlu")) return "happy";
  return "epic";
}

interface MusicTrack {
  id: string;
  url: string;
  mood: string;
  duration: number;
}

export function AIMusicGenerator({
  language,
  storyTopic,
  estimatedDuration,
  onMusicGenerated,
  onMusicRemoved,
  generatedMusicUrl,
  onCreditDebit,
  onMusicEnabledChange,
  musicEnabled = false,
  onVolumeChange,
  volume = 20,
}: AIMusicGeneratorProps) {
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [customMoodText, setCustomMoodText] = useState("");
  const [withVocal, setWithVocal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localEnabled, setLocalEnabled] = useState(musicEnabled);
  const [musicHistory, setMusicHistory] = useState<MusicTrack[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const enabled = onMusicEnabledChange ? musicEnabled : localEnabled;
  const setEnabled = (v: boolean) => {
    setLocalEnabled(v);
    onMusicEnabledChange?.(v);
  };

  // Auto-select mood based on story topic
  useEffect(() => {
    if (storyTopic && !selectedMood) {
      setSelectedMood(detectMoodFromTopic(storyTopic));
    }
  }, [storyTopic]);

  // Sync initial generatedMusicUrl into history
  useEffect(() => {
    if (generatedMusicUrl && !musicHistory.find(t => t.url === generatedMusicUrl)) {
      setMusicHistory(prev => [...prev, { id: crypto.randomUUID(), url: generatedMusicUrl, mood: selectedMood || "custom", duration: effectiveDuration }]);
    }
  }, []);

  const effectiveDuration = Math.min(estimatedDuration || 30, MAX_DURATION);
  const displayDuration = Number(effectiveDuration.toFixed(2));
  const musicCost = Number((Math.round(effectiveDuration) * 0.002).toFixed(2));

  const generateMusic = async () => {
    if (!selectedMood) {
      toast.error(language === "tr" ? "Lütfen bir mood seçin" : "Please select a mood");
      return;
    }
    if (selectedMood === "custom" && !customMoodText.trim()) {
      toast.error(language === "tr" ? "Lütfen bir mood yazın" : "Please type a mood");
      return;
    }

    setGenerating(true);
    setProgress(5);
    setProgressLabel(language === "tr" ? "Müzik oluşturuluyor..." : "Generating music...");

    try {
      const vocalSuffix = withVocal ? "with vocals" : "without vocals";
      let moodPrompt: string;
      if (selectedMood === "custom") {
        moodPrompt = customMoodText.trim();
      } else {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        moodPrompt = mood?.prompt || selectedMood;
      }
      const finalPrompt = `${moodPrompt} background music ${vocalSuffix}`;

      const roundedDuration = Math.round(effectiveDuration);

      const { data: submitData, error: submitError } = await supabase.functions.invoke("generate-music", {
        body: { action: "submit", prompt: finalPrompt, duration: roundedDuration },
      });

      if (submitError || !submitData?.request_id) {
        throw new Error(submitData?.error || submitError?.message || "Failed to submit music generation");
      }

      const requestId = submitData.request_id;
      setProgress(15);

      let attempts = 0;
      const maxAttempts = 120;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;

        const { data: statusData } = await supabase.functions.invoke("generate-music", {
          body: { action: "status", request_id: requestId },
        });

        const status = statusData?.status?.toUpperCase?.() || statusData?.details?.status?.toUpperCase?.() || "UNKNOWN";

        if (status === "COMPLETED" || status === "OK") break;
        if (status === "FAILED") throw new Error("Music generation failed");

        setProgress(15 + Math.min(70, (attempts / maxAttempts) * 70));
        setProgressLabel(
          language === "tr"
            ? `Müzik oluşturuluyor... (${Math.round(attempts * 2)}s)`
            : `Generating music... (${Math.round(attempts * 2)}s)`
        );
      }

      setProgress(90);
      setProgressLabel(language === "tr" ? "Müzik indiriliyor..." : "Downloading music...");

      const { data: resultData, error: resultError } = await supabase.functions.invoke("generate-music", {
        body: { action: "result", request_id: requestId },
      });

      if (resultError || !resultData?.audio_url) {
        throw new Error("Failed to retrieve generated music");
      }

      setProgress(100);
      
      // Debit credits
      if (onCreditDebit) {
        const cost = Number((roundedDuration * 0.002).toFixed(3));
        await onCreditDebit(cost, `AI Music generation (${roundedDuration}s)`);
      }

      const moodLabel = selectedMood === "custom" ? customMoodText.trim() : (MOOD_OPTIONS.find(m => m.id === selectedMood)?.labelEn || selectedMood);
      const newTrack: MusicTrack = { id: crypto.randomUUID(), url: resultData.audio_url, mood: moodLabel, duration: roundedDuration };
      setMusicHistory(prev => [...prev, newTrack]);
      
      onMusicGenerated(resultData.audio_url);
      setEnabled(true);
      toast.success(language === "tr" ? "Müzik oluşturuldu!" : "Music generated!");
    } catch (err) {
      console.error("Music generation error:", err);
      toast.error((err as Error).message || "Music generation failed");
    } finally {
      setGenerating(false);
      setProgress(0);
      setProgressLabel("");
    }
  };

  const togglePlay = (trackUrl?: string) => {
    const url = trackUrl || generatedMusicUrl;
    if (!url) return;
    if (!audioRef.current || audioRef.current.src !== url) {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(url);
      audioRef.current.volume = volume / 100;
      audioRef.current.onended = () => { setIsPlaying(false); setPlayingTrackId(null); };
    }
    if (isPlaying && (!trackUrl || playingTrackId === trackUrl)) {
      audioRef.current.pause();
      setIsPlaying(false);
      setPlayingTrackId(null);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      setPlayingTrackId(trackUrl || url);
    }
  };

  const selectTrack = (track: MusicTrack) => {
    onMusicGenerated(track.url);
    setEnabled(true);
  };

  const removeTrack = (trackId: string) => {
    const track = musicHistory.find(t => t.id === trackId);
    setMusicHistory(prev => prev.filter(t => t.id !== trackId));
    if (track && track.url === generatedMusicUrl) {
      onMusicRemoved();
    }
  };

  const removeMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setPlayingTrackId(null);
    onMusicRemoved();
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  return (
    <div className="space-y-2.5 rounded-lg border border-border/50 bg-card/30 p-3">
      {/* Header with enable checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="music-enabled"
          checked={enabled}
          onCheckedChange={(checked) => setEnabled(checked === true)}
          className="h-3.5 w-3.5"
        />
        <Label htmlFor="music-enabled" className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
          <Music className="h-3.5 w-3.5 text-primary" />
          {language === "tr" ? "AI Müzik Ekle" : "Add AI Music"}
        </Label>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {language === "tr" ? "Opsiyonel" : "Optional"}
        </span>
      </div>

      {enabled && (
        <>
          {/* Mood selector grid */}
          <div className="flex flex-wrap gap-1.5">
            {MOOD_OPTIONS.map((mood) => (
              <button
                key={mood.id}
                type="button"
                onClick={() => setSelectedMood(mood.id)}
                disabled={generating}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  selectedMood === mood.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
                } disabled:opacity-50`}
              >
                {language === "tr" ? mood.labelTr : mood.labelEn}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedMood("custom")}
              disabled={generating}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                selectedMood === "custom"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
              } disabled:opacity-50`}
            >
              <Pencil className="h-3 w-3" />
              {language === "tr" ? "Özel Yaz" : "Write Own"}
            </button>
          </div>

          {selectedMood === "custom" && (
            <Input
              placeholder={language === "tr" ? "Mood yazın, ör: nostalgic and dreamy" : "Type a mood, e.g. nostalgic and dreamy"}
              value={customMoodText}
              onChange={(e) => setCustomMoodText(e.target.value)}
              disabled={generating}
              className="h-8 text-xs"
            />
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="with-vocal"
                checked={withVocal}
                onCheckedChange={(checked) => setWithVocal(checked === true)}
                disabled={generating}
                className="h-3.5 w-3.5"
              />
              <Label htmlFor="with-vocal" className="text-xs cursor-pointer">
                {language === "tr" ? "Vokalli" : "With Vocal"}
              </Label>
            </div>

            <span className="text-[10px] text-muted-foreground">
              {language === "tr" ? "Süre:" : "Duration:"} {displayDuration}s
              {estimatedDuration && estimatedDuration > MAX_DURATION && (
                <span className="text-amber-500 ml-1">(max {MAX_DURATION}s)</span>
              )}
              {" · "}${musicCost}
            </span>

            <span className="flex items-center gap-1 text-[10px] text-amber-500/80">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              max {MAX_DURATION}s
            </span>
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Slider
              value={[volume]}
              onValueChange={([v]) => onVolumeChange?.(v)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{volume}%</span>
          </div>

          {generating && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground">{progressLabel}</span>
              </div>
              <Progress value={progress} className="h-1" />
            </div>
          )}

          {/* Music history - show all generated tracks */}
          {musicHistory.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                {language === "tr" ? "Oluşturulan Müzikler" : "Generated Tracks"}
              </span>
              {musicHistory.map((track) => {
                const isSelected = track.url === generatedMusicUrl;
                const isThisPlaying = playingTrackId === track.url && isPlaying;
                return (
                  <div key={track.id} className={`flex items-center gap-2 rounded-md border p-1.5 transition-colors cursor-pointer ${
                    isSelected ? "border-primary/40 bg-primary/5" : "border-border/30 hover:border-border/60"
                  }`} onClick={() => selectTrack(track)}>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); togglePlay(track.url); }}>
                      {isThisPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                    <span className="text-[11px] text-foreground flex-1 truncate">
                      {track.mood} ({track.duration}s)
                    </span>
                    {isSelected && (
                      <span className="text-[9px] text-primary font-medium px-1.5 py-0.5 rounded-full bg-primary/10">
                        {language === "tr" ? "Seçili" : "Selected"}
                      </span>
                    )}
                    <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <Button
            onClick={generateMusic}
            disabled={generating || !selectedMood}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
          >
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                {language === "tr" ? "Oluşturuluyor..." : "Generating..."}
              </>
            ) : musicHistory.length > 0 ? (
              <>
                <Music className="mr-1.5 h-3 w-3" />
                {language === "tr" ? "Yeni Müzik Oluştur" : "Generate New"}
              </>
            ) : (
              <>
                <Music className="mr-1.5 h-3 w-3" />
                {language === "tr" ? "Müzik Oluştur" : "Generate Music"}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
