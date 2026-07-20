import { expect, test } from "vitest";
import { createMockProvider } from "../src/providers/mock";
import { getProvider } from "../src/providers/registry";

test("mock.complete is deterministic for identical prompts", async () => {
  const p = createMockProvider();
  const req = { user: "Greet Ada", model: "mock-1", temperature: 0, maxTokens: 64 };
  const a = await p.complete(req);
  const b = await p.complete(req);
  expect(a).toBe(b);
  expect(a.length).toBeGreaterThan(0);
});

test("mock.complete differs for different prompts", async () => {
  const p = createMockProvider();
  const a = await p.complete({ user: "Greet Ada", model: "mock-1", temperature: 0, maxTokens: 64 });
  const b = await p.complete({ user: "Greet Bob", model: "mock-1", temperature: 0, maxTokens: 64 });
  expect(a).not.toBe(b);
});

test("registry returns the mock provider with no env", async () => {
  const p = await getProvider("mock");
  expect(p.name).toBe("mock");
});

test("registry throws for anthropic without a key", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  await expect(getProvider("anthropic")).rejects.toThrow(/ANTHROPIC_API_KEY/);
  if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
});
