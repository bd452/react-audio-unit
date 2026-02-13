import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_DELAY_TIME,
  PARAM_FEEDBACK,
  PARAM_MIX,
  PARAM_BYPASS,
} from "../param-keys.js";

export interface DelayParams {
  /** Delay time in milliseconds. */
  time: number;
  /** Feedback amount (0–1). 0 = no feedback, approaching 1 = infinite. */
  feedback?: number;
  /** Dry/wet mix (0 = fully dry, 1 = fully wet). */
  mix?: number;
  bypass?: boolean;
}

/**
 * useDelay — applies a delay line to an audio signal.
 *
 * The native implementation uses a circular buffer with linear
 * interpolation for smooth time changes.
 */
export function useDelay(input: Signal, params: DelayParams): Signal {
  return useAudioNode(
    "delay",
    {
      [PARAM_DELAY_TIME]: params.time,
      [PARAM_FEEDBACK]: params.feedback ?? 0,
      [PARAM_MIX]: params.mix ?? 1,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    [input],
  );
}
