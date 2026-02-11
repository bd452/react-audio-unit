import { describe, it, expect } from "vitest";
import { diffGraphs, diffGraphsFull } from "../graph-differ.js";
import { VirtualAudioGraph } from "../virtual-graph.js";
import type { AudioNodeDescriptor } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  type: string,
  params: Record<string, number | string | boolean> = {},
  inputs: AudioNodeDescriptor["inputs"] = [],
): AudioNodeDescriptor {
  return { id, type, params, inputs };
}

function buildSnapshot(
  nodes: AudioNodeDescriptor[],
  outputNodeId: string | null = null,
) {
  const graph = new VirtualAudioGraph();
  for (const n of nodes) graph.registerNode(n);
  if (outputNodeId) graph.setOutputNode(outputNodeId);
  return graph.snapshot();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("diffGraphs", () => {
  // ---------- null → graph (initial render) --------------------------------

  it("should add all nodes when prev is null", () => {
    const next = buildSnapshot([
      makeNode("gain_0", "gain", { gain: 0.5 }),
      makeNode("input_0", "input"),
    ]);

    const ops = diffGraphs(null, next);

    const addOps = ops.filter((o) => o.op === "addNode");
    expect(addOps).toHaveLength(2);
    expect(addOps.map((o) => (o as any).nodeId).sort()).toEqual([
      "gain_0",
      "input_0",
    ]);
  });

  it("should emit setOutput when prev is null and output is set", () => {
    const next = buildSnapshot(
      [makeNode("out", "gain", { gain: 1 })],
      "out",
    );

    const ops = diffGraphs(null, next);
    const setOutput = ops.find((o) => o.op === "setOutput");
    expect(setOutput).toBeDefined();
    expect((setOutput as any).nodeId).toBe("out");
  });

  // ---------- identical graphs → no ops ------------------------------------

  it("should produce no ops for identical graphs", () => {
    const snap = buildSnapshot([
      makeNode("a", "gain", { gain: 0.5 }),
      makeNode("b", "delay", { time: 100 }),
    ]);

    // Same content, different snapshots
    const snap2 = buildSnapshot([
      makeNode("a", "gain", { gain: 0.5 }),
      makeNode("b", "delay", { time: 100 }),
    ]);

    const ops = diffGraphs(snap, snap2);
    expect(ops).toHaveLength(0);
  });

  // ---------- param only changes -------------------------------------------

  it("should emit updateParams when only params change", () => {
    const prev = buildSnapshot([makeNode("g", "gain", { gain: 0.5 })]);
    const next = buildSnapshot([makeNode("g", "gain", { gain: 0.8 })]);

    const ops = diffGraphs(prev, next);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("updateParams");
    expect((ops[0] as any).params).toEqual({ gain: 0.8 });
  });

  it("should report paramOnly=true for parameter-only changes", () => {
    const prev = buildSnapshot([makeNode("g", "gain", { gain: 0.5 })]);
    const next = buildSnapshot([makeNode("g", "gain", { gain: 0.8 })]);

    const result = diffGraphsFull(prev, next);
    expect(result.paramOnly).toBe(true);
    expect(result.ops).toHaveLength(1);
  });

  it("should report paramOnly=false when topology changes", () => {
    const prev = buildSnapshot([makeNode("g", "gain", { gain: 0.5 })]);
    const next = buildSnapshot([
      makeNode("g", "gain", { gain: 0.5 }),
      makeNode("d", "delay", { time: 100 }),
    ]);

    const result = diffGraphsFull(prev, next);
    expect(result.paramOnly).toBe(false);
  });

  // ---------- node added ---------------------------------------------------

  it("should emit addNode for a new node", () => {
    const prev = buildSnapshot([makeNode("a", "gain", { gain: 1 })]);
    const next = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 200 }),
    ]);

    const ops = diffGraphs(prev, next);
    const addOps = ops.filter((o) => o.op === "addNode");
    expect(addOps).toHaveLength(1);
    expect((addOps[0] as any).nodeId).toBe("b");
    expect((addOps[0] as any).nodeType).toBe("delay");
    expect((addOps[0] as any).params).toEqual({ time: 200 });
  });

  // ---------- node removed -------------------------------------------------

  it("should emit removeNode for a removed node", () => {
    const prev = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 200 }),
    ]);
    const next = buildSnapshot([makeNode("a", "gain", { gain: 1 })]);

    const ops = diffGraphs(prev, next);
    const removeOps = ops.filter((o) => o.op === "removeNode");
    expect(removeOps).toHaveLength(1);
    expect((removeOps[0] as any).nodeId).toBe("b");
  });

  it("should disconnect inputs before removing a node", () => {
    const prev = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 100 }, [
        { fromNodeId: "a", fromOutlet: 0, toInlet: 0 },
      ]),
    ]);
    const next = buildSnapshot([makeNode("a", "gain", { gain: 1 })]);

    const ops = diffGraphs(prev, next);
    const disconnects = ops.filter((o) => o.op === "disconnect");
    expect(disconnects).toHaveLength(1);
    expect((disconnects[0] as any).from.nodeId).toBe("a");
    expect((disconnects[0] as any).to.nodeId).toBe("b");

    // Disconnect should come before remove
    const disconnectIdx = ops.indexOf(disconnects[0]);
    const removeIdx = ops.findIndex((o) => o.op === "removeNode");
    expect(disconnectIdx).toBeLessThan(removeIdx);
  });

  // ---------- connections changed ------------------------------------------

  it("should emit connect for new connections", () => {
    const prev = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 100 }),
    ]);
    const next = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 100 }, [
        { fromNodeId: "a", fromOutlet: 0, toInlet: 0 },
      ]),
    ]);

    const ops = diffGraphs(prev, next);
    const connects = ops.filter((o) => o.op === "connect");
    expect(connects).toHaveLength(1);
    expect((connects[0] as any).from.nodeId).toBe("a");
    expect((connects[0] as any).to.nodeId).toBe("b");
  });

  it("should emit disconnect for removed connections", () => {
    const prev = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 100 }, [
        { fromNodeId: "a", fromOutlet: 0, toInlet: 0 },
      ]),
    ]);
    const next = buildSnapshot([
      makeNode("a", "gain", { gain: 1 }),
      makeNode("b", "delay", { time: 100 }),
    ]);

    const ops = diffGraphs(prev, next);
    const disconnects = ops.filter((o) => o.op === "disconnect");
    expect(disconnects).toHaveLength(1);
    expect((disconnects[0] as any).from.nodeId).toBe("a");
    expect((disconnects[0] as any).to.nodeId).toBe("b");
  });

  // ---------- output node change -------------------------------------------

  it("should emit setOutput when output node changes", () => {
    const prev = buildSnapshot(
      [makeNode("a", "gain"), makeNode("b", "delay")],
      "a",
    );
    const next = buildSnapshot(
      [makeNode("a", "gain"), makeNode("b", "delay")],
      "b",
    );

    const ops = diffGraphs(prev, next);
    const setOps = ops.filter((o) => o.op === "setOutput");
    expect(setOps).toHaveLength(1);
    expect((setOps[0] as any).nodeId).toBe("b");
  });

  // ---------- complex scenario: simultaneous add + remove + update ----------

  it("should handle simultaneous add, remove, and update", () => {
    const prev = buildSnapshot([
      makeNode("keep", "gain", { gain: 0.5 }),
      makeNode("remove", "delay", { time: 100 }),
    ]);
    const next = buildSnapshot([
      makeNode("keep", "gain", { gain: 0.9 }),
      makeNode("add", "filter", { cutoff: 1000 }),
    ]);

    const ops = diffGraphs(prev, next);

    // Should have: remove "remove", add "add", update "keep"
    expect(ops.filter((o) => o.op === "removeNode")).toHaveLength(1);
    expect(ops.filter((o) => o.op === "addNode")).toHaveLength(1);
    expect(ops.filter((o) => o.op === "updateParams")).toHaveLength(1);

    const updateOp = ops.find((o) => o.op === "updateParams") as any;
    expect(updateOp.params).toEqual({ gain: 0.9 });
  });

  // ---------- VirtualAudioGraph integration ---------------------------------

  it("should produce correct ops across full render cycles", () => {
    const graph = new VirtualAudioGraph();

    // Render 1
    graph.registerNode(makeNode("input_0", "input"));
    graph.registerNode(
      makeNode("gain_0", "gain", { gain: 0.8 }, [
        { fromNodeId: "input_0", fromOutlet: 0, toInlet: 0 },
      ]),
    );
    graph.setOutputNode("gain_0");
    const snap1 = graph.snapshot();
    graph.clear();

    // First diff (null → snap1)
    const ops1 = diffGraphs(null, snap1);
    expect(ops1.filter((o) => o.op === "addNode")).toHaveLength(2);
    expect(ops1.filter((o) => o.op === "connect")).toHaveLength(1);
    expect(ops1.filter((o) => o.op === "setOutput")).toHaveLength(1);

    // Render 2 — same graph, different gain
    graph.registerNode(makeNode("input_0", "input"));
    graph.registerNode(
      makeNode("gain_0", "gain", { gain: 0.4 }, [
        { fromNodeId: "input_0", fromOutlet: 0, toInlet: 0 },
      ]),
    );
    graph.setOutputNode("gain_0");
    const snap2 = graph.snapshot();
    graph.clear();

    // Second diff (snap1 → snap2)
    const result2 = diffGraphsFull(snap1, snap2);
    expect(result2.paramOnly).toBe(true);
    expect(result2.ops).toHaveLength(1);
    expect(result2.ops[0].op).toBe("updateParams");
    expect((result2.ops[0] as any).params.gain).toBe(0.4);
  });

  // ---------- callIndex / nextCallIndex ------------------------------------

  it("should reset callIndex on clear", () => {
    const graph = new VirtualAudioGraph();
    expect(graph.nextCallIndex()).toBe(0);
    expect(graph.nextCallIndex()).toBe(1);
    graph.clear();
    expect(graph.nextCallIndex()).toBe(0);
  });

  // ---------- snapshot immutability ----------------------------------------

  it("snapshot should be independent of subsequent mutations", () => {
    const graph = new VirtualAudioGraph();
    graph.registerNode(makeNode("a", "gain", { gain: 0.5 }));
    const snap = graph.snapshot();

    graph.registerNode(makeNode("a", "gain", { gain: 0.99 }));
    graph.registerNode(makeNode("b", "delay", { time: 200 }));

    // Snapshot should be unchanged
    expect(snap.nodes.size).toBe(1);
    expect(snap.nodes.get("a")!.params.gain).toBe(0.5);
  });
});
