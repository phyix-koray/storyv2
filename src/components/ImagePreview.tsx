import { useState, useRef, useCallback, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { getSignedUrl, uploadStoryImage } from "@/lib/projectStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Clock, Edit3, FlipHorizontal, FlipVertical, Loader2, MessageCircle, Plus, RefreshCw, Send, Trash2, Type, Upload, History, ImagePlus, Video, Image, CheckCircle, XCircle, Users, X, Wand2, Volume2, Play, Pause, AudioLines, Move, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { getVideoCost } from "@/lib/videoPricing";
import type { TextOverlay, GeneratedImage, AIVideoModel, AIVideoJob } from "@/lib/types";

const VIDEO_DURATIONS = ["default", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"];

function getAspectRatio(imageFormat: string): string {
  switch (imageFormat) {
    case "mobile": return "9:16";
    case "desktop": return "16:9";
    default: return "1:1";
  }
}

const MAX_POLLS = 60;

const PASTEL_COLORS = [
  "rgba(255, 218, 218, 0.95)", // pink
  "rgba(218, 234, 255, 0.95)", // blue
  "rgba(218, 255, 224, 0.95)", // green
  "rgba(255, 243, 218, 0.95)", // yellow
  "rgba(234, 218, 255, 0.95)", // purple
  "rgba(255, 218, 245, 0.95)", // magenta
  "rgba(218, 255, 250, 0.95)", // cyan
  "rgba(255, 232, 218, 0.95)", // orange
];
const PASTEL_BORDERS = [
  "rgba(255, 180, 180, 1)",
  "rgba(180, 200, 255, 1)",
  "rgba(180, 230, 190, 1)",
  "rgba(240, 220, 170, 1)",
  "rgba(200, 180, 255, 1)",
  "rgba(255, 180, 230, 1)",
  "rgba(180, 240, 235, 1)",
  "rgba(240, 200, 170, 1)",
];

// Reference image type for per-frame management
interface FrameReference {
  id: string;
  name: string;
  url: string; // base64 or http URL
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}
function SceneDescriptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > 120;
  return (
    <p
      className={`text-xs text-muted-foreground cursor-pointer ${!expanded && isLong ? "line-clamp-2" : ""}`}
      onClick={() => isLong && setExpanded(!expanded)}
      title={isLong ? (expanded ? "" : text) : undefined}
    >
      {text}
    </p>
  );
}

export function ImagePreview() {
  const {
    language, images, scenes, updateImage, removeImage, removeScene, setStep,
    characters, storyTopic, storyLanguage, imageFormat, currentProjectId,
    addScene, setImages, storyMode, updateScene,
  } = useAppStore();
  const { user } = useAuth();
  const { credits, isUnlimited, plan, refetch: refetchCredits } = useCredits();
  const [revisionSceneId, setRevisionSceneId] = useState<string | null>(null);
  const [revisionText, setRevisionText] = useState("");
  const [revisionAvatarBase64, setRevisionAvatarBase64] = useState<string | null>(null);
  const [bulkDuration, setBulkDuration] = useState(3);
  const [animPromptDrafts, setAnimPromptDrafts] = useState<Record<string, string>>({});
  const [showAnimPrompt, setShowAnimPrompt] = useState<Record<string, boolean>>({});
  const [savedChars, setSavedChars] = useState<Array<{ id: string; name: string; image_url: string | null }>>([]);
  const [showSavedChars, setShowSavedChars] = useState(false);
  const [dragging, setDragging] = useState<{ sceneId: string; overlayId: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<{ sceneId: string; overlayId: string } | null>(null);
  const [bubbleCharPickerScene, setBubbleCharPickerScene] = useState<string | null>(null);
  const imageRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const [, forceUpdate] = useState(0);

  // Per-frame video generation state
  const [videoDuration, setVideoDuration] = useState<Record<string, string>>({});
  const [videoResolution, setVideoResolution] = useState<Record<string, string>>({});
  const [videoCameraFixed, setVideoCameraFixed] = useState<Record<string, boolean>>({});
  const [videoGenerateAudio, setVideoGenerateAudio] = useState<Record<string, boolean>>({});
  const [videoPrompt, setVideoPrompt] = useState<Record<string, string>>({});
  const [videoJobs, setVideoJobs] = useState<Record<string, AIVideoJob>>({});
  const pollingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pollCountRef = useRef<Record<string, number>>({});
  const consecutiveErrorsRef = useRef<Record<string, number>>({});
  const [frameView, setFrameView] = useState<Record<string, "image" | "video">>({});

  // Per-frame reference images
  const [frameReferences, setFrameReferences] = useState<Record<string, FrameReference[]>>({});
  const refFileInputRef = useRef<HTMLInputElement>(null);
  const [refUploadTarget, setRefUploadTarget] = useState<string | null>(null);

  // bgVocal-specific state
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [bgVoices, setBgVoices] = useState<ElevenLabsVoice[]>([]);
  const [loadingBgVoices, setLoadingBgVoices] = useState(false);
  const [selectedBgVoiceId, setSelectedBgVoiceId] = useState<string>(() => {
    try { return localStorage.getItem("bgVocal_voiceId") || ""; } catch { return ""; }
  });
  const [bgGenderFilter, setBgGenderFilter] = useState<"all" | "male" | "female">("all");
  const [bgSearchQuery, setBgSearchQuery] = useState("");
  const [bgPreviewPlaying, setBgPreviewPlaying] = useState<string | null>(null);
  const bgPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [frameTTSPlaying, setFrameTTSPlaying] = useState<string | null>(null);
  const frameTTSAudioRef = useRef<HTMLAudioElement | null>(null);

  // Build a GLOBAL character-to-color map across all scenes for consistent colors
  const globalCharColorMap: Record<string, number> = {};
  (() => {
    let colorIdx = 0;
    for (const scene of scenes) {
      for (const d of scene.dialogues) {
        const name = d.character || "";
        if (name && !(name in globalCharColorMap)) {
          globalCharColorMap[name] = colorIdx % PASTEL_COLORS.length;
          colorIdx++;
        }
      }
    }
    // Also include characters from overlays
    for (const img of images) {
      for (const o of img.textOverlays) {
        const name = o.character || "";
        if (name && !(name in globalCharColorMap)) {
          globalCharColorMap[name] = colorIdx % PASTEL_COLORS.length;
          colorIdx++;
        }
      }
    }
  })();

  // bgVocal animation state
  const [animationJobs, setAnimationJobs] = useState<Record<string, AIVideoJob>>({});
  const animPollingRef = useRef<Record<string, NodeJS.Timeout>>({});
  const animPollCountRef = useRef<Record<string, number>>({});
  const animConsecutiveErrorsRef = useRef<Record<string, number>>({});
  // Track which media to display per frame: 0 = original image, 1+ = animated video versions
  const [frameMediaIndex, setFrameMediaIndex] = useState<Record<string, number>>({});
  // Store animated video URLs per frame (can have multiple)
  const [frameAnimatedVideos, setFrameAnimatedVideos] = useState<Record<string, string[]>>({});

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
      Object.values(animPollingRef.current).forEach(clearInterval);
    };
  }, []);

  // Restore animation videos from store (loaded from History) or from DB
  useEffect(() => {
    const restoredAnims = useAppStore.getState().restoredAnimations;
    if (Object.keys(restoredAnims).length > 0) {
      const newAnimVideos: Record<string, string[]> = {};
      const newMediaIndex: Record<string, number> = {};
      for (const [frameNumStr, urls] of Object.entries(restoredAnims)) {
        const frameNum = parseInt(frameNumStr);
        const scene = scenes.find(s => s.number === frameNum);
        if (scene && urls.length > 0) {
          newAnimVideos[scene.id] = urls;
          newMediaIndex[scene.id] = 1;
        }
      }
      if (Object.keys(newAnimVideos).length > 0) {
        setFrameAnimatedVideos(prev => ({ ...prev, ...newAnimVideos }));
        setFrameMediaIndex(prev => ({ ...prev, ...newMediaIndex }));
        // Persist selection to store
        const selUpdates: Record<string, "image" | "video"> = {};
        for (const sceneId of Object.keys(newMediaIndex)) {
          selUpdates[sceneId] = newMediaIndex[sceneId] > 0 ? "video" : "image";
        }
        useAppStore.getState().setFrameMediaSelection({ ...useAppStore.getState().frameMediaSelection, ...selUpdates });
        useAppStore.getState().setRestoredAnimations({});
      }
      return;
    }

    // If no restored animations in store, load from DB (e.g. when navigating back from step 4)
    if (!currentProjectId || scenes.length === 0) return;
    (async () => {
      const { data } = await supabase.from("project_videos").select("*").eq("project_id", currentProjectId);
      if (!data) return;
      const newAnimVideos: Record<string, string[]> = {};
      const newMediaIndex: Record<string, number> = {};
      for (const v of data) {
        const fn = (v as any).frame_number as number;
        if (fn >= 1000 && v.video_url) {
          const realFrameNum = fn - 1000;
          const scene = scenes.find(s => s.number === realFrameNum);
          if (scene) {
            if (!newAnimVideos[scene.id]) newAnimVideos[scene.id] = [];
            newAnimVideos[scene.id].push(v.video_url);
            newMediaIndex[scene.id] = 1;
          }
        }
      }
      if (Object.keys(newAnimVideos).length > 0) {
        setFrameAnimatedVideos(prev => ({ ...prev, ...newAnimVideos }));
        setFrameMediaIndex(prev => ({ ...prev, ...newMediaIndex }));
      }
    })();
  }, [scenes.length, currentProjectId]);

  // Auto-initialize per-frame references from characters/avatars
  const charsKey = characters.map(c => `${c.id}:${c.role}:${c.imageUrl || c.previewUrl || ""}`).join(",");
  const avatarsKey = useAppStore.getState().characterAvatars.map(a => `${a.name}:${a.imageUrl}`).join(",");
  const objsKey = useAppStore.getState().objectAssets.map(o => `${o.id}:${o.imageUrl || ""}`).join(",");
  const scenesKey = scenes
    .map((s) => `${s.id}:${s.description}:${s.dialogues.map((d) => d.character).join("|")}`)
    .join("||");

  useEffect(() => {
    let cancelled = false;

    const resolveReferenceUrl = async (value: string) => {
      const url = (value || "").trim();
      if (!url) return "";
      if (url.startsWith("http") || url.startsWith("data:")) return url;
      const signed = await getSignedUrl(url);
      return signed || "";
    };

    const syncFrameReferences = async () => {
      const allAvatars = useAppStore.getState().characterAvatars;
      const allChars = characters;
      const allObjs = useAppStore.getState().objectAssets;

      const additionsByScene: Record<string, FrameReference[]> = {};

      for (const img of images) {
        const scene = scenes.find((s) => s.id === img.sceneId);
        if (!scene) continue;

        const sceneNames = getSceneCharacterNames(scene);
        const refs: FrameReference[] = [];
        const addedNameUrl = new Set<string>();
        // Track which character names have avatar images (to avoid adding form-uploaded duplicates)
        const avatarNames = new Set<string>();

        // 1) Avatar references (highest priority) - only if mentioned in scene
        for (const av of allAvatars) {
          const name = (av.name || "").trim();
          if (!name || !av.imageUrl) continue;
          if (!sceneNames.has(name.toLowerCase())) continue;

          const resolvedUrl = await resolveReferenceUrl(av.imageUrl);
          if (!resolvedUrl) continue;
          const key = `${name.toLowerCase()}|${resolvedUrl}`;
          if (addedNameUrl.has(key)) continue;
          addedNameUrl.add(key);
          avatarNames.add(name.toLowerCase());
          refs.push({ id: crypto.randomUUID(), name, url: resolvedUrl });
        }

        // 2) Uploaded character references - only if mentioned in scene and no avatar exists
        for (const ch of allChars) {
          const name = (ch.role || "").trim();
          const rawUrl = ch.imageUrl || ch.previewUrl || "";
          if (!rawUrl) continue;
          if (name && !sceneNames.has(name.toLowerCase())) continue;
          if (avatarNames.has(name.toLowerCase())) continue;

          const resolvedUrl = await resolveReferenceUrl(rawUrl);
          if (!resolvedUrl) continue;
          const key = `${name.toLowerCase()}|${resolvedUrl}`;
          if (addedNameUrl.has(key)) continue;
          addedNameUrl.add(key);
          refs.push({ id: crypto.randomUUID(), name: name || "Character", url: resolvedUrl });
        }

        // 3) Object asset references
        for (const obj of allObjs) {
          const rawUrl = obj.imageUrl || obj.previewUrl || "";
          if (!rawUrl) continue;
          const resolvedUrl = await resolveReferenceUrl(rawUrl);
          if (!resolvedUrl) continue;
          const key = `${(obj.description || "object").toLowerCase()}|${resolvedUrl}`;
          if (addedNameUrl.has(key)) continue;
          addedNameUrl.add(key);
          refs.push({ id: crypto.randomUUID(), name: obj.description || "Object", url: resolvedUrl });
        }

        if (refs.length > 0) additionsByScene[img.sceneId] = refs;
      }

      if (cancelled || Object.keys(additionsByScene).length === 0) return;

      // Replace (not merge) frame references to avoid stale entries
      setFrameReferences((prev) => {
        const next: Record<string, FrameReference[]> = {};

        for (const [sceneId, additions] of Object.entries(additionsByScene)) {
          // Keep any manually-added refs from prev that aren't auto-generated
          const prevRefs = prev[sceneId] || [];
          const autoKeys = new Set(additions.map(r => `${(r.name || "").trim().toLowerCase()}|${r.url}`));
          const manualRefs = prevRefs.filter(r => {
            const key = `${(r.name || "").trim().toLowerCase()}|${r.url}`;
            // It's manual if it wasn't in the new auto-generated set AND not already covered by auto
            return !autoKeys.has(key);
          });
          // Remove manual refs whose name matches an auto ref (means it was updated)
          const autoNames = new Set(additions.map(r => (r.name || "").trim().toLowerCase()));
          const filteredManual = manualRefs.filter(r => !autoNames.has((r.name || "").trim().toLowerCase()));
          next[sceneId] = [...additions, ...filteredManual];
        }

        // Keep scenes that weren't in additionsByScene
        for (const [sceneId, refs] of Object.entries(prev)) {
          if (!next[sceneId]) next[sceneId] = refs;
        }

        return next;
      });
    };

    syncFrameReferences();

    return () => {
      cancelled = true;
    };
  }, [images.map(i => i.sceneId).join(","), charsKey, avatarsKey, objsKey, scenesKey, storyMode]);

  useEffect(() => {
    if (storyMode !== "voiceAnimation") return;
    for (const img of images) {
      if (!img.imageUrl || img.generating) continue;
      const sceneId = img.sceneId;
      if (!videoDuration[sceneId]) setVideoDuration(p => ({ ...p, [sceneId]: "default" }));
      if (!videoResolution[sceneId]) setVideoResolution(p => ({ ...p, [sceneId]: "720p" }));
      if (videoGenerateAudio[sceneId] === undefined) setVideoGenerateAudio(p => ({ ...p, [sceneId]: true }));
      if (videoCameraFixed[sceneId] === undefined) setVideoCameraFixed(p => ({ ...p, [sceneId]: false }));
      if (!videoPrompt[sceneId]) setVideoPrompt(p => ({ ...p, [sceneId]: getDefaultPrompt(sceneId) }));
    }
  }, [storyMode, images.map(i => `${i.sceneId}-${i.imageUrl}-${i.generating}`).join(",")]);

  // Helper: calculate bubble duration based on word count
  const getBubbleDuration = (text: string): number => {
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount <= 4) return 2;
    if (wordCount <= 8) return 3;
    if (wordCount <= 15) return 4;
    return 5;
  };

  useEffect(() => {
    for (const img of images) {
      if (storyMode === "voiceAnimation" || storyMode === "bgVocal" || img.textOverlays.length > 0 || !img.imageUrl || img.generating) continue;
      const scene = scenes.find((s) => s.id === img.sceneId);
      if (!scene) continue;
      const validDialogues = scene.dialogues.filter(d => d.character || d.text);
      if (validDialogues.length > 0) {
        let currentTime = 0;
        const bubbles: TextOverlay[] = validDialogues.map((d, i) => {
          const bubbleDur = getBubbleDuration(d.text);
          const startTime = currentTime;
          const endTime = currentTime + bubbleDur;
          currentTime = endTime;
          return {
            id: crypto.randomUUID(), text: d.text, x: 20, y: 20 + i * 80,
            width: 320, fontSize: 31, type: "bubble" as const, flipH: false, flipV: false,
            startTime, endTime,
            character: d.character || "",
          };
        });
        updateImage(img.sceneId, { textOverlays: bubbles, duration: currentTime });
      } else if (scene.description) {
        const descDuration = getBubbleDuration(scene.description);
        const textOverlay: TextOverlay = {
          id: crypto.randomUUID(), text: scene.description, x: 10, y: 10,
          width: 695, fontSize: 36, type: "text" as const, flipH: false, flipV: false,
          startTime: 0, endTime: descDuration,
        };
        updateImage(img.sceneId, { textOverlays: [textOverlay], duration: descDuration });
      }
    }
  }, [storyMode, images.map(i => `${i.sceneId}-${i.imageUrl}-${i.naturalWidth}`).join(",")]);

  useEffect(() => {
    const saveOverlays = async () => {
      if (!currentProjectId) return;
      for (const img of images) {
        if (!img.imageUrl || img.generating) continue;
        const scene = scenes.find(s => s.id === img.sceneId);
        if (!scene) continue;
        try {
          await supabase.from("project_frames").update({
            text_overlays: JSON.stringify(img.textOverlays),
            duration: img.duration ?? null,
            ...(storyMode === "bgVocal" && scene.narration !== undefined ? { narration: scene.narration } : {}),
          } as any).eq("project_id", currentProjectId).eq("frame_number", scene.number);
        } catch (e) { /* silent */ }
      }
    };
    const timeout = setTimeout(saveOverlays, 1000);
    return () => clearTimeout(timeout);
  }, [images.map(i => JSON.stringify(i.textOverlays)).join(","), storyMode === "bgVocal" ? scenes.map(s => s.narration || "").join(",") : ""]);

  const handleImageLoad = (sceneId: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const imgEl = e.currentTarget;
    const existing = images.find((i) => i.sceneId === sceneId);
    if (existing && (!existing.naturalWidth || !existing.naturalHeight)) {
      updateImage(sceneId, { naturalWidth: imgEl.naturalWidth, naturalHeight: imgEl.naturalHeight });
    }
    imageRefs.current[sceneId] = imgEl;
    forceUpdate((n) => n + 1);
  };

  const getScale = (sceneId: string) => {
    const imgEl = imageRefs.current[sceneId];
    const img = images.find((i) => i.sceneId === sceneId);
    if (!imgEl || !img?.naturalWidth || imgEl.clientWidth === 0) return 0;
    return imgEl.clientWidth / img.naturalWidth;
  };

  const toNaturalCoords = (sceneId: string, dx: number, dy: number) => {
    const scale = getScale(sceneId);
    if (!scale) return { nx: 0, ny: 0 };
    return { nx: dx / scale, ny: dy / scale };
  };

  // Helper: extract character names mentioned in a scene's description and dialogues
  const getSceneCharacterNames = (scene: typeof scenes[0]): Set<string> => {
    const names = new Set<string>();
    const desc = (scene.description || "").toLowerCase();
    const dialogueChars = scene.dialogues.map(d => (d.character || "").trim().toLowerCase()).filter(Boolean);
    dialogueChars.forEach(n => names.add(n));
    // Also check description for character names from avatars/characters
    const allAvatars = useAppStore.getState().characterAvatars;
    const allChars = characters;
    [...allAvatars, ...allChars.map(c => ({ name: c.role }))].forEach((c: any) => {
      const name = (c.name || c.role || "").trim().toLowerCase();
      if (name && desc.includes(name)) names.add(name);
    });
    return names;
  };

  // Build references freshly from store at generation time (avoids stale/expired signed URLs)
  const getRefsForScene = async (sceneId: string) => {
    const state = useAppStore.getState();
    const allAvatars = state.characterAvatars;
    const allChars = characters;
    const allObjs = state.objectAssets;

    // Also include any manually-added per-frame refs (e.g. "Add Previous Image")
    const manualRefs = frameReferences[sceneId] || [];

    const resolveUrl = async (val: string) => {
      const url = (val || "").trim();
      if (!url) return "";
      if (url.startsWith("http") || url.startsWith("data:")) return url;
      if (url.startsWith("blob:")) return ""; // blob URLs can't be sent to edge function
      const signed = await getSignedUrl(url);
      return signed || "";
    };

    const avatarsFromRefs: Array<{ name: string; url: string; features: string }> = [];
    const addedKeys = new Set<string>();

    // Find the scene to check which characters are mentioned
    const scene = state.scenes.find(s => s.id === sceneId);
    const sceneDesc = (scene?.description || "").toLowerCase();
    const sceneDialogueChars = (scene?.dialogues || []).map(d => (d.character || "").toLowerCase()).filter(Boolean);
    
    // Helper: check if a character name appears in scene description or dialogues
    const isCharMentionedInScene = (name: string) => {
      const lower = name.toLowerCase();
      return sceneDesc.includes(lower) || sceneDialogueChars.some(c => c.includes(lower) || lower.includes(c));
    };

    // 1) Character avatars (highest priority) - only if mentioned in scene
    for (const av of allAvatars) {
      const name = (av.name || "").trim();
      if (!name || !av.imageUrl) continue;
      if (!isCharMentionedInScene(name)) {
        console.log(`[getRefsForScene] Skipping avatar "${name}" - not mentioned in scene`);
        continue;
      }
      const url = await resolveUrl(av.imageUrl);
      if (!url) continue;
      const key = name.toLowerCase();
      if (addedKeys.has(key)) continue;
      addedKeys.add(key);
      avatarsFromRefs.push({ name, url, features: av.features || "" });
    }

    // 2) Uploaded characters - only if mentioned in scene
    for (const ch of allChars) {
      const name = (ch.role || "").trim();
      const rawUrl = ch.imageUrl || ch.previewUrl || "";
      if (!rawUrl) continue;
      if (name && !isCharMentionedInScene(name)) {
        console.log(`[getRefsForScene] Skipping character "${name}" - not mentioned in scene`);
        continue;
      }
      if (addedKeys.has(name.toLowerCase())) continue;
      const url = await resolveUrl(rawUrl);
      if (!url) continue;
      addedKeys.add(name.toLowerCase());
      avatarsFromRefs.push({ name: name || "Character", url, features: "" });
    }

    // 3) Object assets (always include - objects are scene props)
    for (const obj of allObjs) {
      const rawUrl = obj.imageUrl || obj.previewUrl || "";
      if (!rawUrl) continue;
      const url = await resolveUrl(rawUrl);
      if (!url) continue;
      const key = `obj_${obj.id}`;
      if (addedKeys.has(key)) continue;
      addedKeys.add(key);
      avatarsFromRefs.push({ name: obj.description || "Object", url, features: "" });
    }

    // 4) Manual per-frame refs (e.g. previous image, custom uploads)
    for (const ref of manualRefs) {
      const url = await resolveUrl(ref.url);
      if (!url) continue;
      const key = `manual_${ref.id}`;
      if (addedKeys.has(key)) continue;
      addedKeys.add(key);
      avatarsFromRefs.push({ name: ref.name, url, features: "" });
    }

    const objectData = allObjs.map((o) => ({ description: o.description }));
    const charsFromRefs = avatarsFromRefs.map(r => ({ role: r.name }));

    console.log(`[getRefsForScene] sceneId=${sceneId}, total refs=${avatarsFromRefs.length}`, avatarsFromRefs.map(r => `${r.name}: ${r.url.substring(0, 60)}...`));

    return { charsFromRefs, objectData, avatarsFromRefs };
  };

  const generateSingleImage = async (sceneId: string) => {
    if (!user) { toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in"); return; }
    updateImage(sceneId, { generating: true });
    try {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) { updateImage(sceneId, { generating: false }); return; }

      const { charsFromRefs, objectData, avatarsFromRefs } = await getRefsForScene(sceneId);

      // Previous image reference removed — user can add manually if desired

      // Use custom prompt if user wrote one for this frame (bgVocal Add Frame)
      const customPrompt = addFramePrompt[sceneId]?.trim();

      const { data, error } = await supabase.functions.invoke("generate-images", {
        body: {
          scenes: [scene], characters: charsFromRefs, objectAssets: objectData,
          storyTopic, language: storyLanguage, artStyle: useAppStore.getState().artStyle,
          imageFormat,
          characterAvatars: avatarsFromRefs.length > 0 ? avatarsFromRefs : undefined,
          ...(customPrompt ? { promptOverride: customPrompt } : {}),
        },
      });
      if (error) throw error;
      const nextUrl = data.images[0]?.imageUrl;
      updateImage(sceneId, { imageUrl: nextUrl, generating: false, naturalWidth: undefined, naturalHeight: undefined });
      if (currentProjectId && user && nextUrl) {
        let savedPath: string | null = null;
        try {
          savedPath = await uploadStoryImage({ dataUrl: nextUrl, userId: user.id, projectId: currentProjectId, frameNumber: scene.number });
        } catch (uploadErr) {
          console.warn("Upload to storage failed, saving external URL:", uploadErr);
        }
        // Save to DB: use storage path if available, otherwise save the external URL directly
        const imagePathToSave = savedPath || nextUrl;
        await (supabase.from("project_frames") as any).upsert({
          project_id: currentProjectId, frame_number: scene.number,
          scene_description: scene.description, image_path: imagePathToSave,
          dialogues: scene.dialogues, shot_breakdown: scene.shot_breakdown || null,
          ...(scene.narration !== undefined ? { narration: scene.narration } : {}),
        }, { onConflict: "project_id,frame_number" });
      }
    } catch (err) {
      console.error(err);
      toast.error(t(language, "error"));
      updateImage(sceneId, { generating: false });
    }
  };

  const regenerate = async (sceneId: string, revisionNote?: string, extraAvatarBase64?: string) => {
    updateImage(sceneId, { generating: true });
    try {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) { updateImage(sceneId, { generating: false }); return; }
      
      const { charsFromRefs, objectData, avatarsFromRefs } = await getRefsForScene(sceneId);

      // Previous image reference removed — user can add manually if desired

      const { data, error } = await supabase.functions.invoke("generate-images", {
        body: {
          scenes: [scene], characters: charsFromRefs, objectAssets: objectData,
          storyTopic, language: storyLanguage, artStyle: useAppStore.getState().artStyle,
          imageFormat,
          characterAvatars: avatarsFromRefs.length > 0 ? avatarsFromRefs : undefined,
          ...(revisionNote ? { revisionNote } : {}),
          ...(extraAvatarBase64 ? { revisionAvatar: extraAvatarBase64 } : {}),
        },
      });
      if (error) throw error;
      const nextUrl = data.images[0]?.imageUrl;
      updateImage(sceneId, { imageUrl: nextUrl, generating: false, naturalWidth: undefined, naturalHeight: undefined });
      if (currentProjectId && user && nextUrl) {
        let savedPath: string | null = null;
        try {
          savedPath = await uploadStoryImage({ dataUrl: nextUrl, userId: user.id, projectId: currentProjectId, frameNumber: scene.number });
        } catch (uploadErr) {
          console.warn("Upload to storage failed, saving external URL:", uploadErr);
        }
        const imagePathToSave = savedPath || nextUrl;
        await supabase.from("project_frames").update({ image_path: imagePathToSave, scene_description: scene.description }).eq("project_id", currentProjectId).eq("frame_number", scene.number);
      }
    } catch (err) {
      console.error(err);
      toast.error(t(language, "error"));
      updateImage(sceneId, { generating: false });
    }
  };

  const handleRevision = (sceneId: string) => {
    if (!revisionText.trim()) return;
    regenerate(sceneId, revisionText, revisionAvatarBase64 || undefined);
    setRevisionSceneId(null);
    setRevisionText("");
    setRevisionAvatarBase64(null);
  };

  const handleDeleteFrame = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    removeImage(sceneId);
    removeScene(sceneId);
    if (currentProjectId && scene) {
      try { await supabase.from("project_frames").delete().eq("project_id", currentProjectId).eq("frame_number", scene.number); } catch {}
    }
  };

  const handleRevisionAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRevisionAvatarBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  const loadSavedCharacters = async () => {
    const { data } = await supabase.from("saved_characters").select("id, name, image_url");
    setSavedChars((data as any) || []);
    setShowSavedChars(true);
  };

  const handleBulkDuration = (val: number) => {
    setBulkDuration(val);
    for (const img of images) { updateImage(img.sceneId, { duration: val }); }
  };

  const addOverlay = (sceneId: string, type: "text" | "bubble", characterName?: string) => {
    const img = images.find((i) => i.sceneId === sceneId);
    if (!img) return;
    const currentMaxEnd = img.textOverlays.reduce((max, o) => Math.max(max, o.endTime ?? 0), 0);
    const isText = type === "text";
    const newBubbleDur = 3;
    const startTime = currentMaxEnd;
    const endTime = currentMaxEnd + newBubbleDur;
    const newOverlay: TextOverlay = {
      id: crypto.randomUUID(), text: "Metin", x: 50, y: 50,
      width: isText ? 695 : 320, fontSize: isText ? 36 : 31,
      type, flipH: false, flipV: false,
      startTime, endTime, inverted: false,
      character: characterName || undefined,
    };
    updateImage(sceneId, { textOverlays: [...img.textOverlays, newOverlay], duration: endTime });
    setSelectedOverlay({ sceneId, overlayId: newOverlay.id });
  };

  const getSceneCharacters = (sceneId: string): string[] => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return [];
    const charSet = new Set<string>();
    for (const d of scene.dialogues) {
      if (d.character) charSet.add(d.character);
    }
    // Also include character avatars and uploaded characters
    const state = useAppStore.getState();
    for (const av of state.characterAvatars) {
      if (av.name) charSet.add(av.name);
    }
    for (const ch of characters) {
      if (ch.role) charSet.add(ch.role);
    }
    return Array.from(charSet);
  };

  const handleAddBubbleClick = (sceneId: string) => {
    const chars = getSceneCharacters(sceneId);
    if (chars.length === 0) {
      addOverlay(sceneId, "bubble");
    } else {
      setBubbleCharPickerScene(sceneId);
    }
  };

  const updateOverlay = (sceneId: string, overlayId: string, updates: Partial<TextOverlay>) => {
    const img = images.find((i) => i.sceneId === sceneId);
    if (!img) return;
    const updatedOverlays = img.textOverlays.map((o) => (o.id === overlayId ? { ...o, ...updates } : o));
    // Recalculate frame duration from max endTime of all overlays
    const maxEnd = updatedOverlays.reduce((max, o) => Math.max(max, Number(o.endTime) || 0), 0);
    const newDuration = maxEnd > 0 ? maxEnd : (img.duration ?? 3);
    updateImage(sceneId, { textOverlays: updatedOverlays, duration: newDuration });
  };

  const deleteOverlay = (sceneId: string, overlayId: string) => {
    const img = images.find((i) => i.sceneId === sceneId);
    if (!img) return;
    const remaining = img.textOverlays.filter((o) => o.id !== overlayId);
    // Recalculate frame duration based on remaining overlays
    const maxEnd = remaining.reduce((max, o) => Math.max(max, o.endTime ?? 0), 0);
    const newDuration = maxEnd > 0 ? maxEnd : 3;
    updateImage(sceneId, { textOverlays: remaining, duration: newDuration });
    if (selectedOverlay?.overlayId === overlayId) setSelectedOverlay(null);
  };

  const handlePointerDown = useCallback((sceneId: string, overlayId: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const imgEl = imageRefs.current[sceneId]; if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const img = useAppStore.getState().images.find((i) => i.sceneId === sceneId);
    const overlay = img?.textOverlays.find((o) => o.id === overlayId);
    if (!overlay || !img?.naturalWidth) return;
    const scale = imgEl.clientWidth / img.naturalWidth;
    setDragging({ sceneId, overlayId, offsetX: (e.clientX - imgRect.left) - overlay.x * scale, offsetY: (e.clientY - imgRect.top) - overlay.y * scale });
    setSelectedOverlay({ sceneId, overlayId });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const imgEl = imageRefs.current[dragging.sceneId]; if (!imgEl) return;
    const imgRect = imgEl.getBoundingClientRect();
    const { nx, ny } = toNaturalCoords(dragging.sceneId, e.clientX - imgRect.left - dragging.offsetX, e.clientY - imgRect.top - dragging.offsetY);
    const img = useAppStore.getState().images.find((i) => i.sceneId === dragging.sceneId);
    const nw = img?.naturalWidth || 1024; const nh = img?.naturalHeight || 1024;
    updateOverlay(dragging.sceneId, dragging.overlayId, { x: Math.max(0, Math.min(nw, nx)), y: Math.max(0, Math.min(nh, ny)) });
  }, [dragging]);

  const handlePointerUp = useCallback(() => { setDragging(null); }, []);

  // Add Frame state for bgVocal prompt/narration toggle
  const [addFrameMode, setAddFrameMode] = useState<Record<string, "narration" | "prompt">>({});
  const [addFramePrompt, setAddFramePrompt] = useState<Record<string, string>>({});

  const handleAddFrame = () => {
    addScene();
    const newScenes = useAppStore.getState().scenes;
    const newScene = newScenes[newScenes.length - 1];

    // Previous frame reference removed — user can add manually via "Add" button

    const newImage: GeneratedImage = {
      sceneId: newScene.id, imageUrl: "", approved: false, generating: false, textOverlays: [], duration: bulkDuration,
      kenBurns: storyMode === "bgVocal" ? true : undefined,
    };
    setImages([...images, newImage]);
  };

  // --- Per-frame video generation ---
  const getDefaultPrompt = (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return "";
    const dialogueText = scene.dialogues.filter(d => d.character || d.text).map(d => `${d.character || "?"}: ${d.text}`).join("\n");
    return `${scene.description}${dialogueText ? `\n\n${dialogueText}` : ""}`;
  };

  // Reference management handlers
  const addReferenceToFrame = (sceneId: string, ref: FrameReference) => {
    setFrameReferences(prev => ({
      ...prev,
      [sceneId]: [...(prev[sceneId] || []), ref],
    }));
  };

  const removeReferenceFromFrame = (sceneId: string, refId: string) => {
    setFrameReferences(prev => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).filter(r => r.id !== refId),
    }));
  };

  const handleRefFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !refUploadTarget) return;
    const reader = new FileReader();
    reader.onload = () => {
      addReferenceToFrame(refUploadTarget, {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        url: reader.result as string,
      });
      setRefUploadTarget(null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const generateFrameVideo = async (sceneId: string) => {
    const img = images.find(i => i.sceneId === sceneId);
    if (!img?.imageUrl) { toast.error(language === "tr" ? "Görsel bulunamadı" : "No image found"); return; }
    if (!user) { toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in"); return; }

    const res = videoResolution[sceneId] || "720p";
    const dur = videoDuration[sceneId] || "default";
    const vidModel = storyLanguage === "tr" ? "wan" : "seedance";
    const cost = getVideoCost(res, dur, vidModel);

    if (credits < cost) {
      toast.error(language === "tr" ? `Yetersiz bakiye! Bu işlem $${cost.toFixed(2)} gerektirir.` : `Insufficient balance! This costs $${cost.toFixed(2)}.`);
      return;
    }
    const prompt = videoPrompt[sceneId] || getDefaultPrompt(sceneId);
    const aspectRatio = getAspectRatio(imageFormat);
    const videoModel = storyLanguage === "tr" ? "wan" : "seedance";

    setVideoJobs(prev => ({ ...prev, [sceneId]: { sceneId, model: videoModel as AIVideoModel, requestId: "", status: "queued" } }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-video", {
        body: {
          action: "submit",
          imageUrl: img.imageUrl,
          prompt,
          duration: dur === "default" ? "default" : Number(dur),
          aspect_ratio: aspectRatio,
          resolution: res,
          camera_fixed: videoCameraFixed[sceneId] || false,
          generate_audio: videoGenerateAudio[sceneId] !== false,
          model: videoModel,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const job: AIVideoJob = { sceneId, model: videoModel as AIVideoModel, requestId: data.requestId, status: "queued", statusUrl: data.statusUrl, responseUrl: data.responseUrl };
      setVideoJobs(prev => ({ ...prev, [sceneId]: job }));
      startFramePolling(job);

      // Deduct cost
      await supabase.from("user_credits").update({ credits: credits - cost }).eq("user_id", user!.id);
      await supabase.from("credit_transactions").insert({
        user_id: user!.id,
        amount: cost,
        type: "debit",
        description: `Video: ${res}, ${dur === "default" ? "5" : dur}s`,
      });
      refetchCredits();
    } catch (err: any) {
      console.error("Video submit error:", err);
      setVideoJobs(prev => ({ ...prev, [sceneId]: { sceneId, model: "seedance" as AIVideoModel, requestId: "", status: "failed", error: err?.message || "Submit failed" } }));
      toast.error(err?.message || "Video generation failed");
    }
  };

  const startFramePolling = (job: AIVideoJob) => {
    const key = job.sceneId;
    pollCountRef.current[key] = 0;
    consecutiveErrorsRef.current[key] = 0;

    if (pollingRef.current[key]) clearInterval(pollingRef.current[key]);

    const interval = setInterval(async () => {
      pollCountRef.current[key] = (pollCountRef.current[key] || 0) + 1;

      if (pollCountRef.current[key] > MAX_POLLS) {
        clearInterval(interval);
        delete pollingRef.current[key];
        setVideoJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "failed", error: "Timeout" } }));
        return;
      }

      try {
        const { data } = await supabase.functions.invoke("generate-ai-video", {
          body: { action: "status", requestId: job.requestId, statusUrl: job.statusUrl, model: job.model },
        });
        consecutiveErrorsRef.current[key] = 0;

        if (data?.status === "COMPLETED") {
          clearInterval(interval);
          delete pollingRef.current[key];
          const { data: resultData } = await supabase.functions.invoke("generate-ai-video", {
            body: { action: "result", requestId: job.requestId, responseUrl: job.responseUrl, model: job.model },
          });
          setVideoJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "completed", videoUrl: resultData?.videoUrl } }));
          setFrameView(prev => ({ ...prev, [key]: "video" }));
          toast.success(language === "tr" ? "Video oluşturuldu!" : "Video generated!");
        } else if (data?.status === "FAILED" || data?.status === "CANCELLED") {
          clearInterval(interval);
          delete pollingRef.current[key];
          setVideoJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "failed", error: "Generation failed" } }));
        } else {
          setVideoJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "processing" } }));
        }
      } catch (err) {
        consecutiveErrorsRef.current[key] = (consecutiveErrorsRef.current[key] || 0) + 1;
        if (consecutiveErrorsRef.current[key] >= 3) {
          clearInterval(interval);
          delete pollingRef.current[key];
          setVideoJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "failed", error: "Polling errors" } }));
        }
      }
    }, 5000);

    pollingRef.current[key] = interval;
  };

  // --- bgVocal voice library ---
  const fetchBgVoices = useCallback(async () => {
    setLoadingBgVoices(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-voices", {
        body: { storyLanguage },
      });
      if (error) throw error;
      setBgVoices(data.voices || []);
    } catch {
      toast.error(language === "tr" ? "Sesler yüklenemedi" : "Failed to load voices");
    } finally {
      setLoadingBgVoices(false);
    }
  }, [storyLanguage, language]);

  useEffect(() => {
    if (storyMode === "bgVocal") fetchBgVoices();
  }, [storyMode, fetchBgVoices]);

  const filteredBgVoices = bgVoices.filter((v) => {
    const labels = v.labels || {};
    const lang = storyLanguage === "tr" ? "turkish" : "english";
    const hasLang = Object.values(labels).some((val) => typeof val === "string" && val.toLowerCase().includes(lang)) || v.name.toLowerCase().includes(lang);
    const langMatch = bgVoices.some((voice) => Object.values(voice.labels || {}).some((val) => typeof val === "string" && val.toLowerCase().includes(lang))) ? hasLang : true;
    const genderMatch = bgGenderFilter === "all" || Object.values(labels).some((val) => typeof val === "string" && val.toLowerCase() === bgGenderFilter);
    const searchMatch = !bgSearchQuery || v.name.toLowerCase().includes(bgSearchQuery.toLowerCase());
    return langMatch && genderMatch && searchMatch;
  });

  const playBgVoicePreview = (voice: ElevenLabsVoice) => {
    if (bgPreviewPlaying === voice.voice_id) {
      bgPreviewAudioRef.current?.pause();
      setBgPreviewPlaying(null);
      return;
    }
    if (bgPreviewAudioRef.current) bgPreviewAudioRef.current.pause();
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setBgPreviewPlaying(null);
    audio.play();
    bgPreviewAudioRef.current = audio;
    setBgPreviewPlaying(voice.voice_id);
  };

  const playFrameTTS = async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene?.narration?.trim() || !selectedBgVoiceId) {
      toast.error(language === "tr" ? "Narrasyon metni veya ses seçimi eksik" : "Missing narration text or voice selection");
      return;
    }
    if (frameTTSPlaying === sceneId) {
      frameTTSAudioRef.current?.pause();
      setFrameTTSPlaying(null);
      return;
    }
    setFrameTTSPlaying(sceneId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: scene.narration, voiceId: selectedBgVoiceId }),
        }
      );
      if (!response.ok) throw new Error("TTS failed");
      const data = await response.json();
      const audioUrl = `data:audio/mpeg;base64,${data.audioBase64}`;
      if (frameTTSAudioRef.current) frameTTSAudioRef.current.pause();
      const audio = new Audio(audioUrl);
      audio.onended = () => setFrameTTSPlaying(null);
      audio.play();
      frameTTSAudioRef.current = audio;
    } catch {
      toast.error(language === "tr" ? "Ses oluşturulamadı" : "Failed to generate audio");
      setFrameTTSPlaying(null);
    }
  };

  const selectedBgVoice = bgVoices.find(v => v.voice_id === selectedBgVoiceId);

  // --- bgVocal animation: animate a frame's image into video ---
  const generateFrameAnimation = async (sceneId: string) => {
    const img = images.find(i => i.sceneId === sceneId);
    if (!img?.imageUrl) { toast.error(language === "tr" ? "Görsel bulunamadı" : "No image found"); return; }
    if (!user) { toast.error(language === "tr" ? "Lütfen giriş yapın" : "Please sign in"); return; }

    // Cost: Storilyne Animate (hailuo) pricing — 10s = 2x cost of 5s
    const cost = getVideoCost("720p", "5", "hailuo") * 2;
    if (!isUnlimited && credits < cost) {
      toast.error(language === "tr" ? `Yetersiz bakiye! $${cost.toFixed(2)} gerekiyor.` : `Insufficient balance! Costs $${cost.toFixed(2)}.`);
      return;
    }

    // Build a short AI prompt from scene description
    const scene = scenes.find(s => s.id === sceneId);
    const desc = scene?.description || "";
    // Use user-edited prompt if available
    const userPrompt = animPromptDrafts[sceneId]?.trim();
    const shortPrompt = userPrompt || `Animate this scene with subtle, natural movement: ${desc.slice(0, 200)}`;

    setAnimationJobs(prev => ({ ...prev, [sceneId]: { sceneId, model: "hailuo" as AIVideoModel, requestId: "", status: "queued" } }));

    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-video", {
        body: {
          action: "submit",
          imageUrl: img.imageUrl,
          prompt: shortPrompt,
          duration: 10,
          aspect_ratio: getAspectRatio(imageFormat),
          resolution: "720p",
          model: "hailuo",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const job: AIVideoJob = { sceneId, model: "hailuo" as AIVideoModel, requestId: data.requestId, status: "queued", statusUrl: data.statusUrl, responseUrl: data.responseUrl };
      setAnimationJobs(prev => ({ ...prev, [sceneId]: job }));
      startAnimPolling(job);

      // Deduct cost
      if (!isUnlimited) {
        await supabase.from("user_credits").update({ credits: credits - cost }).eq("user_id", user!.id);
        await supabase.from("credit_transactions").insert({
          user_id: user!.id, amount: cost, type: "debit",
          description: `Animation: hailuo 720p 10s`,
        });
        refetchCredits();
      }
    } catch (err: any) {
      console.error("Animation submit error:", err);
      setAnimationJobs(prev => ({ ...prev, [sceneId]: { sceneId, model: "hailuo" as AIVideoModel, requestId: "", status: "failed", error: err?.message || "Submit failed" } }));
      toast.error(err?.message || "Animation generation failed");
    }
  };

  const startAnimPolling = (job: AIVideoJob) => {
    const key = job.sceneId;
    animPollCountRef.current[key] = 0;
    animConsecutiveErrorsRef.current[key] = 0;
    if (animPollingRef.current[key]) clearInterval(animPollingRef.current[key]);

    const interval = setInterval(async () => {
      animPollCountRef.current[key] = (animPollCountRef.current[key] || 0) + 1;
      if (animPollCountRef.current[key] > MAX_POLLS) {
        clearInterval(interval);
        delete animPollingRef.current[key];
        setAnimationJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "failed", error: "Timeout" } }));
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("generate-ai-video", {
          body: { action: "status", requestId: job.requestId, statusUrl: job.statusUrl, model: job.model },
        });
        animConsecutiveErrorsRef.current[key] = 0;
        if (data?.status === "COMPLETED") {
          clearInterval(interval);
          delete animPollingRef.current[key];
          const { data: resultData } = await supabase.functions.invoke("generate-ai-video", {
            body: { action: "result", requestId: job.requestId, responseUrl: job.responseUrl, model: job.model },
          });
          const videoUrl = resultData?.videoUrl;
          setAnimationJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "completed", videoUrl } }));
          if (videoUrl) {
            setFrameAnimatedVideos(prev => ({ ...prev, [key]: [...(prev[key] || []), videoUrl] }));
            setFrameMediaIndex(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
            // Persist selection: newly generated animation is selected
            useAppStore.getState().updateFrameMediaSelection(key, "video");
            // Persist animation video to DB
            const scene = scenes.find(s => s.id === key);
            if (currentProjectId && scene) {
              const animFrameNumber = 1000 + (scene.number || 0);
              supabase.from("project_videos").upsert({
                project_id: currentProjectId,
                video_url: videoUrl,
                frame_number: animFrameNumber,
              } as any, { onConflict: "project_id,frame_number" }).then(() => {
                console.log("Animation video saved to DB for frame", scene.number);
              }, (e: any) => console.warn("Failed to save animation video:", e));
            }
          }
          toast.success(language === "tr" ? "Animasyon oluşturuldu!" : "Animation created!");
        } else if (data?.status === "FAILED" || data?.status === "CANCELLED") {
          clearInterval(interval);
          delete animPollingRef.current[key];
          setAnimationJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "failed", error: "Failed" } }));
        } else {
          setAnimationJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "processing" } }));
        }
      } catch {
        animConsecutiveErrorsRef.current[key] = (animConsecutiveErrorsRef.current[key] || 0) + 1;
        if (animConsecutiveErrorsRef.current[key] >= 3) {
          clearInterval(interval);
          delete animPollingRef.current[key];
          setAnimationJobs(prev => ({ ...prev, [key]: { ...prev[key], status: "failed", error: "Polling errors" } }));
        }
      }
    }, 5000);
    animPollingRef.current[key] = interval;
  };

  const getFrameMediaCount = (sceneId: string) => {
    const videos = frameAnimatedVideos[sceneId] || [];
    return 1 + videos.length; // 1 for original image + animated videos
  };

  const navigateFrameMedia = (sceneId: string, direction: -1 | 1) => {
    const count = getFrameMediaCount(sceneId);
    const current = frameMediaIndex[sceneId] || 0;
    const next = (current + direction + count) % count;
    setFrameMediaIndex(prev => ({ ...prev, [sceneId]: next }));
    // Persist selection to store for merge
    useAppStore.getState().updateFrameMediaSelection(sceneId, next === 0 ? "image" : "video");
  };

  const anyGenerating = images.some((img) => img.generating);

  const generateAllImages = async () => {
    for (const img of images) {
      if (img.imageUrl || img.generating) continue;
      await generateSingleImage(img.sceneId);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t(language, "imagesTitle")}</h2>
        <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="mr-1 h-4 w-4" />{t(language, "backToDraft")}</Button>
      </div>

      {/* Voice selection for bgVocal */}
      {storyMode === "bgVocal" && (
        <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
          <AudioLines className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {selectedBgVoice ? selectedBgVoice.name : (language === "tr" ? "Ses seçilmedi" : "No voice selected")}
          </span>
          <Dialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Volume2 className="mr-1 h-3 w-3" />
                {language === "tr" ? "Ses Seç" : "Select Voice"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{language === "tr" ? "Ses Kütüphanesi" : "Voice Library"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[180px]">
                    <Input
                      placeholder={language === "tr" ? "Ses ara..." : "Search voices..."}
                      value={bgSearchQuery}
                      onChange={(e) => setBgSearchQuery(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Select value={bgGenderFilter} onValueChange={(v) => setBgGenderFilter(v as any)}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "tr" ? "Tüm Sesler" : "All"}</SelectItem>
                      <SelectItem value="male">{language === "tr" ? "Erkek" : "Male"}</SelectItem>
                      <SelectItem value="female">{language === "tr" ? "Kadın" : "Female"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {loadingBgVoices ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
                    {filteredBgVoices.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">{language === "tr" ? "Ses bulunamadı" : "No voices found"}</p>
                    ) : filteredBgVoices.map((voice) => (
                      <div
                        key={voice.voice_id}
                        onClick={() => { setSelectedBgVoiceId(voice.voice_id); localStorage.setItem("bgVocal_voiceId", voice.voice_id); setVoiceDialogOpen(false); }}
                        className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-all ${
                          selectedBgVoiceId === voice.voice_id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/40 hover:border-border hover:bg-accent/5"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <Volume2 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{voice.name}</p>
                            <div className="flex gap-1 flex-wrap">
                              {Object.entries(voice.labels || {}).slice(0, 3).map(([k, v]) => (
                                <span key={k} className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{v}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); playBgVoicePreview(voice); }}>
                          {bgPreviewPlaying === voice.voice_id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Bulk duration control */}
      {storyMode !== "voiceAnimation" && storyMode !== "bgVocal" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t(language, "bulkDuration")}</span>
            <Input type="number" value={bulkDuration} onChange={(e) => handleBulkDuration(Math.max(1, Math.min(30, Number(e.target.value) || 3)))} min={1} max={30} className="w-16 h-8 text-sm text-center" />
            <span className="text-sm text-muted-foreground">{t(language, "seconds")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <span>{language === "tr" ? "Toplam:" : "Total:"}</span>
            <span className="text-foreground">{images.reduce((sum, img) => sum + (Number(img.duration) || 3), 0)}{language === "tr" ? " sn" : "s"}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {images.map((img) => {
          const scene = scenes.find((s) => s.id === img.sceneId);
          const isSelected = selectedOverlay?.sceneId === img.sceneId;
          const activeOverlay = isSelected ? img.textOverlays.find((o) => o.id === selectedOverlay?.overlayId) : null;
          const aspectRatio = img.naturalWidth && img.naturalHeight ? `${img.naturalWidth} / ${img.naturalHeight}` : imageFormat === "mobile" ? "9 / 16" : imageFormat === "desktop" ? "16 / 9" : "1 / 1";
          const job = videoJobs[img.sceneId];
          const currentView = frameView[img.sceneId] || "image";
          const hasVideo = job?.status === "completed" && job?.videoUrl;
          const isVideoGenerating = job && (job.status === "queued" || job.status === "processing");

          return (
            <Card key={img.sceneId} className="overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
                <span className="text-xs font-medium text-muted-foreground">{t(language, "scene")} {scene?.number}</span>
                <div className="flex items-center gap-1">
                  {hasVideo && (
                    <Tabs value={currentView} onValueChange={(v) => setFrameView(prev => ({ ...prev, [img.sceneId]: v as "image" | "video" }))} className="h-6">
                      <TabsList className="h-6 p-0.5">
                        <TabsTrigger value="image" className="h-5 px-2 text-[10px]"><Image className="h-3 w-3 mr-1" />{language === "tr" ? "Görsel" : "Image"}</TabsTrigger>
                        <TabsTrigger value="video" className="h-5 px-2 text-[10px]"><Video className="h-3 w-3 mr-1" />Video</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  {storyMode !== "voiceAnimation" && storyMode !== "bgVocal" && (
                    <div className="flex items-center gap-1 ml-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        value={img.duration ?? bulkDuration}
                        onChange={(e) => updateImage(img.sceneId, { duration: Math.max(1, Math.min(30, Number(e.target.value) || 3)) })}
                        min={1} max={30}
                        className="w-12 h-6 text-[10px] text-center p-0"
                      />
                      <span className="text-[10px] text-muted-foreground">s</span>
                    </div>
                  )}
                  {images.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive ml-1" onClick={() => handleDeleteFrame(img.sceneId)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Image / Video view with bgVocal carousel */}
              {(() => {
                const animatedVideos = frameAnimatedVideos[img.sceneId] || [];
                const mediaIdx = frameMediaIndex[img.sceneId] || 0;
                const mediaCount = 1 + animatedVideos.length;
                const showCarousel = storyMode === "bgVocal" && mediaCount > 1;
                const isShowingVideo = mediaIdx > 0 && animatedVideos[mediaIdx - 1];
                const animJob = animationJobs[img.sceneId];
                const isAnimGenerating = animJob && (animJob.status === "queued" || animJob.status === "processing");

                // For voiceAnimation mode, keep original video tab behavior
                if (hasVideo && currentView === "video" && storyMode !== "bgVocal") {
                  return (
                    <div className="bg-muted" style={{ aspectRatio }}>
                      <video src={job.videoUrl} controls className="h-full w-full object-contain" />
                    </div>
                  );
                }

                return (
                  <div className="relative bg-muted select-none overflow-hidden" style={{ aspectRatio }} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onClick={() => setSelectedOverlay(null)}>
                    {img.generating ? (
                      <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : img.imageUrl ? (
                      <div className="relative w-full h-full">
                        {isShowingVideo ? (
                          <video src={animatedVideos[mediaIdx - 1]} controls className="h-full w-full object-contain" />
                        ) : (
                          <>
                            <img src={img.imageUrl} alt={`Scene ${scene?.number}`} className="h-full w-full object-contain" onLoad={(e) => handleImageLoad(img.sceneId, e)} ref={(el) => { if (el) imageRefs.current[img.sceneId] = el; }} />
                            {(plan === "free" || !plan) && (
                              <div className="absolute bottom-2 right-2 text-white/40 font-bold text-sm pointer-events-none select-none" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                                storilyne AI
                              </div>
                            )}
                            {(() => {
                              let bubbleIndex = 0;
                              return img.textOverlays.map((overlay) => {
                                const scale = getScale(img.sceneId); if (!scale) return null;
                                const dx = overlay.x * scale; const dy = overlay.y * scale; const dw = overlay.width * scale; const displayFontSize = overlay.fontSize * scale;
                                const isBubble = overlay.type === "bubble";
                                const currentBubbleIdx = isBubble ? bubbleIndex++ : -1;
                                // Use overlay.character directly for color mapping
                                const charName = overlay.character || "";
                                const cIdx = charName in globalCharColorMap ? globalCharColorMap[charName] : 0;
                                const bubbleBg = isBubble && !overlay.inverted ? PASTEL_COLORS[cIdx] : undefined;
                                const bubbleBorder = isBubble && !overlay.inverted ? PASTEL_BORDERS[cIdx] : undefined;
                                return (
                                  <div key={overlay.id} className={`absolute cursor-grab active:cursor-grabbing pointer-events-auto ${selectedOverlay?.overlayId === overlay.id ? "ring-2 ring-primary rounded" : ""}`}
                                    style={{ left: `${dx}px`, top: `${dy}px`, width: `${dw}px`, maxWidth: `${dw}px`, resize: "horizontal", overflow: "visible", minWidth: "40px", zIndex: 10 }}
                                    onPointerDown={(e) => handlePointerDown(img.sceneId, overlay.id, e)}
                                    onClick={(e) => { e.stopPropagation(); setSelectedOverlay({ sceneId: img.sceneId, overlayId: overlay.id }); }}>
                                    {isBubble ? (
                                      <div className="relative rounded-2xl px-3 py-1.5 shadow-md border overflow-visible" style={{
                                        backgroundColor: overlay.inverted ? "rgba(0,0,0,0.85)" : (bubbleBg || "white"),
                                        borderColor: overlay.inverted ? "rgba(60,60,60,0.6)" : (bubbleBorder || "#e0e0e0"),
                                        transform: `${overlay.flipH ? "scaleX(-1)" : ""} ${overlay.flipV ? "scaleY(-1)" : ""}`.trim() || undefined,
                                      }}>
                                        {/* Bubble number badge */}
                                        <span className="absolute flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[10px] font-bold shadow z-20 pointer-events-none"
                                          style={{ top: "-10px", left: "-10px", transform: `${overlay.flipH ? "scaleX(-1)" : ""} ${overlay.flipV ? "scaleY(-1)" : ""}`.trim() || undefined }}>
                                          {currentBubbleIdx + 1}
                                        </span>
                                        <span className="font-bold whitespace-pre-wrap text-center block relative z-10" style={{
                                          fontSize: `${displayFontSize}px`,
                                          color: overlay.inverted ? "white" : "black",
                                          transform: `${overlay.flipH ? "scaleX(-1)" : ""} ${overlay.flipV ? "scaleY(-1)" : ""}`.trim() || undefined,
                                        }}>{overlay.text}</span>
                                        <div className="absolute -bottom-2 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style={{ borderTopColor: overlay.inverted ? "rgba(0,0,0,0.85)" : (bubbleBg || "white") }} />
                                        {charName && (
                                          <span className="absolute -bottom-5 left-0 text-[9px] text-muted-foreground whitespace-nowrap pointer-events-none" style={{
                                            transform: `${overlay.flipH ? "scaleX(-1)" : ""} ${overlay.flipV ? "scaleY(-1)" : ""}`.trim() || undefined,
                                          }}>{charName}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="font-bold whitespace-pre-wrap text-center block" style={{
                                        fontSize: `${displayFontSize}px`,
                                        color: overlay.inverted ? "white" : "black",
                                        textShadow: overlay.inverted
                                          ? "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)"
                                          : "0 1px 3px rgba(255,255,255,0.95), 0 0 8px rgba(255,255,255,0.7), 1px 1px 0 rgba(255,255,255,0.8), -1px -1px 0 rgba(255,255,255,0.8)",
                                        WebkitTextStroke: overlay.inverted ? "0.5px rgba(0,0,0,0.3)" : "0.5px rgba(255,255,255,0.6)",
                                      }}>{overlay.text}</span>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </>
                        )}

                        {/* Carousel arrows for bgVocal */}
                        {showCarousel && (
                          <>
                            <button
                              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                              onClick={(e) => { e.stopPropagation(); navigateFrameMedia(img.sceneId, -1); }}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                              onClick={(e) => { e.stopPropagation(); navigateFrameMedia(img.sceneId, 1); }}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 flex gap-1">
                              {Array.from({ length: mediaCount }).map((_, idx) => (
                                <div key={idx} className={`h-1.5 w-1.5 rounded-full transition-colors ${idx === mediaIdx ? "bg-white" : "bg-white/40"}`} />
                              ))}
                            </div>
                          </>
                        )}

                        {/* Animation generating indicator */}
                        {isAnimGenerating && (
                          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-black/60 text-white text-[10px] rounded-full px-2 py-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {language === "tr" ? "Animasyon..." : "Animating..."}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                        {/* bgVocal empty frame: only show generate button, narration is below */}
                        {storyMode === "bgVocal" && scene && (
                          <div className="w-full flex flex-col items-center gap-2">
                            {/* empty - narration/prompt controls moved to CardContent below */}
                          </div>
                        )}
                        <Wand2 className="h-8 w-8 text-muted-foreground/50" />
                        <Button onClick={() => generateSingleImage(img.sceneId)} disabled={img.generating} size="sm">
                          <ImagePlus className="mr-2 h-4 w-4" />
                          {language === "tr" ? "Görsel Oluştur" : "Generate Image"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Character color legend + info text */}
              {storyMode === "multi" && scene && img.imageUrl && (() => {
                const entries = Object.entries(globalCharColorMap);
                if (entries.length === 0) return null;
                return (
                  <div className="px-3 py-1.5 border-t border-border/50 space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map(([name, idx]) => (
                        <div key={name} className="flex items-center gap-1 text-[10px]">
                          <div className="h-3 w-3 rounded-sm border" style={{ backgroundColor: PASTEL_COLORS[idx], borderColor: PASTEL_BORDERS[idx] }} />
                          <span className="text-muted-foreground">{name}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-muted-foreground/70 leading-tight">
                      {language === "tr"
                        ? "💡 Konuşma balonlarının rengi karakteri, üzerindeki rakam ise konuşma sırasını belirtir. Bunlar sadece düzenleme aşamasında görünür."
                        : "💡 Bubble colors indicate the character, and numbers show the speaking order. These are only visible during editing."}
                    </p>
                  </div>
                );
              })()}

              <CardContent className="space-y-2 p-4">
                {/* Reference avatars section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {language === "tr" ? "Referans Görseller" : "Reference Images"}
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]">
                          <Plus className="h-2.5 w-2.5 mr-0.5" />{language === "tr" ? "Ekle" : "Add"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-44 p-2" align="end">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const sceneIdx = scenes.findIndex(s => s.id === img.sceneId);
                            if (sceneIdx > 0) {
                              const prevScene = scenes[sceneIdx - 1];
                              const prevImg = images.find(i => i.sceneId === prevScene.id);
                              if (prevImg?.imageUrl) {
                                return (
                                  <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={() => {
                                    addReferenceToFrame(img.sceneId, { id: crypto.randomUUID(), name: `${language === "tr" ? "Kare" : "Frame"} ${prevScene.number}`, url: prevImg.imageUrl });
                                  }}>
                                    <ImagePlus className="mr-2 h-3.5 w-3.5" />
                                    {language === "tr" ? "Önceki Görseli Ekle" : "Add Previous Image"}
                                  </Button>
                                );
                              }
                            }
                            return null;
                          })()}
                          <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={() => { setRefUploadTarget(img.sceneId); refFileInputRef.current?.click(); }}>
                            <Upload className="mr-2 h-3.5 w-3.5" />
                            {language === "tr" ? "Bilgisayardan Yükle" : "Upload from Computer"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="justify-start text-xs" onClick={async () => {
                            try {
                              const items = await navigator.clipboard.read();
                              for (const item of items) {
                                const imgType = item.types.find(t => t.startsWith("image/"));
                                if (imgType) {
                                  const blob = await item.getType(imgType);
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const dataUrl = reader.result as string;
                                    addReferenceToFrame(img.sceneId, { id: crypto.randomUUID(), name: language === "tr" ? "Panodan" : "Clipboard", url: dataUrl });
                                    toast.success(language === "tr" ? "Görsel yapıştırıldı!" : "Image pasted!");
                                  };
                                  reader.readAsDataURL(blob);
                                  return;
                                }
                              }
                              toast.error(language === "tr" ? "Panoda görsel bulunamadı" : "No image found in clipboard");
                            } catch {
                              toast.error(language === "tr" ? "Pano erişimi reddedildi" : "Clipboard access denied");
                            }
                          }}>
                            <ImagePlus className="mr-2 h-3.5 w-3.5" />
                            {language === "tr" ? "Panodan Yapıştır" : "Paste from Clipboard"}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  {(() => {
                    const refs = frameReferences[img.sceneId] || [];
                    const hasAny = refs.length > 0;
                    if (!hasAny) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {refs.map(ref => (
                          <div key={ref.id} className="relative group">
                            <img src={ref.url} alt={ref.name} className="h-8 w-8 rounded border object-cover" title={ref.name} />
                            <button
                              className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeReferenceFromFrame(img.sceneId, ref.id)}
                            >
                              <X className="h-2 w-2" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* bgVocal: narration/prompt toggle + TTS play + Ken Burns */}
                {storyMode === "bgVocal" && scene ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${(addFrameMode[img.sceneId] || "narration") === "narration" ? "text-primary" : "text-muted-foreground"}`}>
                          {language === "tr" ? "Narrasyon" : "Narration"}
                        </span>
                        <Switch
                          checked={(addFrameMode[img.sceneId] || "narration") === "prompt"}
                          onCheckedChange={(v) => setAddFrameMode(prev => ({ ...prev, [img.sceneId]: v ? "prompt" : "narration" }))}
                        />
                        <span className={`text-[10px] font-medium ${(addFrameMode[img.sceneId] || "narration") === "prompt" ? "text-primary" : "text-muted-foreground"}`}>
                          Prompt
                        </span>
                      </div>
                      {(addFrameMode[img.sceneId] || "narration") === "narration" && (
                        <Button
                          size="sm" variant="ghost" className="h-6 px-2"
                          onClick={() => playFrameTTS(img.sceneId)}
                          disabled={!selectedBgVoiceId || !scene.narration?.trim()}
                        >
                          {frameTTSPlaying === img.sceneId ? <Pause className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                        </Button>
                      )}
                    </div>
                    {(addFrameMode[img.sceneId] || "narration") === "narration" ? (
                      <Textarea
                        value={scene.narration || ""}
                        onChange={(e) => {
                          updateScene(scene.id, { narration: e.target.value });
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                        rows={2}
                        className="text-xs overflow-hidden"
                        style={{ resize: "none" }}
                        placeholder={language === "tr" ? "Bu kare için narrasyon yazın..." : "Write narration for this frame..."}
                      />
                    ) : (
                      <Textarea
                        value={addFramePrompt[img.sceneId] || scene.description || ""}
                        onChange={(e) => {
                          setAddFramePrompt(prev => ({ ...prev, [img.sceneId]: e.target.value }));
                          updateScene(scene.id, { description: e.target.value });
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
                        rows={2}
                        className="text-xs overflow-hidden"
                        style={{ resize: "none" }}
                        placeholder={language === "tr" ? "Görsel prompt'u yazın..." : "Write image prompt..."}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`kb-${img.sceneId}`}
                        checked={img.kenBurns ?? (storyMode === "bgVocal")}
                        onCheckedChange={(v) => updateImage(img.sceneId, { kenBurns: !!v })}
                      />
                      <label htmlFor={`kb-${img.sceneId}`} className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1">
                        <Move className="h-3 w-3" />
                        Ken Burns (Pan & Zoom)
                      </label>
                    </div>
                    {/* Animation prompt + button */}
                    {img.imageUrl && !img.generating && (
                      <div className="space-y-1.5">
                        {showAnimPrompt[img.sceneId] ? (
                          <>
                            <Textarea
                              value={animPromptDrafts[img.sceneId] ?? (() => {
                                const s = scenes.find(sc => sc.id === img.sceneId);
                                const desc = s?.description || "";
                                const defaultPrompt = language === "tr"
                                  ? `Bu sahneyi doğal, sinematik hareketlerle canlandır: ${desc.slice(0, 200)}`
                                  : `Animate this scene with subtle, natural cinematic movement: ${desc.slice(0, 200)}`;
                                return defaultPrompt;
                              })()}
                              onChange={(e) => setAnimPromptDrafts(prev => ({ ...prev, [img.sceneId]: e.target.value }))}
                              rows={2}
                              className="text-xs"
                              placeholder={language === "tr" ? "Animasyon yönergesini düzenleyin..." : "Edit animation prompt..."}
                            />
                            <div className="flex gap-1.5">
                              <Button
                                size="sm" variant="default" className="flex-1"
                                onClick={() => {
                                  // Set default prompt if user didn't edit
                                  if (!animPromptDrafts[img.sceneId]) {
                                    const s = scenes.find(sc => sc.id === img.sceneId);
                                    const desc = s?.description || "";
                                    const defaultPrompt = language === "tr"
                                      ? `Bu sahneyi doğal, sinematik hareketlerle canlandır: ${desc.slice(0, 200)}`
                                      : `Animate this scene with subtle, natural cinematic movement: ${desc.slice(0, 200)}`;
                                    setAnimPromptDrafts(prev => ({ ...prev, [img.sceneId]: defaultPrompt }));
                                  }
                                  generateFrameAnimation(img.sceneId);
                                  setShowAnimPrompt(prev => ({ ...prev, [img.sceneId]: false }));
                                }}
                                disabled={!!(animationJobs[img.sceneId] && (animationJobs[img.sceneId].status === "queued" || animationJobs[img.sceneId].status === "processing"))}
                              >
                                <Sparkles className="mr-1 h-3 w-3" />
                                {language === "tr" ? "Oluştur" : "Generate"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowAnimPrompt(prev => ({ ...prev, [img.sceneId]: false }))}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Button
                            size="sm" variant="outline" className="w-full"
                            onClick={() => {
                              // Auto-generate prompt and show editor
                              if (!animPromptDrafts[img.sceneId]) {
                                const s = scenes.find(sc => sc.id === img.sceneId);
                                const desc = s?.description || "";
                                const defaultPrompt = language === "tr"
                                  ? `Bu sahneyi doğal, sinematik hareketlerle canlandır: ${desc.slice(0, 200)}`
                                  : `Animate this scene with subtle, natural cinematic movement: ${desc.slice(0, 200)}`;
                                setAnimPromptDrafts(prev => ({ ...prev, [img.sceneId]: defaultPrompt }));
                              }
                              setShowAnimPrompt(prev => ({ ...prev, [img.sceneId]: true }));
                            }}
                            disabled={!!(animationJobs[img.sceneId] && (animationJobs[img.sceneId].status === "queued" || animationJobs[img.sceneId].status === "processing"))}
                          >
                            {animationJobs[img.sceneId]?.status === "queued" || animationJobs[img.sceneId]?.status === "processing" ? (
                              <><Loader2 className="mr-1 h-3 w-3 animate-spin" />{language === "tr" ? "Animasyon..." : "Animating..."}</>
                            ) : (
                              <><Sparkles className="mr-1 h-3 w-3" />{language === "tr" ? "Animasyonla" : "Animate"}</>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : storyMode !== "bgVocal" ? (
                  <>
                    <SceneDescriptionText text={scene?.description || ""} />
                    {scene?.dialogues && scene.dialogues.some(d => d.character || d.text) && (
                      <div className="space-y-1 mt-1">
                        {scene.dialogues.filter(d => d.character || d.text).map((d, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground/80">{d.character || "?"}: </span>{d.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}

                {activeOverlay && (
                  <div className="space-y-2 rounded-md border p-2">
                    <Textarea value={activeOverlay.text} onChange={(e) => updateOverlay(img.sceneId, activeOverlay.id, { text: e.target.value })} rows={2} className="resize-none text-sm" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t(language, "textSize")}</span>
                      <Slider value={[activeOverlay.fontSize]} onValueChange={([v]) => updateOverlay(img.sceneId, activeOverlay.id, { fontSize: v })} min={8} max={120} step={1} className="flex-1" />
                      <span className="text-xs w-6 text-right">{activeOverlay.fontSize}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{language === "tr" ? "Genişlik" : "Width"}</span>
                      <Slider value={[activeOverlay.width]} onValueChange={([v]) => updateOverlay(img.sceneId, activeOverlay.id, { width: v })} min={60} max={(img.naturalWidth || 1024)} step={5} className="flex-1" />
                      <span className="text-xs w-8 text-right">{activeOverlay.width}</span>
                    </div>
                    {/* Timing controls */}
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{language === "tr" ? "Başlangıç" : "Start"}</span>
                      <Input
                        type="number"
                        value={activeOverlay.startTime ?? 0}
                        onChange={(e) => updateOverlay(img.sceneId, activeOverlay.id, { startTime: Math.max(0, Number(e.target.value) || 0) })}
                        min={0} max={activeOverlay.endTime ?? (img.duration ?? bulkDuration)}
                        step={0.5}
                        className="w-14 h-6 text-[10px] text-center p-0"
                      />
                      <span className="text-[10px] text-muted-foreground">{language === "tr" ? "Bitiş" : "End"}</span>
                      <Input
                        type="number"
                        value={activeOverlay.endTime ?? (img.duration ?? bulkDuration)}
                        onChange={(e) => updateOverlay(img.sceneId, activeOverlay.id, { endTime: Math.min(img.duration ?? bulkDuration, Math.max(activeOverlay.startTime ?? 0, Number(e.target.value) || 0)) })}
                        min={activeOverlay.startTime ?? 0} max={img.duration ?? bulkDuration}
                        step={0.5}
                        className="w-14 h-6 text-[10px] text-center p-0"
                      />
                      <span className="text-[10px] text-muted-foreground">s</span>
                    </div>
                    {/* Invert toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{language === "tr" ? "Ters Renk (Beyaz metin)" : "Invert (White text)"}</span>
                      <Switch checked={activeOverlay.inverted ?? false} onCheckedChange={(v) => updateOverlay(img.sceneId, activeOverlay.id, { inverted: v })} />
                    </div>
                    {activeOverlay.type === "bubble" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{language === "tr" ? "Karakter" : "Character"}</span>
                          <Select value={activeOverlay.character || "_none"} onValueChange={(v) => updateOverlay(img.sceneId, activeOverlay.id, { character: v === "_none" ? undefined : v })}>
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue placeholder={language === "tr" ? "Seçin" : "Select"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">{language === "tr" ? "Karaktersiz" : "No character"}</SelectItem>
                              {getSceneCharacters(img.sceneId).map(cn => (
                                <SelectItem key={cn} value={cn}>{cn}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant={activeOverlay.flipH ? "default" : "outline"} onClick={() => updateOverlay(img.sceneId, activeOverlay.id, { flipH: !activeOverlay.flipH })}><FlipHorizontal className="mr-1 h-3 w-3" />{t(language, "flipH")}</Button>
                          <Button size="sm" variant={activeOverlay.flipV ? "default" : "outline"} onClick={() => updateOverlay(img.sceneId, activeOverlay.id, { flipV: !activeOverlay.flipV })}><FlipVertical className="mr-1 h-3 w-3" />{t(language, "flipV")}</Button>
                        </div>
                      </div>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteOverlay(img.sceneId, activeOverlay.id)}><Trash2 className="mr-1 h-3 w-3" />{t(language, "deleteText")}</Button>
                  </div>
                )}

                {revisionSceneId === img.sceneId ? (
                  <div className="space-y-2">
                    <Textarea value={revisionText} onChange={(e) => setRevisionText(e.target.value)} placeholder={t(language, "revisionNote")} rows={2} className="resize-none text-sm" />
                    {revisionAvatarBase64 && (
                      <div className="flex items-center gap-2">
                        <img src={revisionAvatarBase64} alt="avatar" className="h-10 w-10 rounded object-cover border" />
                        <Button size="sm" variant="ghost" onClick={() => setRevisionAvatarBase64(null)}>✕</Button>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => handleRevision(img.sceneId)} disabled={img.generating}><Send className="mr-1 h-3 w-3" />{t(language, "sendRevision")}</Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline"><ImagePlus className="mr-1 h-3 w-3" />{t(language, "revisionAvatar")}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2 space-y-1">
                          <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted">
                            <Upload className="h-3.5 w-3.5" />{t(language, "uploadFromComputer")}
                            <input type="file" accept="image/*" className="hidden" onChange={handleRevisionAvatarUpload} />
                          </label>
                          <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-muted" onClick={loadSavedCharacters}>
                            <History className="h-3.5 w-3.5" />{t(language, "fromHistory")}
                          </button>
                          {showSavedChars && savedChars.length > 0 && (
                            <div className="border-t pt-1 mt-1 max-h-40 overflow-y-auto space-y-1">
                              {savedChars.filter(c => c.image_url).map(c => (
                                <button key={c.id} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted" onClick={() => { setRevisionAvatarBase64(c.image_url!); setShowSavedChars(false); }}>
                                  <img src={c.image_url!} alt={c.name} className="h-6 w-6 rounded object-cover" /><span className="truncate">{c.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {showSavedChars && savedChars.length === 0 && (
                            <p className="text-xs text-muted-foreground px-2 py-1">{t(language, "noSavedCharacters")}</p>
                          )}
                        </PopoverContent>
                      </Popover>
                      <Button size="sm" variant="ghost" onClick={() => { setRevisionSceneId(null); setRevisionAvatarBase64(null); }}>✕</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {storyMode !== "voiceAnimation" && storyMode !== "bgVocal" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAddBubbleClick(img.sceneId)} disabled={img.generating}><MessageCircle className="mr-1 h-3 w-3" />{t(language, "addBubble")}</Button>
                        <Button size="sm" variant="outline" onClick={() => addOverlay(img.sceneId, "text")} disabled={img.generating}><Type className="mr-1 h-3 w-3" />{t(language, "addText")}</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => regenerate(img.sceneId)} disabled={img.generating}>
                      {img.generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                      {t(language, "regenerate")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRevisionSceneId(img.sceneId)} disabled={img.generating}><Edit3 className="mr-1 h-3 w-3" />{t(language, "revise")}</Button>
                  </div>
                )}

                {/* Per-frame video generation panel - always visible in voiceAnimation mode */}
                {storyMode === "voiceAnimation" && img.imageUrl && !img.generating && (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">{language === "tr" ? "Video Ayarları" : "Video Settings"}</span>
                    </div>
                    
                    <Textarea
                      value={videoPrompt[img.sceneId] || getDefaultPrompt(img.sceneId)}
                      onChange={(e) => setVideoPrompt(p => ({ ...p, [img.sceneId]: e.target.value }))}
                      placeholder={language === "tr" ? "Video prompt'unu düzenle..." : "Edit video prompt..."}
                      rows={3}
                      className="resize-none text-xs"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Süre" : "Duration"}</Label>
                        <Select value={videoDuration[img.sceneId] || "default"} onValueChange={(v) => setVideoDuration(p => ({ ...p, [img.sceneId]: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VIDEO_DURATIONS.map(d => (
                              <SelectItem key={d} value={d} className="text-xs">
                                {d === "default" ? (language === "tr" ? "Varsayılan" : "Default") : `${d}s`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">{language === "tr" ? "Çözünürlük" : "Resolution"}</Label>
                        <Select value={videoResolution[img.sceneId] || "720p"} onValueChange={(v) => setVideoResolution(p => ({ ...p, [img.sceneId]: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {VIDEO_RESOLUTIONS.map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-[10px]">{language === "tr" ? "Sabit Kamera" : "Camera Fixed"}</Label>
                      <Switch checked={videoCameraFixed[img.sceneId] || false} onCheckedChange={(v) => setVideoCameraFixed(p => ({ ...p, [img.sceneId]: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px]">{language === "tr" ? "Ses Oluştur" : "Generate Audio"}</Label>
                      <Switch checked={videoGenerateAudio[img.sceneId] !== false} onCheckedChange={(v) => setVideoGenerateAudio(p => ({ ...p, [img.sceneId]: v }))} />
                    </div>

                    {isVideoGenerating ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">
                          {job?.status === "queued" ? (language === "tr" ? "Sırada..." : "Queued...") : (language === "tr" ? "İşleniyor..." : "Processing...")}
                        </span>
                      </div>
                    ) : job?.status === "failed" ? (
                      <div className="flex items-center gap-2 py-1">
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-xs text-destructive">{job.error || "Failed"}</span>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => generateFrameVideo(img.sceneId)} disabled={!!isVideoGenerating || img.generating} className="w-full">
                        <Video className="mr-1 h-3 w-3" />
                        {language === "tr" ? "Video Oluştur" : "Generate Video"}
                      </Button>
                    )}
                  </div>
                )}

                {/* Video status badge */}
                {job?.status === "completed" && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    <span className="text-[10px] text-primary">{language === "tr" ? "Video hazır" : "Video ready"}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Generate All Images */}
      {images.some(img => !img.imageUrl && !img.generating) && (
        <Button onClick={generateAllImages} disabled={anyGenerating} className="w-full" variant="outline" size="lg">
          <Wand2 className="mr-2 h-4 w-4" />
          {language === "tr" ? "Tüm Görselleri Oluştur" : "Generate All Images"}
        </Button>
      )}

      {/* Add new frame + next step */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleAddFrame} disabled={anyGenerating} className="flex-1">
          <Plus className="mr-1 h-4 w-4" />
          {language === "tr" ? "Yeni Kare Ekle" : "Add New Frame"}
        </Button>
        <Button onClick={() => setStep(4)} disabled={anyGenerating} className="flex-1" size="lg">
          {t(language, "createVideo")}
        </Button>
      </div>
      {/* Hidden file input for reference uploads */}
      <input type="file" accept="image/*" ref={refFileInputRef} className="hidden" onChange={handleRefFileUpload} />

      {/* Character picker dialog for new bubble */}
      <Dialog open={!!bubbleCharPickerScene} onOpenChange={(open) => { if (!open) setBubbleCharPickerScene(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{language === "tr" ? "Karakter Seçin" : "Select Character"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {bubbleCharPickerScene && getSceneCharacters(bubbleCharPickerScene).map((charName) => {
              const cIdx = charName in globalCharColorMap ? globalCharColorMap[charName] : 0;
              return (
                <Button key={charName} variant="outline" className="justify-start gap-2" onClick={() => {
                  addOverlay(bubbleCharPickerScene, "bubble", charName);
                  setBubbleCharPickerScene(null);
                }}>
                  <div className="h-3 w-3 rounded-sm border" style={{ backgroundColor: PASTEL_COLORS[cIdx], borderColor: PASTEL_BORDERS[cIdx] }} />
                  {charName}
                </Button>
              );
            })}
            <Button variant="ghost" className="text-muted-foreground" onClick={() => {
              addOverlay(bubbleCharPickerScene!, "bubble");
              setBubbleCharPickerScene(null);
            }}>
              {language === "tr" ? "Karaktersiz ekle" : "Add without character"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
