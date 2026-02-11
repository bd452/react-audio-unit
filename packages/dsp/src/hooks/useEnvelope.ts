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
 * Can be called two ways:
 *   useEnvelope(params)            — gate controlled via parameter
 *   useEnvelope(gateSignal, params) — gate from input signal (e.g. MIDI)
 *
 * Returns a Signal representing the envelope amplitude (0–1).
 */
export function useEnvelope(
  paramsOrGate: EnvelopeParams | Signal,
  maybeParams?: EnvelopeParams,
): Signal {
  let gate: Signal | null = null;
  let params: EnvelopeParams;

  if (maybeParams !== undefined) {
    // Called as useEnvelope(gateSignal, params)
    gate = paramsOrGate as Signal;
    params = maybeParams;
  } else {
    // Called as useEnvelope(params)
    params = paramsOrGate as EnvelopeParams;
  }

  const inputs = gate ? [gate] : [];
  return useAudioNode(
    "envelope",
    {
      attack: params.attack,
      decay: params.decay,
      sustain: params.sustain,
      release: params.release,
    },
    inputs,
  );
}
