/**
 * Shared subtitle drawing utility for canvas-based video export.
 * Draws text at the bottom of the canvas with a semi-transparent background bar.
 */

export interface SubtitleOptions {
  fontSizeRatio?: number; // ratio of canvasHeight, default 0.035
  bgAlpha?: number; // background opacity, default 0.6
  maxWidthRatio?: number; // max text width as ratio of canvasWidth, default 0.85
  paddingRatio?: number; // vertical padding ratio, default 0.012
  bottomMarginRatio?: number; // bottom margin ratio, default 0.04
  fontFamily?: string; // default "sans-serif"
  textColor?: string; // default "#ffffff"
  bgColor?: string; // RGB part of background, default "0, 0, 0"
  fontWeight?: string; // default "bold"
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [""];
}

/**
 * Split text into chunks of ~wordsPerChunk words each.
 * Given a progress (0-1), return the current chunk to display.
 */
export function getSubtitleChunk(
  text: string,
  progress: number,
  wordsPerChunk: number = 5,
): string {
  if (!text || !text.trim()) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= wordsPerChunk) return text.trim();

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }

  const idx = Math.min(Math.floor(progress * chunks.length), chunks.length - 1);
  return chunks[idx];
}

export function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  canvasW: number,
  canvasH: number,
  options?: SubtitleOptions,
): void {
  if (!text || !text.trim()) return;

  const isMobileAspect = canvasH > canvasW; // portrait / mobile format
  const {
    fontSizeRatio = 0.035,
    bgAlpha = 0.6,
    maxWidthRatio = 0.85,
    paddingRatio = 0.012,
    bottomMarginRatio = isMobileAspect ? 0.18 : 0.04,
    fontFamily = "sans-serif",
    textColor = "#ffffff",
    bgColor = "0, 0, 0",
    fontWeight = "bold",
  } = options || {};

  const fontSize = Math.max(12, Math.round(canvasH * fontSizeRatio));
  const padding = Math.max(4, Math.round(canvasH * paddingRatio));
  const bottomMargin = Math.max(8, Math.round(canvasH * bottomMarginRatio));
  const maxWidth = canvasW * maxWidthRatio;

  ctx.save();

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const lines = wrapText(ctx, text.trim(), maxWidth);
  const lineHeight = fontSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const barHeight = totalTextHeight + padding * 2;
  const barY = canvasH - bottomMargin - barHeight;

  ctx.fillStyle = `rgba(${bgColor}, ${bgAlpha})`;
  const barX = (canvasW - maxWidth) / 2 - padding;
  const barW = maxWidth + padding * 2;
  const radius = Math.round(fontSize * 0.3);

  ctx.beginPath();
  ctx.moveTo(barX + radius, barY);
  ctx.lineTo(barX + barW - radius, barY);
  ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + radius);
  ctx.lineTo(barX + barW, barY + barHeight - radius);
  ctx.quadraticCurveTo(barX + barW, barY + barHeight, barX + barW - radius, barY + barHeight);
  ctx.lineTo(barX + radius, barY + barHeight);
  ctx.quadraticCurveTo(barX, barY + barHeight, barX, barY + barHeight - radius);
  ctx.lineTo(barX, barY + radius);
  ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
  ctx.closePath();
  ctx.fill();

  const textX = canvasW / 2;
  let textY = barY + padding;

  for (const line of lines) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = Math.max(1, fontSize * 0.08);
    ctx.strokeText(line, textX, textY);
    ctx.fillStyle = textColor;
    ctx.fillText(line, textX, textY);
    textY += lineHeight;
  }

  ctx.restore();
}
