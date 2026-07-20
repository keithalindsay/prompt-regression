import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdInit } from "../src/commands/init";
import { cmdRun } from "../src/commands/run";
import { cmdApprove } from "../src/commands/approve";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-e2e-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("full lifecycle: init → NEW → PASS → edit → DRIFT(1) → approve → PASS(0)", async () => {
  const root = tmp();
  const cfg = join(root, "prompt-regression.config.yaml");
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  expect(cmdInit({ cwd: root, provider: "mock", force: false, configPath: cfg })).toBe(0);

  const base = { cwd: root, configPath: cfg, ci: false, updateOnNew: true, color: false, now: "t" };
  expect(await cmdRun({ ...base, useCache: true })).toBe(0); // NEW
  expect(await cmdRun({ ...base, useCache: true })).toBe(0); // PASS

  writeFileSync(join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Warmly greet {{name}} and wish them a splendid day\ninput:\n  name: Ada\n");

  expect(await cmdRun({ ...base, useCache: false })).toBe(1); // DRIFT
  expect(await cmdApprove({ cwd: root, configPath: cfg, all: true, yes: true, now: "t" })).toBe(0);
  expect(await cmdRun({ cwd: root, configPath: cfg, ci: true, updateOnNew: true, useCache: false, color: false, now: "t" })).toBe(0); // PASS

  log.mockRestore();
});
