#!/usr/bin/env node
/**
 * prompt-regression — CLI entrypoint (STUB)
 *
 * This is an intentionally minimal, runnable skeleton. The real implementation
 * should be built by following the ordered build plan in DESIGN.md (section 11).
 * See ../DESIGN.md for the exact CLI surface (section 7), data models (section 8),
 * and module breakdown (section 6).
 *
 * DO NOT flesh out the tool here ad hoc — wire commander subcommands to the
 * command handlers in src/commands/ as described in the design.
 */

import { Command } from "commander";

const program = new Command();

program
  .name("prompt-regression")
  .description("Snapshot testing for LLM prompts — catch regressions before you ship.")
  .version("0.1.0")
  .option("--config <path>", "path to config file", "prompt-regression.config.yaml")
  .option("--cases <glob>", "override case glob")
  .option("--no-color", "disable ANSI colors");

// Subcommands to implement per DESIGN.md §7: init | run | approve | list
for (const name of ["init", "run", "approve", "list"] as const) {
  program
    .command(name)
    .description(`(not yet implemented) see DESIGN.md §7 for the '${name}' contract`)
    .allowUnknownOption(true)
    .action(() => {
      console.error(
        `prompt-regression: '${name}' is not implemented yet.\n` +
          `This is the stub entrypoint — build it by following DESIGN.md (build plan §11).`,
      );
      process.exitCode = 2;
    });
}

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
  program.help();
}
