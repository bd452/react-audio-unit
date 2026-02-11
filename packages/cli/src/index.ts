#!/usr/bin/env node

import { Command } from "commander";
import { createCommand } from "./commands/create.js";
import { devCommand } from "./commands/dev.js";
import { buildCommand } from "./commands/build.js";

const program = new Command()
  .name("rau")
  .description("React Audio Unit — build audio plugins with React")
  .version("0.1.0");

program.addCommand(createCommand);
program.addCommand(devCommand);
program.addCommand(buildCommand);

program.parse();
