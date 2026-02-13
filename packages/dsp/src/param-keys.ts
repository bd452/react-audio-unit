/**
 * Canonical parameter key names shared between JS DSP hooks and the native
 * C++ audio engine.
 *
 * IMPORTANT — the C++ node implementations in packages/native/src/nodes/
 * must use the EXACT SAME string literals as defined here. When adding or
 * renaming a parameter, update BOTH this file and the corresponding C++
 * node's addParam() calls.
 *
 * This file is the single source of truth for parameter naming.
 */

// --- Common (shared across many nodes) -----------------------------------
export const PARAM_BYPASS = "bypass";

// --- GainNode -------------------------------------------------------------
export const PARAM_GAIN = "gain";

// --- DelayNode ------------------------------------------------------------
export const PARAM_DELAY_TIME = "time";
export const PARAM_FEEDBACK = "feedback";
export const PARAM_MIX = "mix";

// --- FilterNode -----------------------------------------------------------
export const PARAM_FILTER_TYPE = "filterType";
export const PARAM_CUTOFF = "cutoff";
export const PARAM_RESONANCE = "resonance";
export const PARAM_GAIN_DB = "gainDb";

// --- CompressorNode -------------------------------------------------------
export const PARAM_THRESHOLD = "threshold";
export const PARAM_RATIO = "ratio";
export const PARAM_ATTACK = "attack";
export const PARAM_RELEASE = "release";
export const PARAM_KNEE = "knee";
export const PARAM_MAKEUP_DB = "makeupDb";

// --- ReverbNode -----------------------------------------------------------
export const PARAM_ROOM_SIZE = "roomSize";
export const PARAM_DAMPING = "damping";
export const PARAM_PRE_DELAY = "preDelay";

// --- DistortionNode -------------------------------------------------------
export const PARAM_DISTORTION_TYPE = "distortionType";
export const PARAM_DRIVE = "drive";
export const PARAM_OUTPUT_GAIN = "outputGain";

// --- PanNode --------------------------------------------------------------
export const PARAM_PAN = "pan";
export const PARAM_PAN_LAW = "law";

// --- OscillatorNode -------------------------------------------------------
export const PARAM_WAVEFORM = "waveform";
export const PARAM_FREQUENCY = "frequency";
export const PARAM_DETUNE = "detune";

// --- LFONode --------------------------------------------------------------
export const PARAM_LFO_SHAPE = "shape";
export const PARAM_LFO_RATE = "rate";
export const PARAM_LFO_DEPTH = "depth";
export const PARAM_LFO_PHASE = "phase";

// --- EnvelopeNode ---------------------------------------------------------
export const PARAM_ENV_ATTACK = "attack";
export const PARAM_ENV_DECAY = "decay";
export const PARAM_ENV_SUSTAIN = "sustain";
export const PARAM_ENV_RELEASE = "release";

// --- MeterNode ------------------------------------------------------------
export const PARAM_METER_TYPE = "meterType";
export const PARAM_REFRESH_RATE = "refreshRate";

// --- ConvolverNode --------------------------------------------------------
// Uses PARAM_MIX and PARAM_GAIN

// --- Input node -----------------------------------------------------------
export const PARAM_CHANNEL = "channel";
