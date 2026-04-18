import { useState, useRef, useEffect } from "react";
import { ART_STYLES } from "@/lib/styles";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { extractStoryImagePath, uploadStoryImage } from "@/lib/projectStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ArrowLeft, ArrowUp, ArrowDown, Loader2, MessageSquare, RefreshCw, Edit3, Send, Image as ImageIcon, Camera, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { GeneratedImage } from "@/lib/types";
import { useCredits } from "@/hooks/useCredits";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function DraftEditor() {
  const {
    language, scenes, updateScene, addScene, removeScene, swapScenes, setStep,
    characters, storyTopic, storyLanguage, imageFormat, setImages,
    isGeneratingImages, setIsGeneratingImages, setCharacterAvatars,
    setIsGeneratingAvatars, characterAvatars, currentProjectId, setCurrentProjectId,
    useCharacterAvatars, storyMode, artStyle,
  } = useAppStore();
  const { credits, isUnlimited, refetch } = useCredits();
  const { user } = useAuth();
  const navigate = useNavigate();

  const getArtStyleLabel = () => {
    const style = ART_STYLES.find((s) => s.id === artStyle);
    return style && style.id !== "default" ? style.prompt || style.label : "";
  };

  const buildCharacterProfiles = (): Array<{ name: string; features: string }> => {
    const styleLabel = getArtStyleLabel();

    // Collect uploaded characters (have imageUrl via store)
    const uploadedCharNames = new Set<string>();
    for (const ch of characters) {
      const name = (ch.role || "").trim();
      if (name && (ch.imageUrl || ch.previewUrl)) {
        uploadedCharNames.add(name);
      }
    }

    // Collect character context from scene dialogues/descriptions
    const charScenes: Record<string, string[]> = {};
    for (const scene of scenes) {
      for (const dialogue of scene.dialogues) {
        const raw = (dialogue.character || "").trim();
        if (!raw) continue;
        const cleaned = raw.replace(/^[-•\s]+/, "").replace(/[.,!?;:]+$/, "");
        if (cleaned && cleaned.length <= 60) {
          if (!charScenes[cleaned]) charScenes[cleaned] = [];
          if (scene.description && !charScenes[cleaned].includes(scene.description)) {
            charScenes[cleaned].push(scene.description);
          }
        }
      }
    }

    // Always include uploaded/form characters in avatar profile list
    for (const ch of characters) {
      const name = (ch.role || "").trim();
      if (!name) continue;
      if (!charScenes[name]) charScenes[name] = [];
    }

    // Keep manually added avatar names represented in profile list
    for (const avatar of characterAvatars) {
      const name = (avatar.name || "").trim();
      if (!name) continue;
      if (!charScenes[name]) charScenes[name] = [];
    }

    return Object.entries(charScenes).map(([name, descs]) => {
      let features = "";
      if (uploadedCharNames.has(name)) {
        // Uploaded character: instruct to convert to selected style
        features = styleLabel
          ? `Convert this character to ${styleLabel} style`
          : "";
      } else {
        // AI-generated character: use features from characterAvatars if available
        const avatar = characterAvatars.find((a) => a.name === name);
        const physicalFeatures = avatar?.features?.trim();
        const styleSuffix = styleLabel ? `. ${styleLabel} style` : "";
        if (physicalFeatures) {
          features = `${physicalFeatures}${styleSuffix}`;
        } else {
          features = `${name}${styleSuffix}`;
        }
      }
      return { name, features };
    });
  };

  const goToVoiceAnimationEditor = async () => {
    const emptyImages: GeneratedImage[] = scenes.map((scene) => ({
      sceneId: scene.id,
      imageUrl: "",
      approved: false,
      generating: false,
      textOverlays: [],
      duration: 3,
    }));
    setImages(emptyImages);
    setStep(3);

    // Save project + frames for voiceAnimation mode
    if (!user) return;
    let projectId = currentProjectId;
    try {
      if (projectId) {
        await supabase.from("story_projects").update({
          story_topic: storyTopic, style: useAppStore.getState().artStyle || "default",
          story_language: storyLanguage, frame_count: scenes.length, image_format: imageFormat,
          story_mode: storyMode,
        } as any).eq("id", projectId);
      } else {
        const { data: project, error: projErr } = await supabase.from("story_projects").insert({
          user_id: user.id, story_topic: storyTopic, style: useAppStore.getState().artStyle || "default",
          story_language: storyLanguage, frame_count: scenes.length, image_format: imageFormat,
          story_mode: storyMode,
        } as any).select("id").single();
        if (projErr) throw projErr;
        projectId = project.id;
        setCurrentProjectId(projectId);
      }
      if (projectId) {
        for (const scene of scenes) {
          await (supabase.from("project_frames") as any).upsert({
            project_id: projectId,
            frame_number: scene.number,
            scene_description: scene.description,
            dialogues: JSON.stringify(scene.dialogues),
            narration: (scene as any).narration || null,
            shot_breakdown: scene.shot_breakdown ? JSON.stringify(scene.shot_breakdown) : null,
          }, { onConflict: "project_id,frame_number" });
        }
      }
    } catch (saveErr) {
      console.error("Failed to save project:", saveErr);
    }
  };

  const handleApproveAndGenerate = async () => {
    if (!user) {
      toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in");
      return;
    }
    // Only show avatar step if useCharacterAvatars is enabled
    if (useCharacterAvatars) {
      const characterProfiles = buildCharacterProfiles();

      if (characterProfiles.length > 0) {
        const existingMap = new Map<string, (typeof characterAvatars)[number]>(
          characterAvatars.map((avatar) => [avatar.name.trim().toLowerCase(), avatar] as const),
        );
        const hasUploadedCharacterRefs = characters.some(
          (ch) => !!(ch.role || "").trim() && !!(ch.imageUrl || ch.previewUrl),
        );

        const nextAvatars = characterProfiles.map((profile) => {
          const existing = existingMap.get(profile.name.trim().toLowerCase());
          // Preserve existing avatar imageUrl if present. Only fall back to "" if none exists.
          // Previously this cleared imageUrl when uploaded refs existed, but that wiped legitimate avatars too.
          const preservedUrl = existing?.imageUrl || "";
          return {
            name: profile.name,
            features: profile.features || existing?.features || "",
            imageUrl: preservedUrl,
            generating: false,
          };
        });

        setCharacterAvatars(nextAvatars);
        setStep(2);
        return;
      }
    }

    if (storyMode === "voiceAnimation") {
      goToVoiceAnimationEditor();
      return;
    }

    await generateImages();
  };

  // Helper: extract character names mentioned in a scene
  const getSceneCharacterNames = (scene: typeof scenes[0]): Set<string> => {
    const names = new Set<string>();
    const desc = (scene.description || "").toLowerCase();
    scene.dialogues.forEach(d => {
      const name = (d.character || "").trim().toLowerCase();
      if (name) names.add(name);
    });
    // Also check description for character names from avatars/characters
    [...characterAvatars, ...characters.map(c => ({ name: c.role }))].forEach((c: any) => {
      const name = (c.name || c.role || "").trim().toLowerCase();
      if (name && desc.includes(name)) names.add(name);
    });
    return names;
  };

  const generateImages = async () => {
    if (!user) return;

    // Just create empty frames and navigate to step 3 — user will generate per frame
    const initialImages: GeneratedImage[] = scenes.map((scene) => ({
      sceneId: scene.id, imageUrl: "", approved: false, generating: false, textOverlays: [], duration: 3,
    }));
    setImages(initialImages);
    setStep(3);

    // Save project
    let projectId = currentProjectId;
    try {
      if (projectId) {
        await supabase.from("story_projects").update({
          story_topic: storyTopic, style: useAppStore.getState().artStyle || "default",
          story_language: storyLanguage, frame_count: scenes.length, image_format: imageFormat,
          story_mode: storyMode,
        } as any).eq("id", projectId);
      } else {
        const { data: project, error: projErr } = await supabase.from("story_projects").insert({
          user_id: user.id, story_topic: storyTopic, style: useAppStore.getState().artStyle || "default",
          story_language: storyLanguage, frame_count: scenes.length, image_format: imageFormat,
          story_mode: storyMode,
        } as any).select("id").single();
        if (projErr) throw projErr;
        projectId = project.id;
        setCurrentProjectId(projectId);
      }

      // Save frames to DB so they persist even before images are generated
      if (projectId) {
        for (const scene of scenes) {
          await (supabase.from("project_frames") as any).upsert({
            project_id: projectId,
            frame_number: scene.number,
            scene_description: scene.description,
            dialogues: JSON.stringify(scene.dialogues),
            narration: (scene as any).narration || null,
            shot_breakdown: scene.shot_breakdown ? JSON.stringify(scene.shot_breakdown) : null,
          }, { onConflict: "project_id,frame_number" });
        }
      }
    } catch (saveErr) {
      console.error("Failed to save project:", saveErr);
    }
  };

  const showAvatarStep = useCharacterAvatars && characterAvatars.length > 0;

  if (showAvatarStep) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div />
          <Button variant="ghost" onClick={() => { setCharacterAvatars([]); setStep(2); }}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t(language, "backToDraft")}
          </Button>
        </div>
        <CharacterAvatarStepInline
          onContinue={() => {
            if (storyMode === "voiceAnimation") {
              goToVoiceAnimationEditor();
              return Promise.resolve();
            }
            return generateImages();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t(language, "draftTitle")}</h2>
        <Button variant="ghost" onClick={() => setStep(1)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t(language, "backToForm")}
        </Button>
      </div>

      <div className="space-y-4">
        {scenes.map((scene, idx) => (
          <Card key={scene.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t(language, "scene")} {scene.number}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => swapScenes(idx, idx - 1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === scenes.length - 1} onClick={() => swapScenes(idx, idx + 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  {scenes.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeScene(scene.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {scene.shot_breakdown && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
                  <Label className="flex items-center gap-1 text-xs font-semibold text-primary">
                    <Camera className="h-3 w-3" />
                    {language === "tr" ? "Çekim Planı" : "Shot Breakdown"}
                  </Label>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    {scene.shot_breakdown.shot_type && <span><strong>{language === "tr" ? "Kadraj:" : "Shot:"}</strong> {scene.shot_breakdown.shot_type}</span>}
                    {scene.shot_breakdown.camera_angle && <span><strong>{language === "tr" ? "Açı:" : "Angle:"}</strong> {scene.shot_breakdown.camera_angle}</span>}
                    {scene.shot_breakdown.camera_distance && <span><strong>{language === "tr" ? "Mesafe:" : "Distance:"}</strong> {scene.shot_breakdown.camera_distance}</span>}
                    {scene.shot_breakdown.visual_focus && <span className="col-span-2"><strong>{language === "tr" ? "Odak:" : "Focus:"}</strong> {scene.shot_breakdown.visual_focus}</span>}
                    {scene.shot_breakdown.setting_detail && <span className="col-span-2"><strong>{language === "tr" ? "Mekân:" : "Setting:"}</strong> {scene.shot_breakdown.setting_detail}</span>}
                    {scene.shot_breakdown.lighting && <span><strong>{language === "tr" ? "Işık:" : "Light:"}</strong> {scene.shot_breakdown.lighting}</span>}
                    {scene.shot_breakdown.characters_visible && <span><strong>{language === "tr" ? "Karakterler:" : "Characters:"}</strong> {Array.isArray(scene.shot_breakdown.characters_visible) ? (scene.shot_breakdown.characters_visible.length === 0 ? (language === "tr" ? "Yok" : "None") : scene.shot_breakdown.characters_visible.join(", ")) : String(scene.shot_breakdown.characters_visible)}</span>}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium">{t(language, "sceneDescription")}</Label>
                <Textarea value={scene.description} onChange={(e) => updateScene(scene.id, { description: e.target.value })} rows={3} className="mt-1 resize-none" />
              </div>
              {storyMode === "bgVocal" ? (
                <div>
                  <Label className="text-sm font-medium">
                    {language === "tr" ? "Narrasyon Metni" : "Narration Text"}
                  </Label>
                  <Textarea
                    value={scene.narration || ""}
                    onChange={(e) => updateScene(scene.id, { narration: e.target.value })}
                    rows={3}
                    className="mt-1 resize-none"
                    placeholder={language === "tr" ? "Bu kare için narrasyon metni..." : "Narration text for this frame..."}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-sm font-medium">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t(language, "dialogues")}
                  </Label>
                  {scene.dialogues.map((dialogue, di) => (
                    <div key={di} className="flex gap-2 items-start rounded-lg border border-border/50 bg-muted/30 p-3">
                      <Input value={dialogue.character} onChange={(e) => { const d = [...scene.dialogues]; d[di] = { ...dialogue, character: e.target.value }; updateScene(scene.id, { dialogues: d }); }} placeholder={t(language, "characterLabel")} className="w-1/3 h-10 font-medium" />
                      <Textarea value={dialogue.text} onChange={(e) => { const d = [...scene.dialogues]; d[di] = { ...dialogue, text: e.target.value }; updateScene(scene.id, { dialogues: d }); }} placeholder={t(language, "dialogueText")} className="flex-1 min-h-[56px] resize-none" rows={2} />
                      {scene.dialogues.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground" onClick={() => updateScene(scene.id, { dialogues: scene.dialogues.filter((_, j) => j !== di) })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => updateScene(scene.id, { dialogues: [...scene.dialogues, { character: "", text: "" }] })}>
                    <Plus className="mr-1 h-3 w-3" />
                    {t(language, "addDialogue")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={addScene} className="flex-1">
          <Plus className="mr-1 h-4 w-4" />
          {t(language, "addScene")}
        </Button>
        <Button onClick={handleApproveAndGenerate} disabled={isGeneratingImages} className="flex-1">
          {isGeneratingImages ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t(language, "generating")}</>) : t(language, "approveDraft")}
        </Button>
      </div>
    </div>
  );
}

function CharacterAvatarStepInline({ onContinue }: { onContinue: () => Promise<void> }) {
  const {
    language, characterAvatars, updateCharacterAvatar, removeCharacterAvatar,
    setCharacterAvatars, isGeneratingAvatars, setIsGeneratingAvatars,
    artStyle, isGeneratingImages,
  } = useAppStore();
  const { user } = useAuth();
  const { credits, isUnlimited, refetch } = useCredits();
  const [revisionName, setRevisionName] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");
  // Auto-populate uploadedImages from store characters that have imageUrl
  const storeCharacters = useAppStore((s) => s.characters);
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({});

  // Resolve storage paths to signed URLs on mount
  useEffect(() => {
    const resolve = async () => {
      const map: Record<string, string> = {};
      for (const ch of storeCharacters) {
        const name = (ch.role || "").trim();
        let url = ch.imageUrl || ch.previewUrl || "";
        if (!name || !url) continue;
        // If it's a storage path (not http/data URL), resolve to signed URL
        if (url && !url.startsWith("http") && !url.startsWith("data:")) {
          const { getSignedUrl } = await import("@/lib/projectStorage");
          const signed = await getSignedUrl(url);
          if (signed) url = signed;
        }
        if (url) map[name] = url;
      }
      if (Object.keys(map).length > 0) {
        setUploadedImages(map);
      }
    };
    resolve();
  }, [storeCharacters]);
  const [uploadTargetName, setUploadTargetName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const AVATAR_COST = 0.1;

  const handleFileUpload = (name: string) => {
    setUploadTargetName(name);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTargetName) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImages((prev) => ({ ...prev, [uploadTargetName]: reader.result as string }));
      setUploadTargetName(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeUploadedImage = (name: string) => {
    setUploadedImages((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const buildProfilesFromStore = () =>
    characterAvatars.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), features: (a.features || "").trim() }));

  const debitCredits = async (amount: number, description: string) => {
    if (!user || isUnlimited || amount <= 0) return;

    const { data: creditRow, error: creditError } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .single();
    if (creditError) throw creditError;

    const currentCredits = Number(creditRow?.credits ?? credits);
    const nextCredits = Math.max(0, currentCredits - amount);

    const { error: updateError } = await supabase
      .from("user_credits")
      .update({ credits: nextCredits })
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    const { error: transactionError } = await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount,
      type: "debit",
      description,
    });
    if (transactionError) throw transactionError;

    await refetch();
  };

  const handleAddNewCharacter = () => {
    const name = language === "tr" ? `Karakter ${characterAvatars.length + 1}` : `Character ${characterAvatars.length + 1}`;
    setCharacterAvatars([...characterAvatars, { name, features: "", imageUrl: "", generating: false }]);
  };

  const saveCharactersToDB = async (avatars: typeof characterAvatars) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      for (const avatar of avatars) {
        if (!avatar.imageUrl || !avatar.name.trim()) continue;
        const persistentImageUrl = extractStoryImagePath(avatar.imageUrl) || avatar.imageUrl;
        await (supabase.from("saved_characters") as any).delete().eq("user_id", user.id).eq("name", avatar.name);
        await (supabase.from("saved_characters") as any).insert({
          user_id: user.id, name: avatar.name, features: avatar.features || "", image_url: persistentImageUrl,
        });
      }
    } catch (e) { console.error("Failed to save characters:", e); }
  };

  const generateAllAvatars = async () => {
    const profiles = buildProfilesFromStore();
    if (profiles.length === 0) return;
    if (profiles.some((p) => !p.features)) {
      toast.error(language === "tr" ? "Her karakter için fiziksel özellik/sıfat girin" : "Enter physical traits/adjective for each character");
      return;
    }

    const expectedCost = profiles.length * AVATAR_COST;
    if (!isUnlimited && credits < expectedCost) {
      toast.error(language === "tr"
        ? `Yetersiz bakiye! Avatar üretimi $${expectedCost.toFixed(2)} gerektirir.`
        : `Insufficient balance! Avatar generation costs $${expectedCost.toFixed(2)}.`);
      return;
    }

    setIsGeneratingAvatars(true);
    setCharacterAvatars(characterAvatars.map((a) => ({ ...a, generating: true })));

    try {
      const referenceImagesPayload = Object.keys(uploadedImages).length > 0 ? uploadedImages : undefined;
      const { data, error } = await supabase.functions.invoke("generate-character-avatars", {
        body: { characterProfiles: profiles, artStyle, mode: "initial", referenceImages: referenceImagesPayload },
      });
      if (error) throw error;

      const normalizedAvatars = Array.isArray(data?.avatars)
        ? data.avatars
        : Object.entries(data?.avatars || {}).map(([name, url]) => ({ name, imageUrl: url }));

      const generatedCount = normalizedAvatars.filter((a: any) => !!a.imageUrl).length;

      const updated = characterAvatars.map((avatar) => {
        const generated = normalizedAvatars.find((a: any) => a.name === avatar.name);
        return { ...avatar, imageUrl: generated?.imageUrl || "", generating: false };
      });
      setCharacterAvatars(updated);
      await saveCharactersToDB(updated);

      if (generatedCount > 0) {
        await debitCredits(
          generatedCount * AVATAR_COST,
          language === "tr"
            ? `Avatar üretimi (${generatedCount})`
            : `Avatar generation (${generatedCount})`,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(t(language, "error"));
      setCharacterAvatars(characterAvatars.map((a) => ({ ...a, generating: false })));
    } finally {
      setIsGeneratingAvatars(false);
    }
  };

  const regenerateAvatar = async (name: string, revisionNote?: string) => {
    const currentAvatar = characterAvatars.find((a) => a.name === name);
    if (!currentAvatar?.features?.trim()) {
      toast.error(language === "tr" ? "Önce fiziksel özellik/sıfat girin" : "Enter physical traits/adjective first");
      return;
    }

    if (!isUnlimited && credits < AVATAR_COST) {
      toast.error(language === "tr"
        ? `Yetersiz bakiye! Avatar üretimi $${AVATAR_COST.toFixed(2)} gerektirir.`
        : `Insufficient balance! Avatar generation costs $${AVATAR_COST.toFixed(2)}.`);
      return;
    }

    const hasRevision = !!revisionNote?.trim();
    const mode = hasRevision ? "revision" : "initial";
    const referenceImage = hasRevision ? (currentAvatar?.imageUrl || undefined) : undefined;

    updateCharacterAvatar(name, { generating: true });
    try {
      const uploadedRef = uploadedImages[name];
      const referenceImagesPayload = uploadedRef ? { [name]: uploadedRef } : undefined;
      const { data, error } = await supabase.functions.invoke("generate-character-avatars", {
        body: {
          characterName: name, artStyle, mode, revisionNote,
          referenceImage,
          referenceImages: referenceImagesPayload,
          characterProfiles: [{ name: currentAvatar.name, features: currentAvatar.features }],
        },
      });
      if (error) throw error;
      const normalizedAvatars = Array.isArray(data?.avatars)
        ? data.avatars
        : Object.entries(data?.avatars || {}).map(([n, url]) => ({ name: n, imageUrl: url }));
      const avatar = normalizedAvatars.find((a: any) => a.name === name) || normalizedAvatars[0];
      if (avatar?.imageUrl) {
        updateCharacterAvatar(name, { imageUrl: avatar.imageUrl, generating: false });
        await saveCharactersToDB([{ ...currentAvatar, imageUrl: avatar.imageUrl }]);
        await debitCredits(
          AVATAR_COST,
          language === "tr" ? `Avatar üretimi - ${name}` : `Avatar generation - ${name}`,
        );
      } else {
        updateCharacterAvatar(name, { generating: false });
      }
    } catch (err) {
      console.error(err);
      toast.error(t(language, "error"));
      updateCharacterAvatar(name, { generating: false });
    }
  };

  const handleRevision = (name: string) => {
    if (!revisionText.trim()) return;
    regenerateAvatar(name, revisionText);
    setRevisionName(null);
    setRevisionText("");
  };

  const anyGenerating = characterAvatars.some((a) => a.generating) || isGeneratingAvatars;
  const allApproved = characterAvatars.length > 0 && characterAvatars.every((a) => !!a.imageUrl && !a.generating);
  const hasAnyAvatar = characterAvatars.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t(language, "characterAvatars")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(language, "characterAvatarsDesc")}</p>
      </div>

      {anyGenerating && !characterAvatars.some((a) => a.imageUrl) ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t(language, "generating")}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {characterAvatars.map((avatar, avatarIndex) => (
            <Card key={avatarIndex} className="overflow-hidden">
              <div className="relative flex aspect-square items-center justify-center bg-muted group">
                {avatar.generating ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : avatar.imageUrl ? (
                  <>
                    <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" loading="lazy" />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      onClick={(e) => { e.stopPropagation(); regenerateAvatar(avatar.name); }}
                      disabled={avatar.generating}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      {language === "tr" ? "Yeniden Oluştur" : "Regenerate"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    className="flex flex-col items-center gap-2 h-auto py-4"
                    onClick={() => regenerateAvatar(avatar.name)}
                    disabled={avatar.generating}
                  >
                    <Camera className="h-8 w-8 text-muted-foreground/60" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {language === "tr" ? "Karakter Oluştur" : "Generate Character"}
                    </span>
                  </Button>
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <Input
                  value={avatar.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setCharacterAvatars(characterAvatars.map((a, i) => i === avatarIndex ? { ...a, name: newName } : a));
                  }}
                  className="text-sm font-semibold text-center"
                />
                <Textarea
                  value={avatar.features || ""}
                  onChange={(e) => {
                    setCharacterAvatars(characterAvatars.map((a, i) => i === avatarIndex ? { ...a, features: e.target.value } : a));
                  }}
                  placeholder={t(language, "avatarFeaturesPlaceholder")}
                  className="text-xs resize-y min-h-[60px]"
                  rows={3}
                />
                {uploadedImages[avatar.name] && (
                  <div className="relative">
                    <p className="text-xs text-muted-foreground mb-1">{language === "tr" ? "Referans görsel:" : "Reference image:"}</p>
                    <div className="relative inline-block">
                      <img src={uploadedImages[avatar.name]} alt="ref" className="h-16 w-16 rounded object-cover border" />
                      <button onClick={() => removeUploadedImage(avatar.name)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                )}
                {revisionName === avatar.name ? (
                  <div className="space-y-2">
                    <Textarea value={revisionText} onChange={(e) => setRevisionText(e.target.value)} placeholder={t(language, "avatarRevision")} className="text-xs resize-none" rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleRevision(avatar.name)} disabled={avatar.generating} className="flex-1"><Send className="mr-1 h-3 w-3" />{t(language, "sendRevision")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRevisionName(null)}>✕</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={() => handleFileUpload(avatar.name)} disabled={avatar.generating} className="h-8 w-8 p-0" title={language === "tr" ? "Görsel yükle" : "Upload image"}>
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => regenerateAvatar(avatar.name)} disabled={avatar.generating} className="h-8 w-8 p-0" title={t(language, "regenerateAvatar")}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRevisionName(avatar.name)} disabled={avatar.generating} className="h-8 w-8 p-0" title={t(language, "revise")}>
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeCharacterAvatar(avatar.name)} disabled={avatar.generating} className="h-8 w-8 p-0 text-destructive hover:text-destructive" title={t(language, "deleteChar")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Card className="overflow-hidden border-dashed cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleAddNewCharacter}>
            <div className="flex aspect-square items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Plus className="h-8 w-8" />
                <span className="text-xs font-medium">{t(language, "addNewCharacter")}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Button onClick={generateAllAvatars} disabled={!hasAnyAvatar || anyGenerating || isGeneratingImages} variant="outline" className="w-full" size="lg">
        {characterAvatars.some((a) => a.imageUrl) ? t(language, "regenerateAvatars") : t(language, "generateAvatars")}
      </Button>

      <Button onClick={onContinue} disabled={!allApproved || isGeneratingImages || anyGenerating} className="w-full" size="lg">
        {isGeneratingImages ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t(language, "generating")}</>) : t(language, "approveAvatars")}
      </Button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  );
}
