import { CINEMATIC_CONFIG, DURATION_MAX_SEC, DURATION_MIN_SEC, scaleFromCanvas } from "./constants";

export type Rgb = [number, number, number];
export type Rgba = [number, number, number, number];

export interface ColorScheme {
  baseHue: number;
  ball: Rgb;
  ballHighlight: Rgb;
  borderGlow: Rgb;
  borderLine: Rgb;
  bg: Rgb;
}

export function buildPhysicsDefaults() {
  const { containerRadius, ballRadius } = scaleFromCanvas();
  return {
    borderRadius: containerRadius,
    ringRadius: ballRadius,
    gravity: CINEMATIC_CONFIG.gravity,
    initialVelX: CINEMATIC_CONFIG.initialVelocityX,
    initialVelY: CINEMATIC_CONFIG.initialVelocityY,
    friction: CINEMATIC_CONFIG.friction,
    restitution: CINEMATIC_CONFIG.restitution,
    eraserStart: ballRadius * CINEMATIC_CONFIG.eraserStartFactor,
    eraserEnd: ballRadius * CINEMATIC_CONFIG.eraserEndFactor,
    targetTime: CINEMATIC_CONFIG.targetTime,
    initialSpeed: 8,
    finalSpeed: 8,
    jitterStart: 0.25,
    jitterEnd: 0.5,
  };
}

export const PHYSICS_DEFAULTS = buildPhysicsDefaults();
export interface StudioConfig {
  watermarkText: string;
  watermarkOpacity: number;
  baseHue: number;
  ballHue: number;
  seed: number;
  targetTime: number;
  ringRadius: number;
  borderRadius: number;
  initialVelX: number;
  initialVelY: number;
  initialSpeed: number;
  finalSpeed: number;
  gravity: number;
  friction: number;
  restitution: number;
  eraserStart: number;
  eraserEnd: number;
  jitterStart: number;
  jitterEnd: number;
  // New physics modes
  growthMode: "time" | "bounce";
  speedupMode: "time" | "bounce";
  speedMultiplierPerBounce: number;
  radiusIncrementPerBounce: number;
  // Sound configuration
  soundEnabled: boolean;
  soundPalette: "pentatonic" | "escalating" | "chime" | "marimba";
  // Transparency
  transparentBackground: boolean;
  /** Shift ball hue on every wall bounce. */
  ballColorPerBounce: boolean;
}

export function normalizeStudioConfig(config: StudioConfig): StudioConfig {
  const borderRadius = clamp(config.borderRadius, 120, 385);
  const ringRadius = clamp(config.ringRadius, 4, borderRadius - 8);
  const initialSpeed = clamp(config.initialSpeed, 3, 40);
  const finalSpeed = clamp(
    Math.max(config.finalSpeed, initialSpeed),
    initialSpeed,
    55,
  );
  const eraserStart = clamp(config.eraserStart, 4, 80);
  const eraserEnd = clamp(Math.max(config.eraserEnd, eraserStart), eraserStart, 100);
  return {
    ...config,
    targetTime: clamp(config.targetTime, DURATION_MIN_SEC, DURATION_MAX_SEC),
    borderRadius,
    ringRadius,
    initialVelX: config.initialVelX,
    initialVelY: config.initialVelY,
    initialSpeed,
    finalSpeed,
    gravity: clamp(config.gravity, 0, 2),
    friction: clamp(config.friction, 0.85, 1),
    restitution: clamp(config.restitution, 0.5, 1),
    eraserStart,
    eraserEnd,
    jitterStart: clamp(config.jitterStart, 0, 0.5),
    jitterEnd: clamp(Math.max(config.jitterEnd, config.jitterStart), 0, 0.7),
    watermarkOpacity: clamp(config.watermarkOpacity, 0.05, 0.8),
    ballHue: ((config.ballHue % 1) + 1) % 1,
    growthMode: config.growthMode ?? "bounce",
    speedupMode: config.speedupMode ?? "bounce",
    speedMultiplierPerBounce: clamp(config.speedMultiplierPerBounce ?? 1.01, 1.0, 1.25),
    radiusIncrementPerBounce: clamp(config.radiusIncrementPerBounce ?? 1.0, 0.0, 15.0),
    soundEnabled: config.soundEnabled ?? true,
    soundPalette: config.soundPalette ?? "pentatonic",
    transparentBackground: config.transparentBackground ?? false,
    ballColorPerBounce: config.ballColorPerBounce ?? false,
  };
}

export const defaultStudioConfig = (): StudioConfig => {
  const baseHue = 0.6; // Beautiful static violet hue for stable SSR rendering
  return normalizeStudioConfig({
    watermarkText: "",
    watermarkOpacity: 0.25,
    baseHue,
    ballHue: (baseHue + 0.5) % 1,
    seed: 123456789,
    ...buildPhysicsDefaults(),
    growthMode: "bounce",
    speedupMode: "bounce",
    speedMultiplierPerBounce: 1.01,
    radiusIncrementPerBounce: 1.0,
    soundEnabled: true,
    soundPalette: "pentatonic",
    transparentBackground: false,
    ballColorPerBounce: false,
  });
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

