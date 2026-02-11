import React, { useCallback, useState } from "react";

export interface KeyboardProps {
  /** Lowest MIDI note (default 48 = C3) */
  startNote?: number;
  /** Number of keys to display (default 25 = 2 octaves + 1) */
  numKeys?: number;
  /** Called when a key is pressed */
  onNoteOn?: (note: number, velocity: number) => void;
  /** Called when a key is released */
  onNoteOff?: (note: number) => void;
  /** Currently active notes (set of MIDI note numbers) */
  activeNotes?: Set<number>;
  /** Width in CSS pixels */
  width?: number;
  /** Height in CSS pixels */
  height?: number;
}

const BLACK_KEY_OFFSETS = [1, 3, -1, 6, 8, 10, -1]; // semitone offsets within octave for black keys
const IS_BLACK = [
  false,
  true,
  false,
  true,
  false,
  false,
  true,
  false,
  true,
  false,
  true,
  false,
];

/**
 * Keyboard — on-screen MIDI keyboard for instrument plugins.
 *
 * Supports mouse/touch interaction. Press keys to trigger noteOn/noteOff
 * callbacks with velocity.
 */
export const Keyboard: React.FC<KeyboardProps> = ({
  startNote = 48,
  numKeys = 25,
  onNoteOn,
  onNoteOff,
  activeNotes = new Set(),
  width = 500,
  height = 120,
}) => {
  const [pressedNotes, setPressedNotes] = useState<Set<number>>(new Set());

  // Calculate which notes are white keys
  const whiteKeys: number[] = [];
  const blackKeys: { note: number; xOffset: number }[] = [];

  let noteNum = startNote;
  for (let i = 0; i < numKeys; i++) {
    const semitone = noteNum % 12;
    if (!IS_BLACK[semitone]) {
      whiteKeys.push(noteNum);
    }
    noteNum++;
  }

  const whiteKeyWidth = width / whiteKeys.length;
  const blackKeyWidth = whiteKeyWidth * 0.6;
  const blackKeyHeight = height * 0.6;

  // Map white keys to x positions
  const whiteKeyPositions = new Map<number, number>();
  whiteKeys.forEach((note, idx) => {
    whiteKeyPositions.set(note, idx * whiteKeyWidth);
  });

  // Calculate black key positions
  noteNum = startNote;
  for (let i = 0; i < numKeys; i++) {
    const semitone = noteNum % 12;
    if (IS_BLACK[semitone]) {
      // Find neighboring white keys for positioning
      const prevWhite = noteNum - 1;
      const nextWhite = noteNum + 1;
      const prevPos = whiteKeyPositions.get(prevWhite);
      const nextPos = whiteKeyPositions.get(nextWhite);
      if (prevPos !== undefined) {
        blackKeys.push({
          note: noteNum,
          xOffset: prevPos + whiteKeyWidth - blackKeyWidth / 2,
        });
      }
    }
    noteNum++;
  }

  const handleKeyDown = useCallback(
    (note: number) => {
      setPressedNotes((prev) => new Set(prev).add(note));
      onNoteOn?.(note, 100);
    },
    [onNoteOn],
  );

  const handleKeyUp = useCallback(
    (note: number) => {
      setPressedNotes((prev) => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
      onNoteOff?.(note);
    },
    [onNoteOff],
  );

  const isActive = (note: number) =>
    activeNotes.has(note) || pressedNotes.has(note);

  const containerStyle: React.CSSProperties = {
    position: "relative",
    width,
    height,
    userSelect: "none",
    touchAction: "none",
    borderRadius: "var(--rau-radius, 6px)",
    overflow: "hidden",
    background: "var(--rau-bg-secondary, #1a1a2e)",
  };

  return (
    <div style={containerStyle} role="group" aria-label="MIDI Keyboard">
      {/* White keys */}
      {whiteKeys.map((note, idx) => (
        <div
          key={`w-${note}`}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            handleKeyDown(note);
          }}
          onPointerUp={() => handleKeyUp(note)}
          onPointerLeave={() => {
            if (pressedNotes.has(note)) handleKeyUp(note);
          }}
          style={{
            position: "absolute",
            left: idx * whiteKeyWidth,
            top: 0,
            width: whiteKeyWidth - 1,
            height: height,
            background: isActive(note)
              ? "var(--rau-accent, #6c63ff)"
              : "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "0 0 4px 4px",
            cursor: "pointer",
            transition: "background 50ms",
            zIndex: 1,
          }}
          role="button"
          aria-label={`Note ${note}`}
          aria-pressed={isActive(note)}
        />
      ))}
      {/* Black keys */}
      {blackKeys.map(({ note, xOffset }) => (
        <div
          key={`b-${note}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            handleKeyDown(note);
          }}
          onPointerUp={() => handleKeyUp(note)}
          onPointerLeave={() => {
            if (pressedNotes.has(note)) handleKeyUp(note);
          }}
          style={{
            position: "absolute",
            left: xOffset,
            top: 0,
            width: blackKeyWidth,
            height: blackKeyHeight,
            background: isActive(note) ? "var(--rau-accent, #6c63ff)" : "#333",
            borderRadius: "0 0 3px 3px",
            cursor: "pointer",
            transition: "background 50ms",
            zIndex: 2,
          }}
          role="button"
          aria-label={`Note ${note}`}
          aria-pressed={isActive(note)}
        />
      ))}
    </div>
  );
};
