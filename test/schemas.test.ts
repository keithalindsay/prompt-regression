import { expect, test } from "vitest";
import {
  CaseSchema,
  ConfigSchema,
  DEFAULT_CONFIG,
  BaselineSchema,
} from "../src/schemas";

test("a minimal case requires an id and prompt", () => {
  const parsed = CaseSchema.parse({ id: "hello", prompt: "Hi {{name}}" });
  expect(parsed.id).toBe("hello");
  expect(parsed.prompt).toBe("Hi {{name}}");
});

test("a case without a prompt is rejected", () => {
  expect(() => CaseSchema.parse({ id: "x" })).toThrow();
});

test("case id must be kebab-case", () => {
  expect(() => CaseSchema.parse({ id: "Not Kebab", prompt: "y" })).toThrow();
});

test("config applies defaults for omitted fields", () => {
  const cfg = ConfigSchema.parse({});
  expect(cfg.defaults.provider).toBe("mock");
  expect(cfg.defaults.temperature).toBe(0);
  expect(cfg.thresholds.semanticMin).toBe(0.92);
  expect(cfg).toEqual(DEFAULT_CONFIG);
});

test("baseline record round-trips", () => {
  const b = BaselineSchema.parse({
    schemaVersion: 1,
    caseId: "hello",
    provider: "mock",
    model: "mock-1",
    params: { temperature: 0, maxTokens: 256 },
    renderedPromptHash: "sha256:abc",
    output: "hello",
    outputHash: "sha256:def",
    createdAt: "2026-07-20T00:00:00.000Z",
    approvedBy: "cli",
  });
  expect(b.caseId).toBe("hello");
});
