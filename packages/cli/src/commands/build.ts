import { Command } from "commander";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";
import fs from "fs-extra";

interface PluginConfig {
  name: string;
  vendor: string;
  vendorId: string;
  pluginId: string;
  version: string;
  category: string;
  formats: string[];
  channels: { input: number; output: number };
  ui: { width: number; height: number; resizable?: boolean };
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
    console.log();

    // 2. Build the React UI with Vite
    console.log(chalk.blue("Step 1/3: Building web UI..."));
    await execa("npx", ["vite", "build"], { cwd, stdio: "inherit" });
    const uiDistDir = path.join(cwd, "dist", "ui");
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
      `-DRAU_PLUGIN_NEEDS_MIDI=${isSynth ? "ON" : "OFF"}`,
      `-DRAU_PLUGIN_CHANNELS_IN=${config.channels.input}`,
      `-DRAU_PLUGIN_CHANNELS_OUT=${config.channels.output}`,
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
