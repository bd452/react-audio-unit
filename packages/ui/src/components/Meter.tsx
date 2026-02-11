import React, { useRef, useEffect, useCallback } from 'react';

export interface MeterLevels {
  rms: number[];
  peak: number[];
}

export interface MeterProps {
  levels: MeterLevels;
  orientation?: 'vertical' | 'horizontal';
  width?: number;
  height?: number;
}

/** Map a dB value (-100..0) to a 0..1 range */
function dbToNorm(db: number): number {
  const clamped = Math.max(-100, Math.min(0, db));
  return (clamped + 100) / 100;
}

const PEAK_HOLD_MS = 1200;
const PEAK_DECAY_RATE = 0.0005; // per ms

interface PeakState {
  level: number;
  timestamp: number;
}

export const Meter: React.FC<MeterProps> = ({
  levels,
  orientation = 'vertical',
  width,
  height,
}) => {
  const isVertical = orientation === 'vertical';
  const channelCount = levels.rms.length;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakHoldRef = useRef<PeakState[]>([]);
  const rafRef = useRef<number>(0);

  const cw = width ?? (isVertical ? Math.max(20, channelCount * 16 + (channelCount - 1) * 4 + 8) : 120);
  const ch = height ?? (isVertical ? 120 : Math.max(20, channelCount * 16 + (channelCount - 1) * 4 + 8));

  const getColor = useCallback(
    (norm: number, ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      const grad = isVertical
        ? ctx.createLinearGradient(x, y + h, x, y)
        : ctx.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, 'var(--rau-meter-low, #4ade80)');
      grad.addColorStop(0.6, 'var(--rau-meter-mid, #facc15)');
      grad.addColorStop(1, 'var(--rau-meter-high, #ef4444)');
      return grad;
    },
    [isVertical],
  );

  // Fallback colors since canvas can't read CSS vars directly
  const lowColor = '#4ade80';
  const midColor = '#facc15';
  const highColor = '#ef4444';
  const trackColor = '#2a2a44';

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = cw;
    const displayH = ch;

    if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
      canvas.width = displayW * dpr;
      canvas.height = displayH * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, displayW, displayH);

    const now = performance.now();

    // Ensure peakHold array matches channel count
    while (peakHoldRef.current.length < channelCount) {
      peakHoldRef.current.push({ level: 0, timestamp: 0 });
    }

    const padding = 4;
    const gap = 4;

    for (let ch = 0; ch < channelCount; ch++) {
      const rmsNorm = dbToNorm(levels.rms[ch] ?? -100);
      const peakNorm = dbToNorm(levels.peak[ch] ?? -100);

      // Update peak hold
      const prev = peakHoldRef.current[ch];
      if (peakNorm >= prev.level) {
        peakHoldRef.current[ch] = { level: peakNorm, timestamp: now };
      } else {
        const elapsed = now - prev.timestamp;
        if (elapsed > PEAK_HOLD_MS) {
          const decay = (elapsed - PEAK_HOLD_MS) * PEAK_DECAY_RATE;
          peakHoldRef.current[ch] = {
            level: Math.max(peakNorm, prev.level - decay),
            timestamp: prev.timestamp,
          };
        }
      }
      const holdNorm = peakHoldRef.current[ch].level;

      if (isVertical) {
        const barW = (displayW - padding * 2 - (channelCount - 1) * gap) / channelCount;
        const barH = displayH - padding * 2;
        const x = padding + ch * (barW + gap);
        const y = padding;

        // Track
        ctx.fillStyle = trackColor;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();

        // RMS fill
        const fillH = rmsNorm * barH;
        if (fillH > 0) {
          const grad = ctx.createLinearGradient(x, y + barH, x, y);
          grad.addColorStop(0, lowColor);
          grad.addColorStop(0.6, midColor);
          grad.addColorStop(1, highColor);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y + barH - fillH, barW, fillH, 2);
          ctx.fill();
        }

        // Peak hold line
        if (holdNorm > 0.01) {
          const holdY = y + barH - holdNorm * barH;
          const holdColor =
            holdNorm > 0.85 ? highColor : holdNorm > 0.5 ? midColor : lowColor;
          ctx.fillStyle = holdColor;
          ctx.fillRect(x, holdY, barW, 2);
        }
      } else {
        const barH = (displayH - padding * 2 - (channelCount - 1) * gap) / channelCount;
        const barW = displayW - padding * 2;
        const x = padding;
        const y = padding + ch * (barH + gap);

        // Track
        ctx.fillStyle = trackColor;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();

        // RMS fill
        const fillW = rmsNorm * barW;
        if (fillW > 0) {
          const grad = ctx.createLinearGradient(x, y, x + barW, y);
          grad.addColorStop(0, lowColor);
          grad.addColorStop(0.6, midColor);
          grad.addColorStop(1, highColor);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, fillW, barH, 2);
          ctx.fill();
        }

        // Peak hold line
        if (holdNorm > 0.01) {
          const holdX = x + holdNorm * barW;
          const holdColor =
            holdNorm > 0.85 ? highColor : holdNorm > 0.5 ? midColor : lowColor;
          ctx.fillStyle = holdColor;
          ctx.fillRect(holdX, y, 2, barH);
        }
      }
    }
  }, [levels, channelCount, cw, ch, isVertical, lowColor, midColor, highColor, trackColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Also redraw on animation frame for smooth peak decay
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  const canvasStyle: React.CSSProperties = {
    width: cw,
    height: ch,
    display: 'block',
  };

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
      role="meter"
      aria-label="Level meter"
    />
  );
};
