import { useMemo } from "react";
import type { Signal } from "@react-audio-unit/core";
import { createSignal } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

/**
 * useChannelSplit — splits a stereo signal into separate left/right signals.
 *
 * Takes a stereo input and returns two mono signals:
 *   - `left`  (outlet 0) — left channel
 *   - `right` (outlet 1) — right channel
 */
export function useChannelSplit(input: Signal): {
  left: Signal;
  right: Signal;
} {
  const signal = useAudioNode("split", { bypass: false }, [input]);

  const left = signal; // outlet 0 (default)
  const right = useMemo(
    () => createSignal(signal.nodeId, 1),
    [signal.nodeId],
  );

  return { left, right };
}
