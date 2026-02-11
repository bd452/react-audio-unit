#include "ReverbNode.h"

namespace rau
{

    ReverbNode::ReverbNode()
    {
        nodeType = "reverb";
        addParam("roomSize", 0.5f);
        addParam("damping", 0.5f);
        addParam("preDelay", 0.0f); // ms — TODO: implement pre-delay line
        addParam("mix", 0.3f);
        addParam("bypass", 0.0f);
    }

    void ReverbNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        reverb.setSampleRate(sr);
        reverb.reset();
    }

    void ReverbNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;

        // Update reverb parameters from atomics
        reverbParams.roomSize = juce::jlimit(0.0f, 1.0f, getParam("roomSize"));
        reverbParams.damping = juce::jlimit(0.0f, 1.0f, getParam("damping"));
        reverbParams.wetLevel = juce::jlimit(0.0f, 1.0f, getParam("mix"));
        reverbParams.dryLevel = 1.0f - reverbParams.wetLevel;
        reverbParams.width = 1.0f;
        reverbParams.freezeMode = 0.0f;
        reverb.setParameters(reverbParams);

        // Copy input to output, then process in-place
        for (int ch = 0; ch < juce::jmin(in.getNumChannels(), out.getNumChannels()); ++ch)
        {
            out.copyFrom(ch, 0, in, ch, 0, numSamples);
        }

        if (out.getNumChannels() >= 2)
        {
            reverb.processStereo(out.getWritePointer(0), out.getWritePointer(1), numSamples);
        }
        else if (out.getNumChannels() == 1)
        {
            reverb.processMono(out.getWritePointer(0), numSamples);
        }
    }

} // namespace rau
