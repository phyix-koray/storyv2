import { useState, useEffect, useRef, useCallback } from "react";
import { MODEL_DESCRIPTIONS } from "@/lib/videoPricing";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { uploadStoryImage } from "@/lib/projectStorage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Download, Video, CheckCircle, XCircle, Image, Trash2, Plus, AlertTriangle, Upload, History, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { getVideoCost } from "@/lib/videoPricing";
import type { AIVideoJob, GeneratedImage } from "@/lib/types";
// VideoMergePreview moved to step 4
import { SubtitleSettings } from "@/components/SubtitleSettings";
import type { SubtitleOptions } from "@/lib/subtitles";
import { CreditExhaustedDialog } from "@/components/CreditExhaustedDialog";
import { AIMusicGenerator } from "@/components/AIMusicGenerator";

const DURATIONS_DEFAULT = ["4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DURATIONS_SEEDANCE = ["4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DURATIONS_WAN = ["5", "10", "15"];
const DURATIONS_GROK = Array.from({ length: 15 }, (_, i) => String(i + 1));
const DURATIONS_LTX = ["6", "8", "10", "12", "14", "16", "18", "20"];
const RESOLUTIONS_DEFAULT = ["480p", "720p", "1080p"];
const RESOLUTIONS_SEEDANCE = ["480p", "720p", "1080p"];
const RESOLUTIONS_WAN = ["720p", "1080p"];
const RESOLUTIONS_GROK = ["480p", "720p"];
const RESOLUTIONS_LTX = ["1080p", "1440p", "2160p"];
const MAX_POLLS = 60;
const IMAGE_COST = 0.06;

interface SavedChar {
  id: string;
  name: string;
  features: string;
  image_url: string;
}

function getAspectRatio(imageFormat: string): string {
  switch (imageFormat) {
    case "mobile": return "9:16";
    case "desktop": return "16:9";
    default: return "1:1";
  }
}

interface FrameImageState {
  prompt: string;
  avatarUrls: string[];
  imageUrl: string;
  generating: boolean;
  error: string | null;
}

interface FrameVideoDialogue {
  character: string;
  text: string;
}

interface FrameVideoSettings {
  prompt: string;
  duration: string;
  resolution: string;
  cameraFixed: boolean;
  generateAudio: boolean;
  dialogues: FrameVideoDialogue[];
  model: "seedance" | "wan" | "grok" | "ltx";
}

export function VoiceAnimationEditor() {
  const { user } = useAuth();
  const { credits, isUnlimited, refetch: refetchCredits } = useCredits();
  const {
    language, scenes, images, setImages, updateImage, setStep, imageFormat,
    characterAvatars, currentProjectId, storyMode, addScene, removeScene,
    objectAssets, storyLanguage, storyTopic, characters, updateScene,
  } = useAppStore();
  const setCurrentProjectId = useAppStore((s) => s.setCurrentProjectId);

  const artStyle = useAppStore.getState().artStyle || "default";

  // Per-frame image state
  const [frameStates, setFrameStates] = useState<Record<string, FrameImageState>>({});

  // Per-frame video settings
  const [frameVideoSettings, setFrameVideoSettings] = useState<Record<string, FrameVideoSettings>>({});
  const [videoJobs, setVideoJobs] = useState<AIVideoJob[]>([]);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const pollingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pollCountRef = useRef<Record<string, number>>({});
  const consecutiveErrorsRef = useRef<Record<string, number>>({});

  // Avatar upload/history states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPopoverSceneId, setAvatarPopoverSceneId] = useState<string | null>(null);
  const [uploadSceneId, setUploadSceneId] = useState<string | null>(null);
  const [historySceneId, setHistorySceneId] = useState<string | null>(null);
  const [savedChars, setSavedChars] = useState<SavedChar[]>([]);
  const [loadingSavedChars, setLoadingSavedChars] = useState(false);
  const [selectedSavedCharIds, setSelectedSavedCharIds] = useState<Set<string>>(new Set());
  // showMergePreview removed - now handled by step 4
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleOptions, setSubtitleOptions] = useState<SubtitleOptions>({});
  const [selectedVideoIdx, setSelectedVideoIdx] = useState<Record<string, number>>({});
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(20);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [creditRequiredAmount, setCreditRequiredAmount] = useState(0);

  // Collect all reference URLs from avatars, characters, objects
  const collectAllReferenceUrls = useCallback(() => {
    const seenUrls = new Set<string>();
    const allAvatarUrls: string[] = [];
    for (const a of characterAvatars) {
      if (a.name?.trim() && a.imageUrl && !seenUrls.has(a.imageUrl)) {
        seenUrls.add(a.imageUrl);
        allAvatarUrls.push(a.imageUrl);
      }
    }
    for (const c of characters) {
      const url = c.imageUrl || c.previewUrl || "";
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        allAvatarUrls.push(url);
      }
    }
    for (const a of objectAssets) {
      const url = a.imageUrl || a.previewUrl || "";
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        allAvatarUrls.push(url);
      }
    }
    return allAvatarUrls;
  }, [characterAvatars, characters, objectAssets]);

  // Initialize frame states from scenes
  useEffect(() => {
    const allAvatarUrls = collectAllReferenceUrls();
    const newStates: Record<string, FrameImageState> = {};
    for (const scene of scenes) {
      const existing = frameStates[scene.id];
      const existingImage = images.find(im => im.sceneId === scene.id);
      newStates[scene.id] = existing || {
        prompt: extractCoreAction(scene.description || ""),
        avatarUrls: allAvatarUrls,
        imageUrl: existingImage?.imageUrl || "",
        generating: false,
        error: null,
      };
    }
    setFrameStates(newStates);
  }, [scenes.length]); // Only on scene count change

  // Sync reference URLs into existing frames when avatars/characters/objects change
  useEffect(() => {
    const allRefUrls = collectAllReferenceUrls();
    if (allRefUrls.length === 0) return;
    setFrameStates(prev => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        const frame = next[key];
        const newUrls = allRefUrls.filter(u => !frame.avatarUrls.includes(u));
        if (newUrls.length > 0) {
          next[key] = { ...frame, avatarUrls: [...frame.avatarUrls, ...newUrls] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [characterAvatars.length, characters.length, collectAllReferenceUrls]);

  // Auto-add objectAssets to all frames when objects change
  useEffect(() => {
    if (objectAssets.length === 0) return;
    const objUrls = objectAssets
      .filter(a => a.imageUrl || a.previewUrl)
      .map(a => a.imageUrl || a.previewUrl)
      .filter(Boolean) as string[];
    if (objUrls.length === 0) return;
    setFrameStates(prev => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        const frame = next[key];
        const newUrls = objUrls.filter(u => !frame.avatarUrls.includes(u));
        if (newUrls.length > 0) {
          next[key] = { ...frame, avatarUrls: [...frame.avatarUrls, ...newUrls] };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [objectAssets.length]);

  // Auto-initialize per-frame video settings
  useEffect(() => {
    const newSettings: Record<string, FrameVideoSettings> = { ...frameVideoSettings };
    const noMusicText = storyLanguage === "tr" ? "arkaplanda müzik olmasın." : "no background music.";
    for (const scene of scenes) {
      const frame = frameStates[scene.id];
      if (!frame?.imageUrl || newSettings[scene.id]) continue;
      const shortDesc = extractCoreAction(scene.description || "").split(/[.!?]/)[0].trim();
      const autoPrompt = shortDesc ? `${shortDesc}, ${noMusicText}` : noMusicText;
      newSettings[scene.id] = {
        prompt: autoPrompt,
        duration: "5",
        resolution: "720p",
        cameraFixed: false,
        generateAudio: true,
        model: storyLanguage === "tr" ? "grok" : "seedance",
        dialogues: scene.dialogues
          .filter(d => d.character || d.text)
          .map(d => ({ character: d.character || "?", text: d.text || "" })),
      };
    }
    setFrameVideoSettings(newSettings);
  }, [scenes.map(s => s.id).join(","), Object.keys(frameStates).map(k => frameStates[k]?.imageUrl).join(",")]);

  useEffect(() => {
    return () => { Object.values(pollingRef.current).forEach(clearInterval); };
  }, []);

  // Restore per-frame videos from History
  const restoredVideos = useAppStore((s) => s.restoredVideos);
  const setRestoredVideos = useAppStore((s) => s.setRestoredVideos);
  useEffect(() => {
    if (!restoredVideos || Object.keys(restoredVideos).length === 0) return;
    const restoredJobs: AIVideoJob[] = [];
    for (const scene of scenes) {
      const videoUrl = restoredVideos[scene.number];
      if (videoUrl) {
        restoredJobs.push({
          sceneId: scene.id,
          model: "wan",
          requestId: `restored-${scene.id}`,
          status: "completed",
          videoUrl,
        });
      }
    }
    if (restoredJobs.length > 0) {
      setVideoJobs(restoredJobs);
      // Clear restored videos so they don't re-apply
      setRestoredVideos({});
    }
  }, [scenes.length, Object.keys(restoredVideos).length]);

  // Keep full prompt text (no character cap)
  function extractCoreAction(description: string): string {
    let text = (description || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    // Remove appearance/age/risky words
    const patterns: RegExp[] = [
      /\b(\d{1,2})\s*yaş(?:ında|larında)?\b/gi,
      /\b(yaşlı|genç|orta yaşlı|çocuk|bebek)\b/gi,
      /\b(kısa|uzun|sarı|kumral|esmer|beyaz tenli|buğday tenli|siyah saçlı|kahverengi saçlı|sarı tenli)\b/gi,
      /\b(kucakla[a-zışçğü]*|sarıl[a-zışçğü]*|öp[a-zışçğü]*|haz\s|zevk|tutku|arzu|şehvet|çıplak)\b/gi,
      /\b(kel|göbekli|kilolu|ince yapılı|hafif kilolu|güler yüzlü|geniş gülümseme|neşeli gözleri|büyük gözleri)\b/gi,
      /\b(saçlı|gözlü|tenli|yapılı|boylu)\b/gi,
    ];
    for (const p of patterns) text = text.replace(p, " ");
    return text.replace(/\s{2,}/g, " ").trim();
  }

  const buildFullVideoPrompt = (vs: FrameVideoSettings, sceneId?: string): string => {
    const dialogueText = (vs.dialogues || []).filter(d => d.text).map(d => `${d.character || "?"}: "${d.text}"`).join("\n");
    // Append character appearance descriptions so AI knows who is speaking
    const charDescriptions: string[] = [];
    for (const avatar of characterAvatars) {
      if (avatar.name?.trim()) {
        const features = avatar.features || "";
        charDescriptions.push(`[${avatar.name}: ${features || "character in the scene"}]`);
      }
    }
    const charBlock = charDescriptions.length > 0
      ? `\n\nCharacter appearances:\n${charDescriptions.join("\n")}`
      : "";
    return `${vs.prompt}${dialogueText ? `\n\nDialogues:\n${dialogueText}` : ""}${charBlock}`;
  };

  const updateFrameState = (sceneId: string, updates: Partial<FrameImageState>) => {
    setFrameStates(prev => ({
      ...prev,
      [sceneId]: { ...prev[sceneId], ...updates },
    }));
  };

  const updateVideoDialogue = (sceneId: string, idx: number, updates: Partial<FrameVideoDialogue>) => {
    setFrameVideoSettings(prev => {
      const current = prev[sceneId];
      if (!current) return prev;
      const dialogues = [...current.dialogues];
      dialogues[idx] = { ...dialogues[idx], ...updates };
      return { ...prev, [sceneId]: { ...current, dialogues } };
    });
  };

  const addVideoDialogue = (sceneId: string) => {
    setFrameVideoSettings(prev => {
      const current = prev[sceneId];
      if (!current) return prev;
      return { ...prev, [sceneId]: { ...current, dialogues: [...current.dialogues, { character: "", text: "" }] } };
    });
  };

  const removeVideoDialogue = (sceneId: string, idx: number) => {
    setFrameVideoSettings(prev => {
      const current = prev[sceneId];
      if (!current) return prev;
      return { ...prev, [sceneId]: { ...current, dialogues: current.dialogues.filter((_, i) => i !== idx) } };
    });
  };

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

    await refetchCredits();
  };

  // Ensure project is persisted in DB, returns projectId
  const ensureProjectSaved = async (): Promise<string | null> => {
    if (!user) return null;
    const artStyleVal = useAppStore.getState().artStyle || "default";
    let projectId = currentProjectId;
    try {
      if (projectId) {
        await supabase.from("story_projects").update({
          story_topic: storyTopic, style: artStyleVal,
          story_language: storyLanguage, frame_count: scenes.length, image_format: imageFormat,
          story_mode: storyMode,
        } as any).eq("id", projectId);
      } else {
        const { data: project, error: projErr } = await supabase.from("story_projects").insert({
          user_id: user.id, story_topic: storyTopic || (language === "tr" ? "Sesli Animasyon" : "Voice Animation"),
          style: artStyleVal, story_language: storyLanguage,
          frame_count: scenes.length, image_format: imageFormat, story_mode: storyMode,
        } as any).select("id").single();
        if (projErr) throw projErr;
        projectId = project.id;
        setCurrentProjectId(projectId);
      }
    } catch (e) {
      console.error("Failed to save project:", e);
    }
    return projectId;
  };

  // Save a single frame to DB
  const saveFrameToDB = async (sceneId: string, imageUrl: string) => {
    if (!user) return;
    const projectId = await ensureProjectSaved();
    if (!projectId) return;
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    try {
      const path = await uploadStoryImage({
        dataUrl: imageUrl, userId: user.id, projectId, frameNumber: scene.number,
      });
      const imagePath = path || imageUrl;
      await (supabase.from("project_frames") as any).upsert({
        project_id: projectId, frame_number: scene.number,
        scene_description: scene.description, image_path: imagePath,
        dialogues: scene.dialogues,
        shot_breakdown: scene.shot_breakdown || null,
      }, { onConflict: "project_id,frame_number" });
    } catch (e) {
      console.error("Failed to save frame:", e);
    }
  };

  // Save video URL to DB with frame_number
  const saveVideoToDB = async (videoUrl: string, sceneId: string) => {
    if (!user) return;
    const projectId = currentProjectId || (await ensureProjectSaved());
    if (!projectId) return;
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    try {
      await (supabase.from("project_videos") as any).upsert({
        project_id: projectId, video_url: videoUrl, frame_number: scene.number,
      }, { onConflict: "project_id,frame_number" });
    } catch (e) {
      console.error("Failed to save video:", e);
    }
  };

  const addAvatarToFrame = (sceneId: string, url: string) => {
    setFrameStates(prev => {
      const current = prev[sceneId];
      if (!current || current.avatarUrls.includes(url)) return prev;
      return { ...prev, [sceneId]: { ...current, avatarUrls: [...current.avatarUrls, url] } };
    });
  };

  const removeAvatarFromFrame = (sceneId: string, idx: number) => {
    setFrameStates(prev => {
      const current = prev[sceneId];
      if (!current) return prev;
      return { ...prev, [sceneId]: { ...current, avatarUrls: current.avatarUrls.filter((_, i) => i !== idx) } };
    });
  };

  const prefetchSavedCharacters = useCallback(async () => {
    if (!user) return;
    setLoadingSavedChars(true);
    const { data } = await (supabase.from("saved_characters") as any)
      .select("id, name, features, image_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedChars(data || []);
    setLoadingSavedChars(false);
  }, [user]);

  const openComputerUpload = (sceneId: string) => {
    setAvatarPopoverSceneId(null);
    setUploadSceneId(sceneId);
    fileInputRef.current?.click();
  };

  const openHistorySelection = async (sceneId: string) => {
    setAvatarPopoverSceneId(null);
    setSelectedSavedCharIds(new Set());
    setHistorySceneId(sceneId);
    if (savedChars.length === 0) {
      await prefetchSavedCharacters();
    }
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !uploadSceneId) return;

    const targetSceneId = uploadSceneId;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let finalUrl = dataUrl;
      if (user && currentProjectId) {
        const scene = scenes.find(s => s.id === targetSceneId);
        const uploadedPath = await uploadStoryImage({
          dataUrl,
          userId: user.id,
          projectId: currentProjectId,
          frameNumber: scene?.number || 1,
        });
        if (uploadedPath) {
          const { data } = supabase.storage.from("story-images").getPublicUrl(uploadedPath);
          finalUrl = data.publicUrl;
        }
      }

      addAvatarToFrame(targetSceneId, finalUrl);
    }

    setUploadSceneId(null);
    event.target.value = "";
  };

  const pasteFromClipboard = async (sceneId: string) => {
    setAvatarPopoverSceneId(null);
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        let finalUrl = dataUrl;
        if (user && currentProjectId) {
          const scene = scenes.find(s => s.id === sceneId);
          const uploadedPath = await uploadStoryImage({
            dataUrl,
            userId: user.id,
            projectId: currentProjectId,
            frameNumber: scene?.number || 1,
          });
          if (uploadedPath) {
            const { data } = supabase.storage.from("story-images").getPublicUrl(uploadedPath);
            finalUrl = data.publicUrl;
          }
        }
        addAvatarToFrame(sceneId, finalUrl);
        toast.success(language === "tr" ? "Görsel yapıştırıldı" : "Image pasted");
        return;
      }
      toast.error(language === "tr" ? "Panoda görsel bulunamadı" : "No image found in clipboard");
    } catch (err) {
      console.error("Clipboard paste error:", err);
      toast.error(language === "tr" ? "Pano erişimi başarısız" : "Clipboard access failed");
    }
  };

  const toggleSavedCharacter = (charId: string) => {
    setSelectedSavedCharIds(prev => {
      const next = new Set(prev);
      if (next.has(charId)) next.delete(charId);
      else next.add(charId);
      return next;
    });
  };

  const addSelectedHistoryAvatars = async () => {
    if (!historySceneId) return;
    for (const char of savedChars.filter(c => selectedSavedCharIds.has(c.id))) {
      let url = char.image_url;
      // If it's a storage path (not http/data/blob), get a signed URL
      if (url && !url.startsWith("http") && !url.startsWith("data:") && !url.startsWith("blob:")) {
        const { data: signedData } = await supabase.storage
          .from("story-images")
          .createSignedUrl(url, 3600);
        if (signedData?.signedUrl) url = signedData.signedUrl;
      }
      addAvatarToFrame(historySceneId, url);
    }
    setHistorySceneId(null);
    setSelectedSavedCharIds(new Set());
  };

  // Generate image for a single frame
  const generateFrameImage = async (sceneId: string) => {
    const frame = frameStates[sceneId];
    if (!frame) return;
    if (!user) {
      toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in");
      return;
    }
    if (!isUnlimited && credits < IMAGE_COST) {
      setCreditRequiredAmount(IMAGE_COST);
      setShowCreditDialog(true);
      return;
    }

    updateFrameState(sceneId, { generating: true, error: null });
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    try {
      // Resolve all avatar URLs: upload data: URLs to storage and get signed URLs for storage paths
      const resolvedUrls: string[] = [];
      for (const url of frame.avatarUrls) {
        if (url.startsWith("http")) {
          // Check if it's a Supabase storage URL that needs a signed URL
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
          if (supabaseUrl && url.includes(supabaseUrl) && url.includes("/story-images/")) {
            // Extract the path after /story-images/
            const pathMatch = url.split("/story-images/")[1];
            if (pathMatch) {
              const decodedPath = decodeURIComponent(pathMatch.split("?")[0]);
              const { data: signedData } = await supabase.storage
                .from("story-images")
                .createSignedUrl(decodedPath, 3600);
              if (signedData?.signedUrl) {
                resolvedUrls.push(signedData.signedUrl);
                continue;
              }
            }
          }
          resolvedUrls.push(url);
        } else if (url.startsWith("data:")) {
          // Upload data: URL to storage and get a signed URL
          const projectId = currentProjectId || user.id;
          const uploadedPath = await uploadStoryImage({
            dataUrl: url,
            userId: user.id,
            projectId,
            frameNumber: scene?.number || 99,
          });
          if (uploadedPath) {
            const { data: signedData } = await supabase.storage
              .from("story-images")
              .createSignedUrl(uploadedPath, 3600);
            if (signedData?.signedUrl) {
              resolvedUrls.push(signedData.signedUrl);
              continue;
            }
          }
          console.warn("Could not upload data: URL avatar to storage");
        } else if (url.startsWith("blob:")) {
          // Convert blob URL -> data URL, then upload
          try {
            const blobRes = await fetch(url);
            if (blobRes.ok) {
              const blob = await blobRes.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              const projectId = currentProjectId || user.id;
              const uploadedPath = await uploadStoryImage({
                dataUrl,
                userId: user.id,
                projectId,
                frameNumber: scene?.number || 99,
              });
              if (uploadedPath) {
                const { data: signedData } = await supabase.storage
                  .from("story-images")
                  .createSignedUrl(uploadedPath, 3600);
                if (signedData?.signedUrl) {
                  resolvedUrls.push(signedData.signedUrl);
                  continue;
                }
              }
            }
          } catch (e) {
            console.warn("Could not resolve blob avatar URL", e);
          }
        }
      }

      const avatarsForEdge = resolvedUrls.map(url => {
        const match = characterAvatars.find(a => a.imageUrl === url);
        return { name: match?.name || "Avatar", url, features: "" };
      });

      const { data, error } = await supabase.functions.invoke("generate-images", {
        body: {
          scenes: [{ ...scene, description: frame.prompt }],
          characters: [],
          objectAssets: [],
          artStyle,
          imageFormat,
          characterAvatars: avatarsForEdge.length > 0 ? avatarsForEdge : undefined,
        },
      });

      if (error) {
        // Check for 422 content filter error
        const errorBody = error?.message || "";
        if (errorBody.includes("content_filtered") || errorBody.includes("422")) {
          updateFrameState(sceneId, {
            generating: false,
            error: language === "tr"
              ? "İçerik güvenlik filtresine takıldı. Prompt'u düzenleyip tekrar deneyin."
              : "Content was flagged by safety filter. Edit the prompt and try again.",
          });
          return;
        }
        throw error;
      }

      if (data?.error === "content_filtered") {
        updateFrameState(sceneId, {
          generating: false,
          error: data.message || (language === "tr"
            ? "İçerik güvenlik filtresine takıldı. Prompt'u düzenleyip tekrar deneyin."
            : "Content was flagged by safety filter. Edit the prompt and try again."),
        });
        return;
      }

      const imageUrl = data?.images?.[0]?.imageUrl || "";
      updateFrameState(sceneId, { imageUrl, generating: false, error: null });

      // Update store images
      const existingImg = images.find(im => im.sceneId === sceneId);
      if (existingImg) {
        updateImage(sceneId, { imageUrl, generating: false });
      } else {
        setImages([...images, {
          sceneId, imageUrl, approved: false, generating: false, textOverlays: [], duration: 3,
        }]);
      }

      await debitCredits(
        IMAGE_COST,
        `Image generation - ${language === "tr" ? "Kare" : "Scene"} ${scene.number}`,
      );

      // Persist frame to DB
      if (imageUrl) {
        saveFrameToDB(sceneId, imageUrl).catch(e => console.error("Frame save error:", e));
      }
    } catch (err: any) {
      console.error("Image generation error:", err);
      updateFrameState(sceneId, {
        generating: false,
        error: err?.message || (language === "tr" ? "Görsel oluşturulamadı" : "Failed to generate image"),
      });
    }
  };

  // Generate all remaining images (skip already generated ones)
  const generateAllImages = async () => {
    for (const scene of scenes) {
      // Check both frameStates and images store for existing image
      const frameHasImage = frameStates[scene.id]?.imageUrl;
      const storeHasImage = images.find(im => im.sceneId === scene.id)?.imageUrl;
      
      if (!frameHasImage && !storeHasImage) {
        await generateFrameImage(scene.id);
        // Re-check after generation to ensure we have latest state
      }
    }
  };

  const allImagesGenerated = scenes.length > 0 && scenes.every(s => frameStates[s.id]?.imageUrl);

  // Generate video for a single frame
  const generateSingleFrameVideo = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    const imgUrl = frameStates[sceneId]?.imageUrl;
    if (!scene || !imgUrl || !user) return;

    const vs = frameVideoSettings[sceneId];
    if (!vs) return;

    const cost = getVideoCost(vs.resolution, vs.duration, vs.model);
    if (!isUnlimited && credits < cost) {
      setCreditRequiredAmount(cost);
      setShowCreditDialog(true);
      return;
    }

    const fullPrompt = buildFullVideoPrompt(vs);
    const aspectRatio = getAspectRatio(imageFormat);
    const videoModel = vs.model || "wan";

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-video", {
        body: {
          action: "submit",
          imageUrl: imgUrl,
          prompt: fullPrompt,
          duration: Number(vs.duration),
          aspect_ratio: aspectRatio,
          resolution: vs.resolution,
          camera_fixed: vs.cameraFixed,
          generate_audio: vs.generateAudio,
          model: videoModel,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await debitCredits(cost, `Video: ${vs.resolution}, ${vs.duration}s - ${language === "tr" ? "Kare" : "Scene"} ${scene.number}`);

      const job: AIVideoJob = {
        sceneId,
        model: videoModel,
        requestId: data.requestId,
        status: "queued",
        statusUrl: data.statusUrl,
        responseUrl: data.responseUrl,
      };
      setVideoJobs(prev => [...prev, job]);
      setSelectedVideoIdx(prev => ({ ...prev, [sceneId]: 0 }));
      startPolling(job);
      toast.success(language === "tr" ? `Kare ${scene.number} video oluşturuluyor...` : `Scene ${scene.number} video generating...`);
    } catch (err: any) {
      console.error(`Video submit error for scene ${scene.number}:`, err);
      toast.error(err?.message || (language === "tr" ? "Video oluşturulamadı" : "Video generation failed"));
    }
  };

  // ---- Video generation (all frames) ----
  const generateAIVideos = async () => {
    if (!allImagesGenerated) {
      toast.error(language === "tr" ? "Önce tüm görselleri oluşturun" : "Generate all images first");
      return;
    }
    if (!user) {
      toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in");
      return;
    }

    const totalCost = scenes.reduce((sum, scene) => {
      const vs = frameVideoSettings[scene.id] || { resolution: "720p", duration: "5", model: "seedance" as const };
      return sum + getVideoCost(vs.resolution, vs.duration, vs.model || "seedance");
    }, 0);
    if (credits < totalCost) {
      setCreditRequiredAmount(totalCost);
      setShowCreditDialog(true);
      return;
    }
    setIsGeneratingVideo(true);
    setVideoProgress(0);
    const jobs: AIVideoJob[] = [];
    const aspectRatio = getAspectRatio(imageFormat);
    let totalDeducted = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imgUrl = frameStates[scene.id]?.imageUrl;
      if (!imgUrl) continue;

      const vs = frameVideoSettings[scene.id] || { prompt: extractCoreAction(scene.description), duration: "5", resolution: "720p", cameraFixed: false, generateAudio: true, dialogues: [], model: "seedance" as const };
      const videoModel = vs.model || "wan";
      const fullPrompt = buildFullVideoPrompt(vs);

      try {
        const { data, error } = await supabase.functions.invoke("generate-ai-video", {
          body: {
            action: "submit",
            imageUrl: imgUrl,
            prompt: fullPrompt,
            duration: Number(vs.duration),
            aspect_ratio: aspectRatio,
            resolution: vs.resolution,
            camera_fixed: vs.cameraFixed,
            generate_audio: vs.generateAudio,
            model: videoModel,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const sceneCost = getVideoCost(vs.resolution, vs.duration, videoModel);
        totalDeducted += sceneCost;
        const job: AIVideoJob = {
          sceneId: scene.id,
          model: videoModel,
          requestId: data.requestId,
          status: "queued",
          statusUrl: data.statusUrl,
          responseUrl: data.responseUrl,
        };
        jobs.push(job);
        startPolling(job);

        await supabase.from("user_credits").update({ credits: credits - totalDeducted }).eq("user_id", user!.id);
        await supabase.from("credit_transactions").insert({
          user_id: user!.id,
          amount: sceneCost,
          type: "debit",
          description: `Video: ${vs.resolution}, ${vs.duration}s - ${language === "tr" ? "Kare" : "Scene"} ${scene.number}`,
        });
      } catch (err: any) {
        console.error(`Video submit error for scene ${scene.number}:`, err);
        jobs.push({ sceneId: scene.id, model: vs.model || "wan", requestId: "", status: "failed", error: err?.message || "Submit failed" });
      }
      setVideoProgress(Math.round(((i + 1) / scenes.length) * 100));
    }

    setVideoJobs(prev => [...prev, ...jobs]);
    refetchCredits();
    if (jobs.every(j => j.status === "failed")) setIsGeneratingVideo(false);
  };

  const startPolling = (job: AIVideoJob) => {
    pollCountRef.current[job.requestId] = 0;
    consecutiveErrorsRef.current[job.requestId] = 0;

    const interval = setInterval(async () => {
      pollCountRef.current[job.requestId] = (pollCountRef.current[job.requestId] || 0) + 1;

      if (pollCountRef.current[job.requestId] > MAX_POLLS) {
        clearInterval(interval);
        delete pollingRef.current[job.requestId];
        setVideoJobs(prev => prev.map(j => j.requestId === job.requestId ? { ...j, status: "failed", error: "Timeout" } : j));
        checkAllDone();
        return;
      }

      try {
        const { data } = await supabase.functions.invoke("generate-ai-video", {
          body: { action: "status", requestId: job.requestId, statusUrl: job.statusUrl, model: job.model },
        });
        consecutiveErrorsRef.current[job.requestId] = 0;

        if (data?.status === "COMPLETED") {
          clearInterval(interval);
          delete pollingRef.current[job.requestId];
          const { data: resultData } = await supabase.functions.invoke("generate-ai-video", {
            body: { action: "result", requestId: job.requestId, responseUrl: job.responseUrl, model: job.model },
          });
          const videoUrl = resultData?.videoUrl;
          setVideoJobs(prev => prev.map(j => j.requestId === job.requestId ? { ...j, status: "completed", videoUrl } : j));
          // Save video to DB
          if (videoUrl) {
            const matchedJob = job;
            saveVideoToDB(videoUrl, matchedJob.sceneId).catch(e => console.error("Video save error:", e));
          }
          checkAllDone();
        } else if (data?.status === "FAILED" || data?.status === "CANCELLED") {
          clearInterval(interval);
          delete pollingRef.current[job.requestId];
          setVideoJobs(prev => prev.map(j => j.requestId === job.requestId ? { ...j, status: "failed", error: "Generation failed" } : j));
          checkAllDone();
        } else {
          setVideoJobs(prev => prev.map(j => j.requestId === job.requestId ? { ...j, status: "processing" } : j));
        }
      } catch (err) {
        console.error("Polling error:", err);
        consecutiveErrorsRef.current[job.requestId] = (consecutiveErrorsRef.current[job.requestId] || 0) + 1;
        if (consecutiveErrorsRef.current[job.requestId] >= 3) {
          clearInterval(interval);
          delete pollingRef.current[job.requestId];
          setVideoJobs(prev => prev.map(j => j.requestId === job.requestId ? { ...j, status: "failed", error: "Too many polling errors" } : j));
          checkAllDone();
        }
      }
    }, 5000);

    pollingRef.current[job.requestId] = interval;
  };

  const checkAllDone = () => {
    setVideoJobs(prev => {
      const allDone = prev.every(j => j.status === "completed" || j.status === "failed");
      if (allDone) {
        setIsGeneratingVideo(false);
        const completed = prev.filter(j => j.status === "completed");
        if (completed.length > 0) {
          toast.success(language === "tr" ? `${completed.length} video oluşturuldu!` : `${completed.length} videos generated!`);
        }
      }
      return prev;
    });
  };

  const avatarNameByUrl = new Map<string, string>([
    ...characterAvatars.map(a => [a.imageUrl, a.name] as const),
    ...savedChars.map(c => [c.image_url, c.name] as const),
  ]);

  // Save all edits (dialogues, descriptions) back to store scenes and DB
  const persistAllEdits = useCallback(async () => {
    // Sync frameVideoSettings dialogues back to store scenes
    for (const scene of scenes) {
      const vs = frameVideoSettings[scene.id];
      if (vs) {
        const updatedDialogues = (vs.dialogues || []).map(d => ({ character: d.character, text: d.text }));
        updateScene(scene.id, { dialogues: updatedDialogues });
      }
    }
    // Save all frames to DB
    if (!user) return;
    const projectId = await ensureProjectSaved();
    if (!projectId) return;
    for (const scene of scenes) {
      const vs = frameVideoSettings[scene.id];
      const frame = frameStates[scene.id];
      const imagePath = frame?.imageUrl || "";
      try {
        const dialogues = vs?.dialogues?.map(d => ({ character: d.character, text: d.text })) || scene.dialogues;
        await (supabase.from("project_frames") as any).upsert({
          project_id: projectId,
          frame_number: scene.number,
          scene_description: scene.description,
          image_path: imagePath,
          dialogues,
          shot_breakdown: scene.shot_breakdown || null,
        }, { onConflict: "project_id,frame_number" });
      } catch (e) {
        console.error("Failed to persist frame edits:", e);
      }
    }
  }, [scenes, frameVideoSettings, frameStates, user, currentProjectId]);

  const setAnimMergeData = useAppStore((s) => s.setAnimMergeData);

  const navigateToVideoPreview = useCallback(async () => {
    await persistAllEdits();

    const orderedVideoUrls = scenes
      .sort((a, b) => a.number - b.number)
      .map(s => {
        const completedJobs = videoJobs.filter(j => j.sceneId === s.id && j.status === "completed" && j.videoUrl);
        if (completedJobs.length === 0) return undefined;
        const idx = selectedVideoIdx[s.id] ?? completedJobs.length - 1;
        const safeIdx = Math.min(Math.max(0, idx), completedJobs.length - 1);
        return completedJobs[safeIdx]?.videoUrl;
      })
      .filter(Boolean) as string[];

    const editedScenes = scenes
      .sort((a, b) => a.number - b.number)
      .map(s => {
        const vs = frameVideoSettings[s.id];
        if (vs?.dialogues?.length) {
          return { ...s, dialogues: vs.dialogues.map(d => ({ character: d.character, text: d.text })) };
        }
        return s;
      });

    setAnimMergeData({
      videoUrls: orderedVideoUrls,
      musicUrl,
      musicVolume,
      subtitleOptions,
      subtitlesEnabled,
      editedScenes,
    });
    setStep(4);
  }, [persistAllEdits, scenes, videoJobs, selectedVideoIdx, frameVideoSettings, musicUrl, musicVolume, subtitleOptions, subtitlesEnabled, setAnimMergeData, setStep]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{language === "tr" ? "Sesli Animasyon Editörü" : "Voice Animation Editor"}</h2>
        <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-4 w-4" />{language === "tr" ? "Taslağa Dön" : "Back to Draft"}</Button>
      </div>

      {/* Per-frame image editor - 2 column grid */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold">{language === "tr" ? "Kare Görselleri" : "Frame Images"}</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenes.map((scene) => {
            const frame = frameStates[scene.id];
            if (!frame) return null;
            return (
              <Card key={scene.id}>
                <CardContent className="p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">{language === "tr" ? "Kare" : "Scene"} {scene.number}</Badge>
                    <div className="flex items-center gap-1">
                      {frame.imageUrl && <Badge variant="outline" className="text-xs text-green-600"><CheckCircle className="mr-1 h-3 w-3" />{language === "tr" ? "Hazır" : "Ready"}</Badge>}
                      {scenes.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeScene(scene.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Character appearances for this frame */}
                  {characterAvatars.length > 0 && (
                    <div className="text-[9px] text-muted-foreground bg-muted/40 rounded p-1.5 space-y-0.5">
                      <span className="font-semibold text-[9px]">{language === "tr" ? "Karakterler:" : "Characters:"}</span>
                      {characterAvatars
                        .filter(a => {
                          const name = (a.name || "").toLowerCase();
                          const desc = (scene.description || "").toLowerCase();
                          const hasSpeaker = scene.dialogues.some(d => (d.character || "").toLowerCase() === name);
                          return desc.includes(name) || hasSpeaker;
                        })
                        .map((a, i) => (
                          <div key={i} className="flex gap-1">
                            <span className="font-medium">{a.name}</span>
                            {a.features && <span className="opacity-70">- {a.features}</span>}
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* Dialogues summary */}
                  <div className="text-[10px] text-muted-foreground space-y-0.5 max-h-12 overflow-y-auto">
                    {scene.dialogues.filter(d => d.character || d.text).map((d, i) => (
                      <div key={i} className="flex gap-1">
                        <span className="font-medium">{d.character || "?"}:</span>
                        <span className="truncate">{d.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Editable prompt */}
                  <Textarea
                    value={frame.prompt}
                    onChange={(e) => updateFrameState(scene.id, { prompt: e.target.value })}
                    rows={2}
                    className="text-xs resize-none"
                    placeholder={language === "tr" ? "Sahne açıklaması..." : "Scene description..."}
                  />

                  {/* Avatar references */}
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Referans Avatarlar" : "Reference Avatars"}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {frame.avatarUrls.map((url, idx) => {
                        const avatarName = avatarNameByUrl.get(url) || "Avatar";
                        return (
                          <div key={idx} className="relative group">
                            <img src={url} alt={avatarName} className="h-10 w-10 rounded-md object-cover border" />
                            <span className="text-[8px] text-center block truncate w-10">{avatarName}</span>
                            <button
                              onClick={() => removeAvatarFromFrame(scene.id, idx)}
                              className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-2 w-2" />
                            </button>
                          </div>
                        );
                      })}

                      <Popover open={avatarPopoverSceneId === scene.id} onOpenChange={(open) => setAvatarPopoverSceneId(open ? scene.id : null)}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 border-dashed">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-44 p-2" align="start">
                          <div className="flex flex-col gap-1">
                            {/* Add previous image option (not for first frame) */}
                            {(() => {
                              const sceneIdx = scenes.findIndex(s => s.id === scene.id);
                              if (sceneIdx > 0) {
                                const prevScene = scenes[sceneIdx - 1];
                                const prevFrame = frameStates[prevScene.id];
                                if (prevFrame?.imageUrl) {
                                  return (
                                    <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={() => {
                                      addAvatarToFrame(scene.id, prevFrame.imageUrl);
                                      setAvatarPopoverSceneId(null);
                                    }}>
                                      <Image className="mr-2 h-3.5 w-3.5" />
                                      {language === "tr" ? "Önceki Görseli Ekle" : "Add Previous Image"}
                                    </Button>
                                  );
                                }
                              }
                              return null;
                            })()}
                            <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={() => openHistorySelection(scene.id)}>
                              <History className="mr-2 h-3.5 w-3.5" />
                              {language === "tr" ? "Geçmişten Yükle" : "Load from History"}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={() => openComputerUpload(scene.id)}>
                              <Upload className="mr-2 h-3.5 w-3.5" />
                              {language === "tr" ? "Bilgisayardan Yükle" : "Upload from Computer"}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={() => pasteFromClipboard(scene.id)}>
                              <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
                              {language === "tr" ? "Panodan Yapıştır" : "Paste from Clipboard"}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Error display */}
                  {frame.error && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[10px] text-destructive">{frame.error}</p>
                    </div>
                  )}

                  {/* Generated image preview */}
                  {frame.imageUrl && (
                    <div 
                      className="rounded-md overflow-hidden border"
                      style={{
                        aspectRatio: imageFormat === "mobile" ? "9/16" : imageFormat === "desktop" ? "16/9" : "1/1",
                      }}
                    >
                      <img src={frame.imageUrl} alt={`Scene ${scene.number}`} className="w-full h-full object-cover bg-muted" />
                    </div>
                  )}

                  {/* Generate button */}
                  <Button
                    onClick={() => generateFrameImage(scene.id)}
                    disabled={frame.generating || !frame.prompt.trim()}
                    size="sm"
                    variant={frame.imageUrl ? "outline" : "default"}
                    className="w-full h-8 text-xs"
                  >
                    {frame.generating ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" />{language === "tr" ? "Oluşturuluyor..." : "Generating..."}</>
                    ) : (
                      <><Image className="mr-1 h-3 w-3" />{language === "tr" ? (frame.imageUrl ? "Yeniden Oluştur" : "Görsel Oluştur") : (frame.imageUrl ? "Regenerate" : "Generate")}</>
                    )}
                  </Button>

                  {/* Per-frame video settings */}
                  {frame.imageUrl && frameVideoSettings[scene.id] && (() => {
                    const vs = frameVideoSettings[scene.id];
                    const sceneJobs = videoJobs.filter(j => j.sceneId === scene.id);
                    const sceneJob = sceneJobs[sceneJobs.length - 1];
                    return (
                    <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Video className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-semibold">{language === "tr" ? "Video Ayarları" : "Video Settings"}</span>
                        {sceneJob?.status === "completed" && <Badge variant="outline" className="text-[9px] text-green-600"><CheckCircle className="mr-1 h-2.5 w-2.5" />{language === "tr" ? "Video Hazır" : "Video Ready"}</Badge>}
                        {(sceneJob?.status === "queued" || sceneJob?.status === "processing") && <Badge variant="outline" className="text-[9px]"><Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />{language === "tr" ? "İşleniyor" : "Processing"}</Badge>}
                      </div>

                      {/* Video prompt - single sentence */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Video Prompt" : "Video Prompt"}</Label>
                        <Textarea
                          value={vs.prompt}
                          onChange={(e) => setFrameVideoSettings(p => ({ ...p, [scene.id]: { ...p[scene.id], prompt: e.target.value } }))}
                          placeholder={language === "tr" ? "Sahne açıklaması..." : "Scene description..."}
                          rows={2}
                          className="text-xs min-h-[40px]"
                        />
                      </div>

                      {/* Character dialogues */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Karakter Diyalogları" : "Character Dialogues"}</Label>
                          <Button type="button" variant="ghost" size="sm" className="h-5 px-1.5 text-[9px]" onClick={() => addVideoDialogue(scene.id)}>
                            <Plus className="h-2.5 w-2.5 mr-0.5" />{language === "tr" ? "Ekle" : "Add"}
                          </Button>
                        </div>
                        {(vs.dialogues || []).map((d, dIdx) => (
                          <div key={dIdx} className="flex gap-1.5 items-start group">
                            <input
                              value={d.character}
                              onChange={(e) => updateVideoDialogue(scene.id, dIdx, { character: e.target.value })}
                              className="w-16 shrink-0 rounded-md border border-input bg-background px-1.5 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              placeholder={language === "tr" ? "Karakter" : "Character"}
                            />
            <textarea
                              value={d.text}
                              onChange={(e) => {
                                updateVideoDialogue(scene.id, dIdx, { text: e.target.value });
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                              }}
                              ref={(el) => {
                                if (el) {
                                  el.style.height = 'auto';
                                  el.style.height = el.scrollHeight + 'px';
                                }
                              }}
                              className="flex w-full rounded-md border border-input bg-background px-1.5 py-1 text-[10px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 resize-none overflow-hidden"
                              rows={1}
                              placeholder={language === "tr" ? "Diyalog metni..." : "Dialogue text..."}
                            />
                            <button
                              type="button"
                              onClick={() => removeVideoDialogue(scene.id, dIdx)}
                              className="shrink-0 mt-1 h-4 w-4 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">AI Model</Label>
                        <Select value={vs.model || "seedance"} onValueChange={(v) => {
                          const newModel = v as "seedance" | "wan" | "grok" | "ltx";
                          const newDurations = newModel === "ltx" ? DURATIONS_LTX : newModel === "grok" ? DURATIONS_GROK : newModel === "wan" ? DURATIONS_WAN : DURATIONS_SEEDANCE;
                          const newResolutions = newModel === "ltx" ? RESOLUTIONS_LTX : newModel === "grok" ? RESOLUTIONS_GROK : newModel === "wan" ? RESOLUTIONS_WAN : RESOLUTIONS_SEEDANCE;
                          const newDuration = newDurations.includes(vs.duration) ? vs.duration : newDurations[Math.min(4, newDurations.length - 1)];
                          const newResolution = newResolutions.includes(vs.resolution) ? vs.resolution : newResolutions[newResolutions.length - 1];
                          setFrameVideoSettings(p => ({ ...p, [scene.id]: { ...p[scene.id], model: newModel, duration: newDuration, resolution: newResolution } }));
                        }}>
                          <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {storyLanguage !== "tr" && (
                              <SelectItem value="seedance" className="text-xs">
                                Storilyne V2 ({MODEL_DESCRIPTIONS.seedance[language]})
                              </SelectItem>
                            )}
                            <SelectItem value="wan" className="text-xs">
                              Storilyne V4 ({MODEL_DESCRIPTIONS.wan[language]})
                            </SelectItem>
                            <SelectItem value="grok" className="text-xs">
                              Storilyne V3 ({MODEL_DESCRIPTIONS.grok[language]})
                            </SelectItem>
                            <SelectItem value="ltx" className="text-xs">
                              Storilyne V1 ({MODEL_DESCRIPTIONS.ltx[language]})
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Süre" : "Duration"}</Label>
                          <Select value={vs.duration} onValueChange={(v) => setFrameVideoSettings(p => ({ ...p, [scene.id]: { ...p[scene.id], duration: v } }))}>
                            <SelectTrigger className="h-7 text-[10px]"><SelectValue placeholder="5s" /></SelectTrigger>
                            <SelectContent>
                              {((vs.model || "seedance") === "ltx" ? DURATIONS_LTX : (vs.model || "seedance") === "grok" ? DURATIONS_GROK : (vs.model || "seedance") === "wan" ? DURATIONS_WAN : DURATIONS_SEEDANCE).map(d => (
                                <SelectItem key={d} value={d} className="text-xs">{`${d}s`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Çözünürlük" : "Resolution"}</Label>
                          <Select value={vs.resolution} onValueChange={(v) => setFrameVideoSettings(p => ({ ...p, [scene.id]: { ...p[scene.id], resolution: v } }))}>
                            <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {((vs.model || "seedance") === "ltx" ? RESOLUTIONS_LTX : (vs.model || "seedance") === "grok" ? RESOLUTIONS_GROK : (vs.model || "seedance") === "wan" ? RESOLUTIONS_WAN : RESOLUTIONS_SEEDANCE).map(r => (
                                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px]">{language === "tr" ? "Sabit Kamera" : "Camera Fixed"}</Label>
                        <Switch checked={vs.cameraFixed} onCheckedChange={(v) => setFrameVideoSettings(p => ({ ...p, [scene.id]: { ...p[scene.id], cameraFixed: v } }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px]">{language === "tr" ? "Ses Oluştur" : "Generate Audio"}</Label>
                        <Switch checked={vs.generateAudio} onCheckedChange={(v) => setFrameVideoSettings(p => ({ ...p, [scene.id]: { ...p[scene.id], generateAudio: v } }))} />
                      </div>

                      {/* Per-frame video generate button */}
                      <Button
                        onClick={() => generateSingleFrameVideo(scene.id)}
                        disabled={!!(sceneJob?.status === "queued" || sceneJob?.status === "processing")}
                        size="sm"
                        className="w-full h-7 text-xs"
                      >
                        {(sceneJob?.status === "queued" || sceneJob?.status === "processing") ? (
                          <><Loader2 className="mr-1 h-3 w-3 animate-spin" />{language === "tr" ? "İşleniyor..." : "Processing..."}</>
                        ) : (
                          <><Video className="mr-1 h-3 w-3" />{language === "tr" ? "Video Oluştur" : "Generate Video"}</>
                        )}
                      </Button>

                      {/* Show completed video */}
                      {(() => {
                        const allCompletedJobs = videoJobs.filter(j => j.sceneId === scene.id && j.status === "completed" && j.videoUrl);
                        if (allCompletedJobs.length === 0) return null;
                        const currentIdx = selectedVideoIdx[scene.id] ?? allCompletedJobs.length - 1;
                        const safeIdx = Math.min(Math.max(0, currentIdx), allCompletedJobs.length - 1);
                        const currentJob = allCompletedJobs[safeIdx];
                        return (
                          <div className="space-y-1">
                            {allCompletedJobs.length > 1 && (
                              <div className="flex items-center justify-center gap-2">
                                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={safeIdx <= 0}
                                  onClick={() => setSelectedVideoIdx(p => ({ ...p, [scene.id]: safeIdx - 1 }))}>
                                  <ArrowLeft className="h-3 w-3" />
                                </Button>
                                <span className="text-[10px] text-muted-foreground">{safeIdx + 1} / {allCompletedJobs.length}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={safeIdx >= allCompletedJobs.length - 1}
                                  onClick={() => setSelectedVideoIdx(p => ({ ...p, [scene.id]: safeIdx + 1 }))}>
                                  <ArrowLeft className="h-3 w-3 rotate-180" />
                                </Button>
                              </div>
                            )}
                            <div className="rounded-md overflow-hidden border">
                              <video key={currentJob?.videoUrl} src={currentJob?.videoUrl} controls className="w-full" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add new frame button */}
        <Button type="button" variant="outline" className="w-full" onClick={addScene}>
          <Plus className="mr-2 h-4 w-4" />
          {language === "tr" ? "Yeni Kare Ekle" : "Add New Frame"}
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleAvatarFileChange}
        multiple
      />

      <Dialog open={!!historySceneId} onOpenChange={(open) => { if (!open) setHistorySceneId(null); }}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "tr" ? "Karakter Geçmişi" : "Character History"}</DialogTitle>
          </DialogHeader>

          {loadingSavedChars ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : savedChars.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {language === "tr" ? "Kayıtlı karakter bulunamadı" : "No saved characters found"}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {savedChars.map((char) => {
                  const isSelected = selectedSavedCharIds.has(char.id);
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => toggleSavedCharacter(char.id)}
                      className={`rounded-lg border p-2 text-left transition-colors ${isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                    >
                      <div className="aspect-square rounded-md overflow-hidden bg-muted mb-1">
                        <img src={char.image_url} alt={char.name} className="h-full w-full object-cover" />
                      </div>
                      <p className="text-xs font-medium truncate">{char.name}</p>
                    </button>
                  );
                })}
              </div>
              <Button className="w-full mt-2" onClick={addSelectedHistoryAvatars} disabled={selectedSavedCharIds.size === 0}>
                {language === "tr" ? `${selectedSavedCharIds.size} karakter ekle` : `Add ${selectedSavedCharIds.size} character(s)`}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>



      {/* Bottom button: Generate Images OR Devam (Continue) */}
      {!allImagesGenerated && (
        <Button onClick={generateAllImages} className="w-full" size="lg">
          <Image className="mr-2 h-4 w-4" />
          {language === "tr" ? "Görselleri Oluştur" : "Generate Images"}
        </Button>
      )}

      {allImagesGenerated && (() => {
        const allVideosReady = scenes.length > 0 && scenes.every(s => videoJobs.find(j => j.sceneId === s.id && j.status === "completed"));
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Switch
                id="subtitles-toggle-va"
                checked={subtitlesEnabled}
                onCheckedChange={setSubtitlesEnabled}
              />
              <Label htmlFor="subtitles-toggle-va" className="text-sm cursor-pointer">
                {language === "tr" ? "Alt yazıları ekle" : "Add subtitles"}
              </Label>
              {subtitlesEnabled && (
                <SubtitleSettings
                  options={subtitleOptions}
                  onChange={setSubtitleOptions}
                  language={language}
                />
            )}
            </div>
            <AIMusicGenerator
              language={language}
              storyTopic={storyTopic}
              onMusicGenerated={(url) => setMusicUrl(url)}
              onMusicRemoved={() => setMusicUrl(null)}
              generatedMusicUrl={musicUrl}
              onMusicEnabledChange={setMusicEnabled}
              musicEnabled={musicEnabled}
              onVolumeChange={setMusicVolume}
              volume={musicVolume}
              onCreditDebit={async (amount, desc) => { await debitCredits(amount, desc); }}
            />
            <div className="relative group">
              <Button
                onClick={() => allVideosReady && navigateToVideoPreview()}
                className={`w-full ${!allVideosReady ? 'opacity-50' : ''}`}
                size="lg"
                disabled={!allVideosReady}
              >
                {language === "tr" ? "Devam" : "Continue"}
              </Button>
              {!allVideosReady && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {language === "tr" ? "Tüm karelerin videoları üretilmeli" : "All frame videos must be generated"}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Video Progress */}
      {isGeneratingVideo && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <Label className="text-xs">{language === "tr" ? "AI videolar oluşturuluyor..." : "Generating AI videos..."}</Label>
          </div>
          <Progress value={videoProgress} className="h-2" />
        </div>
      )}

      {/* Video Job Status */}
      {videoJobs.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <Label className="text-xs font-semibold">{language === "tr" ? "Video Üretim Durumu" : "Video Generation Status"}</Label>
          {videoJobs.map((job, idx) => {
            const scene = scenes.find(s => s.id === job.sceneId);
            return (
              <div key={idx} className="flex items-center gap-2">
                <Badge variant="secondary" className="shrink-0 text-[9px]">K{scene?.number || idx + 1}</Badge>
                {(job.status === "queued" || job.status === "processing") && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                {job.status === "completed" && <CheckCircle className="h-3 w-3 text-green-500" />}
                {job.status === "failed" && <XCircle className="h-3 w-3 text-destructive" />}
                <span className="text-xs text-muted-foreground flex-1">
                  {job.status === "queued" && (language === "tr" ? "Sırada..." : "Queued...")}
                  {job.status === "processing" && (language === "tr" ? "İşleniyor..." : "Processing...")}
                  {job.status === "completed" && (language === "tr" ? "Tamamlandı" : "Completed")}
                  {job.status === "failed" && (job.error || (language === "tr" ? "Başarısız" : "Failed"))}
                </span>
                {job.videoUrl && (
                  <Button size="sm" variant="ghost" className="h-6 p-1" asChild>
                    <a href={job.videoUrl} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /></a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Video Preview */}
      {videoJobs.some(j => j.videoUrl) && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold">{language === "tr" ? "Video Önizleme" : "Video Preview"}</Label>
          <div className="rounded-lg border overflow-hidden bg-muted">
            {videoJobs.filter(j => j.videoUrl).sort((a, b) => {
              const aS = scenes.find(s => s.id === a.sceneId);
              const bS = scenes.find(s => s.id === b.sceneId);
              return (aS?.number || 0) - (bS?.number || 0);
            }).map((job, idx) => {
              const scene = scenes.find(s => s.id === job.sceneId);
              return (
                <div key={idx}>
                  <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center justify-between">
                    <span className="text-xs font-medium">{language === "tr" ? "Kare" : "Scene"} {scene?.number || idx + 1}</span>
                    <Button size="sm" variant="ghost" className="h-6 p-1" asChild>
                      <a href={job.videoUrl} target="_blank" rel="noopener noreferrer" download><Download className="h-3 w-3" /></a>
                    </Button>
                  </div>
                  <video key={job.videoUrl} src={job.videoUrl} controls className="w-full" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <CreditExhaustedDialog
        open={showCreditDialog}
        onOpenChange={setShowCreditDialog}
        language={language}
        requiredAmount={creditRequiredAmount}
      />
    </div>
  );
}
