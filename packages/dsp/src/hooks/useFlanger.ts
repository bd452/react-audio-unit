import type { Signal } from "@react-audio-unit/core";
import { useDelay } from "./useDelay.js";
import { useMix } from "./useMix.js";

export interface FlangerParams {
  /** LFO rate in Hz. Default 0.5. */
  rate?: number;
  /** Modulation depth in ms. Default 2. */
  depth?: number;
  /** Base delay time in ms (very short for flanging). Default 3. */
  delayMs?: number;
  /** Feedback amount (0–0.95). Default 0.5. Negative values invert phase. */
  feedback?: number;
  /** Dry/wet mix (0–1). Default 0.5. */
  mix?: number;
  bypass?: boolean;
}

/**
 * useFlanger — flanger effect from a short modulated delay with feedback.
 *
 * A flanger is essentially a very short delay (1–10ms) with feedback
 * and time modulation, creating a comb-filter sweep effect.
 */
export function useFlanger(input: Signal, params: FlangerParams = {}): Signal {
  const {
    depth = 2,
    delayMs = 3,
    feedback = 0.5,
    mix = 0.5,
    bypass = false,
  } = params;

  // Short delay with feedback creates the comb-filter effect
  const delayed = useDelay(input, {
    time: delayMs + depth * 0.5, // Offset simulates LFO center position
    feedback: Math.max(-0.95, Math.min(0.95, feedback)),
    mix: 1,
    bypass,
  });

  return useMix(input, delayed, mix);
}
