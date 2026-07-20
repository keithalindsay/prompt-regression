import { expect, test } from "vitest";
import { renderReport, formatSummaryLine } from "../src/reporter";
import type { RunReport } from "../src/schemas";

function report(partial: Partial<RunReport> = {}): RunReport {
  return {
    schemaVersion: 1,
    startedAt: "t", finishedAt: "t",
    provider: "mock", model: "mock-1",
    totals: { total: 1, pass: 0, drift: 1, neu: 0, error: 0 },
    results: [
      {
        caseId: "hello", verdict: "DRIFT", provider: "mock", model: "mock-1",
        output: "new", baselineOutput: "old", semanticScore: 0.71,
        textDiff: "--- baseline\n+++ current\n@@ -1 +1 @@\n-old\n+new\n",
        changedLines: { added: 1, removed: 1 },
      },
    ],
    exitCode: 1,
    ...partial,
  };
}

test("summary line reflects totals", () => {
  expect(formatSummaryLine(report())).toBe("Summary: 1 total · 0 pass · 1 drift · 0 new · 0 error");
});

test("plain render (no color) shows verdict, score, diff, and exit", () => {
  const out = renderReport(report(), { color: false, showDiff: true });
  expect(out).toContain("DRIFT");
  expect(out).toContain("hello");
  expect(out).toContain("semantic=0.71");
  expect(out).toContain("+new");
  expect(out).toContain("Exit: 1");
});

test("showDiff=false omits the diff body", () => {
  const out = renderReport(report(), { color: false, showDiff: false });
  expect(out).not.toContain("+new");
});
