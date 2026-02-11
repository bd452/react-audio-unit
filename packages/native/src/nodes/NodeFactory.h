#pragma once
#include "NodeBase.h"
#include <memory>
#include <string>

namespace rau
{

    /**
     * NodeFactory — creates DSP nodes by type name.
     *
     * When the JS reconciler sends an "addNode" operation, the native
     * engine uses this factory to instantiate the correct node type.
     */
    class NodeFactory
    {
    public:
        static std::unique_ptr<AudioNodeBase> create(const std::string &type);
    };

} // namespace rau
