import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmdInit } from "../src/commands/init";
import { cmdRun } from "../src/commands/run";
import { cmdApprove } from "../src/commands/approve";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cmd-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("init scaffolds config + sample case", () => {
  const root = tmp();
  const code = cmdInit({ cwd: root, provider: "mock", force: false, configPath: join(root, "prompt-regression.config.yaml") });
  expect(code).toBe(0);
  expect(existsSync(join(root, "prompt-regression.config.yaml"))).toBe(true);
  expect(existsSync(join(root, "cases", "hello.case.yaml"))).toBe(true);
});

test("run after init: NEW (exit 0), then PASS (exit 0)", async () => {
  const root = tmp();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: join(root, "prompt-regression.config.yaml") });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const first = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: true, color: false, now: "t" });
  const second = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: true, color: false, now: "t" });
  log.mockRestore();
  expect(first).toBe(0);
  expect(second).toBe(0);
});

test("approve --all promotes the last run's output", async () => {
  const root = tmp();
  cmdInit({ cwd: root, provider: "mock", force: false, configPath: join(root, "prompt-regression.config.yaml") });
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  // create baseline via first run, then mutate prompt to force drift
  await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: true, color: false, now: "t" });
  writeFileSync(join(root, "cases", "hello.case.yaml"), "id: hello\nprompt: Totally different wording now\n");
  const drift = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: false, updateOnNew: true, useCache: false, color: false, now: "t" });
  expect(drift).toBe(1);
  const approved = await cmdApprove({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), all: true, yes: true, now: "t" });
  expect(approved).toBe(0);
  const green = await cmdRun({ cwd: root, configPath: join(root, "prompt-regression.config.yaml"), ci: true, updateOnNew: true, useCache: false, color: false, now: "t" });
  expect(green).toBe(0);
  log.mockRestore();
});
