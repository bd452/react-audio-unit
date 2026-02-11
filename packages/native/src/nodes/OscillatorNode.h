#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * OscillatorNode — generates audio waveforms.
     *
     * Waveform types (float enum):
     *   0 = sine, 1 = saw, 2 = square, 3 = triangle
     *
     * Parameters:
     *   waveform  - Waveform type (0–3)
     *   frequency - Frequency in Hz (default 440)
     *   detune    - Detune in cents (default 0)
     *   gain      - Output level (default 1.0)
     *   bypass    - Bypass flag
     */
    class OscillatorNode : public AudioNodeBase
    {
    public:
        OscillatorNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        double phase = 0.0;
        juce::SmoothedValue<float> smoothedFreq;
    };

} // namespace rau
