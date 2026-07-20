import type { Case } from "./schemas";

export class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptError";
  }
}

const VAR = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function substitute(template: string, input: Record<string, string | number | boolean>, caseId: string): string {
  return template.replace(VAR, (_m, key: string) => {
    if (!(key in input)) {
      throw new PromptError(
        `Case "${caseId}": template references {{${key}}} but no such variable is in "input".`,
      );
    }
    return String(input[key]);
  });
}

export function renderPrompt(c: Case): { system?: string; user: string } {
  const input = c.input ?? {};
  return {
    system: c.system !== undefined ? substitute(c.system, input, c.id) : undefined,
    user: substitute(c.prompt, input, c.id),
  };
}
