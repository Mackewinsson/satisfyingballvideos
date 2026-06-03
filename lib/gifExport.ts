import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { rgbToHex } from "./simulation/colors";
import type { Rgb } from "./simulation/types";
/** 50 fps is the highest perfectly smooth framerate for GIFs (exactly 20ms delay per frame). */
export const GIF_FPS = 50;
const FRAME_DELAY_MS = 20;

/** Encodes frames one-by-one so a long capture does not hold every ImageData in RAM. */
export class GifStreamEncoder {
  private gif = GIFEncoder();
  private frameCount = 0;

  constructor(private transparent: boolean = false) {}

  addFrame(imageData: ImageData): void {
    const rgba = imageData.data;
    
    let palette;
    let index;
    let transparentIndex = 0;

    if (this.transparent) {
      palette = quantize(rgba, 256, { format: "rgba4444", clearAlpha: true, clearAlphaThreshold: 0, clearAlphaColor: 0 });
      index = applyPalette(rgba, palette, "rgba4444");
      transparentIndex = palette.findIndex(c => c.length === 4 && c[3] === 0);
      if (transparentIndex === -1) transparentIndex = 0;
    } else {
      palette = quantize(rgba, 256);
      index = applyPalette(rgba, palette);
    }

    this.gif.writeFrame(index, imageData.width, imageData.height, {
      palette,
      delay: FRAME_DELAY_MS,
      dispose: 2,
      transparent: this.transparent,
      transparentIndex,
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
