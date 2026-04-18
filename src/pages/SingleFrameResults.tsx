import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, User, ArrowLeft, ArrowRight, ImagePlus, X, Trash2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WandSparkles } from "lucide-react";
import { useRef, useState } from "react";

export default function SingleFrameResults() {
  const {
    language, imageFormat,
    singleFrameImage,
    frameCharacters, setFrameCharacters,
    parsedScript, setParsedScript, updateScriptLine,
    lipSyncFrames, setLipSyncFrames, updateLipSyncFrame,
    isGeneratingLipSync, setIsGeneratingLipSync,
  } = useAppStore();

  const navigate = useNavigate();
  const [referenceImages, setReferenceImages] = useState<Record<number, string>>({});
  const refInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editingCharName, setEditingCharName] = useState("");

  const handleGenerateLipSync = async () => {
    if (!singleFrameImage || frameCharacters.length === 0) {
      toast.error(language === "tr" ? "Veri eksik" : "Missing data");
      return;
    }

    setIsGeneratingLipSync(true);
    try {
      // Generate 2 mouth-open variants per unique character
      const { data, error } = await supabase.functions.invoke("generate-lip-sync-frames", {
        body: {
          image: singleFrameImage,
          characters: frameCharacters,
          script: parsedScript,
          imageFormat,
          perCharacterCount: 2,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.frames) {
        setLipSyncFrames(data.frames.map((f: any) => ({ ...f, approved: false })));
      }

      toast.success(language === "tr" ? "Lip-sync kareleri oluşturuldu!" : "Lip-sync frames generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t(language, "error"));
    } finally {
      setIsGeneratingLipSync(false);
    }
  };

  const handleRegenerateFrame = async (frameIdx: number) => {
    if (!singleFrameImage) return;
    
    const frame = lipSyncFrames.find(f => f.index === frameIdx);
    updateLipSyncFrame(frameIdx, { imageUrl: "", approved: false });

    try {
      const { data, error } = await supabase.functions.invoke("generate-lip-sync-frames", {
        body: {
          image: singleFrameImage,
          characters: frameCharacters,
          script: parsedScript,
          imageFormat,
          frameIndex: frameIdx,
          revisionNote: frame?.revisionNote || null,
          referenceImage: referenceImages[frameIdx] || null,
        },
      });

      if (error) throw error;
      if (data?.frames?.[0]) {
        updateLipSyncFrame(frameIdx, { imageUrl: data.frames[0].imageUrl, approved: false });
        toast.success(language === "tr" ? "Kare yeniden oluşturuldu" : "Frame regenerated");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || t(language, "error"));
    }
  };

  const handleReferenceUpload = (frameIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImages(prev => ({ ...prev, [frameIdx]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Script line management
  const handleAddScriptLine = () => {
    const defaultChar = frameCharacters[0];
    setParsedScript([
      ...parsedScript,
      {
        character_id: defaultChar?.id || "char_1",
        character_name: defaultChar?.name || "",
        text: "",
      },
    ]);
  };

  const handleDeleteScriptLine = (idx: number) => {
    setParsedScript(parsedScript.filter((_, i) => i !== idx));
  };

  // Character rename
  const handleStartRename = (charId: string, currentName: string) => {
    setEditingCharId(charId);
    setEditingCharName(currentName);
  };

  const handleFinishRename = () => {
    if (!editingCharId || !editingCharName.trim()) {
      setEditingCharId(null);
      return;
    }
    const oldChar = frameCharacters.find(c => c.id === editingCharId);
    if (!oldChar) { setEditingCharId(null); return; }

    const oldName = oldChar.name;
    const newName = editingCharName.trim();

    // Update character name
    setFrameCharacters(
      frameCharacters.map(c => c.id === editingCharId ? { ...c, name: newName } : c)
    );

    // Auto-update script lines
    setParsedScript(
      parsedScript.map(line =>
        line.character_id === editingCharId || line.character_name === oldName
          ? { ...line, character_name: newName }
          : line
      )
    );

    setEditingCharId(null);
    setEditingCharName("");
  };

  const lipSyncProgress = lipSyncFrames.length > 0
    ? Math.round((lipSyncFrames.filter(f => f.imageUrl).length / lipSyncFrames.length) * 100)
    : 0;

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
                  {language === "tr" ? "Tekli Kare Sonuçları" : "Single Frame Results"}
                </h1>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-xs">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                {t(language, "backToForm")}
              </Button>
            </div>
          </header>

          <main className="relative z-0 mx-auto w-full max-w-5xl px-4 pb-12 pt-4">
            <div className="space-y-6">
              {/* Original frame */}
              {singleFrameImage && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {language === "tr" ? "Orijinal Kare" : "Original Frame"}
                    </Badge>
                  </div>
                  <img src={singleFrameImage} alt="Original" className="w-full object-contain max-h-80" />
                </div>
              )}

              {/* Detected Characters (editable names) */}
              {frameCharacters.length > 0 && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                  <Label className="text-xs font-semibold">{t(language, "detectedCharacters")}</Label>
                  <div className="flex flex-wrap gap-2">
                    {frameCharacters.map((c) => (
                      <div key={c.id} className="flex items-center gap-1">
                        {editingCharId === c.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingCharName}
                              onChange={(e) => setEditingCharName(e.target.value)}
                              onBlur={handleFinishRename}
                              onKeyDown={(e) => { if (e.key === "Enter") handleFinishRename(); }}
                              className="h-7 w-28 text-xs"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <Badge variant="secondary" className="gap-1.5 text-xs cursor-pointer" onClick={() => handleStartRename(c.id, c.name)}>
                            <User className="h-3 w-3" />
                            {c.name}
                            <span className="text-muted-foreground">({c.position})</span>
                            <Pencil className="h-2.5 w-2.5 ml-0.5 text-muted-foreground" />
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parsed Script (editable with add/delete) */}
              {parsedScript.length > 0 && (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{t(language, "generatedScript")}</Label>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddScriptLine}>
                      <Plus className="h-3 w-3 mr-1" />
                      {t(language, "addScriptLine")}
                    </Button>
                  </div>
                  {parsedScript.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-1 shrink-0 text-[10px]">
                        {line.character_name}
                      </Badge>
                      <Textarea
                        value={line.text}
                        onChange={(e) => updateScriptLine(idx, { text: e.target.value })}
                        rows={2}
                        className="resize-none text-sm flex-1"
                      />
                      {parsedScript.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteScriptLine(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Generate Lip-Sync */}
              {frameCharacters.length > 0 && lipSyncFrames.length === 0 && (
                <Button
                  onClick={handleGenerateLipSync}
                  disabled={isGeneratingLipSync}
                  className="w-full"
                  size="lg"
                >
                  {isGeneratingLipSync ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t(language, "generatingLipSync")}
                    </>
                  ) : (
                    <>
                      <WandSparkles className="mr-2 h-4 w-4" />
                      {t(language, "generateLipSync")}
                    </>
                  )}
                </Button>
              )}

              {/* Next: Voice Selection */}
              {lipSyncFrames.length > 0 && !isGeneratingLipSync && (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate("/voice-selection")}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {language === "tr" ? "Ses Seçimine Geç" : "Go to Voice Selection"}
                </Button>
              )}

              {/* Progress */}
              {isGeneratingLipSync && (
                <div className="space-y-1">
                  <Progress value={lipSyncProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {lipSyncFrames.filter(f => f.imageUrl).length}/{lipSyncFrames.length}
                  </p>
                </div>
              )}

              {/* Generated Lip-Sync Frames (grouped by character) */}
              {lipSyncFrames.length > 0 && !isGeneratingLipSync && (
                <div className="space-y-4">
                  <Label className="text-xs font-semibold">{t(language, "lipSyncFrames")}</Label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {lipSyncFrames.map((frame) => (
                      <div key={frame.index} className="rounded-lg border overflow-hidden">
                        <div className="bg-muted/50 px-3 py-1.5 flex items-center justify-between">
                          <Badge variant="default" className="text-[10px]">
                            {frame.speakingCharacter} #{(frame.index % 2) + 1}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]"
                              onClick={() => handleRegenerateFrame(frame.index)}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-destructive hover:text-destructive"
                              onClick={() => {
                                const updated = lipSyncFrames.filter(f => f.index !== frame.index);
                                setLipSyncFrames(updated);
                              }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {frame.imageUrl ? (
                          <img src={frame.imageUrl} alt={`Frame ${frame.index}`} className="w-full object-contain max-h-48" />
                        ) : (
                          <div className="flex items-center justify-center h-32 bg-muted">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        )}

                        {/* Revision section */}
                        <div className="px-3 py-2 space-y-2 border-t">
                            <Textarea
                              value={frame.revisionNote || ""}
                              onChange={(e) => updateLipSyncFrame(frame.index, { revisionNote: e.target.value })}
                              placeholder={t(language, "revisionNote")}
                              rows={2}
                              className="resize-none text-xs"
                            />
                            
                            {/* Reference image */}
                            <div className="flex items-center gap-2">
                              {referenceImages[frame.index] ? (
                                <div className="relative group">
                                  <img src={referenceImages[frame.index]} alt="Ref" className="h-10 w-10 rounded object-cover border" />
                                  <button
                                    onClick={() => setReferenceImages(prev => {
                                      const n = { ...prev };
                                      delete n[frame.index];
                                      return n;
                                    })}
                                    className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  onClick={() => refInputRefs.current[frame.index]?.click()}
                                >
                                  <ImagePlus className="h-3 w-3 mr-1" />
                                  {language === "tr" ? "Referans Ekle" : "Add Reference"}
                                </Button>
                              )}
                              <input
                                ref={(el) => { refInputRefs.current[frame.index] = el; }}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleReferenceUpload(frame.index, e)}
                              />
                              
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-[10px] ml-auto"
                                onClick={() => handleRegenerateFrame(frame.index)}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                {t(language, "sendRevision")}
                              </Button>
                            </div>
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
