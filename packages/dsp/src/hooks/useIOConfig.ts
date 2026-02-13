import { useContext } from "react";
import type { ActiveIOConfig } from "@react-audio-unit/core";
import { IOConfigContext } from "@react-audio-unit/core";

/**
 * useIOConfig — read the active I/O configuration from the host.
 *
 * Returns the negotiated `ActiveIOConfig` which contains the selected
 * channel layout for each audio and MIDI bus. Plugins can use this to
 * adapt their processing or UI based on the host's chosen configuration.
 *
 * @example
 * ```tsx
 * const io = useIOConfig();
 *
 * // Check main output layout
 * const outLayout = io.audio.outputs[0]?.layout; // "stereo" | "surround-5.1" | ...
 *
 * // Adapt processing based on I/O format
 * if (outLayout === "surround-5.1") {
 *   // Use 5.1 surround processing path
 * } else {
 *   // Use stereo processing path
 * }
 *
 * // Check if MIDI is available
 * const hasMidi = io.midi.inputs.length > 0 && io.midi.inputs[0].active;
 * ```
 */
export function useIOConfig(): ActiveIOConfig {
  return useContext(IOConfigContext);
}
