import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../src/schemas";
import { loadCases } from "../src/cases";
import { runCases } from "../src/runner";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-run-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function project(): string {
  const root = tmp();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Greet {{name}}\ninput:\n  name: Ada\n",
  );
  return root;
}

test("first run creates a baseline and reports NEW, exit 0", async () => {
  const root = project();
  const cases = loadCases(DEFAULT_CONFIG, root);
  const report = await runCases({
    config: DEFAULT_CONFIG, cwd: root, cases,
    useCache: true, updateOnNew: true, now: "2026-07-20T00:00:00.000Z",
  });
  expect(report.results[0]!.verdict).toBe("NEW");
  expect(report.exitCode).toBe(0);
  // baseline file exists now
  const b = readFileSync(join(root, ".prompt-regression/baselines/hello.json"), "utf8");
  expect(b).toContain("\"caseId\": \"hello\"");
});

test("second unchanged run reports PASS, exit 0", async () => {
  const root = project();
  const cases = loadCases(DEFAULT_CONFIG, root);
  const opts = { config: DEFAULT_CONFIG, cwd: root, cases, useCache: true, updateOnNew: true, now: "2026-07-20T00:00:00.000Z" };
  await runCases(opts);
  const second = await runCases(opts);
  expect(second.results[0]!.verdict).toBe("PASS");
  expect(second.exitCode).toBe(0);
});

test("editing the prompt drives DRIFT, exit 1", async () => {
  const root = project();
  await runCases({ config: DEFAULT_CONFIG, cwd: root, cases: loadCases(DEFAULT_CONFIG, root), useCache: true, updateOnNew: true, now: "t" });
  // mutate the prompt so the mock output changes
  writeFileSync(
    join(root, "cases", "hello.case.yaml"),
    "id: hello\nprompt: Warmly greet {{name}} and wish them a good day\ninput:\n  name: Ada\n",
  );
  const report = await runCases({ config: DEFAULT_CONFIG, cwd: root, cases: loadCases(DEFAULT_CONFIG, root), useCache: false, updateOnNew: true, now: "t" });
  expect(report.results[0]!.verdict).toBe("DRIFT");
  expect(report.exitCode).toBe(1);
});

test("a filter selects a subset", async () => {
  const root = project();
  mkdirSync(join(root, "cases"), { recursive: true });
  writeFileSync(join(root, "cases", "bye.case.yaml"), "id: bye\nprompt: Farewell");
  const cases = loadCases(DEFAULT_CONFIG, root);
  const report = await runCases({ config: DEFAULT_CONFIG, cwd: root, cases, filter: "hello", useCache: true, updateOnNew: true, now: "t" });
  expect(report.results).toHaveLength(1);
  expect(report.results[0]!.caseId).toBe("hello");
});
