import { ProviderError, type CompletionRequest, type Provider } from "./types";

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    // single bounded retry on any error
    return await fn().catch(() => {
      throw new ProviderError(`anthropic request failed: ${(e as Error).message}`);
    });
  }
}

export function createAnthropicProvider(): Provider {
  return {
    name: "anthropic",
    async complete(req: CompletionRequest): Promise<string> {
      const mod = await import("@anthropic-ai/sdk");
      const Anthropic = mod.default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await withRetry(() =>
        client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          temperature: req.temperature,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        }),
      );
      const block = (res.content ?? []).find((b: { type: string }) => b.type === "text") as
        | { type: "text"; text: string }
        | undefined;
      if (!block) throw new ProviderError("anthropic returned no text content");
      return block.text;
    },
  };
}
