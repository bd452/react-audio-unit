import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_LFO_RATE,
  PARAM_LFO_SHAPE,
  PARAM_LFO_DEPTH,
  PARAM_LFO_PHASE,
} from "../param-keys.js";

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
}

/**
 * useLFO — low-frequency oscillator for modulation.
 *
 * Returns a Signal that oscillates between -depth and +depth.
 * Use it as a modulation source for other node parameters.
 */
export function useLFO(params: LFOParams): Signal {
  return useAudioNode("lfo", {
    [PARAM_LFO_RATE]: params.rate,
    [PARAM_LFO_SHAPE]: params.shape,
    [PARAM_LFO_DEPTH]: params.depth ?? 1,
    [PARAM_LFO_PHASE]: params.phase ?? 0,
  });
}
