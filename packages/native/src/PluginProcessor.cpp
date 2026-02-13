#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "nodes/MeterNode.h"
#include "nodes/SpectrumNode.h"
#include <juce_core/juce_core.h>
#include <vector>

namespace rau
{

    // ---------------------------------------------------------------------------
    // Compile-time config defaults
    // ---------------------------------------------------------------------------

#ifndef RAU_MAIN_LAYOUTS
#define RAU_MAIN_LAYOUTS "stereo>stereo"
#endif

#ifndef RAU_MAIN_INPUT_DEFAULT
#define RAU_MAIN_INPUT_DEFAULT "stereo"
#endif

#ifndef RAU_MAIN_OUTPUT_DEFAULT
#define RAU_MAIN_OUTPUT_DEFAULT "stereo"
#endif

#ifndef RAU_SIDECHAIN_LAYOUTS
#define RAU_SIDECHAIN_LAYOUTS "disabled|mono|stereo"
#endif

#ifndef RAU_SIDECHAIN_OPTIONAL
#define RAU_SIDECHAIN_OPTIONAL "ON"
#endif

    struct LayoutSpec
    {
        juce::String token;
        int channels = 0;
    };

    struct MainLayoutPair
    {
        LayoutSpec input;
        LayoutSpec output;
    };

    static juce::String canonicaliseLayoutToken(juce::String token)
    {
        token = token.trim().toLowerCase();
        if (token == "1.0")
            return "mono";
        if (token == "2.0")
            return "stereo";
        if (token == "3.0")
            return "lcr";
        if (token == "atmos")
            return "7.1.2";
        if (token == "atmos-7.1.2")
            return "7.1.2";
        if (token == "atmos-7.1.4")
            return "7.1.4";
        if (token == "atmos-9.1.6")
            return "9.1.6";
        return token;
    }

    static int channelCountForLayoutToken(const juce::String &token)
    {
        if (token == "disabled")
            return 0;
        if (token == "mono")
            return 1;
        if (token == "stereo")
            return 2;
        if (token == "lcr")
            return 3;
        if (token == "2.1")
            return 3;
        if (token == "quad" || token == "4.0")
            return 4;
        if (token == "4.1")
            return 5;
        if (token == "5.0")
            return 5;
        if (token == "5.1")
            return 6;
        if (token == "6.0")
            return 6;
        if (token == "6.1")
            return 7;
        if (token == "7.0")
            return 7;
        if (token == "7.1")
            return 8;
        if (token == "7.1.2")
            return 10;
        if (token == "7.1.4")
            return 12;
        if (token == "9.1.6")
            return 16;
        return -1;
    }

    static LayoutSpec parseLayoutSpec(const juce::String &rawLayout)
    {
        const auto token = canonicaliseLayoutToken(rawLayout);
        if (token.startsWith("discrete:"))
        {
            const int count = token.fromFirstOccurrenceOf("discrete:", false, false).getIntValue();
            if (count > 0)
                return {juce::String("discrete:") + juce::String(count), count};
            return {"stereo", 2};
        }

        const int channels = channelCountForLayoutToken(token);
        if (channels >= 0)
            return {token, channels};

        return {"stereo", 2};
    }

    static juce::AudioChannelSet toChannelSet(const LayoutSpec &layout)
    {
        if (layout.channels <= 0 || layout.token == "disabled")
            return juce::AudioChannelSet::disabled();

        if (layout.token == "mono")
            return juce::AudioChannelSet::mono();
        if (layout.token == "stereo")
            return juce::AudioChannelSet::stereo();
        if (layout.token == "lcr")
            return juce::AudioChannelSet::createLCR();
        if (layout.token == "quad" || layout.token == "4.0")
            return juce::AudioChannelSet::quadraphonic();
        if (layout.token == "5.0")
            return juce::AudioChannelSet::create5point0();
        if (layout.token == "5.1")
            return juce::AudioChannelSet::create5point1();
        if (layout.token == "6.0")
            return juce::AudioChannelSet::create6point0();
        if (layout.token == "6.1")
            return juce::AudioChannelSet::create6point1();
        if (layout.token == "7.0")
            return juce::AudioChannelSet::create7point0();
        if (layout.token == "7.1")
            return juce::AudioChannelSet::create7point1();

        // Layouts without JUCE canonical helpers (e.g. 2.1, 4.1, Atmos variants)
        // are treated as discrete channels.
        return juce::AudioChannelSet::discreteChannels(layout.channels);
    }

    static juce::StringArray splitPipeList(const juce::String &list)
    {
        juce::StringArray out;
        out.addTokens(list, "|", "");
        out.trim();
        out.removeEmptyStrings();
        return out;
    }

    static std::vector<MainLayoutPair> parseMainLayoutPairs(const juce::String &layoutPairs)
    {
        std::vector<MainLayoutPair> pairs;
        for (const auto &entry : splitPipeList(layoutPairs))
        {
            const int sep = entry.indexOfChar('>');
            if (sep < 0)
                continue;

            const auto inLayout = entry.substring(0, sep).trim();
            const auto outLayout = entry.substring(sep + 1).trim();
            if (inLayout.isEmpty() || outLayout.isEmpty())
                continue;

            pairs.push_back({parseLayoutSpec(inLayout), parseLayoutSpec(outLayout)});
        }

        if (pairs.empty())
        {
            pairs.push_back({parseLayoutSpec("stereo"), parseLayoutSpec("stereo")});
        }

        return pairs;
    }

    static std::vector<LayoutSpec> parseLayoutList(const juce::String &layoutList)
    {
        std::vector<LayoutSpec> layouts;
        for (const auto &entry : splitPipeList(layoutList))
        {
            layouts.push_back(parseLayoutSpec(entry));
        }

        if (layouts.empty())
            layouts.push_back(parseLayoutSpec("disabled"));
        return layouts;
    }

    static bool parseBoolString(const juce::String &raw)
    {
        const auto value = raw.trim().toLowerCase();
        return value == "1" || value == "true" || value == "yes" || value == "on";
    }

    static const std::vector<MainLayoutPair> &mainLayoutPairs()
    {
        static const auto pairs = parseMainLayoutPairs(RAU_MAIN_LAYOUTS);
        return pairs;
    }

    static const std::vector<LayoutSpec> &sidechainLayouts()
    {
        static const auto layouts = parseLayoutList(RAU_SIDECHAIN_LAYOUTS);
        return layouts;
    }

    static const LayoutSpec &defaultMainInputLayout()
    {
        static const auto layout = parseLayoutSpec(RAU_MAIN_INPUT_DEFAULT);
        return layout;
    }

    static const LayoutSpec &defaultMainOutputLayout()
    {
        static const auto layout = parseLayoutSpec(RAU_MAIN_OUTPUT_DEFAULT);
        return layout;
    }

    static const LayoutSpec &defaultSidechainLayout()
    {
        static const auto layout = []() -> LayoutSpec
        {
            for (const auto &spec : sidechainLayouts())
            {
                if (spec.channels > 0)
                    return spec;
            }
            return parseLayoutSpec("disabled");
        }();
        return layout;
    }

    static bool sidechainIsOptional()
    {
        static const bool optional = parseBoolString(RAU_SIDECHAIN_OPTIONAL);
        return optional;
    }

    static bool isDisabledLayout(const LayoutSpec &layout)
    {
        return layout.channels == 0 || layout.token == "disabled";
    }

    static bool matchesLayout(const juce::AudioChannelSet &actual, const LayoutSpec &expected)
    {
        if (isDisabledLayout(expected))
            return actual.isDisabled();
        if (actual.isDisabled())
            return false;
        if (actual.size() != expected.channels)
            return false;

        // Prefer exact set matching for canonical JUCE layouts. For unsupported
        // channel maps we gracefully fall back to channel-count matching.
        auto expectedSet = toChannelSet(expected);
        return expectedSet == actual || expectedSet.size() == actual.size();
    }

    static LayoutSpec describeChannelSet(const juce::AudioChannelSet &set)
    {
        if (set.isDisabled())
            return {"disabled", 0};
        if (set == juce::AudioChannelSet::mono())
            return {"mono", 1};
        if (set == juce::AudioChannelSet::stereo())
            return {"stereo", 2};
        if (set == juce::AudioChannelSet::createLCR())
            return {"lcr", 3};
        if (set == juce::AudioChannelSet::quadraphonic())
            return {"quad", 4};
        if (set == juce::AudioChannelSet::create5point0())
            return {"5.0", 5};
        if (set == juce::AudioChannelSet::create5point1())
            return {"5.1", 6};
        if (set == juce::AudioChannelSet::create6point0())
            return {"6.0", 6};
        if (set == juce::AudioChannelSet::create6point1())
            return {"6.1", 7};
        if (set == juce::AudioChannelSet::create7point0())
            return {"7.0", 7};
        if (set == juce::AudioChannelSet::create7point1())
            return {"7.1", 8};

        const int channels = set.size();
        if (channels == 10)
            return {"7.1.2", channels};
        if (channels == 12)
            return {"7.1.4", channels};
        if (channels == 16)
            return {"9.1.6", channels};
        if (channels == 3)
            return {"2.1", channels};
        if (channels == 5)
            return {"4.1", channels};
        return {juce::String("discrete:") + juce::String(channels), channels};
    }

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
                             .withInput("Input",
                                        toChannelSet(defaultMainInputLayout()),
                                        !isDisabledLayout(defaultMainInputLayout()))
                             .withInput("Sidechain",
                                        toChannelSet(defaultSidechainLayout()),
                                        !sidechainIsOptional())
                             .withOutput("Output",
                                         toChannelSet(defaultMainOutputLayout()),
                                         true)),
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

        // Listen for messages from JS (via the event listener registered in createWebViewOptions)
        webViewBridge.onMessageFromJS([this](const juce::String &json)
                                      { handleJSMessage(json); });
    }

    PluginProcessor::~PluginProcessor()
    {
        analysisTimer.stopTimer();
    }

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
        sendAudioLayoutInfo();

        // Start analysis data timer (~30 fps)
        analysisTimer.startTimerHz(30);
    }

    void PluginProcessor::numChannelsChanged()
    {
        sendAudioLayoutInfo();
    }

    bool PluginProcessor::isBusesLayoutSupported(const BusesLayout &layouts) const
    {
        auto mainIn = layouts.getMainInputChannelSet();
        auto mainOut = layouts.getMainOutputChannelSet();

        bool mainSupported = false;
        for (const auto &layoutPair : mainLayoutPairs())
        {
            if (matchesLayout(mainIn, layoutPair.input) &&
                matchesLayout(mainOut, layoutPair.output))
            {
                mainSupported = true;
                break;
            }
        }
        if (!mainSupported)
            return false;

        // Sidechain (bus index 1) can be optional or required depending on config.
        if (layouts.inputBuses.size() > 1)
        {
            auto sc = layouts.inputBuses[1];

            if (sc.isDisabled())
            {
                if (!sidechainIsOptional())
                    return false;
            }
            else
            {
                bool sidechainSupported = false;
                for (const auto &supported : sidechainLayouts())
                {
                    if (isDisabledLayout(supported))
                        continue;
                    if (matchesLayout(sc, supported))
                    {
                        sidechainSupported = true;
                        break;
                    }
                }
                if (!sidechainSupported)
                    return false;
            }
        }

        return true;
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

        // Forward MIDI events to JS
        if (!midi.isEmpty())
        {
            juce::String midiJson = "{\"type\":\"midi\",\"events\":[";
            bool first = true;
            for (const auto metadata : midi)
            {
                const auto msg = metadata.getMessage();
                if (!first)
                    midiJson += ",";
                first = false;

                if (msg.isNoteOn())
                {
                    midiJson += "{\"type\":\"noteOn\",\"channel\":" +
                                juce::String(msg.getChannel()) +
                                ",\"note\":" + juce::String(msg.getNoteNumber()) +
                                ",\"velocity\":" + juce::String(msg.getFloatVelocity()) + "}";
                }
                else if (msg.isNoteOff())
                {
                    midiJson += "{\"type\":\"noteOff\",\"channel\":" +
                                juce::String(msg.getChannel()) +
                                ",\"note\":" + juce::String(msg.getNoteNumber()) +
                                ",\"velocity\":" + juce::String(msg.getFloatVelocity()) + "}";
                }
                else if (msg.isController())
                {
                    midiJson += "{\"type\":\"cc\",\"channel\":" +
                                juce::String(msg.getChannel()) +
                                ",\"cc\":" + juce::String(msg.getControllerNumber()) +
                                ",\"value\":" + juce::String(msg.getControllerValue()) + "}";
                }
                else if (msg.isPitchWheel())
                {
                    midiJson += "{\"type\":\"pitchBend\",\"channel\":" +
                                juce::String(msg.getChannel()) +
                                ",\"value\":" + juce::String(msg.getPitchWheelValue()) + "}";
                }
            }
            midiJson += "]}";
            webViewBridge.sendToJS(midiJson);
        }

        // Pass sidechain bus buffer to the graph (bus index 1)
        auto sidechainBus = getBus(true, 1);
        if (sidechainBus && sidechainBus->isEnabled())
        {
            auto scBuffer = getBusBuffer(buffer, true, 1);
            audioGraph.setHostInputBuffer(1, &scBuffer);
        }
        else
        {
            audioGraph.setHostInputBuffer(1, nullptr);
        }

        // Process the audio graph using only the main bus buffer.
        // getBusBuffer returns a lightweight alias into `buffer` covering
        // only the main bus channels, so sidechain channels are not
        // accidentally treated as main I/O.
        auto mainBuffer = getBusBuffer(buffer, true, 0);
        audioGraph.processBlock(mainBuffer, midi);
    }

    void PluginProcessor::sendAudioLayoutInfo()
    {
        auto layouts = getBusesLayout();
        const auto mainIn = describeChannelSet(layouts.getMainInputChannelSet());
        const auto mainOut = describeChannelSet(layouts.getMainOutputChannelSet());

        juce::String json = "{\"type\":\"audioLayout\""
                            ",\"mainInput\":{\"layout\":\"" +
                            mainIn.token + "\",\"channels\":" + juce::String(mainIn.channels) + "}"
                            ",\"mainOutput\":{\"layout\":\"" +
                            mainOut.token + "\",\"channels\":" + juce::String(mainOut.channels) + "}";

        if (layouts.inputBuses.size() > 1)
        {
            const auto sidechain = describeChannelSet(layouts.inputBuses[1]);
            json += ",\"sidechainInput\":{\"layout\":\"" +
                    sidechain.token + "\",\"channels\":" + juce::String(sidechain.channels) + "}";
        }

        json += "}";
        webViewBridge.sendToJS(json);
    }

    // ---------------------------------------------------------------------------
    // Analysis data forwarding (meter / spectrum → JS)
    // ---------------------------------------------------------------------------

    void PluginProcessor::sendAnalysisData()
    {
        // Forward meter data
        auto meterNodes = audioGraph.getNodesByType("meter");
        for (auto *node : meterNodes)
        {
            auto *meter = dynamic_cast<MeterNode *>(node);
            if (!meter)
                continue;

            float peakL = meter->getPeak(0);
            float peakR = meter->getPeak(1);
            float rmsL = meter->getRms(0);
            float rmsR = meter->getRms(1);

            juce::String json = "{\"type\":\"meterData\",\"nodeId\":\"" +
                                juce::String(meter->nodeId) +
                                "\",\"peak\":[" + juce::String(peakL) + "," + juce::String(peakR) +
                                "],\"rms\":[" + juce::String(rmsL) + "," + juce::String(rmsR) + "]}";
            webViewBridge.sendToJS(json);
        }

        // Forward spectrum data
        auto spectrumNodes = audioGraph.getNodesByType("spectrum");
        for (auto *node : spectrumNodes)
        {
            auto *spectrum = dynamic_cast<SpectrumNode *>(node);
            if (!spectrum)
                continue;

            auto magnitudes = spectrum->getMagnitudes();
            if (magnitudes.empty())
                continue;

            // Downsample to ~128 bins for the bridge
            constexpr int MAX_BINS = 128;
            int step = std::max(1, static_cast<int>(magnitudes.size()) / MAX_BINS);

            juce::String json = "{\"type\":\"spectrumData\",\"nodeId\":\"" +
                                juce::String(spectrum->nodeId) + "\",\"magnitudes\":[";
            bool first = true;
            for (int i = 0; i < static_cast<int>(magnitudes.size()); i += step)
            {
                if (!first)
                    json += ",";
                first = false;
                json += juce::String(magnitudes[i], 4);
            }
            json += "]}";
            webViewBridge.sendToJS(json);
        }
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
            // Array of graph operations — batched so the snapshot is rebuilt
            // only once after all ops are applied (avoids intermediate states).
            auto ops = parsed.getProperty("ops", juce::var());
            if (auto *opsArray = ops.getArray())
            {
                std::vector<GraphOp> batch;
                batch.reserve(static_cast<size_t>(opsArray->size()));

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

                    batch.push_back(std::move(graphOp));
                }

                audioGraph.queueOps(std::move(batch));
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
            auto curve = config.getProperty("curve", "linear").toString().toStdString();
            paramStore.registerParameter(id, min, max, def, label, curve);
        }
        else if (type == "unregisterParameter")
        {
            auto id = parsed.getProperty("id", "").toString().toStdString();
            paramStore.unregisterParameter(id);
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
