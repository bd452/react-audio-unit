import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_ROOM_SIZE,
  PARAM_DAMPING,
  PARAM_MIX,
  PARAM_PRE_DELAY,
  PARAM_BYPASS,
} from "../param-keys.js";

export interface ReverbParams {
  /** Room size (0–1). */
  roomSize: number;
  /** High-frequency damping (0–1). */
  damping: number;
  /** Dry/wet mix (0–1). */
  mix: number;
  /** Pre-delay in ms. */
  preDelay?: number;
  bypass?: boolean;
}

/**
 * useReverb — algorithmic reverb (Freeverb-based).
 */
export function useReverb(input: Signal, params: ReverbParams): Signal {
  return useAudioNode(
    "reverb",
    {
      [PARAM_ROOM_SIZE]: params.roomSize,
      [PARAM_DAMPING]: params.damping,
      [PARAM_MIX]: params.mix,
      [PARAM_PRE_DELAY]: params.preDelay ?? 0,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    [input],
  );
}
