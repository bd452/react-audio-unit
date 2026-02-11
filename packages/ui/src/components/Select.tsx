import React, { useCallback } from 'react';

export interface SelectProps {
  options: string[];
  value: number;
  onChange: (index: number) => void;
  label?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  label,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange],
  );

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 4,
    fontFamily: 'var(--rau-font-family, sans-serif)',
    fontSize: 'var(--rau-font-size, 11px)',
    color: 'var(--rau-text, #e0e0e0)',
  };

  const labelStyle: React.CSSProperties = {
    color: 'var(--rau-text-dim, #8888aa)',
    fontSize: 'calc(var(--rau-font-size, 11px) * 0.9)',
    lineHeight: 1.2,
  };

  const selectStyle: React.CSSProperties = {
    appearance: 'none',
    background: 'var(--rau-surface, #252540)',
    color: 'var(--rau-text, #e0e0e0)',
    border: '1px solid var(--rau-border, #3a3a5c)',
    borderRadius: 'var(--rau-radius, 6px)',
    padding: '4px 24px 4px 8px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    outline: 'none',
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'%238888aa\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    minWidth: 80,
  };

  return (
    <div style={containerStyle}>
      {label && <span style={labelStyle}>{label}</span>}
      <select
        style={selectStyle}
        value={value}
        onChange={handleChange}
        aria-label={label ?? 'Select'}
      >
        {options.map((opt, i) => (
          <option key={i} value={i}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
};
