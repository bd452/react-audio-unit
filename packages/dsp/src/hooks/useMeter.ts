import { useState, useEffect } from "react";
import type { Signal } from "@react-audio-unit/core";
import { bridge } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";
import { PARAM_METER_TYPE, PARAM_REFRESH_RATE } from "../param-keys.js";

export type MeterType = "peak" | "rms" | "both";

export interface MeterData {
  rms: number[]; // per-channel RMS levels in dB
  peak: number[]; // per-channel peak levels in dB
}

export interface MeterOptions {
  type?: MeterType;
  refreshRate?: number;
}

/**
 * useMeter — level metering that sends analysis data back to JS.
 *
 * The native node computes RMS/peak values and sends them to JS
 * at the specified refresh rate. The audio signal passes through
 * unmodified.
 *
 * Can be called as:
 *   useMeter(input)
 *   useMeter(input, type)
 *   useMeter(input, { type, refreshRate })
 */
export function useMeter(
  input: Signal,
  typeOrOptions?: MeterType | MeterOptions,
  refreshRate = 30,
): MeterData {
  let type: MeterType = "both";
  let rate = refreshRate;

  if (typeof typeOrOptions === "string") {
    type = typeOrOptions;
  } else if (typeOrOptions && typeof typeOrOptions === "object") {
    type = typeOrOptions.type ?? "both";
    rate = typeOrOptions.refreshRate ?? refreshRate;
  }

  const signal = useAudioNode("meter", { [PARAM_METER_TYPE]: type, [PARAM_REFRESH_RATE]: rate }, [
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
