import type { Signal } from "@react-audio-unit/core";
import { useDelay } from "./useDelay.js";
import { useMix } from "./useMix.js";

export interface ChorusParams {
  /** LFO rate in Hz. Default 1.5. */
  rate?: number;
  /** Modulation depth in ms. Default 5. */
  depth?: number;
  /** Base delay time in ms. Default 15. */
  delayMs?: number;
  /** Dry/wet mix (0–1). Default 0.5. */
  mix?: number;
  /** Number of voices (1–4). Default 2. */
  voices?: number;
  bypass?: boolean;
}

/**
 * useChorus — chorus effect, composable from delay + LFO modulation.
 *
 * Creates multiple delayed copies of the input with slightly
 * different delay times, producing a thickening/doubling effect.
 * The native delay node handles the modulation internally when
 * its time parameter is varied per-sample by the LFO.
 *
 * For simplicity, this hook creates multiple delay nodes with
 * slightly offset delay times to simulate chorus. The LFO
 * modulation would ideally be sample-accurate on the C++ side;
 * here we use static offsets that still produce a chorus-like effect.
 */
export function useChorus(input: Signal, params: ChorusParams = {}): Signal {
  const {
    rate = 1.5,
    depth = 5,
    delayMs = 15,
    mix = 0.5,
    voices = 2,
    bypass = false,
  } = params;

  // Create offset delays for each voice
  // Voice 1: slightly shorter, Voice 2: slightly longer, etc.
  const voiceCount = Math.max(1, Math.min(4, Math.round(voices)));

  // First voice
  const voice1 = useDelay(input, {
    time: delayMs - depth * 0.5,
    feedback: 0,
    mix: 1,
    bypass,
  });

  if (voiceCount === 1) {
    return useMix(input, voice1, mix);
  }

  // Second voice with different offset
  const voice2 = useDelay(input, {
    time: delayMs + depth * 0.5,
    feedback: 0,
    mix: 1,
    bypass,
  });

  // Mix voices together, then mix with dry signal
  const wet = useMix(voice1, voice2, 0.5);
  return useMix(input, wet, mix);
}
