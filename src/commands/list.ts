import { loadConfig } from "../config";
import { loadCases } from "../cases";
import { readBaseline } from "../baselines";
import { withUsageExitSync } from "../util/errors";

export function cmdList(opts: { cwd: string; configPath: string; json: boolean }): number {
  return withUsageExitSync(() => {
    const config = loadConfig({ configPath: opts.configPath });
    const cases = loadCases(config, opts.cwd);
    const rows = cases.map((c) => ({
      id: c.id,
      name: c.name ?? "",
      provider: c.provider ?? config.defaults.provider,
      model: c.model ?? config.defaults.model,
      status: readBaseline(config, opts.cwd, c.id) ? "baselined" : "no-baseline",
    }));
    if (opts.json) {
      console.log(JSON.stringify(rows, null, 2));
    } else {
      for (const r of rows) {
        console.log(`${r.id.padEnd(20)} ${r.provider}/${r.model}  ${r.status}${r.name ? "  " + r.name : ""}`);
      }
    }
    return 0;
  });
}
