import { CENTER_X, CENTER_Y, HEIGHT, WIDTH } from "./constants";
import { rgbCss } from "./colors";
import type { ColorScheme, StudioConfig } from "./types";

/** Persistent layer: dark background + arena fill (drawn once per reset). */
export class SceneBuffer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext("2d")!;
  }

  /** Dark background + filled white arena circle (no per-frame clear). */
  initArena(scheme: ColorScheme, borderRadius: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgbCss(scheme.bg);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, borderRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  /** ASMR "color consuming" stroke along the ball path. */
  drawEraserTrail(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    ballRadius: number,
    trailColor: string,
  ): void {
    if (fromX === toX && fromY === toY) return;
    const ctx = this.ctx;
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = ballRadius * 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }

  /** Fill remaining white arena when progress hits 1.0 */
  fillArenaConsumed(trailColor: string, borderRadius: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = trailColor;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, borderRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  scheme: ColorScheme,
  ballX: number,
  ballY: number,
  ringRadius: number,
): void {
  ctx.fillStyle = rgbCss(scheme.ball);
  ctx.beginPath();
  ctx.arc(ballX, ballY, ringRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbCss(scheme.ballHighlight);
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  opts: {
    scene: SceneBuffer;
    scheme: ColorScheme;
    ballX: number;
    ballY: number;
    config: StudioConfig;
    showHud?: boolean;
    recording?: boolean;
    elapsed: number;
    bounceCount: number;
    clearPct: number;
    displaySpeed: number;
    currentRadius: number;
    progress: number;
    frozen?: boolean;
    confettiParticles?: Array<{
      x: number;
      y: number;
      color: string;
      size: number;
      rotation: number;
      opacity: number;
    }>;
  },
): void {
  const {
    scene,
    scheme,
    ballX,
    ballY,
    config,
    showHud = true,
    recording = false,
    elapsed,
    bounceCount,
    clearPct,
    displaySpeed,
    currentRadius,
    progress,
    frozen = false,
  } = opts;

  const { borderRadius, targetTime } = config;

  // Composite persistent arena + trails (never clearRect the full frame)
  ctx.drawImage(scene.canvas, 0, 0);

  for (let g = 6; g > 0; g--) {
    const a = (15 * g) / 255;
    ctx.strokeStyle = rgbCss(scheme.borderGlow, a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, borderRadius + g, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = rgbCss(scheme.borderLine);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER_X, CENTER_Y, borderRadius, 0, Math.PI * 2);
  ctx.stroke();

  if (!frozen) {
    drawBall(ctx, scheme, ballX, ballY, currentRadius);
  }
  drawWatermark(ctx, config.watermarkText, config.watermarkOpacity);

  if (opts.confettiParticles && opts.confettiParticles.length > 0) {
    drawConfetti(ctx, opts.confettiParticles);
  }

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
    `Ring radius: ${currentRadius.toFixed(1)} px`,
    `Border radius: ${borderRadius} px`,
    `Ring speed: ${displaySpeed.toFixed(0)} px/frame`,
    `Progress: ${(progress * 100).toFixed(0)}%`,
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

  if (frozen) {
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = "rgb(100,220,140)";
    ctx.fillText("COMPLETE", WIDTH - 120, HEIGHT - 22);
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

export function captureFrame(
  scene: SceneBuffer,
  scheme: ColorScheme,
  ballX: number,
  ballY: number,
  config: StudioConfig,
  currentRadius: number,
  progress: number,
  frozen = false,
): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  drawScene(ctx, {
    scene,
    scheme,
    ballX,
    ballY,
    config,
    showHud: false,
    elapsed: 0,
    bounceCount: 0,
    clearPct: frozen ? 1 : 0,
    displaySpeed: 0,
    currentRadius,
    progress,
    frozen,
  });
  return ctx.getImageData(0, 0, WIDTH, HEIGHT);
}

/** % of arena interior that has been "consumed" (no longer white). */
export function estimateClearPercentage(
  scene: SceneBuffer,
  borderRadius: number,
): number {
  const scale = 6;
  const sw = Math.floor(WIDTH / scale);
  const sh = Math.floor(HEIGHT / scale);
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d")!;
  sctx.drawImage(scene.canvas, 0, 0, sw, sh);
  const data = sctx.getImageData(0, 0, sw, sh).data;
  const cx = CENTER_X / scale;
  const cy = CENTER_Y / scale;
  const br = borderRadius / scale;
  let count = 0;
  let cleared = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= br * br) {
        count++;
        const i = (y * sw + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Consumed = dark trail/background (not white arena)
        if (r + g + b < 600) cleared++;
      }
    }
  }
  return count === 0 ? 0 : cleared / count;
}

export function drawConfetti(
  ctx: CanvasRenderingContext2D,
  particles: Array<{
    x: number;
    y: number;
    color: string;
    size: number;
    rotation: number;
    opacity: number;
  }>,
): void {
  ctx.save();
  for (const p of particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
  ctx.restore();
}
