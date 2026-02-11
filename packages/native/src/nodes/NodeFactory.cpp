#include "NodeFactory.h"
#include "GainNode.h"
#include "DelayNode.h"
#include "FilterNode.h"
#include "MixNode.h"

namespace rau
{

    std::unique_ptr<AudioNodeBase> NodeFactory::create(const std::string &type)
    {
        if (type == "gain")
            return std::make_unique<GainNode>();
        if (type == "delay")
            return std::make_unique<DelayNode>();
        if (type == "filter")
            return std::make_unique<FilterNode>();
        if (type == "mix")
            return std::make_unique<MixNode>();

        // Input/output nodes are handled specially by AudioGraph, but
        // we still create placeholder nodes for them:
        if (type == "input" || type == "midi_input" || type == "meter" || type == "spectrum")
        {
            // These are special nodes handled by the AudioGraph itself
            return nullptr;
        }

        // Unknown type — return nullptr, the graph will log a warning
        return nullptr;
    }

} // namespace rau
