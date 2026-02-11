import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export type LFOShape = "sine" | "triangle" | "saw" | "square" | "random";

export interface LFOParams {
  /** Rate in Hz. */
  rate: number;
  /** Waveform shape. */
  shape: LFOShape;
  /** Depth / amplitude (0–1). Default 1. */
  depth?: number;
  /** Phase offset in degrees (0–360). */
  phase?: number;
  /** Sync to host tempo (rate becomes a beat division). */
  tempoSync?: boolean;
}

/**
 * useLFO — low-frequency oscillator for modulation.
 *
 * Returns a Signal that oscillates between -depth and +depth.
 * Use it as a modulation source for other node parameters.
 */
export function useLFO(params: LFOParams): Signal {
  return useAudioNode("lfo", {
    rate: params.rate,
    shape: params.shape,
    depth: params.depth ?? 1,
    phase: params.phase ?? 0,
    tempoSync: params.tempoSync ?? false,
  });
}
