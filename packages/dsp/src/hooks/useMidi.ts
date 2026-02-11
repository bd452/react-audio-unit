import type { Signal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * useMidi — provides the MIDI input signal from the DAW.
 *
 * Returns a Signal that represents incoming MIDI events.
 * Pass this to instrument nodes (useOscillator, useEnvelope, etc.)
 * to drive them from MIDI note data.
 */
export function useMidi(): Signal {
  return useAudioNode("midi_input", {});
}
