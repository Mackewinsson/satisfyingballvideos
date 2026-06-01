"use client";

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
  onResetPhysics,
  disabled,
}: Props) {
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
          Audio & ASMR
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
        
        {config.soundEnabled && (
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Sound palette</span>
            <select
              value={config.soundPalette}
              disabled={disabled}
              onChange={(e) => patch({ soundPalette: e.target.value as any })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="pentatonic">🎶 Pentatonic Ascension</option>
              <option value="escalating">📈 Harmonic Escalation</option>
              <option value="chime">🔔 Clean Metal Chime</option>
              <option value="marimba">🪵 Acoustic Marimba pluck</option>
            </select>
          </label>
        )}
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Ball
        </h3>
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
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Arena
        </h3>
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
            Erase arena to transparent. Ideal for Final Cut Pro and overlays.
          </span>
        </label>
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Motion & Physics
        </h3>
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
          label="Air friction"
          value={config.friction}
          min={0.85}
          max={1}
          step={0.01}
          disabled={disabled}
          onChange={(friction) => patch({ friction })}
        />
        <RangeField
          label="Bounce chaos (start)"
          value={Math.round(config.jitterStart * 100)}
          min={0}
          max={70}
          step={1}
          unit="%"
          disabled={disabled}
          onChange={(pct) => patch({ jitterStart: pct / 100 })}
        />
        <RangeField
          label="Bounce chaos (end)"
          value={Math.round(config.jitterEnd * 100)}
          min={Math.round(config.jitterStart * 100)}
          max={70}
          step={1}
          unit="%"
          disabled={disabled}
          onChange={(pct) => patch({ jitterEnd: pct / 100 })}
        />
        <p className="text-xs text-zinc-500">
          Higher chaos = less predictable wall bounces. Randomize colors to change the seed.
        </p>

        <div className="pt-2 space-y-3 border-t border-zinc-800/60">
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Speedup Mode</span>
            <select
              value={config.speedupMode}
              disabled={disabled}
              onChange={(e) => patch({ speedupMode: e.target.value as any })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="bounce">💥 Speed up on every bounce</option>
              <option value="time">⏳ Speed up smoothly over time</option>
            </select>
          </label>
          
          {config.speedupMode === "bounce" ? (
            <RangeField
              label="Speed multiplier per bounce"
              value={config.speedMultiplierPerBounce}
              min={1.0}
              max={1.15}
              step={0.005}
              disabled={disabled}
              onChange={(speedMultiplierPerBounce) => patch({ speedMultiplierPerBounce })}
            />
          ) : (
            <RangeField
              label="Final speed"
              value={config.finalSpeed}
              min={config.initialSpeed}
              max={55}
              step={1}
              disabled={disabled}
              onChange={(finalSpeed) => patch({ finalSpeed })}
            />
          )}
        </div>

        <div className="pt-2 space-y-3 border-t border-zinc-800/60">
          <label className="block space-y-1">
            <span className="text-sm text-zinc-400">Growth Mode</span>
            <select
              value={config.growthMode}
              disabled={disabled}
              onChange={(e) => patch({ growthMode: e.target.value as any })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="bounce">💥 Grow larger on every bounce</option>
              <option value="time">⏳ Grow larger smoothly over time</option>
            </select>
          </label>
          
          {config.growthMode === "bounce" && (
            <RangeField
              label="Radius increment per bounce"
              value={config.radiusIncrementPerBounce}
              min={0.1}
              max={10.0}
              step={0.1}
              unit=" px"
              disabled={disabled}
              onChange={(radiusIncrementPerBounce) => patch({ radiusIncrementPerBounce })}
            />
          )}
        </div>
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Erase trail
        </h3>
        <RangeField
          label="Eraser start"
          value={config.eraserStart}
          min={4}
          max={60}
          step={1}
          unit=" px"
          disabled={disabled}
          onChange={(eraserStart) => patch({ eraserStart })}
        />
        <RangeField
          label="Eraser end"
          value={config.eraserEnd}
          min={config.eraserStart}
          max={80}
          step={1}
          unit=" px"
          disabled={disabled}
          onChange={(eraserEnd) => patch({ eraserEnd })}
        />
      </section>

      <section className="space-y-3 border-b border-zinc-800 pb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-400">
          Colors & watermark
        </h3>
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
        <button
          type="button"
          disabled={disabled}
          onClick={onRandomize}
          className="w-full rounded-lg border border-violet-600/50 bg-violet-950/40 px-3 py-2 text-sm text-violet-200 hover:bg-violet-900/50"
        >
          Randomize colors
        </button>
      </section>

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
    </aside>
  );
}

export { buildPhysicsDefaults };
