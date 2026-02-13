#include "ConvolverNode.h"

namespace rau
{

    ConvolverNode::ConvolverNode()
        : convolution(juce::dsp::Convolution::NonUniform{512})
    {
        addParam("mix", 0.5f);
        addParam("gain", 1.0f);
        addParam("bypass", 0.0f);
    }

    void ConvolverNode::prepare(double sr, int blockSize)
    {
        AudioNodeBase::prepare(sr, blockSize);

        juce::dsp::ProcessSpec spec;
        spec.sampleRate = sr;
        spec.maximumBlockSize = static_cast<juce::uint32>(blockSize);
        spec.numChannels = 2;
        convolution.prepare(spec);

        // Pre-allocate the wet buffer so process() never allocates on the audio thread
        wetBuffer.setSize(2, blockSize);

        mixSmoothed.reset(sr, 0.02); // 20ms smoothing
        mixSmoothed.setCurrentAndTargetValue(getParam("mix"));
    }

    void ConvolverNode::process(int numSamples)
    {
        if (!outputBuffer.isValid())
            return;

        auto &outBuf = *outputBuffer.buffer;
        const int numCh = outBuf.getNumChannels();

        // Copy input to output first (dry signal)
        if (!inputBuffers.empty() && inputBuffers[0].isValid())
        {
            auto &inBuf = *inputBuffers[0].buffer;
            for (int ch = 0; ch < numCh; ++ch)
            {
                if (ch < inBuf.getNumChannels())
                    outBuf.copyFrom(ch, 0, inBuf, ch, 0, numSamples);
                else
                    outBuf.clear(ch, 0, numSamples);
            }
        }
        else
        {
            outBuf.clear(0, numSamples);
            return;
        }

        if (!irLoaded)
            return;

        float mix = getParam("mix");
        float gain = getParam("gain");
        mixSmoothed.setTargetValue(mix);

        // Use the pre-allocated wet buffer (sized in prepare())
        for (int ch = 0; ch < numCh; ++ch)
            wetBuffer.copyFrom(ch, 0, outBuf, ch, 0, numSamples);

        // Process convolution on the wet buffer
        juce::dsp::AudioBlock<float> block(wetBuffer);
        juce::dsp::ProcessContextReplacing<float> context(block);
        convolution.process(context);

        // Mix dry/wet
        for (int sample = 0; sample < numSamples; ++sample)
        {
            float m = mixSmoothed.getNextValue();
            for (int ch = 0; ch < numCh; ++ch)
            {
                float dry = outBuf.getSample(ch, sample);
                float wet = wetBuffer.getSample(ch, sample);
                outBuf.setSample(ch, sample, (dry * (1.0f - m) + wet * m) * gain);
            }
        }
    }

    void ConvolverNode::loadIR(const float *data, int numSamples, int numChannels, double irSampleRate)
    {
        if (data == nullptr || numSamples <= 0)
            return;

        // Create an AudioBuffer from the raw data
        juce::AudioBuffer<float> irBuffer(numChannels, numSamples);
        for (int ch = 0; ch < numChannels; ++ch)
        {
            for (int i = 0; i < numSamples; ++i)
            {
                irBuffer.setSample(ch, i, data[i * numChannels + ch]);
            }
        }

        convolution.loadImpulseResponse(
            std::move(irBuffer),
            irSampleRate,
            numChannels == 1 ? juce::dsp::Convolution::Stereo::yes : juce::dsp::Convolution::Stereo::yes,
            juce::dsp::Convolution::Trim::yes,
            juce::dsp::Convolution::Normalise::yes);

        irLoaded = true;
    }

    void ConvolverNode::loadIRFromFile(const void *fileData, size_t fileSize)
    {
        if (fileData == nullptr || fileSize == 0)
            return;

        convolution.loadImpulseResponse(
            fileData, fileSize,
            juce::dsp::Convolution::Stereo::yes,
            juce::dsp::Convolution::Trim::yes,
            0, // use entire file
            juce::dsp::Convolution::Normalise::yes);

        irLoaded = true;
    }

} // namespace rau
