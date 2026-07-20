import { expect, test } from "vitest";
import { compare, normalize } from "../src/comparator";
import { DEFAULT_CONFIG, type Baseline } from "../src/schemas";

const T = DEFAULT_CONFIG.thresholds;

function baseline(output: string): Baseline {
  return {
    schemaVersion: 1,
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    params: { temperature: 0, maxTokens: 64 },
    renderedPromptHash: "sha256:x",
    output,
    outputHash: "sha256:y",
    createdAt: "2026-07-20T00:00:00.000Z",
    approvedBy: "cli",
  };
}

test("no baseline yields NEW", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "anything", thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("NEW");
});

test("identical normalized output yields PASS", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "Hello Ada!", baseline: baseline("Hello Ada!"),
    thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("PASS");
});

test("whitespace-only change passes via textNormalize", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "Hello   Ada!\n", baseline: baseline("Hello Ada!"),
    thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("PASS");
});

test("semantically distant change yields DRIFT with a diff", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "The quarterly revenue fell by twelve percent.",
    baseline: baseline("Hello Ada, lovely to meet you!"),
    thresholds: T, contextLines: 3,
  });
  expect(r.verdict).toBe("DRIFT");
  expect(r.textDiff).toContain("+");
  expect(r.changedLines).toBeDefined();
  expect(typeof r.semanticScore).toBe("number");
});

test("paraphrase above semanticMin passes but still records a score", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "Hello Ada lovely to meet you",
    baseline: baseline("Hello Ada lovely to meet you!"),
    thresholds: { ...T, semanticMin: 0.5 },
    contextLines: 3,
  });
  expect(r.verdict).toBe("PASS");
});

test("provided embedding score overrides local similarity", () => {
  const r = compare({
    caseId: "hello", provider: "mock", model: "mock-1",
    output: "totally different words here",
    baseline: baseline("Hello Ada, lovely to meet you!"),
    thresholds: T, contextLines: 3, semanticScore: 0.99,
  });
  expect(r.verdict).toBe("PASS");
});

test("normalize strips ignorePatterns (timestamps)", () => {
  const withTs = "Logged at 2026-07-20T12:00:00.000Z done";
  expect(normalize(withTs, T)).not.toContain("2026-07-20T12:00:00.000Z");
});
