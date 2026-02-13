import { Command } from "commander";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";
import fs from "fs-extra";

type AudioChannelLayoutName =
  | "disabled"
  | "mono"
  | "stereo"
  | "lcr"
  | "2.1"
  | "quad"
  | "4.0"
  | "4.1"
  | "5.0"
  | "5.1"
  | "6.0"
  | "6.1"
  | "7.0"
  | "7.1"
  | "7.1.2"
  | "7.1.4"
  | "9.1.6"
  | "atmos"
  | "atmos-7.1.2"
  | "atmos-7.1.4"
  | "atmos-9.1.6";

type AudioChannelLayout =
  | AudioChannelLayoutName
  | number
  | { layout: "discrete"; channels: number };

interface PluginIOConfig {
  audio?: {
    main: Array<{
      input: AudioChannelLayout;
      output: AudioChannelLayout;
      name?: string;
    }>;
    sidechain?: {
      supported: AudioChannelLayout[];
      optional?: boolean;
    };
  };
  midi?: {
    input?: boolean;
    output?: boolean;
  };
}

interface PluginConfig {
  name: string;
  vendor: string;
  vendorId: string;
  pluginId: string;
  version: string;
  category: string;
  formats: string[];
  channels?: { input: number; output: number };
  io?: PluginIOConfig;
  ui: { width: number; height: number; resizable?: boolean };
}

interface ResolvedAudioLayout {
  token: string;
  channels: number;
}

interface ResolvedMainArrangement {
  input: ResolvedAudioLayout;
  output: ResolvedAudioLayout;
}

interface ResolvedIOCapabilities {
  mainArrangements: ResolvedMainArrangement[];
  defaultMainInput: ResolvedAudioLayout;
  defaultMainOutput: ResolvedAudioLayout;
  sidechainLayouts: ResolvedAudioLayout[];
  sidechainOptional: boolean;
  midiInput: boolean;
  midiOutput: boolean;
}

export const buildCommand = new Command("build")
  .description("Build production plugin binaries")
  .option("--debug", "Build in debug mode")
  .option("--format <formats...>", "Plugin formats to build (au, vst3, aax)")
  .option("--mac", "Build for macOS only")
  .option("--win", "Build for Windows only")
  .option("--linux", "Build for Linux only")
  .option("--all", "Build for all supported platforms (current host only)")
  .action(
    async (options: {
      debug?: boolean;
      format?: string[];
      mac?: boolean;
      win?: boolean;
      linux?: boolean;
      all?: boolean;
    }) => {
    const cwd = process.cwd();
    const buildType = options.debug ? "Debug" : "Release";

    console.log(
      chalk.blue(`Building React Audio Unit plugin (${buildType})...`),
    );
    console.log();

    // 1. Load plugin config
    const config = await loadPluginConfig(cwd);
    if (!config) {
      console.error(chalk.red("Could not load plugin.config.ts"));
      process.exit(1);
    }
    console.log(chalk.dim(`  Plugin: ${config.name} v${config.version}`));
    console.log(chalk.dim(`  Vendor: ${config.vendor}`));
    let ioCapabilities: ResolvedIOCapabilities;
    try {
      ioCapabilities = resolveIOCapabilities(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Invalid I/O configuration: ${message}`));
      process.exit(1);
    }

    // Determine target platform
    const hostPlatform = process.platform; // 'darwin', 'win32', 'linux'
    let targetPlatform: string;
    if (options.mac) targetPlatform = "darwin";
    else if (options.win) targetPlatform = "win32";
    else if (options.linux) targetPlatform = "linux";
    else targetPlatform = hostPlatform; // --all or default: build for current host

    if (targetPlatform !== hostPlatform) {
      console.log(
        chalk.yellow(
          `  Note: Cross-compilation requested (host: ${hostPlatform}, target: ${targetPlatform}).`,
        ),
      );
      console.log(
        chalk.yellow(
          "  Cross-compilation requires platform-specific toolchains.",
        ),
      );
    }

    // Filter formats by target platform
    const defaultFormats = config.formats.map((f: string) => f.toLowerCase());
    let platformFormats: string[];
    if (options.format) {
      platformFormats = options.format;
    } else if (targetPlatform === "darwin") {
      platformFormats = defaultFormats.filter((f: string) =>
        ["au", "vst3", "aax", "standalone"].includes(f),
      );
    } else if (targetPlatform === "win32") {
      // AU is macOS-only
      platformFormats = defaultFormats.filter(
        (f: string) => f !== "au" && ["vst3", "aax", "standalone"].includes(f),
      );
    } else {
      // Linux — VST3 and Standalone only
      platformFormats = defaultFormats.filter((f: string) =>
        ["vst3", "standalone"].includes(f),
      );
    }

    console.log(chalk.dim(`  Formats: ${platformFormats.join(", ")}`));
    console.log(
      chalk.dim(
        `  Platform: ${targetPlatform === "darwin" ? "macOS" : targetPlatform === "win32" ? "Windows" : "Linux"}`,
      ),
    );
    console.log(
      chalk.dim(
        `  Audio layouts: ${formatMainArrangements(ioCapabilities.mainArrangements)}`,
      ),
    );
    console.log(
      chalk.dim(
        `  MIDI I/O: in=${ioCapabilities.midiInput ? "yes" : "no"}, out=${ioCapabilities.midiOutput ? "yes" : "no"}`,
      ),
    );
    console.log();

    // 2. Build the React UI with Vite
    console.log(chalk.blue("Step 1/3: Building web UI..."));
    await execa("npx", ["vite", "build"], { cwd, stdio: "inherit" });
    const uiDistDir = path.join(cwd, "dist", "ui");
    const uiEntry = path.join(uiDistDir, "index.html");
    if (!(await fs.pathExists(uiEntry))) {
      console.error(chalk.red("Web UI build output missing: dist/ui/index.html"));
      console.error(
        chalk.dim(
          "Ensure your Vite config outputs to dist/ui so the plugin can embed the UI.",
        ),
      );
      process.exit(1);
    }
    console.log(chalk.green("  Web UI built successfully"));
    console.log();

    // 3. Locate native source
    const nativeSrcDir = resolveNativeSrc(cwd);
    if (!nativeSrcDir) {
      console.error(chalk.red("@react-audio-unit/native not found."));
      console.error(chalk.dim("Run: npm install @react-audio-unit/native"));
      process.exit(1);
    }

    // 4. Configure and build with CMake
    console.log(chalk.blue("Step 2/3: Configuring native build..."));
    const buildDir = path.join(cwd, "build", buildType.toLowerCase());
    await fs.ensureDir(buildDir);

    const isSynth = config.category === "Instrument";

    const cmakeArgs = [
      nativeSrcDir,
      `-DRAU_PLUGIN_NAME=${config.name}`,
      `-DRAU_PLUGIN_VENDOR=${config.vendor}`,
      `-DRAU_PLUGIN_CODE=${config.pluginId}`,
      `-DRAU_VENDOR_CODE=${config.vendorId}`,
      `-DRAU_PLUGIN_VERSION=${config.version}`,
      `-DRAU_PLUGIN_IS_SYNTH=${isSynth ? "ON" : "OFF"}`,
      `-DRAU_PLUGIN_NEEDS_MIDI=${ioCapabilities.midiInput ? "ON" : "OFF"}`,
      `-DRAU_PLUGIN_PRODUCES_MIDI=${ioCapabilities.midiOutput ? "ON" : "OFF"}`,
      `-DRAU_PLUGIN_CHANNELS_IN=${ioCapabilities.defaultMainInput.channels}`,
      `-DRAU_PLUGIN_CHANNELS_OUT=${ioCapabilities.defaultMainOutput.channels}`,
      `-DRAU_MAIN_LAYOUTS=${serializeMainArrangements(ioCapabilities.mainArrangements)}`,
      `-DRAU_MAIN_INPUT_DEFAULT=${ioCapabilities.defaultMainInput.token}`,
      `-DRAU_MAIN_OUTPUT_DEFAULT=${ioCapabilities.defaultMainOutput.token}`,
      `-DRAU_SIDECHAIN_LAYOUTS=${serializeLayoutList(ioCapabilities.sidechainLayouts)}`,
      `-DRAU_SIDECHAIN_OPTIONAL=${ioCapabilities.sidechainOptional ? "ON" : "OFF"}`,
      `-DRAU_UI_WIDTH=${config.ui.width}`,
      `-DRAU_UI_HEIGHT=${config.ui.height}`,
      `-DRAU_WEB_UI_DIR=${uiDistDir}`,
      `-DRAU_BUILD_AU=${platformFormats.includes("au") ? "ON" : "OFF"}`,
      `-DRAU_BUILD_VST3=${platformFormats.includes("vst3") ? "ON" : "OFF"}`,
      `-DRAU_BUILD_AAX=${platformFormats.includes("aax") ? "ON" : "OFF"}`,
      `-DCMAKE_BUILD_TYPE=${buildType}`,
    ];

    await execa("cmake", cmakeArgs, { cwd: buildDir, stdio: "inherit" });
    console.log(chalk.green("  CMake configured"));

    // 5. Build
    console.log(chalk.blue("Step 3/3: Compiling plugin..."));
    const jobs = Math.max(1, (await import("os")).cpus().length);
    await execa(
      "cmake",
      ["--build", ".", "--config", buildType, "-j", String(jobs)],
      {
        cwd: buildDir,
        stdio: "inherit",
      },
    );

    console.log();
    console.log(chalk.green("Build complete!"));
    console.log();

    // Report output locations — JUCE uses the sanitized target name
    const sanitizedName = config.name.replace(/[^a-zA-Z0-9_]/g, "");
    const artefactCandidates = [
      path.join(buildDir, `${sanitizedName}_artefacts`, buildType),
      path.join(buildDir, `${config.name}_artefacts`, buildType),
      path.join(buildDir, `${sanitizedName}_artefacts`),
    ];

    let outputDir: string | null = null;
    for (const candidate of artefactCandidates) {
      if (await fs.pathExists(candidate)) {
        outputDir = candidate;
        break;
      }
    }

    if (outputDir) {
      console.log(chalk.dim("Plugin binaries:"));
      const pluginExtensions = [".component", ".vst3", ".aaxplugin", ".app"];
      await reportPluginOutputs(outputDir, pluginExtensions);
    } else {
      console.log(chalk.dim("  Could not locate build artefacts directory."));
      console.log(
        chalk.dim(`  Check: ${buildDir}/${sanitizedName}_artefacts/`),
      );
    }
  },
  );

const AUDIO_LAYOUT_CHANNELS: Record<string, number> = {
  disabled: 0,
  mono: 1,
  stereo: 2,
  lcr: 3,
  "2.1": 3,
  quad: 4,
  "4.0": 4,
  "4.1": 5,
  "5.0": 5,
  "5.1": 6,
  "6.0": 6,
  "6.1": 7,
  "7.0": 7,
  "7.1": 8,
  "7.1.2": 10,
  "7.1.4": 12,
  "9.1.6": 16,
};

const AUDIO_LAYOUT_ALIASES: Record<string, string> = {
  "1.0": "mono",
  "2.0": "stereo",
  "3.0": "lcr",
  atmos: "7.1.2",
  "atmos-7.1.2": "7.1.2",
  "atmos-7.1.4": "7.1.4",
  "atmos-9.1.6": "9.1.6",
};

function resolveIOCapabilities(config: PluginConfig): ResolvedIOCapabilities {
  const mainArrangements = resolveMainArrangements(config);
  if (mainArrangements.length === 0) {
    throw new Error("at least one main audio arrangement is required");
  }

  const sidechainLayouts = dedupeLayouts(
    config.io?.audio?.sidechain?.supported?.length
      ? config.io.audio.sidechain.supported.map((layout, index) =>
          normalizeAudioLayout(layout, {
            allowDisabled: true,
            location: `io.audio.sidechain.supported[${index}]`,
          }),
        )
      : [
          normalizeAudioLayout("disabled", {
            allowDisabled: true,
            location: "sidechain default",
          }),
          normalizeAudioLayout("mono", {
            allowDisabled: false,
            location: "sidechain default",
          }),
          normalizeAudioLayout("stereo", {
            allowDisabled: false,
            location: "sidechain default",
          }),
        ],
  );

  const sidechainOptional = config.io?.audio?.sidechain?.optional ?? true;
  const midiInput = config.io?.midi?.input ?? config.category === "Instrument";
  const midiOutput = config.io?.midi?.output ?? false;

  return {
    mainArrangements,
    defaultMainInput: mainArrangements[0].input,
    defaultMainOutput: mainArrangements[0].output,
    sidechainLayouts,
    sidechainOptional,
    midiInput,
    midiOutput,
  };
}

function resolveMainArrangements(
  config: PluginConfig,
): ResolvedMainArrangement[] {
  const configuredMain = config.io?.audio?.main;
  if (configuredMain && configuredMain.length > 0) {
    return configuredMain.map((arrangement, index) => ({
      input: normalizeAudioLayout(arrangement.input, {
        allowDisabled: true,
        location: `io.audio.main[${index}].input`,
      }),
      output: normalizeAudioLayout(arrangement.output, {
        allowDisabled: false,
        location: `io.audio.main[${index}].output`,
      }),
    }));
  }

  const legacyInput =
    config.channels?.input ?? (config.category === "Instrument" ? 0 : 2);
  const legacyOutput = config.channels?.output ?? 2;

  return [
    {
      input: normalizeAudioLayout(legacyInput, {
        allowDisabled: true,
        location: "channels.input",
      }),
      output: normalizeAudioLayout(legacyOutput, {
        allowDisabled: false,
        location: "channels.output",
      }),
    },
  ];
}

function normalizeAudioLayout(
  layout: AudioChannelLayout,
  options: { allowDisabled: boolean; location: string },
): ResolvedAudioLayout {
  let token: string;
  let channels: number;

  if (typeof layout === "number") {
    if (!Number.isInteger(layout) || layout < 0) {
      throw new Error(`${options.location}: numeric layout must be >= 0`);
    }
    channels = layout;
    token = tokenFromChannelCount(layout);
  } else if (typeof layout === "string") {
    const raw = layout.trim().toLowerCase();
    const canonical = AUDIO_LAYOUT_ALIASES[raw] ?? raw;

    if (canonical.startsWith("discrete:")) {
      const count = Number.parseInt(canonical.slice("discrete:".length), 10);
      if (!Number.isInteger(count) || count < 1) {
        throw new Error(
          `${options.location}: discrete layout must be discrete:<positive-integer>`,
        );
      }
      channels = count;
      token = `discrete:${count}`;
    } else {
      const mapped = AUDIO_LAYOUT_CHANNELS[canonical];
      if (mapped === undefined) {
        throw new Error(
          `${options.location}: unsupported layout "${layout}". Supported examples: mono, stereo, 5.1, 7.1.4, atmos, discrete:12`,
        );
      }
      channels = mapped;
      token = canonical;
    }
  } else {
    if (layout.layout !== "discrete") {
      throw new Error(
        `${options.location}: object layout must use { layout: "discrete", channels: number }`,
      );
    }
    if (!Number.isInteger(layout.channels) || layout.channels < 1) {
      throw new Error(
        `${options.location}: discrete layout object requires channels >= 1`,
      );
    }
    channels = layout.channels;
    token = `discrete:${channels}`;
  }

  if (channels === 0 && !options.allowDisabled) {
    throw new Error(`${options.location}: "disabled" is not allowed here`);
  }

  return { token, channels };
}

function tokenFromChannelCount(channels: number): string {
  if (channels === 0) return "disabled";
  if (channels === 1) return "mono";
  if (channels === 2) return "stereo";
  return `discrete:${channels}`;
}

function dedupeLayouts(layouts: ResolvedAudioLayout[]): ResolvedAudioLayout[] {
  const seen = new Set<string>();
  const out: ResolvedAudioLayout[] = [];
  for (const layout of layouts) {
    if (seen.has(layout.token)) continue;
    seen.add(layout.token);
    out.push(layout);
  }
  return out;
}

function serializeMainArrangements(
  arrangements: ResolvedMainArrangement[],
): string {
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (const arrangement of arrangements) {
    const serialized = `${arrangement.input.token}>${arrangement.output.token}`;
    if (seen.has(serialized)) continue;
    seen.add(serialized);
    pairs.push(serialized);
  }
  return pairs.join("|");
}

function serializeLayoutList(layouts: ResolvedAudioLayout[]): string {
  return dedupeLayouts(layouts)
    .map((layout) => layout.token)
    .join("|");
}

function formatMainArrangements(arrangements: ResolvedMainArrangement[]): string {
  return arrangements
    .map((arrangement) => `${arrangement.input.token} -> ${arrangement.output.token}`)
    .join(" | ");
}

async function loadPluginConfig(cwd: string): Promise<PluginConfig | null> {
  // Look for config file in multiple formats
  const candidates = [
    path.join(cwd, "plugin.config.ts"),
    path.join(cwd, "plugin.config.js"),
    path.join(cwd, "plugin.config.mjs"),
  ];

  let configPath: string | null = null;
  for (const p of candidates) {
    if (await fs.pathExists(p)) {
      configPath = p;
      break;
    }
  }

  if (!configPath) return null;

  try {
    if (configPath.endsWith(".ts")) {
      // Use jiti to load TypeScript config files natively
      const { createJiti } = await import("jiti");
      const jiti = createJiti(cwd);
      const mod = (await jiti.import(configPath)) as Record<string, unknown>;
      return (mod.default ?? mod) as PluginConfig;
    } else {
      // Plain JS — use native import
      const mod = await import(configPath);
      return (mod.default ?? mod) as PluginConfig;
    }
  } catch (err) {
    console.error(
      chalk.yellow(`Warning: Could not load ${path.basename(configPath)}`),
    );
    if (err instanceof Error) {
      console.error(chalk.dim(`  ${err.message}`));
    }
  }

  return null;
}

async function reportPluginOutputs(
  dir: string,
  extensions: string[],
): Promise<void> {
  if (!(await fs.pathExists(dir))) return;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const isPlugin = extensions.some((ext) => entry.name.endsWith(ext));

    if (isPlugin) {
      console.log(chalk.cyan(`  ${fullPath}`));
    } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
      await reportPluginOutputs(fullPath, extensions);
    }
  }
}

function resolveNativeSrc(cwd: string): string | null {
  const candidates = [
    path.resolve(cwd, "node_modules/@react-audio-unit/native"),
    path.resolve(cwd, "../../packages/native"), // monorepo
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "CMakeLists.txt"))) {
      return p;
    }
  }
  return null;
}
