import type { AudioNodeDescriptor, ConnectionDescriptor } from "./types.js";

/**
 * VirtualAudioGraph — the audio equivalent of a virtual DOM.
 *
 * During a React render, DSP hooks register nodes here. After the render
 * completes, the reconciler diffs the previous graph against this one and
 * emits the minimal set of GraphOps to bring the native engine in sync.
 */
export class VirtualAudioGraph {
  private nodes = new Map<string, AudioNodeDescriptor>();
  private outputNodeId: string | null = null;

  registerNode(descriptor: AudioNodeDescriptor): void {
    this.nodes.set(descriptor.id, descriptor);
  }

  setOutputNode(nodeId: string): void {
    this.outputNodeId = nodeId;
  }

  getNode(id: string): AudioNodeDescriptor | undefined {
    return this.nodes.get(id);
  }

  getOutputNodeId(): string | null {
    return this.outputNodeId;
  }

  getAllNodes(): Map<string, AudioNodeDescriptor> {
    return this.nodes;
  }

  clear(): void {
    this.nodes.clear();
    this.outputNodeId = null;
  }

  /**
   * Create an immutable snapshot for diffing. The snapshot is a deep clone
   * so the live graph can be mutated freely on the next render.
   */
  snapshot(): VirtualAudioGraphSnapshot {
    const nodesClone = new Map<string, AudioNodeDescriptor>();
    for (const [id, node] of this.nodes) {
      nodesClone.set(id, {
        ...node,
        params: { ...node.params },
        inputs: node.inputs.map((c) => ({ ...c })),
      });
    }
    return { nodes: nodesClone, outputNodeId: this.outputNodeId };
  }
}

export interface VirtualAudioGraphSnapshot {
  readonly nodes: Map<string, AudioNodeDescriptor>;
  readonly outputNodeId: string | null;
}
