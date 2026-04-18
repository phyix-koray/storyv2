import { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { VideoMergePreview } from "@/components/VideoMergePreview";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function AnimationVideoPreview() {
  const { language, storyTopic, storyLanguage, setStep } = useAppStore();
  const animMergeData = useAppStore((s) => s.animMergeData);
  const setAnimMergeData = useAppStore((s) => s.setAnimMergeData);
  const { user } = useAuth();
  const { refetch: refetchCredits } = useCredits();

  const [musicUrl, setMusicUrl] = useState<string | null>(animMergeData?.musicUrl ?? null);

  if (!animMergeData) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center py-12">
        <p className="text-muted-foreground">{language === "tr" ? "Önce görselleri ve videoları oluşturun." : "Please generate images and videos first."}</p>
        <Button variant="ghost" onClick={() => setStep(3)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {language === "tr" ? "Geri Dön" : "Go Back"}
        </Button>
      </div>
    );
  }

  return (
    <VideoMergePreview
      videoUrls={animMergeData.videoUrls}
      language={language}
      onBack={() => setStep(3)}
      storyTopic={storyTopic}
      scenes={animMergeData.editedScenes}
      storyLanguage={storyLanguage}
      subtitlesEnabled={animMergeData.subtitlesEnabled}
      subtitleOptions={animMergeData.subtitleOptions}
      musicUrl={musicUrl}
      onMusicGenerated={(url) => {
        setMusicUrl(url);
        setAnimMergeData({ ...animMergeData, musicUrl: url });
      }}
      onMusicRemoved={() => {
        setMusicUrl(null);
        setAnimMergeData({ ...animMergeData, musicUrl: null });
      }}
      initialMergedUrl={animMergeData.mergedVideoUrl}
      onMergedUrlChange={(url) => {
        setAnimMergeData({ ...animMergeData, mergedVideoUrl: url });
      }}
    />
  );
}
