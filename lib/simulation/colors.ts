import type { ColorScheme, Rgb } from "./types";

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const hh = ((h % 1) + 1) % 1;
  const ss = Math.min(s, 1);
  const vv = Math.min(v, 1);
  const i = Math.floor(hh * 6);
  const f = hh * 6 - i;
  const p = vv * (1 - ss);
  const q = vv * (1 - f * ss);
  const t = vv * (1 - (1 - f) * ss);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0:
      r = vv;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = vv;
      b = p;
      break;
    case 2:
      r = p;
      g = vv;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = vv;
      break;
    case 4:
      r = t;
      g = p;
      b = vv;
      break;
    case 5:
      r = vv;
      g = p;
      b = q;
      break;
  }
  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  ];
}

export function generateColorScheme(
  baseHue?: number,
  ballHue?: number,
): ColorScheme {
  const base = baseHue ?? Math.random();
  const ball = ballHue ?? (base + 0.5) % 1;
  return {
    baseHue: base,
    ball: hsvToRgb(ball, 0.85, 0.92),
    ballHighlight: hsvToRgb(ball, 0.4, 1),
    borderGlow: hsvToRgb(base, 0.15, 0.82),
    borderLine: hsvToRgb(base, 0.08, 0.88),
    bg: hsvToRgb(base, 0.5, 0.03),
  };
}

export function rgbToHex(rgb: Rgb): string {
  return rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [255, 80, 120];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Hue component 0–1 for ball color picker sync. */
export function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d < 1e-6) return 0;
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h /= 6;
  return h < 0 ? h + 1 : h;
}

export function ballColorFromHue(ballHue: number): Rgb {
  return hsvToRgb(ballHue, 0.85, 0.92);
}

function isAchromaticRgb([r, g, b]: Rgb, threshold = 20): boolean {
  return Math.max(r, g, b) - Math.min(r, g, b) < threshold;
}

/** White arena + ball hue 180° away — strongest ball vs arena contrast. */
export function contrastingBallArenaColors(seedHue = Math.random()): {
  arenaColor: string;
  ballHue: number;
  baseHue: number;
} {
  const baseHue = ((seedHue % 1) + 1) % 1;
  return {
    baseHue,
    ballHue: (baseHue + 0.5) % 1,
    arenaColor: "#ffffff",
  };
}

/** Swap ball and arena colors; achromatic arenas become a complement ball hue. */
export function swapBallAndArenaColors(
  ballHue: number,
  arenaColor: string,
): { ballHue: number; arenaColor: string } {
  const newArenaColor = `#${rgbToHex(ballColorFromHue(ballHue))}`;
  const arenaRgb = hexToRgb(arenaColor);
  const newBallHue = isAchromaticRgb(arenaRgb)
    ? (rgbToHue(...hexToRgb(newArenaColor)) + 0.5) % 1
    : rgbToHue(...arenaRgb);
  return { ballHue: newBallHue, arenaColor: newArenaColor };
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** High-contrast ball colors for paint mode (complement + outline vs trail). */
export function paintModeBallDisplay(paintHue: number): {
  fill: Rgb;
  highlight: Rgb;
  outline: Rgb;
} {
  const complement = (paintHue + 0.5) % 1;
  const fill = hsvToRgb(complement, 0.92, 0.98);
  const highlight = hsvToRgb(complement, 0.55, 1);
  const outline: Rgb =
    relativeLuminance(fill) > 0.55 ? [16, 16, 24] : [255, 255, 255];
  return { fill, highlight, outline };
}

export function rgbCss(rgb: Rgb, alpha = 1): string {
  return alpha < 1
    ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
    : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
