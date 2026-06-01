import { CINEMATIC_CONFIG } from "./constants";
import { generateColorScheme, rgbCss } from "./colors";
import {
  SceneBuffer,
  drawScene,
  estimateClearPercentage,
  captureFrame,
} from "./renderer";
import {
  computeDynamicRadius,
  createDropInitialState,
  createSeededRandom,
  enforceMinimumMotion,
  resolveCircleCollision,
  targetDurationMs,
} from "./physics";
import type { ColorScheme, StudioConfig } from "./types";
import { normalizeStudioConfig } from "./types";

export class Simulation {
  scheme: ColorScheme;
  scene: SceneBuffer;
  private trailColor: string;
  onBounceCallback?: (bounceCount: number, speed: number) => void;
  confettiParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
  }> = [];

  ballX = 0;
  ballY = 0;
  prevBallX = 0;
  prevBallY = 0;
  velX = 0;
  velY = 0;
  bounceCount = 0;
  elapsed = 0;
  clearPct = 0;
  displaySpeed = 0;
  private clearTimer = 0;

  /** Timer for guaranteed full consume (performance.now() ms). */
  startTime: number | null = null;
  progress = 0;
  currentRadius = 0;
  initialBallRadius = 0;
  isComplete = false;

  recording = false;
  config: StudioConfig;
  /** Live ball hue (updates on bounce when ballColorPerBounce is on). */
  private activeBallHue = 0;
  private rng: () => number = Math.random;

  constructor(config: StudioConfig) {
    this.config = normalizeStudioConfig(config);
    this.activeBallHue = this.config.ballHue;
    this.scheme = generateColorScheme(
      this.config.baseHue,
      this.activeBallHue,
    );
    this.trailColor = rgbCss(this.scheme.bg);
    this.scene = new SceneBuffer();
    this.initArena();
    this.resetState();
  }

  private initArena(): void {
    this.scene.initArena(this.scheme, this.config.borderRadius, this.config.transparentBackground);
  }

  private beginAnimationClock(): void {
    this.startTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.progress = 0;
    this.isComplete = false;
  }

  updateConfig(partial: Partial<StudioConfig>): void {
    const prev = this.config;
    this.config = normalizeStudioConfig({ ...this.config, ...partial });
    const schemeChanged =
      this.config.baseHue !== prev.baseHue ||
      this.config.ballHue !== prev.ballHue ||
      this.config.ballColorPerBounce !== prev.ballColorPerBounce ||
      this.config.borderRadius !== prev.borderRadius ||
      this.config.transparentBackground !== prev.transparentBackground;
    if (
      this.config.ballHue !== prev.ballHue ||
      this.config.ballColorPerBounce !== prev.ballColorPerBounce
    ) {
      this.activeBallHue = this.config.ballHue;
    }
    if (schemeChanged) {
      this.applyScheme();
      this.initArena();
      this.syncPrevBall();
    } else {
      this.trailColor = rgbCss(this.scheme.bg);
    }
    if (!this.isComplete) {
      this.clampBallInside();
    }
  }

  randomizeColors(): void {
    this.config = normalizeStudioConfig({
      ...this.config,
      baseHue: Math.random(),
      seed: Math.floor(Math.random() * 1e9),
    });
    this.applyScheme();
    this.initArena();
    this.syncPrevBall();
  }

  applyScheme(): void {
    this.scheme = generateColorScheme(
      this.config.baseHue,
      this.activeBallHue,
    );
    this.trailColor = rgbCss(this.scheme.bg);
  }

  private shiftBallColorOnBounce(): void {
    if (!this.config.ballColorPerBounce) return;
    this.activeBallHue =
      (this.activeBallHue + CINEMATIC_CONFIG.ballHueShiftPerBounce) % 1;
    this.scheme = generateColorScheme(this.config.baseHue, this.activeBallHue);
  }

  private syncPrevBall(): void {
    this.prevBallX = this.ballX;
    this.prevBallY = this.ballY;
  }

  private clampBallInside(): void {
    const { borderRadius, restitution } = this.config;
    const resolved = resolveCircleCollision(
      this.ballX,
      this.ballY,
      this.velX,
      this.velY,
      borderRadius,
      this.currentRadius,
      restitution,
      this.config.initialSpeed,
    );
    this.ballX = resolved.ballX;
    this.ballY = resolved.ballY;
    this.velX = resolved.velX;
    this.velY = resolved.velY;
  }

  resetState(): void {
    this.rng = createSeededRandom(this.config.seed);
    const drop = createDropInitialState(this.config, this.rng);
    this.ballX = drop.ballX;
    this.ballY = drop.ballY;
    this.prevBallX = drop.ballX;
    this.prevBallY = drop.ballY;
    this.velX = drop.velX;
    this.velY = drop.velY;
    this.bounceCount = 0;
    this.elapsed = 0;
    this.clearPct = 0;
    this.clearTimer = 0;
    this.isComplete = false;
    this.activeBallHue = this.config.ballHue;
    this.applyScheme();
    this.initialBallRadius = this.config.ringRadius;
    this.currentRadius = this.initialBallRadius;
    this.beginAnimationClock();
    this.initArena();
    this.confettiParticles = [];
  }

  startRecording(): void {
    this.applyScheme();
    this.resetState();
    this.recording = true;
  }

  stopRecording(): void {
    this.recording = false;
  }

  /** Top of loop: elapsed progress 0–1 from targetDuration. */
  private updateProgress(nowMs: number): void {
    if (this.startTime === null) {
      this.startTime = nowMs;
    }
    const elapsedTime = nowMs - this.startTime;
    const duration = targetDurationMs(this.config);
    this.progress = Math.min(elapsedTime / duration, 1.0);
    this.elapsed = elapsedTime / 1000;
    
    // Only update continuously if growthMode is set to time
    if (this.config.growthMode === "time") {
      this.currentRadius = computeDynamicRadius(
        this.progress,
        this.initialBallRadius,
        this.config.borderRadius,
      );
    }
  }

  private finalizeConsumption(): void {
    if (this.isComplete) return;
    this.scene.fillArenaConsumed(this.trailColor, this.config.borderRadius, this.config.transparentBackground);
    this.clearPct = 1;
    this.progress = 1;
    this.velX = 0;
    this.velY = 0;
    this.isComplete = true;
    this.spawnConfetti();
  }

  spawnConfetti(): void {
    this.confettiParticles = [];
    const colors = ["#ff5e7e", "#ffab00", "#00d2fc", "#2bfb8d", "#c56cf0", "#fffa65"];
    
    // Spawn from bottom left shooting right-up
    for (let i = 0; i < 60; i++) {
      this.confettiParticles.push({
        x: 0,
        y: 800,
        vx: Math.random() * 15 + 8,
        vy: -(Math.random() * 18 + 14),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        opacity: 1.0
      });
    }

    // Spawn from bottom right shooting left-up
    for (let i = 0; i < 60; i++) {
      this.confettiParticles.push({
        x: 800,
        y: 800,
        vx: -(Math.random() * 15 + 8),
        vy: -(Math.random() * 18 + 14),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 6,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.25,
        opacity: 1.0
      });
    }
  }

  updateConfetti(): void {
    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const p = this.confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.98; // Air resistance
      p.vy *= 0.98;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.007; // Fade out slowly
      
      if (p.opacity <= 0 || p.y > 800 || p.x < -50 || p.x > 850) {
        this.confettiParticles.splice(i, 1);
      }
    }
  }

  getEraserRadius(): number {
    if (this.config.growthMode === "bounce") {
      return this.currentRadius * CINEMATIC_CONFIG.eraserBounceMultiplier;
    }
    // Time mode: stay thin early, widen gradually toward the end
    const ease = Math.pow(this.progress, 2);
    return this.config.eraserStart + (this.config.eraserEnd - this.config.eraserStart) * ease;
  }

  private getBounceJitter(): number {
    const t = Math.pow(this.progress, 1.2);
    return (
      this.config.jitterStart +
      (this.config.jitterEnd - this.config.jitterStart) * t
    );
  }

  tick(nowMs: number, dtMs: number): void {
    this.updateProgress(nowMs);

    if (this.isComplete) {
      this.updateConfetti();
      return;
    }

    // Always run the full targetTime — do not end early when cleared or at max ball size.
    if (this.progress >= 1.0) {
      this.finalizeConsumption();
      return;
    }

    const { borderRadius, gravity, friction, restitution } = this.config;
    const maxAllowedRadius = borderRadius - 5;

    // Smooth time-based speedup (scales current velocity vector smoothly)
    if (this.config.speedupMode === "time") {
      const targetSpeed = this.config.initialSpeed + (this.config.finalSpeed - this.config.initialSpeed) * Math.pow(this.progress, 1.5);
      const currentSpeed = Math.sqrt(this.velX ** 2 + this.velY ** 2);
      if (currentSpeed > 0.1) {
        this.velX = (this.velX / currentSpeed) * targetSpeed;
        this.velY = (this.velY / currentSpeed) * targetSpeed;
      }
    }

    // Gravity every frame, before position — never conditional
    this.velY += gravity;
    this.velX *= friction;
    this.velY *= friction;

    const speed = Math.sqrt(this.velX ** 2 + this.velY ** 2);
    this.displaySpeed = speed;

    const steps = Math.max(1, Math.floor(Math.max(speed, 1) / 3));
    let segFromX = this.prevBallX;
    let segFromY = this.prevBallY;

    for (let s = 0; s < steps; s++) {
      const ballR = this.currentRadius;
      const nextX = this.ballX + this.velX / steps;
      const nextY = this.ballY + this.velY / steps;

      const resolved = resolveCircleCollision(
        nextX,
        nextY,
        this.velX,
        this.velY,
        borderRadius,
        ballR,
        restitution,
        this.config.initialSpeed,
        { rng: this.rng, jitter: this.getBounceJitter() },
      );

      const eraserR = this.getEraserRadius();

      this.scene.drawEraserTrail(
        segFromX,
        segFromY,
        resolved.ballX,
        resolved.ballY,
        eraserR,
        this.trailColor,
        this.config.transparentBackground,
      );

      if (resolved.collided) {
        this.scene.drawWallGapFill(
          resolved.ballX,
          resolved.ballY,
          borderRadius,
          ballR,
          eraserR,
          this.trailColor,
          this.config.transparentBackground,
        );
      }

      segFromX = resolved.ballX;
      segFromY = resolved.ballY;

      this.ballX = resolved.ballX;
      this.ballY = resolved.ballY;
      this.velX = resolved.velX;
      this.velY = resolved.velY;

      if (resolved.collided) {
        this.bounceCount += 1;
        this.shiftBallColorOnBounce();

        // Apply bounce-based speedup
        if (this.config.speedupMode === "bounce") {
          const preSpeed = Math.sqrt(this.velX ** 2 + this.velY ** 2);
          const postSpeed = preSpeed * this.config.speedMultiplierPerBounce;
          if (preSpeed > 1e-6) {
            this.velX = (this.velX / preSpeed) * postSpeed;
            this.velY = (this.velY / preSpeed) * postSpeed;
          }
        }

        // Apply bounce-based growth
        if (this.config.growthMode === "bounce") {
          this.currentRadius = Math.min(
            maxAllowedRadius,
            this.currentRadius + this.config.radiusIncrementPerBounce
          );
        }

        // Trigger satisfying ASMR bounce chime callback
        if (this.onBounceCallback) {
          const finalSpeed = Math.sqrt(this.velX ** 2 + this.velY ** 2);
          this.onBounceCallback(this.bounceCount, finalSpeed);
        }
      }
    }

    const currentBallR = this.currentRadius;
    const motion = enforceMinimumMotion(
      this.velX,
      this.velY,
      this.ballX,
      this.ballY,
      borderRadius,
      currentBallR,
      this.config.initialSpeed,
    );
    this.velX = motion.velX;
    this.velY = motion.velY;

    this.prevBallX = this.ballX;
    this.prevBallY = this.ballY;

    if (this.recording) {
      this.clearPct = estimateClearPercentage(this.scene, borderRadius);
    } else {
      this.clearTimer += dtMs;
      if (this.clearTimer > 1500) {
        this.clearPct = estimateClearPercentage(this.scene, borderRadius);
        this.clearTimer = 0;
      }
    }
  }

  isRecordingComplete(): boolean {
    return this.recording && this.isComplete;
  }

  shouldAnimate(): boolean {
    return !this.isComplete || this.confettiParticles.length > 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawScene(ctx, {
      scene: this.scene,
      scheme: this.scheme,
      ballX: this.ballX,
      ballY: this.ballY,
      config: this.config,
      showHud: true,
      recording: this.recording,
      elapsed: this.elapsed,
      bounceCount: this.bounceCount,
      clearPct: this.clearPct,
      displaySpeed: this.displaySpeed,
      currentRadius: this.currentRadius,
      progress: this.progress,
      frozen: this.isComplete,
      confettiParticles: this.confettiParticles,
    });
  }

  captureTransparentFrame(): ImageData {
    return captureFrame(
      this.scene,
      this.scheme,
      this.ballX,
      this.ballY,
      this.config,
      this.currentRadius,
      this.progress,
      this.isComplete,
    );
  }
}

export { FPS, FRAME_SKIP, WIDTH, HEIGHT } from "./constants";
