import type { StudioConfig } from "./simulation/types";

export type BounceEvent = {
  timeMs: number;
  bounceCount: number;
  speed: number;
};

const EXPORT_SAMPLE_RATE = 48_000;

function bounceFrequency(
  config: StudioConfig,
  bounceCount: number,
  speed: number,
): number {
  if (config.soundPalette === "pentatonic") {
    const pentatonicScale = [
      130.81, 146.83, 164.81, 196.0, 220.0,
      261.63, 293.66, 329.63, 392.0, 440.0,
      523.25, 587.33, 659.25, 783.99, 880.0,
      1046.5, 1174.66, 1318.51, 1567.98, 1760.0,
    ];
    return pentatonicScale[(bounceCount - 1) % pentatonicScale.length];
  }
  if (config.soundPalette === "escalating") {
    const baseFreq = 130.81;
    const frequency = baseFreq * (1 + (speed - 14) / 25);
    return Math.min(2500, Math.max(130.81, frequency));
  }
  if (config.soundPalette === "chime") {
    const root = 220.0;
    const ratios = [1, 1.2, 1.5, 2, 2.4, 3, 4];
    return root * ratios[(bounceCount - 1) % ratios.length];
  }
  if (config.soundPalette === "marimba") {
    const scale = [
      196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33,
      659.25, 783.99,
    ];
    return scale[(bounceCount - 1) % scale.length];
  }
  return 440;
}

/** Schedule one bounce note into any AudioContext (live or offline). */
export function scheduleBounceNote(
  ctx: BaseAudioContext,
  destination: AudioNode,
  config: StudioConfig,
  bounceCount: number,
  speed: number,
  atTimeSec: number,
): void {
  if (!config.soundEnabled) return;

  const frequency = bounceFrequency(config, bounceCount, speed);
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  if (config.soundPalette === "marimba") {
    osc.type = "sine";
    const overtone = ctx.createOscillator();
    const overtoneGain = ctx.createGain();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(frequency * 3.0, atTimeSec);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    overtoneGain.gain.setValueAtTime(0.08, atTimeSec);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, atTimeSec + 0.08);
    overtone.start(atTimeSec);
    overtone.stop(atTimeSec + 0.15);
  } else if (config.soundPalette === "chime") {
    osc.type = "triangle";
    const metal = ctx.createOscillator();
    const metalGain = ctx.createGain();
    metal.type = "sine";
    metal.frequency.setValueAtTime(frequency * 4.2, atTimeSec);
    metal.connect(metalGain);
    metalGain.connect(filter);
    metalGain.gain.setValueAtTime(0.12, atTimeSec);
    metalGain.gain.exponentialRampToValueAtTime(0.001, atTimeSec + 0.4);
    metal.start(atTimeSec);
    metal.stop(atTimeSec + 0.5);
  } else {
    osc.type = "sine";
    const bite = ctx.createOscillator();
    const biteGain = ctx.createGain();
    bite.type = "triangle";
    bite.frequency.setValueAtTime(frequency, atTimeSec);
    bite.connect(biteGain);
    biteGain.connect(filter);
    biteGain.gain.setValueAtTime(0.05, atTimeSec);
    biteGain.gain.exponentialRampToValueAtTime(0.001, atTimeSec + 0.05);
    bite.start(atTimeSec);
    bite.stop(atTimeSec + 0.08);
  }

  osc.frequency.setValueAtTime(frequency, atTimeSec);

  filter.type = "lowpass";
  if (config.soundPalette === "chime") {
    filter.Q.setValueAtTime(4, atTimeSec);
    filter.frequency.setValueAtTime(frequency * 5, atTimeSec);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.5, atTimeSec + 0.4);
  } else if (config.soundPalette === "marimba") {
    filter.Q.setValueAtTime(1, atTimeSec);
    filter.frequency.setValueAtTime(frequency * 2.5, atTimeSec);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.0, atTimeSec + 0.1);
  } else {
    filter.Q.setValueAtTime(2, atTimeSec);
    filter.frequency.setValueAtTime(frequency * 4, atTimeSec);
    filter.frequency.exponentialRampToValueAtTime(frequency * 1.2, atTimeSec + 0.25);
  }

  const decayTime =
    config.soundPalette === "marimba" ? 0.2 : config.soundPalette === "chime" ? 0.6 : 0.45;
  gainNode.gain.setValueAtTime(0.35, atTimeSec);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, atTimeSec + decayTime);

  osc.start(atTimeSec);
  osc.stop(atTimeSec + decayTime + 0.05);
}

/** Render bounce events into a stereo buffer locked to export duration. */
export async function renderBounceSoundtrack(
  config: StudioConfig,
  events: BounceEvent[],
  durationSec: number,
): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(
    2,
    Math.ceil(durationSec * EXPORT_SAMPLE_RATE),
    EXPORT_SAMPLE_RATE,
  );

  for (const event of events) {
    scheduleBounceNote(
      offline,
      offline.destination,
      config,
      event.bounceCount,
      event.speed,
      event.timeMs / 1000,
    );
  }

  return offline.startRendering();
}

export { EXPORT_SAMPLE_RATE };
