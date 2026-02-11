#include "ParameterStore.h"
#include <cmath>

namespace rau
{

    ParameterStore::ParameterStore(juce::AudioProcessor & /*proc*/) {}

    float ParameterStore::actualToNormalized(const RangeInfo &r, float actual) const
    {
        if (r.max <= r.min)
            return 0.0f;
        float proportion = (actual - r.min) / (r.max - r.min);
        if (r.skew != 1.0f && proportion > 0.0f)
            proportion = std::pow(proportion, 1.0f / r.skew);
        return juce::jlimit(0.0f, 1.0f, proportion);
    }

    float ParameterStore::normalizedToActual(const RangeInfo &r, float normalized) const
    {
        float proportion = juce::jlimit(0.0f, 1.0f, normalized);
        if (r.skew != 1.0f && proportion > 0.0f)
            proportion = std::pow(proportion, r.skew);
        return r.min + proportion * (r.max - r.min);
    }

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
        // These start with a 0–1 range and get their actual range mapped
        // dynamically when JS registers parameters.
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
                                           float defaultValue, const std::string &label,
                                           const std::string &curve)
    {
        if (!apvts || idToSlot.count(id))
            return;

        // Assign the next available slot
        auto slotId = "param_" + juce::String(nextSlot).paddedLeft('0', 3).toStdString();
        idToSlot[id] = slotId;
        slotToId[slotId] = id;

        // Determine skew factor from curve type
        // JUCE NormalisableRange skew: <1 = more resolution at top (log-like),
        //   >1 = more resolution at bottom (exp-like).
        // We flip convention to match user expectations:
        //   "logarithmic" → skew 0.3 (frequency-style, more at bottom)
        //   "exponential" → skew 3.0 (more at top)
        float skew = 1.0f;
        if (curve == "logarithmic")
            skew = 0.3f;
        else if (curve == "exponential")
            skew = 3.0f;

        // Store the range mapping with skew for this parameter
        rangeMap[slotId] = {min, max, skew};

        nextSlot++;

        // Set the normalized default value (applying skew)
        if (auto *param = apvts->getParameter(slotId))
        {
            float normalizedDefault = actualToNormalized(rangeMap[slotId], defaultValue);
            param->setValueNotifyingHost(normalizedDefault);
        }

        // Listen for DAW automation changes on this slot
        apvts->addParameterListener(slotId, this);

        (void)label; // Label used in future UI display
    }

    void ParameterStore::setParameterValue(const std::string &id, float value)
    {
        auto it = idToSlot.find(id);
        if (it == idToSlot.end() || !apvts)
            return;

        if (auto *param = apvts->getParameter(it->second))
        {
            auto rangeIt = rangeMap.find(it->second);
            if (rangeIt != rangeMap.end())
            {
                param->setValueNotifyingHost(actualToNormalized(rangeIt->second, value));
            }
            else
            {
                param->setValueNotifyingHost(juce::jlimit(0.0f, 1.0f, value));
            }
        }
    }

    float ParameterStore::getParameterValue(const std::string &id) const
    {
        auto it = idToSlot.find(id);
        if (it == idToSlot.end() || !apvts)
            return 0.0f;

        if (auto *param = apvts->getParameter(it->second))
        {
            float normalized = param->getValue();
            auto rangeIt = rangeMap.find(it->second);
            if (rangeIt != rangeMap.end())
            {
                return normalizedToActual(rangeIt->second, normalized);
            }
            return normalized;
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
                auto rangeIt = rangeMap.find(parameterID.toStdString());
                float actualValue = newValue;
                if (rangeIt != rangeMap.end())
                {
                    actualValue = normalizedToActual(rangeIt->second, newValue);
                }
                changeCallback(it->second, actualValue);
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
        // Parse simple JSON object { "key": value, ... }
        // Use JUCE's JSON parser for robustness
        auto parsed = juce::JSON::parse(juce::String(json));
        if (parsed.isVoid())
            return;

        if (auto *obj = parsed.getDynamicObject())
        {
            for (auto &prop : obj->getProperties())
            {
                auto id = prop.name.toString().toStdString();
                float value = static_cast<float>(prop.value);
                setParameterValue(id, value);
            }
        }
    }

} // namespace rau
