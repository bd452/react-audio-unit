import { useEffect } from "react";
import type { Signal } from "@react-audio-unit/core";
import { useAudioGraphContext } from "@react-audio-unit/core";

/**
 * useOutput — designates a signal as the plugin's audio output.
 *
 * Must be called exactly once per plugin. The signal passed here
 * is what the DAW receives as the plugin's processed audio.
 */
export function useOutput(signal: Signal): void {
  const ctx = useAudioGraphContext();
  ctx.setOutputNode(signal.nodeId);
}
