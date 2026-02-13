#include "AudioGraph.h"
#include <algorithm>
#include <queue>
#include <cassert>

namespace rau
{

    static constexpr int BUFFER_POOL_SIZE = 32;

    AudioGraph::AudioGraph()
    {
        snapshotA = std::make_unique<GraphSnapshot>();
        snapshotB = std::make_unique<GraphSnapshot>();
        activeSnapshot.store(snapshotA.get(), std::memory_order_relaxed);
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
        // Pool exhausted — grow it (safety net; pool should be sized to avoid this)
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
    // Operation queue (message thread side)
    // ---------------------------------------------------------------------------

    // Apply a single topology op to the authoritative state (message thread).
    // Does NOT rebuild the snapshot — the caller is responsible for that.
    void AudioGraph::applyTopologyOp(const GraphOp &op)
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
                int busIndex = 0;
                auto chIt = op.params.find("channel");
                if (chIt != op.params.end())
                    busIndex = static_cast<int>(chIt->second);
                inputNodeIds[busIndex] = op.nodeId;
                if (busIndex == 0)
                    inputNodeId = op.nodeId;
            }
            break;
        }
        case GraphOp::RemoveNode:
        {
            connections.erase(
                std::remove_if(connections.begin(), connections.end(),
                               [&](const GraphSnapshot::Connection &c)
                               {
                                   return c.fromNodeId == op.nodeId || c.toNodeId == op.nodeId;
                               }),
                connections.end());
            nodes.erase(op.nodeId);
            if (op.nodeId == inputNodeId)
                inputNodeId.clear();
            // Clean up multi-bus input entries
            for (auto it = inputNodeIds.begin(); it != inputNodeIds.end();)
            {
                if (it->second == op.nodeId)
                    it = inputNodeIds.erase(it);
                else
                    ++it;
            }
            break;
        }
        case GraphOp::Connect:
        {
            connections.push_back({op.fromNodeId, op.fromOutlet, op.toNodeId, op.toInlet});
            break;
        }
        case GraphOp::Disconnect:
        {
            connections.erase(
                std::remove_if(connections.begin(), connections.end(),
                               [&](const GraphSnapshot::Connection &c)
                               {
                                   return c.fromNodeId == op.fromNodeId &&
                                          c.fromOutlet == op.fromOutlet &&
                                          c.toNodeId == op.toNodeId &&
                                          c.toInlet == op.toInlet;
                               }),
                connections.end());
            break;
        }
        case GraphOp::SetOutput:
        {
            outputNodeId = op.nodeId;
            break;
        }
        default:
            break;
        }
    }

    void AudioGraph::queueOp(GraphOp op)
    {
        // UpdateParams go through the fast SPSC queue — audio thread applies
        // them directly to the atomic params on existing nodes.
        if (op.type == GraphOp::UpdateParams)
        {
            paramOpQueue.push(std::move(op));
            return;
        }

        // Topology changes are applied immediately on the message thread
        // to the authoritative state, then a new snapshot is built and
        // published atomically for the audio thread.
        applyTopologyOp(op);
        rebuildAndPublishSnapshot();
    }

    void AudioGraph::queueOps(std::vector<GraphOp> ops)
    {
        bool topologyChanged = false;

        for (auto &op : ops)
        {
            if (op.type == GraphOp::UpdateParams)
            {
                paramOpQueue.push(std::move(op));
            }
            else
            {
                applyTopologyOp(op);
                topologyChanged = true;
            }
        }

        // Rebuild the snapshot only once after all ops are applied,
        // so the audio thread never sees an intermediate state.
        if (topologyChanged)
        {
            rebuildAndPublishSnapshot();
        }
    }

    void AudioGraph::setHostInputBuffer(int busIndex, juce::AudioBuffer<float> *buffer)
    {
        hostInputBuffers[busIndex] = buffer;
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

    // ---------------------------------------------------------------------------
    // Snapshot building (message thread)
    // ---------------------------------------------------------------------------

    void AudioGraph::rebuildAndPublishSnapshot()
    {
        // Determine which snapshot slot is NOT currently active
        auto *current = activeSnapshot.load(std::memory_order_acquire);
        GraphSnapshot *staging = (current == snapshotA.get()) ? snapshotB.get() : snapshotA.get();

        // Build the new snapshot in the staging slot
        staging->connections = connections;
        staging->outputNodeId = outputNodeId;
        staging->inputNodeId = inputNodeId;
        staging->inputNodeIds = inputNodeIds;

        // Build the node lookup map so the audio thread can find nodes
        // without touching the authoritative `nodes` map (thread safety).
        staging->nodeMap.clear();
        for (auto &[id, node] : nodes)
        {
            if (node)
                staging->nodeMap[id] = node.get();
        }

        buildProcessingOrder(nodes, staging->connections, staging->processingOrder);

        // Atomically publish — the audio thread will pick this up at the
        // start of the next processBlock call.
        activeSnapshot.store(staging, std::memory_order_release);
    }

    void AudioGraph::buildProcessingOrder(
        const std::unordered_map<std::string, std::unique_ptr<AudioNodeBase>> &nodeMap,
        const std::vector<GraphSnapshot::Connection> &conns,
        std::vector<AudioNodeBase *> &outOrder)
    {
        outOrder.clear();

        // Build adjacency info
        std::unordered_map<std::string, int> inDegree;
        std::unordered_map<std::string, std::vector<std::string>> adjacency;

        for (auto &[id, _] : nodeMap)
        {
            inDegree[id] = 0;
        }

        for (auto &conn : conns)
        {
            if (nodeMap.count(conn.toNodeId) && nodeMap.count(conn.fromNodeId))
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

            auto it = nodeMap.find(id);
            if (it != nodeMap.end() && it->second)
            {
                outOrder.push_back(it->second.get());
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
    // Apply pending param updates (audio thread)
    // ---------------------------------------------------------------------------

    void AudioGraph::applyPendingOps()
    {
        // Drain param-only ops from the SPSC queue.
        // Use the snapshot's nodeMap for lookup instead of the authoritative
        // `nodes` map, which is owned by the message thread.
        auto *snapshot = activeSnapshot.load(std::memory_order_acquire);

        GraphOp op;
        while (paramOpQueue.pop(op))
        {
            if (op.type == GraphOp::UpdateParams && snapshot)
            {
                auto it = snapshot->nodeMap.find(op.nodeId);
                if (it != snapshot->nodeMap.end() && it->second)
                {
                    for (auto &[k, v] : op.params)
                    {
                        it->second->setParam(k, v);
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------------------
    // Process (audio thread)
    // ---------------------------------------------------------------------------

    void AudioGraph::processBlock(juce::AudioBuffer<float> &buffer, juce::MidiBuffer &midi)
    {
        hostInputBuffer = &buffer;
        const int numSamples = buffer.getNumSamples();

        // Apply any pending parameter updates (lock-free drain)
        applyPendingOps();

        // Read the latest graph snapshot (atomic load)
        auto *snapshot = activeSnapshot.load(std::memory_order_acquire);
        if (!snapshot || snapshot->processingOrder.empty())
            return;

        // Reset buffer pool
        std::fill(bufferInUse.begin(), bufferInUse.end(), false);

        // Build a map of nodeId -> output BufferRef
        std::unordered_map<std::string, BufferRef> nodeOutputs;

        // The main input node's output is the host buffer itself
        if (!snapshot->inputNodeId.empty())
        {
            nodeOutputs[snapshot->inputNodeId] = {&buffer, -1};
        }

        // Wire up additional input buses (sidechain, etc.)
        for (auto &[busIdx, nodeId] : snapshot->inputNodeIds)
        {
            if (busIdx == 0)
                continue; // already handled above
            auto bufIt = hostInputBuffers.find(busIdx);
            if (bufIt != hostInputBuffers.end() && bufIt->second)
            {
                nodeOutputs[nodeId] = {bufIt->second, -1};
            }
        }

        for (auto *node : snapshot->processingOrder)
        {
            // Skip all input nodes — their output is the host buffer
            bool isInputNode = false;
            for (auto &[busIdx, inId] : snapshot->inputNodeIds)
            {
                if (node->nodeId == inId)
                {
                    isInputNode = true;
                    break;
                }
            }
            if (isInputNode)
                continue;

            // Acquire an output buffer for this node
            int bufIdx = acquireBuffer();
            node->outputBuffer = {&bufferPool[bufIdx], bufIdx};
            nodeOutputs[node->nodeId] = node->outputBuffer;

            // Wire up input buffers from connections
            node->inputBuffers.clear();

            // Find connections to this node, sorted by inlet
            std::vector<std::pair<int, BufferRef>> inputs;
            for (auto &conn : snapshot->connections)
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
        if (!snapshot->outputNodeId.empty())
        {
            auto outIt = nodeOutputs.find(snapshot->outputNodeId);
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
