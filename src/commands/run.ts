import { writeText } from "../util/fs";
import { loadConfig, ConfigError } from "../config";
import { loadCases } from "../cases";
import { runCases } from "../runner";
import { renderReport } from "../reporter";
import { ProviderNameSchema } from "../schemas";
import { withUsageExit } from "../util/errors";

export async function cmdRun(opts: {
  cwd: string;
  configPath: string;
  casesGlob?: string;
  provider?: "mock" | "anthropic" | "openai";
  model?: string;
  filter?: string;
  ci: boolean;
  json?: string | true;
  updateOnNew: boolean;
  useCache: boolean;
  seed?: number;
  color: boolean;
  now: string;
}): Promise<number> {
  return withUsageExit(async () => {
    const config = loadConfig({
      configPath: opts.configPath,
      overrides: { casesGlob: opts.casesGlob, provider: opts.provider, model: opts.model },
    });

    // Validate the resolved provider up front: an unknown provider name is a
    // usage error (exit 2), not a per-case ERROR verdict from the runner.
    const validProviders = ProviderNameSchema.options;
    if (!validProviders.includes(config.defaults.provider)) {
      throw new ConfigError(
        `unknown provider '${config.defaults.provider}' (valid: ${validProviders.join(", ")})`,
      );
    }

    const cases = loadCases(config, opts.cwd);
    const report = await runCases({
      config, cwd: opts.cwd, cases, filter: opts.filter,
      useCache: opts.useCache, updateOnNew: opts.updateOnNew, seed: opts.seed, now: opts.now,
    });

    if (opts.json !== undefined) {
      const json = JSON.stringify(report, null, 2);
      if (typeof opts.json === "string") writeText(opts.json, json + "\n");
      else console.log(json);
    } else {
      console.log(renderReport(report, { color: opts.color, showDiff: config.report.showDiff && !opts.ci }));
    }
    return report.exitCode;
  });
}
