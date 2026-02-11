#pragma once

#include "nodes/NodeBase.h"
#include "nodes/NodeFactory.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>
#include <mutex>

namespace rau
{

    /**
     * GraphOp — mirrors the JS-side GraphOp type.
     * These are queued from the message thread and applied on the audio thread.
     */
    struct GraphOp
    {
        enum Type
        {
            AddNode,
            RemoveNode,
            UpdateParams,
            Connect,
            Disconnect,
            SetOutput
        };
        Type type;

        std::string nodeId;
        std::string nodeType;
        std::unordered_map<std::string, float> params;

        // Connection info
        std::string fromNodeId;
        int fromOutlet = 0;
        std::string toNodeId;
        int toInlet = 0;
    };

    /**
     * AudioGraph — the real-time DSP node graph.
     *
     * Owns all DSP nodes, manages a topologically-sorted processing order,
     * and provides a lock-free operation queue for graph mutations from
     * the message thread.
     *
     * Thread safety model:
     *  - processBlock() is called on the audio thread
     *  - queueOp() and applyPendingOps() handle cross-thread communication
     *  - Graph mutations happen on the audio thread (inside processBlock)
     *    after draining the operation queue
     */
    class AudioGraph
    {
    public:
        AudioGraph();
        ~AudioGraph();

        // Called from audio thread
        void prepare(double sampleRate, int maxBlockSize, int numChannels);
        void processBlock(juce::AudioBuffer<float> &buffer, juce::MidiBuffer &midi);

        // Called from message thread — queues an operation for the audio thread
        void queueOp(GraphOp op);

        // Called from message thread — direct parameter update (fast path)
        void setNodeParam(const std::string &nodeId, const std::string &param, float value);

    private:
        void applyPendingOps();
        void rebuildProcessingOrder();

        // Node storage
        std::unordered_map<std::string, std::unique_ptr<AudioNodeBase>> nodes;

        // Connections: toNodeId -> list of {fromNodeId, fromOutlet, toInlet}
        struct Connection
        {
            std::string fromNodeId;
            int fromOutlet;
            std::string toNodeId;
            int toInlet;
        };
        std::vector<Connection> connections;

        // Topologically sorted processing order
        std::vector<AudioNodeBase *> processingOrder;

        // Output node
        std::string outputNodeId;

        // Buffer pool (pre-allocated)
        std::vector<juce::AudioBuffer<float>> bufferPool;
        std::vector<bool> bufferInUse;
        int acquireBuffer();
        void releaseBuffer(int index);

        // Operation queue (message thread -> audio thread)
        // Using a simple mutex+vector since ops are applied once per block
        // and the audio thread only tries to lock (non-blocking).
        std::mutex opQueueMutex;
        std::vector<GraphOp> pendingOps;
        std::vector<GraphOp> processingOps; // swapped in on audio thread

        // Audio config
        double currentSampleRate = 44100.0;
        int currentBlockSize = 512;
        int currentNumChannels = 2;

        // Special "input" node that wraps the host buffer
        std::string inputNodeId;
        juce::AudioBuffer<float> *hostInputBuffer = nullptr;
    };

} // namespace rau
