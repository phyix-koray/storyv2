export interface ArtStyle {
  id: string;
  label: string;
  prompt: string;
}

export const ART_STYLES: ArtStyle[] = [
  { id: "default", label: "Default", prompt: "" },
  { id: "anime", label: "Anime", prompt: "Anime style – big expressive eyes, vibrant colors, Japanese aesthetic" },
  { id: "manga", label: "Manga", prompt: "Manga style – black & white, heavy line work, paneled layout" },
  { id: "pixar", label: "Pixar-Style 3D", prompt: "Pixar-style 3D – rounded forms, warm lighting, cute characters" },
  { id: "cartoon", label: "Cartoon", prompt: "Cartoon style – simple shapes, exaggerated expressions" },
  { id: "chibi", label: "Chibi", prompt: "Chibi style – mini proportions, extreme cuteness" },
  { id: "vector", label: "Vector Illustration", prompt: "Vector illustration – flat colors, clean lines" },
  { id: "vintage", label: "Vintage / Retro", prompt: "Vintage retro style – 70s-90s color palettes" },
  { id: "handdrawn", label: "Hand-Drawn / Sketch", prompt: "Hand-drawn sketch style – pencil/pen feel" },
  { id: "photorealistic", label: "Photorealistic", prompt: "Photorealistic style – extremely close to real life" },
  { id: "cinematic", label: "Cinematic", prompt: "Cinematic style – film scene lighting & composition" },
  { id: "ghibli", label: "Ghibli", prompt: "Studio Ghibli style – soft watercolor, dreamy atmosphere" },
  { id: "marvel", label: "Marvel-Style Comic", prompt: "Marvel comic book style – bold colors, dynamic poses, detailed shading" },
  { id: "dc", label: "DC-Style Comic", prompt: "DC comic book style – dark tones, dramatic shadows, heroic poses" },
  { id: "simpsons", label: "Simpsons-Style", prompt: "Simpsons style – yellow skin tones, rounded features, bold outlines" },
  { id: "rickmorty", label: "Rick & Morty-Style", prompt: "Rick & Morty style – exaggerated sci-fi line art" },
  { id: "minecraft", label: "Minecraft-Style (Voxel)", prompt: "Minecraft voxel style – cube-based blocky world" },
  { id: "roblox", label: "Roblox-Style Avatar", prompt: "Roblox style – simple modular characters" },
  { id: "kawaii", label: "Kawaii", prompt: "Kawaii style – extremely cute, pastel colors" },
  { id: "sticker", label: "Sticker-Style", prompt: "Sticker style – thick outlines, sticker-like feel, white border" },
  { id: "familyguy", label: "Family Guy-Style", prompt: "Family Guy style – thick outlines, flat colors, exaggerated chin and nose shapes, simple backgrounds, TV animation look" },
];
