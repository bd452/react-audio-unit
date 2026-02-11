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

  // Listen for parameter changes from the host/DAW
  useEffect(() => {
    return bridge.onMessage((msg) => {
      if (msg.type === "parameterChanged" && msg.id === id) {
        setValueInternal(msg.value);
      }
    });
  }, [id]);

  // Setter that also notifies the native side
  const setValue = useCallback(
    (newValue: number) => {
      setValueInternal(newValue);
      bridge.setParameterValue(id, newValue);
    },
    [id],
  );

  return [value, setValue];
}
