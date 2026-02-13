import { useState, useEffect, useRef, useCallback } from "react";
import { useContext } from "react";
import { MidiContext } from "@react-audio-unit/core";
import type { MidiEvent, Signal } from "@react-audio-unit/core";

export interface Voice {
  /** MIDI note number (0–127). */
  note: number;
  /** Velocity (0–1). */
  velocity: number;
  /** Unique voice ID for keying. */
  id: number;
  /** Whether this voice's note is currently held (gate on). */
  active: boolean;
}

export type VoiceStealingStrategy =
  | "oldest"
  | "quietest"
  | "highest"
  | "lowest";

export interface PolyphonyOptions {
  /** Maximum simultaneous voices. Default 8. */
  maxVoices?: number;
  /** Voice stealing strategy when all voices are used. Default "oldest". */
  stealing?: VoiceStealingStrategy;
}

export interface PolyphonyState {
  /** Currently allocated voices (both active and releasing). */
  voices: Voice[];
  /** Set of currently held note numbers. */
  heldNotes: Set<number>;
}

/**
 * usePolyphony — manages polyphonic voice allocation from MIDI input.
 *
 * Tracks noteOn/noteOff events and allocates voices up to `maxVoices`.
 * When all voices are in use, applies a voice stealing strategy.
 *
 * Usage:
 * ```tsx
 * const { voices } = usePolyphony({ maxVoices: 8 });
 * // Render each voice
 * {voices.map(voice => (
 *   <VoiceComponent key={voice.id} note={voice.note} velocity={voice.velocity} gate={voice.active} />
 * ))}
 * ```
 *
 * Each voice component would use `useOscillator`, `useEnvelope`, etc.
 * with frequency derived from the voice's note number.
 */
export function usePolyphony(options: PolyphonyOptions = {}): PolyphonyState {
  const { maxVoices = 8, stealing = "oldest" } = options;

  const midiBusEvents = useContext(MidiContext);
  const midiEvents = midiBusEvents.get(0) ?? [];
  const nextVoiceId = useRef(0);

  const [voices, setVoices] = useState<Voice[]>([]);
  const [heldNotes, setHeldNotes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!midiEvents || midiEvents.length === 0) return;

    setVoices((prev) => {
      let updated = [...prev];
      const held = new Set(heldNotes);

      for (const evt of midiEvents) {
        if (
          evt.type === "noteOn" &&
          evt.note !== undefined &&
          evt.velocity !== undefined &&
          evt.velocity > 0
        ) {
          held.add(evt.note);

          // Check if this note already has an active voice
          const existingIdx = updated.findIndex(
            (v) => v.note === evt.note && v.active,
          );
          if (existingIdx >= 0) {
            // Re-trigger: update velocity
            updated[existingIdx] = {
              ...updated[existingIdx],
              velocity: evt.velocity,
            };
            continue;
          }

          // Allocate a new voice
          if (updated.length < maxVoices) {
            updated.push({
              note: evt.note,
              velocity: evt.velocity,
              id: nextVoiceId.current++,
              active: true,
            });
          } else {
            // Voice stealing
            const stealIdx = pickVoiceToSteal(updated, stealing);
            if (stealIdx >= 0) {
              updated[stealIdx] = {
                note: evt.note,
                velocity: evt.velocity,
                id: nextVoiceId.current++,
                active: true,
              };
            }
          }
        } else if (evt.type === "noteOff" && evt.note !== undefined) {
          held.delete(evt.note);

          // Mark the voice as releasing (not active)
          const voiceIdx = updated.findIndex(
            (v) => v.note === evt.note && v.active,
          );
          if (voiceIdx >= 0) {
            updated[voiceIdx] = { ...updated[voiceIdx], active: false };
          }
        }
      }

      // Prune released voices that exceed maxVoices to make room
      // Keep released voices for a short time (they may still be in release phase)
      // But if we're at capacity and all are inactive, remove the oldest inactive ones
      const activeCount = updated.filter((v) => v.active).length;
      if (updated.length > maxVoices && activeCount < maxVoices) {
        const inactiveVoices = updated
          .map((v, i) => ({ v, i }))
          .filter(({ v }) => !v.active);
        const toRemove = updated.length - maxVoices;
        const removeIndices = new Set(
          inactiveVoices.slice(0, toRemove).map(({ i }) => i),
        );
        updated = updated.filter((_, i) => !removeIndices.has(i));
      }

      setHeldNotes(held);
      return updated;
    });
  }, [midiEvents, maxVoices, stealing]);

  return { voices, heldNotes };
}

function pickVoiceToSteal(
  voices: Voice[],
  strategy: VoiceStealingStrategy,
): number {
  // Prefer stealing inactive (releasing) voices first
  const inactiveIdx = voices.findIndex((v) => !v.active);
  if (inactiveIdx >= 0) return inactiveIdx;

  switch (strategy) {
    case "oldest":
      // Lowest ID = oldest
      return voices.reduce(
        (minIdx, v, i, arr) => (v.id < arr[minIdx].id ? i : minIdx),
        0,
      );
    case "highest":
      return voices.reduce(
        (maxIdx, v, i, arr) => (v.note > arr[maxIdx].note ? i : maxIdx),
        0,
      );
    case "lowest":
      return voices.reduce(
        (minIdx, v, i, arr) => (v.note < arr[minIdx].note ? i : minIdx),
        0,
      );
    case "quietest":
      return voices.reduce(
        (minIdx, v, i, arr) => (v.velocity < arr[minIdx].velocity ? i : minIdx),
        0,
      );
    default:
      return 0;
  }
}

/**
 * Helper: convert MIDI note number to frequency in Hz.
 */
export function midiNoteToFrequency(note: number, tuning = 440): number {
  return tuning * Math.pow(2, (note - 69) / 12);
}
