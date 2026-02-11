#pragma once
#include "NodeBase.h"

namespace rau
{

    /**
     * EnvelopeNode — ADSR envelope generator.
     *
     * Triggered by a gate signal (>0.5 = on, <=0.5 = off) on input 0,
     * or directly via the `gate` parameter.
     *
     * Parameters:
     *   attack  - Attack time in ms (default 10)
     *   decay   - Decay time in ms (default 100)
     *   sustain - Sustain level 0–1 (default 0.7)
     *   release - Release time in ms (default 200)
     *   gate    - Gate trigger (0 or 1) — can also come from input 0
     *   bypass  - Bypass flag
     *
     * Output: control signal 0–1.
     */
    class EnvelopeNode : public AudioNodeBase
    {
    public:
        EnvelopeNode();
        void prepare(double sampleRate, int maxBlockSize) override;
        void process(int numSamples) override;

    private:
        enum class Stage
        {
            Idle,
            Attack,
            Decay,
            Sustain,
            Release
        };
        Stage stage = Stage::Idle;
        float envelope = 0.0f;
        bool wasGateOn = false;
    };

} // namespace rau
