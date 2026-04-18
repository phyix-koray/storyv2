import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, ArrowLeft, ArrowRight, User, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  labels: Record<string, string>;
  preview_url: string;
}

type AgeFilter = "all" | "young" | "middle_aged" | "old";
type GenderFilter = "all" | "male" | "female";

export default function VoiceSelection() {
  const { language, storyLanguage, frameCharacters, parsedScript, characterVoices, setCharacterVoices, lipSyncFrames, singleFrameImage } = useAppStore();
  const navigate = useNavigate();

  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  useEffect(() => {
    fetchVoices();
  }, [storyLanguage]);

  const fetchVoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-voices", {
        body: { storyLanguage },
      });
      if (error) throw error;
      if (data?.voices) {
        setVoices(data.voices);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(language === "tr" ? "Sesler yüklenemedi" : "Failed to load voices");
    } finally {
      setLoading(false);
    }
  };

  const languageTokens: Record<string, string[]> = {
    tr: ["tr", "turkish", "türkçe"],
    en: ["en", "english", "american", "british"],
  };

  const filteredVoices = voices.filter((v) => {
    const labels = v.labels || {};
    const langTargets = languageTokens[storyLanguage] || [storyLanguage];
    const languageFields = [
      String(labels.language || "").toLowerCase(),
      String(labels.accent || "").toLowerCase(),
      String(v.name || "").toLowerCase(),
    ];

    if (storyLanguage && !langTargets.some((target) => languageFields.some((field) => field.includes(target)))) {
      return false;
    }

    if (genderFilter !== "all" && labels.gender !== genderFilter) return false;
    if (ageFilter !== "all" && labels.age !== ageFilter) return false;
    return true;
  });

  const playPreview = (voice: ElevenLabsVoice) => {
    if (!voice.preview_url) return;
    setPlayingVoice(voice.voice_id);
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPlayingVoice(null);
    audio.onerror = () => setPlayingVoice(null);
    audio.play();
  };

  const assignVoice = (characterId: string, voiceId: string) => {
    setCharacterVoices({ ...characterVoices, [characterId]: voiceId });
  };

  const allAssigned = frameCharacters.length > 0 && frameCharacters.every((c) => characterVoices[c.id]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-transparent">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <WandSparkles className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                  {language === "tr" ? "Ses Seçimi" : "Voice Selection"}
                </h1>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/single-frame-results")} className="text-xs">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                {language === "tr" ? "Karelere Dön" : "Back to Frames"}
              </Button>
            </div>
          </header>

          <main className="relative z-0 mx-auto w-full max-w-5xl px-4 pb-12 pt-4">
            <div className="space-y-6">

              {/* Original + Lip-Sync Images */}
              {(singleFrameImage || lipSyncFrames.length > 0) && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold">
                    {language === "tr" ? "Görseller" : "Images"}
                  </Label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {singleFrameImage && (
                      <div className="rounded-lg border overflow-hidden">
                        <div className="bg-muted/50 px-2 py-1">
                          <Badge variant="outline" className="text-[9px]">
                            {language === "tr" ? "Orijinal (Ağız Kapalı)" : "Original (Mouth Closed)"}
                          </Badge>
                        </div>
                        <img src={singleFrameImage} alt="Original" className="w-full object-contain max-h-40" />
                      </div>
                    )}
                    {lipSyncFrames.map((frame) => (
                      <div key={frame.index} className="rounded-lg border overflow-hidden">
                        <div className="bg-muted/50 px-2 py-1">
                          <Badge variant="default" className="text-[9px]">
                            {frame.speakingCharacter} - {language === "tr" ? "Ağız Açık" : "Mouth Open"}
                          </Badge>
                        </div>
                        {frame.imageUrl && (
                          <img src={frame.imageUrl} alt={`Lip-sync ${frame.index}`} className="w-full object-contain max-h-40" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Script / Transcript */}
              {parsedScript.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <Label className="text-xs font-semibold">
                    {language === "tr" ? "Senaryo" : "Script"}
                  </Label>
                  {parsedScript.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-1 shrink-0 text-[10px]">
                        {line.character_name}
                      </Badge>
                      <p className="text-sm text-muted-foreground">{line.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Character Voice Assignment - below images */}
              {frameCharacters.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <Label className="text-xs font-semibold">
                    {language === "tr" ? "Karakter Ses Ataması" : "Character Voice Assignment"}
                  </Label>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">{language === "tr" ? "Cinsiyet" : "Gender"}</Label>
                      <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v as GenderFilter)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === "tr" ? "Tümü" : "All"}</SelectItem>
                          <SelectItem value="male">{language === "tr" ? "Erkek" : "Male"}</SelectItem>
                          <SelectItem value="female">{language === "tr" ? "Kadın" : "Female"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{language === "tr" ? "Yaş" : "Age"}</Label>
                      <Select value={ageFilter} onValueChange={(v) => setAgeFilter(v as AgeFilter)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === "tr" ? "Tümü" : "All"}</SelectItem>
                          <SelectItem value="young">{language === "tr" ? "Genç" : "Young"}</SelectItem>
                          <SelectItem value="middle_aged">{language === "tr" ? "Orta Yaşlı" : "Middle Aged"}</SelectItem>
                          <SelectItem value="old">{language === "tr" ? "Yaşlı" : "Old"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant="secondary" className="h-8 text-xs">
                      {filteredVoices.length} {language === "tr" ? "ses" : "voices"}
                    </Badge>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {frameCharacters.map((char) => (
                        <div key={char.id} className="flex items-center gap-3">
                          <Badge variant="outline" className="shrink-0 gap-1 text-xs">
                            <User className="h-3 w-3" />
                            {char.name}
                          </Badge>
                          <Select
                            value={characterVoices[char.id] || ""}
                            onValueChange={(v) => assignVoice(char.id, v)}
                          >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                              <SelectValue placeholder={language === "tr" ? "Ses seçin..." : "Select voice..."} />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {filteredVoices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id} className="text-xs">
                                  {voice.name}
                                  {voice.labels?.gender && (
                                    <span className="text-muted-foreground ml-1">
                                      ({voice.labels.gender}{voice.labels.age ? `, ${voice.labels.age}` : ""})
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {characterVoices[char.id] && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                const voice = voices.find((v) => v.voice_id === characterVoices[char.id]);
                                if (voice) playPreview(voice);
                              }}
                              disabled={playingVoice === characterVoices[char.id]}
                            >
                              {playingVoice === characterVoices[char.id] ? (
                                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Voice List */}
              {!loading && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    {language === "tr" ? "Mevcut Sesler" : "Available Voices"}
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredVoices.map((voice) => (
                      <div
                        key={voice.voice_id}
                        className="flex items-center gap-2 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{voice.name}</p>
                          <div className="flex gap-1 mt-0.5">
                            {voice.labels?.gender && (
                              <Badge variant="secondary" className="text-[9px] h-4">
                                {voice.labels.gender}
                              </Badge>
                            )}
                            {voice.labels?.age && (
                              <Badge variant="secondary" className="text-[9px] h-4">
                                {voice.labels.age}
                              </Badge>
                            )}
                            {voice.labels?.accent && (
                              <Badge variant="secondary" className="text-[9px] h-4">
                                {voice.labels.accent}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 shrink-0"
                          onClick={() => playPreview(voice)}
                          disabled={playingVoice === voice.voice_id}
                        >
                          {playingVoice === voice.voice_id ? (
                            <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Step */}
              {allAssigned && (
                <Button className="w-full" size="lg" onClick={() => navigate("/lip-sync-video-editor")}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {language === "tr" ? "Video Editörüne Geç" : "Go to Video Editor"}
                </Button>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
