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

export interface StudioConfig {
  watermarkText: string;
  watermarkOpacity: number;
  baseHue: number;
  targetTime: 30 | 60;
  seed: number;
}

export const defaultStudioConfig = (): StudioConfig => ({
  watermarkText: "MACKEWINSSON",
  watermarkOpacity: 0.25,
  baseHue: Math.random(),
  targetTime: 60,
  seed: Math.floor(Math.random() * 1e9),
});
