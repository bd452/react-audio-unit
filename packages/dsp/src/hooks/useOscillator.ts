import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import {
  PARAM_WAVEFORM,
  PARAM_FREQUENCY,
  PARAM_DETUNE,
  PARAM_BYPASS,
} from "../param-keys.js";

export type WaveformType = "sine" | "saw" | "square" | "triangle";

export interface OscillatorParams {
  /** Waveform shape. */
  waveform: WaveformType;
  /** Frequency in Hz (ignored if midi input is provided). */
  frequency?: number;
  /** Detune in cents. */
  detune?: number;
  bypass?: boolean;
}

/**
 * useOscillator — generates audio from a waveform.
 *
 * Can be called two ways:
 *   useOscillator(params)             — fixed-frequency generator
 *   useOscillator(midiSignal, params) — MIDI-driven (pitch from notes)
 */
export function useOscillator(
  paramsOrMidi: OscillatorParams | Signal | null,
  maybeParams?: OscillatorParams,
): Signal {
  let midi: Signal | null = null;
  let params: OscillatorParams;

  if (maybeParams !== undefined) {
    // Called as useOscillator(midi, params)
    midi = paramsOrMidi as Signal | null;
    params = maybeParams;
  } else {
    // Called as useOscillator(params)
    params = paramsOrMidi as OscillatorParams;
  }

  const inputs = midi ? [midi] : [];
  return useAudioNode(
    "oscillator",
    {
      [PARAM_WAVEFORM]: params.waveform,
      [PARAM_FREQUENCY]: params.frequency ?? 440,
      [PARAM_DETUNE]: params.detune ?? 0,
      [PARAM_BYPASS]: params.bypass ?? false,
    },
    inputs,
  );
}
