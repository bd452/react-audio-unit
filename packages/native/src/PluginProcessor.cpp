#include "PluginProcessor.h"
#include "PluginEditor.h"
#include <juce_core/juce_core.h>

namespace rau
{

    // ---------------------------------------------------------------------------
    // String-to-enum conversion tables for typed parameters
    // ---------------------------------------------------------------------------

    static float stringParamToFloat(const juce::String &paramName, const juce::String &value)
    {
        // Filter types
        if (paramName == "filterType")
        {
            if (value == "lowpass")
                return 0.0f;
            if (value == "highpass")
                return 1.0f;
            if (value == "bandpass")
                return 2.0f;
            if (value == "notch")
                return 3.0f;
            if (value == "allpass")
                return 4.0f;
            if (value == "lowshelf")
                return 5.0f;
            if (value == "highshelf")
                return 6.0f;
            if (value == "peaking")
                return 7.0f;
            return 0.0f;
        }

        // Oscillator waveforms
        if (paramName == "waveform")
        {
            if (value == "sine")
                return 0.0f;
            if (value == "saw")
                return 1.0f;
            if (value == "square")
                return 2.0f;
            if (value == "triangle")
                return 3.0f;
            return 0.0f;
        }

        // Distortion types
        if (paramName == "distortionType")
        {
            if (value == "soft")
                return 0.0f;
            if (value == "hard")
                return 1.0f;
            if (value == "tanh")
                return 2.0f;
            if (value == "atan")
                return 3.0f;
            if (value == "foldback")
                return 4.0f;
            return 0.0f;
        }

        // Pan law
        if (paramName == "law")
        {
            if (value == "linear")
                return 0.0f;
            if (value == "equalPower")
                return 1.0f;
            return 0.0f;
        }

        // LFO shape
        if (paramName == "shape")
        {
            if (value == "sine")
                return 0.0f;
            if (value == "triangle")
                return 1.0f;
            if (value == "saw")
                return 2.0f;
            if (value == "square")
                return 3.0f;
            if (value == "random")
                return 4.0f;
            return 0.0f;
        }

        // Meter type
        if (paramName == "meterType")
        {
            if (value == "peak")
                return 0.0f;
            if (value == "rms")
                return 1.0f;
            if (value == "both")
                return 2.0f;
            return 0.0f;
        }

        // Unknown string param — try to parse as number, fallback to 0
        return value.getFloatValue();
    }

    /**
     * Convert a juce::var property value to float, handling string enums.
     */
    static float varToFloat(const juce::Identifier &paramName, const juce::var &value)
    {
        if (value.isString())
        {
            return stringParamToFloat(paramName.toString(), value.toString());
        }
        return static_cast<float>(value);
    }

    // ---------------------------------------------------------------------------
    // Constructor / Destructor
    // ---------------------------------------------------------------------------

    PluginProcessor::PluginProcessor()
        : AudioProcessor(BusesProperties()
                             .withInput("Input", juce::AudioChannelSet::stereo(), true)
                             .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
          paramStore(*this),
          apvts(*this, nullptr, "Parameters", ParameterStore::createLayout())
    {
        paramStore.bindAPVTS(apvts);

        // When the DAW changes a parameter, notify JS
        paramStore.onParameterChanged([this](const std::string &id, float value)
                                      {
        juce::String json = "{\"type\":\"parameterChanged\",\"id\":\"" +
                            juce::String(id) + "\",\"value\":" +
                            juce::String(value) + "}";
        webViewBridge.sendToJS(json); });

        // Listen for messages from JS (via the native function registered in createWebViewOptions)
        webViewBridge.onMessageFromJS([this](const juce::String &json)
                                      { handleJSMessage(json); });
    }

    PluginProcessor::~PluginProcessor() = default;

    // ---------------------------------------------------------------------------
    // Audio lifecycle
    // ---------------------------------------------------------------------------

    void PluginProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
    {
        audioGraph.prepare(sampleRate, samplesPerBlock, getTotalNumOutputChannels());

        // Notify JS of audio config
        webViewBridge.sendToJS("{\"type\":\"sampleRate\",\"value\":" +
                               juce::String(sampleRate) + "}");
        webViewBridge.sendToJS("{\"type\":\"blockSize\",\"value\":" +
                               juce::String(samplesPerBlock) + "}");
    }

    void PluginProcessor::releaseResources()
    {
        // Nothing to do — buffers are owned by AudioGraph
    }

    void PluginProcessor::processBlock(juce::AudioBuffer<float> &buffer, juce::MidiBuffer &midi)
    {
        juce::ScopedNoDenormals noDenormals;

        // Clear any unused output channels
        for (auto i = getTotalNumInputChannels(); i < getTotalNumOutputChannels(); ++i)
            buffer.clear(i, 0, buffer.getNumSamples());

        // Send transport info to JS (throttled by the bridge timer)
        if (auto *playHead = getPlayHead())
        {
            auto position = playHead->getPosition();
            if (position.hasValue())
            {
                double bpm = 120.0;
                if (auto b = position->getBpm())
                    bpm = *b;

                int timeSigNum = 4, timeSigDen = 4;
                if (auto ts = position->getTimeSignature())
                {
                    timeSigNum = ts->numerator;
                    timeSigDen = ts->denominator;
                }

                bool playing = position->getIsPlaying();

                juce::int64 positionSamples = 0;
                if (auto s = position->getTimeInSamples())
                    positionSamples = *s;

                juce::String transportJson =
                    "{\"type\":\"transport\""
                    ",\"playing\":" +
                    juce::String(playing ? "true" : "false") +
                    ",\"bpm\":" + juce::String(bpm) +
                    ",\"positionSamples\":" + juce::String(positionSamples) +
                    ",\"timeSigNum\":" + juce::String(timeSigNum) +
                    ",\"timeSigDen\":" + juce::String(timeSigDen) + "}";
                webViewBridge.sendToJS(transportJson);
            }
        }

        // Process the audio graph
        audioGraph.processBlock(buffer, midi);
    }

    // ---------------------------------------------------------------------------
    // Editor
    // ---------------------------------------------------------------------------

    juce::AudioProcessorEditor *PluginProcessor::createEditor()
    {
        return new PluginEditor(*this);
    }

    // ---------------------------------------------------------------------------
    // State save/recall
    // ---------------------------------------------------------------------------

    void PluginProcessor::getStateInformation(juce::MemoryBlock &destData)
    {
        // Save both APVTS state and JS-side parameter state
        auto state = apvts.copyState();

        // Attach the JS parameter state as a child element
        auto jsState = paramStore.getStateAsJson();
        state.setProperty("rau_js_state", juce::String(jsState), nullptr);

        std::unique_ptr<juce::XmlElement> xml(state.createXml());
        if (xml)
        {
            copyXmlToBinary(*xml, destData);
        }
    }

    void PluginProcessor::setStateInformation(const void *data, int sizeInBytes)
    {
        auto xml = getXmlFromBinary(data, sizeInBytes);
        if (xml && xml->hasTagName(apvts.state.getType()))
        {
            auto newState = juce::ValueTree::fromXml(*xml);

            // Restore JS-side state if present
            auto jsStateStr = newState.getProperty("rau_js_state", "").toString();
            if (jsStateStr.isNotEmpty())
            {
                // Send restoreState message to JS so it can rebuild its state
                webViewBridge.sendToJS("{\"type\":\"restoreState\",\"state\":" +
                                       jsStateStr.quoted() + "}");
                // Also restore native-side parameter values
                paramStore.restoreStateFromJson(jsStateStr.toStdString());
            }

            apvts.replaceState(newState);
        }
    }

    // ---------------------------------------------------------------------------
    // JS message handling
    // ---------------------------------------------------------------------------

    void PluginProcessor::handleJSMessage(const juce::String &json)
    {
        // Parse JSON — using JUCE's JSON parser
        auto parsed = juce::JSON::parse(json);
        if (parsed.isVoid())
            return;

        auto type = parsed.getProperty("type", "").toString();

        if (type == "graphOps")
        {
            // Array of graph operations
            auto ops = parsed.getProperty("ops", juce::var());
            if (auto *opsArray = ops.getArray())
            {
                for (auto &opVar : *opsArray)
                {
                    GraphOp graphOp;
                    auto opType = opVar.getProperty("op", "").toString();

                    if (opType == "addNode")
                    {
                        graphOp.type = GraphOp::AddNode;
                        graphOp.nodeId = opVar.getProperty("nodeId", "").toString().toStdString();
                        graphOp.nodeType = opVar.getProperty("nodeType", "").toString().toStdString();

                        if (auto *params = opVar.getProperty("params", juce::var()).getDynamicObject())
                        {
                            for (auto &prop : params->getProperties())
                            {
                                graphOp.params[prop.name.toString().toStdString()] =
                                    varToFloat(prop.name, prop.value);
                            }
                        }
                    }
                    else if (opType == "removeNode")
                    {
                        graphOp.type = GraphOp::RemoveNode;
                        graphOp.nodeId = opVar.getProperty("nodeId", "").toString().toStdString();
                    }
                    else if (opType == "updateParams")
                    {
                        graphOp.type = GraphOp::UpdateParams;
                        graphOp.nodeId = opVar.getProperty("nodeId", "").toString().toStdString();

                        if (auto *params = opVar.getProperty("params", juce::var()).getDynamicObject())
                        {
                            for (auto &prop : params->getProperties())
                            {
                                graphOp.params[prop.name.toString().toStdString()] =
                                    varToFloat(prop.name, prop.value);
                            }
                        }
                    }
                    else if (opType == "connect")
                    {
                        graphOp.type = GraphOp::Connect;
                        auto from = opVar.getProperty("from", juce::var());
                        auto to = opVar.getProperty("to", juce::var());
                        graphOp.fromNodeId = from.getProperty("nodeId", "").toString().toStdString();
                        graphOp.fromOutlet = from.getProperty("outlet", 0);
                        graphOp.toNodeId = to.getProperty("nodeId", "").toString().toStdString();
                        graphOp.toInlet = to.getProperty("inlet", 0);
                    }
                    else if (opType == "disconnect")
                    {
                        graphOp.type = GraphOp::Disconnect;
                        auto from = opVar.getProperty("from", juce::var());
                        auto to = opVar.getProperty("to", juce::var());
                        graphOp.fromNodeId = from.getProperty("nodeId", "").toString().toStdString();
                        graphOp.fromOutlet = from.getProperty("outlet", 0);
                        graphOp.toNodeId = to.getProperty("nodeId", "").toString().toStdString();
                        graphOp.toInlet = to.getProperty("inlet", 0);
                    }
                    else if (opType == "setOutput")
                    {
                        graphOp.type = GraphOp::SetOutput;
                        graphOp.nodeId = opVar.getProperty("nodeId", "").toString().toStdString();
                    }
                    else
                    {
                        continue;
                    }

                    audioGraph.queueOp(std::move(graphOp));
                }
            }
        }
        else if (type == "paramUpdate")
        {
            // Fast-path: direct atomic parameter update on a node
            auto nodeId = parsed.getProperty("nodeId", "").toString().toStdString();
            auto paramName = parsed.getProperty("paramName", "").toString().toStdString();
            float value = parsed.getProperty("value", 0.0f);
            audioGraph.setNodeParam(nodeId, paramName, value);
        }
        else if (type == "registerParameter")
        {
            auto id = parsed.getProperty("id", "").toString().toStdString();
            auto config = parsed.getProperty("config", juce::var());
            float min = config.getProperty("min", 0.0f);
            float max = config.getProperty("max", 1.0f);
            float def = config.getProperty("default", 0.0f);
            auto label = config.getProperty("label", "").toString().toStdString();
            paramStore.registerParameter(id, min, max, def, label);
        }
        else if (type == "setParameterValue")
        {
            auto id = parsed.getProperty("id", "").toString().toStdString();
            float value = parsed.getProperty("value", 0.0f);
            paramStore.setParameterValue(id, value);
        }
        else if (type == "setState")
        {
            // JS responding with state for save — store for next getStateInformation
            jsStateCache = parsed.getProperty("state", "").toString().toStdString();
        }
    }

} // namespace rau

// ---------------------------------------------------------------------------
// JUCE plugin entry point
// ---------------------------------------------------------------------------

juce::AudioProcessor *JUCE_CALLTYPE createPluginFilter()
{
    return new rau::PluginProcessor();
}
