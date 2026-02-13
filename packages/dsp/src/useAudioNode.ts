import { useRef, useMemo } from "react";
import {
  useAudioGraphContext,
  type Signal,
  createSignal,
} from "@react-audio-unit/core";

/**
 * Global monotonic counter for generating unique node IDs. This MUST NOT
 * reset across render cycles — otherwise nodes that mount after the
 * initial render (e.g. dynamically added polyphonic voices) can collide
 * with IDs assigned during earlier renders.
 */
let globalNodeCounter = 0;

/**
 * useAudioNode — the primitive that every DSP hook builds on.
 *
 * Registers a node of the given `type` in the virtual audio graph during
 * render. The node's identity is derived from its first-call position
 * (same principle as React's hook identity), so the Rules of Hooks
 * naturally enforce a static audio graph topology.
 *
 * @param type    - Node type identifier (must match a native C++ node)
 * @param params  - Node parameters (numbers, strings, booleans)
 * @param inputs  - Incoming audio signals (connections from other nodes)
 * @returns Signal handle pointing to this node's output
 */
export function useAudioNode(
  type: string,
  params: Record<string, number | string | boolean>,
  inputs: Signal[] = [],
): Signal {
  const ctx = useAudioGraphContext();

  // Stable node ID — assigned once on first render, never changes.
  // Uses a global monotonic counter so nodes that mount at different
  // times (e.g. dynamically added polyphonic voices) never collide.
  const nodeIdRef = useRef<string | null>(null);
  if (nodeIdRef.current === null) {
    nodeIdRef.current = `${type}_${globalNodeCounter++}`;
  }
  const nodeId = nodeIdRef.current;

  // Register this node in the virtual graph (happens every render).
  // The reconciler will diff against the previous render's graph.
  ctx.registerNode({
    id: nodeId,
    type,
    params,
    inputs: inputs.map((sig, i) => ({
      fromNodeId: sig.nodeId,
      fromOutlet: sig.outlet,
      toInlet: i,
    })),
  });

  // Return a stable Signal reference (only changes if nodeId changes, which it won't)
  return useMemo(() => createSignal(nodeId), [nodeId]);
}
