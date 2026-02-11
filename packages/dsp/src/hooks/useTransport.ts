import { useContext } from "react";
import { TransportContext, type TransportState } from "@react-audio-unit/core";

/**
 * useTransport — access the DAW's transport state.
 *
 * Returns the current playback state, BPM, position, and time signature.
 * Updates are pushed from the native side at ~60fps.
 */
export function useTransport(): TransportState {
  return useContext(TransportContext);
}
