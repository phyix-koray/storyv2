import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, Download, Play, Film } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WandSparkles } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { TimelineVideoEditor } from "@/components/TimelineVideoEditor";

interface AudioSegment {
  characterId: string;
  characterName: string;
  text: string;
  audioUrl: string;
  duration: number;
}

export default function LipSyncVideoEditor() {
  const {
    language, singleFrameImage, lipSyncFrames, parsedScript,
    frameCharacters, characterVoices,
  } = useAppStore();
  const navigate = useNavigate();

  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [audioProgress, setAudioProgress] = useState(0);
  const [ttsBlockedMessage, setTtsBlockedMessage] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const parseTtsInvokeError = async (err: any): Promise<{ status?: string; code?: string; keyHint?: string; message: string }> => {
    try {
      const response = err?.context;
      if (response && typeof response.json === "function") {
        const payload = await response.clone().json();
        return {
          status: payload?.provider_status,
          code: payload?.provider_code,
          keyHint: payload?.key_hint,
          message: payload?.provider_message || payload?.error || err?.message || "TTS error",
        };
      }
    } catch { /* ignore */ }
    return { message: err?.message || "TTS error" };
  };

  const getTtsBlockedMessage = (status?: string, code?: string, keyHint?: string) => {
    if (keyHint === "shared_or_default") {
      return language === "tr"
        ? "Sistem paylaşılan API anahtarıyla çağrı yapıyor; Settings > Connectors > ElevenLabs API bağlantınızı kontrol edin."
        : "Using shared API key; check Settings > Connectors > ElevenLabs API.";
    }
    if (status === "quota_exceeded" || code === "quota_exceeded") {
      return language === "tr"
        ? "ElevenLabs krediniz yetersiz."
        : "ElevenLabs credits insufficient.";
    }
    return null;
  };

  const generateAllAudio = useCallback(async () => {
    if (parsedScript.length === 0) return;
    setIsGeneratingAudio(true);
    setAudioSegments([]);
    setAudioProgress(0);
    setTtsBlockedMessage(null);

    const segments: AudioSegment[] = [];
    for (let i = 0; i < parsedScript.length; i++) {
      const line = parsedScript[i];
      const voiceId = characterVoices[line.character_id];
      if (!voiceId || !line.text.trim()) continue;

      try {
        const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
          body: { text: line.text, voiceId },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        const duration = await getAudioDuration(audioUrl);
        segments.push({ characterId: line.character_id, characterName: line.character_name, text: line.text, audioUrl, duration });
      } catch (err: any) {
        console.error(`TTS error for line ${i}:`, err);
        const parsed = await parseTtsInvokeError(err);
        const blocked = getTtsBlockedMessage(parsed.status, parsed.code, parsed.keyHint);
        if (blocked) { setTtsBlockedMessage(blocked); toast.error(blocked); break; }
        toast.error(`${line.character_name}: ${parsed.message}`);
      }
      setAudioProgress(Math.round(((i + 1) / parsedScript.length) * 100));
    }

    setAudioSegments(segments);
    setIsGeneratingAudio(false);
    if (segments.length > 0) toast.success(language === "tr" ? "Sesler oluşturuldu!" : "Audio generated!");
  }, [parsedScript, characterVoices, language]);

  useEffect(() => {
    if (parsedScript.length > 0 && Object.keys(characterVoices).length > 0 && audioSegments.length === 0) {
      generateAllAudio();
    }
  }, []);

  const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
      audio.addEventListener("error", () => resolve(2));
      setTimeout(() => resolve(2), 5000);
    });
  };

  // Build available media for timeline editor
  const availableImages = [
    ...(singleFrameImage ? [{ url: singleFrameImage, label: language === "tr" ? "Orijinal Kare" : "Original Frame" }] : []),
    ...lipSyncFrames.filter(f => f.imageUrl).map((f, i) => ({
      url: f.imageUrl,
      label: `${f.speakingCharacter} - ${f.text.slice(0, 20)}...`,
    })),
  ];

  const availableAudio = audioSegments.map((seg, i) => ({
    url: seg.audioUrl,
    label: `${seg.characterName}: ${seg.text.slice(0, 30)}`,
    characterName: seg.characterName,
    text: seg.text,
    duration: seg.duration,
  }));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-transparent">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <Film className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  {language === "tr" ? "Video Editörü" : "Video Editor"}
                </h1>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/voice-selection")} className="text-xs">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                {language === "tr" ? "Ses Seçimine Dön" : "Back to Voice Selection"}
              </Button>
            </div>
          </header>

          <main className="relative z-0 mx-auto w-full max-w-5xl px-4 pb-12 pt-4">
            <div className="space-y-6">

              {/* Audio Generation Progress */}
              {isGeneratingAudio && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <Label className="text-xs">{language === "tr" ? "Sesler oluşturuluyor..." : "Generating audio..."}</Label>
                  </div>
                  <Progress value={audioProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">{audioProgress}%</p>
                </div>
              )}

              {/* Audio ready - show timeline toggle */}
              {audioSegments.length > 0 && !isGeneratingAudio && !showTimeline && (
                <div className="space-y-3">
                  {/* Audio Segments Preview */}
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <Label className="text-xs font-semibold">
                      {language === "tr" ? "Oluşturulan Sesler" : "Generated Audio"}
                    </Label>
                    {audioSegments.map((seg, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-[10px]">{seg.characterName}</Badge>
                        <p className="text-xs text-muted-foreground flex-1 truncate">{seg.text}</p>
                        <Badge variant="secondary" className="text-[9px] shrink-0">{seg.duration.toFixed(1)}s</Badge>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => new Audio(seg.audioUrl).play()}>
                          <Play className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button onClick={() => setShowTimeline(true)} className="w-full" size="lg">
                    <WandSparkles className="mr-2 h-4 w-4" />
                    {language === "tr" ? "Video Editörünü Aç" : "Open Video Editor"}
                  </Button>
                </div>
              )}

              {/* Timeline Video Editor */}
              {showTimeline && (
                <TimelineVideoEditor
                  availableImages={availableImages}
                  availableAudio={availableAudio}
                />
              )}

              {/* TTS Blocked */}
              {ttsBlockedMessage && (
                <div className="rounded-lg border bg-muted/30 p-6 text-center space-y-3">
                  <Film className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{ttsBlockedMessage}</p>
                </div>
              )}

              {/* Loading state */}
              {!isGeneratingAudio && audioSegments.length === 0 && !ttsBlockedMessage && !showTimeline && (
                <div className="rounded-lg border bg-muted/30 p-6 text-center">
                  <Film className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {language === "tr" ? "Ses verileri yükleniyor..." : "Loading audio data..."}
                  </p>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
