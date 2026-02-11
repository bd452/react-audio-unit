#include "ParameterStore.h"

namespace rau
{

    ParameterStore::ParameterStore(juce::AudioProcessor &proc)
        : processor(proc) {}

    ParameterStore::~ParameterStore()
    {
        if (apvts)
        {
            for (auto &[jsId, slotId] : idToSlot)
            {
                apvts->removeParameterListener(slotId, this);
            }
        }
    }

    juce::AudioProcessorValueTreeState::ParameterLayout ParameterStore::createLayout(int maxParams)
    {
        juce::AudioProcessorValueTreeState::ParameterLayout layout;

        // Pre-allocate generic parameter slots (param_000, param_001, ...)
        for (int i = 0; i < maxParams; ++i)
        {
            auto slotId = juce::String("param_") + juce::String(i).paddedLeft('0', 3);
            layout.add(std::make_unique<juce::AudioParameterFloat>(
                juce::ParameterID(slotId, 1),
                slotId, // name (updated dynamically)
                juce::NormalisableRange<float>(0.0f, 1.0f),
                0.0f));
        }

        return layout;
    }

    void ParameterStore::bindAPVTS(juce::AudioProcessorValueTreeState &vts)
    {
        apvts = &vts;
    }

    void ParameterStore::registerParameter(const std::string &id, float min, float max,
                                           float defaultValue, const std::string &label)
    {
        if (!apvts || idToSlot.count(id))
            return;

        // Assign the next available slot
        auto slotId = "param_" + juce::String(nextSlot).paddedLeft('0', 3).toStdString();
        idToSlot[id] = slotId;
        slotToId[slotId] = id;
        nextSlot++;

        // Update the slot's range and default
        if (auto *param = apvts->getParameter(slotId))
        {
            // JUCE parameters store normalized values (0-1), we map accordingly
            auto *rangedParam = dynamic_cast<juce::RangedAudioParameter *>(param);
            if (rangedParam)
            {
                // Set the normalized default value
                float normalizedDefault = (defaultValue - min) / (max - min);
                rangedParam->setValueNotifyingHost(normalizedDefault);
            }
        }

        // Listen for DAW automation changes on this slot
        apvts->addParameterListener(slotId, this);
    }

    void ParameterStore::setParameterValue(const std::string &id, float value)
    {
        auto it = idToSlot.find(id);
        if (it == idToSlot.end() || !apvts)
            return;

        if (auto *param = apvts->getParameter(it->second))
        {
            // Convert to normalized 0-1 range
            // Note: for simplicity, we assume the JS side sends the actual value
            // and the bridge handles normalization
            param->setValueNotifyingHost(param->convertTo0to1(value));
        }
    }

    float ParameterStore::getParameterValue(const std::string &id) const
    {
        auto it = idToSlot.find(id);
        if (it == idToSlot.end() || !apvts)
            return 0.0f;

        if (auto *param = apvts->getParameter(it->second))
        {
            return param->convertFrom0to1(param->getValue());
        }
        return 0.0f;
    }

    void ParameterStore::onParameterChanged(std::function<void(const std::string &, float)> callback)
    {
        changeCallback = std::move(callback);
    }

    void ParameterStore::parameterChanged(const juce::String &parameterID, float newValue)
    {
        if (changeCallback)
        {
            auto it = slotToId.find(parameterID.toStdString());
            if (it != slotToId.end())
            {
                changeCallback(it->second, newValue);
            }
        }
    }

    std::string ParameterStore::getStateAsJson() const
    {
        // Simple JSON serialization of all registered parameters
        std::string json = "{";
        bool first = true;
        for (auto &[jsId, slotId] : idToSlot)
        {
            if (!first)
                json += ",";
            first = false;
            json += "\"" + jsId + "\":" + std::to_string(getParameterValue(jsId));
        }
        json += "}";
        return json;
    }

    void ParameterStore::restoreStateFromJson(const std::string &json)
    {
        // Simple JSON parsing — in production, use a proper JSON library
        // For now, we rely on the JS side to parse and send individual updates
        (void)json;
    }

} // namespace rau
