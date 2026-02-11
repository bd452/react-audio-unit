/**
 * DevBridge — Web Audio API–backed mock bridge for browser development.
 *
 * When running outside a JUCE WebView (e.g. in a regular browser via
 * `rau dev`), this provides a basic audio passthrough and parameter
 * system so plugins can be previewed without the native harness.
 *
 * Usage: import and call `installDevBridge()` before PluginHost mounts.
 * This is done automatically in development mode.
 */

import type { BridgeOutMessage, BridgeInMessage, GraphOp } from "./types.js";

interface DevNode {
  type: string;
  params: Record<string, number>;
  inputs: string[];
  webAudioNode?: AudioNode;
}

class DevAudioEngine {
  private ctx: AudioContext | null = null;
  private nodes = new Map<string, DevNode>();
  private outputNodeId = "";
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNodes = new Map<string, GainNode>();

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();

    // Try to get mic input for effects (optional)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.sourceNode = this.ctx.createMediaStreamSource(stream);
    } catch {
      // No mic access — generate silence
    }
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  applyOps(ops: GraphOp[]): void {
    for (const op of ops) {
      switch (op.op) {
        case "addNode":
          this.nodes.set(op.nodeId, {
            type: op.nodeType,
            params: this.numericParams(op.params),
            inputs: [],
          });
          this.rebuildWebAudio();
          break;
        case "removeNode":
          this.nodes.delete(op.nodeId);
          this.rebuildWebAudio();
          break;
        case "updateParams": {
          const node = this.nodes.get(op.nodeId);
          if (node) {
            Object.assign(node.params, this.numericParams(op.params));
            // Update gain nodes in real-time
            const gainNode = this.gainNodes.get(op.nodeId);
            if (gainNode && node.params.gain !== undefined) {
              gainNode.gain.setTargetAtTime(
                node.params.gain,
                this.ctx?.currentTime ?? 0,
                0.02,
              );
            }
          }
          break;
        }
        case "connect": {
          const toNode = this.nodes.get(op.to.nodeId);
          if (toNode) {
            toNode.inputs.push(op.from.nodeId);
          }
          break;
        }
        case "disconnect": {
          const toNode = this.nodes.get(op.to.nodeId);
          if (toNode) {
            toNode.inputs = toNode.inputs.filter((id) => id !== op.from.nodeId);
          }
          break;
        }
        case "setOutput":
          this.outputNodeId = op.nodeId;
          this.rebuildWebAudio();
          break;
      }
    }
  }

  setParam(nodeId: string, param: string, value: number): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.params[param] = value;
      const gainNode = this.gainNodes.get(nodeId);
      if (gainNode && param === "gain") {
        gainNode.gain.setTargetAtTime(value, this.ctx?.currentTime ?? 0, 0.02);
      }
    }
  }

  private numericParams(
    params: Record<string, number | string | boolean>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "number") result[k] = v;
      else if (typeof v === "boolean") result[k] = v ? 1 : 0;
      // Strings are dropped for the simple Web Audio mock
    }
    return result;
  }

  private rebuildWebAudio(): void {
    if (!this.ctx) return;

    // Disconnect everything
    for (const [, gainNode] of this.gainNodes) {
      gainNode.disconnect();
    }
    this.gainNodes.clear();
    this.sourceNode?.disconnect();

    // Simple approach: create a gain node for each graph node,
    // wire input→gain chain→output
    for (const [id, node] of this.nodes) {
      const gain = this.ctx.createGain();
      gain.gain.value = node.params.gain ?? 1.0;
      this.gainNodes.set(id, gain);
    }

    // Connect chain: source → first node → ... → output
    // For simplicity, connect source to input nodes, chain through, connect output to destination
    for (const [id, node] of this.nodes) {
      const gainNode = this.gainNodes.get(id);
      if (!gainNode) continue;

      if (node.type === "input" && this.sourceNode) {
        this.sourceNode.connect(gainNode);
      }

      for (const inputId of node.inputs) {
        const inputGain = this.gainNodes.get(inputId);
        if (inputGain) {
          inputGain.connect(gainNode);
        }
      }
    }

    // Connect output node to destination
    if (this.outputNodeId) {
      const outputGain = this.gainNodes.get(this.outputNodeId);
      if (outputGain) {
        outputGain.connect(this.ctx.destination);
      }
    }
  }
}

let devEngine: DevAudioEngine | null = null;
let dispatchToJS: ((msg: BridgeInMessage) => void) | null = null;

/**
 * Install the dev bridge mock. Call this before PluginHost mounts
 * when running in a browser (not inside JUCE WebView).
 *
 * @param onMessage — callback to dispatch messages to the NativeBridge
 */
export function installDevBridge(
  onMessage: (msg: BridgeInMessage) => void,
): void {
  dispatchToJS = onMessage;
  devEngine = new DevAudioEngine();
  devEngine.init().catch(() => {
    /* Silently fail if AudioContext unavailable */
  });

  // Install the global handler that NativeBridge.send() calls in dev mode
  (globalThis as any).__RAU_DEV_BRIDGE__ = (msg: BridgeOutMessage) => {
    handleDevMessage(msg);
  };

  // Send initial host info
  setTimeout(() => {
    const ctx = devEngine?.getContext();
    if (ctx && dispatchToJS) {
      dispatchToJS({ type: "sampleRate", value: ctx.sampleRate });
      dispatchToJS({ type: "blockSize", value: 128 });
    }
  }, 100);
}

function handleDevMessage(msg: BridgeOutMessage): void {
  switch (msg.type) {
    case "graphOps":
      devEngine?.applyOps(msg.ops);
      break;
    case "paramUpdate":
      devEngine?.setParam(msg.nodeId, msg.paramName, msg.value);
      break;
    case "registerParameter":
      // In dev mode, we just acknowledge
      break;
    case "setParameterValue":
      // In dev mode, parameters are managed in-memory only
      break;
    case "getState":
      dispatchToJS?.({ type: "requestState" });
      break;
    case "setState":
      // No-op in dev mode
      break;
    default:
      break;
  }
}

/**
 * Auto-install the dev bridge if we're not in a JUCE WebView.
 * This is called by PluginHost on mount.
 */
export function autoInstallDevBridge(
  dispatch: (msg: BridgeInMessage) => void,
): void {
  if (
    typeof window !== "undefined" &&
    !(window as any).__JUCE__ &&
    !(globalThis as any).__RAU_DEV_BRIDGE__
  ) {
    installDevBridge(dispatch);
  }
}
