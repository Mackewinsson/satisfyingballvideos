import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { FPS, FRAME_SKIP } from "./simulation/constants";
import { rgbToHex } from "./simulation/colors";
import type { Rgb } from "./simulation/types";

export function encodeTransparentGif(frames: ImageData[]): Uint8Array {
  if (frames.length === 0) throw new Error("No frames to encode");
  const delay = Math.round(1000 / (FPS / FRAME_SKIP));
  const gif = GIFEncoder();
  const { width, height } = frames[0];

  for (const frame of frames) {
    const rgba = frame.data;
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay,
      dispose: 2,
    });
  }

  gif.finish();
  return gif.bytes();
}

export function downloadGif(bytes: Uint8Array, ballRgb: Rgb): void {
  const hex = rgbToHex(ballRgb);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "_")
    .slice(0, 15);
  const filename = `bouncing_ring_${hex}_${stamp}.gif`;
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
