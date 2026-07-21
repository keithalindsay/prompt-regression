// Regression tests added by an adversarial chaos-QA pass.
// Each test encodes a documented contract/invariant that the tool currently
// violates. They are expected to FAIL against the current implementation and to
// pass once the corresponding bug is fixed. They do not modify existing tests.
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { cmdInit } from "../src/commands/init";
import { cmdRun } from "../src/commands/run";
import { cmdApprove } from "../src/commands/approve";
import { cmdList } from "../src/commands/list";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-chaos-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function cfgPath(root: string) {
  return join(root, "prompt-regression.config.yaml");
}
function quiet() {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => {
    log.mockRestore();
    err.mockRestore();
  };
}

// ---------------------------------------------------------------------------
// FINDING 1 — Exit-code contract. DESIGN/README: exit 2 = usage/config error.
// The tool instead lets ConfigError/CaseError/JSON errors escape uncaught,
// which surfaces as exit 1 + a raw Node stack trace. A CI consumer cannot then
// distinguish a real DRIFT (1) from a misconfiguration (2).
// ---------------------------------------------------------------------------

test("run with invalid config YAML exits 2 (usage/config error), not 1", async () => {
  const root = tmp();
  const restore = quiet();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  // Malformed YAML (unterminated flow sequence).
  writeFileSync(cfgPath(root), "version: 1\ndefaults:\n  provider: [oops\n");
  const code = await cmdRun({
    cwd: root, configPath: cfgPath(root), ci: false, updateOnNew: true,
    useCache: true, color: false, now: "t",
  }).catch(() => "threw");
  restore();
  expect(code).toBe(2);
});

test("run with a schema-invalid case file exits 2, not 1", async () => {
  const root = tmp();
  const restore = quiet();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  // id violates the kebab-case rule → CaseSchema rejects it.
  writeFileSync(join(root, "cases", "hello.case.yaml"), "id: Not_Kebab\nprompt: hi\n");
  const code = await cmdRun({
    cwd: root, configPath: cfgPath(root), ci: false, updateOnNew: true,
    useCache: true, color: false, now: "t",
  }).catch(() => "threw");
  restore();
  expect(code).toBe(2);
});

test("approve with a corrupt last-run.json exits 2, not 1", async () => {
  const root = tmp();
  const restore = quiet();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  await cmdRun({
    cwd: root, configPath: cfgPath(root), ci: false, updateOnNew: true,
    useCache: true, color: false, now: "t",
  });
  writeFileSync(join(root, ".prompt-regression", "last-run.json"), "{ not json");
  const code = await cmdApprove({
    cwd: root, configPath: cfgPath(root), all: true, yes: true, now: "t",
  }).catch(() => "threw");
  restore();
  expect(code).toBe(2);
});

test("list with an invalid config exits 2, not 1 (and does not throw)", () => {
  const root = tmp();
  const restore = quiet();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  writeFileSync(cfgPath(root), 'version: 1\ndefaults:\n  maxTokens: "lots"\n');
  let code: number | "threw";
  try {
    code = cmdList({ cwd: root, configPath: cfgPath(root), json: false });
  } catch {
    code = "threw";
  }
  restore();
  expect(code).toBe(2);
});

// ---------------------------------------------------------------------------
// FINDING 2 — bogus --provider is a usage error (exit 2), not an internal crash.
// getProvider() has no default branch, so an unknown provider name resolves to
// `undefined` and the runner reports an ERROR verdict with the cryptic message
// "Cannot read properties of undefined (reading 'complete')" and exit 1.
// ---------------------------------------------------------------------------

test("unknown --provider value is a usage error (exit 2), not an ERROR verdict", async () => {
  const root = tmp();
  const restore = quiet();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  const code = await cmdRun({
    cwd: root, configPath: cfgPath(root),
    provider: "bogus" as unknown as "mock",
    ci: false, updateOnNew: true, useCache: true, color: false, now: "t",
  }).catch(() => "threw");
  restore();
  expect(code).toBe(2);
});

// ---------------------------------------------------------------------------
// FINDING 3 — `approve` corrupts baseline metadata. DESIGN §8 says the baseline
// records the case's actual params and the rendered-prompt hash. `approve`
// instead writes config-default params and renderedPromptHash = sha256("").
// ---------------------------------------------------------------------------

test("approve preserves the case's real params and rendered-prompt hash", async () => {
  const root = tmp();
  const restore = quiet();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  // Case overrides temperature/maxTokens away from the config defaults (0 / 1024).
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nname: greet\ntemperature: 0.7\nmaxTokens: 42\nprompt: Greet {{name}}\ninput:\n  name: Bob\n",
  );
  await cmdRun({
    cwd: root, configPath: cfgPath(root), ci: false, updateOnNew: true,
    useCache: true, color: false, now: "t",
  });
  await cmdApprove({ cwd: root, configPath: cfgPath(root), all: true, yes: true, now: "t" });
  restore();

  const baseline = JSON.parse(
    readFileSync(join(root, ".prompt-regression", "baselines", "hello.json"), "utf8"),
  );
  const emptyHash = "sha256:" + createHash("sha256").update("", "utf8").digest("hex");

  // The case set temperature 0.7 / maxTokens 42 — approve must not revert to defaults.
  expect(baseline.params.temperature).toBe(0.7);
  expect(baseline.params.maxTokens).toBe(42);
  // renderedPromptHash must reflect the real prompt, never the hash of "".
  expect(baseline.renderedPromptHash).not.toBe(emptyHash);
});

// ---------------------------------------------------------------------------
// FINDING 4 — With --update-on-new false, a NEW case is reported but no baseline
// is written (DESIGN). The reporter nevertheless prints "(baseline created)",
// which is a false statement about what happened on disk.
// ---------------------------------------------------------------------------

test("run --update-on-new false does not claim '(baseline created)' when it wrote nothing", async () => {
  const root = tmp();
  const lines: string[] = [];
  const log = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
    lines.push(a.join(" "));
  });
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfgPath(root) });
  await cmdRun({
    cwd: root, configPath: cfgPath(root), ci: false, updateOnNew: false,
    useCache: true, color: false, now: "t",
  });
  log.mockRestore();
  const output = lines.join("\n");
  expect(output).toContain("NEW");
  expect(output).not.toContain("(baseline created)");
});
