import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  VirtualAudioGraph,
  type VirtualAudioGraphSnapshot,
} from "./virtual-graph.js";
import { diffGraphsFull } from "./graph-differ.js";
import { bridge, NativeBridge } from "./bridge.js";
import { autoInstallDevBridge } from "./dev-bridge.js";
import type {
  AudioNodeDescriptor,
  BridgeInMessage,
  GraphOp,
  MidiEvent,
  ParameterConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Audio Graph Context — used by DSP hooks to register nodes
// ---------------------------------------------------------------------------

export interface AudioGraphContextValue {
  registerNode(descriptor: AudioNodeDescriptor): void;
  setOutputNode(nodeId: string): void;
  nextCallIndex(): number;
  bridge: NativeBridge;
}

export const AudioGraphContext = createContext<AudioGraphContextValue | null>(
  null,
);

export function useAudioGraphContext(): AudioGraphContextValue {
  const ctx = useContext(AudioGraphContext);
  if (!ctx) {
    throw new Error("useAudioGraphContext: must be used inside <PluginHost>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Parameter Registry Context — tracks registered DAW parameters
// ---------------------------------------------------------------------------

export interface ParameterEntry {
  config: ParameterConfig;
  value: number;
  setValue: (v: number) => void;
}

export interface ParameterRegistryContextValue {
  register(
    id: string,
    config: ParameterConfig,
    setValue: (v: number) => void,
  ): void;
  unregister(id: string): void;
  getAll(): Map<string, ParameterEntry>;
}

export const ParameterRegistryContext =
  createContext<ParameterRegistryContextValue | null>(null);

// ---------------------------------------------------------------------------
// Transport Context
// ---------------------------------------------------------------------------

export interface TransportState {
  playing: boolean;
  bpm: number;
  positionSamples: number;
  timeSigNum: number;
  timeSigDen: number;
}

export const TransportContext = createContext<TransportState>({
  playing: false,
  bpm: 120,
  positionSamples: 0,
  timeSigNum: 4,
  timeSigDen: 4,
});

// ---------------------------------------------------------------------------
// MIDI Context
// ---------------------------------------------------------------------------

export const MidiContext = createContext<MidiEvent[]>([]);

// ---------------------------------------------------------------------------
// Host Info Context
// ---------------------------------------------------------------------------

export interface HostInfo {
  sampleRate: number;
  blockSize: number;
}

export const HostInfoContext = createContext<HostInfo>({
  sampleRate: 44100,
  blockSize: 512,
});

// ---------------------------------------------------------------------------
// PluginHost — top-level provider for a plugin
// ---------------------------------------------------------------------------

export interface PluginHostProps {
  children: ReactNode;
}

/**
 * PluginHost wraps the plugin component tree and provides:
 *  - The audio graph context (for DSP hooks)
 *  - The native bridge connection
 *  - Graph reconciliation on each render cycle
 *  - Transport, MIDI, and host info contexts
 */
export function PluginHost({ children }: PluginHostProps) {
  const graphRef = useRef(new VirtualAudioGraph());
  const prevSnapshotRef = useRef<VirtualAudioGraphSnapshot | null>(null);
  const paramRegistryRef = useRef(new Map<string, ParameterEntry>());

  // Transport & MIDI state driven by native messages
  const [transport, setTransport] = useState<TransportState>({
    playing: false,
    bpm: 120,
    positionSamples: 0,
    timeSigNum: 4,
    timeSigDen: 4,
  });
  const [midiEvents, setMidiEvents] = useState<MidiEvent[]>([]);
  const [hostInfo, setHostInfo] = useState<HostInfo>({
    sampleRate: 44100,
    blockSize: 512,
  });

  // Start a fresh graph collection for this render cycle. Doing this in render
  // keeps reconciliation idempotent under React StrictMode's extra effect pass.
  graphRef.current.clear();

  // Connect the bridge on mount
  useEffect(() => {
    // Auto-install dev bridge for browser preview if not in JUCE WebView
    autoInstallDevBridge((msg) => bridge.dispatch(msg));

    bridge.connect();

    const unsub = bridge.onMessage((msg: BridgeInMessage) => {
      switch (msg.type) {
        case "parameterChanged": {
          const entry = paramRegistryRef.current.get(msg.id);
          if (entry) entry.setValue(msg.value);
          break;
        }
        case "transport":
          setTransport({
            playing: msg.playing,
            bpm: msg.bpm,
            positionSamples: msg.positionSamples,
            timeSigNum: msg.timeSigNum,
            timeSigDen: msg.timeSigDen,
          });
          break;
        case "midi":
          setMidiEvents(msg.events);
          break;
        case "sampleRate":
          setHostInfo((prev) => ({ ...prev, sampleRate: msg.value }));
          break;
        case "blockSize":
          setHostInfo((prev) => ({ ...prev, blockSize: msg.value }));
          break;
        case "requestState": {
          // Native side requesting plugin state for save
          const state: Record<string, number> = {};
          for (const [id, entry] of paramRegistryRef.current) {
            state[id] = entry.value;
          }
          bridge.send({ type: "setState", state: JSON.stringify(state) });
          break;
        }
        case "restoreState": {
          // Native side restoring saved state
          try {
            const state = JSON.parse(msg.state) as Record<string, number>;
            for (const [id, value] of Object.entries(state)) {
              const entry = paramRegistryRef.current.get(id);
              if (entry) entry.setValue(value);
            }
          } catch {
            /* ignore malformed state */
          }
          break;
        }
      }
    });

    return unsub;
  }, []);

  // Audio graph context — DSP hooks call registerNode during render
  const graphContext = useRef<AudioGraphContextValue>({
    registerNode(descriptor: AudioNodeDescriptor) {
      graphRef.current.registerNode(descriptor);
    },
    setOutputNode(nodeId: string) {
      graphRef.current.setOutputNode(nodeId);
    },
    nextCallIndex() {
      return graphRef.current.nextCallIndex();
    },
    bridge,
  }).current;

  // Parameter registry context
  const paramRegistryContext = useRef<ParameterRegistryContextValue>({
    register(
      id: string,
      config: ParameterConfig,
      setValue: (v: number) => void,
    ) {
      // Wrap the React setState callback so we also keep entry.value
      // in sync. This is critical: requestState reads entry.value to
      // serialize the current plugin state for the DAW's save flow.
      const entry: ParameterEntry = {
        config,
        value: config.default,
        setValue: (v: number) => {
          entry.value = v;
          setValue(v);
        },
      };
      paramRegistryRef.current.set(id, entry);
    },
    unregister(id: string) {
      paramRegistryRef.current.delete(id);
    },
    getAll() {
      return paramRegistryRef.current;
    },
  }).current;

  // Reconcile the audio graph after each render via useEffect.
  // useEffect fires after the render is committed, at which point all
  // DSP hooks have registered their nodes into graphRef.current.
  useEffect(() => {
    // Guard against React 18 StrictMode double-firing effects.
    // In StrictMode (dev only), effects run → cleanup → run again without
    // an intervening render. The first run clears the graph, so the second
    // run sees an empty graph and would incorrectly tear down the native
    // audio graph. The dirty flag ensures we only reconcile when DSP hooks
    // have actually registered nodes during a render.
    if (!graphRef.current.isDirty()) {
      return;
    }

    const nextSnapshot = graphRef.current.snapshot();
    const { ops, paramOnly } = diffGraphsFull(
      prevSnapshotRef.current,
      nextSnapshot,
    );

    if (ops.length > 0) {
      if (paramOnly) {
        // Fast path: only parameters changed — send direct atomic updates
        // instead of full graph operations. This avoids the op queue and
        // topological re-sort on the audio thread.
        // Ops whose values are all numbers or booleans can use the fast path
        // (booleans are converted to 0/1). Ops containing string values
        // (e.g. filterType: "lowpass") require the native-side varToFloat
        // conversion, so they fall back to graphOps.
        const fallbackOps: GraphOp[] = [];

        for (const op of ops) {
          if (op.op !== "updateParams") {
            // Shouldn't happen when paramOnly is true, but handle
            // gracefully rather than silently dropping the op.
            fallbackOps.push(op);
            continue;
          }

          const canFastPath = Object.values(op.params).every(
            (value) => typeof value === "number" || typeof value === "boolean",
          );

          if (!canFastPath) {
            fallbackOps.push(op);
            continue;
          }

          for (const [paramName, value] of Object.entries(op.params)) {
            if (typeof value === "number") {
              bridge.sendParamUpdate(op.nodeId, paramName, value);
            } else if (typeof value === "boolean") {
              bridge.sendParamUpdate(op.nodeId, paramName, value ? 1 : 0);
            }
          }
        }

        if (fallbackOps.length > 0) {
          bridge.sendGraphOps(fallbackOps);
        }
      } else {
        bridge.sendGraphOps(ops);
      }
    }

    prevSnapshotRef.current = nextSnapshot;

    // Eagerly clear for the next render cycle. The render body also calls
    // clear() (for StrictMode safety), so this is technically redundant,
    // but it keeps the graph empty between effect and next render to avoid
    // stale reads and resets the call index counter immediately.
    graphRef.current.clear();
  });

  return (
    <AudioGraphContext.Provider value={graphContext}>
      <ParameterRegistryContext.Provider value={paramRegistryContext}>
        <TransportContext.Provider value={transport}>
          <MidiContext.Provider value={midiEvents}>
            <HostInfoContext.Provider value={hostInfo}>
              {children}
            </HostInfoContext.Provider>
          </MidiContext.Provider>
        </TransportContext.Provider>
      </ParameterRegistryContext.Provider>
    </AudioGraphContext.Provider>
  );
}
