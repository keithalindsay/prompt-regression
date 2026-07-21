import type { ProviderName } from "../schemas";
import { createMockProvider } from "./mock";
import { ProviderError, type Provider } from "./types";

export async function getProvider(name: ProviderName): Promise<Provider> {
  switch (name) {
    case "mock":
      return createMockProvider();
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new ProviderError(
          "Provider 'anthropic' requires ANTHROPIC_API_KEY in the environment.",
        );
      }
      const { createAnthropicProvider } = await import("./anthropic");
      return createAnthropicProvider();
    }
    case "openai": {
      if (!process.env.OPENAI_API_KEY) {
        throw new ProviderError(
          "Provider 'openai' requires OPENAI_API_KEY in the environment.",
        );
      }
      const { createOpenAIProvider } = await import("./openai");
      return createOpenAIProvider();
    }
    default:
      throw new ProviderError(
        `unknown provider '${name}' (valid: mock, anthropic, openai)`,
      );
  }
}
