import { join } from "node:path";
import { sha256 } from "./util/hash";
import { readTextIfExists, writeText } from "./util/fs";

export function cacheKey(input: {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  system?: string;
  user: string;
  seed?: number;
}): string {
  const canonical = JSON.stringify({
    provider: input.provider,
    model: input.model,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    system: input.system ?? null,
    user: input.user,
    seed: input.seed ?? null,
  });
  return sha256(canonical).slice("sha256:".length);
}

export function getCached(cacheDir: string, key: string): string | undefined {
  return readTextIfExists(join(cacheDir, key + ".txt"));
}

export function putCached(cacheDir: string, key: string, value: string): void {
  writeText(join(cacheDir, key + ".txt"), value);
}
