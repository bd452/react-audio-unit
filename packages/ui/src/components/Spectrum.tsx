import React, { useRef, useEffect, useCallback } from "react";

export interface SpectrumProps {
  /** Frequency magnitudes (0–1, linear), from low to high frequency */
  magnitudes: number[];
  /** Width in CSS pixels */
  width?: number;
  /** Height in CSS pixels */
  height?: number;
  /** Number of bars to display (magnitudes are binned) */
  bars?: number;
  /** Bar gap in pixels */
  barGap?: number;
  /** Use logarithmic frequency scale */
  logScale?: boolean;
}

/**
 * Spectrum — canvas-based frequency spectrum display.
 *
 * Renders a bar graph of frequency magnitudes, typically from
 * the useSpectrum hook.
 */
export const Spectrum: React.FC<SpectrumProps> = ({
  magnitudes,
  width = 400,
  height = 150,
  bars = 64,
  barGap = 1,
  logScale = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevMagsRef = useRef<number[]>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    if (magnitudes.length === 0) return;

    const numBins = Math.min(bars, magnitudes.length);
    const barWidth = (width - (numBins - 1) * barGap) / numBins;

    // Smooth transitions
    if (prevMagsRef.current.length !== numBins) {
      prevMagsRef.current = new Array(numBins).fill(0);
    }

    for (let i = 0; i < numBins; i++) {
      // Bin the magnitudes
      let magIdx: number;
      if (logScale && magnitudes.length > numBins) {
        // Logarithmic mapping: more resolution at low frequencies
        const logMin = Math.log(1);
        const logMax = Math.log(magnitudes.length);
        const logPos = logMin + (i / numBins) * (logMax - logMin);
        magIdx = Math.floor(Math.exp(logPos));
      } else {
        magIdx = Math.floor((i / numBins) * magnitudes.length);
      }
      magIdx = Math.min(magIdx, magnitudes.length - 1);

      const rawMag = magnitudes[magIdx] ?? 0;
      // Smooth with previous frame
      const smoothed = prevMagsRef.current[i] * 0.7 + rawMag * 0.3;
      prevMagsRef.current[i] = smoothed;

      const barH = Math.max(1, smoothed * height);
      const x = i * (barWidth + barGap);
      const y = height - barH;

      // Gradient color based on frequency position
      const hue = 200 + (i / numBins) * 80; // blue to purple
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, Math.min(2, barWidth / 2));
      ctx.fill();
    }
  }, [magnitudes, width, height, bars, barGap, logScale]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: "block",
        borderRadius: "var(--rau-radius, 6px)",
        overflow: "hidden",
      }}
      role="img"
      aria-label="Spectrum display"
    />
  );
};
