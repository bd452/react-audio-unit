// ---------------------------------------------------------------------------
// I/O negotiation — host ↔ plugin channel layout matching
//
// When a DAW loads a plugin it needs to agree on the exact channel layout
// for each bus. The plugin declares supported layouts (in preference order)
// and the host proposes what it can provide. This module implements the
// matching logic, mirroring the negotiation semantics of:
//
//   VST3:  IComponent::setBusArrangements()
//   AU:    AUAudioUnit.supportedChannelLayoutTags / isInputBusExposed
//   AAX:   AAX_CEffectDirectData stem format matching
//
// ---------------------------------------------------------------------------

import {
  channelCount,
  layoutsEqual,
  type ChannelLayoutOrCustom,
} from "./channel-layout.js";

import type {
  AudioBusConfig,
  MidiBusConfig,
  PluginIOConfig,
  ActiveIOConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Single-bus negotiation
// ---------------------------------------------------------------------------

/**
 * Result of a single-bus layout negotiation.
 */
export interface BusNegotiationResult {
  /** Whether a compatible layout was found. */
  matched: boolean;
  /** The selected layout (first mutual match, or plugin's most-preferred if no host prefs). */
  layout: ChannelLayoutOrCustom;
  /** The bus name. */
  name: string;
  /** Whether the bus is active. Optional buses can be deactivated. */
  active: boolean;
}

/**
 * Negotiate the layout for a single audio bus.
 *
 * If `hostPreferred` is provided, the function picks the first layout from
 * the bus's supported list that the host also supports. If no mutual match
 * exists, the bus falls back to its most-preferred layout.
 *
 * This mirrors VST3's negotiation: the host proposes a speaker arrangement,
 * and the plugin either accepts or counter-proposes its preferred layout.
 *
 * @param bus           - The plugin's bus declaration.
 * @param hostPreferred - Layouts the host can provide, in preference order.
 *                        If omitted, the plugin's most-preferred layout wins.
 * @returns Negotiation result with the selected layout.
 */
export function negotiateBusLayout(
  bus: AudioBusConfig,
  hostPreferred?: ChannelLayoutOrCustom[],
): BusNegotiationResult {
  if (!hostPreferred || hostPreferred.length === 0) {
    // No host preference — use plugin's most preferred layout
    return {
      matched: true,
      layout: bus.layouts[0],
      name: bus.name,
      active: true,
    };
  }

  // Find first plugin-supported layout that the host also supports
  for (const pluginLayout of bus.layouts) {
    for (const hostLayout of hostPreferred) {
      if (layoutsEqual(pluginLayout, hostLayout)) {
        return {
          matched: true,
          layout: pluginLayout,
          name: bus.name,
          active: true,
        };
      }
    }
  }

  // No mutual match — counter-propose plugin's preferred layout (VST3 style)
  return {
    matched: false,
    layout: bus.layouts[0],
    name: bus.name,
    active: true,
  };
}

// ---------------------------------------------------------------------------
// Full I/O negotiation
// ---------------------------------------------------------------------------

/**
 * Proposed channel layouts from the host for each bus position.
 * The index in the array corresponds to the bus index in the plugin's
 * `PluginIOConfig.audio.inputs` / `.outputs` arrays.
 */
export interface HostBusProposal {
  audioInputs?: ChannelLayoutOrCustom[][];
  audioOutputs?: ChannelLayoutOrCustom[][];
}

/**
 * Result of a full I/O negotiation.
 */
export interface IONegotiationResult {
  /** True if all required (non-optional) buses matched. */
  success: boolean;
  /** The resolved active configuration. */
  config: ActiveIOConfig;
  /** Per-bus details for debugging / logging. */
  details: {
    audioInputs: BusNegotiationResult[];
    audioOutputs: BusNegotiationResult[];
  };
}

/**
 * Negotiate the complete I/O configuration between host and plugin.
 *
 * For each bus declared in the plugin's `PluginIOConfig`, the host can
 * propose preferred layouts. The negotiation selects the best mutual
 * match for each bus.
 *
 * @param pluginIO      - The plugin's declared I/O capabilities.
 * @param hostProposal  - The host's preferred layouts per bus (optional).
 * @returns Full negotiation result with the active configuration.
 */
export function negotiateIOConfig(
  pluginIO: PluginIOConfig,
  hostProposal?: HostBusProposal,
): IONegotiationResult {
  const audioInputResults = pluginIO.audio.inputs.map((bus, i) =>
    negotiateBusLayout(bus, hostProposal?.audioInputs?.[i]),
  );

  const audioOutputResults = pluginIO.audio.outputs.map((bus, i) =>
    negotiateBusLayout(bus, hostProposal?.audioOutputs?.[i]),
  );

  // Check if all required buses matched
  const allRequiredMatched =
    audioInputResults.every(
      (r, i) => r.matched || pluginIO.audio.inputs[i].optional,
    ) &&
    audioOutputResults.every(
      (r, i) => r.matched || pluginIO.audio.outputs[i].optional,
    );

  // Build the active config — deactivate optional buses that didn't match
  const activeConfig: ActiveIOConfig = {
    audio: {
      inputs: audioInputResults.map((r, i) => ({
        name: r.name,
        layout: r.layout,
        active: r.matched || !pluginIO.audio.inputs[i].optional,
      })),
      outputs: audioOutputResults.map((r, i) => ({
        name: r.name,
        layout: r.layout,
        active: r.matched || !pluginIO.audio.outputs[i].optional,
      })),
    },
    midi: {
      inputs: (pluginIO.midi?.inputs ?? []).map((bus) => ({
        name: bus.name,
        channels: bus.channels ?? 16,
        active: true,
      })),
      outputs: (pluginIO.midi?.outputs ?? []).map((bus) => ({
        name: bus.name,
        channels: bus.channels ?? 16,
        active: true,
      })),
    },
  };

  return {
    success: allRequiredMatched,
    config: activeConfig,
    details: {
      audioInputs: audioInputResults,
      audioOutputs: audioOutputResults,
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience: find the best common layout between two bus configs
// ---------------------------------------------------------------------------

/**
 * Find layouts that are supported by both bus configs.
 * Returns them in order of the first config's preference.
 *
 * This is useful for connecting two nodes in the graph — e.g. determining
 * whether an effect node can directly accept the output format of the
 * preceding node, or whether a format conversion is needed.
 */
export function findCommonLayouts(
  a: AudioBusConfig,
  b: AudioBusConfig,
): ChannelLayoutOrCustom[] {
  const result: ChannelLayoutOrCustom[] = [];
  for (const layoutA of a.layouts) {
    for (const layoutB of b.layouts) {
      if (layoutsEqual(layoutA, layoutB)) {
        result.push(layoutA);
        break;
      }
    }
  }
  return result;
}

/**
 * Check if a bus supports a specific layout.
 */
export function busSupportsLayout(
  bus: AudioBusConfig,
  layout: ChannelLayoutOrCustom,
): boolean {
  return bus.layouts.some((l) => layoutsEqual(l, layout));
}

/**
 * Create a default `ActiveIOConfig` from a `PluginIOConfig` by selecting
 * the most-preferred layout for each bus. This is the "no host negotiation"
 * fallback used in dev/browser mode.
 */
export function defaultActiveConfig(io: PluginIOConfig): ActiveIOConfig {
  return negotiateIOConfig(io).config;
}
