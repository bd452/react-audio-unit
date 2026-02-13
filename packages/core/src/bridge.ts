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
 * WebBrowserComponent messaging (window.__JUCE__.backend.emitEvent +
 * native-side event listeners).
 *
 * In dev/browser mode, it falls back to a mock or Web Audio–backed
 * implementation for rapid iteration.
 */
export class NativeBridge {
  private handlers = new Set<MessageHandler>();
  private connected = false;
  private pendingMessages: BridgeOutMessage[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize the bridge. Call once at plugin startup.
   * Detects the runtime environment (JUCE WebView vs browser) and sets
   * up the appropriate transport.
   */
  connect(): void {
    if (this.connected) return;

    // Listen for C++→JS messages dispatched as CustomEvents on window.
    // The native WebViewBridge sends: window.dispatchEvent(new CustomEvent('rau_native_message', { detail: jsonStr }))
    window.addEventListener("rau_native_message", ((event: CustomEvent) => {
      try {
        const msg: BridgeInMessage = JSON.parse(event.detail);
        this.dispatch(msg);
      } catch {
        // Ignore malformed messages
      }
    }) as EventListener);

    this.connected = true;
  }

  /**
   * Send a message to the native C++ side.
   */
  send(msg: BridgeOutMessage): void {
    // Try immediate delivery. If the backend isn't ready yet, queue and retry.
    if (this.trySend(msg)) {
      this.flushPending();
      return;
    }

    this.pendingMessages.push(msg);
    this.scheduleFlush();
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

  private trySend(msg: BridgeOutMessage): boolean {
    const juceBackend = getJuceBackend();
    if (juceBackend) {
      juceBackend.emitEvent("rau_js_message", JSON.stringify(msg));
      return true;
    }

    // Dev/browser mode — handled by the mock bridge.
    if (typeof (globalThis as any).__RAU_DEV_BRIDGE__ === "function") {
      (globalThis as any).__RAU_DEV_BRIDGE__(msg);
      return true;
    }

    return false;
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPending();

      if (this.pendingMessages.length > 0) {
        this.scheduleFlush();
      }
    }, 50);
  }

  private flushPending(): void {
    if (this.pendingMessages.length === 0) return;

    const remaining: BridgeOutMessage[] = [];
    for (const queued of this.pendingMessages) {
      if (!this.trySend(queued)) {
        remaining.push(queued);
      }
    }
    this.pendingMessages = remaining;
  }
}

interface JuceBackend {
  emitEvent(eventId: string, payload: unknown): void;
}

function getJuceBackend(): JuceBackend | null {
  if (typeof window === "undefined") return null;

  const backend = (window as any).__JUCE__?.backend;
  if (!backend || typeof backend.emitEvent !== "function") return null;
  return backend as JuceBackend;
}

/** Singleton bridge instance. */
export const bridge = new NativeBridge();
