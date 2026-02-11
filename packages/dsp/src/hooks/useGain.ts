import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface GainParams {
  /**
   * Gain multiplier (0 = silence, 1 = unity).
   *
   * When a **Signal** is provided (e.g. from `useEnvelope`), that signal
   * is connected as a modulation input (inlet 1) to the native GainNode.
   * The audio is multiplied sample-by-sample by the modulation signal.
   * The numeric `gain` parameter still acts as an additional scalar on
   * top of the modulation, defaulting to 1.0.
   */
  gain: number | Signal;
  /** Gain in decibels — takes precedence over `gain` when gain is numeric. */
  gainDb?: number;
  bypass?: boolean;
}

function isSignal(value: unknown): value is Signal {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Signal).__brand === "AudioSignal"
  );
}

/**
 * useGain — applies gain (volume) to an audio signal.
 *
 * Supports two modes:
 *   - `gain: 0.5` — static/smoothed gain from a numeric value.
 *   - `gain: envelopeSignal` — amplitude modulation from another audio node
 *     (e.g. an ADSR envelope). The modulation signal is connected as the
 *     second input to the native GainNode.
 */
export function useGain(input: Signal, params: GainParams): Signal {
  const modulated = isSignal(params.gain);
  const inputs = modulated ? [input, params.gain as Signal] : [input];

  const gainValue = modulated
    ? 1.0
    : params.gainDb !== undefined
      ? dbToLinear(params.gainDb)
      : (params.gain as number);

  return useAudioNode(
    "gain",
    {
      gain: gainValue,
      bypass: params.bypass ?? false,
    },
    inputs,
  );
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}
