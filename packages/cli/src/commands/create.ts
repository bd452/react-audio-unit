import { Command } from "commander";
import path from "path";
import fs from "fs-extra";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Read the CLI's own version to inject into scaffolded projects. */
function getCliVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = fs.readJsonSync(pkgPath);
    return pkg.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}

/** Packages whose versions in templates should track the CLI release. */
const RAU_PACKAGES = [
  "@react-audio-unit/core",
  "@react-audio-unit/dsp",
  "@react-audio-unit/ui",
  "@react-audio-unit/cli",
  "@react-audio-unit/native",
];

/** Replace placeholder versions with the current release version. */
function updateRauVersions(
  pkg: Record<string, unknown>,
  version: string,
): void {
  const versionRange = `^${version}`;
  for (const section of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[section] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const name of RAU_PACKAGES) {
      if (name in deps) {
        deps[name] = versionRange;
      }
    }
  }
}

export const createCommand = new Command("create")
  .description("Scaffold a new React Audio Unit plugin project")
  .argument("<name>", "Plugin project name")
  .option("-t, --template <template>", "Template to use", "effect")
  .action(async (name: string, options: { template: string }) => {
    const targetDir = path.resolve(process.cwd(), name);

    if (await fs.pathExists(targetDir)) {
      console.error(chalk.red(`Directory "${name}" already exists.`));
      process.exit(1);
    }

    console.log(chalk.blue(`Creating React Audio Unit plugin: ${name}`));
    console.log();

    // Locate template directory
    const templateDir = path.resolve(
      __dirname,
      "../../templates",
      options.template,
    );
    if (!(await fs.pathExists(templateDir))) {
      console.error(chalk.red(`Template "${options.template}" not found.`));
      process.exit(1);
    }

    // Copy template
    await fs.copy(templateDir, targetDir);

    // Update package.json with project name and current RAU versions
    const pkgPath = path.join(targetDir, "package.json");
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJson(pkgPath);
      pkg.name = name;
      updateRauVersions(pkg, getCliVersion());
      await fs.writeJson(pkgPath, pkg, { spaces: 2 });
    }

    // Update plugin.config.ts with project name
    const configPath = path.join(targetDir, "plugin.config.ts");
    if (await fs.pathExists(configPath)) {
      let config = await fs.readFile(configPath, "utf-8");
      config = config.replace(/{{PLUGIN_NAME}}/g, name);
      config = config.replace(/{{PLUGIN_NAME_PASCAL}}/g, toPascalCase(name));
      await fs.writeFile(configPath, config);
    }

    console.log(chalk.green("  Created project files"));
    console.log();
    console.log("Next steps:");
    console.log();
    console.log(chalk.cyan(`  cd ${name}`));
    console.log(chalk.cyan("  npm install"));
    console.log(chalk.cyan("  npm run dev"));
    console.log();
    console.log(chalk.dim("To build for production:"));
    console.log(chalk.cyan("  npm run build"));
    console.log();
  });

function toPascalCase(str: string): string {
  return str.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
}
