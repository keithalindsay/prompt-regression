import { ProviderError, type CompletionRequest, type Provider } from "./types";

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    return await fn().catch(() => {
      throw new ProviderError(`openai request failed: ${(e as Error).message}`);
    });
  }
}

export function createOpenAIProvider(): Provider {
  return {
    name: "openai",
    async complete(req: CompletionRequest): Promise<string> {
      const mod = await import("openai");
      const OpenAI = mod.default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const messages = [
        ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
        { role: "user" as const, content: req.user },
      ];
      const res = await withRetry(() =>
        client.chat.completions.create({
          model: req.model,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
          messages,
        }),
      );
      const content = res.choices?.[0]?.message?.content;
      if (!content) throw new ProviderError("openai returned no content");
      return content;
    },
    async embed(text: string): Promise<number[]> {
      const mod = await import("openai");
      const OpenAI = mod.default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return res.data[0]!.embedding as number[];
    },
  };
}
