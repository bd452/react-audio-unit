import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface PanParams {
  /** Pan position: -1 (full left) to +1 (full right), 0 = center. */
  pan: number;
  /** Panning law: 'linear' | 'equalPower'. Default 'equalPower'. */
  law?: "linear" | "equalPower";
  bypass?: boolean;
}

/**
 * usePan — stereo panner.
 */
export function usePan(input: Signal, params: PanParams): Signal {
  return useAudioNode(
    "pan",
    {
      pan: params.pan,
      law: params.law ?? "equalPower",
      bypass: params.bypass ?? false,
    },
    [input],
  );
}
