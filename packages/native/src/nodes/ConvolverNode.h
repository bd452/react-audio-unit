#pragma once
#include "NodeBase.h"
#include <juce_dsp/juce_dsp.h>
#include <vector>

namespace rau
{

    /**
     * ConvolverNode — IR-based convolution reverb.
     *
     * Convolves the input signal with an impulse response loaded from
     * BinaryData or provided as raw samples. Uses JUCE's uniformly-partitioned
     * convolution engine for efficient frequency-domain processing.
     *
     * Parameters:
     *   mix      - Dry/wet blend (0 = fully dry, 1 = fully wet, default 0.5)
     *   gain     - Output gain (default 1.0)
     *   bypass   - Bypass flag
     *
     * The IR is loaded via loadIR() from the message thread. The convolution
     * engine is prepared on the audio thread automatically.
     */
    class ConvolverNode : public AudioNodeBase
    {
    public:
        ConvolverNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

        /**
         * Load an impulse response from raw sample data.
         * @param data        Pointer to float samples (interleaved if stereo)
         * @param numSamples  Number of samples per channel
         * @param numChannels Number of channels (1 or 2)
         * @param irSampleRate Sample rate of the IR
         */
        void loadIR(const float *data, int numSamples, int numChannels, double irSampleRate);

        /**
         * Load an impulse response from a WAV/AIFF file in memory.
         * @param fileData Pointer to the raw file data (WAV/AIFF)
         * @param fileSize Size in bytes
         */
        void loadIRFromFile(const void *fileData, size_t fileSize);

    private:
        juce::dsp::Convolution convolution;
        juce::SmoothedValue<float> mixSmoothed;
        bool irLoaded = false;
    };

} // namespace rau
