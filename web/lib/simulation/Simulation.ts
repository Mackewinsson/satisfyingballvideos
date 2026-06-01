import { FINAL_SPEED, FPS, GRAVITY, FRICTION, RING_RADIUS } from "./constants";
import { generateColorScheme } from "./colors";
import {
  buildGradientCanvas,
  createEraseCanvas,
  drawScene,
  estimateClearPercentage,
} from "./renderer";
import { getTimeCurves, reflectVelocity, spawnBall } from "./physics";
import type { ColorScheme, StudioConfig } from "./types";
import { BORDER_RADIUS, CENTER_X, CENTER_Y } from "./constants";

export class Simulation {
  scheme: ColorScheme;
  gradientCanvas: HTMLCanvasElement;
  eraseCanvas: HTMLCanvasElement;
  private eraseCtx: CanvasRenderingContext2D;

  ballX = 0;
  ballY = 0;
  velX = 0;
  velY = 0;
  bounceCount = 0;
  elapsed = 0;
  clearPct = 0;
  displaySpeed = 0;
  private clearTimer = 0;

  recording = false;
  config: StudioConfig;

  constructor(config: StudioConfig) {
    this.config = config;
    this.scheme = generateColorScheme(config.baseHue);
    this.gradientCanvas = buildGradientCanvas(this.scheme);
    this.eraseCanvas = createEraseCanvas();
    this.eraseCtx = this.eraseCanvas.getContext("2d")!;
    this.eraseCtx.globalCompositeOperation = "source-over";
    this.resetState();
  }

  updateConfig(partial: Partial<StudioConfig>): void {
    const prevHue = this.config.baseHue;
    this.config = { ...this.config, ...partial };
    if (partial.baseHue !== undefined && partial.baseHue !== prevHue) {
      this.applyScheme();
    }
  }

  randomizeColors(): void {
    this.config = {
      ...this.config,
      baseHue: Math.random(),
      seed: Math.floor(Math.random() * 1e9),
    };
    this.applyScheme();
  }

  applyScheme(): void {
    this.scheme = generateColorScheme(this.config.baseHue);
    this.gradientCanvas = buildGradientCanvas(this.scheme);
  }

  resetState(): void {
    const spawn = spawnBall();
    this.ballX = spawn.ballX;
    this.ballY = spawn.ballY;
    this.velX = spawn.velX;
    this.velY = spawn.velY;
    this.bounceCount = 0;
    this.elapsed = 0;
    this.clearPct = 0;
    this.clearTimer = 0;
    this.eraseCanvas = createEraseCanvas();
    this.eraseCtx = this.eraseCanvas.getContext("2d")!;
    this.eraseCtx.fillStyle = "rgba(0,0,0,1)";
  }

  startRecording(): void {
    this.applyScheme();
    this.resetState();
    this.recording = true;
  }

  stopRecording(): void {
    this.recording = false;
  }

  tick(dtMs: number): void {
    const dt = dtMs / 1000;
    this.elapsed += dt;
    const targetTime = this.config.targetTime;
    const progress = Math.min(this.elapsed / targetTime, 1);
    const { targetSpeed, eraserR, jitter } = getTimeCurves(progress);

    let velX = this.velX;
    let velY = this.velY;
    velY += GRAVITY;
    velX *= FRICTION;
    velY *= FRICTION;

    let speed = Math.sqrt(velX * velX + velY * velY);
    if (speed > 0.1) {
      const scaleF = targetSpeed / speed;
      velX *= scaleF;
      velY *= scaleF;
    }
    speed = targetSpeed;
    this.displaySpeed = speed;

    const nudge = (Math.random() * 2 - 1) * 0.005;
    velX += nudge * speed;
    velY += nudge * speed;

    const steps = Math.max(1, Math.floor(speed / 3));
    let subVx = velX / steps;
    let subVy = velY / steps;

    for (let s = 0; s < steps; s++) {
      this.ballX += subVx;
      this.ballY += subVy;

      this.eraseCtx.beginPath();
      this.eraseCtx.arc(this.ballX, this.ballY, eraserR, 0, Math.PI * 2);
      this.eraseCtx.fill();

      const dx = this.ballX - CENTER_X;
      const dy = this.ballY - CENTER_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist + RING_RADIUS >= BORDER_RADIUS) {
        if (dist > 0) {
          const overlap = dist + RING_RADIUS - BORDER_RADIUS;
          this.ballX -= (dx / dist) * overlap;
          this.ballY -= (dy / dist) * overlap;
        }

        let fullVx = subVx * steps;
        let fullVy = subVy * steps;
        [fullVx, fullVy] = reflectVelocity(
          this.ballX,
          this.ballY,
          fullVx,
          fullVy,
          jitter,
        );

        const refSpeed = Math.sqrt(fullVx * fullVx + fullVy * fullVy);
        if (refSpeed > 0.1) {
          const norm = targetSpeed / refSpeed;
          fullVx *= norm;
          fullVy *= norm;
        }

        velX = fullVx;
        velY = fullVy;
        subVx = velX / steps;
        subVy = velY / steps;
        this.bounceCount++;
      }
    }

    this.velX = velX;
    this.velY = velY;

    if (this.recording) {
      this.clearPct = estimateClearPercentage(this.eraseCanvas);
    } else {
      this.clearTimer += dtMs;
      if (this.clearTimer > 1500) {
        this.clearPct = estimateClearPercentage(this.eraseCanvas);
        this.clearTimer = 0;
      }
    }
  }

  isRecordingComplete(): boolean {
    return this.recording && this.elapsed >= this.config.targetTime;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawScene(ctx, {
      scheme: this.scheme,
      gradientCanvas: this.gradientCanvas,
      eraseCanvas: this.eraseCanvas,
      ballX: this.ballX,
      ballY: this.ballY,
      config: this.config,
      showHud: true,
      recording: this.recording,
      elapsed: this.elapsed,
      targetTime: this.config.targetTime,
      bounceCount: this.bounceCount,
      clearPct: this.clearPct,
      displaySpeed: this.displaySpeed,
    });
  }
}

export { FPS, FRAME_SKIP, WIDTH, HEIGHT } from "./constants";
