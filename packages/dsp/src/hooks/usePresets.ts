import { useState, useCallback, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Preset {
  name: string;
  data: Record<string, number>;
}

export interface PresetManagerOptions {
  /** Unique key used to namespace presets in localStorage. */
  pluginId: string;
  /** Capture the current parameter state of the plugin. */
  getState: () => Record<string, number>;
  /** Restore a previously captured parameter state. */
  setState: (data: Record<string, number>) => void;
  /** Optional factory presets loaded when localStorage is empty. */
  factoryPresets?: Preset[];
}

export interface PresetManager {
  /** The full list of presets (factory + user). */
  presets: Preset[];
  /** Index of the currently selected preset (-1 = none). */
  selectedIndex: number;
  /** Select a preset by index and restore its parameter state. */
  select: (index: number) => void;
  /** Save the current parameter state as a new preset. */
  save: (name: string) => void;
  /** Delete a preset by index. */
  delete: (index: number) => void;
  /** Rename a preset by index. */
  rename: (index: number, name: string) => void;
  /** Serialize a single preset to a JSON string for sharing / export. */
  exportPreset: (index: number) => string;
  /** Import a preset from a JSON string and append it to the list. */
  importPreset: (json: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageKey(pluginId: string): string {
  return `rau-presets:${pluginId}`;
}

function readStorage(pluginId: string): Preset[] | null {
  try {
    const raw = localStorage.getItem(storageKey(pluginId));
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Preset[];
  } catch {
    return null;
  }
}

function writeStorage(pluginId: string, presets: Preset[]): void {
  try {
    localStorage.setItem(storageKey(pluginId), JSON.stringify(presets));
  } catch {
    // localStorage may be unavailable or full — silently ignore.
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * usePresets — manages a persistent list of plugin presets.
 *
 * Presets are persisted to localStorage keyed by `pluginId`. On first load,
 * if no saved presets exist the optional `factoryPresets` are used as the
 * initial set. The hook exposes helpers to select, save, delete, rename,
 * export, and import presets while keeping localStorage in sync.
 *
 * @example
 * ```tsx
 * const pm = usePresets({
 *   pluginId: "my-synth",
 *   getState: () => ({ volume: vol, cutoff: fc }),
 *   setState: (d) => { setVol(d.volume); setFc(d.cutoff); },
 *   factoryPresets: [
 *     { name: "Init", data: { volume: 0.8, cutoff: 1000 } },
 *   ],
 * });
 *
 * <PresetBrowser
 *   presets={pm.presets}
 *   selectedIndex={pm.selectedIndex}
 *   onSelect={(_, i) => pm.select(i)}
 *   onSave={pm.save}
 *   onDelete={pm.delete}
 * />
 * ```
 */
export function usePresets(options: PresetManagerOptions): PresetManager {
  const { pluginId, getState, setState, factoryPresets = [] } = options;

  // Keep latest callbacks in refs so our memoised closures never go stale.
  const getStateRef = useRef(getState);
  const setStateRef = useRef(setState);
  useEffect(() => {
    getStateRef.current = getState;
    setStateRef.current = setState;
  });

  // Initialise state from localStorage, falling back to factory presets.
  const [presets, setPresets] = useState<Preset[]>(() => {
    const stored = readStorage(pluginId);
    return stored ?? [...factoryPresets];
  });
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Persist every time the presets array changes.
  useEffect(() => {
    writeStorage(pluginId, presets);
  }, [pluginId, presets]);

  // --- select ---
  const select = useCallback(
    (index: number) => {
      if (index < 0 || index >= presets.length) return;
      setSelectedIndex(index);
      setStateRef.current({ ...presets[index].data });
    },
    [presets],
  );

  // --- save ---
  const save = useCallback(
    (name: string) => {
      const data = getStateRef.current();
      const newPreset: Preset = { name, data: { ...data } };
      setPresets((prev) => {
        const next = [...prev, newPreset];
        // Auto-select the newly saved preset.
        setSelectedIndex(next.length - 1);
        return next;
      });
    },
    [],
  );

  // --- delete ---
  const deletePreset = useCallback(
    (index: number) => {
      setPresets((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const next = prev.filter((_, i) => i !== index);
        // Adjust selected index.
        setSelectedIndex((sel) => {
          if (next.length === 0) return -1;
          if (sel === index) return -1;
          if (sel > index) return sel - 1;
          return sel;
        });
        return next;
      });
    },
    [],
  );

  // --- rename ---
  const rename = useCallback(
    (index: number, name: string) => {
      setPresets((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const next = [...prev];
        next[index] = { ...next[index], name };
        return next;
      });
    },
    [],
  );

  // --- export ---
  const exportPreset = useCallback(
    (index: number): string => {
      if (index < 0 || index >= presets.length) return "{}";
      return JSON.stringify(presets[index], null, 2);
    },
    [presets],
  );

  // --- import ---
  const importPreset = useCallback((json: string) => {
    try {
      const parsed: unknown = JSON.parse(json);
      if (
        parsed != null &&
        typeof parsed === "object" &&
        "name" in parsed &&
        "data" in parsed
      ) {
        const preset = parsed as Preset;
        setPresets((prev) => {
          const next = [...prev, { name: preset.name, data: { ...preset.data } }];
          setSelectedIndex(next.length - 1);
          return next;
        });
      }
    } catch {
      // Invalid JSON — silently ignore.
    }
  }, []);

  return {
    presets,
    selectedIndex,
    select,
    save,
    delete: deletePreset,
    rename,
    exportPreset,
    importPreset,
  };
}
