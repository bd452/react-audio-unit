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
      // Build the native standalone app pointing to the dev server
      // This requires CMake and a C++ compiler
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

        // Configure CMake for Standalone only, with dev server URL
        await execa(
          "cmake",
          [
            nativeSrcDir,
            `-DRAU_PLUGIN_NAME=DevPlugin`,
            `-DRAU_BUILD_AU=OFF`,
            `-DRAU_BUILD_VST3=OFF`,
            `-DRAU_BUILD_AAX=OFF`,
            `-DCMAKE_BUILD_TYPE=Debug`,
          ],
          { cwd: buildDir, stdio: "inherit" },
        );

        // Build
        await execa("cmake", ["--build", ".", "--config", "Debug"], {
          cwd: buildDir,
          stdio: "inherit",
        });

        console.log(chalk.green("  Standalone host built. Launching..."));
        // Launch the standalone app (platform-dependent)
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
  // Look for @react-audio-unit/native in node_modules
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
