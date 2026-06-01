"use client";

import type { StudioConfig } from "@/lib/simulation/types";

type Props = {
  config: StudioConfig;
  onChange: (config: StudioConfig) => void;
  onRandomize: () => void;
  disabled?: boolean;
};

export function CustomizePanel({
  config,
  onChange,
  onRandomize,
  disabled,
}: Props) {
  const patch = (partial: Partial<StudioConfig>) =>
    onChange({ ...config, ...partial });

  return (
    <aside className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h2 className="text-lg font-semibold text-white">Customize</h2>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-400">Watermark text</span>
        <input
          type="text"
          value={config.watermarkText}
          disabled={disabled}
          onChange={(e) => patch({ watermarkText: e.target.value })}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          placeholder="MACKEWINSSON"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-400">
          Watermark opacity ({Math.round(config.watermarkOpacity * 100)}%)
        </span>
        <input
          type="range"
          min={0.05}
          max={0.6}
          step={0.01}
          value={config.watermarkOpacity}
          disabled={disabled}
          onChange={(e) =>
            patch({ watermarkOpacity: parseFloat(e.target.value) })
          }
          className="w-full"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-zinc-400">
          Color hue ({Math.round(config.baseHue * 360)}°)
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={config.baseHue}
          disabled={disabled}
          onChange={(e) => patch({ baseHue: parseFloat(e.target.value) })}
          className="w-full"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onRandomize}
          className="mt-1 w-full rounded-lg border border-violet-600/50 bg-violet-950/40 px-3 py-2 text-sm text-violet-200 hover:bg-violet-900/50"
        >
          Randomize colors
        </button>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm text-zinc-400">Duration</legend>
        <div className="flex gap-2">
          {([30, 60] as const).map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => patch({ targetTime: d })}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                config.targetTime === d
                  ? "border-violet-500 bg-violet-600/30 text-white"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </fieldset>
    </aside>
  );
}
