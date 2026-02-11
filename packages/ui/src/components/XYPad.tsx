import React, { useCallback, useRef } from 'react';

export interface XYPadProps {
  x: number;
  y: number;
  onChangeX: (v: number) => void;
  onChangeY: (v: number) => void;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  size?: number;
  label?: string;
}

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

export const XYPad: React.FC<XYPadProps> = ({
  x,
  y,
  onChangeX,
  onChangeY,
  minX = 0,
  maxX = 1,
  minY = 0,
  maxY = 1,
  size = 160,
  label,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const normX = (x - minX) / (maxX - minX);
  const normY = (y - minY) / (maxY - minY);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = clamp((clientX - rect.left) / rect.width, 0, 1);
      // Invert Y so bottom = minY, top = maxY
      const ny = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
      onChangeX(nx * (maxX - minX) + minX);
      onChangeY(ny * (maxY - minY) + minY);
    },
    [minX, maxX, minY, maxY, onChangeX, onChangeY],
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

  const CROSSHAIR_SIZE = 10;
  const THUMB_SIZE = 10;

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    fontFamily: 'var(--rau-font-family, sans-serif)',
    fontSize: 'var(--rau-font-size, 11px)',
    color: 'var(--rau-text, #e0e0e0)',
    userSelect: 'none',
    touchAction: 'none',
  };

  const padStyle: React.CSSProperties = {
    position: 'relative',
    width: size,
    height: size,
    background: 'var(--rau-surface, #252540)',
    border: '1px solid var(--rau-border, #3a3a5c)',
    borderRadius: 'var(--rau-radius, 6px)',
    cursor: 'crosshair',
    overflow: 'hidden',
  };

  // Crosshair lines
  const pxX = normX * size;
  // Invert for display: normY 1 = top of pad
  const pxY = (1 - normY) * size;

  const hLineStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: pxY,
    height: 1,
    background: 'var(--rau-border, #3a3a5c)',
    pointerEvents: 'none',
  };

  const vLineStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: pxX,
    width: 1,
    background: 'var(--rau-border, #3a3a5c)',
    pointerEvents: 'none',
  };

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX - THUMB_SIZE / 2,
    top: pxY - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: '50%',
    background: 'var(--rau-accent, #6c63ff)',
    border: '2px solid var(--rau-knob-thumb, #ffffff)',
    pointerEvents: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--rau-text-dim, #8888aa)',
    fontSize: 'calc(var(--rau-font-size, 11px) * 0.9)',
    lineHeight: 1.2,
  };

  return (
    <div style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <div
        ref={padRef}
        style={padStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        role="group"
        aria-label={label ?? 'XY Pad'}
        tabIndex={0}
      >
        <div style={hLineStyle} />
        <div style={vLineStyle} />
        <div style={thumbStyle} />
      </div>
    </div>
  );
};
