import type { GraphOp } from "./types.js";
import type { VirtualAudioGraphSnapshot } from "./virtual-graph.js";

/**
 * Diff two virtual audio graph snapshots and return the minimal set of
 * operations needed to transform `prev` into `next`.
 *
 * This is the audio equivalent of React's DOM diffing algorithm.
 */
export function diffGraphs(
  prev: VirtualAudioGraphSnapshot | null,
  next: VirtualAudioGraphSnapshot,
): GraphOp[] {
  const ops: GraphOp[] = [];

  const prevNodes = prev?.nodes ?? new Map();
  const nextNodes = next.nodes;

  // --- 1. Removed nodes: exist in prev, absent in next -----------------------
  for (const [id, node] of prevNodes) {
    if (!nextNodes.has(id)) {
      // Disconnect inputs before removing
      for (const conn of node.inputs) {
        ops.push({
          op: "disconnect",
          from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet },
          to: { nodeId: id, inlet: conn.toInlet },
        });
      }
      ops.push({ op: "removeNode", nodeId: id });
    }
  }

  // --- 2. Added nodes: exist in next, absent in prev -------------------------
  for (const [id, node] of nextNodes) {
    if (!prevNodes.has(id)) {
      ops.push({
        op: "addNode",
        nodeId: id,
        nodeType: node.type,
        params: node.params,
      });
      for (const conn of node.inputs) {
        ops.push({
          op: "connect",
          from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet },
          to: { nodeId: id, inlet: conn.toInlet },
        });
      }
    }
  }

  // --- 3. Updated nodes: exist in both, check for param/connection changes ----
  for (const [id, nextNode] of nextNodes) {
    const prevNode = prevNodes.get(id);
    if (!prevNode) continue;

    // 3a. Parameter changes
    if (!shallowEqual(prevNode.params, nextNode.params)) {
      ops.push({ op: "updateParams", nodeId: id, params: nextNode.params });
    }

    // 3b. Connection changes
    const prevConns = connectionSet(id, prevNode.inputs);
    const nextConns = connectionSet(id, nextNode.inputs);

    // New connections
    for (const conn of nextNode.inputs) {
      const key = connectionKey(id, conn);
      if (!prevConns.has(key)) {
        ops.push({
          op: "connect",
          from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet },
          to: { nodeId: id, inlet: conn.toInlet },
        });
      }
    }
    // Removed connections
    for (const conn of prevNode.inputs) {
      const key = connectionKey(id, conn);
      if (!nextConns.has(key)) {
        ops.push({
          op: "disconnect",
          from: { nodeId: conn.fromNodeId, outlet: conn.fromOutlet },
          to: { nodeId: id, inlet: conn.toInlet },
        });
      }
    }
  }

  // --- 4. Output node change --------------------------------------------------
  if (next.outputNodeId !== prev?.outputNodeId && next.outputNodeId) {
    ops.push({ op: "setOutput", nodeId: next.outputNodeId });
  }

  return ops;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connectionKey(
  toNodeId: string,
  conn: { fromNodeId: string; fromOutlet: number; toInlet: number },
): string {
  return `${conn.fromNodeId}:${conn.fromOutlet}->${toNodeId}:${conn.toInlet}`;
}

function connectionSet(
  toNodeId: string,
  inputs: { fromNodeId: string; fromOutlet: number; toInlet: number }[],
): Set<string> {
  return new Set(inputs.map((c) => connectionKey(toNodeId, c)));
}

function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
