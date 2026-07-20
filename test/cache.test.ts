import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cacheKey, getCached, putCached } from "../src/cache";

const dirs: string[] = [];
function tmp() {
  const d = mkdtempSync(join(tmpdir(), "pr-cache-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

test("same inputs produce the same key; different inputs differ", () => {
  const base = { provider: "mock", model: "mock-1", temperature: 0, maxTokens: 64, user: "hi" };
  expect(cacheKey(base)).toBe(cacheKey({ ...base }));
  expect(cacheKey(base)).not.toBe(cacheKey({ ...base, user: "bye" }));
});

test("put then get round-trips; miss returns undefined", () => {
  const dir = tmp();
  const key = cacheKey({ provider: "mock", model: "mock-1", temperature: 0, maxTokens: 64, user: "hi" });
  expect(getCached(dir, key)).toBeUndefined();
  putCached(dir, key, "cached-output");
  expect(getCached(dir, key)).toBe("cached-output");
});
