import type { Signal } from "@react-audio-unit/core";
import { useFilter } from "./useFilter.js";
import { useMix } from "./useMix.js";

export interface PhaserParams {
  /** LFO rate in Hz. Default 0.5. */
  rate?: number;
  /** Modulation depth (affects frequency sweep range). Default 0.7. */
  depth?: number;
  /** Center frequency in Hz. Default 1000. */
  centerFreq?: number;
  /** Feedback amount (0–0.95). Default 0.5. */
  feedback?: number;
  /** Number of allpass stages (2, 4, 6, 8). Default 4. */
  stages?: number;
  /** Dry/wet mix (0–1). Default 0.5. */
  mix?: number;
  bypass?: boolean;
}

/**
 * usePhaser — phaser effect from cascaded allpass filters.
 *
 * A phaser works by running the signal through a chain of allpass
 * filters with swept center frequencies, then mixing the result
 * with the dry signal. The phase cancellation creates the
 * characteristic swooshing sound.
 */
export function usePhaser(input: Signal, params: PhaserParams = {}): Signal {
  const {
    depth = 0.7,
    centerFreq = 1000,
    feedback = 0.5,
    stages = 4,
    mix = 0.5,
    bypass = false,
  } = params;

  const stageCount = Math.max(2, Math.min(8, Math.round(stages / 2) * 2)); // must be even

  // Create a chain of allpass filters at logarithmically spaced frequencies
  // This simulates the swept allpass filter bank of a classic phaser
  const minFreq = centerFreq * (1 - depth * 0.9);
  const maxFreq = centerFreq * (1 + depth * 0.9);

  let signal = input;
  for (let i = 0; i < stageCount; i++) {
    // Logarithmically space the allpass frequencies
    const t = stageCount > 1 ? i / (stageCount - 1) : 0.5;
    const freq = minFreq * Math.pow(maxFreq / minFreq, t);

    signal = useFilter(signal, {
      type: "allpass",
      cutoff: freq,
      resonance: 0.707 + feedback * 0.3,
      bypass,
    });
  }

  return useMix(input, signal, mix);
}
