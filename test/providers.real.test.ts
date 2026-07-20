import { afterEach, expect, test, vi } from "vitest";

afterEach(() => vi.resetModules());

test("anthropic provider maps a completion via the mocked SDK", async () => {
  vi.doMock("@anthropic-ai/sdk", () => {
    return {
      default: class {
        messages = {
          create: async () => ({ content: [{ type: "text", text: "Hi from Claude" }] }),
        };
      },
    };
  });
  process.env.ANTHROPIC_API_KEY = "test-key";
  const { createAnthropicProvider } = await import("../src/providers/anthropic");
  const p = createAnthropicProvider();
  const out = await p.complete({ user: "hi", model: "claude-haiku-4-5", temperature: 0, maxTokens: 64 });
  expect(out).toBe("Hi from Claude");
});

test("openai provider maps a completion via the mocked SDK", async () => {
  vi.doMock("openai", () => {
    return {
      default: class {
        chat = {
          completions: {
            create: async () => ({ choices: [{ message: { content: "Hi from GPT" } }] }),
          },
        };
      },
    };
  });
  process.env.OPENAI_API_KEY = "test-key";
  const { createOpenAIProvider } = await import("../src/providers/openai");
  const p = createOpenAIProvider();
  const out = await p.complete({ user: "hi", model: "gpt-4o-mini", temperature: 0, maxTokens: 64 });
  expect(out).toBe("Hi from GPT");
});
