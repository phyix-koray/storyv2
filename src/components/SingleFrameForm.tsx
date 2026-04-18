import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { uploadStoryImage } from "@/lib/projectStorage";

export function SingleFrameForm() {
  const { user } = useAuth();
  const {
    language, storyLanguage, setStoryLanguage, imageFormat, setImageFormat,
    storyTopic, setStoryTopic,
    singleFrameImage, setSingleFrameImage, singleFrameScript, setSingleFrameScript,
    setFrameCharacters, setParsedScript, setLipSyncFrames,
    isAnalyzingFrame, setIsAnalyzingFrame,
    sentenceCount, setSentenceCount,
    currentProjectId,
  } = useAppStore();
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(language === "tr" ? "Lütfen bir görsel dosyası seçin" : "Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSingleFrameImage(reader.result as string);
      setFrameCharacters([]);
      setParsedScript([]);
      setLipSyncFrames([]);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!singleFrameImage) {
      toast.error(language === "tr" ? "Lütfen bir kare yükleyin" : "Please upload a frame");
      return;
    }

    setIsAnalyzingFrame(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-single-frame", {
        body: {
          image: singleFrameImage,
          script: singleFrameScript || null,
          storyTopic: storyTopic || null,
          language: storyLanguage,
          sentenceCount,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.characters) setFrameCharacters(data.characters);
      if (data.script) {
        setParsedScript(data.script);
        const scriptText = data.script.map((s: any) => `${s.character_name}: ${s.text}`).join("\n");
        setSingleFrameScript(scriptText);
      }

      // Save project to DB
      if (user && singleFrameImage) {
        try {
          let projectId = currentProjectId;
          if (projectId) {
            await supabase.from("story_projects").update({
              story_topic: storyTopic || (language === "tr" ? "Tek Kare" : "Single Frame"),
              story_language: storyLanguage, image_format: imageFormat, story_mode: "single",
            } as any).eq("id", projectId);
          } else {
            const { data: project, error: projErr } = await supabase.from("story_projects").insert({
              user_id: user.id, story_topic: storyTopic || (language === "tr" ? "Tek Kare" : "Single Frame"),
              story_language: storyLanguage, image_format: imageFormat, story_mode: "single", frame_count: 1,
            } as any).select("id").single();
            if (!projErr && project) {
              projectId = project.id;
              setCurrentProjectId(projectId);
            }
          }
          if (projectId) {
            const path = await uploadStoryImage({ dataUrl: singleFrameImage, userId: user.id, projectId, frameNumber: 1 });
            if (path) {
              await (supabase.from("project_frames") as any).upsert({
                project_id: projectId, frame_number: 1,
                scene_description: storyTopic || "Single frame",
                image_path: path,
                dialogues: data.script || [],
              }, { onConflict: "project_id,frame_number" });
            }
          }
        } catch (e) { console.error("Failed to save single frame project:", e); }
      }

      toast.success(language === "tr" ? "Görsel analiz edildi!" : "Frame analyzed!");
      navigate("/single-frame-results");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t(language, "error"));
    } finally {
      setIsAnalyzingFrame(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[672px] space-y-5 py-4">
      {/* Image upload area */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">{t(language, "uploadFrame")} <span className="text-destructive">*</span></Label>
        {singleFrameImage ? (
          <div className="relative group rounded-lg border overflow-hidden bg-muted">
            <img src={singleFrameImage} alt="Uploaded frame" className="w-full max-h-80 object-contain" />
            <button
              onClick={() => {
                setSingleFrameImage(null);
                setFrameCharacters([]);
                setParsedScript([]);
                setLipSyncFrames([]);
              }}
              className="absolute top-2 right-2 rounded-full bg-background/80 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-muted-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <ImagePlus className="h-10 w-10" />
            <span className="text-sm font-medium">{t(language, "dragDrop")}</span>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>

      {/* Language & Format */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <Label className="text-xs font-semibold">{t(language, "storyLanguage")}</Label>
          <Select value={storyLanguage} onValueChange={setStoryLanguage}>
            <SelectTrigger className="h-9 w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
              <SelectItem value="en">🇬🇧 English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-1">
          <Label className="text-xs font-semibold">{t(language, "imageFormat")}</Label>
          <Select value={imageFormat} onValueChange={(v) => setImageFormat(v as any)}>
            <SelectTrigger className="h-9 w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="square">{t(language, "formatSquare")}</SelectItem>
              <SelectItem value="mobile">{t(language, "formatMobile")}</SelectItem>
              <SelectItem value="desktop">{t(language, "formatDesktop")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sentence count slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">{t(language, "sentenceCount")}</Label>
          <span className="text-sm font-bold text-primary">{sentenceCount}</span>
        </div>
        <Slider
          value={[sentenceCount]}
          onValueChange={([v]) => setSentenceCount(v)}
          min={1}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>

      {/* Script */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold">{t(language, "scriptLabel")}</Label>
        <Textarea
          value={singleFrameScript}
          onChange={(e) => setSingleFrameScript(e.target.value)}
          placeholder={t(language, "scriptPlaceholder")}
          rows={5}
          className="resize-none text-sm"
        />
      </div>

      {/* Story topic */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold">{t(language, "storyTopic")}</Label>
        <Textarea
          value={storyTopic}
          onChange={(e) => setStoryTopic(e.target.value)}
          placeholder={t(language, "storyTopicPlaceholder")}
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Analyze */}
      <Button onClick={handleAnalyze} disabled={isAnalyzingFrame || !singleFrameImage} className="w-full" size="lg">
        {isAnalyzingFrame ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t(language, "analyzingFrame")}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {t(language, "analyzeFrame")}
          </>
        )}
      </Button>
    </div>
  );
}
