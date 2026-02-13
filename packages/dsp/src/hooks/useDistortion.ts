import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_DISTORTION_TYPE,
  PARAM_DRIVE,
  PARAM_OUTPUT_GAIN,
  PARAM_MIX,
  PARAM_BYPASS,
} from "../param-keys.js";

export type DistortionType = "soft" | "hard" | "tanh" | "atan" | "foldback";

export interface DistortionParams {
  type: DistortionType;
  /** Drive amount (1 = clean, higher = more distortion). */
  drive: number;
  /** Output gain (0–1) to compensate for volume increase. Default 1.0. */
  outputGain?: number;
  /** Dry/wet mix (0–1). */
  mix?: number;
  bypass?: boolean;
}

/**
 * useDistortion — waveshaper distortion with multiple curves.
 */
export function useDistortion(input: Signal, params: DistortionParams): Signal {
  return useAudioNode(
    "distortion",
    {
      [PARAM_DISTORTION_TYPE]: params.type,
      [PARAM_DRIVE]: params.drive,
      [PARAM_OUTPUT_GAIN]: params.outputGain ?? 1,
      [PARAM_MIX]: params.mix ?? 1,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    [input],
  );
}
