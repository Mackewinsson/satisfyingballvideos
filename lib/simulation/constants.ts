/** Canvas size (square ASMR frame). */
export const WIDTH = 800;
export const HEIGHT = 800;
export const CENTER_X = WIDTH / 2;
export const CENTER_Y = HEIGHT / 2;

/**
 * Simple hypnotic ball defaults (Gemini template).
 * containerRadius ≈ 350 in the reference; we scale from canvas.
 */
export const CINEMATIC_CONFIG = {
  gravity: 0.4,
  containerRadiusFactor: 0.4375,
  ballRadius: 24,
  initialVelocityX: 8,
  restitution: 1.0,
  /** Paint brush radius (line width = radius × 2 in renderer). */
  eraserStartFactor: 1.2,
  /** Hue shift on bounce when ballColorPerBounce is on (15° in template). */
  ballHueShiftPerBounce: 15 / 360,
  targetTime: 60,
  durationMinSec: 10,
  durationMaxSec: 300,
  durationStepSec: 5,
  fps: 60,
  frameSkip: 2,
} as const;

export function scaleFromCanvas(
  canvasWidth = WIDTH,
  canvasHeight = HEIGHT,
): { containerRadius: number; ballRadius: number } {
  const containerRadius =
    Math.min(canvasWidth, canvasHeight) * CINEMATIC_CONFIG.containerRadiusFactor;
  return {
    containerRadius,
    ballRadius: CINEMATIC_CONFIG.ballRadius,
  };
}

export const FPS = CINEMATIC_CONFIG.fps;
export const FRAME_SKIP = CINEMATIC_CONFIG.frameSkip;
export const DURATION_MIN_SEC = CINEMATIC_CONFIG.durationMinSec;
export const DURATION_MAX_SEC = CINEMATIC_CONFIG.durationMaxSec;
export const DURATION_STEP_SEC = CINEMATIC_CONFIG.durationStepSec;

/** @deprecated Use scaleFromCanvas().containerRadius */
export const BORDER_RADIUS = scaleFromCanvas().containerRadius;
/** @deprecated Use scaleFromCanvas().ballRadius */
export const RING_RADIUS = scaleFromCanvas().ballRadius;
