#!/usr/bin/env npx tsx
/**
 * CLI for app interactions
 * Usage: ./dev/app <command> [args]
 */

import { program } from "commander";
import { registerBasicCommands } from "./cli/basic.js";
import { registerUxCommands } from "./cli/ux.js";

program
  .name("app")
  .description("CLI for app interactions")
  .version("1.0.0");

registerBasicCommands(program);
registerUxCommands(program);

program.parse();
