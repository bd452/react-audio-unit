import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * useMidi — provides the MIDI input signal from the DAW.
 *
 * Returns a Signal that represents incoming MIDI events from bus 0.
 * Pass this to instrument nodes (useOscillator, useEnvelope, etc.)
 * to drive them from MIDI note data.
 *
 * For multi-bus MIDI or bus metadata, use `useMidiInput()` instead.
 *
 * @deprecated Prefer `useMidiInput()` which provides bus-aware MIDI
 * with layout metadata and multi-bus support.
 */
export function useMidi(): Signal {
  return useAudioNode("midi_input", { __midiBus: 0 });
}
