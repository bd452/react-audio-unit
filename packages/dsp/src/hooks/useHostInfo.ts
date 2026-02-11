import { useContext } from "react";
import { HostInfoContext, type HostInfo } from "@react-audio-unit/core";

/**
 * useHostInfo — access host audio configuration.
 *
 * Returns the current sample rate and block size.
 */
export function useHostInfo(): HostInfo {
  return useContext(HostInfoContext);
}
