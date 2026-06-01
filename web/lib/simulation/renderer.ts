import {
  BORDER_RADIUS,
  CENTER_X,
  CENTER_Y,
  HEIGHT,
  RING_RADIUS,
  WIDTH,
} from "./constants";
import { hsvToRgb, rgbCss } from "./colors";
import type { ColorScheme, StudioConfig } from "./types";

export function buildGradientCanvas(scheme: ColorScheme): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const baseHue = scheme.baseHue;
  for (let r = BORDER_RADIUS; r > 0; r--) {
    const t = r / BORDER_RADIUS;
    const hue = (baseHue + 0.12 * (1 - t)) % 1;
    const sat = 0.75 + 0.15 * t;
    const val = 0.35 + 0.55 * (1 - t) ** 1.5;
    const [red, green, blue] = hsvToRgb(hue, sat, val);
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

export function createEraseCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return canvas;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  opts: {
    scheme: ColorScheme;
    gradientCanvas: HTMLCanvasElement;
    eraseCanvas: HTMLCanvasElement;
    ballX: number;
    ballY: number;
    config: Pick<StudioConfig, "watermarkText" | "watermarkOpacity">;
    showHud?: boolean;
    recording?: boolean;
    elapsed: number;
    targetTime: number;
    bounceCount: number;
    clearPct: number;
    displaySpeed: number;
  },
): void {
  const {
    scheme,
    gradientCanvas,
    eraseCanvas,
    ballX,
    ballY,
    config,
    showHud = true,
    recording = false,
    elapsed,
    targetTime,
    bounceCount,
    clearPct,
    displaySpeed,
  } = opts;

  ctx.fillStyle = rgbCss(scheme.bg);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const vis = document.createElement("canvas");
  vis.width = WIDTH;
  vis.height = HEIGHT;
  const vctx = vis.getContext("2d")!;
  vctx.drawImage(gradientCanvas, 0, 0);
  vctx.globalCompositeOperation = "destination-out";
  vctx.drawImage(eraseCanvas, 0, 0);
  vctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, BORDER_RADIUS, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(vis, 0, 0);
  ctx.restore();

  for (let g = 6; g > 0; g--) {
    const a = (15 * g) / 255;
    ctx.strokeStyle = rgbCss(scheme.borderGlow, a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, BORDER_RADIUS + g, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = rgbCss(scheme.borderLine);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, BORDER_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  const glowR = RING_RADIUS * 3;
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowR * 2;
  glowCanvas.height = glowR * 2;
  const gctx = glowCanvas.getContext("2d")!;
  for (let gr = glowR; gr > RING_RADIUS; gr -= 2) {
    const a = Math.max(
      0,
      45 * (1 - (gr - RING_RADIUS) / (glowR - RING_RADIUS)),
    );
    gctx.fillStyle = rgbCss(scheme.ball, a / 255);
    gctx.beginPath();
    gctx.arc(glowR, glowR, gr, 0, Math.PI * 2);
    gctx.fill();
  }
  ctx.drawImage(glowCanvas, ballX - glowR, ballY - glowR);

  ctx.fillStyle = rgbCss(scheme.ball);
  ctx.beginPath();
  ctx.arc(ballX, ballY, RING_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbCss(scheme.ballHighlight);
  ctx.lineWidth = 2;
  ctx.stroke();

  drawWatermark(ctx, config.watermarkText, config.watermarkOpacity);

  if (!showHud) return;

  const remaining = Math.max(0, targetTime - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining) % 60;
  ctx.font = "bold 22px monospace";
  ctx.fillStyle = remaining < 10 ? "rgb(230,60,60)" : "rgb(200,200,210)";
  ctx.fillText(`${mins}:${secs.toString().padStart(2, "0")}`, 15, 28);

  ctx.font = "bold 14px monospace";
  ctx.fillStyle = "rgb(140,140,160)";
  ctx.fillText("SATISFYING PHYSICS LAB", 15, 48);

  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "rgb(200,200,210)";
  const stats = [
    `Ring radius: ${RING_RADIUS} px`,
    `Border radius: ${BORDER_RADIUS} px`,
    `Ring speed: ${displaySpeed.toFixed(0)} px/frame`,
  ];
  stats.forEach((label, i) => ctx.fillText(label, WIDTH - 230, 20 + i * 20));

  ctx.font = "bold 18px monospace";
  ctx.fillStyle = "rgb(80,160,255)";
  ctx.fillText(`BOUNCES: ${bounceCount}`, 15, HEIGHT - 45);
  ctx.font = "bold 16px monospace";
  ctx.fillStyle = "rgb(100,180,255)";
  ctx.fillText(`CLEARED: ${(clearPct * 100).toFixed(1)}%`, 15, HEIGHT - 22);

  if (recording) {
    ctx.fillStyle = "rgb(230,40,40)";
    ctx.beginPath();
    ctx.arc(WIDTH - 20, 15, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "bold 16px monospace";
    ctx.fillText("REC", WIDTH - 65, 20);
  }
}

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  text: string,
  opacity: number,
): void {
  if (!text.trim()) return;
  ctx.save();
  ctx.font = "bold 44px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = opacity;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.toUpperCase(), CENTER_X, CENTER_Y);
  ctx.restore();
}

export function captureTransparentFrame(
  scheme: ColorScheme,
  gradientCanvas: HTMLCanvasElement,
  eraseCanvas: HTMLCanvasElement,
  ballX: number,
  ballY: number,
  config: Pick<StudioConfig, "watermarkText" | "watermarkOpacity">,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  drawScene(ctx, {
    scheme,
    gradientCanvas,
    eraseCanvas,
    ballX,
    ballY,
    config,
    showHud: false,
    elapsed: 0,
    targetTime: 60,
    bounceCount: 0,
    clearPct: 0,
    displaySpeed: 0,
  });
  return ctx.getImageData(0, 0, WIDTH, HEIGHT);
}

export function estimateClearPercentage(
  eraseCanvas: HTMLCanvasElement,
): number {
  const scale = 6;
  const sw = Math.floor(WIDTH / scale);
  const sh = Math.floor(HEIGHT / scale);
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(eraseCanvas, 0, 0, sw, sh);
  const data = sctx.getImageData(0, 0, sw, sh).data;
  const cx = CENTER_X / scale;
  const cy = CENTER_Y / scale;
  const br = BORDER_RADIUS / scale;
  let count = 0;
  let cleared = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= br * br) {
        count++;
        const i = (y * sw + x) * 4;
        if (data[i + 3] > 60) cleared++;
      }
    }
  }
  return count === 0 ? 0 : cleared / count;
}
