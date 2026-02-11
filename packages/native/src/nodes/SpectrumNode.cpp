#include "SpectrumNode.h"
#include <cmath>

namespace rau
{

    SpectrumNode::SpectrumNode()
        : fft(FFT_ORDER),
          window(static_cast<size_t>(FFT_SIZE), juce::dsp::WindowingFunction<float>::hann)
    {
        nodeType = "spectrum";
        addParam("bypass", 0.0f);
        magnitudes.resize(FFT_SIZE / 2, 0.0f);
    }

    void SpectrumNode::prepare(double sr, int maxBlock)
    {
        AudioNodeBase::prepare(sr, maxBlock);
        fifo.fill(0.0f);
        fftData.fill(0.0f);
        fifoIndex = 0;
        fftReady = false;
        std::lock_guard<std::mutex> lock(magnitudeMutex);
        std::fill(magnitudes.begin(), magnitudes.end(), 0.0f);
    }

    void SpectrumNode::process(int numSamples)
    {
        if (!outputBuffer.isValid() || inputBuffers.empty() || !inputBuffers[0].isValid())
            return;

        auto &in = *inputBuffers[0].buffer;
        auto &out = *outputBuffer.buffer;
        const int numChannels = juce::jmin(in.getNumChannels(), out.getNumChannels());

        // Pass through
        for (int ch = 0; ch < numChannels; ++ch)
        {
            out.copyFrom(ch, 0, in, ch, 0, numSamples);
        }

        // Feed samples into the FFT fifo (use channel 0)
        auto *data = in.getReadPointer(0);
        for (int s = 0; s < numSamples; ++s)
        {
            fifo[static_cast<size_t>(fifoIndex)] = data[s];
            fifoIndex++;

            if (fifoIndex >= FFT_SIZE)
            {
                // FFT fifo is full — compute
                fifoIndex = 0;

                // Copy to fftData and apply window
                std::copy(fifo.begin(), fifo.end(), fftData.begin());
                std::fill(fftData.begin() + FFT_SIZE, fftData.end(), 0.0f);
                window.multiplyWithWindowingTable(fftData.data(), static_cast<size_t>(FFT_SIZE));

                // Perform FFT
                fft.performFrequencyOnlyForwardTransform(fftData.data());

                // Compute magnitudes (normalized)
                float maxMag = 1e-10f;
                std::vector<float> newMags(FFT_SIZE / 2);
                for (int i = 0; i < FFT_SIZE / 2; ++i)
                {
                    newMags[static_cast<size_t>(i)] = fftData[static_cast<size_t>(i)];
                    if (newMags[static_cast<size_t>(i)] > maxMag)
                        maxMag = newMags[static_cast<size_t>(i)];
                }

                // Normalize to 0–1
                for (auto &m : newMags)
                    m /= maxMag;

                // Store
                std::lock_guard<std::mutex> lock(magnitudeMutex);
                magnitudes = std::move(newMags);
            }
        }
    }

    std::vector<float> SpectrumNode::getMagnitudes() const
    {
        std::lock_guard<std::mutex> lock(magnitudeMutex);
        return magnitudes;
    }

} // namespace rau
