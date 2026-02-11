import React, { useRef, useEffect, useCallback } from "react";

export interface WaveformProps {
  /** Audio samples to display (time-domain, -1..1) */
  data: number[];
  /** Width in CSS pixels */
  width?: number;
  /** Height in CSS pixels */
  height?: number;
  /** Stroke color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Line width in pixels */
  lineWidth?: number;
  /** Fill under the waveform */
  fill?: boolean;
}

/**
 * Waveform — canvas-based time-domain waveform display.
 *
 * Pass an array of audio samples (typically from a meter or
 * custom buffer capture) and it draws a smooth waveform.
 */
export const Waveform: React.FC<WaveformProps> = ({
  data,
  width = 300,
  height = 100,
  color = "var(--rau-accent, #6c63ff)",
  backgroundColor = "var(--rau-bg-secondary, #1a1a2e)",
  lineWidth = 2,
  fill = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    if (data.length === 0) return;

    const midY = height / 2;
    const step = data.length / width;

    ctx.beginPath();
    ctx.moveTo(0, midY);

    for (let x = 0; x < width; x++) {
      const idx = Math.floor(x * step);
      const sample = data[idx] ?? 0;
      const y = midY - sample * midY;
      ctx.lineTo(x, y);
    }

    if (fill) {
      ctx.lineTo(width, midY);
      ctx.lineTo(0, midY);
      ctx.closePath();
      ctx.fillStyle = "#6c63ff33";
      ctx.fill();
    }

    // Re-draw the line on top if filling
    if (fill) {
      ctx.beginPath();
      ctx.moveTo(0, midY);
      for (let x = 0; x < width; x++) {
        const idx = Math.floor(x * step);
        const sample = data[idx] ?? 0;
        const y = midY - sample * midY;
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = "#6c63ff";
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Center line
    ctx.strokeStyle = "#3a3a5c";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();
  }, [data, width, height, lineWidth, fill]);

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
      aria-label="Waveform display"
    />
  );
};
