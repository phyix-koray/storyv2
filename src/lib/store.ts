import { create } from "zustand";
import type { Language } from "./i18n";
import type { Character, ObjectAsset, Scene, GeneratedImage, AppStep, TextOverlay, ImageFormat, CharacterAvatar, StoryMode, FrameCharacter, ScriptLine, LipSyncFrame } from "./types";

interface AppState {
  language: Language;
  setLanguage: (lang: Language) => void;
  step: AppStep;
  setStep: (step: AppStep) => void;

  characters: Character[];
  addCharacter: (char: Character) => void;
  removeCharacter: (id: string) => void;
  updateCharacterRole: (id: string, role: string) => void;

  objectAssets: ObjectAsset[];
  addObjectAsset: (asset: ObjectAsset) => void;
  removeObjectAsset: (id: string) => void;
  updateObjectAssetDescription: (id: string, description: string) => void;

  storyLanguage: string;
  setStoryLanguage: (lang: string) => void;
  storyTopic: string;
  setStoryTopic: (topic: string) => void;
  frameCount: number | null;
  setFrameCount: (count: number | null) => void;
  artStyle: string;
  setArtStyle: (style: string) => void;
  imageFormat: ImageFormat;
  setImageFormat: (format: ImageFormat) => void;

  scenes: Scene[];
  setScenes: (scenes: Scene[]) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  addScene: () => void;
  removeScene: (id: string) => void;
  swapScenes: (indexA: number, indexB: number) => void;

  characterAvatars: CharacterAvatar[];
  setCharacterAvatars: (avatars: CharacterAvatar[]) => void;
  updateCharacterAvatar: (name: string, updates: Partial<CharacterAvatar>) => void;
  removeCharacterAvatar: (name: string) => void;

  images: GeneratedImage[];
  setImages: (images: GeneratedImage[]) => void;
  updateImage: (sceneId: string, updates: Partial<GeneratedImage>) => void;
  removeImage: (sceneId: string) => void;

  videoUrl: string | null;
  setVideoUrl: (url: string | null) => void;

  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  isGeneratingDraft: boolean;
  setIsGeneratingDraft: (v: boolean) => void;
  isGeneratingImages: boolean;
  setIsGeneratingImages: (v: boolean) => void;
  isCreatingVideo: boolean;
  setIsCreatingVideo: (v: boolean) => void;
  isGeneratingAvatars: boolean;
  setIsGeneratingAvatars: (v: boolean) => void;

  useCharacterAvatars: boolean;
  setUseCharacterAvatars: (v: boolean) => void;

  storyMode: StoryMode;
  setStoryMode: (mode: StoryMode) => void;

  singleFrameImage: string | null;
  setSingleFrameImage: (img: string | null) => void;
  singleFrameScript: string;
  setSingleFrameScript: (script: string) => void;
  sentenceCount: number;
  setSentenceCount: (count: number) => void;

  perFrameMode: boolean;
  setPerFrameMode: (v: boolean) => void;
  framePrompts: string[];
  setFramePrompts: (prompts: string[]) => void;
  updateFramePrompt: (index: number, value: string) => void;

  // Single frame mode
  frameCharacters: FrameCharacter[];
  setFrameCharacters: (chars: FrameCharacter[]) => void;
  parsedScript: ScriptLine[];
  setParsedScript: (lines: ScriptLine[]) => void;
  updateScriptLine: (index: number, updates: Partial<ScriptLine>) => void;
  lipSyncFrames: LipSyncFrame[];
  setLipSyncFrames: (frames: LipSyncFrame[]) => void;
  updateLipSyncFrame: (index: number, updates: Partial<LipSyncFrame>) => void;
  isAnalyzingFrame: boolean;
  setIsAnalyzingFrame: (v: boolean) => void;
  isGeneratingLipSync: boolean;
  setIsGeneratingLipSync: (v: boolean) => void;

  characterVoices: Record<string, string>;
  setCharacterVoices: (voices: Record<string, string>) => void;

  // Restored per-frame videos from History (frame_number -> videoUrl)
  restoredVideos: Record<number, string>;
  setRestoredVideos: (videos: Record<number, string>) => void;

  // Restored per-frame animation videos from History (frame_number -> videoUrl[])
  restoredAnimations: Record<number, string[]>;
  setRestoredAnimations: (anims: Record<number, string[]>) => void;

  // Per-frame media selection for merge: sceneId -> "image" | "video"
  frameMediaSelection: Record<string, "image" | "video">;
  setFrameMediaSelection: (sel: Record<string, "image" | "video">) => void;
  updateFrameMediaSelection: (sceneId: string, value: "image" | "video") => void;

  // Cached TTS audio per frame: sceneId -> { audioBase64, narrationText, voiceId, label }
  cachedTTSAudio: Record<string, { audioBase64: string; narrationText: string; voiceId: string; label: string }>;
  setCachedTTSAudio: (cache: Record<string, { audioBase64: string; narrationText: string; voiceId: string; label: string }>) => void;

  // Animation merge data (passed from step 3 to step 4)
  animMergeData: {
    videoUrls: string[];
    musicUrl: string | null;
    musicVolume: number;
    subtitleOptions: any;
    subtitlesEnabled: boolean;
    editedScenes: any[];
    mergedVideoUrl?: string | null;
  } | null;
  setAnimMergeData: (data: AppState["animMergeData"]) => void;

  resetStory: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: (typeof navigator !== "undefined" && navigator.language?.startsWith("tr") ? "tr" : "en") as "tr" | "en",
  setLanguage: (language) => set({ language }),
  step: 1,
  setStep: (step) => set({ step }),

  characters: [],
  addCharacter: (char) => set((s) => ({ characters: [...s.characters, char] })),
  removeCharacter: (id) => set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),
  updateCharacterRole: (id, role) =>
    set((s) => ({ characters: s.characters.map((c) => (c.id === id ? { ...c, role } : c)) })),

  objectAssets: [],
  addObjectAsset: (asset) => set((s) => ({ objectAssets: [...s.objectAssets, asset] })),
  removeObjectAsset: (id) => set((s) => ({ objectAssets: s.objectAssets.filter((a) => a.id !== id) })),
  updateObjectAssetDescription: (id, description) =>
    set((s) => ({ objectAssets: s.objectAssets.map((a) => (a.id === id ? { ...a, description } : a)) })),

  storyLanguage: (typeof navigator !== "undefined" && navigator.language?.startsWith("tr") ? "tr" : "en"),
  setStoryLanguage: (storyLanguage) => set({ storyLanguage }),
  storyTopic: "",
  setStoryTopic: (storyTopic) => set({ storyTopic }),
  frameCount: null,
  setFrameCount: (frameCount) => set({ frameCount }),
  artStyle: "default",
  setArtStyle: (artStyle) => set({ artStyle }),
  imageFormat: "square",
  setImageFormat: (imageFormat) => set({ imageFormat }),

  scenes: [],
  setScenes: (scenes) => set({ scenes }),
  updateScene: (id, updates) =>
    set((s) => ({ scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, ...updates } : sc)) })),
  addScene: () =>
    set((s) => {
      const num = s.scenes.length + 1;
      return {
        scenes: [
          ...s.scenes,
          { id: crypto.randomUUID(), number: num, description: "", dialogues: [{ character: "", text: "" }] },
        ],
      };
    }),
  removeScene: (id) =>
    set((s) => ({
      scenes: s.scenes.filter((sc) => sc.id !== id).map((sc, i) => ({ ...sc, number: i + 1 })),
    })),
  swapScenes: (indexA, indexB) =>
    set((s) => {
      const arr = [...s.scenes];
      [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]];
      return { scenes: arr.map((sc, i) => ({ ...sc, number: i + 1 })) };
    }),

  characterAvatars: [],
  setCharacterAvatars: (characterAvatars) => set({ characterAvatars }),
  updateCharacterAvatar: (name, updates) =>
    set((s) => ({
      characterAvatars: s.characterAvatars.map((a) => (a.name === name ? { ...a, ...updates } : a)),
    })),
  removeCharacterAvatar: (name) =>
    set((s) => ({
      characterAvatars: s.characterAvatars.filter((a) => a.name !== name),
    })),

  images: [],
  setImages: (images) => set({ images }),
  updateImage: (sceneId, updates) =>
    set((s) => ({ images: s.images.map((img) => (img.sceneId === sceneId ? { ...img, ...updates } : img)) })),
  removeImage: (sceneId) =>
    set((s) => ({ images: s.images.filter((img) => img.sceneId !== sceneId) })),

  videoUrl: null,
  setVideoUrl: (videoUrl) => set({ videoUrl }),

  currentProjectId: null,
  setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),

  isGeneratingDraft: false,
  setIsGeneratingDraft: (isGeneratingDraft) => set({ isGeneratingDraft }),
  isGeneratingImages: false,
  setIsGeneratingImages: (isGeneratingImages) => set({ isGeneratingImages }),
  isCreatingVideo: false,
  setIsCreatingVideo: (isCreatingVideo) => set({ isCreatingVideo }),
  isGeneratingAvatars: false,
  setIsGeneratingAvatars: (isGeneratingAvatars) => set({ isGeneratingAvatars }),

  useCharacterAvatars: true,
  setUseCharacterAvatars: (useCharacterAvatars) => set({ useCharacterAvatars }),

  storyMode: "multi",
  setStoryMode: (storyMode) => set({ storyMode }),

  singleFrameImage: null,
  setSingleFrameImage: (singleFrameImage) => set({ singleFrameImage }),
  singleFrameScript: "",
  setSingleFrameScript: (singleFrameScript) => set({ singleFrameScript }),
  sentenceCount: 2,
  setSentenceCount: (sentenceCount) => set({ sentenceCount }),

  perFrameMode: false,
  setPerFrameMode: (perFrameMode) => set({ perFrameMode }),
  framePrompts: [],
  setFramePrompts: (framePrompts) => set({ framePrompts }),
  updateFramePrompt: (index, value) =>
    set((s) => {
      const prompts = [...s.framePrompts];
      prompts[index] = value;
      return { framePrompts: prompts };
    }),

  frameCharacters: [],
  setFrameCharacters: (frameCharacters) => set({ frameCharacters }),
  parsedScript: [],
  setParsedScript: (parsedScript) => set({ parsedScript }),
  updateScriptLine: (index, updates) =>
    set((s) => ({
      parsedScript: s.parsedScript.map((line, i) => (i === index ? { ...line, ...updates } : line)),
    })),
  lipSyncFrames: [],
  setLipSyncFrames: (lipSyncFrames) => set({ lipSyncFrames }),
  updateLipSyncFrame: (index, updates) =>
    set((s) => ({
      lipSyncFrames: s.lipSyncFrames.map((f) => (f.index === index ? { ...f, ...updates } : f)),
    })),
  isAnalyzingFrame: false,
  setIsAnalyzingFrame: (isAnalyzingFrame) => set({ isAnalyzingFrame }),
  isGeneratingLipSync: false,
  setIsGeneratingLipSync: (isGeneratingLipSync) => set({ isGeneratingLipSync }),

  characterVoices: {},
  setCharacterVoices: (characterVoices) => set({ characterVoices }),

  restoredVideos: {},
  setRestoredVideos: (restoredVideos) => set({ restoredVideos }),

  restoredAnimations: {},
  setRestoredAnimations: (restoredAnimations) => set({ restoredAnimations }),

  frameMediaSelection: {},
  setFrameMediaSelection: (frameMediaSelection) => set({ frameMediaSelection }),
  updateFrameMediaSelection: (sceneId, value) => set((s) => ({ frameMediaSelection: { ...s.frameMediaSelection, [sceneId]: value } })),

  cachedTTSAudio: {},
  setCachedTTSAudio: (cachedTTSAudio) => set({ cachedTTSAudio }),

  animMergeData: null,
  setAnimMergeData: (animMergeData) => set({ animMergeData }),

  resetStory: () => set({
    step: 1,
    storyTopic: "",
    scenes: [],
    images: [],
    videoUrl: null,
    characters: [],
    objectAssets: [],
    characterAvatars: [],
    currentProjectId: null,
    frameCount: null,
    useCharacterAvatars: true,
    perFrameMode: false,
    framePrompts: [],
    singleFrameImage: null,
    singleFrameScript: "",
    sentenceCount: 2,
    frameCharacters: [],
    parsedScript: [],
    lipSyncFrames: [],
    isGeneratingDraft: false,
    isGeneratingImages: false,
    isCreatingVideo: false,
    isGeneratingAvatars: false,
    isAnalyzingFrame: false,
    isGeneratingLipSync: false,
    characterVoices: {},
    restoredVideos: {},
    restoredAnimations: {},
    frameMediaSelection: {},
    cachedTTSAudio: {},
    animMergeData: null,
  }),
}));
