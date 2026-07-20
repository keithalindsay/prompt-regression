import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cfg-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("missing config file yields defaults", () => {
  const cfg = loadConfig({ configPath: join(tmp(), "none.yaml") });
  expect(cfg.defaults.provider).toBe("mock");
  expect(cfg.thresholds.semanticMin).toBe(0.92);
});

test("yaml values override defaults; CLI overrides beat file", () => {
  const dir = tmp();
  const p = join(dir, "prompt-regression.config.yaml");
  writeFileSync(
    p,
    "defaults:\n  provider: mock\n  model: mock-1\nthresholds:\n  semanticMin: 0.8\n",
  );
  const cfg = loadConfig({ configPath: p, overrides: { model: "mock-2" } });
  expect(cfg.thresholds.semanticMin).toBe(0.8);
  expect(cfg.defaults.model).toBe("mock-2"); // CLI override wins
});

test("invalid config throws ConfigError", () => {
  const dir = tmp();
  const p = join(dir, "bad.yaml");
  writeFileSync(p, "thresholds:\n  semanticMin: 5\n"); // > 1 invalid
  expect(() => loadConfig({ configPath: p })).toThrowError(/ConfigError|semanticMin/);
});
