// Model-based video pricing: per-second cost by model + resolution
const MODEL_PRICING: Record<string, Record<string, number>> = {
  seedance: { "480p": 0.10, "720p": 0.20, "1080p": 0.40 },
  wan:      { "720p": 0.30, "1080p": 0.45 },
  grok:     { "480p": 0.15, "720p": 0.25 },
  ltx:      { "1080p": 0.30, "1440p": 0.40, "2160p": 0.50 },
  hailuo:   { "480p": 0.10, "720p": 0.10 },
};

// Image cost per frame (Storilyne I1 — text-to-image & image-to-image)
export const IMAGE_COST = 0.06;

export function getVideoCost(resolution: string, duration: string | number, model?: string): number {
  const m = model || "seedance";
  const modelRates = MODEL_PRICING[m] || MODEL_PRICING["seedance"];
  const rate = modelRates[resolution] || Object.values(modelRates)[0];
  const dur = typeof duration === "string" ? (duration === "default" ? 5 : parseInt(duration)) : duration;
  return rate * (dur || 5);
}

// Display names for models (hide 3rd-party names)
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  seedance: "Storilyne V2 Model",
  wan: "Storilyne V4 Model",
  grok: "Storilyne V3 Model",
  ltx: "Storilyne V1 Model",
  hailuo: "Storilyne Animate",
};

// Short descriptions for each model (user-facing)
export const MODEL_DESCRIPTIONS: Record<string, Record<"en" | "tr", string>> = {
  grok:     { en: "Speed + prompt accuracy", tr: "Hız + prompt doğruluğu" },
  wan:      { en: "Cinematic storytelling", tr: "Sinematik hikaye anlatımı" },
  seedance: { en: "Character & lip-sync", tr: "Karakter & dudak senkronizasyonu" },
  ltx:      { en: "Cost + speed", tr: "Maliyet + hız" },
  hailuo:   { en: "Image animation", tr: "Görsel animasyonu" },
};

// Pricing table for UI display
export const VIDEO_MODEL_PRICING_TABLE = [
  { model: "seedance", name: "Storilyne V2 Model", resolutions: [
    { res: "480p", perSec: 0.10, per5s: 0.50 },
    { res: "720p", perSec: 0.20, per5s: 1.00 },
    { res: "1080p", perSec: 0.40, per5s: 2.00 },
  ]},
  { model: "grok", name: "Storilyne V3 Model", resolutions: [
    { res: "480p", perSec: 0.15, per5s: 0.75 },
    { res: "720p", perSec: 0.25, per5s: 1.25 },
  ]},
  { model: "wan", name: "Storilyne V4 Model", resolutions: [
    { res: "720p", perSec: 0.30, per5s: 1.50 },
    { res: "1080p", perSec: 0.45, per5s: 2.25 },
  ]},
  { model: "ltx", name: "Storilyne V1 Model", resolutions: [
    { res: "1080p", perSec: 0.30, per5s: 1.50 },
    { res: "1440p", perSec: 0.40, per5s: 2.00 },
    { res: "2160p", perSec: 0.50, per5s: 2.50 },
  ]},
  { model: "hailuo", name: "Storilyne Animate", resolutions: [
    { res: "-", perSec: 0.10, per5s: 0.50 },
  ]},
];