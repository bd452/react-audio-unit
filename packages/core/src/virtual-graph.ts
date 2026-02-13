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
  private callIndex = 0;
  private _dirty = false;

  registerNode(descriptor: AudioNodeDescriptor): void {
    this.nodes.set(descriptor.id, descriptor);
    this._dirty = true;
  }

  setOutputNode(nodeId: string): void {
    this.outputNodeId = nodeId;
    this._dirty = true;
  }

  /**
   * Returns true if any nodes or the output node have been registered
   * since the last `clear()`. Used to guard against React StrictMode
   * double-firing the reconciliation effect — if no render happened
   * between two effect runs, the graph is clean and should be skipped.
   */
  isDirty(): boolean {
    return this._dirty;
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

  /**
   * Get the next call index and increment. Used by useAudioNode to
   * generate unique node IDs within a render cycle.
   */
  nextCallIndex(): number {
    return this.callIndex++;
  }

  clear(): void {
    this.nodes.clear();
    this.outputNodeId = null;
    this.callIndex = 0;
    this._dirty = false;
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
