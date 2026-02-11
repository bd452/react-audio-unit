import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface GainParams {
  /** Gain multiplier (0 = silence, 1 = unity). Can also be a Signal for AM. */
  gain: number;
  /** Gain in decibels — takes precedence over `gain` if provided. */
  gainDb?: number;
  bypass?: boolean;
}

/**
 * useGain — applies gain (volume) to an audio signal.
 */
export function useGain(input: Signal, params: GainParams): Signal {
  return useAudioNode(
    "gain",
    {
      gain:
        params.gainDb !== undefined ? dbToLinear(params.gainDb) : params.gain,
      bypass: params.bypass ?? false,
    },
    [input],
  );
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}
