"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BouncingRingCanvas } from "@/components/BouncingRingCanvas";
import { CustomizePanel } from "@/components/CustomizePanel";
import { PayModal } from "@/components/PayModal";
import { downloadGif, type GifExportResult } from "@/lib/gifExport";
import { downloadBlob, isMp4ExportSupported, isWebMTransparentSupported } from "@/lib/videoExport";
import {
  contrastingBallArenaColors,
  generateColorScheme,
  swapBallAndArenaColors,
  ballColorFromHue,
  rgbToHex,
} from "@/lib/simulation/colors";
import { computeRenderId } from "@/lib/renderId";
import { requestUnlock } from "@/lib/paywall";
import {
  defaultStudioConfig,
  normalizeStudioConfig,
  buildPhysicsDefaults,
  type StudioConfig,
} from "@/lib/simulation/types";

export function StudioClient() {
  const searchParams = useSearchParams();
  // Deterministic initial state so SSR and first client render match (no Math.random here).
  const [config, setConfig] = useState<StudioConfig>(() => defaultStudioConfig());
  const [generating, setGenerating] = useState(false);
  const [exportType, setExportType] = useState<"gif" | "zip" | "webm" | "mp4">("mp4");
  
  // Export states
  const [gifExport, setGifExport] = useState<GifExportResult | null>(null);
  const [zipExport, setZipExport] = useState<Blob | null>(null);
  const [webmExport, setWebMExport] = useState<Blob | null>(null);
  const [mp4Export, setMp4Export] = useState<Blob | null>(null);
  
  const [payOpen, setPayOpen] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [webmSupported] = useState(
    () => typeof window !== "undefined" && isWebMTransparentSupported(),
  );
  const [mp4Supported, setMp4Supported] = useState(false);

  const renderId = useMemo(() => computeRenderId(config), [config]);

  useEffect(() => {
    void isMp4ExportSupported().then(setMp4Supported);
  }, []);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;
    void (async () => {
      const res = await requestUnlock(renderId, sessionId);
      if (res.unlocked) setStatus("Payment verified — you can download.");
      else setStatus(res.message ?? "Payment pending.");
    })();
  }, [searchParams, renderId]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const baseHue = Math.random();
      setConfig((c) =>
        normalizeStudioConfig({
          ...c,
          baseHue,
          ballHue: (baseHue + 0.5) % 1,
        }),
      );
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const clearExports = () => {
    setGifExport(null);
    setZipExport(null);
    setWebMExport(null);
    setMp4Export(null);
  };

  const handleRandomize = () => {
    const ballHue = Math.random();
    const arenaHue = (ballHue + 0.5) % 1;
    const arenaColor = "#" + rgbToHex(ballColorFromHue(arenaHue));
    setConfig((c) =>
      normalizeStudioConfig({
        ...c,
        baseHue: arenaHue,
        ballHue,
        arenaColor,
      }),
    );
  };

  const handleSwitchColors = () => {
    clearExports();
    setConfig((c) => {
      const { ballHue, arenaColor } = swapBallAndArenaColors(c.ballHue, c.arenaColor);
      return normalizeStudioConfig({ ...c, ballHue, arenaColor });
    });
  };

  const handleResetColors = () => {
    clearExports();
    const { arenaColor, ballHue, baseHue } = contrastingBallArenaColors();
    setConfig((c) =>
      normalizeStudioConfig({
        ...c,
        arenaColor,
        ballHue,
        baseHue,
      }),
    );
  };

  const handleResetAll = () => {
    if (generating) return;
    clearExports();
    setStatus(null);
    setConfig(defaultStudioConfig());
  };

  const handleResetPhysics = () => {
    clearExports();
    setConfig((c) =>
      normalizeStudioConfig({
        ...c,
        ...buildPhysicsDefaults(),
      }),
    );
  };

  const handleGenerate = () => {
    if (generating) return;
    
    // Clear old exports
    setGifExport(null);
    setZipExport(null);
    setWebMExport(null);
    setMp4Export(null);
    
    setStatus(`Recording ${config.targetTime}s…`);
    setGenerating(true);
  };

  const handleRecordingComplete = useCallback((result: GifExportResult) => {
    setGifExport(result);
    setStatus(`Ready — ${result.frameCount} frames encoded.`);
  }, []);

  const handleZipComplete = useCallback((blob: Blob) => {
    setZipExport(blob);
    setStatus(`PNG Sequence ready (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB).`);
  }, []);

  const handleWebMComplete = useCallback((blob: Blob) => {
    setWebMExport(blob);
    setStatus(`Transparent WebM video ready (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB).`);
  }, []);

  const handleMp4Complete = useCallback((blob: Blob) => {
    setMp4Export(blob);
    setStatus(`60 fps MP4 ready (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB). Drop into Final Cut Pro.`);
  }, []);

  const runDownload = useCallback(() => {
    const scheme = generateColorScheme(config.baseHue, config.ballHue);
    try {
      if (exportType === "gif" && gifExport?.bytes.length) {
        downloadGif(gifExport.bytes, scheme.ball);
        setStatus("GIF downloaded.");
      } else if (exportType === "zip" && zipExport) {
        downloadBlob(zipExport, "zip", scheme.ball);
        setStatus("PNG Sequence ZIP downloaded.");
      } else if (exportType === "webm" && webmExport) {
        downloadBlob(webmExport, "webm", scheme.ball);
        setStatus("Transparent WebM downloaded.");
      } else if (exportType === "mp4" && mp4Export) {
        downloadBlob(mp4Export, "mp4", scheme.ball);
        setStatus("MP4 downloaded.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Export failed.");
    }
  }, [exportType, gifExport, zipExport, webmExport, mp4Export, config.baseHue, config.ballHue]);

  const handleDownloadClick = () => {
    const hasActiveExport = 
      (exportType === "gif" && gifExport?.bytes.length) ||
      (exportType === "zip" && zipExport) ||
      (exportType === "webm" && webmExport) ||
      (exportType === "mp4" && mp4Export);

    if (!hasActiveExport) {
      setStatus("Generate an animation first.");
      return;
    }
    
    // Bypass paywall entirely for direct local video generation
    runDownload();
  };

  const handleUnlock = async () => {
    setPayLoading(true);
    setPayError(null);
    const res = await requestUnlock(renderId);
    setPayLoading(false);
    if (res.unlocked) {
      setPayOpen(false);
      runDownload();
      return;
    }
    setPayError(res.message ?? "Payment required.");
  };

  const hasGeneratedFile = useMemo(() => {
    if (exportType === "gif") return Boolean(gifExport?.bytes.length);
    if (exportType === "zip") return Boolean(zipExport);
    if (exportType === "webm") return Boolean(webmExport);
    if (exportType === "mp4") return Boolean(mp4Export);
    return false;
  }, [exportType, gifExport, zipExport, webmExport, mp4Export]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-sm text-violet-400 hover:text-violet-300">
            ← Home
          </Link>
          <h1 className="text-lg font-semibold">Satisfying Ball Videos</h1>
          <span className="text-xs text-zinc-400 font-medium bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">Creator Mode · Unlimited Local Exports</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 p-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
        <CustomizePanel
          config={config}
          onChange={(c) => {
            clearExports();
            setConfig(normalizeStudioConfig(c));
          }}
          onRandomize={handleRandomize}
          onSwitchColors={handleSwitchColors}
          onResetColors={handleResetColors}
          onResetPhysics={handleResetPhysics}
          disabled={generating}
        />

        <div className="space-y-4">
          <BouncingRingCanvas
            config={config}
            generating={generating}
            exportType={exportType}
            onReset={handleResetAll}
            onGeneratingChange={setGenerating}
            onRecordingComplete={handleRecordingComplete}
            onZipComplete={handleZipComplete}
            onWebMComplete={handleWebMComplete}
            onMp4Complete={handleMp4Complete}
            onProgress={setStatus}
          />

          {/* Premium Format Tabs */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300">Export Options</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                disabled={generating}
                onClick={() => setExportType("mp4")}
                className={`rounded-lg px-3 py-2.5 text-xs font-semibold border transition-all ${
                  exportType === "mp4"
                    ? "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-950/20"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                🎞️ MP4 (60 fps)
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => setExportType("gif")}
                className={`rounded-lg px-3 py-2.5 text-xs font-semibold border transition-all ${
                  exportType === "gif"
                    ? "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-950/20"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                💥 GIF Animation
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => setExportType("zip")}
                className={`rounded-lg px-3 py-2.5 text-xs font-semibold border transition-all ${
                  exportType === "zip"
                    ? "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-950/20"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                🎬 PNG Sequence (ZIP)
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => setExportType("webm")}
                className={`rounded-lg px-3 py-2.5 text-xs font-semibold border transition-all ${
                  exportType === "webm"
                    ? "bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-950/20"
                    : "border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                🎥 Transparent WebM
              </button>
            </div>

            {/* Educational / Tooltip Warnings for Video Editors */}
            {exportType === "mp4" && (
              <div className="text-xs space-y-1.5 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-400">
                <p className="font-semibold text-zinc-300">🎞️ One-file 60 fps for Final Cut Pro</p>
                {!mp4Supported ? (
                  <p className="text-amber-500 font-medium">
                    ⚠️ MP4 encoding is not supported in this browser. Use Chrome or Edge, or export a PNG Sequence (ZIP).
                  </p>
                ) : (
                  <p>
                    Encodes every frame at 60 fps into a single H.264 MP4 with bounce audio — no ffmpeg or manual import needed. Drag straight into Final Cut Pro.
                  </p>
                )}
                {config.transparentBackground && (
                  <p className="text-amber-400 font-medium pt-1">
                    ⚠️ MP4 does not support transparency; transparent areas are composited on black.
                  </p>
                )}
              </div>
            )}

            {exportType === "zip" && (
              <div className="text-xs space-y-1.5 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-400">
                <p className="font-semibold text-zinc-300">💡 Industry Standard for Final Cut Pro</p>
                <p>
                  Generates sequentially numbered transparent PNG frames. macOS Final Cut Pro natively imports this directory directly as a single transparent video track. Lossless and perfect quality!
                </p>
                {!config.transparentBackground && (
                  <p className="text-amber-400 font-medium pt-1">
                    ⚠️ Tip: Enable &quot;Transparent background&quot; in the Arena customization settings to erase the background.
                  </p>
                )}
              </div>
            )}

            {exportType === "webm" && (
              <div className="text-xs space-y-1.5 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-400">
                <p className="font-semibold text-zinc-300">🎥 Chrome/Chromium Browser Alpha Video</p>
                {!webmSupported ? (
                  <p className="text-amber-500 font-medium">
                    ⚠️ Transparent WebM recording is not supported in Safari. Please use Chrome/Firefox, or export as a **PNG Sequence (ZIP)** (highly recommended for Final Cut Pro).
                  </p>
                ) : (
                  <p>
                    Records canvas stream with transparency. Note: Final Cut Pro does not natively support WebM files. You can use free tools like <strong>Shutter Encoder</strong> to transcode it to Apple ProRes 4444.
                  </p>
                )}
                {!config.transparentBackground && (
                  <p className="text-amber-400 font-medium pt-1">
                    ⚠️ Tip: Enable &quot;Transparent background&quot; in the Arena customization settings to erase the background.
                  </p>
                )}
              </div>
            )}

            {exportType === "gif" && (
              <div className="text-xs space-y-1.5 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-400">
                <p className="font-semibold text-zinc-300">💥 Fast Sharing / Low-Res Loop</p>
                <p>
                  Saves a lightweight, 256-color loop. Great for chat apps and quick social media posts (excludes sound).
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={generating || (exportType === "webm" && !webmSupported) || (exportType === "mp4" && !mp4Supported)}
              onClick={handleGenerate}
              className="rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {generating
                ? `Generating (${config.targetTime}s)…`
                : `Generate ${exportType.toUpperCase()}`}
            </button>
            <button
              type="button"
              disabled={!hasGeneratedFile || generating}
              onClick={handleDownloadClick}
              className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-6 py-3 font-semibold hover:bg-zinc-800 disabled:opacity-40 transition-colors"
            >
              Download {exportType === "zip" ? "PNG Sequence (ZIP)" : exportType === "mp4" ? "MP4" : exportType.toUpperCase()}
            </button>
          </div>

          {status && (
            <p className="text-sm font-medium text-zinc-400 bg-zinc-900/20 border border-zinc-800/40 rounded-lg px-3 py-2 inline-block" aria-live="polite">
              ℹ️ {status}
            </p>
          )}
        </div>
      </div>

      <PayModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onUnlock={handleUnlock}
        loading={payLoading}
        error={payError}
      />
    </main>
  );
}

