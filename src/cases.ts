import { parse as parseYaml } from "yaml";
import { CaseSchema, type Case, type Config } from "./schemas";
import { findCaseFiles, readTextIfExists } from "./util/fs";

export class CaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaseError";
  }
}

export function loadCases(config: Config, cwd: string): Case[] {
  const files = findCaseFiles(config.casesGlob, cwd).sort();
  const cases: Case[] = [];
  const seen = new Map<string, string>();
  for (const file of files) {
    const raw = readTextIfExists(file);
    if (raw === undefined) continue;
    let data: unknown;
    try {
      data = parseYaml(raw);
    } catch (e) {
      throw new CaseError(`Failed to parse case ${file}: ${(e as Error).message}`);
    }
    const parsed = CaseSchema.safeParse(data);
    if (!parsed.success) {
      throw new CaseError(`Invalid case ${file}:\n${parsed.error.toString()}`);
    }
    const c = parsed.data;
    const prior = seen.get(c.id);
    if (prior) {
      throw new CaseError(`Duplicate case id "${c.id}" in ${file} and ${prior}.`);
    }
    seen.set(c.id, file);
    cases.push(c);
  }
  return cases;
}
