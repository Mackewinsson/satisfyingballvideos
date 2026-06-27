import { CINEMATIC_CONFIG, CENTER_X, CENTER_Y } from "./constants";
import { generateColorScheme, rgbCss } from "./colors";
import {
  SceneBuffer,
  drawScene,
  estimateTrailProgress,
  captureFrame,
} from "./renderer";
import {
  createDropInitialState,
  isSignificantBounce,
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
  prevBounceX: number | null = null;
  prevBounceY: number | null = null;
  elapsed = 0;
  clearPct = 0;
  displaySpeed = 0;
  private clearTimer = 0;

  /** Timer for guaranteed full consume (performance.now() ms). */
  startTime: number | null = null;
  progress = 0;
  currentRadius = 0;
  currentBorderRadius = 0;
  initialBallRadius = 0;
  isComplete = false;

  recording = false;
  config: StudioConfig;
  /** Live ball hue (updates on bounce when ballColorPerBounce is on). */
  private activeBallHue = 0;

  private syncTrailColor(): void {
    this.trailColor =
      this.config.trailMode === "paint" || this.config.trailMode === "weave" || this.config.trailMode === "grow"
        ? rgbCss(this.scheme.ball)
        : rgbCss(this.scheme.bg);
  }

  constructor(config: StudioConfig) {
    this.config = normalizeStudioConfig(config);
    this.activeBallHue = this.config.ballHue;
    this.scheme = generateColorScheme(
      this.config.baseHue,
      this.activeBallHue,
    );
    this.trailColor = rgbCss(this.scheme.bg);
    this.syncTrailColor();
    this.scene = new SceneBuffer();
    this.initArena();
    this.resetState();
  }

  private initArena(): void {
    this.scene.initArena(
      this.scheme,
      this.config.borderRadius,
      this.config.transparentBackground,
      this.config.trailMode,
      this.config.arenaColor,
    );
  }

  private beginAnimationClock(): void {
    this.startTime = null;
    this.progress = 0;
    this.isComplete = false;
  }

  updateConfig(partial: Partial<StudioConfig>): void {
    const prev = this.config;
    this.config = normalizeStudioConfig({ ...this.config, ...partial });
    const schemeChanged =
      this.config.baseHue !== prev.baseHue ||
      this.config.ballHue !== prev.ballHue ||
      this.config.arenaColor !== prev.arenaColor ||
      this.config.ballColorPerBounce !== prev.ballColorPerBounce ||
      this.config.borderRadius !== prev.borderRadius ||
      this.config.transparentBackground !== prev.transparentBackground ||
      this.config.trailMode !== prev.trailMode;
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
      this.syncTrailColor();
    }
    if (!this.isComplete) {
      this.clampBallInside();
    }
  }

  randomizeColors(): void {
    this.config = normalizeStudioConfig({
      ...this.config,
      baseHue: Math.random(),
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
    this.syncTrailColor();
  }

  private shiftBallColorOnBounce(): void {
    if (!this.config.ballColorPerBounce || this.config.trailMode === "paint") return;
    this.activeBallHue =
      (this.activeBallHue + CINEMATIC_CONFIG.ballHueShiftPerBounce) % 1;
    this.scheme = generateColorScheme(this.config.baseHue, this.activeBallHue);
    this.syncTrailColor();
  }

  private syncPrevBall(): void {
    this.prevBallX = this.ballX;
    this.prevBallY = this.ballY;
  }

  private clampBallInside(): void {
    const { restitution } = this.config;
    const resolved = resolveCircleCollision(
      this.ballX,
      this.ballY,
      this.velX,
      this.velY,
      this.currentBorderRadius,
      this.currentRadius,
      restitution,
    );
    this.ballX = resolved.ballX;
    this.ballY = resolved.ballY;
    this.velX = resolved.velX;
    this.velY = resolved.velY;
  }

  resetState(): void {
    const drop = createDropInitialState(this.config);
    this.ballX = drop.ballX;
    this.ballY = drop.ballY;
    this.prevBallX = drop.ballX;
    this.prevBallY = drop.ballY;
    this.velX = drop.velX;
    this.velY = drop.velY;
    this.bounceCount = 0;
    this.prevBounceX = null;
    this.prevBounceY = null;
    this.elapsed = 0;
    this.clearPct = 0;
    this.clearTimer = 0;
    this.isComplete = false;
    this.activeBallHue = this.config.ballHue;
    this.applyScheme();
    this.initialBallRadius = this.config.ringRadius;
    this.currentRadius = this.initialBallRadius;
    this.currentBorderRadius = this.config.borderRadius;
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
  }

  private markSimulationComplete(): void {
    this.clearPct = 1;
    this.progress = 1;
    this.velX = 0;
    this.velY = 0;
    this.isComplete = true;
    this.spawnConfetti();
  }

  private finalizeTrail(): void {
    if (this.isComplete) return;
    const { borderRadius, transparentBackground, trailMode } = this.config;
    // Grow mode paints nested rings incrementally — never flood-fill the arena.
    if (trailMode === "grow") {
      this.markSimulationComplete();
      return;
    }
    if (trailMode === "paint") {
      this.scene.fillArenaPainted(this.trailColor, borderRadius, transparentBackground);
    } else {
      this.scene.fillArenaErased(this.trailColor, borderRadius, transparentBackground);
    }
    this.markSimulationComplete();
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

  getBrushRadius(): number {
    return this.config.eraserStart;
  }

  tick(nowMs: number, dtMs: number): void {
    this.updateProgress(nowMs);

    if (this.isComplete) {
      this.updateConfetti();
      return;
    }

    // Always run the full targetTime unless the arena is physically full (grow mode).
    if (this.progress >= 1.0) {
      this.finalizeTrail();
      return;
    }

    const { borderRadius, gravity, restitution } = this.config;
    const ballR = this.currentRadius;

    // 1. Gravity
    this.velY += gravity;

    // 2. Move
    const prevX = this.ballX;
    const prevY = this.ballY;
    this.ballX += this.velX;
    this.ballY += this.velY;

    // 3. Circle boundary bounce
    const resolved = resolveCircleCollision(
      this.ballX,
      this.ballY,
      this.velX,
      this.velY,
      this.currentBorderRadius,
      ballR,
      restitution,
    );
    this.ballX = resolved.ballX;
    this.ballY = resolved.ballY;
    this.velX = resolved.velX;
    this.velY = resolved.velY;

    // Minimum Energy Injection
    if (this.progress < 1.0 && gravity > 0) {
      const h = (CENTER_Y + this.currentBorderRadius - ballR) - this.ballY;
      const pe = gravity * Math.max(0, h);
      const ke = 0.5 * (this.velX * this.velX + this.velY * this.velY);
      const totalEnergy = pe + ke;
      
      const MIN_ENERGY = 40.0;
      const BOOST_ENERGY = 150.0;
      
      if (totalEnergy < MIN_ENERGY) {
        const targetKe = BOOST_ENERGY - pe;
        if (targetKe > 0) {
          if (ke > 0.1) {
            const factor = Math.sqrt(targetKe / ke);
            this.velX *= factor;
            this.velY *= factor;
          } else {
            const speed = Math.sqrt(2 * targetKe);
            this.velX = (Math.random() > 0.5 ? 1 : -1) * (speed * 0.5);
            this.velY = -speed * 0.866;
          }
        }
      }
    }

    this.displaySpeed = Math.hypot(this.velX, this.velY);

    const brushR = this.getBrushRadius();
    const transparent = this.config.transparentBackground;
    const trailColor = this.trailColor;

    if (this.config.trailMode === "paint") {
      this.scene.drawPaintTrail(
        prevX,
        prevY,
        this.ballX,
        this.ballY,
        brushR,
        trailColor,
      );
    } else if (this.config.trailMode === "erase") {
      this.scene.drawEraseTrail(
        prevX,
        prevY,
        this.ballX,
        this.ballY,
        brushR,
        trailColor,
        transparent,
      );
    }

    if (resolved.collided && isSignificantBounce(resolved.impactSpeed)) {
      if (this.config.trailMode === "paint") {
        this.scene.drawWallGapPaint(
          this.ballX,
          this.ballY,
          borderRadius,
          ballR,
          brushR,
          trailColor,
        );
      } else if (this.config.trailMode === "erase") {
        this.scene.drawWallGapErase(
          this.ballX,
          this.ballY,
          borderRadius,
          ballR,
          brushR,
          trailColor,
          transparent,
        );
      } else if (this.config.trailMode === "weave") {
        if (this.prevBounceX !== null && this.prevBounceY !== null) {
          this.scene.drawWeaveLine(
            this.prevBounceX,
            this.prevBounceY,
            this.ballX,
            this.ballY,
            trailColor,
            this.config.weaveLineWidth,
          );
        }
        this.prevBounceX = this.ballX;
        this.prevBounceY = this.ballY;
      } else if (this.config.trailMode === "grow") {
        const RING_THICKNESS = this.config.growRingThickness;
        const trapRadius = this.currentBorderRadius - RING_THICKNESS / 2;
        this.currentRadius = Math.min(
          this.currentRadius + this.config.growRate,
          trapRadius,
        );

        if (this.currentRadius >= trapRadius) {
          this.scene.drawMergedRing(this.currentBorderRadius, RING_THICKNESS, trailColor);
          this.currentBorderRadius -= RING_THICKNESS;

          if (this.currentBorderRadius < this.config.ringRadius * 2) {
            this.markSimulationComplete();
            return;
          }

          this.currentRadius = this.config.ringRadius;
          this.ballX = CENTER_X;
          this.ballY = CENTER_Y;
          this.velX = (Math.random() - 0.5) * 5;
          this.velY = 0;
          this.clampBallInside();
        }
      }
      this.bounceCount += 1;
      this.shiftBallColorOnBounce();
      if (this.onBounceCallback) {
        this.onBounceCallback(this.bounceCount, this.displaySpeed);
      }
    }

    this.prevBallX = this.ballX;
    this.prevBallY = this.ballY;

    if (this.recording) {
      this.clearPct = estimateTrailProgress(
        this.scene,
        borderRadius,
        this.config.transparentBackground,
        this.config.trailMode,
        this.config.arenaColor,
      );
    } else {
      this.clearTimer += dtMs;
      if (this.clearTimer > 1500) {
        this.clearPct = estimateTrailProgress(
          this.scene,
          borderRadius,
          this.config.transparentBackground,
          this.config.trailMode,
          this.config.arenaColor,
        );
        this.clearTimer = 0;
      }
    }
  }

  isRecordingComplete(): boolean {
    return this.recording && this.isComplete && this.confettiParticles.length === 0;
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
      ballHue: this.activeBallHue,
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
      this.confettiParticles,
      this.activeBallHue,
    );
  }
}

export { FPS, FRAME_SKIP, WIDTH, HEIGHT } from "./constants";
