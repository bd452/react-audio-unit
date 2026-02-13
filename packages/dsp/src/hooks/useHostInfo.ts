import { useContext } from "react";
import { HostInfoContext, type HostInfo } from "@react-audio-unit/core";

/**
 * useHostInfo — access host audio configuration.
 *
 * Returns sample rate, block size, and current audio bus layouts.
 */
export function useHostInfo(): HostInfo {
  return useContext(HostInfoContext);
}
