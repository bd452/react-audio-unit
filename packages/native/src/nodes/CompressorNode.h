#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * CompressorNode — dynamic range compressor.
     *
     * Parameters:
     *   threshold  - Threshold in dB (default -20)
     *   ratio      - Compression ratio (default 4.0, range 1–20)
     *   attack     - Attack time in ms (default 10)
     *   release    - Release time in ms (default 100)
     *   knee       - Knee width in dB (default 0 = hard knee)
     *   makeupGain - Makeup gain in dB (default 0)
     *   bypass     - Bypass flag
     *
     * Input 0: audio to compress
     * Input 1 (optional): sidechain signal
     */
    class CompressorNode : public AudioNodeBase
    {
    public:
        CompressorNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        float envelopeDb = 0.0f;
    };

} // namespace rau
