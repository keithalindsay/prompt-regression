import { join } from "node:path";
import { existsSync } from "node:fs";
import { writeText, ensureDir } from "../util/fs";
import { CONFIG_TEMPLATE, SAMPLE_CASE_TEMPLATE } from "../templates";
import type { ProviderName } from "../schemas";

export function cmdInit(opts: {
  cwd: string;
  provider: ProviderName;
  force: boolean;
  configPath: string;
}): number {
  const casePath = join(opts.cwd, "cases", "hello.case.yaml");
  if (!opts.force && (existsSync(opts.configPath) || existsSync(casePath))) {
    console.error("prompt-regression: files already exist; pass --force to overwrite.");
    return 2;
  }
  writeText(opts.configPath, CONFIG_TEMPLATE.replace("provider: mock", `provider: ${opts.provider}`));
  writeText(casePath, SAMPLE_CASE_TEMPLATE);
  ensureDir(join(opts.cwd, ".prompt-regression", "baselines"));
  writeText(join(opts.cwd, ".prompt-regression", ".gitkeep"), "");
  console.log("prompt-regression: initialized config + cases/hello.case.yaml");
  return 0;
}
