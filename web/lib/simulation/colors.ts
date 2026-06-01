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

export function generateColorScheme(baseHue?: number): ColorScheme {
  const base = baseHue ?? Math.random();
  const ballHue = (base + 0.5) % 1;
  return {
    baseHue: base,
    ball: hsvToRgb(ballHue, 0.85, 0.92),
    ballHighlight: hsvToRgb(ballHue, 0.4, 1),
    borderGlow: hsvToRgb(base, 0.15, 0.82),
    borderLine: hsvToRgb(base, 0.08, 0.88),
    bg: hsvToRgb(base, 0.5, 0.03),
  };
}

export function rgbToHex(rgb: Rgb): string {
  return rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}

export function rgbCss(rgb: Rgb, alpha = 1): string {
  return alpha < 1
    ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`
    : `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}
