#pragma once
#include "NodeBase.h"
#include <juce_audio_basics/juce_audio_basics.h>

namespace rau
{

    /**
     * MidiInputNode — converts MIDI note events into audio-rate signals.
     *
     * Output channel 0: gate signal (1.0 while a note is held, 0.0 otherwise)
     * Output channel 1: frequency in Hz of the most recent note
     *
     * This is a monophonic "last-note priority" node. For polyphony, use
     * the JS-side usePolyphony() hook which manages voice allocation in
     * React and drives per-voice OscillatorNode/EnvelopeNode params.
     *
     * The AudioGraph sets `midiBuffer` before calling process() so the
     * node can read the current block's MIDI events.
     */
    class MidiInputNode : public AudioNodeBase
    {
    public:
        MidiInputNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

        /** Set by AudioGraph::processBlock before processing. */
        const juce::MidiBuffer *midiBuffer = nullptr;

    private:
        bool gateOn = false;
        int currentNote = -1;
        float currentFrequency = 0.0f;

        static float noteToFrequency(int noteNumber)
        {
            return 440.0f * std::pow(2.0f, (noteNumber - 69) / 12.0f);
        }
    };

} // namespace rau
