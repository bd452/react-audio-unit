#include "NodeFactory.h"
#include "GainNode.h"
#include "DelayNode.h"
#include "FilterNode.h"
#include "MixNode.h"
#include "OscillatorNode.h"
#include "CompressorNode.h"
#include "ReverbNode.h"
#include "DistortionNode.h"
#include "PanNode.h"
#include "LFONode.h"
#include "EnvelopeNode.h"
#include "MeterNode.h"
#include "SpectrumNode.h"

namespace rau
{

    std::unique_ptr<AudioNodeBase> NodeFactory::create(const std::string &type)
    {
        // Effects
        if (type == "gain")
            return std::make_unique<GainNode>();
        if (type == "delay")
            return std::make_unique<DelayNode>();
        if (type == "filter")
            return std::make_unique<FilterNode>();
        if (type == "mix")
            return std::make_unique<MixNode>();
        if (type == "compressor")
            return std::make_unique<CompressorNode>();
        if (type == "reverb")
            return std::make_unique<ReverbNode>();
        if (type == "distortion")
            return std::make_unique<DistortionNode>();
        if (type == "pan")
            return std::make_unique<PanNode>();

        // Generators / Modulators
        if (type == "oscillator")
            return std::make_unique<OscillatorNode>();
        if (type == "lfo")
            return std::make_unique<LFONode>();
        if (type == "envelope")
            return std::make_unique<EnvelopeNode>();

        // Analysis (pass-through + data capture)
        if (type == "meter")
            return std::make_unique<MeterNode>();
        if (type == "spectrum")
            return std::make_unique<SpectrumNode>();

        // Input/output nodes are handled specially by AudioGraph
        if (type == "input" || type == "midi_input")
        {
            return nullptr;
        }

        // Unknown type — return nullptr, the graph will log a warning
        return nullptr;
    }

} // namespace rau
