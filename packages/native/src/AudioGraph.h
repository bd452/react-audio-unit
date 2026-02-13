#pragma once

#include "nodes/NodeBase.h"
#include "nodes/NodeFactory.h"
#include "SPSCQueue.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <atomic>
#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

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
     * GraphSnapshot — an immutable snapshot of the graph topology.
     *
     * Built on the message thread, then atomically swapped into the
     * audio thread's active slot. Nodes are shared (owned by the
     * AudioGraph's master map), so only the topology is duplicated.
     */
    struct GraphSnapshot
    {
        struct Connection
        {
            std::string fromNodeId;
            int fromOutlet;
            std::string toNodeId;
            int toInlet;
        };

        std::vector<AudioNodeBase *> processingOrder;
        std::vector<Connection> connections;
        std::string outputNodeId;
        std::string inputNodeId;
        std::unordered_map<int, std::string> inputNodeIds; // bus index → node ID

        // Fast node lookup for the audio thread (raw pointers, no ownership).
        // Populated during rebuildAndPublishSnapshot so the audio thread never
        // touches the authoritative `nodes` map.
        std::unordered_map<std::string, AudioNodeBase *> nodeMap;
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
     *  - queueOp() queues topology changes; the message thread builds a
     *    new GraphSnapshot and publishes it via atomic pointer swap
     *  - setNodeParam() writes directly to atomic params (lock-free fast path)
     *  - UpdateParams ops also go through the SPSC queue for batched updates
     *  - The audio thread reads the latest snapshot at the top of processBlock()
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

        // Batch multiple topology ops, rebuilding the snapshot only once at the end
        void queueOps(std::vector<GraphOp> ops);

        // Called from message thread — direct parameter update (fast path)
        void setNodeParam(const std::string &nodeId, const std::string &param, float value);

        // Set additional host input buffers (for sidechain, etc.)
        void setHostInputBuffer(int busIndex, juce::AudioBuffer<float> *buffer);

        // Access a node by ID (for meter/spectrum readout). Returns nullptr if not found.
        AudioNodeBase *getNode(const std::string &nodeId) const;

        // Get all nodes of a given type (e.g. "meter", "spectrum")
        std::vector<AudioNodeBase *> getNodesByType(const std::string &type) const;

    private:
        void applyTopologyOp(const GraphOp &op);
        void applyPendingOps();
        void rebuildAndPublishSnapshot();
        static void buildProcessingOrder(
            const std::unordered_map<std::string, std::unique_ptr<AudioNodeBase>> &nodeMap,
            const std::vector<GraphSnapshot::Connection> &conns,
            std::vector<AudioNodeBase *> &outOrder);

        // Node storage (shared across snapshots — nodes outlive topology changes)
        std::unordered_map<std::string, std::unique_ptr<AudioNodeBase>> nodes;

        // Authoritative topology (message-thread side)
        std::vector<GraphSnapshot::Connection> connections;
        std::string outputNodeId;
        std::string inputNodeId;

        // Double-buffered snapshots: the audio thread reads from activeSnapshot,
        // the message thread writes to the staging slot and swaps.
        // Using two heap-allocated snapshots and an atomic pointer.
        std::unique_ptr<GraphSnapshot> snapshotA;
        std::unique_ptr<GraphSnapshot> snapshotB;
        std::atomic<GraphSnapshot *> activeSnapshot{nullptr};

        // Buffer pool (pre-allocated)
        std::vector<juce::AudioBuffer<float>> bufferPool;
        std::vector<bool> bufferInUse;
        int acquireBuffer();
        void releaseBuffer(int index);

        // Operation queue (message thread -> audio thread)
        // Only used for UpdateParams ops now; topology changes are handled
        // by snapshot swap.
        SPSCQueue<GraphOp, 1024> paramOpQueue;
        std::vector<GraphOp> processingOps; // drained from SPSC on audio thread

        // Audio config
        double currentSampleRate = 44100.0;
        int currentBlockSize = 512;
        int currentNumChannels = 2;

        juce::AudioBuffer<float> *hostInputBuffer = nullptr;

        // Multi-bus: additional input bus IDs and their host buffers
        // Map from bus index (0 = main, 1 = sidechain, ...) to input node ID
        std::unordered_map<int, std::string> inputNodeIds;
        std::unordered_map<int, juce::AudioBuffer<float> *> hostInputBuffers;
    };

} // namespace rau
