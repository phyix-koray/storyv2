// Draws the Storilyne logo watermark on a canvas context at bottom-right
// Uses the SVG logo loaded as an image
let _logoCache: HTMLImageElement | null = null;
let _logoLoading: Promise<HTMLImageElement> | null = null;

function loadLogo(): Promise<HTMLImageElement> {
  if (_logoCache) return Promise.resolve(_logoCache);
  if (_logoLoading) return _logoLoading;
  _logoLoading = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { _logoCache = img; resolve(img); };
    img.onerror = () => resolve(img); // fallback: will draw text
    img.src = "/logo_band_colored.svg";
  });
  return _logoLoading;
}

export async function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  opacity = 0.5
) {
  ctx.save();
  ctx.globalAlpha = opacity;

  try {
    const logo = await loadLogo();
    if (logo.naturalWidth > 0) {
      // Scale logo to ~15% of canvas width
      const logoW = Math.max(60, Math.round(canvasWidth * 0.15));
      const logoH = Math.round(logoW * (logo.naturalHeight / logo.naturalWidth));
      const x = canvasWidth - logoW - 12;
      const y = canvasHeight - logoH - 12;
      ctx.drawImage(logo, x, y, logoW, logoH);
      ctx.restore();
      return;
    }
  } catch {
    // fallback to text
  }

  // Fallback: text watermark
  const text = "storilyne AI";
  const fontSize = Math.max(14, Math.round(canvasWidth * 0.03));
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 2;
  const metrics = ctx.measureText(text);
  const x = canvasWidth - metrics.width - fontSize;
  const y = canvasHeight - fontSize;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Synchronous version for render loops that can't await
export function drawWatermarkSync(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  opacity = 0.5
) {
  ctx.save();
  ctx.globalAlpha = opacity;

  if (_logoCache && _logoCache.naturalWidth > 0) {
    const logoW = Math.max(60, Math.round(canvasWidth * 0.15));
    const logoH = Math.round(logoW * (_logoCache.naturalHeight / _logoCache.naturalWidth));
    const x = canvasWidth - logoW - 12;
    const y = canvasHeight - logoH - 12;
    ctx.drawImage(_logoCache, x, y, logoW, logoH);
  } else {
    const text = "storilyne AI";
    const fontSize = Math.max(14, Math.round(canvasWidth * 0.03));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    const metrics = ctx.measureText(text);
    const x = canvasWidth - metrics.width - fontSize;
    const y = canvasHeight - fontSize;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  ctx.restore();
}

// Preload the logo so sync version works
loadLogo();

// Check if watermark should be applied based on plan
export function shouldWatermark(plan: string): boolean {
  return plan === "free" || !plan;
}
