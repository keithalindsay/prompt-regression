import { join, isAbsolute } from "node:path";
import { BaselineSchema, type Baseline, type Config, type ProviderName } from "./schemas";
import { sha256 } from "./util/hash";
import { readTextIfExists, writeText } from "./util/fs";

export function baselinePath(config: Config, cwd: string, caseId: string): string {
  const dir = isAbsolute(config.baselineDir)
    ? config.baselineDir
    : join(cwd, config.baselineDir);
  return join(dir, `${caseId}.json`);
}

export function readBaseline(
  config: Config,
  cwd: string,
  caseId: string,
): Baseline | undefined {
  const raw = readTextIfExists(baselinePath(config, cwd, caseId));
  if (raw === undefined) return undefined;
  return BaselineSchema.parse(JSON.parse(raw));
}

export function writeBaseline(config: Config, cwd: string, record: Baseline): void {
  writeText(baselinePath(config, cwd, record.caseId), JSON.stringify(record, null, 2) + "\n");
}

export function makeBaseline(args: {
  caseId: string;
  provider: ProviderName;
  model: string;
  temperature: number;
  maxTokens: number;
  renderedPrompt: string;
  output: string;
  approvedBy: string;
  createdAt: string;
}): Baseline {
  return {
    schemaVersion: 1,
    caseId: args.caseId,
    provider: args.provider,
    model: args.model,
    params: { temperature: args.temperature, maxTokens: args.maxTokens },
    renderedPromptHash: sha256(args.renderedPrompt),
    output: args.output,
    outputHash: sha256(args.output),
    createdAt: args.createdAt,
    approvedBy: args.approvedBy,
  };
}
