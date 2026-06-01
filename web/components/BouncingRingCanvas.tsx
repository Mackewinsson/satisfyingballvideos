"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Simulation, FPS, FRAME_SKIP, WIDTH, HEIGHT } from "@/lib/simulation/Simulation";
import { captureTransparentFrame } from "@/lib/simulation/renderer";
import type { StudioConfig } from "@/lib/simulation/types";

type Props = {
  config: StudioConfig;
  generating: boolean;
  onGeneratingChange: (v: boolean) => void;
  onRecordingComplete: (frames: ImageData[]) => void;
};

export function BouncingRingCanvas({
  config,
  generating,
  onGeneratingChange,
  onRecordingComplete,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation | null>(null);
  const frameCounterRef = useRef(0);
  const framesRef = useRef<ImageData[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [previewing, setPreviewing] = useState(true);

  useEffect(() => {
    simRef.current = new Simulation(config);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    simRef.current?.updateConfig(config);
  }, [config]);

  const loop = useCallback(
    (time: number) => {
      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!sim || !canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;

      if (previewing || generating) {
        sim.tick(dt);
      }

      if (generating && sim.recording) {
        frameCounterRef.current += 1;
        if (frameCounterRef.current % FRAME_SKIP === 0) {
          framesRef.current.push(
            captureTransparentFrame(
              sim.scheme,
              sim.gradientCanvas,
              sim.eraseCanvas,
              sim.ballX,
              sim.ballY,
              config,
            ),
          );
        }

        if (sim.isRecordingComplete()) {
          sim.stopRecording();
          onGeneratingChange(false);
          onRecordingComplete([...framesRef.current]);
          framesRef.current = [];
          frameCounterRef.current = 0;
        }
      }

      sim.draw(ctx);
      rafRef.current = requestAnimationFrame(loop);
    },
    [config, generating, onGeneratingChange, onRecordingComplete, previewing],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  useEffect(() => {
    if (!generating) return;
    const sim = simRef.current;
    if (!sim) return;
    framesRef.current = [];
    frameCounterRef.current = 0;
    lastTimeRef.current = 0;
    sim.startRecording();
  }, [generating]);

  const handleReset = () => {
    simRef.current?.resetState();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="max-w-full h-auto rounded-xl border border-zinc-700 shadow-2xl"
        style={{ width: "min(100%, 800px)", aspectRatio: "1" }}
      />
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-800"
        >
          Reset preview
        </button>
        <button
          type="button"
          onClick={() => setPreviewing((p) => !p)}
          className="rounded-lg border border-zinc-600 px-4 py-2 hover:bg-zinc-800"
        >
          {previewing ? "Pause" : "Resume"} preview
        </button>
      </div>
    </div>
  );
}
