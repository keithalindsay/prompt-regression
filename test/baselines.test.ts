import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "../src/schemas";
import { makeBaseline, readBaseline, writeBaseline } from "../src/baselines";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-base-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("makeBaseline hashes prompt and output", () => {
  const b = makeBaseline({
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    temperature: 0,
    maxTokens: 64,
    renderedPrompt: "Greet Ada",
    output: "Hello Ada!",
    approvedBy: "cli",
    createdAt: "2026-07-20T00:00:00.000Z",
  });
  expect(b.outputHash.startsWith("sha256:")).toBe(true);
  expect(b.renderedPromptHash.startsWith("sha256:")).toBe(true);
});

test("write then read round-trips a baseline", () => {
  const root = tmp();
  const b = makeBaseline({
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    temperature: 0,
    maxTokens: 64,
    renderedPrompt: "Greet Ada",
    output: "Hello Ada!",
    approvedBy: "cli",
    createdAt: "2026-07-20T00:00:00.000Z",
  });
  expect(readBaseline(DEFAULT_CONFIG, root, "hello")).toBeUndefined();
  writeBaseline(DEFAULT_CONFIG, root, b);
  expect(readBaseline(DEFAULT_CONFIG, root, "hello")?.output).toBe("Hello Ada!");
});
