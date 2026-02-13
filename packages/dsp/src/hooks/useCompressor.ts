import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_THRESHOLD,
  PARAM_RATIO,
  PARAM_ATTACK,
  PARAM_RELEASE,
  PARAM_KNEE,
  PARAM_MAKEUP_DB,
  PARAM_BYPASS,
} from "../param-keys.js";
// PARAM_ATTACK and PARAM_RELEASE are shared constants (same string as envelope).

export interface CompressorParams {
  /** Threshold in dB. */
  threshold: number;
  /** Compression ratio (e.g. 4 means 4:1). */
  ratio: number;
  /** Attack time in ms. */
  attack: number;
  /** Release time in ms. */
  release: number;
  /** Knee width in dB (0 = hard knee). */
  knee?: number;
  /** Makeup gain in dB. */
  makeupDb?: number;
  bypass?: boolean;
}

/**
 * useCompressor — dynamics compressor.
 *
 * Optionally accepts a sidechain input as a second signal.
 */
export function useCompressor(
  input: Signal,
  params: CompressorParams,
  sidechain?: Signal,
): Signal {
  const inputs = sidechain ? [input, sidechain] : [input];
  return useAudioNode(
    "compressor",
    {
      [PARAM_THRESHOLD]: params.threshold,
      [PARAM_RATIO]: params.ratio,
      [PARAM_ATTACK]: params.attack,
      [PARAM_RELEASE]: params.release,
      [PARAM_KNEE]: params.knee ?? 0,
      [PARAM_MAKEUP_DB]: params.makeupDb ?? 0,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    inputs,
  );
}
