#include "AudioGraph.h"
#include <algorithm>
#include <queue>
#include <cassert>

namespace rau
{

    static constexpr int BUFFER_POOL_SIZE = 32;

    AudioGraph::AudioGraph()
    {
    }

    AudioGraph::~AudioGraph() = default;

    void AudioGraph::prepare(double sampleRate, int maxBlockSize, int numChannels)
    {
        currentSampleRate = sampleRate;
        currentBlockSize = maxBlockSize;
        currentNumChannels = numChannels;

        // Pre-allocate buffer pool
        bufferPool.resize(BUFFER_POOL_SIZE);
        bufferInUse.resize(BUFFER_POOL_SIZE, false);
        for (auto &buf : bufferPool)
        {
            buf.setSize(numChannels, maxBlockSize);
            buf.clear();
        }

        // Prepare all existing nodes
        for (auto &[id, node] : nodes)
        {
            if (node)
            {
                node->prepare(sampleRate, maxBlockSize);
            }
        }
    }

    int AudioGraph::acquireBuffer()
    {
        for (int i = 0; i < static_cast<int>(bufferInUse.size()); ++i)
        {
            if (!bufferInUse[i])
            {
                bufferInUse[i] = true;
                bufferPool[i].clear();
                return i;
            }
        }
        // Pool exhausted — grow it (this allocation is not RT-safe, but is
        // a safety net; the pool should be sized to avoid this)
        int idx = static_cast<int>(bufferPool.size());
        bufferPool.emplace_back();
        bufferPool.back().setSize(currentNumChannels, currentBlockSize);
        bufferPool.back().clear();
        bufferInUse.push_back(true);
        return idx;
    }

    void AudioGraph::releaseBuffer(int index)
    {
        if (index >= 0 && index < static_cast<int>(bufferInUse.size()))
        {
            bufferInUse[index] = false;
        }
    }

    // ---------------------------------------------------------------------------
    // Operation queue
    // ---------------------------------------------------------------------------

    void AudioGraph::queueOp(GraphOp op)
    {
        // Lock-free push — if the queue is full, the op is dropped.
        // In practice 1024 slots should never be exhausted.
        opQueue.push(std::move(op));
    }

    void AudioGraph::setNodeParam(const std::string &nodeId, const std::string &param, float value)
    {
        // Direct atomic write — no queue needed, audio thread reads atomics
        auto it = nodes.find(nodeId);
        if (it != nodes.end() && it->second)
        {
            it->second->setParam(param, value);
        }
    }

    AudioNodeBase *AudioGraph::getNode(const std::string &nodeId) const
    {
        auto it = nodes.find(nodeId);
        if (it != nodes.end())
            return it->second.get();
        return nullptr;
    }

    std::vector<AudioNodeBase *> AudioGraph::getNodesByType(const std::string &type) const
    {
        std::vector<AudioNodeBase *> result;
        for (auto &[id, node] : nodes)
        {
            if (node && node->nodeType == type)
                result.push_back(node.get());
        }
        return result;
    }

    void AudioGraph::applyPendingOps()
    {
        // Drain the lock-free SPSC queue (audio thread side)
        processingOps.clear();
        GraphOp op;
        while (opQueue.pop(op))
        {
            processingOps.push_back(std::move(op));
        }

        if (processingOps.empty())
            return;

        bool topologyChanged = false;

        for (auto &op : processingOps)
        {
            switch (op.type)
            {
            case GraphOp::AddNode:
            {
                auto node = NodeFactory::create(op.nodeType);
                if (node)
                {
                    node->nodeId = op.nodeId;
                    node->nodeType = op.nodeType;
                    for (auto &[k, v] : op.params)
                    {
                        node->setParam(k, v);
                    }
                    node->prepare(currentSampleRate, currentBlockSize);
                    nodes[op.nodeId] = std::move(node);
                }
                else if (op.nodeType == "input")
                {
                    // Track the input node ID — it's handled specially
                    inputNodeId = op.nodeId;
                }
                topologyChanged = true;
                break;
            }
            case GraphOp::RemoveNode:
            {
                // Remove connections involving this node
                connections.erase(
                    std::remove_if(connections.begin(), connections.end(),
                                   [&](const Connection &c)
                                   {
                                       return c.fromNodeId == op.nodeId || c.toNodeId == op.nodeId;
                                   }),
                    connections.end());
                nodes.erase(op.nodeId);
                if (op.nodeId == inputNodeId)
                    inputNodeId.clear();
                topologyChanged = true;
                break;
            }
            case GraphOp::UpdateParams:
            {
                auto it = nodes.find(op.nodeId);
                if (it != nodes.end() && it->second)
                {
                    for (auto &[k, v] : op.params)
                    {
                        it->second->setParam(k, v);
                    }
                }
                break;
            }
            case GraphOp::Connect:
            {
                connections.push_back({op.fromNodeId, op.fromOutlet, op.toNodeId, op.toInlet});
                topologyChanged = true;
                break;
            }
            case GraphOp::Disconnect:
            {
                connections.erase(
                    std::remove_if(connections.begin(), connections.end(),
                                   [&](const Connection &c)
                                   {
                                       return c.fromNodeId == op.fromNodeId &&
                                              c.fromOutlet == op.fromOutlet &&
                                              c.toNodeId == op.toNodeId &&
                                              c.toInlet == op.toInlet;
                                   }),
                    connections.end());
                topologyChanged = true;
                break;
            }
            case GraphOp::SetOutput:
            {
                outputNodeId = op.nodeId;
                break;
            }
            }
        }

        processingOps.clear();

        if (topologyChanged)
        {
            rebuildProcessingOrder();
        }
    }

    // ---------------------------------------------------------------------------
    // Topological sort
    // ---------------------------------------------------------------------------

    void AudioGraph::rebuildProcessingOrder()
    {
        processingOrder.clear();

        // Build adjacency info
        std::unordered_map<std::string, int> inDegree;
        std::unordered_map<std::string, std::vector<std::string>> adjacency;

        for (auto &[id, _] : nodes)
        {
            inDegree[id] = 0;
        }

        for (auto &conn : connections)
        {
            if (nodes.count(conn.toNodeId) && nodes.count(conn.fromNodeId))
            {
                inDegree[conn.toNodeId]++;
                adjacency[conn.fromNodeId].push_back(conn.toNodeId);
            }
        }

        // Kahn's algorithm
        std::queue<std::string> queue;
        for (auto &[id, deg] : inDegree)
        {
            if (deg == 0)
                queue.push(id);
        }

        while (!queue.empty())
        {
            auto id = queue.front();
            queue.pop();

            auto it = nodes.find(id);
            if (it != nodes.end() && it->second)
            {
                processingOrder.push_back(it->second.get());
            }

            if (adjacency.count(id))
            {
                for (auto &neighbor : adjacency[id])
                {
                    inDegree[neighbor]--;
                    if (inDegree[neighbor] == 0)
                    {
                        queue.push(neighbor);
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Process
    // ---------------------------------------------------------------------------

    void AudioGraph::processBlock(juce::AudioBuffer<float> &buffer, juce::MidiBuffer &midi)
    {
        hostInputBuffer = &buffer;
        const int numSamples = buffer.getNumSamples();

        // Apply any queued graph operations
        applyPendingOps();

        if (processingOrder.empty())
            return;

        // Reset buffer pool
        std::fill(bufferInUse.begin(), bufferInUse.end(), false);

        // Assign output buffers and wire up inputs for each node
        // Build a map of nodeId -> output BufferRef
        std::unordered_map<std::string, BufferRef> nodeOutputs;

        // The input node's output is the host buffer itself
        if (!inputNodeId.empty())
        {
            nodeOutputs[inputNodeId] = {&buffer, -1}; // -1 = host buffer, don't release
        }

        for (auto *node : processingOrder)
        {
            // Skip the input node — its output is the host buffer
            if (node->nodeId == inputNodeId)
                continue;

            // Acquire an output buffer for this node
            int bufIdx = acquireBuffer();
            node->outputBuffer = {&bufferPool[bufIdx], bufIdx};
            nodeOutputs[node->nodeId] = node->outputBuffer;

            // Wire up input buffers from connections
            node->inputBuffers.clear();

            // Find connections to this node, sorted by inlet
            std::vector<std::pair<int, BufferRef>> inputs;
            for (auto &conn : connections)
            {
                if (conn.toNodeId == node->nodeId)
                {
                    auto outIt = nodeOutputs.find(conn.fromNodeId);
                    if (outIt != nodeOutputs.end())
                    {
                        inputs.push_back({conn.toInlet, outIt->second});
                    }
                }
            }
            std::sort(inputs.begin(), inputs.end(),
                      [](const auto &a, const auto &b)
                      { return a.first < b.first; });

            for (auto &[inlet, ref] : inputs)
            {
                // Ensure vector is large enough
                while (static_cast<int>(node->inputBuffers.size()) <= inlet)
                {
                    node->inputBuffers.push_back({});
                }
                node->inputBuffers[inlet] = ref;
            }

            // Process
            if (node->isBypassed())
            {
                node->processBypass(numSamples);
            }
            else
            {
                node->process(numSamples);
            }
        }

        // Copy the output node's buffer back to the host buffer
        if (!outputNodeId.empty())
        {
            auto outIt = nodeOutputs.find(outputNodeId);
            if (outIt != nodeOutputs.end() && outIt->second.isValid())
            {
                auto &outBuf = *outIt->second.buffer;
                for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
                {
                    if (ch < outBuf.getNumChannels())
                    {
                        buffer.copyFrom(ch, 0, outBuf, ch, 0, numSamples);
                    }
                }
            }
        }

        hostInputBuffer = nullptr;
    }

} // namespace rau
