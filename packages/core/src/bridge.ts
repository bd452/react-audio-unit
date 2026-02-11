import type {
  BridgeOutMessage,
  BridgeInMessage,
  GraphOp,
  ParameterConfig,
} from "./types.js";

type MessageHandler = (msg: BridgeInMessage) => void;

/**
 * NativeBridge — the JS side of the JUCE WebView bridge.
 *
 * In production, this communicates with the C++ plugin via JUCE's
 * WebBrowserComponent messaging (window.__JUCE__.backend.emitEvent /
 * window.__JUCE__.backend.addEventListener).
 *
 * In dev/browser mode, it falls back to a mock or Web Audio–backed
 * implementation for rapid iteration.
 */
export class NativeBridge {
  private handlers = new Set<MessageHandler>();
  private connected = false;

  /**
   * Initialize the bridge. Call once at plugin startup.
   * Detects the runtime environment (JUCE WebView vs browser) and sets
   * up the appropriate transport.
   */
  connect(): void {
    if (this.connected) return;

    if (isJuceWebView()) {
      // JUCE WebView: register callback for messages from C++
      (window as any).__JUCE__.backend.addEventListener(
        "rau_native_message",
        (event: any) => {
          const msg: BridgeInMessage = JSON.parse(event.detail);
          this.dispatch(msg);
        },
      );
    }

    this.connected = true;
  }

  /**
   * Send a message to the native C++ side.
   */
  send(msg: BridgeOutMessage): void {
    if (isJuceWebView()) {
      (window as any).__JUCE__.backend.emitEvent(
        "rau_js_message",
        JSON.stringify(msg),
      );
    } else {
      // Dev/browser mode — handled by the mock bridge
      if (typeof (globalThis as any).__RAU_DEV_BRIDGE__ === "function") {
        (globalThis as any).__RAU_DEV_BRIDGE__(msg);
      }
    }
  }

  /**
   * Subscribe to messages from the native side.
   */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  // --- Convenience methods ---------------------------------------------------

  sendGraphOps(ops: GraphOp[]): void {
    if (ops.length === 0) return;
    this.send({ type: "graphOps", ops });
  }

  sendParamUpdate(nodeId: string, paramName: string, value: number): void {
    this.send({ type: "paramUpdate", nodeId, paramName, value });
  }

  registerParameter(id: string, config: ParameterConfig): void {
    this.send({ type: "registerParameter", id, config });
  }

  unregisterParameter(id: string): void {
    this.send({ type: "unregisterParameter", id });
  }

  setParameterValue(id: string, value: number): void {
    this.send({ type: "setParameterValue", id, value });
  }

  // --- Internal --------------------------------------------------------------

  /** Dispatch an incoming message to all registered handlers. */
  dispatch(msg: BridgeInMessage): void {
    for (const handler of this.handlers) {
      handler(msg);
    }
  }
}

function isJuceWebView(): boolean {
  return typeof window !== "undefined" && !!(window as any).__JUCE__;
}

/** Singleton bridge instance. */
export const bridge = new NativeBridge();
