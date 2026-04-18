import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/lib/i18n";
import { StepIndicator } from "@/components/StepIndicator";
import { StoryForm } from "@/components/StoryForm";
import { SingleFrameForm } from "@/components/SingleFrameForm";
import { DraftEditor } from "@/components/DraftEditor";
import { ImagePreview } from "@/components/ImagePreview";
import { VideoCreator } from "@/components/VideoCreator";
import { VoiceAnimationEditor } from "@/components/VoiceAnimationEditor";
import { BgVocalEditor } from "@/components/BgVocalEditor";
import { AnimationVideoPreview } from "@/components/AnimationVideoPreview";
import { AppSidebar } from "@/components/AppSidebar";
import { LandingPage } from "@/components/LandingPage";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Film, Mic, Loader2, AudioLines, Info, Play } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { StoryMode } from "@/lib/types";

const modeInfo = {
  en: {
    multi: { name: "Storyboard", desc: "Create multi-frame visual stories with speech bubbles and character dialogues compiled into a video." },
    voiceAnimation: { name: "Animation", desc: "Transform images into animated videos using AI models with subtitle support." },
    bgVocal: { name: "Voice Over", desc: "Add AI voiceover narration with word-by-word synced subtitles to your stories." },
  },
  tr: {
    multi: { name: "Storyboard", desc: "Konuşma balonlu çok kareli görsel hikayeler oluşturun ve videoya derleyin." },
    voiceAnimation: { name: "Animation", desc: "AI modelleriyle görselleri animasyonlu videolara dönüştürün, alt yazı desteğiyle." },
    bgVocal: { name: "Voice Over", desc: "Hikayelerinize kelime kelime senkron alt yazılı AI seslendirme ekleyin." },
  },
};

const Index = () => {
  const { step, language, storyMode, setStoryMode } = useAppStore();
  const { user, loading } = useAuth();
  const [infoModal, setInfoModal] = useState<StoryMode | null>(null);

  if (!loading && !user) {
    return <LandingPage />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const modes = [
    { mode: "multi" as StoryMode, icon: Film },
    { mode: "voiceAnimation" as StoryMode, icon: Mic },
    { mode: "bgVocal" as StoryMode, icon: AudioLines },
  ];

  const infoData = infoModal ? modeInfo[language][infoModal] : null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-transparent">
        <AppSidebar />

        <SidebarInset>
          <header className="sticky top-0 z-30 border-b border-border/50 bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <h1 className="text-lg font-bold tracking-tight text-foreground">
                  {t(language, "appTitle")}
                </h1>
              </div>
            </div>
          </header>

          {/* Mode tabs - always visible, sticky */}
          {step === 1 && (
            <div className="sticky top-[49px] z-20 bg-background/90 backdrop-blur-md mx-auto flex max-w-5xl items-center gap-2 px-4 pt-3 pb-2">
              {modes.map(({ mode, icon: Icon }) => {
                const info = modeInfo[language][mode];
                return (
                  <div key={mode} className="flex items-center gap-0">
                    <button
                      onClick={() => setStoryMode(mode)}
                      className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                        storyMode === mode
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "bg-muted text-muted-foreground hover:bg-accent/10 hover:text-accent"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {info.name}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setInfoModal(mode); }}
                            className="ml-0.5 inline-flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                          {info.desc}
                        </TooltipContent>
                      </Tooltip>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mx-auto max-w-5xl px-4">
            <StepIndicator />
          </div>
          <main className="relative z-0 mx-auto w-full max-w-5xl px-4 pb-12 pt-2">
            {step === 1 && (storyMode === "single" ? <SingleFrameForm /> : <StoryForm />)}
            {step === 2 && <DraftEditor />}
            {step === 3 && (
              storyMode === "voiceAnimation" ? <VoiceAnimationEditor /> :
              <ImagePreview />
            )}
            {step === 4 && (
              storyMode === "voiceAnimation" ? <AnimationVideoPreview /> :
              storyMode === "bgVocal" ? <BgVocalEditor /> :
              <VideoCreator />
            )}
          </main>
        </SidebarInset>
      </div>

      {/* Info modal */}
      <Dialog open={!!infoModal} onOpenChange={() => setInfoModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{infoData?.name}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Play className="h-10 w-10" />
              <span className="text-xs">{language === "tr" ? "Örnek video yakında" : "Example video coming soon"}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">{infoData?.desc}</p>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Index;
