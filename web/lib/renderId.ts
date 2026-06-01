import type { StudioConfig } from "./simulation/types";

export function computeRenderId(config: StudioConfig): string {
  const payload = JSON.stringify({
    watermarkText: config.watermarkText,
    watermarkOpacity: config.watermarkOpacity,
    baseHue: Math.round(config.baseHue * 1000) / 1000,
    targetTime: config.targetTime,
    seed: config.seed,
  });
  let h = 0;
  for (let i = 0; i < payload.length; i++) {
    h = (Math.imul(31, h) + payload.charCodeAt(i)) | 0;
  }
  return `render_${Math.abs(h).toString(36)}`;
}
