import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export type DistortionType = "soft" | "hard" | "tanh" | "atan" | "foldback";

export interface DistortionParams {
  type: DistortionType;
  /** Drive amount (1 = clean, higher = more distortion). */
  drive: number;
  /** Output level (0–1) to compensate for volume increase. */
  outputLevel?: number;
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
      distortionType: params.type,
      drive: params.drive,
      outputLevel: params.outputLevel ?? 1,
      mix: params.mix ?? 1,
      bypass: params.bypass ?? false,
    },
    [input],
  );
}
