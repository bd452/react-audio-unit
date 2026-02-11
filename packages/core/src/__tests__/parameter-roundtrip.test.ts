import { describe, it, expect, vi, beforeEach } from "vitest";
import { NativeBridge } from "../bridge.js";
import type { BridgeInMessage, BridgeOutMessage } from "../types.js";

/**
 * Tests that simulate the parameter save/recall round-trip:
 *
 * Save flow:
 *   1. Native sends { type: "requestState" }
 *   2. JS collects all parameter values
 *   3. JS sends { type: "setState", state: JSON.stringify(params) }
 *
 * Recall flow:
 *   1. Native sends { type: "restoreState", state: "..." }
 *   2. JS parses the state and restores each parameter
 */
describe("Parameter save/recall round-trip", () => {
  let bridge: NativeBridge;
  let sentMessages: BridgeOutMessage[];

  beforeEach(() => {
    bridge = new NativeBridge();
    sentMessages = [];
    bridge.send = vi.fn((msg: BridgeOutMessage) => sentMessages.push(msg));
  });

  it("should handle requestState → setState round-trip", () => {
    // Simulate a parameter registry
    const params: Record<string, number> = {
      gain: 0.75,
      delay: 200,
      feedback: 0.4,
      mix: 0.6,
    };

    // Register handler that responds to requestState
    bridge.onMessage((msg: BridgeInMessage) => {
      if (msg.type === "requestState") {
        bridge.send({
          type: "setState",
          state: JSON.stringify(params),
        });
      }
    });

    // Simulate native requesting state
    bridge.dispatch({ type: "requestState" });

    // Verify setState was sent back
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].type).toBe("setState");

    const stateJson = (sentMessages[0] as any).state;
    const restored = JSON.parse(stateJson);

    // Verify all parameters round-tripped correctly
    expect(restored.gain).toBe(0.75);
    expect(restored.delay).toBe(200);
    expect(restored.feedback).toBe(0.4);
    expect(restored.mix).toBe(0.6);
  });

  it("should handle restoreState → parameter updates", () => {
    const restoredParams: Record<string, number> = {};

    // Register handler that processes restoreState
    bridge.onMessage((msg: BridgeInMessage) => {
      if (msg.type === "restoreState") {
        const state = JSON.parse(msg.state) as Record<string, number>;
        for (const [id, value] of Object.entries(state)) {
          restoredParams[id] = value;
        }
      }
    });

    // Simulate native sending restoreState
    const savedState = { gain: 0.5, delay: 300, feedback: 0.8, mix: 0.3 };
    bridge.dispatch({
      type: "restoreState",
      state: JSON.stringify(savedState),
    });

    // Verify all parameters were restored
    expect(restoredParams).toEqual(savedState);
  });

  it("should handle empty state gracefully", () => {
    const restoredParams: Record<string, number> = {};

    bridge.onMessage((msg: BridgeInMessage) => {
      if (msg.type === "restoreState") {
        try {
          const state = JSON.parse(msg.state) as Record<string, number>;
          Object.assign(restoredParams, state);
        } catch {
          // Should handle gracefully
        }
      }
    });

    bridge.dispatch({ type: "restoreState", state: "{}" });
    expect(restoredParams).toEqual({});
  });

  it("should handle malformed state gracefully", () => {
    let error: unknown = null;

    bridge.onMessage((msg: BridgeInMessage) => {
      if (msg.type === "restoreState") {
        try {
          JSON.parse(msg.state);
        } catch (e) {
          error = e;
        }
      }
    });

    bridge.dispatch({ type: "restoreState", state: "not valid json{{{" });
    expect(error).not.toBeNull(); // Should catch the parse error
  });

  it("should preserve parameter types through round-trip", () => {
    // Parameters should survive JSON serialization
    const original = {
      gain: 0.123456789,
      frequency: 440.0,
      enabled: 1, // booleans stored as 0/1
      type: 2, // enums stored as numbers
    };

    const serialized = JSON.stringify(original);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.gain).toBeCloseTo(0.123456789, 8);
    expect(deserialized.frequency).toBe(440.0);
    expect(deserialized.enabled).toBe(1);
    expect(deserialized.type).toBe(2);
  });

  it("should handle many parameters without data loss", () => {
    // Simulate a plugin with lots of parameters
    const params: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      params[`param_${i}`] = Math.random();
    }

    const serialized = JSON.stringify(params);
    const deserialized = JSON.parse(serialized) as Record<string, number>;

    for (const [key, value] of Object.entries(params)) {
      expect(deserialized[key]).toBeCloseTo(value, 10);
    }
  });

  it("should handle full save → close → restore cycle", () => {
    // Simulate the full lifecycle
    let savedState = "";
    const liveParams: Record<string, number> = {
      gain: 0.8,
      pan: -0.3,
      reverb: 0.5,
    };

    // Step 1: Save
    bridge.onMessage((msg: BridgeInMessage) => {
      if (msg.type === "requestState") {
        bridge.send({
          type: "setState",
          state: JSON.stringify(liveParams),
        });
      }
    });

    bridge.dispatch({ type: "requestState" });
    savedState = (sentMessages[0] as any).state;

    // Step 2: Simulate "close" — create fresh state
    const freshParams: Record<string, number> = { gain: 0, pan: 0, reverb: 0 };

    // Step 3: Restore
    const restoreHandler = vi.fn((msg: BridgeInMessage) => {
      if (msg.type === "restoreState") {
        const state = JSON.parse(msg.state) as Record<string, number>;
        Object.assign(freshParams, state);
      }
    });

    // New bridge for the "reopened" plugin
    const bridge2 = new NativeBridge();
    bridge2.onMessage(restoreHandler);
    bridge2.dispatch({ type: "restoreState", state: savedState });

    // Verify state was fully restored
    expect(freshParams.gain).toBe(0.8);
    expect(freshParams.pan).toBe(-0.3);
    expect(freshParams.reverb).toBe(0.5);
  });
});
