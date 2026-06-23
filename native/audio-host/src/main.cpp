#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_core/juce_core.h>

#include <atomic>
#include <iostream>
#include <mutex>
#include <thread>

namespace
{
std::atomic<bool> g_running { true };
std::mutex g_stdoutMutex;
juce::AudioDeviceManager g_deviceManager;

juce::String writeResponse (const juce::var& id, const juce::var& result)
{
    juce::DynamicObject::Ptr obj = new juce::DynamicObject();
    obj->setProperty ("id", id);
    obj->setProperty ("result", result);
    return juce::JSON::toString (juce::var (obj.get())) + "\n";
}

juce::String writeError (const juce::var& id, int code, const juce::String& message)
{
    juce::DynamicObject::Ptr err = new juce::DynamicObject();
    err->setProperty ("code", code);
    err->setProperty ("message", message);

    juce::DynamicObject::Ptr obj = new juce::DynamicObject();
    obj->setProperty ("id", id);
    obj->setProperty ("error", juce::var (err.get()));
    return juce::JSON::toString (juce::var (obj.get())) + "\n";
}

void emitLine (const juce::String& line)
{
    const std::lock_guard<std::mutex> lock (g_stdoutMutex);
    std::cout << line.toStdString();
    std::cout.flush();
}

juce::Array<juce::var> collectDevices (bool inputs)
{
    juce::Array<juce::var> devices;
    juce::OwnedArray<juce::AudioIODeviceType> types;
    g_deviceManager.createAudioDeviceTypes (types);

    for (auto* type : types)
    {
        type->scanForDevices();
        const auto names = type->getDeviceNames (inputs);

        for (const auto& name : names)
        {
            juce::DynamicObject::Ptr device = new juce::DynamicObject();
            device->setProperty ("name", name);
            device->setProperty ("type", type->getTypeName());
            device->setProperty ("direction", inputs ? "input" : "output");
            devices.add (juce::var (device.get()));
        }
    }

    return devices;
}

juce::String handleRequest (const juce::var& request)
{
    const auto id = request.getProperty ("id", juce::var());
    const auto method = request.getProperty ("method", juce::var()).toString();
    const auto params = request.getProperty ("params", juce::var());

    if (method == "ping")
    {
        juce::DynamicObject::Ptr result = new juce::DynamicObject();
        result->setProperty ("ok", true);
        result->setProperty ("version", "0.1.0");
        return writeResponse (id, juce::var (result.get()));
    }

    if (method == "shutdown")
    {
        juce::DynamicObject::Ptr result = new juce::DynamicObject();
        result->setProperty ("ok", true);
        g_running = false;
        juce::MessageManager::callAsync ([]
        {
            juce::JUCEApplicationBase::quit();
        });
        return writeResponse (id, juce::var (result.get()));
    }

    if (method == "get_devices")
    {
        juce::DynamicObject::Ptr result = new juce::DynamicObject();
        result->setProperty ("inputs", collectDevices (true));
        result->setProperty ("outputs", collectDevices (false));

        if (auto* current = g_deviceManager.getCurrentAudioDevice())
        {
            juce::DynamicObject::Ptr active = new juce::DynamicObject();
            active->setProperty ("name", current->getName());
            active->setProperty ("sampleRate", current->getCurrentSampleRate());
            active->setProperty ("bufferSize", current->getCurrentBufferSizeSamples());
            result->setProperty ("active", juce::var (active.get()));
        }

        return writeResponse (id, juce::var (result.get()));
    }

    if (method == "set_device")
    {
        const auto inputName = params.getProperty ("input", juce::var()).toString();
        const auto outputName = params.getProperty ("output", juce::var()).toString();
        const double sampleRate = params.getProperty ("sampleRate", 44100.0);
        const int bufferSize = static_cast<int> (params.getProperty ("bufferSize", 512));

        juce::AudioDeviceManager::AudioDeviceSetup setup;
        g_deviceManager.getAudioDeviceSetup (setup);
        setup.inputDeviceName = inputName;
        setup.outputDeviceName = outputName;
        setup.sampleRate = sampleRate;
        setup.bufferSize = bufferSize;
        setup.useDefaultInputChannels = true;
        setup.useDefaultOutputChannels = true;

        const auto error = g_deviceManager.setAudioDeviceSetup (setup, true);
        if (error.isNotEmpty())
            return writeError (id, -32000, error);

        juce::DynamicObject::Ptr result = new juce::DynamicObject();
        result->setProperty ("ok", true);
        return writeResponse (id, juce::var (result.get()));
    }

    return writeError (id, -32601, "Method not found: " + method);
}

void readStdinLoop()
{
    while (g_running)
    {
        std::string line;
        if (! std::getline (std::cin, line))
            break;

        if (line.empty())
            continue;

        const auto request = juce::JSON::parse (line);
        if (! request.isObject())
        {
            emitLine (writeError (juce::var(), -32700, "Parse error"));
            continue;
        }

        const auto response = handleRequest (request);
        emitLine (response);
    }

    g_running = false;
    juce::MessageManager::callAsync ([]
    {
        juce::JUCEApplicationBase::quit();
    });
}
} // namespace

class AudioHostApplication final : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override { return "audio-host"; }
    const juce::String getApplicationVersion() override { return "0.1.0"; }

    void initialise (const juce::String&) override
    {
        juce::ignoreUnused (juce::AudioPluginFormatManager {});
        stdinThread = std::thread (readStdinLoop);
    }

    void shutdown() override
    {
        g_running = false;
        g_deviceManager.closeAudioDevice();

        if (stdinThread.joinable())
            stdinThread.join();
    }

private:
    std::thread stdinThread;
};

START_JUCE_APPLICATION (AudioHostApplication)
