import React, { useState, useCallback } from "react";

export interface Preset {
  name: string;
  data: Record<string, number>;
}

export interface PresetBrowserProps {
  /** Available presets */
  presets: Preset[];
  /** Currently selected preset index */
  selectedIndex?: number;
  /** Called when user selects a preset */
  onSelect: (preset: Preset, index: number) => void;
  /** Called when user wants to save current state as a preset */
  onSave?: (name: string) => void;
  /** Called when user wants to delete a preset */
  onDelete?: (index: number) => void;
}

/**
 * PresetBrowser — save, load, and browse plugin presets.
 *
 * Shows a list of presets with prev/next navigation and a
 * save dialog.
 */
export const PresetBrowser: React.FC<PresetBrowserProps> = ({
  presets,
  selectedIndex = -1,
  onSelect,
  onSave,
  onDelete,
}) => {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const handlePrev = useCallback(() => {
    if (presets.length === 0) return;
    const newIdx = selectedIndex <= 0 ? presets.length - 1 : selectedIndex - 1;
    onSelect(presets[newIdx], newIdx);
  }, [presets, selectedIndex, onSelect]);

  const handleNext = useCallback(() => {
    if (presets.length === 0) return;
    const newIdx = selectedIndex >= presets.length - 1 ? 0 : selectedIndex + 1;
    onSelect(presets[newIdx], newIdx);
  }, [presets, selectedIndex, onSelect]);

  const handleSave = useCallback(() => {
    if (newPresetName.trim() && onSave) {
      onSave(newPresetName.trim());
      setNewPresetName("");
      setShowSaveDialog(false);
    }
  }, [newPresetName, onSave]);

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontFamily: "var(--rau-font-family, sans-serif)",
    fontSize: "var(--rau-font-size, 11px)",
    color: "var(--rau-text, #e0e0e0)",
  };

  const navStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const btnStyle: React.CSSProperties = {
    background: "var(--rau-surface, #252540)",
    border: "1px solid var(--rau-border, #3a3a5c)",
    borderRadius: "var(--rau-radius, 6px)",
    color: "var(--rau-text, #e0e0e0)",
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "inherit",
    fontFamily: "inherit",
  };

  const presetNameStyle: React.CSSProperties = {
    flex: 1,
    textAlign: "center",
    fontWeight: 600,
    padding: "4px 8px",
    background: "var(--rau-surface, #252540)",
    border: "1px solid var(--rau-border, #3a3a5c)",
    borderRadius: "var(--rau-radius, 6px)",
    minWidth: 120,
  };

  const inputStyle: React.CSSProperties = {
    ...btnStyle,
    flex: 1,
    outline: "none",
    padding: "4px 8px",
  };

  const currentName =
    selectedIndex >= 0 && selectedIndex < presets.length
      ? presets[selectedIndex].name
      : "Init";

  return (
    <div style={containerStyle}>
      <div style={navStyle}>
        <button
          style={btnStyle}
          onClick={handlePrev}
          aria-label="Previous preset"
        >
          &larr;
        </button>
        <span style={presetNameStyle}>{currentName}</span>
        <button style={btnStyle} onClick={handleNext} aria-label="Next preset">
          &rarr;
        </button>
        {onSave && (
          <button
            style={btnStyle}
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            aria-label="Save preset"
          >
            Save
          </button>
        )}
      </div>

      {showSaveDialog && (
        <div style={navStyle}>
          <input
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Preset name..."
            style={inputStyle}
            autoFocus
          />
          <button style={btnStyle} onClick={handleSave}>
            OK
          </button>
          <button style={btnStyle} onClick={() => setShowSaveDialog(false)}>
            Cancel
          </button>
        </div>
      )}

      {presets.length > 0 && (
        <div
          style={{
            maxHeight: 150,
            overflowY: "auto",
            border: "1px solid var(--rau-border, #3a3a5c)",
            borderRadius: "var(--rau-radius, 6px)",
          }}
        >
          {presets.map((preset, idx) => (
            <div
              key={`${preset.name}-${idx}`}
              onClick={() => onSelect(preset, idx)}
              style={{
                padding: "4px 10px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background:
                  idx === selectedIndex
                    ? "var(--rau-accent, #6c63ff)"
                    : idx % 2 === 0
                      ? "transparent"
                      : "rgba(255,255,255,0.02)",
              }}
              role="option"
              aria-selected={idx === selectedIndex}
            >
              <span>{preset.name}</span>
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(idx);
                  }}
                  style={{
                    ...btnStyle,
                    padding: "2px 6px",
                    fontSize: "9px",
                    opacity: 0.6,
                  }}
                  aria-label={`Delete ${preset.name}`}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
