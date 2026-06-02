"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Simulation, FRAME_SKIP, WIDTH, HEIGHT } from "@/lib/simulation/Simulation";
import { GifStreamEncoder, type GifExportResult } from "@/lib/gifExport";
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
  PngSequenceExporter,
  WebMAlphaRecorder,
  AudioWavRecorder,
} from "@/lib/videoExport";

let audioCtx: AudioContext | null = null;
let activeRecordingNode: AudioNode | null = null;

export function setActiveRecordingNode(node: AudioNode | null): void {
  activeRecordingNode = node;
}

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as WindowWithWebkitAudio).webkitAudioContext;
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
  const gifEncoderRef = useRef<GifStreamEncoder | null>(null);
  const pngExporterRef = useRef<PngSequenceExporter | null>(null);
  const webmRecorderRef = useRef<WebMAlphaRecorder | null>(null);
  const mp4ExporterRef = useRef<Mp4Exporter | null>(null);
  const mp4ExportActiveRef = useRef(false);
  const bounceEventsRef = useRef<BounceEvent[]>([]);
  const audioRecorderRef = useRef<AudioWavRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const loopRef = useRef<(time: number) => void>(() => {});
  const previewingRef = useRef(true);
  const [previewing, setPreviewing] = useState(true);

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

      if (exportType === "gif") {
        const encoder = gifEncoderRef.current;
        gifEncoderRef.current = null;
        frameCounterRef.current = 0;
        if (encoder) {
          try {
            onRecordingComplete(encoder.finish());
            onGeneratingChange(false);
          } catch {
            onGeneratingChange(false);
          }
        } else {
          onGeneratingChange(false);
        }
      } else if (exportType === "zip") {
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
            onProgress?.("Creating ZIP archive...");
            const zipBlob = await exporter.finish((percent) => {
              onProgress?.(`Compressing ZIP: ${percent}%`);
            });
            onZipComplete(zipBlob);
            onGeneratingChange(false);
          } catch (e) {
            console.error("ZIP packaging failed:", e);
            onProgress?.(e instanceof Error ? `ZIP Error: ${e.message}` : "ZIP Compilation failed.");
            onGeneratingChange(false);
          }
        } else {
          onGeneratingChange(false);
        }
      } else if (exportType === "webm") {
        const recorder = webmRecorderRef.current;
        webmRecorderRef.current = null;
        frameCounterRef.current = 0;

        setActiveRecordingNode(null);

        if (recorder) {
          try {
            onProgress?.("Processing video file...");
            const videoBlob = await recorder.stop();
            onWebMComplete(videoBlob);
            onGeneratingChange(false);
          } catch (e) {
            console.error("WebM recording failed:", e);
            onProgress?.(e instanceof Error ? `WebM Error: ${e.message}` : "WebM Processing failed.");
            onGeneratingChange(false);
          }
        } else {
          onGeneratingChange(false);
        }
      }
    },
    [
      onGeneratingChange,
      onRecordingComplete,
      onZipComplete,
      onWebMComplete,
      onProgress,
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
        !mp4ExportActiveRef.current
      ) {
        const physicsStepMs = 1000 / 120; // 120 Hz physics step
        accumulatorRef.current += dt;

        if (accumulatorRef.current > 200) {
          accumulatorRef.current = 200;
        }

        while (accumulatorRef.current >= physicsStepMs) {
          simTimeRef.current += physicsStepMs;
          sim.tick(simTimeRef.current, physicsStepMs);
          accumulatorRef.current -= physicsStepMs;

          if (generating && sim.recording && exportType !== "mp4") {
            physicsStepCounterRef.current += 1;

            // Capture at 30 fps (every 4 physics steps of 8.33ms)
            if (physicsStepCounterRef.current % 4 === 0) {
              if (exportType === "gif") {
                gifEncoderRef.current?.addFrame(sim.captureTransparentFrame());
              } else if (exportType === "zip") {
                const dataUrl = canvas.toDataURL("image/png");
                pngExporterRef.current?.addFrame(dataUrl);
                const recordedFrames = pngExporterRef.current?.getFrameCount() ?? 0;
                onProgress?.(`Captured frame ${recordedFrames}`);
              } else if (exportType === "webm") {
                onProgress?.(`Recording transparent video (Frame ${physicsStepCounterRef.current / 4})`);
              }
            }

            if (sim.isRecordingComplete()) {
              if (physicsStepCounterRef.current % 4 !== 0) {
                if (exportType === "gif") {
                  gifEncoderRef.current?.addFrame(sim.captureTransparentFrame());
                } else if (exportType === "zip") {
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
    [generating, finishRecording, exportType, onProgress, scheduleAnimation],
  );

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

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
    if (!generating || exportType === "mp4") return;
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
      if (exportType === "gif") {
        gifEncoderRef.current = new GifStreamEncoder();
      } else if (exportType === "zip") {
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
      scheduleAnimation();
    };

    void startRecording();
  }, [
    generating,
    scheduleAnimation,
    exportType,
    config.transparentBackground,
    config.soundEnabled,
    onGeneratingChange,
    onProgress,
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
        );
      } catch (e) {
        onProgress?.(e instanceof Error ? e.message : "MP4 export unavailable.");
        onGeneratingChange(false);
        mp4ExportActiveRef.current = false;
        return;
      }

      const exporter = mp4ExporterRef.current;
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

        if (frame < maxFrames) {
          onProgress?.(`Encoding frame ${frame + 1}/${maxFrames} @ ${exportFps} fps`);
        } else {
          onProgress?.(`Encoding transitions (Confetti) @ ${exportFps} fps`);
        }

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
        onProgress?.("Rendering soundtrack…");
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

        onProgress?.("Finalizing MP4…");
        const mp4Blob = await exporter.finish(audioBlob);
        mp4ExporterRef.current = null;
        onMp4Complete(mp4Blob);
        onGeneratingChange(false);
      } catch (e) {
        console.error("MP4 export failed:", e);
        mp4ExporterRef.current = null;
        onProgress?.(e instanceof Error ? `MP4 Error: ${e.message}` : "MP4 export failed.");
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
    onProgress,
  ]);

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
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className={`max-w-full h-auto rounded-xl border border-zinc-700 shadow-2xl ${
          config.transparentBackground ? "canvas-checkerboard" : ""
        }`}
        style={{ width: "min(100%, 800px)", aspectRatio: "1" }}
      />
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
