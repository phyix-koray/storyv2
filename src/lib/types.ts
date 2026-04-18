export interface Character {
  id: string;
  file: File;
  previewUrl: string;
  role: string;
  imageUrl?: string;
}

export interface ObjectAsset {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
  imageUrl?: string;
}

export interface Dialogue {
  character: string;
  text: string;
}

export interface ShotBreakdown {
  shot_type?: string;
  camera_distance?: string;
  camera_angle?: string;
  visual_focus?: string;
  characters_visible?: string[];
  character_positioning?: string;
  setting_detail?: string;
  lighting?: string;
  mood_atmosphere?: string;
  depth_of_field?: string;
}

export interface Scene {
  id: string;
  number: number;
  description: string;
  dialogues: Dialogue[];
  shot_breakdown?: ShotBreakdown;
  narration?: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  type: "text" | "bubble";
  flipH?: boolean;
  flipV?: boolean;
  startTime?: number;
  endTime?: number;
  inverted?: boolean;
  character?: string;
}

export interface GeneratedImage {
  sceneId: string;
  imageUrl: string;
  approved: boolean;
  generating: boolean;
  revisionNote?: string;
  textOverlays: TextOverlay[];
  naturalWidth?: number;
  naturalHeight?: number;
  duration?: number;
  kenBurns?: boolean;
}

export type ImageFormat = "square" | "mobile" | "desktop";

export interface CharacterAvatar {
  name: string;
  features?: string;
  imageUrl: string;
  generating?: boolean;
}

export type AppStep = 1 | 2 | 3 | 4;

export type StoryMode = "multi" | "single" | "voiceAnimation" | "bgVocal";

export interface FrameCharacter {
  id: string;
  name: string;
  description: string;
  position: string;
}

export interface ScriptLine {
  character_id: string;
  character_name: string;
  text: string;
}

export interface LipSyncFrame {
  index: number;
  imageUrl: string;
  speakingCharacter: string;
  text: string;
  approved: boolean;
  revisionNote?: string;
}

// Timeline Video Editor types
export interface TimelineClip {
  id: string;
  imageUrl: string;
  duration: number; // seconds
  label?: string;
}

export interface TimelineAudioClip {
  id: string;
  audioUrl: string;
  duration: number; // seconds
  label?: string;
  characterName?: string;
  text?: string;
  muted?: boolean;
  volume?: number; // 0-1
}

export interface TimelineMusicClip {
  id: string;
  audioUrl: string;
  duration: number;
  label: string;
  volume: number; // 0-1
  muted: boolean;
}

export type AIVideoModel = "wan" | "veo" | "kling" | "ltx" | "seedance" | "grok" | "hailuo";

export interface AIVideoJob {
  sceneId: string;
  model: AIVideoModel;
  requestId: string;
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
  falModel?: string;
  statusUrl?: string;
  responseUrl?: string;
}
