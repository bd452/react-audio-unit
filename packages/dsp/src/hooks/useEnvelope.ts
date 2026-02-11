import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface EnvelopeParams {
  /** Attack time in ms. */
  attack: number;
  /** Decay time in ms. */
  decay: number;
  /** Sustain level (0–1). */
  sustain: number;
  /** Release time in ms. */
  release: number;
}

/**
 * useEnvelope — ADSR envelope generator.
 *
 * Triggered by MIDI note events on the input signal.
 * Returns a Signal representing the envelope amplitude (0–1).
 */
export function useEnvelope(midi: Signal, params: EnvelopeParams): Signal {
  return useAudioNode(
    "envelope",
    {
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release,
    },
    [midi],
  );
}
