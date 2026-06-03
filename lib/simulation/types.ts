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
    restitution: CINEMATIC_CONFIG.restitution,
    eraserStart: ballRadius * CINEMATIC_CONFIG.eraserStartFactor,
    targetTime: CINEMATIC_CONFIG.targetTime,
    initialSpeed: CINEMATIC_CONFIG.initialVelocityX,
  };
}

export type TrailMode = "erase" | "paint" | "weave";

export interface StudioConfig {
  watermarkText: string;
  watermarkOpacity: number;
  baseHue: number;
  ballHue: number;
  targetTime: number;
  ringRadius: number;
  borderRadius: number;
  initialSpeed: number;
  gravity: number;
  restitution: number;
  eraserStart: number;
  trailMode: TrailMode;
  soundEnabled: boolean;
  soundPalette: "pentatonic" | "escalating" | "chime" | "marimba";
  transparentBackground: boolean;
  /** Shift ball hue on every wall bounce. */
  ballColorPerBounce: boolean;
  arenaColor: string;
  portraitPaddingColor: string;
  weaveLineWidth: number;
}

export function normalizeStudioConfig(config: StudioConfig): StudioConfig {
  const borderRadius = clamp(config.borderRadius, 120, 385);
  const ringRadius = clamp(config.ringRadius, 4, borderRadius - 8);
  const initialSpeed = clamp(config.initialSpeed, 3, 40);
  const eraserStart = clamp(config.eraserStart, 4, 80);
  return {
    ...config,
    targetTime: clamp(config.targetTime, DURATION_MIN_SEC, DURATION_MAX_SEC),
    borderRadius,
    ringRadius,
    initialSpeed,
    gravity: clamp(config.gravity, 0, 2),
    restitution: clamp(config.restitution, 0.5, 1),
    eraserStart,
    watermarkOpacity: clamp(config.watermarkOpacity, 0.05, 0.8),
    ballHue: ((config.ballHue % 1) + 1) % 1,
    trailMode: config.trailMode === "paint" ? "paint" : config.trailMode === "weave" ? "weave" : "erase",
    soundEnabled: config.soundEnabled ?? true,
    soundPalette: config.soundPalette ?? "pentatonic",
    transparentBackground: config.transparentBackground ?? false,
    // Paint mode uses a fixed complement ball vs trail; hue shifts break the look.
    // Weave mode supports it for "Rainbow lines".
    ballColorPerBounce:
      config.trailMode === "paint" ? false : (config.ballColorPerBounce ?? false),
    arenaColor: config.arenaColor ?? "#ffffff",
    portraitPaddingColor: config.portraitPaddingColor ?? "#000000",
    weaveLineWidth: clamp(config.weaveLineWidth ?? 2, 1, 20),
  };
}

export const defaultStudioConfig = (): StudioConfig => {
  const baseHue = 0.6;
  return normalizeStudioConfig({
    watermarkText: "Satisfying ball videos",
    watermarkOpacity: 0.25,
    baseHue,
    ballHue: (baseHue + 0.5) % 1,
    ...buildPhysicsDefaults(),
    trailMode: "erase",
    soundEnabled: true,
    soundPalette: "pentatonic",
    transparentBackground: false,
    ballColorPerBounce: false,
    arenaColor: "#ffffff",
    portraitPaddingColor: "#000000",
    weaveLineWidth: 2,
  });
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
