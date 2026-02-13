import { describe, it, expect, vi, beforeEach } from "vitest";
import { NativeBridge } from "../bridge.js";
import type { BridgeInMessage, BridgeOutMessage, GraphOp } from "../types.js";

describe("NativeBridge", () => {
  let bridge: NativeBridge;

  beforeEach(() => {
    bridge = new NativeBridge();
  });

  // ---------- dispatch & onMessage -----------------------------------------

  it("should dispatch incoming messages to all handlers", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bridge.onMessage(handler1);
    bridge.onMessage(handler2);

    const msg: BridgeInMessage = {
      type: "parameterChanged",
      id: "gain",
      value: 0.75,
    };
    bridge.dispatch(msg);

    expect(handler1).toHaveBeenCalledWith(msg);
    expect(handler2).toHaveBeenCalledWith(msg);
  });

  it("should stop receiving after unsubscribe", () => {
    const handler = vi.fn();
    const unsub = bridge.onMessage(handler);

    bridge.dispatch({ type: "parameterChanged", id: "x", value: 0 });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    bridge.dispatch({ type: "parameterChanged", id: "y", value: 1 });
    expect(handler).toHaveBeenCalledTimes(1); // not called again
  });

  // ---------- message types ------------------------------------------------

  it("should dispatch transport messages", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    const msg: BridgeInMessage = {
      type: "transport",
      playing: true,
      bpm: 140,
      positionSamples: 44100,
      timeSigNum: 3,
      timeSigDen: 4,
    };
    bridge.dispatch(msg);

    expect(handler).toHaveBeenCalledWith(msg);
    expect(handler.mock.calls[0][0].type).toBe("transport");
    expect(handler.mock.calls[0][0].bpm).toBe(140);
  });

  it("should dispatch MIDI messages", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    const msg: BridgeInMessage = {
      type: "midi",
      events: [
        { type: "noteOn", channel: 1, note: 60, velocity: 0.8 },
        { type: "noteOff", channel: 1, note: 60, velocity: 0 },
      ],
    };
    bridge.dispatch(msg);

    expect(handler.mock.calls[0][0].events).toHaveLength(2);
    expect(handler.mock.calls[0][0].events[0].note).toBe(60);
  });

  it("should dispatch meter data", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    const msg: BridgeInMessage = {
      type: "meterData",
      nodeId: "meter_0",
      rms: [0.3, 0.25],
      peak: [0.8, 0.7],
    };
    bridge.dispatch(msg);

    expect(handler.mock.calls[0][0].rms).toEqual([0.3, 0.25]);
  });

  it("should dispatch spectrum data", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    const msg: BridgeInMessage = {
      type: "spectrumData",
      nodeId: "spectrum_0",
      magnitudes: [0.1, 0.5, 0.3, 0.2],
    };
    bridge.dispatch(msg);

    expect(handler.mock.calls[0][0].magnitudes).toHaveLength(4);
  });

  it("should dispatch sampleRate and blockSize messages", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    bridge.dispatch({ type: "sampleRate", value: 48000 });
    bridge.dispatch({ type: "blockSize", value: 256 });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler.mock.calls[0][0]).toEqual({
      type: "sampleRate",
      value: 48000,
    });
    expect(handler.mock.calls[1][0]).toEqual({
      type: "blockSize",
      value: 256,
    });
  });

  it("should dispatch audioLayout messages", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    const msg: BridgeInMessage = {
      type: "audioLayout",
      mainInput: { layout: "stereo", channels: 2 },
      mainOutput: { layout: "stereo", channels: 2 },
      sidechainInput: { layout: "mono", channels: 1 },
    };

    bridge.dispatch(msg);

    expect(handler).toHaveBeenCalledWith(msg);
    expect(handler.mock.calls[0][0].mainInput.layout).toBe("stereo");
    expect(handler.mock.calls[0][0].sidechainInput.channels).toBe(1);
  });

  it("should dispatch requestState and restoreState", () => {
    const handler = vi.fn();
    bridge.onMessage(handler);

    bridge.dispatch({ type: "requestState" });
    bridge.dispatch({
      type: "restoreState",
      state: '{"gain":0.5,"delay":100}',
    });

    expect(handler.mock.calls[0][0].type).toBe("requestState");
    expect(handler.mock.calls[1][0].state).toBe('{"gain":0.5,"delay":100}');
  });

  // ---------- sendGraphOps --------------------------------------------------

  it("should format graphOps messages correctly", () => {
    const sent: BridgeOutMessage[] = [];
    bridge.send = vi.fn((msg: BridgeOutMessage) => sent.push(msg));

    const ops: GraphOp[] = [
      { op: "addNode", nodeId: "g0", nodeType: "gain", params: { gain: 0.5 } },
      {
        op: "connect",
        from: { nodeId: "input_0", outlet: 0 },
        to: { nodeId: "g0", inlet: 0 },
      },
      { op: "setOutput", nodeId: "g0" },
    ];

    bridge.sendGraphOps(ops);

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("graphOps");
    expect((sent[0] as any).ops).toEqual(ops);
  });

  it("should not send empty graph ops", () => {
    bridge.send = vi.fn();
    bridge.sendGraphOps([]);
    expect(bridge.send).not.toHaveBeenCalled();
  });

  // ---------- sendParamUpdate -----------------------------------------------

  it("should format paramUpdate messages correctly", () => {
    const sent: BridgeOutMessage[] = [];
    bridge.send = vi.fn((msg: BridgeOutMessage) => sent.push(msg));

    bridge.sendParamUpdate("gain_0", "gain", 0.8);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      type: "paramUpdate",
      nodeId: "gain_0",
      paramName: "gain",
      value: 0.8,
    });
  });

  // ---------- registerParameter ---------------------------------------------

  it("should format registerParameter messages correctly", () => {
    const sent: BridgeOutMessage[] = [];
    bridge.send = vi.fn((msg: BridgeOutMessage) => sent.push(msg));

    bridge.registerParameter("vol", {
      default: 0.8,
      min: 0,
      max: 1,
      label: "Volume",
      curve: "logarithmic",
    });

    expect(sent).toHaveLength(1);
    const msg = sent[0] as any;
    expect(msg.type).toBe("registerParameter");
    expect(msg.id).toBe("vol");
    expect(msg.config.curve).toBe("logarithmic");
  });

  // ---------- setParameterValue ---------------------------------------------

  it("should format setParameterValue messages correctly", () => {
    const sent: BridgeOutMessage[] = [];
    bridge.send = vi.fn((msg: BridgeOutMessage) => sent.push(msg));

    bridge.setParameterValue("vol", 0.6);

    expect(sent[0]).toEqual({
      type: "setParameterValue",
      id: "vol",
      value: 0.6,
    });
  });

  // ---------- unregisterParameter -------------------------------------------

  it("should format unregisterParameter messages correctly", () => {
    const sent: BridgeOutMessage[] = [];
    bridge.send = vi.fn((msg: BridgeOutMessage) => sent.push(msg));

    bridge.unregisterParameter("vol");

    expect(sent[0]).toEqual({
      type: "unregisterParameter",
      id: "vol",
    });
  });

  // ---------- multiple handlers ordering ------------------------------------

  it("should call handlers in registration order", () => {
    const order: number[] = [];
    bridge.onMessage(() => order.push(1));
    bridge.onMessage(() => order.push(2));
    bridge.onMessage(() => order.push(3));

    bridge.dispatch({ type: "parameterChanged", id: "x", value: 0 });

    expect(order).toEqual([1, 2, 3]);
  });
});
