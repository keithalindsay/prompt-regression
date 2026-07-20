import { sha256 } from "../util/hash";
import type { CompletionRequest, Provider } from "./types";

const GREETINGS = [
  "Hello",
  "Hi there",
  "Good day",
  "Greetings",
  "Warm hello",
  "Well met",
];
const TAILS = [
  "lovely to meet you!",
  "wishing you a wonderful one!",
  "hope your day is bright!",
  "delighted to say hi!",
  "a pleasure as always!",
];

/** Deterministic hex → integer in [0, n). */
function pick(hex: string, offset: number, n: number): number {
  const slice = hex.slice(offset, offset + 6);
  return parseInt(slice, 16) % n;
}

export function createMockProvider(): Provider {
  return {
    name: "mock",
    async complete(req: CompletionRequest): Promise<string> {
      const hex = sha256((req.system ?? "") + " " + req.user).slice("sha256:".length);
      const g = GREETINGS[pick(hex, 0, GREETINGS.length)]!;
      const t = TAILS[pick(hex, 6, TAILS.length)]!;
      const nameMatch = req.user.match(/\b[A-Z][a-z]+\b/);
      const name = nameMatch ? nameMatch[0] : "friend";
      return `${g} ${name}, ${t}`;
    },
    async embed(text: string): Promise<number[]> {
      const hex = sha256(text).slice("sha256:".length);
      const dims = 16;
      const v: number[] = [];
      for (let i = 0; i < dims; i++) {
        v.push((parseInt(hex.slice(i * 2, i * 2 + 2), 16) - 128) / 128);
      }
      return v;
    },
  };
}
