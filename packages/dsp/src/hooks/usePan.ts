import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_PAN,
  PARAM_PAN_LAW,
  PARAM_BYPASS,
} from "../param-keys.js";

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
      [PARAM_PAN]: params.pan,
      [PARAM_PAN_LAW]: params.law ?? "equalPower",
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    [input],
  );
}
