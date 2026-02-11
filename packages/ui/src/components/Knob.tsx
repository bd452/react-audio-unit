import React, { useCallback, useRef } from 'react';

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  size?: number;
  steps?: number;
}

const START_ANGLE = 135;
const END_ANGLE = 405;
const SWEEP = END_ANGLE - START_ANGLE; // 270°

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

function formatValue(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  if (Math.abs(val) >= 100) return val.toFixed(0);
  if (Math.abs(val) >= 10) return val.toFixed(1);
  return val.toFixed(2);
}

export const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  unit,
  size = 64,
  steps,
}) => {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const normalize = (v: number) => (v - min) / (max - min);
  const denormalize = (n: number) => n * (max - min) + min;

  const quantize = useCallback(
    (v: number) => {
      if (steps == null || steps <= 0) return v;
      const stepSize = (max - min) / steps;
      return Math.round((v - min) / stepSize) * stepSize + min;
    },
    [min, max, steps],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startValue: value };
    },
    [value],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY;
      const sensitivity = (max - min) / (size * 3);
      const raw = dragRef.current.startValue + dy * sensitivity;
      const clamped = clamp(raw, min, max);
      onChange(quantize(clamped));
    },
    [min, max, size, onChange, quantize],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    },
    [],
  );

  const handleDoubleClick = useCallback(() => {
    const center = (min + max) / 2;
    onChange(quantize(center));
  }, [min, max, onChange, quantize]);

  const norm = normalize(value);
  const valueAngle = START_ANGLE + norm * SWEEP;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const strokeW = Math.max(3, size * 0.06);
  const thumbR = Math.max(3, size * 0.055);

  const trackPath = describeArc(cx, cy, radius, START_ANGLE, END_ANGLE);
  const fillPath =
    norm > 0.001
      ? describeArc(cx, cy, radius, START_ANGLE, valueAngle)
      : '';
  const thumbPos = polarToCartesian(cx, cy, radius, valueAngle);

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    userSelect: 'none',
    touchAction: 'none',
    fontFamily: 'var(--rau-font-family, sans-serif)',
    fontSize: 'var(--rau-font-size, 11px)',
    color: 'var(--rau-text, #e0e0e0)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--rau-text-dim, #8888aa)',
    fontSize: 'calc(var(--rau-font-size, 11px) * 0.9)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: size + 16,
  };

  const valueStyle: React.CSSProperties = {
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: 'pointer', overflow: 'visible' }}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label ?? 'Knob'}
        tabIndex={0}
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="var(--rau-knob-track, #3a3a5c)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke="var(--rau-knob-fill, #6c63ff)"
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        )}
        {/* Thumb */}
        <circle
          cx={thumbPos.x}
          cy={thumbPos.y}
          r={thumbR}
          fill="var(--rau-knob-thumb, #ffffff)"
        />
      </svg>
      <span style={valueStyle}>
        {formatValue(value)}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
};
