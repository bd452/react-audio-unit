import { useState, useEffect, useCallback, useContext } from "react";
import {
  type ParameterConfig,
  ParameterRegistryContext,
  bridge,
} from "@react-audio-unit/core";

/**
 * useParameter — registers an automatable parameter with the DAW.
 *
 * Returns a [value, setter] tuple like useState. The value is kept in
 * sync with the DAW's automation system: if the host changes the
 * parameter (automation, MIDI learn, etc.), the React state updates
 * automatically. If the user changes it via the UI, the update is
 * sent to the native engine.
 *
 * @param id     - Unique parameter identifier (stable across sessions)
 * @param config - Parameter range, label, and behavior
 */
export function useParameter(
  id: string,
  config: ParameterConfig,
): [number, (value: number) => void] {
  const registry = useContext(ParameterRegistryContext);
  const [value, setValueInternal] = useState(config.default);

  // Register with parameter registry and native bridge on mount
  useEffect(() => {
    bridge.registerParameter(id, config);
    registry?.register(id, config, setValueInternal);

    return () => {
      bridge.unregisterParameter(id);
      registry?.unregister(id);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for parameter changes from the host/DAW.
  // PluginHost also handles parameterChanged via the registry's entry.setValue
  // wrapper (which updates entry.value + React state). This listener is a
  // safety net that ensures the local React state is always up-to-date.
  useEffect(() => {
    return bridge.onMessage((msg) => {
      if (msg.type === "parameterChanged" && msg.id === id) {
        setValueInternal(msg.value);
        // Keep registry in sync (may be redundant if PluginHost already
        // dispatched through entry.setValue, but harmless to double-set).
        const entry = registry?.getAll().get(id);
        if (entry) entry.value = msg.value;
      }
    });
  }, [id, registry]);

  // Setter that also notifies the native side AND keeps the registry
  // entry.value in sync (required for accurate state serialization).
  const setValue = useCallback(
    (newValue: number) => {
      setValueInternal(newValue);
      // Update the registry's entry.value so requestState serializes
      // the current value, not the stale default.
      const entry = registry?.getAll().get(id);
      if (entry) entry.value = newValue;
      bridge.setParameterValue(id, newValue);
    },
    [id, registry],
  );

  return [value, setValue];
}
