import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { FPS, FRAME_SKIP } from "./simulation/constants";
import { rgbToHex } from "./simulation/colors";
import type { Rgb } from "./simulation/types";

const FRAME_DELAY_MS = Math.round(1000 / (FPS / FRAME_SKIP));

/** Encodes frames one-by-one so a 60s capture does not hold ~1800 ImageData blobs in RAM. */
export class GifStreamEncoder {
  private gif = GIFEncoder();
  private frameCount = 0;

  addFrame(imageData: ImageData): void {
    const rgba = imageData.data;
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    this.gif.writeFrame(index, imageData.width, imageData.height, {
      palette,
      delay: FRAME_DELAY_MS,
      dispose: 2,
    });
    this.frameCount += 1;
  }

  finish(): { bytes: Uint8Array; frameCount: number } {
    if (this.frameCount === 0) {
      throw new Error("No frames to encode");
    }
    this.gif.finish();
    return { bytes: this.gif.bytes(), frameCount: this.frameCount };
  }
}

/** @deprecated Prefer GifStreamEncoder during capture */
export function encodeTransparentGif(frames: ImageData[]): Uint8Array {
  const encoder = new GifStreamEncoder();
  for (const frame of frames) encoder.addFrame(frame);
  return encoder.finish().bytes;
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

export type GifExportResult = { bytes: Uint8Array; frameCount: number };
