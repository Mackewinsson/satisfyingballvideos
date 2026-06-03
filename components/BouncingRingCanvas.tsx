"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Simulation, WIDTH, HEIGHT } from "@/lib/simulation/Simulation";
import { GifStreamEncoder, GIF_FPS, type GifExportResult } from "@/lib/gifExport";
import {
  type BounceEvent,
  renderBounceSoundtrack,
  scheduleBounceNote,
} from "@/lib/bounceAudio";
import type { StudioConfig } from "@/lib/simulation/types";
import {
  audioBufferToWav,
  createRecordingDestination,
  Mp4Exporter,
  MP4_FPS,
  PngSequenceExporter,
  WebMAlphaRecorder,
  AudioWavRecorder,
} from "@/lib/videoExport";

let audioCtx: AudioContext | null = null;
let activeRecordingNode: AudioNode | null = null;

export function setActiveRecordingNode(node: AudioNode | null): void {
  activeRecordingNode = node;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function resumeAudioCtx(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
}

/** Live capture rate for ZIP / WebM (one frame every 4 × 120 Hz physics steps). */
const LIVE_EXPORT_FPS = 30;

type ExportKind = "gif" | "zip" | "webm" | "mp4";

function captureFrameBudget(targetTimeSec: number): number {
  return Math.ceil(targetTimeSec * LIVE_EXPORT_FPS);
}

function parseExportPercent(
  text: string | null,
  kind: ExportKind,
  targetTimeSec: number,
): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.min(100, Number.parseInt(trimmed, 10));
  }
  const zipPct = trimmed.match(/Compressing ZIP:\s*(\d+)%/i);
  if (zipPct) return Math.min(100, Number.parseInt(zipPct[1], 10));

  const frameMatch =
    trimmed.match(/Captured frame (\d+)/i) ?? trimmed.match(/Frame (\d+)/i);
  if (frameMatch && (kind === "zip" || kind === "webm")) {
    const budget = captureFrameBudget(targetTimeSec);
    return Math.min(99, Math.round((Number.parseInt(frameMatch[1], 10) / budget) * 100));
  }
  return null;
}

function exportStatusLabel(kind: ExportKind, progressText: string | null): string {
  if (progressText && !/^\d+$/.test(progressText.trim())) {
    return progressText;
  }
  switch (kind) {
    case "mp4":
      return "Encoding MP4…";
    case "gif":
      return "Encoding GIF…";
    case "zip":
      return "Capturing PNG sequence…";
    case "webm":
      return "Recording WebM…";
  }
}

function playBounceNote(config: StudioConfig, bounceCount: number, speed: number) {
  if (!config.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;

  scheduleBounceNote(ctx, ctx.destination, config, bounceCount, speed, ctx.currentTime);
  if (activeRecordingNode) {
    scheduleBounceNote(ctx, activeRecordingNode, config, bounceCount, speed, ctx.currentTime);
  }
}

type Props = {
  config: StudioConfig;
  generating: boolean;
  exportType: "gif" | "zip" | "webm" | "mp4";
  exportFormat?: "square" | "portrait";
  onGeneratingChange: (v: boolean) => void;
  onRecordingComplete: (result: GifExportResult) => void;
  onZipComplete: (blob: Blob) => void;
  onWebMComplete: (blob: Blob) => void;
  onMp4Complete: (blob: Blob) => void;
  onProgress?: (progressText: string) => void;
  /** Restore defaults in parent and restart preview. */
  onReset?: () => void;
};

export function BouncingRingCanvas({
  config,
  generating,
  exportType,
  exportFormat = "square",
  onGeneratingChange,
  onRecordingComplete,
  onZipComplete,
  onWebMComplete,
  onMp4Complete,
  onProgress,
  onReset,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const frameCounterRef = useRef(0);
  const accumulatorRef = useRef(0);
  const simTimeRef = useRef(0);
  const physicsStepCounterRef = useRef(0);
  const pngExporterRef = useRef<PngSequenceExporter | null>(null);
  const webmRecorderRef = useRef<WebMAlphaRecorder | null>(null);
  const mp4ExporterRef = useRef<Mp4Exporter | null>(null);
  const mp4ExportActiveRef = useRef(false);
  const gifExportActiveRef = useRef(false);
  const bounceEventsRef = useRef<BounceEvent[]>([]);
  const audioRecorderRef = useRef<AudioWavRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const loopRef = useRef<(time: number) => void>(() => {});
  const previewingRef = useRef(true);
  const [previewing, setPreviewing] = useState(true);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  const reportProgress = useCallback(
    (text: string) => {
      setExportProgress(text);
      onProgress?.(text);
    },
    [onProgress],
  );

  const setPreviewingActive = useCallback((active: boolean) => {
    previewingRef.current = active;
    setPreviewing(active);
  }, []);

  const scheduleAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame((t) => loopRef.current(t));
  }, []);

  const finishRecording = useCallback(
    async (sim: Simulation) => {
      if (!sim.recording) return;
      sim.stopRecording();

      if (exportType === "zip") {
        const exporter = pngExporterRef.current;
        pngExporterRef.current = null;
        frameCounterRef.current = 0;

        let audioBlob: Blob | null = null;
        if (audioRecorderRef.current) {
          try {
            audioBlob = audioRecorderRef.current.stop();
          } catch (e) {
            console.error("Failed to compile WAV audio:", e);
          }
          audioRecorderRef.current = null;
          setActiveRecordingNode(null);
        }

        if (exporter) {
          try {
            if (audioBlob) {
              exporter.addAudio(audioBlob);
            }
            reportProgress("Creating ZIP archive…");
            const zipBlob = await exporter.finish((percent) => {
              reportProgress(`Compressing ZIP: ${percent}%`);
            });
            setExportProgress(null);
            onZipComplete(zipBlob);
            onGeneratingChange(false);
          } catch (e) {
            console.error("ZIP packaging failed:", e);
            reportProgress(e instanceof Error ? `ZIP Error: ${e.message}` : "ZIP Compilation failed.");
            setExportProgress(null);
            onGeneratingChange(false);
          }
        } else {
          setExportProgress(null);
          onGeneratingChange(false);
        }
      } else if (exportType === "webm") {
        const recorder = webmRecorderRef.current;
        webmRecorderRef.current = null;
        frameCounterRef.current = 0;

        setActiveRecordingNode(null);

        if (recorder) {
          try {
            reportProgress("Processing WebM…");
            const videoBlob = await recorder.stop();
            setExportProgress(null);
            onWebMComplete(videoBlob);
            onGeneratingChange(false);
          } catch (e) {
            console.error("WebM recording failed:", e);
            reportProgress(e instanceof Error ? `WebM Error: ${e.message}` : "WebM Processing failed.");
            setExportProgress(null);
            onGeneratingChange(false);
          }
        } else {
          setExportProgress(null);
          onGeneratingChange(false);
        }
      }
    },
    [
      onGeneratingChange,
      onZipComplete,
      onWebMComplete,
      reportProgress,
      exportType,
    ],
  );

  useEffect(() => {
    const sim = new Simulation(config);
    sim.onBounceCallback = (bounceCount, speed) => {
      playBounceNote(config, bounceCount, speed);
    };
    simRef.current = sim;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unlock = () => resumeAudioCtx();
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, []);

  const loop = useCallback(
    (time: number) => {
      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!sim || !canvas) {
        scheduleAnimation();
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;

      if (
        (previewingRef.current || generating) &&
        sim.shouldAnimate() &&
        !mp4ExportActiveRef.current &&
        !gifExportActiveRef.current
      ) {
        const physicsStepMs = 1000 / 120; // 120 Hz physics step
        accumulatorRef.current += dt;

        if (accumulatorRef.current > 200) {
          accumulatorRef.current = 200;
        }

        // Add a 1.5ms epsilon buffer to eliminate frame-drop stutters on 120Hz displays
        const threshold = physicsStepMs - 1.5;
        while (accumulatorRef.current >= threshold) {
          simTimeRef.current += physicsStepMs;
          sim.tick(simTimeRef.current, physicsStepMs);
          accumulatorRef.current -= physicsStepMs;
          if (accumulatorRef.current < 0) {
            accumulatorRef.current = 0;
          }

          if (generating && sim.recording && exportType !== "mp4") {
            physicsStepCounterRef.current += 1;

            if (physicsStepCounterRef.current % 4 === 0) {
              if (exportType === "zip") {
                const dataUrl = canvas.toDataURL("image/png");
                pngExporterRef.current?.addFrame(dataUrl);
                const recordedFrames = pngExporterRef.current?.getFrameCount() ?? 0;
                reportProgress(`Captured frame ${recordedFrames}`);
              } else if (exportType === "webm") {
                reportProgress(
                  `Recording transparent video (Frame ${Math.ceil(physicsStepCounterRef.current / 4)})`,
                );
              }
            }

            if (sim.isRecordingComplete()) {
              if (physicsStepCounterRef.current % 4 !== 0) {
                if (exportType === "zip") {
                  const dataUrl = canvas.toDataURL("image/png");
                  pngExporterRef.current?.addFrame(dataUrl);
                }
              }
              void finishRecording(sim);
              accumulatorRef.current = 0;
              break;
            }
          }

          if (sim.isComplete && (!generating || !sim.recording || exportType === "mp4")) {
            accumulatorRef.current = 0;
            break;
          }
        }
      }

      sim.draw(ctx);

      // Freeze when simulation is complete and all chimes and confetti animations have finished
      if (sim.isComplete && !generating && !sim.shouldAnimate()) {
        return;
      }

      if (sim.shouldAnimate() || generating) {
        scheduleAnimation();
      }
    },
    [generating, finishRecording, exportType, reportProgress, scheduleAnimation],
  );

  loopRef.current = loop;

  const restartPreview = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.updateConfig(config);
    sim.resetState();
    lastTimeRef.current = 0;
    accumulatorRef.current = 0;
    simTimeRef.current = 0;
    physicsStepCounterRef.current = 0;
    previewingRef.current = true;
    setPreviewing(true);
    scheduleAnimation();
  }, [config, scheduleAnimation]);

  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;

    sim.onBounceCallback = (bounceCount, speed) => {
      playBounceNote(config, bounceCount, speed);
    };

    if (generating) {
      sim.updateConfig(config);
      return;
    }

    restartPreview();
  }, [config, generating, restartPreview]);

  useEffect(() => {
    scheduleAnimation();
    return () => cancelAnimationFrame(rafRef.current);
  }, [scheduleAnimation]);

  useEffect(() => {
    if (!generating || exportType === "mp4" || exportType === "gif") return;
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;

    frameCounterRef.current = 0;
    physicsStepCounterRef.current = 0;
    lastTimeRef.current = 0;
    accumulatorRef.current = 0;
    simTimeRef.current = 0;

    const audioCtx = getAudioContext();
    if (audioCtx) resumeAudioCtx();

    const startRecording = async () => {
      if (exportType === "zip") {
        pngExporterRef.current = new PngSequenceExporter();
        if (audioCtx) {
          const dest = createRecordingDestination(audioCtx);
          audioRecorderRef.current = new AudioWavRecorder(audioCtx);
          audioRecorderRef.current.startFromDestination(dest);
          setActiveRecordingNode(dest);
        }
      } else if (exportType === "webm") {
        let audioStream: MediaStream | undefined;
        if (audioCtx) {
          const dest = createRecordingDestination(audioCtx);
          setActiveRecordingNode(dest);
          audioStream = dest.stream;
        }
        webmRecorderRef.current = new WebMAlphaRecorder(canvas, 120, audioStream);
        webmRecorderRef.current.start();
      }

      sim.startRecording();
      reportProgress("0");
      scheduleAnimation();
    };

    void startRecording();
  }, [
    generating,
    scheduleAnimation,
    exportType,
    config.transparentBackground,
    config.soundEnabled,
    reportProgress,
  ]);

  useEffect(() => {
    if (!generating || exportType !== "gif") return;

    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;

    let cancelled = false;
    gifExportActiveRef.current = true;
    const encoder = new GifStreamEncoder();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const durationMs = config.targetTime * 1000;
    const exportFps = GIF_FPS;
    const stepMs = 1000 / exportFps;
    const maxFrames = Math.ceil(config.targetTime * exportFps);
    const runGifExport = async () => {
      sim.startRecording();
      sim.startTime = 0;

      for (let frame = 0; ; frame++) {
        if (cancelled || !sim.recording) break;

        const simNow = (durationMs * (frame + 1)) / maxFrames;
        sim.tick(simNow, stepMs);
        sim.draw(ctx);
        encoder.addFrame(sim.captureTransparentFrame());

        const pct = Math.min(100, Math.round(((frame + 1) / maxFrames) * 100));
        reportProgress(`${pct}`);

        const safetyLimit = maxFrames + 300;
        if (sim.isRecordingComplete() || frame >= safetyLimit) break;

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      if (!sim.isComplete && !cancelled) {
        sim.tick(durationMs, stepMs);
        sim.draw(ctx);
        encoder.addFrame(sim.captureTransparentFrame());
      }

      sim.stopRecording();
      gifExportActiveRef.current = false;

      if (cancelled) return;

      try {
        reportProgress("99");
        const result = encoder.finish();
        setExportProgress(null);
        onRecordingComplete(result);
        onGeneratingChange(false);
      } catch (e) {
        console.error("GIF export failed:", e);
        reportProgress(e instanceof Error ? `GIF Error: ${e.message}` : "GIF export failed.");
        setExportProgress(null);
        onGeneratingChange(false);
      }
    };

    void runGifExport();

    return () => {
      cancelled = true;
      gifExportActiveRef.current = false;
    };
  }, [
    generating,
    exportType,
    config.targetTime,
    onGeneratingChange,
    onRecordingComplete,
    reportProgress,
  ]);

  useEffect(() => {
    if (!generating || exportType !== "mp4") return;

    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;

    let cancelled = false;
    mp4ExportActiveRef.current = true;
    bounceEventsRef.current = [];
    frameCounterRef.current = 0;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const wantsAudio = config.soundEnabled;
    const durationMs = config.targetTime * 1000;

    const runMp4Export = async () => {
      let audioDest: MediaStreamAudioDestinationNode | null = null;
      let audioStream: MediaStream | undefined;

      if (wantsAudio) {
        const audioCtx = getAudioContext();
        if (audioCtx) {
          resumeAudioCtx();
          audioDest = createRecordingDestination(audioCtx);
          audioStream = audioDest.stream;
        }
      }

      try {
        mp4ExporterRef.current = await Mp4Exporter.create(
          config.transparentBackground,
          audioStream,
          wantsAudio,
          exportFormat,
          config.portraitPaddingColor
        );
      } catch (e) {
        reportProgress(e instanceof Error ? e.message : "MP4 export unavailable.");
        onGeneratingChange(false);
        mp4ExportActiveRef.current = false;
        return;
      }

      const exporter = mp4ExporterRef.current;
      if (!exporter) return;
      const exportFps = exporter.fps;
      const stepMs = 1000 / exportFps;
      const maxFrames = Math.ceil(config.targetTime * exportFps);
      const useRealtimePacing = exporter.getMode() === "mediarecorder";
      const useLiveAudio = useRealtimePacing && wantsAudio && audioDest;
      const prevCallback = sim.onBounceCallback;
      const physicsStepMs = 1000 / 120; // 120Hz physics sub-step size

      if (useLiveAudio) {
        setActiveRecordingNode(audioDest);
        sim.onBounceCallback = (bounceCount, speed) => {
          playBounceNote(config, bounceCount, speed);
        };
      } else {
        sim.onBounceCallback = (bounceCount, speed) => {
          bounceEventsRef.current.push({
            timeMs: sim.elapsed * 1000,
            bounceCount,
            speed,
          });
        };
      }

      sim.startRecording();
      sim.startTime = 0;

      const stepsPerFrame = Math.round(120 / exportFps);

      for (let frame = 0; ; frame++) {
        if (cancelled || !sim.recording) break;

        const simNow = (durationMs * (frame + 1)) / maxFrames;
        
        // Run exactly stepsPerFrame physics sub-steps of 8.33ms (120Hz)
        for (let s = 0; s < stepsPerFrame; s++) {
          const stepTime = simNow - (stepsPerFrame - 1 - s) * physicsStepMs;
          sim.tick(stepTime, physicsStepMs);
        }
        
        sim.draw(ctx);
        exporter.addFrame(sim.captureTransparentFrame());

        const pct = Math.min(100, Math.round(((frame + 1) / maxFrames) * 100));
        reportProgress(frame < maxFrames ? `${pct}` : "99");

        const safetyLimit = maxFrames + 300;
        if (sim.isRecordingComplete() || frame >= safetyLimit) break;

        if (useRealtimePacing) {
          await new Promise((resolve) => setTimeout(resolve, stepMs));
        } else {
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }

      // Ensure the final consumed frame is captured when we hit duration on the last tick.
      if (!sim.isComplete && !cancelled) {
        for (let s = 0; s < stepsPerFrame; s++) {
          const stepTime = durationMs - (stepsPerFrame - 1 - s) * physicsStepMs;
          sim.tick(stepTime, physicsStepMs);
        }
        sim.draw(ctx);
        exporter.addFrame(sim.captureTransparentFrame());
      }

      sim.onBounceCallback = prevCallback;
      sim.stopRecording();
      mp4ExportActiveRef.current = false;
      setActiveRecordingNode(null);

      if (cancelled) {
        mp4ExporterRef.current = null;
        return;
      }

      try {
        reportProgress("99");
        let audioBlob: Blob | null = null;
        if (wantsAudio && exporter.getMode() === "webcodecs") {
          const durationSec = exporter.getFrameCount() / exportFps;
          const soundtrack = await renderBounceSoundtrack(
            config,
            bounceEventsRef.current,
            durationSec,
          );
          audioBlob = audioBufferToWav(soundtrack);
        }

        reportProgress("99");
        const mp4Blob = await exporter.finish(audioBlob);
        mp4ExporterRef.current = null;
        setExportProgress(null);
        onMp4Complete(mp4Blob);
        onGeneratingChange(false);
      } catch (e) {
        console.error("MP4 export failed:", e);
        mp4ExporterRef.current = null;
        reportProgress(e instanceof Error ? `MP4 Error: ${e.message}` : "MP4 export failed.");
        setExportProgress(null);
        onGeneratingChange(false);
      }
    };

    void runMp4Export();

    return () => {
      cancelled = true;
      mp4ExportActiveRef.current = false;
    };
  }, [
    generating,
    exportType,
    config,
    onGeneratingChange,
    onMp4Complete,
    reportProgress,
  ]);

  const exportPercent = parseExportPercent(
    exportProgress,
    exportType,
    config.targetTime,
  );
  const exportStatus = exportStatusLabel(exportType, exportProgress);

  const handleReset = () => {
    if (generating) return;
    if (onReset) {
      onReset();
      return;
    }
    restartPreview();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Canvas wrapper — overlay during any export */}
      <div
        className="relative"
        style={{ width: "min(100%, 800px)", aspectRatio: "1" }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className={`w-full h-full rounded-xl border border-zinc-700 shadow-2xl ${
            config.transparentBackground ? "canvas-checkerboard" : ""
          } ${
            generating ? "opacity-20" : ""
          }`}
          style={{ display: "block", transition: "opacity 0.3s" }}
        />

        {generating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-zinc-950/85 backdrop-blur-sm px-4 text-center">
            {/* Spinner */}
            <svg
              className="animate-spin"
              width="48"
              height="48"
              viewBox="0 0 52 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="26" cy="26" r="22" stroke="#3f3f46" strokeWidth="4" />
              <path
                d="M26 4a22 22 0 0 1 22 22"
                stroke="#7c3aed"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>

            {exportPercent !== null ? (
              <p className="text-4xl font-bold tabular-nums text-white">{exportPercent}%</p>
            ) : (
              <p className="text-2xl font-semibold text-white">Exporting…</p>
            )}

            <div className="w-48 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-150"
                style={{
                  width:
                    exportPercent !== null ? `${exportPercent}%` : "100%",
                  opacity: exportPercent !== null ? 1 : 0.35,
                }}
              />
            </div>

            <p className="max-w-xs text-xs text-zinc-400">{exportStatus}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-800"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !previewingRef.current;
            setPreviewingActive(next);
            if (next && simRef.current?.isComplete) {
              scheduleAnimation();
            }
          }}
          className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-800"
        >
          {previewing ? "Pause" : "Resume"} preview
        </button>
      </div>
    </div>
  );
}
