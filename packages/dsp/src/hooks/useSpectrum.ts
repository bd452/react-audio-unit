import { useState, useEffect } from "react";
import type { Signal } from "@react-audio-unit/core";
import { bridge } from "@react-audio-unit/core";
import { useAudioNode } from "../useAudioNode.js";

export interface SpectrumData {
  magnitudes: number[]; // dB values, length = fftSize / 2
}

/**
 * useSpectrum — FFT spectrum analysis.
 *
 * Computes the frequency spectrum of the input signal and sends
 * magnitude data back to JS for visualization. Audio passes through.
 */
export function useSpectrum(
  input: Signal,
  fftSize = 2048,
  refreshRate = 30,
): SpectrumData {
  const signal = useAudioNode("spectrum", { fftSize, refreshRate }, [input]);

  const nodeId = signal.nodeId;
  const [data, setData] = useState<SpectrumData>({ magnitudes: [] });

  useEffect(() => {
    return bridge.onMessage((msg) => {
      if (msg.type === "spectrumData" && msg.nodeId === nodeId) {
        setData({ magnitudes: msg.magnitudes });
      }
    });
  }, [nodeId]);

  return data;
}
