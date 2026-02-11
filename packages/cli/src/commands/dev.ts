import { Command } from "commander";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";
import fs from "fs-extra";

export const devCommand = new Command("dev")
  .description("Start development server with hot reload")
  .option("-p, --port <port>", "Dev server port", "5173")
  .option("--host", "Also build and launch standalone host app")
  .action(async (options: { port: string; host?: boolean }) => {
    const cwd = process.cwd();

    // Verify we're in a plugin project
    const configPath = path.join(cwd, "plugin.config.ts");
    if (!(await fs.pathExists(configPath))) {
      console.error(
        chalk.red(
          "Not a React Audio Unit project (plugin.config.ts not found).",
        ),
      );
      console.error(
        chalk.dim("Run this command from your plugin project directory."),
      );
      process.exit(1);
    }

    console.log(chalk.blue("Starting React Audio Unit dev server..."));
    console.log();

    // Start Vite dev server
    const viteProcess = execa("npx", ["vite", "--port", options.port], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    console.log(chalk.green(`  Dev server: http://localhost:${options.port}`));
    console.log();
    console.log(chalk.dim("The WebView in your DAW will connect to this URL."));
    console.log(
      chalk.dim("Changes to your plugin code will hot-reload automatically."),
    );
    console.log();

    if (options.host) {
      console.log(chalk.blue("Building standalone host..."));
      const nativeSrcDir = resolveNativeSrc();
      if (!nativeSrcDir) {
        console.error(
          chalk.yellow("Native source not found — running UI-only dev mode."),
        );
        console.error(
          chalk.dim(
            "Install @react-audio-unit/native to enable standalone host.",
          ),
        );
      } else {
        const buildDir = path.join(cwd, "build", "dev");
        await fs.ensureDir(buildDir);

        // Load config to get proper plugin name
        let pluginName = "DevPlugin";
        const configPath = path.join(cwd, "plugin.config.ts");
        if (await fs.pathExists(configPath)) {
          try {
            const { createJiti } = await import("jiti");
            const jiti = createJiti(cwd);
            const mod = (await jiti.import(configPath)) as Record<
              string,
              unknown
            >;
            const config = (mod.default ?? mod) as { name?: string };
            if (config.name) pluginName = config.name;
          } catch {
            // fallback
          }
        }

        const sanitizedName = pluginName.replace(/[^a-zA-Z0-9_]/g, "");

        // Configure CMake for Standalone only, with dev server URL
        const devServerUrl = `http://localhost:${options.port}`;
        await execa(
          "cmake",
          [
            nativeSrcDir,
            `-DRAU_PLUGIN_NAME=${pluginName}`,
            `-DRAU_BUILD_AU=OFF`,
            `-DRAU_BUILD_VST3=OFF`,
            `-DRAU_BUILD_AAX=OFF`,
            `-DCMAKE_BUILD_TYPE=Debug`,
          ],
          { cwd: buildDir, stdio: "inherit" },
        );

        // Build (Standalone only)
        const os = await import("os");
        const jobs = Math.max(1, os.cpus().length);
        await execa(
          "cmake",
          [
            "--build",
            ".",
            "--config",
            "Debug",
            "--target",
            `${sanitizedName}_Standalone`,
            "-j",
            String(jobs),
          ],
          {
            cwd: buildDir,
            stdio: "inherit",
          },
        );

        console.log(chalk.green("  Standalone host built. Launching..."));

        // Find and launch the standalone app
        const standalonePath = await findStandalone(buildDir, sanitizedName);
        if (standalonePath) {
          console.log(chalk.dim(`  Launching: ${standalonePath}`));
          // Launch the standalone app in the background
          const standaloneProc = execa("open", [standalonePath], {
            reject: false,
          });
          standaloneProc.catch(() => {
            /* ignore exit errors */
          });
        } else {
          console.log(
            chalk.yellow(
              "  Could not locate standalone binary. Check build output.",
            ),
          );
        }
      }
    }

    // Wait for Vite to exit
    try {
      await viteProcess;
    } catch {
      // Ctrl-C
    }
  });

function resolveNativeSrc(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "node_modules/@react-audio-unit/native"),
    path.resolve(process.cwd(), "../../packages/native"), // monorepo
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "CMakeLists.txt"))) {
      return p;
    }
  }
  return null;
}

async function findStandalone(
  buildDir: string,
  sanitizedName: string,
): Promise<string | null> {
  // On macOS, the standalone app is at:
  //   <buildDir>/<name>_artefacts/Debug/Standalone/<name>.app
  const candidates = [
    path.join(
      buildDir,
      `${sanitizedName}_artefacts`,
      "Debug",
      "Standalone",
      `${sanitizedName}.app`,
    ),
    path.join(
      buildDir,
      `${sanitizedName}_artefacts`,
      "Standalone",
      `${sanitizedName}.app`,
    ),
  ];

  for (const p of candidates) {
    if (await fs.pathExists(p)) {
      return p;
    }
  }

  // Fallback: recursively look for .app
  return findRecursive(buildDir, ".app");
}

async function findRecursive(dir: string, ext: string): Promise<string | null> {
  if (!(await fs.pathExists(dir))) return null;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.endsWith(ext)) {
      return path.join(dir, entry.name);
    }
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const result = await findRecursive(path.join(dir, entry.name), ext);
      if (result) return result;
    }
  }
  return null;
}
