import { parse as parseYaml } from "yaml";
import { ConfigSchema, type Config, type ProviderName } from "./schemas";
import { readTextIfExists } from "./util/fs";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface ConfigOverrides {
  casesGlob?: string;
  provider?: ProviderName;
  model?: string;
}

export function loadConfig(opts: {
  configPath: string;
  overrides?: ConfigOverrides;
}): Config {
  const raw = readTextIfExists(opts.configPath);
  let data: unknown = {};
  if (raw !== undefined) {
    try {
      data = parseYaml(raw) ?? {};
    } catch (e) {
      throw new ConfigError(
        `Failed to parse config at ${opts.configPath}: ${(e as Error).message}`,
      );
    }
  }
  const parsed = ConfigSchema.safeParse(data);
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid config at ${opts.configPath}:\n` + parsed.error.toString(),
    );
  }
  const cfg = parsed.data;
  const o = opts.overrides ?? {};
  return {
    ...cfg,
    casesGlob: o.casesGlob ?? cfg.casesGlob,
    defaults: {
      ...cfg.defaults,
      provider: o.provider ?? cfg.defaults.provider,
      model: o.model ?? cfg.defaults.model,
    },
  };
}
