// Central handling for *usage/config* errors, which the CLI contract
// (README / DESIGN §7) says must exit 2 with a clean one-line message — not
// escape as an uncaught exception (raw stack trace + exit 1).
//
// A usage error is any of: a bad config (ConfigError), a bad case
// (CaseError), a malformed JSON payload such as a corrupt last-run.json
// (SyntaxError from JSON.parse), or a schema-validation failure (ZodError).
// Anything else is genuinely unexpected and is re-thrown untouched.

const USAGE_ERROR_NAMES = new Set([
  "ConfigError",
  "CaseError",
  "SyntaxError",
  "ZodError",
]);

export function isUsageError(e: unknown): e is Error {
  return e instanceof Error && USAGE_ERROR_NAMES.has(e.name);
}

function reportUsageError(e: Error): void {
  // One clean line to stderr — no stack trace, no internal dist/ paths.
  console.error(`prompt-regression: ${e.message}`);
}

/** Wrap an async command body; usage errors → clean message + exit code 2. */
export async function withUsageExit(fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (e) {
    if (isUsageError(e)) {
      reportUsageError(e);
      return 2;
    }
    throw e;
  }
}

/** Wrap a synchronous command body; usage errors → clean message + exit code 2. */
export function withUsageExitSync(fn: () => number): number {
  try {
    return fn();
  } catch (e) {
    if (isUsageError(e)) {
      reportUsageError(e);
      return 2;
    }
    throw e;
  }
}
