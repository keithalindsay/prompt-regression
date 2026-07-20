import type { ProviderName } from "../schemas";

export interface CompletionRequest {
  system?: string;
  user: string;
  model: string;
  temperature: number;
  maxTokens: number;
  seed?: number;
}

export interface Provider {
  name: ProviderName;
  complete(req: CompletionRequest): Promise<string>;
  embed?(text: string): Promise<number[]>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
