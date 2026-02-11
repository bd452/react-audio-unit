import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

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
      threshold: params.threshold,
      ratio: params.ratio,
      attack: params.attack,
      release: params.release,
      knee: params.knee ?? 0,
      makeupDb: params.makeupDb ?? 0,
      bypass: params.bypass ?? false,
    },
    inputs,
  );
}
