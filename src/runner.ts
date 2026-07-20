import { join } from "node:path";
import type { Case, Config, CaseResult, ProviderName, RunReport, Thresholds } from "./schemas";
import { getProvider } from "./providers/registry";
import type { Provider } from "./providers/types";
import { renderPrompt } from "./prompt";
import { cacheKey, getCached, putCached } from "./cache";
import { makeBaseline, readBaseline, writeBaseline } from "./baselines";
import { compare } from "./comparator";
import { tokenSetCosine } from "./util/similarity";
import { writeText } from "./util/fs";

export interface RunOptions {
  config: Config;
  cwd: string;
  cases: Case[];
  filter?: string;
  useCache: boolean;
  updateOnNew: boolean;
  seed?: number;
  now: string;
}

function resolveThresholds(config: Config, c: Case): Thresholds {
  return { ...config.thresholds, ...(c.thresholds ?? {}) } as Thresholds;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    ma += a[i]! * a[i]!;
    mb += b[i]! * b[i]!;
  }
  const d = Math.sqrt(ma) * Math.sqrt(mb);
  return d === 0 ? 0 : dot / d;
}

export async function runCases(opts: RunOptions): Promise<RunReport> {
  const { config, cwd, cases, filter, useCache, updateOnNew, seed, now } = opts;
  const selected = filter
    ? cases.filter((c) => c.id.includes(filter) || (c.name ?? "").includes(filter))
    : cases;

  const cacheDir = join(cwd, ".prompt-regression/cache");
  const results: CaseResult[] = [];
  const providerCache = new Map<ProviderName, Provider>();
  const startedAt = now;
  const topProvider = config.defaults.provider;
  const topModel = config.defaults.model;

  for (const c of selected) {
    const providerName = c.provider ?? config.defaults.provider;
    const model = c.model ?? config.defaults.model;
    const temperature = c.temperature ?? config.defaults.temperature;
    const maxTokens = c.maxTokens ?? config.defaults.maxTokens;

    try {
      const { system, user } = renderPrompt(c);

      let provider = providerCache.get(providerName);
      if (!provider) {
        provider = await getProvider(providerName);
        providerCache.set(providerName, provider);
      }

      const key = cacheKey({ provider: providerName, model, temperature, maxTokens, system, user, seed });
      let output = useCache ? getCached(cacheDir, key) : undefined;
      if (output === undefined) {
        output = await provider.complete({ system, user, model, temperature, maxTokens, seed });
        putCached(cacheDir, key, output);
      }

      const baseline = readBaseline(config, cwd, c.id);
      const thresholds = resolveThresholds(config, c);

      let semanticScore: number | undefined;
      if (baseline && provider.name !== "mock" && provider.embed) {
        const [eb, ec] = await Promise.all([provider.embed(baseline.output), provider.embed(output)]);
        semanticScore = cosine(eb, ec);
      }

      const result = compare({
        caseId: c.id, provider: providerName, model, output, baseline,
        thresholds, contextLines: config.report.contextLines, semanticScore,
      });

      if (result.verdict === "NEW" && updateOnNew) {
        writeBaseline(config, cwd, makeBaseline({
          caseId: c.id, provider: providerName, model, temperature, maxTokens,
          renderedPrompt: (system ?? "") + "\n" + user, output, approvedBy: "cli", createdAt: now,
        }));
      }

      results.push(result);
    } catch (e) {
      results.push({
        caseId: c.id, verdict: "ERROR", provider: providerName, model,
        output: "", error: (e as Error).message,
      });
    }
  }

  const totals = {
    total: results.length,
    pass: results.filter((r) => r.verdict === "PASS").length,
    drift: results.filter((r) => r.verdict === "DRIFT").length,
    neu: results.filter((r) => r.verdict === "NEW").length,
    error: results.filter((r) => r.verdict === "ERROR").length,
  };
  const exitCode: 0 | 1 = totals.drift + totals.error > 0 ? 1 : 0;

  const report: RunReport = {
    schemaVersion: 1, startedAt, finishedAt: now,
    provider: topProvider, model: topModel, totals, results, exitCode,
  };

  writeText(join(cwd, ".prompt-regression/last-run.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

export { tokenSetCosine };
