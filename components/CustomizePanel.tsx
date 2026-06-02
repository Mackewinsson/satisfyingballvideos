"use client";

import { useState } from "react";
import {
  ballColorFromHue,
  hexToRgb,
  rgbToHex,
  rgbToHue,
} from "@/lib/simulation/colors";
import {
  DURATION_MAX_SEC,
  DURATION_MIN_SEC,
  DURATION_STEP_SEC,
} from "@/lib/simulation/constants";
import {
  buildPhysicsDefaults,
  normalizeStudioConfig,
  type StudioConfig,
} from "@/lib/simulation/types";
import { MP4_FPS } from "@/lib/videoExport";

type Props = {
  config: StudioConfig;
  onChange: (config: StudioConfig) => void;
  onRandomize: () => void;
  onSwitchColors: () => void;
  onResetColors: () => void;
  onResetPhysics?: () => void;
  disabled?: boolean;
};

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-400">
        {label}: {value}
        {unit}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

export function CustomizePanel({
  config,
  onChange,
  onRandomize,
  onSwitchColors,
  onResetColors,
  onResetPhysics,
  disabled,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const patch = (partial: Partial<StudioConfig>) =>
    onChange(normalizeStudioConfig({ ...config, ...partial }));

  return (
    <aside className="max-h-[calc(100vh-8rem)] space-y-5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h2 className="text-lg font-semibold text-white">Customize</h2>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Timing
        </h3>
        <RangeField
          label="Duration"
          value={config.targetTime}
          min={DURATION_MIN_SEC}
          max={DURATION_MAX_SEC}
          step={DURATION_STEP_SEC}
          unit="s"
          disabled={disabled}
          onChange={(targetTime) => patch({ targetTime })}
        />
        <p className="text-xs text-zinc-500">
          MP4 export at 60 fps: ~{Math.ceil(config.targetTime * MP4_FPS)} frames
          {config.targetTime > 120 ? " — longer exports take more time to encode." : ""}
        </p>
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Audio
        </h3>
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={config.soundEnabled}
            disabled={disabled}
            onChange={(e) => patch({ soundEnabled: e.target.checked })}
            className="rounded border-zinc-700 bg-zinc-950 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
          />
          <span className="text-sm text-zinc-300">Enable bounce chimes</span>
        </label>
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Colors
        </h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-400 shrink-0">Ball color</label>
          <input
            type="color"
            disabled={disabled}
            value={`#${rgbToHex(ballColorFromHue(config.ballHue))}`}
            onChange={(e) => {
              const [r, g, b] = hexToRgb(e.target.value);
              patch({ ballHue: rgbToHue(r, g, b) });
            }}
            className="h-10 w-14 cursor-pointer rounded border border-zinc-600 bg-transparent"
          />
          <span className="text-xs text-zinc-500">
            #{rgbToHex(ballColorFromHue(config.ballHue))}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-400 shrink-0">Arena color</label>
          <input
            type="color"
            disabled={disabled}
            value={config.arenaColor}
            onChange={(e) => {
              patch({ arenaColor: e.target.value });
            }}
            className="h-10 w-14 cursor-pointer rounded border border-zinc-600 bg-transparent"
          />
          <span className="text-xs text-zinc-500">
            {config.arenaColor.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={disabled}
            onClick={onSwitchColors}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Switch colors
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onResetColors}
            className="rounded-lg border border-violet-600/50 bg-violet-950/40 px-3 py-2 text-sm text-violet-200 hover:bg-violet-900/50"
          >
            Reset colors
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onRandomize}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Randomize
          </button>
        </div>
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Trail mode
        </h3>
        <label className="block space-y-1">
          <span className="text-sm text-zinc-400">Ball effect</span>
          <select
            value={config.trailMode}
            disabled={disabled}
            onChange={(e) => {
              const trailMode = e.target.value as StudioConfig["trailMode"];
              patch({
                trailMode,
                transparentBackground: trailMode === "paint",
                ballColorPerBounce: trailMode === "paint" ? false : config.ballColorPerBounce,
              });
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            <option value="erase">Erase arena (classic ASMR)</option>
            <option value="paint">Paint strokes</option>
          </select>
        </label>
        <p className="text-xs text-zinc-500">
          {config.trailMode === "paint"
            ? "Ball paints colored strokes. Transparent background is on by default — change it in Advanced options."
            : "Ball erases the white arena to reveal the background color."}
        </p>
      </section>

      <section className="space-y-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/80"
        >
          <span>Advanced options</span>
          <span className="text-zinc-500" aria-hidden>
            {advancedOpen ? "−" : "+"}
          </span>
        </button>

        {advancedOpen && (
          <div className="space-y-5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
            {config.soundEnabled && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Sound
                </h4>
                <label className="block space-y-1">
                  <span className="text-sm text-zinc-400">Sound palette</span>
                  <select
                    value={config.soundPalette}
                    disabled={disabled}
                    onChange={(e) => patch({ soundPalette: e.target.value as StudioConfig["soundPalette"] })}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  >
                    <option value="pentatonic">🎶 Pentatonic Ascension</option>
                    <option value="escalating">📈 Harmonic Escalation</option>
                    <option value="chime">🔔 Clean Metal Chime</option>
                    <option value="marimba">🪵 Acoustic Marimba pluck</option>
                  </select>
                </label>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Export
              </h4>
              <label className="flex flex-col gap-1 cursor-pointer pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.transparentBackground}
                    disabled={disabled}
                    onChange={(e) => patch({ transparentBackground: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-950 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-zinc-300">Transparent background</span>
                </div>
                <span className="text-xs text-zinc-500 pl-6">
                  {config.trailMode === "paint"
                    ? "Export paint strokes on a transparent canvas. Ideal for Final Cut Pro and overlays."
                    : "Erase the arena to transparency instead of the arena background color."}
                </span>
              </label>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Ball & arena
              </h4>
              <RangeField
                label="Ring radius"
                value={Math.round(config.ringRadius * 10) / 10}
                min={4}
                max={80}
                step={1}
                unit=" px"
                disabled={disabled}
                onChange={(ringRadius) => patch({ ringRadius })}
              />
              <RangeField
                label="Border radius"
                value={config.borderRadius}
                min={200}
                max={385}
                step={5}
                unit=" px"
                disabled={disabled}
                onChange={(borderRadius) => patch({ borderRadius })}
              />
              {config.trailMode === "erase" && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={config.ballColorPerBounce}
                    disabled={disabled}
                    onChange={(e) => patch({ ballColorPerBounce: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-950 text-violet-600 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-300">New ball color every bounce</span>
                </label>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Motion & physics
              </h4>
              <RangeField
                label="Launch speed"
                value={config.initialSpeed}
                min={3}
                max={40}
                step={1}
                disabled={disabled}
                onChange={(initialSpeed) => patch({ initialSpeed })}
              />
              <RangeField
                label="Gravity"
                value={config.gravity}
                min={0}
                max={1.5}
                step={0.01}
                disabled={disabled}
                onChange={(gravity) => patch({ gravity })}
              />
              <RangeField
                label="Restitution (bounciness)"
                value={config.restitution}
                min={0.5}
                max={1}
                step={0.01}
                disabled={disabled}
                onChange={(restitution) => patch({ restitution })}
              />
              <RangeField
                label={config.trailMode === "paint" ? "Brush width" : "Eraser width"}
                value={config.eraserStart}
                min={4}
                max={60}
                step={1}
                unit=" px"
                disabled={disabled}
                onChange={(eraserStart) => patch({ eraserStart })}
              />
              {onResetPhysics && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onResetPhysics}
                  className="w-full rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Reset physics to defaults
                </button>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Watermark & hues
              </h4>
              <label className="block space-y-1">
                <span className="text-sm text-zinc-400">Watermark text</span>
                <input
                  type="text"
                  value={config.watermarkText}
                  disabled={disabled}
                  onChange={(e) => patch({ watermarkText: e.target.value })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  placeholder="Optional watermark"
                />
              </label>
              <RangeField
                label="Watermark opacity"
                value={Math.round(config.watermarkOpacity * 100)}
                min={5}
                max={80}
                step={1}
                unit="%"
                disabled={disabled}
                onChange={(pct) => patch({ watermarkOpacity: pct / 100 })}
              />
              <RangeField
                label="Arena hue"
                value={Math.round(config.baseHue * 360)}
                min={0}
                max={360}
                step={1}
                unit="°"
                disabled={disabled}
                onChange={(deg) => patch({ baseHue: deg / 360 })}
              />
              <RangeField
                label="Ball hue"
                value={Math.round(config.ballHue * 360)}
                min={0}
                max={360}
                step={1}
                unit="°"
                disabled={disabled}
                onChange={(deg) => patch({ ballHue: deg / 360 })}
              />
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}

export { buildPhysicsDefaults };
