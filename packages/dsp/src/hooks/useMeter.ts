import { useState, useEffect, useRef } from "react";
import type { Signal } from "@react-audio-unit/core";
import { bridge } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export type MeterType = "peak" | "rms" | "both";

export interface MeterData {
  rms: number[]; // per-channel RMS levels in dB
  peak: number[]; // per-channel peak levels in dB
}

/**
 * useMeter — level metering that sends analysis data back to JS.
 *
 * The native node computes RMS/peak values and sends them to JS
 * at the specified refresh rate. The audio signal passes through
 * unmodified.
 *
 * @param input       - Signal to analyze
 * @param type        - Meter type
 * @param refreshRate - UI updates per second (default 30)
 */
export function useMeter(
  input: Signal,
  type: MeterType = "both",
  refreshRate = 30,
): MeterData {
  const signal = useAudioNode("meter", { meterType: type, refreshRate }, [
    input,
  ]);

  const nodeId = signal.nodeId;
  const [data, setData] = useState<MeterData>({ rms: [-100], peak: [-100] });

  useEffect(() => {
    return bridge.onMessage((msg) => {
      if (msg.type === "meterData" && msg.nodeId === nodeId) {
        setData({ rms: msg.rms, peak: msg.peak });
      }
    });
  }, [nodeId]);

  return data;
}
