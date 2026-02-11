import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export type WaveformType = "sine" | "saw" | "square" | "triangle";

export interface OscillatorParams {
  /** Waveform shape. */
  waveform: WaveformType;
  /** Frequency in Hz (ignored if midi input is provided). */
  frequency?: number;
  /** Detune in cents. */
  detune?: number;
  /** Number of unison voices. */
  unison?: number;
  bypass?: boolean;
}

/**
 * useOscillator — generates audio from a waveform.
 *
 * If a MIDI signal is provided as input, frequency is derived from
 * incoming MIDI note events (polyphonic). Otherwise, uses the
 * `frequency` parameter for a fixed tone.
 *
 * @param midi - Optional MIDI input signal for pitch tracking
 */
export function useOscillator(
  midi: Signal | null,
  params: OscillatorParams,
): Signal {
  const inputs = midi ? [midi] : [];
  return useAudioNode(
    "oscillator",
    {
      waveform: params.waveform,
      frequency: params.frequency ?? 440,
      detune: params.detune ?? 0,
      unison: params.unison ?? 1,
      bypass: params.bypass ?? false,
    },
    inputs,
  );
}
