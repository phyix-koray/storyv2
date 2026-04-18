import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { Character, CharacterAvatar, ObjectAsset, Scene } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CharacterUpload } from "./CharacterUpload";
import { ObjectUpload } from "./ObjectUpload";
import { Loader2, ClipboardPaste, Save, FolderOpen, X, Sparkles, Wand2, LayoutGrid, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ART_STYLES } from "@/lib/styles";
import { useEffect, useState } from "react";
import { extractStoryImagePath, getSignedUrl } from "@/lib/projectStorage";

// Normalize an asset URL into a persistable value:
// - Returns storage path if URL points to story-images bucket
// - Returns http(s) URL as-is if it's a stable external URL (e.g. fal.media, x.ai)
// - Returns "" for blob:, data:, or empty values (transient and shouldn't be persisted)
function normalizeAssetUrlForPersist(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return "";
  const path = extractStoryImagePath(url);
  if (path) return path;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "";
}

interface SavedTemplate {
  id: string;
  name: string;
  story_language: string;
  story_topic: string;
  frame_count: number | null;
  art_style: string;
  image_format: string;
  per_frame_mode: boolean;
  frame_prompts: string[];
  use_character_avatars: boolean;
  character_ids?: { name: string; features?: string; base64?: string; imageUrl?: string }[];
  object_ids?: { description: string; base64?: string; imageUrl?: string }[];
}

const CATEGORIES_TR = ["İş hayatı", "İlişkiler", "Psikoloji", "Hukuk", "Futbol", "Aile", "Günlük hayat", "Teknoloji", "Eğitim", "Sağlık", "Din", "Astroloji", "Tarih", "Hayvan"];
const CATEGORIES_EN = ["Work life", "Relationships", "Psychology", "Law", "Football", "Family", "Daily life", "Technology", "Education", "Health", "Religion", "Astrology", "History", "Animals"];


export function StoryForm() {
  const { user } = useAuth();
  const {
    language, storyTopic, setStoryTopic, storyLanguage, setStoryLanguage,
    frameCount, setFrameCount, artStyle, setArtStyle, imageFormat, setImageFormat,
    characters, isGeneratingDraft, setIsGeneratingDraft, setScenes, setStep, setCharacterAvatars,
    useCharacterAvatars, setUseCharacterAvatars,
    perFrameMode, setPerFrameMode, framePrompts, setFramePrompts, updateFramePrompt,
    storyMode, characterAvatars, objectAssets,
  } = useAppStore();

  const setCharacters = (nextCharacters: Character[]) => {
    const store = useAppStore.getState();
    store.characters.forEach((c) => store.removeCharacter(c.id));
    nextCharacters.forEach((c) => store.addCharacter(c));
  };

  const setObjectAssets = (assets: ObjectAsset[]) => {
    const store = useAppStore.getState();
    store.objectAssets.forEach((a) => store.removeObjectAsset(a.id));
    assets.forEach((a) => store.addObjectAsset(a));
  };

  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showLoadTemplate, setShowLoadTemplate] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // AI suggestion state
  const [showCategories, setShowCategories] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{ text: string; tag: string }>>([]);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [loadingFrameSuggestions, setLoadingFrameSuggestions] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [categoryMode, setCategoryMode] = useState<"fictional" | "documentary" | null>(null);
  const [documentaryCharName, setDocumentaryCharName] = useState("");
  const [lawCountry, setLawCountry] = useState("");
  const [showLawCountryInput, setShowLawCountryInput] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Sync framePrompts array length with frameCount
  useEffect(() => {
    if (perFrameMode && frameCount) {
      const current = framePrompts.length;
      if (current < frameCount) {
        setFramePrompts([...framePrompts, ...Array(frameCount - current).fill("")]);
      } else if (current > frameCount) {
        setFramePrompts(framePrompts.slice(0, frameCount));
      }
    }
  }, [frameCount, perFrameMode]);

  const handlePerFrameModeChange = (enabled: boolean) => {
    setPerFrameMode(enabled);
    if (enabled) {
      const count = frameCount || 4;
      if (!frameCount) setFrameCount(count);
      setFramePrompts(Array(count).fill(""));
    }
  };

  const handleBulkPaste = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split("\n")
      .map(line => line.replace(/^(kare|frame)\s*\d+\s*[:\-–—]\s*/i, "").trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    if (!frameCount || lines.length > frameCount) {
      setFrameCount(Math.min(15, lines.length));
    }
    const count = Math.min(15, Math.max(frameCount || 0, lines.length));
    const newPrompts = Array(count).fill("");
    for (let i = 0; i < Math.min(lines.length, count); i++) {
      newPrompts[i] = lines[i];
    }
    setFramePrompts(newPrompts);
    setShowBulkPaste(false);
    setBulkText("");
    toast.success(language === "tr" ? `${Math.min(lines.length, count)} kare dolduruldu` : `${Math.min(lines.length, count)} frames filled`);
  };

  // AI suggestion functions
  // Categories that need a sub-question (like law needs country)
  const categoriesWithSubQuestion = ["hukuk", "law", "din", "religion", "astroloji", "astrology", "tarih", "history", "hayvan", "animals"];

  const getSubQuestionForCategory = (cat: string): { placeholder: string; question: string } | null => {
    const c = cat.toLowerCase();
    if (c.includes("hukuk") || c.includes("law")) {
      return {
        question: language === "tr" ? "Hangi ülkenin kanunları?" : "Which country's laws?",
        placeholder: language === "tr" ? "Ör: Türkiye, ABD, Almanya..." : "E.g: United States, Germany, Turkey...",
      };
    }
    if (c.includes("din") || c.includes("religion")) {
      return {
        question: language === "tr" ? "Hangi din hakkında yazılsın?" : "Which religion?",
        placeholder: language === "tr" ? "Ör: İslam, Hristiyanlık, Budizm..." : "E.g: Islam, Christianity, Buddhism...",
      };
    }
    if (c.includes("astroloji") || c.includes("astrology")) {
      return {
        question: language === "tr" ? "Hangi burçlar hakkında yazılsın?" : "Which zodiac signs?",
        placeholder: language === "tr" ? "Ör: Koç, Boğa, İkizler..." : "E.g: Aries, Taurus, Gemini...",
      };
    }
    if (c.includes("tarih") || c.includes("history")) {
      return {
        question: language === "tr" ? "Savaş mı, ülke tarihi mi? Hangi yıllar?" : "War, country history? Which years?",
        placeholder: language === "tr" ? "Ör: Osmanlı İmparatorluğu, 2. Dünya Savaşı..." : "E.g: Roman Empire, World War II...",
      };
    }
    if (c.includes("hayvan") || c.includes("animal")) {
      return {
        question: language === "tr" ? "Özellikle istediğin bir hayvan var mı?" : "Any specific animal?",
        placeholder: language === "tr" ? "Ör: Kurt, Kartal, Yunus..." : "E.g: Wolf, Eagle, Dolphin...",
      };
    }
    return null;
  };

  // Sub-question state
  const [subQuestionCategory, setSubQuestionCategory] = useState("");
  const [subQuestionAnswer, setSubQuestionAnswer] = useState("");
  const [showSubQuestion, setShowSubQuestion] = useState(false);

  const fetchViralTopics = async (category?: string, overrideCountry?: string) => {
    const cat = (category || "").toLowerCase();
    const needsSubQuestion = categoriesWithSubQuestion.some(c => cat.includes(c));
    const effectiveCountry = overrideCountry || lawCountry || subQuestionAnswer;
    
    if (needsSubQuestion && !effectiveCountry) {
      setSubQuestionCategory(category || "");
      setShowSubQuestion(true);
      setShowCategories(false);
      setShowLawCountryInput(false);
      return;
    }

    setLoadingAiSuggestions(true);
    setAiSuggestions([]);
    setShowLawCountryInput(false);
    setSelectedCategory(category || "");
    setShowSubQuestion(false);
    try {
      const isDocumentary = categoryMode === "documentary";
      const { data, error } = await supabase.functions.invoke("generate-story-suggestions", {
        body: {
          type: isDocumentary ? "documentary_topics" : "viral_topics",
          category,
          storyLanguage,
          ...(isDocumentary && documentaryCharName.trim() ? { characterName: documentaryCharName.trim() } : {}),
          ...(needsSubQuestion && effectiveCountry ? { lawCountry: effectiveCountry } : {}),
        },
      });
      if (error) throw error;
      const raw = data.suggestions || [];
      const normalized = raw.map((s: any) => {
        if (typeof s === "string") return { text: s, tag: isDocumentary ? "documentary" : "fictional" };
        return { text: s.text || String(s), tag: s.tag || (isDocumentary ? "documentary" : "fictional") };
      });
      setAiSuggestions(normalized);
    } catch (err) {
      console.error(err);
      toast.error(language === "tr" ? "Öneriler yüklenemedi" : "Failed to load suggestions");
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  const fetchFrameSuggestions = async () => {
    if (!storyTopic.trim()) {
      toast.error(language === "tr" ? "Lütfen önce hikaye konusu girin" : "Please enter a story topic first");
      return;
    }
    setLoadingFrameSuggestions(true);
    try {
      const fc = frameCount || 4;
      const { data, error } = await supabase.functions.invoke("generate-story-suggestions", {
        body: { type: "frame_suggestions", storyTopic: storyTopic.trim(), storyLanguage, frameCount: fc },
      });
      if (error) throw error;
      const frames: string[] = data.frames || [];
      if (frames.length > 0) {
        if (!frameCount) setFrameCount(frames.length);
        const count = Math.min(15, Math.max(frameCount || 0, frames.length));
        const newPrompts = Array(count).fill("");
        for (let i = 0; i < Math.min(frames.length, count); i++) {
          newPrompts[i] = frames[i];
        }
        setFramePrompts(newPrompts);
        toast.success(language === "tr" ? `${frames.length} kare önerisi oluşturuldu` : `${frames.length} frame suggestions generated`);
      }
    } catch (err) {
      console.error(err);
      toast.error(language === "tr" ? "Kare önerileri yüklenemedi" : "Failed to generate frame suggestions");
    } finally {
      setLoadingFrameSuggestions(false);
    }
  };

  const [selectedCategory, setSelectedCategory] = useState("");

  const selectSuggestion = (suggestion: { text: string; tag: string }) => {
    setStoryTopic(suggestion.text);
    // Preserve selectedCategory so generate-story-draft knows the content category
    setAiSuggestions([]);
    setShowCategories(false);
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      // Templates persist Step 1 uploaded characters/objects only.
      // characterAvatars (generated in Step 2) is intentionally ignored here
      // to prevent leftover avatars from previous sessions leaking into new templates.
      const templateCharacters = characters.map((c) => ({
        name: c.role || "Karakter",
        features: "",
        imageUrl: normalizeAssetUrlForPersist(c.imageUrl || c.previewUrl),
      }));

      await (supabase.from("story_templates") as any).insert({
        user_id: user.id,
        name: templateName.trim(),
        story_language: storyLanguage,
        story_topic: storyTopic,
        frame_count: frameCount,
        art_style: artStyle,
        image_format: imageFormat,
        per_frame_mode: perFrameMode,
        frame_prompts: perFrameMode ? framePrompts : [],
        use_character_avatars: useCharacterAvatars,
        character_ids: templateCharacters,
        object_ids: objectAssets.map((o) => ({
          description: o.description,
          imageUrl: normalizeAssetUrlForPersist(o.imageUrl || o.previewUrl),
        })),
      });
      toast.success(language === "tr" ? "Şablon kaydedildi" : "Template saved");
      setShowSaveTemplate(false);
      setTemplateName("");
    } catch {
      toast.error(language === "tr" ? "Şablon kaydedilemedi" : "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleLoadTemplates = async () => {
    if (!user) return;
    setLoadingTemplates(true);
    const { data } = await (supabase.from("story_templates") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedTemplates((data || []).map((t: any) => ({ ...t, frame_prompts: t.frame_prompts || [], character_ids: t.character_ids || [], object_ids: t.object_ids || [] })));
    setLoadingTemplates(false);
    setShowLoadTemplate(true);
  };

  const applyTemplate = async (tpl: SavedTemplate) => {
    setStoryLanguage(tpl.story_language || "tr");
    setStoryTopic(tpl.story_topic || "");
    if (tpl.frame_count) setFrameCount(tpl.frame_count);
    setArtStyle(tpl.art_style || "default");
    setImageFormat((tpl.image_format || "square") as any);
    setUseCharacterAvatars(tpl.use_character_avatars ?? true);
    if (tpl.per_frame_mode) {
      setPerFrameMode(true);
      setFramePrompts(tpl.frame_prompts || []);
      if (tpl.frame_count) setFrameCount(tpl.frame_count);
    } else {
      setPerFrameMode(false);
    }

    setShowLoadTemplate(false);
    toast.success(language === "tr" ? "Şablon uygulandı, görseller yükleniyor..." : "Template applied, loading images...");

    // Resolve signed URLs for character + object images in parallel
    const resolveUrl = async (raw?: string): Promise<{ storagePath: string; previewUrl: string }> => {
      const stored = raw || "";
      if (!stored) return { storagePath: "", previewUrl: "" };
      // External http(s) URL that is NOT in our bucket → use directly
      if ((stored.startsWith("http://") || stored.startsWith("https://")) && !extractStoryImagePath(stored)) {
        return { storagePath: stored, previewUrl: stored };
      }
      // base64 fallback
      if (stored.startsWith("data:")) return { storagePath: stored, previewUrl: stored };
      const signed = await getSignedUrl(stored);
      return { storagePath: stored, previewUrl: signed || stored };
    };

    if (tpl.character_ids && Array.isArray(tpl.character_ids) && tpl.character_ids.length > 0) {
      const resolved = await Promise.all(
        tpl.character_ids.map(async (c) => {
          const { storagePath, previewUrl } = await resolveUrl(c.imageUrl || c.base64);
          return { name: c.name, features: c.features || "", storagePath, previewUrl };
        }),
      );
      const restoredAvatars = resolved.map((c) => ({
        name: c.name,
        features: c.features,
        imageUrl: c.previewUrl, // signed/usable URL for AI generation
      }));
      setCharacterAvatars(restoredAvatars);
      setCharacters(
        resolved.map((c) => ({
          id: crypto.randomUUID(),
          file: new File([], `${c.name || "character"}.png`),
          previewUrl: c.previewUrl,
          role: c.name || "",
          imageUrl: c.previewUrl,
        })),
      );
    }

    if (tpl.object_ids && Array.isArray(tpl.object_ids) && tpl.object_ids.length > 0) {
      const resolved = await Promise.all(
        tpl.object_ids.map(async (o) => {
          const { previewUrl } = await resolveUrl(o.imageUrl || o.base64);
          return { description: o.description || "", previewUrl };
        }),
      );
      setObjectAssets(resolved.map((o) => ({
        id: crypto.randomUUID(),
        file: new File([], "template-object.png"),
        previewUrl: o.previewUrl,
        description: o.description,
        imageUrl: o.previewUrl,
      })));
    }
  };

  const deleteTemplate = async (id: string) => {
    await (supabase.from("story_templates") as any).delete().eq("id", id);
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
    toast.success(language === "tr" ? "Şablon silindi" : "Template deleted");
  };

  const hasUploadedCharacters = characters.some(
    (c) => !!(c.role || "").trim() && !!(c.imageUrl || c.previewUrl),
  );

  const handleGenerate = async () => {
    // Validate: documentary category + manual storyTopic conflict
    if (categoryMode === "documentary" && selectedCategory && storyTopic.trim()) {
      toast.warning(
        language === "tr"
          ? "Belgesel kategorisi seçiliyken hikaye konusu alanını boş bırakın veya hikaye konusu yazıyorsanız belgesel kategorisini kaldırın. Sadece biri dolu olabilir."
          : "When a documentary category is selected, leave the story topic empty — or if you write a topic, remove the documentary category. Only one can be filled."
      );
      return;
    }

    if (useCharacterAvatars && hasUploadedCharacters) {
      setCharacterAvatars([]);
    }

    if (perFrameMode) {
      const filledPrompts = framePrompts.filter((p) => p.trim());
      if (filledPrompts.length === 0) {
        toast.error(language === "tr" ? "Lütfen en az bir kare açıklaması girin" : "Please fill at least one frame description");
        return;
      }

      setIsGeneratingDraft(true);
      try {
        const scenes: Scene[] = framePrompts
          .map((prompt, i) => ({
            id: crypto.randomUUID(),
            number: i + 1,
            description: prompt.trim(),
            dialogues: [{ character: "", text: "" }],
          }))
          .filter((s) => s.description);

      const { data, error } = await supabase.functions.invoke("generate-story-draft", {
          body: {
            storyTopic: storyTopic.trim(),
            characters: characters.map((c) => ({ role: c.role, hasImage: true })),
            storyLanguage,
            frameCount: scenes.length,
            artStyle,
            storyMode,
            perFrameMode: true,
            framePrompts: scenes.map((s) => s.description),
            perFrameContext: storyTopic.trim(),
            category: selectedCategory || undefined,
            categoryMode: categoryMode || undefined,
            lawCountry: lawCountry || subQuestionAnswer || undefined,
            webSearch: webSearchEnabled || undefined,
          },
        });

        if (error) throw error;

        const enhancedScenes: Scene[] = scenes.map((scene, i) => {
          const aiScene = data.scenes?.[i];
          return {
            ...scene,
            description: scene.description,
            dialogues: aiScene?.dialogues?.length
              ? aiScene.dialogues.map((d: any) => ({ character: d.character, text: d.text }))
              : scene.dialogues,
            shot_breakdown: aiScene?.shot_breakdown || undefined,
            narration: aiScene?.narration || undefined,
          };
        });

        if (useCharacterAvatars && data.characters && Array.isArray(data.characters) && characters.length === 0) {
          const avatars: CharacterAvatar[] = data.characters.map((c: any) => ({
            name: c.name || "",
            features: `${(c.features || "").trim()}${c.adjective ? `, ${c.adjective}` : ""}`,
            imageUrl: "",
            generating: false,
          }));
          setCharacterAvatars(avatars);
        }

        setScenes(enhancedScenes);
        setStep(2);
      } catch (err: any) {
        console.error(err);
        toast.error(t(language, "error"));
      } finally {
        setIsGeneratingDraft(false);
      }
      return;
    }

    if (!storyTopic.trim() && !selectedCategory) {
      toast.error(language === "tr" ? "Lütfen bir hikaye konusu girin" : "Please enter a story topic");
      return;
    }
    if (characters.length > 0) {
      const unnamedChars = characters.filter((c) => !c.role.trim());
      if (unnamedChars.length > 0) {
        toast.error(language === "tr" ? "Lütfen tüm karakterlere rol atayın" : "Please assign roles to all characters");
        return;
      }
    }

    setIsGeneratingDraft(true);
    try {
      const charDescriptions = characters.map((c) => ({ role: c.role, hasImage: true }));

      const { data, error } = await supabase.functions.invoke("generate-story-draft", {
          body: {
            storyTopic,
            characters: charDescriptions,
            storyLanguage,
            frameCount,
            artStyle,
            storyMode,
            category: selectedCategory || undefined,
            categoryMode: categoryMode || undefined,
            lawCountry: lawCountry || subQuestionAnswer || undefined,
            webSearch: webSearchEnabled || undefined,
          },
        });

      if (error) throw error;

      const scenes: Scene[] = data.scenes.map((s: any, i: number) => ({
        id: crypto.randomUUID(),
        number: i + 1,
        description: s.description,
        dialogues: (s.dialogues || []).map((d: any) => ({
              character: d.character,
              text: d.text,
            })),
        shot_breakdown: s.shot_breakdown || undefined,
        narration: s.narration || undefined,
      }));

      if (useCharacterAvatars && data.characters && Array.isArray(data.characters) && characters.length === 0) {
        const avatars: CharacterAvatar[] = data.characters.map((c: any) => ({
          name: c.name || "",
          features: `${(c.features || "").trim()}${c.adjective ? `, ${c.adjective}` : ""}`,
          imageUrl: "",
          generating: false,
        }));
        setCharacterAvatars(avatars);
      }

      setScenes(scenes);
      setStep(2);
    } catch (err: any) {
      console.error(err);
      toast.error(t(language, "error"));
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const categories = language === "tr" ? CATEGORIES_TR : CATEGORIES_EN;

  const handleCustomCategorySubmit = () => {
    if (customCategory.trim()) {
      setShowCategories(false);
      setShowCustomCategoryInput(false);
      fetchViralTopics(customCategory.trim());
      setCustomCategory("");
    }
  };

  // Reusable AI helper buttons section
  const renderAiHelpers = () => (
    <div className="space-y-2">
      {/* AI action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setCategoryMode(null); fetchViralTopics(); }}
          disabled={loadingAiSuggestions}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:shadow-sm disabled:opacity-50"
        >
          {loadingAiSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {language === "tr" ? "Viral Konu Üret" : "Generate Viral Topic"}
        </button>
        <button
          onClick={() => { setCategoryMode("fictional"); setShowCategories(true); setShowCustomCategoryInput(false); }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all hover:bg-muted hover:shadow-sm ${categoryMode === "fictional" && showCategories ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}
        >
          <LayoutGrid className="h-3 w-3" />
          {language === "tr" ? "Kurgusal" : "Fictional"}
        </button>
        <button
          onClick={() => { setCategoryMode("documentary"); setShowCategories(true); setShowCustomCategoryInput(false); }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all hover:bg-muted hover:shadow-sm ${categoryMode === "documentary" && showCategories ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}
        >
          <LayoutGrid className="h-3 w-3" />
          {language === "tr" ? "Belgesel" : "Documentary"}
        </button>
      </div>

      {/* Category chips */}
      {showCategories && (
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {categoryMode === "documentary"
              ? (language === "tr" ? "Belgesel kategorisi seçin" : "Select documentary category")
              : (language === "tr" ? "Kurgusal kategori seçin" : "Select fictional category")}
          </p>

          {/* Search/custom input for both modes */}
          <div className="flex gap-2">
            <Input
              value={categoryMode === "documentary" ? documentaryCharName : customCategory}
              onChange={(e) => categoryMode === "documentary" ? setDocumentaryCharName(e.target.value) : setCustomCategory(e.target.value)}
              placeholder={language === "tr" ? "Kişi adı, kategori adı vb. girin..." : "Enter person name, category name, etc..."}
              className="h-8 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = categoryMode === "documentary" ? documentaryCharName.trim() : customCategory.trim();
                  if (val) {
                    setShowCategories(false);
                    fetchViralTopics(val);
                    if (categoryMode !== "documentary") setCustomCategory("");
                  }
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => {
                const val = categoryMode === "documentary" ? documentaryCharName.trim() : customCategory.trim();
                if (val) {
                  setShowCategories(false);
                  fetchViralTopics(val);
                  if (categoryMode !== "documentary") setCustomCategory("");
                }
              }}
              disabled={categoryMode === "documentary" ? !documentaryCharName.trim() : !customCategory.trim()}
            >
              Go
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setShowCategories(false); fetchViralTopics(cat); }}
                className="rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-sm"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sub-question selector (law country, religion, zodiac, history, animal) */}
      {(showLawCountryInput || showSubQuestion) && (() => {
        const subQ = getSubQuestionForCategory(subQuestionCategory || customCategory || (language === "tr" ? "Hukuk" : "Law"));
        const questionText = subQ?.question || (language === "tr" ? "Detay girin" : "Enter details");
        const placeholderText = subQ?.placeholder || "";
        const answerVal = showLawCountryInput ? lawCountry : subQuestionAnswer;
        const setAnswerVal = showLawCountryInput ? setLawCountry : setSubQuestionAnswer;

        return (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs font-semibold text-foreground">{questionText}</p>
            <div className="flex gap-2">
              <Input
                value={answerVal}
                onChange={(e) => setAnswerVal(e.target.value)}
                placeholder={placeholderText}
                className="h-8 text-xs flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && answerVal.trim()) {
                    setShowLawCountryInput(false);
                    setShowSubQuestion(false);
                    fetchViralTopics(subQuestionCategory || customCategory || (language === "tr" ? "Hukuk" : "Law"), answerVal.trim());
                  }
                }}
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => {
                  if (answerVal.trim()) {
                    setShowLawCountryInput(false);
                    setShowSubQuestion(false);
                    fetchViralTopics(subQuestionCategory || customCategory || (language === "tr" ? "Hukuk" : "Law"), answerVal.trim());
                  }
                }}
                disabled={!answerVal.trim()}
              >
                {language === "tr" ? "Devam" : "Continue"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setShowLawCountryInput(false);
                setShowSubQuestion(false);
                setSubQuestionAnswer("");
                fetchViralTopics(subQuestionCategory || customCategory || (language === "tr" ? "Hukuk" : "Law"), "random");
              }}
            >
              {language === "tr" ? "Atla, rastgele üret" : "Skip, generate random"}
            </Button>
          </div>
        );
      })()}

      {(loadingAiSuggestions || aiSuggestions.length > 0) && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {loadingAiSuggestions ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{language === "tr" ? "Öneriler oluşturuluyor..." : "Generating suggestions..."}</span>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "tr" ? "Bir konu seçin" : "Select a topic"}
              </p>
              <div className="space-y-1.5">
                {aiSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left rounded-lg border border-border/60 bg-background p-2.5 text-xs leading-relaxed transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        s.tag === "real" || s.tag === "documentary"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {s.tag === "real" || s.tag === "documentary"
                          ? (language === "tr" ? "Gerçek" : "Real")
                          : (language === "tr" ? "Kurgu" : "Fiction")}
                      </span>
                      <span>{s.text}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAiSuggestions([])}
                className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1"
              >
                {language === "tr" ? "Kapat" : "Dismiss"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[672px] space-y-6 py-4">
      {/* Characters & Objects */}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <CharacterUpload />
        <ObjectUpload />
      </div>

      {/* Settings Row */}
      <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t(language, "storyLanguage")} <span className="text-destructive">*</span></Label>
            <Select value={storyLanguage} onValueChange={setStoryLanguage}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="zh">🇨🇳 Mandarin Chinese</SelectItem>
                <SelectItem value="ja">🇯🇵 Japanese</SelectItem>
                <SelectItem value="ko">🇰🇷 Korean</SelectItem>
                <SelectItem value="es">🇪🇸 Spanish</SelectItem>
                <SelectItem value="pt">🇧🇷 Portuguese</SelectItem>
                <SelectItem value="id">🇮🇩 Indonesian</SelectItem>
                <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t(language, "frameCount")}</Label>
            <Select value={frameCount?.toString() ?? "auto"} onValueChange={(v) => setFrameCount(v === "auto" ? null : Number(v))}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!perFrameMode && <SelectItem value="auto">{t(language, "frameCountAuto")}</SelectItem>}
                {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t(language, "artStyle")}</Label>
            <Select value={artStyle} onValueChange={setArtStyle}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ART_STYLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">{t(language, "imageFormat")}</Label>
            <Select value={imageFormat} onValueChange={(v) => setImageFormat(v as any)}>
              <SelectTrigger className="h-9 w-full min-w-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="square">{t(language, "formatSquare")}</SelectItem>
                <SelectItem value="mobile">{t(language, "formatMobile")}</SelectItem>
                <SelectItem value="desktop">{t(language, "formatDesktop")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
          <Checkbox
            id="useAvatars"
            checked={useCharacterAvatars}
            onCheckedChange={(v) => setUseCharacterAvatars(!!v)}
          />
          <Label htmlFor="useAvatars" className="text-xs cursor-pointer text-muted-foreground">
            {language === "tr" ? "Tutarlı karakterler için avatar taslağı oluştur (kendi karakterlerinizi yüklemediyseniz işaretleyin)" : "Generate avatar drafts for consistent characters (tick if you didn't upload your own)"}
          </Label>
        </div>
      </div>

      {/* Per-frame mode toggle */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-3.5">
        <Switch
          checked={perFrameMode}
          onCheckedChange={handlePerFrameModeChange}
        />
        <Label className="text-xs font-medium cursor-pointer" onClick={() => handlePerFrameModeChange(!perFrameMode)}>
          {t(language, perFrameMode ? "perFrameMode" : "storyTopicMode")}
        </Label>
      </div>

      {/* Story topic / per-frame section */}
      {perFrameMode ? (
        <div className="space-y-4">
          {/* Story context */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t(language, "storyContext")}</Label>
            {renderAiHelpers()}
            <Textarea
              value={storyTopic}
              onChange={(e) => setStoryTopic(e.target.value)}
              placeholder={t(language, "storyContextPlaceholder")}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Frame descriptions header */}
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">{t(language, "scene")} {language === "tr" ? "Açıklamaları" : "Descriptions"} <span className="text-destructive">*</span></Label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchFrameSuggestions}
                disabled={loadingFrameSuggestions || !storyTopic.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-40"
              >
                {loadingFrameSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                {language === "tr" ? "AI ile Doldur" : "AI Fill"}
              </button>
              <button
                onClick={() => setShowBulkPaste(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                <ClipboardPaste className="h-3 w-3" />
                {t(language, "bulkPaste")}
              </button>
            </div>
          </div>
          {framePrompts.map((prompt, i) => (
            <div key={i} className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                {t(language, "scene")} {i + 1}
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => updateFramePrompt(i, e.target.value)}
                placeholder={t(language, "framePromptPlaceholder")}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          ))}

          {/* Bulk Paste Dialog */}
          <Dialog open={showBulkPaste} onOpenChange={setShowBulkPaste}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{t(language, "bulkPaste")}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                {language === "tr"
                  ? "Her satır bir kareye yerleştirilecek. \"Kare 1:\" gibi ön ekler otomatik temizlenir."
                  : "Each line will be placed in a frame. Prefixes like \"Frame 1:\" are auto-removed."}
              </p>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={language === "tr"
                  ? "Kare 1: Üniversite kampüsü, kalabalık…\nKare 2: Kız ders arasında hızlıca sınıfa geçmeye çalışıyor.\nKare 3: Koridorda çarpışırlar."
                  : "Frame 1: University campus, crowded…\nFrame 2: Girl tries to get to class quickly.\nFrame 3: They bump into each other."}
                rows={8}
                className="resize-none text-sm"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkPaste(false)}>{t(language, "cancel")}</Button>
                <Button onClick={handleBulkPaste} disabled={!bulkText.trim()}>
                  <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
                  {t(language, "bulkPaste")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t(language, "storyTopic")} <span className="text-destructive">*</span></Label>
          {renderAiHelpers()}
          <Textarea
            value={storyTopic}
            onChange={(e) => setStoryTopic(e.target.value)}
            placeholder={t(language, "storyTopicPlaceholder")}
            rows={3}
            className="resize-none text-sm"
          />
        </div>
      )}

      {/* Web Search Toggle */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-3.5">
        <Switch
          checked={webSearchEnabled}
          onCheckedChange={setWebSearchEnabled}
        />
        <div className="flex items-center gap-2 flex-1">
          <Globe className="h-4 w-4 text-primary" />
          <Label className="text-xs font-medium cursor-pointer" onClick={() => setWebSearchEnabled(!webSearchEnabled)}>
            {language === "tr" ? "Web Araştırması (Güncel bilgi ile hikaye üret)" : "Web Search (Generate story with up-to-date info)"}
          </Label>
        </div>
      </div>

      {/* Template & Generate */}
      <div className="space-y-3">
        {user && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowSaveTemplate(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm px-4 py-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-card hover:text-foreground hover:shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {language === "tr" ? "Şablon Kaydet" : "Save Template"}
            </button>
            <button
              onClick={handleLoadTemplates}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm px-4 py-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-card hover:text-foreground hover:shadow-sm"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {language === "tr" ? "Şablon Yükle" : "Load Template"}
            </button>
          </div>
        )}

        <Button onClick={handleGenerate} disabled={isGeneratingDraft} className="w-full" size="lg">
          {isGeneratingDraft ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t(language, "loading")}
            </>
          ) : (
            t(language, "generateStory")
          )}
        </Button>
      </div>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === "tr" ? "Şablon Kaydet" : "Save Template"}</DialogTitle>
          </DialogHeader>
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder={language === "tr" ? "Şablon adı" : "Template name"}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>{t(language, "cancel")}</Button>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || savingTemplate}>
              {savingTemplate ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              {language === "tr" ? "Kaydet" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={showLoadTemplate} onOpenChange={setShowLoadTemplate}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "tr" ? "Şablon Yükle" : "Load Template"}</DialogTitle>
          </DialogHeader>
          {loadingTemplates ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : savedTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {language === "tr" ? "Henüz şablon yok" : "No templates yet"}
            </p>
          ) : (
            <div className="space-y-2">
              {savedTemplates.map((tpl) => (
                <div key={tpl.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <button className="flex-1 text-left" onClick={() => applyTemplate(tpl)}>
                    <p className="text-sm font-medium">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {tpl.story_topic ? tpl.story_topic.slice(0, 60) : (tpl.per_frame_mode ? (language === "tr" ? "Kare bazlı" : "Per-frame") : "—")}
                    </p>
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteTemplate(tpl.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
