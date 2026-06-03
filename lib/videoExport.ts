import JSZip from "jszip";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { rgbToHex } from "./simulation/colors";
import { HEIGHT, WIDTH } from "./simulation/constants";
import type { Rgb } from "./simulation/types";

/** Full-rate export for MP4 (simulation runs at 120 fps). */
export const MP4_FPS = 120;
const MP4_BITRATE = 12_000_000;
const MP4_AUDIO_BITRATE = 192_000;
const MP4_AUDIO_SAMPLE_RATE = 48_000;
const H264_CODEC = "avc1.4d0034";

/**
 * Packages a list of PNG data URLs into a sequential ZIP archive.
 * Triggers compression progress reporting.
 */
export class PngSequenceExporter {
  private zip = new JSZip();
  private frameCount = 0;

  addFrame(dataUrl: string): void {
    // Extract base64 part of the data URL
    const base64Data = dataUrl.split(",")[1];
    if (!base64Data) return;

    const filename = `frame_${String(this.frameCount).padStart(5, "0")}.png`;
    this.zip.file(filename, base64Data, { base64: true });
    this.frameCount++;
  }

  addAudio(audioBlob: Blob): void {
    this.zip.file("soundtrack.wav", audioBlob);
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  async finish(
    onProgress?: (percent: number) => void
  ): Promise<Blob> {
    if (this.frameCount === 0) {
      throw new Error("No frames recorded");
    }

    return await this.zip.generateAsync({ type: "blob" }, (metadata) => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent));
      }
    });
  }
}

function getMp4MediaRecorderMimeType(): string | null {
  if (typeof window === "undefined" || !window.MediaRecorder) return null;
  const candidates = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs="avc1.42E01E"',
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

async function isWebCodecsH264Supported(
  width: number,
  height: number,
): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    const result = await VideoEncoder.isConfigSupported({
      codec: H264_CODEC,
      width,
      height,
      bitrate: MP4_BITRATE,
      framerate: MP4_FPS,
    });
    return result.supported === true;
  } catch {
    return false;
  }
}

/**
 * True when the browser can produce H.264 MP4 (WebCodecs or MediaRecorder).
 */
export async function isMp4ExportSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (await isWebCodecsH264Supported(WIDTH, HEIGHT)) return true;
  return getMp4MediaRecorderMimeType() !== null;
}

async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) return buffer;
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    Math.ceil(buffer.duration * targetSampleRate),
    targetSampleRate,
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

/**
 * Encodes a captured WAV soundtrack into the MP4 muxer via WebCodecs AAC.
 */
async function isAacEncoderSupported(): Promise<boolean> {
  if (typeof AudioEncoder === "undefined") return false;
  try {
    const result = await AudioEncoder.isConfigSupported({
      codec: "mp4a.40.2",
      sampleRate: MP4_AUDIO_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: MP4_AUDIO_BITRATE,
    });
    return result.supported === true;
  } catch {
    return false;
  }
}

async function muxWavAudio(
  wavBlob: Blob,
  muxer: Muxer<ArrayBufferTarget>,
  targetDurationSec?: number,
): Promise<void> {
  if (!(await isAacEncoderSupported())) {
    throw new Error("AAC audio encoding is not supported in this browser.");
  }

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => console.error("AudioEncoder error:", e),
  });

  audioEncoder.configure({
    codec: "mp4a.40.2",
    sampleRate: MP4_AUDIO_SAMPLE_RATE,
    numberOfChannels: 2,
    bitrate: MP4_AUDIO_BITRATE,
  });

  const decodeCtx = new AudioContext();
  const decoded = await decodeCtx.decodeAudioData(await wavBlob.arrayBuffer());
  await decodeCtx.close();

  const audioBuffer = await resampleAudioBuffer(decoded, MP4_AUDIO_SAMPLE_RATE);
  const targetSamples =
    targetDurationSec !== undefined
      ? Math.min(
          audioBuffer.length,
          Math.ceil(targetDurationSec * MP4_AUDIO_SAMPLE_RATE),
        )
      : audioBuffer.length;

  const left = audioBuffer.getChannelData(0).subarray(0, targetSamples);
  const rightSource =
    audioBuffer.numberOfChannels > 1
      ? audioBuffer.getChannelData(1)
      : audioBuffer.getChannelData(0);
  const right = rightSource.subarray(0, targetSamples);

  const blockSize = 1024;
  for (let offset = 0; offset < targetSamples; offset += blockSize) {
    const frames = Math.min(blockSize, targetSamples - offset);
    const planar = new Float32Array(frames * 2);
    for (let i = 0; i < frames; i++) {
      planar[i] = left[offset + i] ?? 0;
      planar[frames + i] = right[offset + i] ?? 0;
    }

    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate: MP4_AUDIO_SAMPLE_RATE,
      numberOfFrames: frames,
      numberOfChannels: 2,
      timestamp: Math.round((offset / MP4_AUDIO_SAMPLE_RATE) * 1_000_000),
      data: planar,
    });

    audioEncoder.encode(audioData);
    audioData.close();
  }

  await audioEncoder.flush();
  audioEncoder.close();
}

type Mp4ExportMode = "webcodecs" | "mediarecorder";

/**
 * Builds a 60 fps H.264 MP4 from transparent export frames (+ optional WAV audio).
 */
export class Mp4Exporter {
  private mode: Mp4ExportMode;
  private exportCanvas: HTMLCanvasElement;
  private exportCtx: CanvasRenderingContext2D;
  private frameIndex = 0;
  private compositeOnBlack: boolean;
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private videoEncoder: VideoEncoder | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private mimeType = "video/mp4";
  private format: "square" | "portrait";
  private backgroundColor: string;
  readonly fps: number = MP4_FPS;

  private constructor(
    mode: Mp4ExportMode,
    compositeOnBlack: boolean,
    format: "square" | "portrait" = "square",
    backgroundColor: string = "#ffffff"
  ) {
    this.mode = mode;
    this.compositeOnBlack = compositeOnBlack;
    this.format = format;
    this.backgroundColor = backgroundColor;
    this.exportCanvas = document.createElement("canvas");
    this.exportCanvas.width = 800;
    this.exportCanvas.height = format === "portrait" ? 1422 : 800;
    this.format = format;
    const ctx = this.exportCanvas.getContext("2d");
    if (!ctx) throw new Error("Could not create MP4 export canvas");
    this.exportCtx = ctx;
  }

  static async create(
    compositeOnBlack: boolean,
    audioStream?: MediaStream,
    withAudio = false,
    format: "square" | "portrait" = "square",
    backgroundColor: string = "#ffffff"
  ): Promise<Mp4Exporter> {
    const exporter = new Mp4Exporter(
      "webcodecs",
      compositeOnBlack,
      format,
      backgroundColor
    );

    if (await isWebCodecsH264Supported(800, format === "portrait" ? 1422 : 800)) {
      exporter.initWebCodecs(withAudio);
      return exporter;
    }

    const mimeType = getMp4MediaRecorderMimeType();
    if (!mimeType) {
      throw new Error("MP4 export is not supported in this browser.");
    }

    exporter.mode = "mediarecorder";
    exporter.mimeType = mimeType;
    exporter.initMediaRecorder(mimeType, audioStream);
    return exporter;
  }

  private initWebCodecs(withAudio: boolean): void {
    const width = 800;
    const height = this.format === "portrait" ? 1422 : 800;
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: "avc", width, height },
      ...(withAudio
        ? {
            audio: {
              codec: "aac" as const,
              sampleRate: MP4_AUDIO_SAMPLE_RATE,
              numberOfChannels: 2,
            },
          }
        : {}),
      fastStart: "in-memory",
    });

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer!.addVideoChunk(chunk, meta),
      error: (e) => console.error("VideoEncoder error:", e),
    });

    this.videoEncoder.configure({
      codec: H264_CODEC,
      width,
      height,
      bitrate: MP4_BITRATE,
      framerate: MP4_FPS,
    });
  }

  private initMediaRecorder(mimeType: string, audioStream?: MediaStream): void {
    this.stream = this.exportCanvas.captureStream(MP4_FPS);
    if (audioStream) {
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) this.stream.addTrack(audioTrack);
    }

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  addFrame(frameData: ImageData): void {
    if (this.format === "portrait") {
      this.exportCtx.fillStyle = this.compositeOnBlack ? "#000000" : this.backgroundColor;
      this.exportCtx.fillRect(0, 0, 800, 1422);
      const offsetY = Math.floor((1422 - 800) / 2);
      
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = 800;
      tempCanvas.height = 800;
      tempCanvas.getContext("2d")!.putImageData(frameData, 0, 0);
      
      this.exportCtx.drawImage(tempCanvas, 0, offsetY);
    } else {
      if (this.compositeOnBlack) {
        this.exportCtx.fillStyle = "#000000";
        this.exportCtx.fillRect(0, 0, 800, 800);
      } else {
        this.exportCtx.clearRect(0, 0, 800, 800);
      }
      this.exportCtx.putImageData(frameData, 0, 0);
    }

    if (this.mode === "webcodecs" && this.videoEncoder) {
      const durationUs = Math.round(1_000_000 / MP4_FPS);
      const timestamp = this.frameIndex * durationUs;
      const frame = new VideoFrame(this.exportCanvas, {
        timestamp,
        duration: durationUs,
      });
      this.videoEncoder.encode(frame, {
        keyFrame: this.frameIndex % (MP4_FPS * 2) === 0,
      });
      frame.close();
    }

    this.frameIndex++;
  }

  getFrameCount(): number {
    return this.frameIndex;
  }

  getMode(): Mp4ExportMode {
    return this.mode;
  }

  async finish(audioWav?: Blob | null): Promise<Blob> {
    if (this.mode === "webcodecs") {
      if (!this.videoEncoder || !this.muxer) {
        throw new Error("MP4 encoder was not initialized");
      }
      if (this.frameIndex === 0) throw new Error("No frames recorded");

      if (audioWav && audioWav.size > 44) {
        const durationSec = this.frameIndex / MP4_FPS;
        await muxWavAudio(audioWav, this.muxer, durationSec);
      }

      await this.videoEncoder.flush();
      this.videoEncoder.close();
      this.muxer.finalize();
      return new Blob([this.muxer.target.buffer], { type: "video/mp4" });
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("MP4 recorder was not initialized"));
        return;
      }
      if (this.frameIndex === 0) {
        reject(new Error("No frames recorded"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        resolve(new Blob(this.recordedChunks, { type: this.mimeType }));
        this.stream?.getTracks().forEach((track) => track.stop());
      };
      this.mediaRecorder.onerror = () => reject(new Error("MP4 recording failed"));
      this.mediaRecorder.stop();
    });
  }
}

/**
 * Helper to check if WebM recording with transparency is supported in the browser.
 */
export function isWebMTransparentSupported(): boolean {
  if (typeof window === "undefined" || !window.MediaRecorder) return false;
  
  // Checking VP9 which supports alpha channel recording
  return (
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ||
    MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
  );
}

/**
 * Records canvas stream directly to transparent WebM.
 */
export class WebMAlphaRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  constructor(canvas: HTMLCanvasElement, fps: number = 30, audioStream?: MediaStream) {
    if (typeof window === "undefined") return;

    // Check supported MIME type with high probability of alpha support
    let options = { mimeType: "video/webm;codecs=vp9" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8" };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm" };
    }

    try {
      // Capture the canvas stream at the desired frame rate
      this.stream = canvas.captureStream(fps);
      if (this.stream) {
        if (audioStream) {
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            this.stream.addTrack(audioTrack);
          }
        }
        this.mediaRecorder = new MediaRecorder(this.stream, options);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
      }
    } catch (e) {
      console.error("Failed to initialize MediaRecorder:", e);
    }
  }

  start(): void {
    this.recordedChunks = [];
    if (this.mediaRecorder && this.mediaRecorder.state === "inactive") {
      this.mediaRecorder.start();
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(new Blob());
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "video/webm";
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        resolve(blob);
        
        // Stop stream tracks to release resource hooks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }
      };

      this.mediaRecorder.stop();
    });
  }
}

/**
 * Mixed-audio bus for export. A silent source keeps the stream alive between bounce events.
 */
export function createRecordingDestination(
  context: AudioContext,
): MediaStreamAudioDestinationNode {
  const dest = context.createMediaStreamDestination();
  const keepAlive = context.createConstantSource();
  keepAlive.offset.value = 0;
  keepAlive.connect(dest);
  keepAlive.start();
  return dest;
}

/**
 * Taps a MediaStreamDestination so capture runs for the full export duration.
 */
export class AudioWavRecorder {
  private context: AudioContext;
  private processor: ScriptProcessorNode | null = null;
  private mediaSource: MediaStreamAudioSourceNode | null = null;
  private buffers: Float32Array[][] = [[], []]; // Left and right channels
  private recording = false;

  constructor(context: AudioContext) {
    this.context = context;
  }

  startFromDestination(dest: MediaStreamAudioDestinationNode): void {
    this.buffers = [[], []];
    this.recording = true;

    const createProcessor =
      this.context.createScriptProcessor ||
      (this.context as AudioContext & { createJavaScriptNode?: typeof AudioContext.prototype.createScriptProcessor })
        .createJavaScriptNode;
    if (!createProcessor) {
      throw new Error("ScriptProcessor audio capture is not supported.");
    }

    this.processor = createProcessor.call(this.context, 4096, 2, 2);
    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      this.buffers[0].push(new Float32Array(e.inputBuffer.getChannelData(0)));
      this.buffers[1].push(new Float32Array(e.inputBuffer.getChannelData(1)));
    };

    this.mediaSource = this.context.createMediaStreamSource(dest.stream);
    this.mediaSource.connect(this.processor);
    this.processor.connect(this.context.destination);
  }

  stop(): Blob {
    this.recording = false;

    if (this.mediaSource) {
      this.mediaSource.disconnect();
      this.mediaSource = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    const leftBuffer = mergeBuffers(this.buffers[0]);
    const rightBuffer = mergeBuffers(this.buffers[1]);

    const audioBuffer = new AudioBuffer({
      length: leftBuffer.length,
      numberOfChannels: 2,
      sampleRate: this.context.sampleRate,
    });

    audioBuffer.copyToChannel(new Float32Array(leftBuffer), 0);
    audioBuffer.copyToChannel(new Float32Array(rightBuffer), 1);

    return bufferToWav(audioBuffer);
  }
}

function mergeBuffers(channelBuffer: Float32Array[]): Float32Array {
  if (channelBuffer.length === 0) return new Float32Array(0);
  const totalLength = channelBuffer.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const buf of channelBuffer) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  return bufferToWav(buffer);
}

function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels: Float32Array[] = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // chunk length
  setUint16(1);          // sample format (raw)
  setUint16(numOfChan);  // channel count
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2); // block align
  setUint16(16);         // bits per sample
  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // chunk length

  for (i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length - 4) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArr], { type: "audio/wav" });
}

/**
 * Helper to download raw exported blobs.
 */
export function downloadBlob(
  blob: Blob,
  extension: string,
  ballRgb: Rgb
): void {
  const hex = rgbToHex(ballRgb);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "_")
    .slice(0, 15);
  const filename = `satisfying_ring_${hex}_${stamp}.${extension}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
