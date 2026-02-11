import React, { useCallback } from 'react';

export interface ToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}

const TRACK_W = 36;
const TRACK_H = 20;
const THUMB_SIZE = 16;
const THUMB_MARGIN = 2;

export const Toggle: React.FC<ToggleProps> = ({ value, onChange, label }) => {
  const handleClick = useCallback(() => {
    onChange(!value);
  }, [value, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onChange(!value);
      }
    },
    [value, onChange],
  );

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--rau-font-family, sans-serif)',
    fontSize: 'var(--rau-font-size, 11px)',
    color: 'var(--rau-text, #e0e0e0)',
  };

  const trackStyle: React.CSSProperties = {
    position: 'relative',
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    background: value
      ? 'var(--rau-accent, #6c63ff)'
      : 'var(--rau-knob-track, #3a3a5c)',
    transition: 'background 0.15s ease',
    flexShrink: 0,
  };

  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: THUMB_MARGIN,
    left: value ? TRACK_W - THUMB_SIZE - THUMB_MARGIN : THUMB_MARGIN,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: '50%',
    background: 'var(--rau-knob-thumb, #ffffff)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    transition: 'left 0.15s ease',
  };

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="switch"
      aria-checked={value}
      aria-label={label ?? 'Toggle'}
      tabIndex={0}
    >
      <div style={trackStyle}>
        <div style={thumbStyle} />
      </div>
      {label && <span>{label}</span>}
    </div>
  );
};
