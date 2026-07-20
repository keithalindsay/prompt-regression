import { join } from "node:path";
import { RunReportSchema, type Config } from "../schemas";
import { readTextIfExists } from "../util/fs";
import { loadConfig } from "../config";
import { makeBaseline, writeBaseline } from "../baselines";

export async function cmdApprove(opts: {
  cwd: string;
  configPath: string;
  filter?: string;
  all: boolean;
  yes: boolean;
  now: string;
}): Promise<number> {
  const config: Config = loadConfig({ configPath: opts.configPath });
  const raw = readTextIfExists(join(opts.cwd, ".prompt-regression/last-run.json"));
  if (!raw) {
    console.error("prompt-regression: no last run found; run `prompt-regression run` first.");
    return 2;
  }
  const report = RunReportSchema.parse(JSON.parse(raw));
  let targets = report.results.filter((r) => r.verdict === "DRIFT" || r.verdict === "NEW");
  if (opts.filter) targets = targets.filter((r) => r.caseId.includes(opts.filter!));

  if (targets.length === 0) {
    console.log("prompt-regression: nothing to approve.");
    return 0;
  }
  for (const r of targets) {
    writeBaseline(config, opts.cwd, makeBaseline({
      caseId: r.caseId, provider: r.provider, model: r.model,
      temperature: config.defaults.temperature, maxTokens: config.defaults.maxTokens,
      renderedPrompt: "", output: r.output, approvedBy: "cli", createdAt: opts.now,
    }));
  }
  console.log(`approved ${targets.length} case${targets.length === 1 ? "" : "s"} → baseline updated`);
  return 0;
}
