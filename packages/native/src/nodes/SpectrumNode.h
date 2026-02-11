#pragma once
#include "NodeBase.h"
#include <juce_dsp/juce_dsp.h>
#include <array>
#include <vector>

namespace rau
{

    /**
     * SpectrumNode — FFT-based spectrum analyzer.
     *
     * Passes audio through unchanged. Computes FFT magnitudes
     * that can be read by the processor and sent to JS.
     *
     * Parameters:
     *   bypass - Bypass flag
     */
    class SpectrumNode : public AudioNodeBase
    {
    public:
        SpectrumNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

        /** Get the latest magnitude spectrum (linear, 0–1). Thread-safe. */
        std::vector<float> getMagnitudes() const;

        static constexpr int FFT_ORDER = 11;            // 2048-point FFT
        static constexpr int FFT_SIZE = 1 << FFT_ORDER; // 2048

    private:
        juce::dsp::FFT fft;
        juce::dsp::WindowingFunction<float> window;

        // Ring buffer for collecting samples
        std::array<float, FFT_SIZE> fifo{};
        int fifoIndex = 0;
        bool fftReady = false;

        // FFT data (double-size for real FFT)
        std::array<float, FFT_SIZE * 2> fftData{};

        // Stored magnitudes (written on audio thread, read on message thread)
        mutable std::mutex magnitudeMutex;
        std::vector<float> magnitudes;
    };

} // namespace rau
