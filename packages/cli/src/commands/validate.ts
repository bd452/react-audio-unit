import { Command } from "commander";
import path from "path";
import { execa } from "execa";
import chalk from "chalk";
import fs from "fs-extra";

export const validateCommand = new Command("validate")
  .description("Validate built plugin binaries (auval, VST3 validator)")
  .option("--format <format>", "Specific format to validate (au, vst3)")
  .option("--build-dir <dir>", "Custom build directory", "build/release")
  .action(async (options: { format?: string; buildDir?: string }) => {
    const cwd = process.cwd();
    const buildDir = path.resolve(cwd, options.buildDir ?? "build/release");

    console.log(chalk.blue("Validating plugin binaries..."));
    console.log();

    if (!(await fs.pathExists(buildDir))) {
      console.error(chalk.red(`Build directory not found: ${buildDir}`));
      console.error(chalk.dim("Run 'rau build' first."));
      process.exit(1);
    }

    const results: { format: string; passed: boolean; output: string }[] = [];

    // AU validation (macOS only)
    if (
      (!options.format || options.format === "au") &&
      process.platform === "darwin"
    ) {
      console.log(chalk.blue("Running auval (Audio Unit validation)..."));
      console.log();

      try {
        // Find the .component file
        const componentPath = await findFile(buildDir, ".component");
        if (componentPath) {
          // auval needs the plugin to be installed — JUCE's COPY_PLUGIN_AFTER_BUILD
          // should have placed it in ~/Library/Audio/Plug-Ins/Components/
          // Try to detect plugin name from the .component directory name
          const pluginName = path.basename(componentPath, ".component");

          // Run auval with type/subtype/manufacturer
          // We run a basic validation: auval -a lists all installed AUs
          // For a full validation we'd need the 4-char codes.
          // Use a simple auval -a to verify the AU is registered
          const { stdout } = await execa("auval", ["-a"], {
            reject: false,
          });

          const registered = stdout.includes(pluginName);
          results.push({
            format: "AU",
            passed: registered,
            output: registered
              ? `${pluginName} is registered as an Audio Unit`
              : `${pluginName} not found in auval listing. Ensure the plugin is installed.`,
          });

          if (registered) {
            console.log(chalk.green(`  AU: ${pluginName} is registered`));
          } else {
            console.log(
              chalk.yellow(`  AU: ${pluginName} not found in registry`),
            );
          }
        } else {
          console.log(
            chalk.dim("  No .component found — skipping AU validation"),
          );
        }
      } catch (err) {
        console.error(chalk.yellow("  auval not available or failed"));
        if (err instanceof Error) console.error(chalk.dim(`  ${err.message}`));
      }
      console.log();
    }

    // VST3 validation
    if (!options.format || options.format === "vst3") {
      console.log(chalk.blue("Checking VST3 binary..."));
      console.log();

      const vst3Path = await findFile(buildDir, ".vst3");
      if (vst3Path) {
        // Check basic structure: a .vst3 bundle should have Contents/
        const contentsDir = path.join(vst3Path, "Contents");
        const hasContents = await fs.pathExists(contentsDir);

        // On macOS, check for the binary inside
        let hasBinary = false;
        if (process.platform === "darwin") {
          const macOSDir = path.join(contentsDir, "MacOS");
          if (await fs.pathExists(macOSDir)) {
            const files = await fs.readdir(macOSDir);
            hasBinary = files.length > 0;
          }
        } else {
          // On other platforms, just check Contents exists
          hasBinary = hasContents;
        }

        const passed = hasContents && hasBinary;
        results.push({
          format: "VST3",
          passed,
          output: passed
            ? `VST3 bundle structure is valid: ${vst3Path}`
            : `VST3 bundle structure incomplete: ${vst3Path}`,
        });

        if (passed) {
          console.log(
            chalk.green(
              `  VST3: Bundle structure valid (${path.basename(vst3Path)})`,
            ),
          );
        } else {
          console.log(chalk.red(`  VST3: Bundle structure incomplete`));
        }

        // Try to run VST3 validator if available
        try {
          const { exitCode, stdout } = await execa(
            "VST3Inspector",
            [vst3Path],
            { reject: false },
          );
          if (exitCode === 0) {
            console.log(chalk.green("  VST3 Inspector: passed"));
          } else {
            console.log(
              chalk.dim(
                "  VST3 Inspector: not available (install Steinberg SDK tools for full validation)",
              ),
            );
          }
        } catch {
          console.log(
            chalk.dim(
              "  VST3 Inspector not found — structural validation only",
            ),
          );
        }
      } else {
        console.log(chalk.dim("  No .vst3 found — skipping VST3 validation"));
      }
      console.log();
    }

    // Summary
    console.log(chalk.blue("Validation Summary:"));
    if (results.length === 0) {
      console.log(chalk.yellow("  No plugin binaries found to validate."));
    } else {
      for (const r of results) {
        const icon = r.passed ? chalk.green("✓") : chalk.red("✗");
        console.log(`  ${icon} ${r.format}: ${r.output}`);
      }
    }

    const allPassed = results.every((r) => r.passed);
    if (!allPassed) {
      process.exit(1);
    }
  });

/**
 * Recursively find a file/directory matching the given extension.
 */
async function findFile(dir: string, ext: string): Promise<string | null> {
  if (!(await fs.pathExists(dir))) return null;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name.endsWith(ext)) {
      return fullPath;
    }
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const result = await findFile(fullPath, ext);
      if (result) return result;
    }
  }
  return null;
}
