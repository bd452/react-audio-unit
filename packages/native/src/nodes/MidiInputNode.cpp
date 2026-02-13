#include "MidiInputNode.h"
#include <cmath>

namespace rau
{

    MidiInputNode::MidiInputNode()
    {
        nodeType = "midi_input";
        // No user-configurable params — output is derived from MIDI data.
    }

    void MidiInputNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        gateOn = false;
        currentNote = -1;
        currentFrequency = 0.0f;
    }

    void MidiInputNode::process(int numSamples)
    {
        if (!outputBuffer.isValid())
            return;

        auto &out = *outputBuffer.buffer;
        const int numChannels = out.getNumChannels();

        // If no MIDI buffer is available, output silence / hold current state.
        if (midiBuffer == nullptr || midiBuffer->isEmpty())
        {
            float gateVal = gateOn ? 1.0f : 0.0f;
            for (int s = 0; s < numSamples; ++s)
            {
                if (numChannels > 0)
                    out.setSample(0, s, gateVal);
                if (numChannels > 1)
                    out.setSample(1, s, currentFrequency);
            }
            return;
        }

        // Process sample-by-sample, applying MIDI events at their
        // sample-accurate offsets within the block.
        auto it = midiBuffer->begin();

        for (int s = 0; s < numSamples; ++s)
        {
            // Apply all MIDI events at or before this sample offset
            while (it != midiBuffer->end())
            {
                auto metadata = *it;
                if (metadata.samplePosition > s)
                    break;

                auto msg = metadata.getMessage();
                if (msg.isNoteOn())
                {
                    gateOn = true;
                    currentNote = msg.getNoteNumber();
                    currentFrequency = noteToFrequency(currentNote);
                }
                else if (msg.isNoteOff())
                {
                    // Only release gate if this is the note we're playing
                    if (msg.getNoteNumber() == currentNote)
                    {
                        gateOn = false;
                    }
                }
                ++it;
            }

            // Write gate (ch 0) and frequency (ch 1)
            if (numChannels > 0)
                out.setSample(0, s, gateOn ? 1.0f : 0.0f);
            if (numChannels > 1)
                out.setSample(1, s, currentFrequency);
        }
    }

} // namespace rau
