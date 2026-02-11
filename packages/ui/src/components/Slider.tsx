import React, { useCallback, useRef } from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  orientation?: 'horizontal' | 'vertical';
  width?: number;
  height?: number;
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

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  unit,
  orientation = 'horizontal',
  width,
  height,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const isVertical = orientation === 'vertical';
  const trackWidth = width ?? (isVertical ? 32 : 120);
  const trackHeight = height ?? (isVertical ? 120 : 32);

  const TRACK_THICKNESS = 4;
  const THUMB_SIZE = 14;

  const normalize = (v: number) => (v - min) / (max - min);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let norm: number;
      if (isVertical) {
        norm = 1 - (clientY - rect.top) / rect.height;
      } else {
        norm = (clientX - rect.left) / rect.width;
      }
      const clamped = clamp(norm, 0, 1);
      onChange(clamped * (max - min) + min);
    },
    [isVertical, min, max, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      updateFromPointer(e.clientX, e.clientY);
    },
    [updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      updateFromPointer(e.clientX, e.clientY);
    },
    [updateFromPointer],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      dragging.current = false;
    },
    [],
  );

  const norm = normalize(value);

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    userSelect: 'none',
    touchAction: 'none',
    fontFamily: 'var(--rau-font-family, sans-serif)',
    fontSize: 'var(--rau-font-size, 11px)',
    color: 'var(--rau-text, #e0e0e0)',
  };

  const trackContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: trackWidth,
    height: trackHeight,
    cursor: 'pointer',
  };

  const trackStyle: React.CSSProperties = isVertical
    ? {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        width: TRACK_THICKNESS,
        height: '100%',
        borderRadius: TRACK_THICKNESS / 2,
        background: 'var(--rau-knob-track, #3a3a5c)',
      }
    : {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '100%',
        height: TRACK_THICKNESS,
        borderRadius: TRACK_THICKNESS / 2,
        background: 'var(--rau-knob-track, #3a3a5c)',
      };

  const fillStyle: React.CSSProperties = isVertical
    ? {
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 0,
        width: TRACK_THICKNESS,
        height: `${norm * 100}%`,
        borderRadius: TRACK_THICKNESS / 2,
        background: 'var(--rau-knob-fill, #6c63ff)',
      }
    : {
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        left: 0,
        width: `${norm * 100}%`,
        height: TRACK_THICKNESS,
        borderRadius: TRACK_THICKNESS / 2,
        background: 'var(--rau-knob-fill, #6c63ff)',
      };

  const thumbStyle: React.CSSProperties = isVertical
    ? {
        position: 'absolute',
        left: '50%',
        bottom: `${norm * 100}%`,
        transform: 'translate(-50%, 50%)',
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: '50%',
        background: 'var(--rau-knob-thumb, #ffffff)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }
    : {
        position: 'absolute',
        top: '50%',
        left: `${norm * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: '50%',
        background: 'var(--rau-knob-thumb, #ffffff)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      };

  const labelStyle: React.CSSProperties = {
    color: 'var(--rau-text-dim, #8888aa)',
    fontSize: 'calc(var(--rau-font-size, 11px) * 0.9)',
    lineHeight: 1.2,
  };

  const valueStyle: React.CSSProperties = {
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  };

  return (
    <div style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <div
        ref={trackRef}
        style={trackContainerStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-orientation={orientation}
        aria-label={label ?? 'Slider'}
        tabIndex={0}
      >
        <div style={trackStyle} />
        <div style={fillStyle} />
        <div style={thumbStyle} />
      </div>
      <span style={valueStyle}>
        {formatValue(value)}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
};
