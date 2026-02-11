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
  .action(async (options: { debug?: boolean; format?: string[] }) => {
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
    console.log(chalk.dim(`  Formats: ${config.formats.join(", ")}`));
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

    const formats =
      options.format ?? config.formats.map((f) => f.toLowerCase());
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
      `-DRAU_BUILD_AU=${formats.includes("au") ? "ON" : "OFF"}`,
      `-DRAU_BUILD_VST3=${formats.includes("vst3") ? "ON" : "OFF"}`,
      `-DRAU_BUILD_AAX=${formats.includes("aax") ? "ON" : "OFF"}`,
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

    // Report output locations
    const outputDir = path.join(
      buildDir,
      `${config.name}_artefacts`,
      buildType,
    );
    if (await fs.pathExists(outputDir)) {
      console.log(chalk.dim("Plugin binaries:"));
      const entries = await fs.readdir(outputDir, { recursive: true });
      for (const entry of entries) {
        const ext = path.extname(String(entry));
        if (
          [".component", ".vst3", ".aaxplugin", ""].some(
            (e) => ext === e || String(entry).includes(ext),
          )
        ) {
          console.log(chalk.cyan(`  ${outputDir}/${entry}`));
        }
      }
    }
  });

async function loadPluginConfig(cwd: string): Promise<PluginConfig | null> {
  // Use a dynamic import with tsx for TypeScript config files
  const configPath = path.join(cwd, "plugin.config.ts");
  if (!(await fs.pathExists(configPath))) return null;

  try {
    // Try to import as JS first (in case it's already been compiled)
    const jsConfigPath = path.join(cwd, "plugin.config.js");
    if (await fs.pathExists(jsConfigPath)) {
      const mod = await import(jsConfigPath);
      return mod.default ?? mod;
    }

    // Fall back to reading as JSON-like (strip TS syntax)
    const raw = await fs.readFile(configPath, "utf-8");
    // Simple extraction — in production, use tsx or ts-node
    const match = raw.match(/export\s+default\s+({[\s\S]*})/);
    if (match) {
      // Use Function constructor to evaluate the object literal
      const config = new Function(`return ${match[1]}`)();
      return config as PluginConfig;
    }
  } catch {
    // Fall through
  }

  return null;
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
