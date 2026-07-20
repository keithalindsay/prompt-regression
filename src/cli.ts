import { Command } from "commander";
import { cmdInit } from "./commands/init";
import { cmdRun } from "./commands/run";
import { cmdApprove } from "./commands/approve";
import { cmdList } from "./commands/list";
import type { ProviderName } from "./schemas";

function nowIso(): string {
  return new Date().toISOString();
}

const program = new Command();
program
  .name("prompt-regression")
  .description("Snapshot testing for LLM prompts — catch regressions before you ship.")
  .version("0.1.0")
  .option("--config <path>", "path to config file", "prompt-regression.config.yaml")
  .option("--cases <glob>", "override case glob")
  .option("--no-color", "disable ANSI colors");

program
  .command("init")
  .option("--provider <name>", "mock | anthropic | openai", "mock")
  .option("--force", "overwrite existing files", false)
  .action((sub) => {
    const g = program.opts();
    process.exitCode = cmdInit({
      cwd: process.cwd(),
      provider: sub.provider as ProviderName,
      force: !!sub.force,
      configPath: g.config,
    });
  });

program
  .command("run")
  .option("--filter <substr>")
  .option("--provider <name>")
  .option("--model <id>")
  .option("--ci", "non-zero exit on drift/error; compact output", false)
  .option("--json [path]", "emit RunReport JSON to stdout or a file")
  .option("--no-cache", "force fresh provider calls")
  .option("--seed <n>", "provider seed passthrough", (v) => parseInt(v, 10))
  .option("--update-on-new <bool>", "auto-write baselines for NEW cases", "true")
  .action(async (sub) => {
    const g = program.opts();
    process.exitCode = await cmdRun({
      cwd: process.cwd(),
      configPath: g.config,
      casesGlob: g.cases,
      provider: sub.provider as ProviderName | undefined,
      model: sub.model,
      filter: sub.filter,
      ci: !!sub.ci,
      json: sub.json === true ? true : (sub.json as string | undefined),
      updateOnNew: sub.updateOnNew !== "false",
      useCache: sub.cache !== false, // commander sets .cache=false for --no-cache
      seed: sub.seed,
      color: g.color !== false,
      now: nowIso(),
    });
  });

program
  .command("approve")
  .option("--filter <substr>")
  .option("--all", "approve every drifted/new case", false)
  .option("--yes", "skip confirmation", false)
  .action(async (sub) => {
    const g = program.opts();
    process.exitCode = await cmdApprove({
      cwd: process.cwd(),
      configPath: g.config,
      filter: sub.filter,
      all: !!sub.all,
      yes: !!sub.yes,
      now: nowIso(),
    });
  });

program
  .command("list")
  .option("--json", "output JSON", false)
  .action((sub) => {
    const g = program.opts();
    process.exitCode = cmdList({ cwd: process.cwd(), configPath: g.config, json: !!sub.json });
  });

program.parseAsync(process.argv).then(() => {
  if (process.argv.slice(2).length === 0) program.help();
});
